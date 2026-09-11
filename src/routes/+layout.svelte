<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Agents Everywhere</title>
	<meta
		name="description"
		content="Forward the chaos. Approve the plan. Agents that meet you on web and Telegram."
	/>
	<script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
</svelte:head>

{@render children()}
