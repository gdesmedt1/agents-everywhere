<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let message = $state('');
	let reply = $state('');
	let busy = $state(false);
	let chatkitReady = $state(false);
	let mode = $state<'agents' | 'chatkit'>('agents');

	onMount(() => {
		if (data.chatkitWorkflowId) mode = 'chatkit';
		const el = document.getElementById('ae-chatkit') as HTMLElement & {
			setOptions?: (opts: unknown) => void;
		};
		if (!el || !data.chatkitWorkflowId || typeof el.setOptions !== 'function') return;

		el.setOptions({
			api: {
				async getClientSecret() {
					const res = await fetch('/api/chatkit/session', { method: 'POST' });
					if (!res.ok) throw new Error(`ChatKit session failed: ${res.status}`);
					const json = (await res.json()) as { client_secret: string };
					return json.client_secret;
				}
			},
			theme: 'dark'
		});
		chatkitReady = true;
	});

	async function sendAgentsMessage() {
		if (!message.trim() || busy) return;
		busy = true;
		reply = '';
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});
			const json = (await res.json()) as { text?: string; error?: string };
			if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
			reply = json.text || 'OK';
			message = '';
			location.reload();
		} catch (err) {
			reply = err instanceof Error ? err.message : 'Request failed';
		} finally {
			busy = false;
		}
	}
</script>

<div class="min-h-screen bg-[#0b1020] text-white">
	<header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
		<div>
			<p class="text-xs tracking-[0.2em] text-sky-300 uppercase">Agents Everywhere</p>
			<h1 class="text-xl font-semibold">Hi {data.user.name}</h1>
		</div>
		<form method="post" action="?/signOut" use:enhance>
			<button class="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5" type="submit"
				>Sign out</button
			>
		</form>
	</header>

	<main class="mx-auto grid max-w-6xl gap-6 px-6 pb-16 lg:grid-cols-[1.4fr_1fr]">
		<section class="rounded-3xl border border-white/10 bg-white/5 p-5">
			<div class="mb-4 flex gap-2 text-sm">
				<button
					class={`rounded-full px-3 py-1 ${mode === 'agents' ? 'bg-sky-400 text-slate-950' : 'bg-white/10'}`}
					onclick={() => (mode = 'agents')}>Agents SDK</button
				>
				<button
					class={`rounded-full px-3 py-1 ${mode === 'chatkit' ? 'bg-sky-400 text-slate-950' : 'bg-white/10'}`}
					onclick={() => (mode = 'chatkit')}
					disabled={!data.chatkitWorkflowId}
					title={data.chatkitWorkflowId ? '' : 'Set OPENAI_CHATKIT_WORKFLOW_ID'}
					>ChatKit</button
				>
			</div>

			{#if mode === 'chatkit' && data.chatkitWorkflowId}
				{#if !chatkitReady}
					<p class="text-sm text-white/50">Loading ChatKit…</p>
				{/if}
				<!-- openai-chatkit is provided by the CDN script in +layout -->
				<!-- svelte-ignore element_invalid_self_closing_tag -->
				<openai-chatkit id="ae-chatkit" class="block h-[560px] w-full overflow-hidden rounded-2xl"></openai-chatkit>
			{:else}
				<p class="mb-3 text-sm text-white/60">
					Paste a school note or household forward. The agent proposes calendar/todo drafts for approval.
				</p>
				<textarea
					class="min-h-40 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm outline-none focus:border-sky-400"
					bind:value={message}
					placeholder="Sports Day Friday 09:00, bring hat + R50, RSVP by Wednesday…"
				></textarea>
				<button
					class="mt-3 rounded-full bg-sky-400 px-5 py-2 font-medium text-slate-950 disabled:opacity-50"
					disabled={busy}
					onclick={sendAgentsMessage}
				>
					{busy ? 'Thinking…' : 'Run agent'}
				</button>
				{#if reply}
					<pre class="mt-4 whitespace-pre-wrap rounded-2xl bg-black/40 p-4 text-sm text-sky-100">{reply}</pre>
				{/if}
			{/if}
		</section>

		<aside class="space-y-6">
			<section class="rounded-3xl border border-white/10 bg-white/5 p-5">
				<h2 class="font-semibold">Telegram</h2>
				{#if data.telegramLinked}
					<p class="mt-2 text-sm text-emerald-300">Linked. Message your bot to use the same agent.</p>
				{:else}
					<p class="mt-2 text-sm text-white/60">
						Generate a code, then send <code class="text-sky-200">/start CODE</code> to your bot.
					</p>
					<form method="post" action="?/createTelegramLink" use:enhance class="mt-3">
						<button class="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15" type="submit"
							>Create link code</button
						>
					</form>
					{#if form?.linkCode}
						<p class="mt-3 rounded-xl bg-black/40 px-3 py-2 font-mono text-sky-200">/start {form.linkCode}</p>
					{/if}
				{/if}
			</section>

			<section class="rounded-3xl border border-white/10 bg-white/5 p-5">
				<h2 class="font-semibold">Drafts</h2>
				<ul class="mt-3 space-y-3">
					{#each data.drafts as draft}
						<li class="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
							<p class="font-medium">{draft.title}</p>
							<p class="text-xs text-white/45">{draft.kind} · {draft.status} · {draft.source}</p>
							{#if draft.status === 'pending'}
								<div class="mt-2 flex gap-2">
									<form method="post" action="?/approveDraft" use:enhance>
										<input type="hidden" name="id" value={draft.id} />
										<button class="rounded-full bg-emerald-400/90 px-3 py-1 text-xs text-slate-950"
											>Approve</button
										>
									</form>
									<form method="post" action="?/skipDraft" use:enhance>
										<input type="hidden" name="id" value={draft.id} />
										<button class="rounded-full bg-white/10 px-3 py-1 text-xs">Skip</button>
									</form>
								</div>
							{/if}
						</li>
					{:else}
						<li class="text-sm text-white/45">No drafts yet.</li>
					{/each}
				</ul>
			</section>
		</aside>
	</main>
</div>
