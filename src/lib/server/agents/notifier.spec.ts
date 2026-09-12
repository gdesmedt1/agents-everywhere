import { describe, it, expect, vi } from 'vitest';

vi.mock('agents', () => ({
	Agent: class {},
	callable: () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) => descriptor
}));

import { formatAlertMessage } from './notifier';

describe('formatAlertMessage', () => {
	it('includes the assumption, evidence, and verdict reasoning', () => {
		const message = formatAlertMessage({
			decisionId: 'dec_1',
			assumptionId: 'asm_1',
			assumptionStatement: 'Legal approval completed by Wednesday',
			evidenceText: 'Legal review is delayed. Earliest approval is Friday afternoon.',
			evidenceRef: 'n_123',
			verdict: { verdict: 'contradict', confidence: 0.9, reasoning: 'Approval now expected after the deadline.' }
		});
		expect(message).toContain('Decision may need review');
		expect(message).toContain('Legal approval completed by Wednesday');
		expect(message).toContain('No longer true');
	});

	it('labels a weaken verdict differently from a contradict verdict', () => {
		const message = formatAlertMessage({
			decisionId: 'dec_1',
			assumptionId: 'asm_1',
			assumptionStatement: 'Payments testing complete',
			evidenceText: 'Payments testing found two edge-case bugs.',
			evidenceRef: 'n_124',
			verdict: { verdict: 'weaken', confidence: 0.75, reasoning: 'Testing is incomplete, not fully passed.' }
		});
		expect(message).toContain('Possibly no longer true');
	});
});
