import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) throw redirect(302, '/app');
	return {};
};

export const actions: Actions = {
	signInGoogle: async (event) => {
		const { auth } = event.locals;
		if (!auth) return fail(503, { message: 'Auth is not ready (D1 / secrets).' });

		const result = await auth.api.signInSocial({
			body: {
				provider: 'google',
				callbackURL: '/app'
			}
		});

		if (result.url) throw redirect(302, result.url);
		return fail(400, { message: 'Google sign-in failed to start.' });
	}
};
