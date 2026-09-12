import { describe, it, expect } from 'vitest';
import { looksLikeDecision } from './decision-heuristic';

describe('looksLikeDecision', () => {
	it('flags a message with a conditional decision pattern', () => {
		expect(looksLikeDecision("Let's launch Friday, assuming legal signs off by Wednesday.")).toBe(true);
	});

	it('flags "we will X if Y" phrasing', () => {
		expect(looksLikeDecision('We will ship the feature if QA passes tonight.')).toBe(true);
	});

	it('does not flag an unrelated message', () => {
		expect(looksLikeDecision('The office coffee machine is broken again.')).toBe(false);
	});
});
