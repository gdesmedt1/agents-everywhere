import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/** Creates an OpenAI ChatKit client secret when a hosted workflow ID is configured. */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const apiKey = env.OPENAI_API_KEY || event.platform?.env?.OPENAI_API_KEY;
	const workflowId = env.OPENAI_CHATKIT_WORKFLOW_ID || event.platform?.env?.OPENAI_CHATKIT_WORKFLOW_ID;
	if (!apiKey) return json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });
	if (!workflowId) {
		return json(
			{ error: 'OPENAI_CHATKIT_WORKFLOW_ID not set. Use Agents SDK chat panel instead.' },
			{ status: 501 }
		);
	}

	const res = await fetch('https://api.openai.com/v1/chatkit/sessions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'OpenAI-Beta': 'chatkit_beta=v1'
		},
		body: JSON.stringify({
			workflow: { id: workflowId },
			user: event.locals.user.id
		})
	});

	if (!res.ok) {
		const text = await res.text();
		return json({ error: `ChatKit session failed: ${res.status} ${text}` }, { status: 502 });
	}

	const session = (await res.json()) as { client_secret?: string };
	if (!session.client_secret) return json({ error: 'No client_secret in ChatKit response' }, { status: 502 });
	return json({ client_secret: session.client_secret });
};
