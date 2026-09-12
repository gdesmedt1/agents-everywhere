import { describe, it, expect } from 'vitest';
import { parseCallbackData, buildCallbackData, buildConfirmCallbackData } from './telegram-callback';

describe('parseCallbackData', () => {
	it('parses a well-formed action payload', () => {
		expect(parseCallbackData('aa:asm_123:dismiss')).toEqual({
			kind: 'action',
			assumptionId: 'asm_123',
			action: 'dismiss'
		});
	});

	it('parses confirm and skip payloads', () => {
		expect(parseCallbackData(buildConfirmCallbackData('dec_1'))).toEqual({
			kind: 'confirm',
			decisionId: 'dec_1'
		});
		expect(parseCallbackData('aa:skip:dec_1')).toEqual({ kind: 'skip', decisionId: 'dec_1' });
	});

	it('returns null for an unrecognized action', () => {
		expect(parseCallbackData('aa:asm_123:delete')).toBeNull();
	});

	it('returns null for a malformed payload', () => {
		expect(parseCallbackData('not-ours')).toBeNull();
	});

	it('round-trips buildCallbackData', () => {
		expect(parseCallbackData(buildCallbackData('asm_1', 'review'))).toEqual({
			kind: 'action',
			assumptionId: 'asm_1',
			action: 'review'
		});
	});
});
