import { Agent as CloudflareAgent, callable, getAgentByName } from 'agents';
import { Agent, tool, run, setDefaultOpenAIKey } from '@openai/agents';
import { z } from 'zod';
import type { WatcherAgent } from './watcher';
import {
	findOrCreateWikiSpace,
	findOrCreateDecisionLogDatabase,
	createDatabaseRow,
	updateDatabaseRow
} from '../ambiguous';

export type Reason = { id: string; text: string };
export type Decision = { id: string; statement: string; reasons: Reason[]; status: 'pending' | 'confirmed' };
export type Assumption = {
	id: string;
	decisionId: string;
	statement: string;
	linkedReasonId?: string;
	status: 'pending' | 'active' | 'invalidated' | 'dismissed';
};
export type AssumptionVerdict = {
	id: string;
	assumptionId: string;
	verdict: string;
	confidence: number;
	reasoning: string;
	evidenceRef: string;
	createdAt: number;
};

export function appendVerdict(
	history: AssumptionVerdict[],
	entry: Omit<AssumptionVerdict, 'id' | 'createdAt'>
): AssumptionVerdict[] {
	return [...history, { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }];
}

function buildDecisionLogRow(
	decision: Decision,
	assumption: Assumption,
	latestVerdict: AssumptionVerdict | null
): Record<string, unknown> {
	return {
		Decision: decision.statement,
		'Reason(s)': decision.reasons.map((r) => r.text).join('; '),
		Assumption: assumption.statement,
		Status: assumption.status,
		Confidence: latestVerdict?.confidence ?? null,
		'Last evidence': latestVerdict?.evidenceRef ?? null
	};
}

type ExtractorState = {
	decision: Decision | null;
	assumptions: Assumption[];
	verdictHistory: Record<string, AssumptionVerdict[]>;
	wikiDatabaseId: string | null;
	wikiRowIds: Record<string, string>;
};

export class ExtractorAgent extends CloudflareAgent<Env, ExtractorState> {
	initialState: ExtractorState = {
		decision: null,
		assumptions: [],
		verdictHistory: {},
		wikiDatabaseId: null,
		wikiRowIds: {}
	};

	@callable()
	async extract(message: string): Promise<{ decision: Decision; assumptions: Assumption[] }> {
		let decision: Decision | null = null;
		let assumptions: Assumption[] = [];

		const recordDecision = tool({
			name: 'record_decision',
			description: 'Record the decision statement and the reasons it was considered safe to make.',
			parameters: z.object({ statement: z.string(), reasons: z.array(z.string()).min(1).max(5) }),
			execute: async (args) => {
				decision = {
					id: crypto.randomUUID(),
					statement: args.statement,
					reasons: args.reasons.map((text) => ({ id: crypto.randomUUID(), text })),
					status: 'pending'
				};
				return { ok: true };
			}
		});

		const recordAssumptions = tool({
			name: 'record_assumptions',
			description:
				'1-3 trackable assumptions extracted from the decision reasons, each linked to the reason index it came from.',
			parameters: z.object({
				assumptions: z
					.array(z.object({ statement: z.string(), reasonIndex: z.number().int().min(0) }))
					.min(1)
					.max(3)
			}),
			execute: async (args) => {
				if (!decision) return { ok: false, error: 'record_decision must be called first' };
				assumptions = args.assumptions.map((a) => ({
					id: crypto.randomUUID(),
					decisionId: decision!.id,
					statement: a.statement,
					linkedReasonId: decision!.reasons[a.reasonIndex]?.id,
					status: 'pending' as const
				}));
				return { ok: true };
			}
		});

		const agent = new Agent({
			name: 'AssumptionAlarmExtractor',
			instructions: [
				'Extract the decision and the reasons/conditions that made it safe from the message.',
				'Call record_decision exactly once with the decision statement and its reasons.',
				'Then call record_assumptions exactly once with 1-3 trackable assumptions, each linked to the reason index that produced it.',
				'Never invent assumptions not implied by the message.'
			].join('\n'),
			tools: [recordDecision, recordAssumptions],
			model: 'gpt-4.1-mini'
		});

		setDefaultOpenAIKey(this.env.OPENAI_API_KEY);
		await run(agent, message);

		if (!decision || assumptions.length === 0) {
			throw new Error('Could not extract a decision and assumptions from that message. Please restate it.');
		}

		this.setState({ decision, assumptions, verdictHistory: {}, wikiDatabaseId: null, wikiRowIds: {} });
		return { decision, assumptions };
	}

