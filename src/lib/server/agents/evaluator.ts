import { Agent as CloudflareAgent, callable } from 'agents';
import { Agent, tool, run, setDefaultOpenAIKey } from '@openai/agents';
import { z } from 'zod';

export type Verdict = 'support' | 'contradict' | 'weaken' | 'irrelevant';

export type EvaluateInput = {
	decisionStatement: string;
	assumptionStatement: string;
	evidenceText: string;
};

export type EvaluateResult = {
	verdict: Verdict;
	confidence: number;
	reasoning: string;
};

export class EvaluatorAgent extends CloudflareAgent<Env, Record<string, never>> {
	@callable()
	async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
		let captured: EvaluateResult | null = null;

		const recordVerdict = tool({
			name: 'record_verdict',
			description:
				'Record how a piece of new evidence relates to a specific assumption behind a decision.',
			parameters: z.object({
				verdict: z.enum(['support', 'contradict', 'weaken', 'irrelevant']),
				confidence: z.number().min(0).max(1),
				reasoning: z.string()
			}),
			execute: async (args) => {
				captured = args;
				return { ok: true };
			}
		});

		const agent = new Agent({
			name: 'AssumptionAlarmEvaluator',
			instructions: [
				'You evaluate whether new workplace evidence affects a specific assumption behind a decision.',
				'Classify the relationship as support, contradict, weaken, or irrelevant.',
				'Always call record_verdict exactly once with your classification, a confidence from 0 to 1, and a one-sentence reasoning.',
				`Decision: ${input.decisionStatement}`,
				`Assumption: ${input.assumptionStatement}`,
				`New evidence: ${input.evidenceText}`
			].join('\n'),
			tools: [recordVerdict],
			model: 'gpt-4.1-mini'
		});

		setDefaultOpenAIKey(this.env.OPENAI_API_KEY);
		const result = await run(agent, 'Classify the evidence against the assumption.');

		if (captured) return captured;
		return {
			verdict: 'irrelevant',
			confidence: 0,
			reasoning: typeof result.finalOutput === 'string' ? result.finalOutput : 'No verdict produced.'
		};
	}
}
