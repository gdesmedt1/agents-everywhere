/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

vi.mock('agents', () => ({
	Agent: class {},
	callable: () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) => descriptor,
	getAgentByName: vi.fn()
}));

vi.mock('@openai/agents', () => ({
	Agent: vi.fn().mockImplementation((config) => config),
	tool: vi.fn().mockImplementation((config) => config),
	run: vi.fn(),
	setDefaultOpenAIKey: vi.fn()
}));

vi.mock('../ambiguous', () => ({
	createDatabaseRow: vi.fn(),
	updateDatabaseRow: vi.fn()
}));

import { ExtractorAgent, appendVerdict } from './extractor';

function stubExtractor(state: Record<string, unknown>, name = 'dec_1') {
	const agent = Object.create(ExtractorAgent.prototype) as ExtractorAgent;
	Object.defineProperty(agent, 'name', { value: name, configurable: true });
	Object.defineProperty(agent, 'state', {
		value: state,
		writable: true,
		configurable: true
	});
	(agent as any).env = { OPENAI_API_KEY: 'sk-test' };
	(agent as any).setState = (next: unknown) => {
		(agent as any).state = next;
	};
	return agent;
}

describe('appendVerdict', () => {
	it('appends a new verdict entry without mutating the input array', () => {
		const history: any[] = [];
		const next = appendVerdict(history, {
			assumptionId: 'asm_1',
			verdict: 'support',
			confidence: 0.6,
			reasoning: 'No change yet.',
			evidenceRef: 'n_1'
		});
		expect(history).toHaveLength(0);
		expect(next).toHaveLength(1);
		expect(next[0]).toMatchObject({ assumptionId: 'asm_1', verdict: 'support' });
	});
});

describe('ExtractorAgent.recordVerdict', () => {
	it('does not invalidate below the confidence threshold', async () => {
		const agent = stubExtractor({
			decision: { id: 'dec_1', statement: 'x', reasons: [], status: 'confirmed' },
			assumptions: [{ id: 'asm_1', decisionId: 'dec_1', statement: 'a', status: 'active' }],
			verdictHistory: {},
			wikiDatabaseId: null,
			wikiRowIds: {}
		});
		await agent.recordVerdict(
			'asm_1',
			{ verdict: 'contradict', confidence: 0.2, reasoning: 'weak signal' },
			'n_1'
		);
		expect((agent as any).state.assumptions[0].status).toBe('active');
	});

	it('invalidates when contradict confidence is at or above threshold', async () => {
		const agent = stubExtractor({
			decision: { id: 'dec_1', statement: 'x', reasons: [], status: 'confirmed' },
			assumptions: [{ id: 'asm_1', decisionId: 'dec_1', statement: 'a', status: 'active' }],
			verdictHistory: {},
			wikiDatabaseId: null,
			wikiRowIds: {}
		});
		await agent.recordVerdict(
			'asm_1',
			{ verdict: 'contradict', confidence: 0.9, reasoning: 'deadline missed' },
			'n_1'
		);
		expect((agent as any).state.assumptions[0].status).toBe('invalidated');
	});
});
