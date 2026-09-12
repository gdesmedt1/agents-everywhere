import { Agent, callable, getAgentByName } from 'agents';
import { pollNotifications, markNotificationRead } from '../ambiguous';
import type { EvaluatorAgent } from './evaluator';
import type { NotifierAgent } from './notifier';
import type { ExtractorAgent } from './extractor';

export type RegisteredAssumption = {
	decisionId: string;
	decisionStatement: string;
	assumptionId: string;
	statement: string;
};

export type WatcherState = {
	assumptions: RegisteredAssumption[];
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
	initialState: WatcherState = { assumptions: [] };

	@callable()
	registerAssumption(input: RegisteredAssumption) {
		const rest = this.state.assumptions.filter((a) => a.assumptionId !== input.assumptionId);
		this.setState({ assumptions: [...rest, input] });
	}

	async onStart() {
		await this.scheduleEvery(60, 'poll');
	}

	async poll() {
		const notifications = await pollNotifications(this.env);
		for (const n of notifications) {
			const { was_unread } = await markNotificationRead(this.env, n.notification_id);
			if (!was_unread) continue;
			const text = String(n.content.preview ?? n.content.summary ?? '');
			if (text) await this.dispatchEvidence(text, n.notification_id);
		}
	}

	@callable()
	async evaluateNow(evidenceText: string) {
		await this.dispatchEvidence(evidenceText, `sync:${Date.now()}`);
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
					ambiguousChannelId: this.env.AMBIGUOUS_ALERTS_CHANNEL_ID
				});
			}
		}
	}
}
