/* eslint-disable @typescript-eslint/no-explicit-any -- test stubs `state`/`setState` on the Agent
   prototype without a live Durable Object ctx/env (see note below); every agent test in this plan
   uses this same pattern. */
import { describe, it, expect } from 'vitest';
import { WatcherAgent } from './watcher';

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
