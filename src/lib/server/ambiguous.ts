const AMBIGUOUS_BASE_URL = 'https://app.ambiguous.ai';

export type AmbiguousEnv = { AMBIGUOUS_API_KEY: string };

export type AmbiguousNotification = {
	notification_id: string;
	type: string;
	content: Record<string, unknown>;
};

async function ambiguousFetch<T>(env: AmbiguousEnv, path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(`${AMBIGUOUS_BASE_URL}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${env.AMBIGUOUS_API_KEY}`,
			'API-Version': '1',
			'Content-Type': 'application/json',
			...init.headers
		}
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Ambiguous request failed: ${res.status} ${body}`, { cause: res.status });
	}
	return res.json() as Promise<T>;
}

export async function pollNotifications(env: AmbiguousEnv): Promise<AmbiguousNotification[]> {
	const result = await ambiguousFetch<{ notifications?: AmbiguousNotification[] }>(
		env,
		'/api/notifications?unread_only=true'
	);
	return result.notifications ?? [];
}

export async function markNotificationRead(
	env: AmbiguousEnv,
	notificationId: string
): Promise<{ ok: boolean; was_unread: boolean }> {
	return ambiguousFetch(env, `/api/notifications/${notificationId}/mark-read`, { method: 'POST' });
}

export async function sendChatMessage(env: AmbiguousEnv, channelId: string, content: string): Promise<{ id: string }> {
	return ambiguousFetch(env, `/api/channels/${channelId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ content })
	});
}

export async function findOrCreateWikiSpace(env: AmbiguousEnv, slug: string, name: string): Promise<{ id: string }> {
	try {
		const existing = await ambiguousFetch<{ id: string }>(env, `/api/wiki/spaces/${slug}`);
		return { id: existing.id };
	} catch (err) {
		if (!(err instanceof Error) || !err.message.includes('failed: 404')) throw err;
		const created = await ambiguousFetch<{ id: string }>(env, '/api/wiki/spaces', {
			method: 'POST',
			body: JSON.stringify({ name, slug })
		});
		return { id: created.id };
	}
}

export async function findOrCreateDecisionLogDatabase(
	env: AmbiguousEnv,
	spaceId: string
): Promise<{ pageId: string; databaseId: string }> {
	const page = await ambiguousFetch<{ id: string }>(env, `/api/wiki/spaces/${spaceId}/pages`, {
		method: 'POST',
		body: JSON.stringify({ title: 'Assumption Alarm — Decision Log' })
	});
	const database = await ambiguousFetch<{ id: string }>(env, '/api/wiki/databases', {
		method: 'POST',
		body: JSON.stringify({
			page_id: page.id,
			name: 'decision_log',
			title: 'Decision Log',
			schema: {
				Decision: { type: 'text' },
				'Reason(s)': { type: 'text' },
				Assumption: { type: 'text' },
				Status: { type: 'select', options: ['pending', 'active', 'invalidated', 'dismissed'] },
				Confidence: { type: 'number' },
				'Last evidence': { type: 'text' }
			}
		})
	});
	return { pageId: page.id, databaseId: database.id };
}

export async function createDatabaseRow(
	env: AmbiguousEnv,
	databaseId: string,
	properties: Record<string, unknown>
): Promise<{ id: string }> {
	return ambiguousFetch(env, `/api/wiki/databases/${databaseId}/rows`, {
		method: 'POST',
		body: JSON.stringify({ properties })
	});
}

export async function updateDatabaseRow(
	env: AmbiguousEnv,
	databaseId: string,
	rowId: string,
	properties: Record<string, unknown>
): Promise<void> {
	await ambiguousFetch(env, `/api/wiki/databases/${databaseId}/rows/${rowId}`, {
		method: 'PATCH',
		body: JSON.stringify({ properties })
	});
}
