type TelegramSendOpts = {
	token: string;
	chatId: string | number;
	text: string;
	replyMarkup?: unknown;
};

export async function telegramSendMessage(opts: TelegramSendOpts) {
	const res = await fetch(`https://api.telegram.org/bot${opts.token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: opts.chatId,
			text: opts.text,
			parse_mode: 'HTML',
			reply_markup: opts.replyMarkup
		})
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
	}
	return res.json();
}

export async function telegramSetWebhook(token: string, url: string, secret?: string) {
	const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			url,
			secret_token: secret || undefined,
			allowed_updates: ['message', 'callback_query']
		})
	});
	return res.json();
}

export type TelegramUpdate = {
	update_id: number;
	message?: {
		message_id: number;
		text?: string;
		caption?: string;
		chat: { id: number };
		from?: { id: number; username?: string; first_name?: string };
	};
	callback_query?: {
		id: string;
		data?: string;
		from: { id: number };
		message?: { chat: { id: number }; message_id: number };
	};
};
