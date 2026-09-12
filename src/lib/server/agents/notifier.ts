import { Agent, callable } from 'agents';
import { sendChatMessage } from '../ambiguous';

export type NotifyInput = {
	decisionId: string;
	assumptionId: string;
	assumptionStatement: string;
	evidenceText: string;
	evidenceRef: string;
	verdict: { verdict: string; confidence: number; reasoning: string };
	ambiguousChannelId?: string;
};

export function formatAlertMessage(input: NotifyInput): string {
	const status = input.verdict.verdict === 'contradict' ? 'No longer true' : 'Possibly no longer true';
	return [
		'⚠️ Decision may need review',
		'',
		`Assumption: ${input.assumptionStatement}`,
		`New evidence: ${input.evidenceText}`,
		`Why: ${input.verdict.reasoning}`,
		`Status: ${status}`,
		'',
		'Actions: Review decision | Update assumption | Dismiss'
	].join('\n');
}

export class NotifierAgent extends Agent<Env, Record<string, never>> {
	@callable()
	async notify(input: NotifyInput) {
		const message = formatAlertMessage(input);
		if (input.ambiguousChannelId) {
			try {
				await this.retry(() => sendChatMessage(this.env, input.ambiguousChannelId!, `🔔 Notifier:\n${message}`));
			} catch (err) {
				console.error('Failed to deliver alert to Ambiguous chat after retries', err);
			}
		}
	}
}
