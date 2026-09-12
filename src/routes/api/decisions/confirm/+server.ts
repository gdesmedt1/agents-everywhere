import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAgentByName } from '$lib/server/get-agent-by-name';

type ExtractorStub = {
	confirm: (
		assumptionIds: string[],
		telegramChatId?: string
	) => Promise<{ ok: true; tracked: number } | { ok: false; error: string }>;
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const workersEnv = event.platform?.env;
	if (!workersEnv) return json({ error: 'Workers platform unavailable' }, { status: 500 });

	const body = (await event.request.json()) as { decisionId?: string; assumptionIds?: string[] };
	if (!body.decisionId?.trim()) return json({ error: 'decisionId required' }, { status: 400 });

	try {
		const extractor = await getAgentByName<ExtractorStub>(workersEnv.Extractor, body.decisionId);
		const result = await extractor.confirm(body.assumptionIds ?? []);
		if (!result.ok) return json({ error: result.error }, { status: 404 });
		return json({
			text: `Tracking ${result.tracked} assumption(s). I'll watch Ambiguous for contradicting evidence.`,
			tracked: result.tracked
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Confirm failed';
		return json({ error: message }, { status: 500 });
	}
};
