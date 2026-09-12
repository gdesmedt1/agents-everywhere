/* eslint-disable @typescript-eslint/no-explicit-any -- test stubs `state`/`setState` on the Agent
   prototype without a live Durable Object ctx/env (see note below); every agent test in this plan
   uses this same pattern. */
import { describe, it, expect, vi } from 'vitest';

// `agents` imports `cloudflare:workers` at module top level, which does not exist
// outside the actual Workers runtime — this repo's Vitest runs `environment: 'node'`
// (no `@cloudflare/vitest-pool-workers`, out of scope per Global Constraints), so
// importing anything from a file that imports the real `agents` package crashes
// immediately at import time, before any test runs. Mocking the module with a plain
// class avoids that crash entirely.
vi.mock('agents', () => ({
	Agent: class {},
	callable: () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) => descriptor,
	getAgentByName: vi.fn()
}));

import { WatcherAgent, isPlausibleEvidence, type RegisteredAssumption } from './watcher';

describe('WatcherAgent.registerAssumption', () => {
	it('adds a new assumption to state', () => {
		const agent = Object.create(WatcherAgent.prototype) as WatcherAgent;
		Object.defineProperty(agent, 'state', {
			value: { assumptions: [] },
			writable: true,
			configurable: true
		});
		(agent as any).setState = (next: unknown) => {
			(agent as any).state = next;
		};

		agent.registerAssumption({
			decisionId: 'dec_1',
			decisionStatement: 'Launch the pricing page Friday',
			assumptionId: 'asm_1',
			statement: 'Legal approves by Wednesday'
		});

		expect((agent as any).state.assumptions).toEqual([
			{
				decisionId: 'dec_1',
				decisionStatement: 'Launch the pricing page Friday',
				assumptionId: 'asm_1',
				statement: 'Legal approves by Wednesday'
			}
		]);
	});

	it('is idempotent for the same assumptionId', () => {
		const agent = Object.create(WatcherAgent.prototype) as WatcherAgent;
		Object.defineProperty(agent, 'state', {
			value: {
				assumptions: [
					{
						decisionId: 'dec_1',
						decisionStatement: 'Launch Friday',
						assumptionId: 'asm_1',
						statement: 'old text'
					}
				]
			},
			writable: true,
			configurable: true
		});
		(agent as any).setState = (next: unknown) => {
			(agent as any).state = next;
		};

		agent.registerAssumption({
			decisionId: 'dec_1',
			decisionStatement: 'Launch Friday',
			assumptionId: 'asm_1',
			statement: 'new text'
		});

		expect((agent as any).state.assumptions).toHaveLength(1);
		expect((agent as any).state.assumptions[0].statement).toBe('new text');
	});
});

describe('isPlausibleEvidence', () => {
	const assumptions: RegisteredAssumption[] = [
		{
			decisionId: 'dec_1',
			decisionStatement: 'Launch the pricing page Friday',
			assumptionId: 'asm_1',
			statement: 'Legal approval completed by Wednesday'
		},
		{
			decisionId: 'dec_1',
			decisionStatement: 'Launch the pricing page Friday',
			assumptionId: 'asm_2',
			statement: 'Payments testing complete before launch'
		}
	];

	it('matches evidence sharing significant words with an assumption', () => {
		const matches = isPlausibleEvidence('Legal approval slipped to Thursday.', assumptions);
		expect(matches.map((a) => a.assumptionId)).toEqual(['asm_1']);
	});

	it('returns no matches for unrelated evidence', () => {
		const matches = isPlausibleEvidence('The office coffee machine is broken.', assumptions);
		expect(matches).toEqual([]);
	});

	it('can match more than one assumption', () => {
		const matches = isPlausibleEvidence('Legal approval and payments testing both slipped.', assumptions);
		expect(matches.map((a) => a.assumptionId).sort()).toEqual(['asm_1', 'asm_2']);
	});
});
