import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { runEverywhereAgent } from '$lib/server/agent';
import { getDb } from '$lib/server/db';
import { actionDraft } from '$lib/server/db/schema';
import { looksLikeDecision } from '$lib/server/decision-heuristic';
import { getAgentByName } from '$lib/server/get-agent-by-name';

type ExtractorStub = {
	extract: (message: string) => Promise<{
		decision: { id: string; statement: string };
		assumptions: { id: string; statement: string }[];
	}>;
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const apiKey = env.OPENAI_API_KEY || event.platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });

	const body = (await event.request.json()) as { message?: string };
	if (!body.message?.trim()) return json({ error: 'message required' }, { status: 400 });

	if (looksLikeDecision(body.message)) {
		const workersEnv = event.platform?.env;
		if (!workersEnv) return json({ error: 'Workers platform unavailable' }, { status: 500 });
		try {
			const decisionId = crypto.randomUUID();
			const extractor = await getAgentByName<ExtractorStub>(workersEnv.Extractor, decisionId);
			const { decision, assumptions } = await extractor.extract(body.message);
			return json({
				text: `I found a decision with ${assumptions.length} condition(s) that appear important. Should I track them?`,
				decision,
				assumptions
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Extraction failed';
			return json({ error: message }, { status: 500 });
		}
	}

	try {
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
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Agent failed';
		const status = /429|credits|quota|billing/i.test(message) ? 402 : 500;
		return json({ error: message }, { status });
	}
};
