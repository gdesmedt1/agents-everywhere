/** Workers-safe stub so SvelteKit SSR does not import the `agents` package (`cloudflare:workers`). */
export async function getAgentByName<T>(
	namespace: DurableObjectNamespace,
	name: string
): Promise<T> {
	const id = namespace.idFromName(name);
	const stub = namespace.get(id) as T & {
		__unsafe_ensureInitialized?: (props?: unknown) => Promise<void>;
	};
	await stub.__unsafe_ensureInitialized?.();
	return stub;
}
