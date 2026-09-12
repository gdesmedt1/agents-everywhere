const ASSUMPTION_ACTIONS = ['review', 'update', 'dismiss'] as const;
export type AssumptionAction = (typeof ASSUMPTION_ACTIONS)[number];

export type ParsedCallback =
	| { kind: 'confirm'; decisionId: string }
	| { kind: 'skip'; decisionId: string }
	| { kind: 'action'; assumptionId: string; action: AssumptionAction };

export function parseCallbackData(data: string): ParsedCallback | null {
	const parts = data.split(':');
	if (parts.length !== 3 || parts[0] !== 'aa') return null;
	const [, second, third] = parts;
	if (!second || !third) return null;
	if (second === 'confirm') return { kind: 'confirm', decisionId: third };
	if (second === 'skip') return { kind: 'skip', decisionId: third };
	if (ASSUMPTION_ACTIONS.includes(third as AssumptionAction)) {
		return { kind: 'action', assumptionId: second, action: third as AssumptionAction };
	}
	return null;
}

export function buildCallbackData(assumptionId: string, action: AssumptionAction): string {
	return `aa:${assumptionId}:${action}`;
}

export function buildConfirmCallbackData(decisionId: string): string {
	return `aa:confirm:${decisionId}`;
}

export function buildSkipCallbackData(decisionId: string): string {
	return `aa:skip:${decisionId}`;
}
