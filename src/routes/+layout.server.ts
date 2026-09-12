import type { LayoutServerLoad } from './$types';

export const prerender = false;

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user
			? { id: locals.user.id, name: locals.user.name, email: locals.user.email, image: locals.user.image }
			: null
	};
};
