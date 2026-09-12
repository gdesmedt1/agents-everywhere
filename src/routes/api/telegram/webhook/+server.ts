import { json } from '@sveltejs/kit';
import { and, eq, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { runEverywhereAgent } from '$lib/server/agent';
import { getDb } from '$lib/server/db';
import { actionDraft, telegramAccount, telegramLink } from '$lib/server/db/schema';
import {
	telegramAnswerCallbackQuery,
	telegramSendMessage,
	type TelegramUpdate
} from '$lib/server/telegram';
import { looksLikeDecision } from '$lib/server/decision-heuristic';
import { getAgentByName } from '$lib/server/get-agent-by-name';
import {
	buildConfirmCallbackData,
	buildSkipCallbackData,
	parseCallbackData
} from '$lib/server/telegram-callback';

export const POST: RequestHandler = async (event) => {
	const token = env.TELEGRAM_BOT_TOKEN || event.platform?.env?.TELEGRAM_BOT_TOKEN;
	const secret = env.TELEGRAM_WEBHOOK_SECRET || event.platform?.env?.TELEGRAM_WEBHOOK_SECRET;
	if (!token) return json({ error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 });

	if (secret) {
		const header = event.request.headers.get('x-telegram-bot-api-secret-token');
		if (header !== secret) return json({ error: 'bad secret' }, { status: 401 });
	}

	const update = (await event.request.json()) as TelegramUpdate;
	const db = getDb(event.platform!.env.DB);
	const apiKey = env.OPENAI_API_KEY || event.platform?.env?.OPENAI_API_KEY;
	const workersEnv = event.platform?.env;

	if (update.callback_query) {
		const cb = update.callback_query;
		const parsed = cb.data ? parseCallbackData(cb.data) : null;
		if (!parsed) {
			await telegramAnswerCallbackQuery(token, cb.id);
			return json({ ok: true });
		}
		if (!workersEnv) {
			await telegramAnswerCallbackQuery(token, cb.id, 'Workers platform unavailable');
			return json({ ok: true });
		}
		const chatId = cb.message?.chat.id;
		try {
			if (parsed.kind === 'confirm') {
				const extractor = await getAgentByName<{
					confirm: (
						assumptionIds: string[],
						telegramChatId?: string
					) => Promise<{ ok: true; tracked: number } | { ok: false; error: string }>;
				}>(workersEnv.Extractor, parsed.decisionId);
				const result = await extractor.confirm([], chatId != null ? String(chatId) : undefined);
				await telegramAnswerCallbackQuery(token, cb.id, result.ok ? 'Tracking' : result.error);
				if (chatId != null) {
					await telegramSendMessage({
						token,
						chatId,
						text: result.ok
							? `Tracking ${result.tracked} assumption(s). I'll watch Ambiguous for contradicting evidence.`
							: result.error
					});
				}
			} else if (parsed.kind === 'skip') {
				await telegramAnswerCallbackQuery(token, cb.id, 'Skipped');
				if (chatId != null) {
					await telegramSendMessage({ token, chatId, text: 'OK — not tracking that decision.' });
				}
			} else {
				const watcher = await getAgentByName<{
					applyAssumptionAction: (
						assumptionId: string,
						action: 'review' | 'update' | 'dismiss'
					) => Promise<void>;
				}>(workersEnv.Watcher, 'global');
				await watcher.applyAssumptionAction(parsed.assumptionId, parsed.action);
				await telegramAnswerCallbackQuery(token, cb.id, `Marked as ${parsed.action}`);
				if (chatId != null) {
					await telegramSendMessage({ token, chatId, text: `Got it — marked as ${parsed.action}.` });
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Callback failed';
			await telegramAnswerCallbackQuery(token, cb.id, message);
		}
		return json({ ok: true });
	}

	if (update.message?.text?.startsWith('/start')) {
		const parts = update.message.text.trim().split(/\s+/);
		const code = parts[1];
		const chatId = update.message.chat.id;
		const tgUserId = String(update.message.from?.id ?? chatId);
		if (!code) {
			await telegramSendMessage({
				token,
				chatId,
				text: 'Send <code>/start YOURCODE</code> after creating a link in the web app.'
			});
			return json({ ok: true });
		}
		const row = await db
			.select()
			.from(telegramLink)
			.where(and(eq(telegramLink.code, code), gt(telegramLink.expiresAt, new Date())))
			.get();
		if (!row) {
			await telegramSendMessage({ token, chatId, text: 'Link code invalid or expired.' });
			return json({ ok: true });
		}
		const existing = await db
			.select()
			.from(telegramAccount)
			.where(eq(telegramAccount.telegramUserId, tgUserId))
			.get();
		if (existing) {
			await db
				.update(telegramAccount)
				.set({ userId: row.userId, chatId: String(chatId), linkedAt: new Date() })
				.where(eq(telegramAccount.telegramUserId, tgUserId));
		} else {
			await db.insert(telegramAccount).values({
				telegramUserId: tgUserId,
				userId: row.userId,
				chatId: String(chatId)
			});
		}
		await db.delete(telegramLink).where(eq(telegramLink.code, code));
		await telegramSendMessage({
			token,
			chatId,
			text: 'Linked. Forward a school note or type what needs doing.'
		});
		return json({ ok: true });
	}

	const text = update.message?.text || update.message?.caption;
	if (!text || !update.message) return json({ ok: true });

	const tgUserId = String(update.message.from?.id ?? update.message.chat.id);
	const linked = await db
		.select()
		.from(telegramAccount)
		.where(eq(telegramAccount.telegramUserId, tgUserId))
		.get();
	if (!linked) {
		await telegramSendMessage({
			token,
			chatId: update.message.chat.id,
			text: 'Not linked yet. Open the web app → create a Telegram link code → /start CODE'
		});
		return json({ ok: true });
	}
	if (!apiKey) {
		await telegramSendMessage({
			token,
			chatId: update.message.chat.id,
			text: 'Server missing OPENAI_API_KEY.'
		});
		return json({ ok: true });
	}

	if (looksLikeDecision(text)) {
		if (!workersEnv) {
			await telegramSendMessage({
				token,
				chatId: update.message.chat.id,
				text: 'Workers platform unavailable — cannot track decisions right now.'
			});
			return json({ ok: true });
		}
		try {
			const decisionId = crypto.randomUUID();
			const extractor = await getAgentByName<{
				extract: (message: string) => Promise<{
					decision: { id: string; statement: string };
					assumptions: { id: string; statement: string }[];
				}>;
			}>(workersEnv.Extractor, decisionId);
			const { decision, assumptions } = await extractor.extract(text);
			const lines = assumptions.map((a, i) => `${i + 1}. ${a.statement}`).join('\n');
			await telegramSendMessage({
				token,
				chatId: update.message.chat.id,
				text: `I found a decision: ${decision.statement}\n\n${lines}\n\nShould I track them?`,
				replyMarkup: {
					inline_keyboard: [
						[
							{ text: 'Track them', callback_data: buildConfirmCallbackData(decision.id) },
							{ text: 'Skip', callback_data: buildSkipCallbackData(decision.id) }
						]
					]
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Extraction failed';
			await telegramSendMessage({
				token,
				chatId: update.message.chat.id,
				text: `Could not extract a decision: ${message}`
			});
		}
		return json({ ok: true });
	}

	try {
		const result = await runEverywhereAgent({
			message: text,
			openaiApiKey: apiKey
		});

		for (const draft of result.drafts) {
			await db.insert(actionDraft).values({
				userId: linked.userId,
				kind: draft.kind,
				title: draft.title,
				payloadJson: JSON.stringify(draft.payload),
				status: 'pending',
				source: 'telegram'
			});
		}

		const draftLines = result.drafts.map((d) => `• [${d.kind}] ${d.title}`).join('\n');
		await telegramSendMessage({
			token,
			chatId: update.message.chat.id,
			text: `${result.text}\n\n${draftLines || '(no drafts)'}\n\nApprove in the web app.`
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Agent failed';
		const friendly = /429|credits|quota|billing/i.test(message)
			? 'OpenAI has no credits left on this API key. Top up billing, then try again.'
			: `Agent error: ${message}`;
		await telegramSendMessage({
			token,
			chatId: update.message.chat.id,
			text: friendly
		});
	}

	return json({ ok: true });
};
