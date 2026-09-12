import { Agent, callable, getAgentByName } from 'agents';
import {
	pollNotifications,
	markNotificationRead,
	findOrCreateWikiSpace,
	findOrCreateDecisionLogDatabase
} from '../ambiguous';
import type { EvaluatorAgent } from './evaluator';
import type { NotifierAgent } from './notifier';
import type { ExtractorAgent } from './extractor';

export type RegisteredAssumption = {
	decisionId: string;
	decisionStatement: string;
	assumptionId: string;
	statement: string;
	telegramChatId?: string;
};

export type WatcherState = {
	assumptions: RegisteredAssumption[];
	wikiDatabaseId: string | null;
};

const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'by', 'before', 'this', 'and', 'both']);

function significantWords(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.split(/\s+/)
			.filter((w) => w.length > 2 && !STOPWORDS.has(w))
	);
}

export function isPlausibleEvidence(
	evidenceText: string,
	assumptions: RegisteredAssumption[]
): RegisteredAssumption[] {
	const evidenceWords = significantWords(evidenceText);
	return assumptions.filter((a) => {
		const assumptionWords = significantWords(a.statement);
		let overlap = 0;
		for (const w of assumptionWords) if (evidenceWords.has(w)) overlap++;
		return overlap >= 2;
	});
}

const CONFIDENCE_THRESHOLD = 0.7;

export class WatcherAgent extends Agent<Env, WatcherState> {
	initialState: WatcherState = { assumptions: [], wikiDatabaseId: null };

	@callable()
	registerAssumption(input: RegisteredAssumption) {
		const rest = this.state.assumptions.filter((a) => a.assumptionId !== input.assumptionId);
		this.setState({ ...this.state, assumptions: [...rest, input] });
	}

	@callable()
	async ensureWikiDatabase(): Promise<string> {
		if (this.state.wikiDatabaseId) return this.state.wikiDatabaseId;
		const space = await findOrCreateWikiSpace(this.env, 'assumption-alarm', 'Assumption Alarm');
		const { databaseId } = await findOrCreateDecisionLogDatabase(this.env, space.id);
		this.setState({ ...this.state, wikiDatabaseId: databaseId });
		return databaseId;
	}

	async onStart() {
		await this.scheduleEvery(60, 'poll');
	}

	async poll() {
		const notifications = await pollNotifications(this.env);
		for (const n of notifications) {
			const text = String(n.content.preview ?? n.content.summary ?? '');
			if (!text) {
				await markNotificationRead(this.env, n.notification_id);
				continue;
			}
			try {
				await this.dispatchEvidence(text, n.notification_id);
				await markNotificationRead(this.env, n.notification_id);
			} catch (err) {
				console.error(`Failed to dispatch evidence ${n.notification_id}; leaving unread for retry`, err);
			}
		}
	}

	@callable()
	async evaluateNow(evidenceText: string) {
		await this.dispatchEvidence(evidenceText, `sync:${Date.now()}`);
	}

	@callable()
	async applyAssumptionAction(assumptionId: string, action: 'review' | 'update' | 'dismiss') {
		const match = this.state.assumptions.find((a) => a.assumptionId === assumptionId);
		if (!match) return;
		const extractor = (await getAgentByName(
			this.env.Extractor as any,
			match.decisionId
		)) as unknown as ExtractorAgent;
		await extractor.applyAction(assumptionId, action);
		if (action === 'dismiss') {
			this.setState({
				...this.state,
				assumptions: this.state.assumptions.filter((a) => a.assumptionId !== assumptionId)
			});
		}
	}

	private async dispatchEvidence(evidenceText: string, evidenceRef: string) {
		const matches = isPlausibleEvidence(evidenceText, this.state.assumptions);
		for (const match of matches) {
			let result;
			try {
				result = await this.retry(async () => {
					const evaluator = (await getAgentByName(this.env.Evaluator as any, match.assumptionId)) as unknown as EvaluatorAgent;
					return evaluator.evaluate({
						decisionStatement: match.decisionStatement,
						assumptionStatement: match.statement,
						evidenceText
					});
				});
			} catch (err) {
				console.error(`Evaluator failed for assumption ${match.assumptionId}, skipping this item`, err);
				continue;
			}

			const extractor = (await getAgentByName(this.env.Extractor as any, match.decisionId)) as unknown as ExtractorAgent;
			const { isDuplicate } = await extractor.recordVerdict(match.assumptionId, result, evidenceRef);
			if (isDuplicate) continue;

			if ((result.verdict === 'contradict' || result.verdict === 'weaken') && result.confidence >= CONFIDENCE_THRESHOLD) {
				const notifier = (await getAgentByName(this.env.Notifier as any, match.assumptionId)) as unknown as NotifierAgent;
				await notifier.notify({
					decisionId: match.decisionId,
					assumptionId: match.assumptionId,
					assumptionStatement: match.statement,
					evidenceText,
					evidenceRef,
					verdict: result,
					ambiguousChannelId: this.env.AMBIGUOUS_ALERTS_CHANNEL_ID,
					telegramChatId: match.telegramChatId
				});
			}
		}
	}
}