	@callable()
	async confirm(assumptionIds: string[]) {
		const assumptions = this.state.assumptions.map((a) =>
			assumptionIds.includes(a.id) ? { ...a, status: 'active' as const } : a
		);
		const decision = this.state.decision && { ...this.state.decision, status: 'confirmed' as const };
		this.setState({ ...this.state, assumptions, decision });

		if (!decision) return;
		try {
			const watcher = (await getAgentByName(this.env.Watcher as any, 'global')) as unknown as WatcherAgent;
			await this.retry(async () => {
				for (const id of assumptionIds) {
					const assumption = assumptions.find((a) => a.id === id);
					if (!assumption) continue;
					await watcher.registerAssumption({
						decisionId: decision.id,
						decisionStatement: decision.statement,
						assumptionId: assumption.id,
						statement: assumption.statement
					});
				}
			});
		} catch (err) {
			console.error('Failed to register confirmed assumptions with WatcherAgent after retries — they will not be watched', err);
		}

		// Decision Log wiki write is visibility, not the source of truth (state above already
		// has the confirmed assumptions) — a wiki failure must not stop confirmation.
		try {
			const space = await findOrCreateWikiSpace(this.env, 'assumption-alarm', 'Assumption Alarm');
			const { databaseId } = await findOrCreateDecisionLogDatabase(this.env, space.id);
			const wikiRowIds = { ...this.state.wikiRowIds };
			for (const id of assumptionIds) {
				const assumption = assumptions.find((a) => a.id === id);
				if (!assumption) continue;
				const row = await createDatabaseRow(this.env, databaseId, buildDecisionLogRow(decision, assumption, null));
				wikiRowIds[id] = row.id;
			}
			this.setState({ ...this.state, assumptions, decision, wikiDatabaseId: databaseId, wikiRowIds });
		} catch (err) {
			console.error('Decision Log wiki write failed; assumptions are still confirmed in state', err);
		}
	}

	@callable()
	async recordVerdict(
		assumptionId: string,
		verdict: Omit<AssumptionVerdict, 'id' | 'assumptionId' | 'createdAt' | 'evidenceRef'>,
		evidenceRef: string
	): Promise<{ history: AssumptionVerdict[]; isDuplicate: boolean }> {
		const existing = this.state.verdictHistory[assumptionId] ?? [];
		if (existing.some((v) => v.evidenceRef === evidenceRef)) {
			return { history: existing, isDuplicate: true };
		}
		const history = appendVerdict(existing, { ...verdict, assumptionId, evidenceRef });
		const latest = history[history.length - 1];
		const isInvalidating = verdict.verdict === 'contradict' || verdict.verdict === 'weaken';
		const assumptions = isInvalidating
			? this.state.assumptions.map((a) => (a.id === assumptionId ? { ...a, status: 'invalidated' as const } : a))
			: this.state.assumptions;
		this.setState({
			...this.state,
			assumptions,
			verdictHistory: { ...this.state.verdictHistory, [assumptionId]: history }
		});
		await this.syncWikiRow(assumptionId, latest);
		return { history, isDuplicate: false };
	}

	@callable()
	async applyAction(assumptionId: string, action: 'review' | 'update' | 'dismiss') {
		if (action === 'review') return;
		const status: Assumption['status'] = action === 'dismiss' ? 'dismissed' : 'pending';
		const assumptions = this.state.assumptions.map((a) => (a.id === assumptionId ? { ...a, status } : a));
		this.setState({ ...this.state, assumptions });
		const history = this.state.verdictHistory[assumptionId] ?? [];
		await this.syncWikiRow(assumptionId, history[history.length - 1] ?? null);
	}

	private async syncWikiRow(assumptionId: string, latestVerdict: AssumptionVerdict | null) {
		const { decision, wikiDatabaseId, wikiRowIds } = this.state;
		const assumption = this.state.assumptions.find((a) => a.id === assumptionId);
		const rowId = wikiRowIds[assumptionId];
		if (!decision || !assumption || !wikiDatabaseId || !rowId) return;
		try {
			await updateDatabaseRow(this.env, wikiDatabaseId, rowId, buildDecisionLogRow(decision, assumption, latestVerdict));
		} catch (err) {
			console.error('Decision Log wiki row update failed (non-fatal)', err);
		}
	}
}
