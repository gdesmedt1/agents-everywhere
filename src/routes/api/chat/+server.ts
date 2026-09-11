import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { runEverywhereAgent } from '$lib/server/agent';
import { getDb } from '$lib/server/db';
import { actionDraft } from '$lib/server/db/schema';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const apiKey = env.OPENAI_API_KEY || event.platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });

	const body = (await event.request.json()) as { message?: string };
	if (!body.message?.trim()) return json({ error: 'message required' }, { status: 400 });

	const result = await runEverywhereAgent({
		message: body.message,
		openaiApiKey: apiKey,
		userLabel: event.locals.user.name || event.locals.user.email
	});

	const db = getDb(event.platform!.env.DB);
	for (const draft of result.drafts) {
		await db.insert(actionDraft).values({
			userId: event.locals.user.id,
			kind: draft.kind,
			title: draft.title,
			payloadJson: JSON.stringify(draft.payload),
			status: 'pending',
			source: 'web'
		});
	}

	return json(result);
};
