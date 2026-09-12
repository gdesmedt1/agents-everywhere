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
		throw new Error(`Ambiguous request failed: ${res.status} ${body}`);
	}
	return res.json() as Promise<T>;
}

export async function pollNotifications(env: AmbiguousEnv): Promise<AmbiguousNotification[]> {
	const result = await ambiguousFetch<{ notifications: AmbiguousNotification[] }>(
		env,
		'/api/notifications?unread_only=true'
	);
	return result.notifications;
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
