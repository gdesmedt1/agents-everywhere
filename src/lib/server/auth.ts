import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';

/** Google scopes for real calendar + Gmail later in the hackathon. */
export const GOOGLE_SCOPES = [
	'openid',
	'email',
	'profile',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/gmail.modify'
] as const;

const authConfig = {
	appName: 'Agents Everywhere',
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: { enabled: false },
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
			accessType: 'offline',
			prompt: 'consent',
			scope: [...GOOGLE_SCOPES]
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // last plugin
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});

/**
 * CLI schema generation only. Runtime: use `event.locals.auth`.
 */
export const auth = createAuth(null!);
