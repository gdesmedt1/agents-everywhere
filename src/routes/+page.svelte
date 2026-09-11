<script lang="ts">
	let { data } = $props();
</script>

<div class="min-h-screen bg-[#0b1020] text-white">
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(244,114,182,0.12),_transparent_40%)]"
	></div>

	<header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
		<a href="/" class="text-sm font-semibold tracking-[0.2em] uppercase">Agents Everywhere</a>
		<nav class="flex items-center gap-3 text-sm">
			{#if data.user}
				<a class="rounded-full bg-white/10 px-4 py-2 hover:bg-white/15" href="/app">Open app</a>
			{:else}
				<a class="rounded-full bg-sky-400 px-4 py-2 font-medium text-slate-950 hover:bg-sky-300" href="/login"
					>Sign in with Google</a
				>
			{/if}
		</nav>
	</header>

	<main class="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10">
		<p class="mb-4 text-xs font-semibold tracking-[0.25em] text-sky-300 uppercase">Hackathon scaffold</p>
		<h1 class="max-w-3xl text-5xl leading-tight font-semibold tracking-tight md:text-6xl">
			Forward the chaos.<br />Approve the plan.
		</h1>
		<p class="mt-6 max-w-2xl text-lg text-white/70">
			A Google-authed agent surface for web + Telegram. Built for speed: SvelteKit on Cloudflare, Better Auth,
			OpenAI Agents SDK, ChatKit-ready UI.
		</p>
		<div class="mt-10 flex flex-wrap gap-3">
			<a
				href={data.user ? '/app' : '/login'}
				class="rounded-full bg-white px-6 py-3 font-medium text-slate-950 hover:bg-sky-100"
			>
				{data.user ? 'Go to chat' : 'Start with Google'}
			</a>
			<a href="/login" class="rounded-full border border-white/20 px-6 py-3 text-white/80 hover:bg-white/5">
				Connect Telegram after login
			</a>
		</div>

		<section class="mt-20 grid gap-6 md:grid-cols-3">
			{#each [
				{
					title: 'Web + ChatKit',
					body: 'Mount OpenAI ChatKit when you have a workflow ID, or use the Agents SDK stream panel that ships today.'
				},
				{
					title: 'Google already signed in',
					body: 'Better Auth with Calendar and Gmail scopes so day-of tools can write real events, not fakes.'
				},
				{
					title: 'Telegram same brain',
					body: 'Webhook hits the same agent runner. Link your Telegram user with a one-time code from /app.'
				}
			] as card}
				<article class="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
					<h2 class="text-lg font-semibold">{card.title}</h2>
					<p class="mt-3 text-sm leading-relaxed text-white/65">{card.body}</p>
				</article>
			{/each}
		</section>
	</main>
</div>
