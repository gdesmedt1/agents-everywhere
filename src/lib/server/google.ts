import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { account } from '$lib/server/db/auth.schema';

/** Best-effort Google access token from Better Auth account row. */
export async function getGoogleAccessToken(d1: D1Database, userId: string) {
	const db = getDb(d1);
	const rows = await db.select().from(account).where(eq(account.userId, userId)).all();
	const google = rows.find((r) => r.providerId === 'google');
	if (!google?.accessToken) return null;
	return {
		accessToken: google.accessToken,
		refreshToken: google.refreshToken,
		expiresAt: google.accessTokenExpiresAt
	};
}

export async function createGoogleCalendarEvent(opts: {
	accessToken: string;
	title: string;
	startsAt: string;
	endsAt?: string;
	location?: string;
	notes?: string;
}) {
	const start = new Date(opts.startsAt);
	const end = opts.endsAt ? new Date(opts.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
	const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${opts.accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			summary: opts.title,
			location: opts.location,
			description: opts.notes,
			start: { dateTime: start.toISOString() },
			end: { dateTime: end.toISOString() }
		})
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Google Calendar create failed: ${res.status} ${body}`);
	}
	return res.json();
}
