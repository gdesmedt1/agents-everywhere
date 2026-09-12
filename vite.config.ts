import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import agents from 'agents/vite';

function stubCloudflareBuiltins(): Plugin {
	const stubs: Record<string, string> = {
		'cloudflare:workers': path.resolve('src/lib/server/stubs/cloudflare-workers.ts'),
		'cloudflare:email': path.resolve('src/lib/server/stubs/cloudflare-email.ts')
	};
	return {
		name: 'stub-cloudflare-builtins',
		enforce: 'pre',
		resolveId(id) {
			if (id in stubs) return stubs[id];
			if (id.startsWith('cloudflare:')) return { id, external: true };
			return null;
		}
	};
}

export default defineConfig({
	plugins: [
		stubCloudflareBuiltins(),
		tailwindcss(),
		agents(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
