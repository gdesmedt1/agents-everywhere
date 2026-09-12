const DECISION_PATTERNS = [
	/\bassuming\b/i,
	/\bif\b.+\b(passes|signs off|approves|confirms|is (ready|complete|available))\b/i,
	/\bwe will\b.+\bif\b/i,
	/\blet'?s\b.+\bassuming\b/i
];

export function looksLikeDecision(message: string): boolean {
	return DECISION_PATTERNS.some((pattern) => pattern.test(message));
}
