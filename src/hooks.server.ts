import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const db = event.platform?.env?.DB;
	if (!db) {
		// Marketing routes can render; /app and /api require Cloudflare D1 (vite+wrangler plugin or preview).
		return resolve(event);
	}

	event.locals.auth = createAuth(db);
	const session = await event.locals.auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth: event.locals.auth, building });
};

export const handle: Handle = handleBetterAuth;
