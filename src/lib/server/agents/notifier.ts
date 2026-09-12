import { Agent, callable } from 'agents';
import { sendChatMessage } from '../ambiguous';
import { telegramSendMessage } from '../telegram';
import { buildCallbackData } from '../telegram-callback';

export type NotifyInput = {
	decisionId: string;
	assumptionId: string;
	assumptionStatement: string;
	evidenceText: string;
	evidenceRef: string;
	verdict: { verdict: string; confidence: number; reasoning: string };
	ambiguousChannelId?: string;
	telegramChatId?: string;
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
		if (input.telegramChatId) {
			try {
				await this.retry(() =>
					telegramSendMessage({
						token: this.env.TELEGRAM_BOT_TOKEN,
						chatId: input.telegramChatId!,
						text: message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
						replyMarkup: {
							inline_keyboard: [
								[
									{ text: 'Review', callback_data: buildCallbackData(input.assumptionId, 'review') },
									{ text: 'Update', callback_data: buildCallbackData(input.assumptionId, 'update') },
									{ text: 'Dismiss', callback_data: buildCallbackData(input.assumptionId, 'dismiss') }
								]
							]
						}
					})
				);
			} catch (err) {
				console.error('Failed to deliver alert to Telegram after retries', err);
			}
		}
	}
}
