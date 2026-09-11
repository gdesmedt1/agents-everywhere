<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-[#0b1020] px-6 text-white">
	<div class="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
		<p class="text-xs font-semibold tracking-[0.2em] text-sky-300 uppercase">Agents Everywhere</p>
		<h1 class="mt-3 text-3xl font-semibold">Sign in with Google</h1>
		<p class="mt-3 text-sm text-white/65">
			We request Calendar and Gmail scopes so the agent can draft and (after you approve) write real events.
		</p>
		{#if form?.message}
			<p class="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{form.message}</p>
		{/if}
		<form method="post" action="?/signInGoogle" class="mt-8" use:enhance>
			<button
				type="submit"
				class="w-full rounded-full bg-sky-400 px-4 py-3 font-medium text-slate-950 hover:bg-sky-300"
			>
				Continue with Google
			</button>
		</form>
		<p class="mt-6 text-center text-xs text-white/40">
			<a class="underline hover:text-white/70" href="/">Back to landing</a>
		</p>
	</div>
</div>
