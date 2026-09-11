import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { actionDraft, telegramAccount, telegramLink } from '$lib/server/db/schema';
import { createGoogleCalendarEvent, getGoogleAccessToken } from '$lib/server/google';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(302, '/login');
	const db = getDb(event.platform!.env.DB);
	const drafts = await db
		.select()
		.from(actionDraft)
		.where(eq(actionDraft.userId, event.locals.user.id))
		.all();
	const tg = await db
		.select()
		.from(telegramAccount)
		.where(eq(telegramAccount.userId, event.locals.user.id))
		.get();

	return {
		user: event.locals.user,
		drafts: drafts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 20),
		telegramLinked: Boolean(tg),
		chatkitWorkflowId: env.OPENAI_CHATKIT_WORKFLOW_ID || '',
		chatkitDomainKey: env.OPENAI_CHATKIT_DOMAIN_KEY || 'domain_pk_localhost'
	};
};

export const actions: Actions = {
	signOut: async (event) => {
		await event.locals.auth.api.signOut({ headers: event.request.headers });
		throw redirect(302, '/');
	},

	createTelegramLink: async (event) => {
		if (!event.locals.user) throw redirect(302, '/login');
		const code = crypto.randomUUID().slice(0, 8);
		const db = getDb(event.platform!.env.DB);
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
		await db.insert(telegramLink).values({
			code,
			userId: event.locals.user.id,
			expiresAt
		});
		return { linkCode: code };
	},

	approveDraft: async (event) => {
		if (!event.locals.user) throw redirect(302, '/login');
		const form = await event.request.formData();
		const id = form.get('id')?.toString();
		if (!id) return { ok: false, message: 'Missing draft id' };

		const db = getDb(event.platform!.env.DB);
		const draft = await db.select().from(actionDraft).where(eq(actionDraft.id, id)).get();
		if (!draft || draft.userId !== event.locals.user.id) {
			return { ok: false, message: 'Draft not found' };
		}

		const payload = JSON.parse(draft.payloadJson) as Record<string, string>;
		if (draft.kind === 'calendar') {
			const google = await getGoogleAccessToken(event.platform!.env.DB, event.locals.user.id);
			if (google?.accessToken) {
				try {
					await createGoogleCalendarEvent({
						accessToken: google.accessToken,
						title: payload.title || draft.title,
						startsAt: payload.startsAt || new Date().toISOString(),
						endsAt: payload.endsAt,
						location: payload.location,
						notes: payload.notes
					});
				} catch (err) {
					return {
						ok: false,
						message: err instanceof Error ? err.message : 'Calendar write failed'
					};
				}
			}
		}

		await db.update(actionDraft).set({ status: 'approved' }).where(eq(actionDraft.id, id));
		return { ok: true };
	},

	skipDraft: async (event) => {
		if (!event.locals.user) throw redirect(302, '/login');
		const form = await event.request.formData();
		const id = form.get('id')?.toString();
		if (!id) return { ok: false };
		const db = getDb(event.platform!.env.DB);
		await db.update(actionDraft).set({ status: 'skipped' }).where(eq(actionDraft.id, id));
		return { ok: true };
	}
};
