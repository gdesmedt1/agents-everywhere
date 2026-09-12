<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	const videoUrl =
		'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/45567745-d826-44a2-a5ce-7ef670944e60.mp4';
	const cues = [
		[0, 0, 0.24, 0.3],
		[0.27, 0.33, 0.52, 0.58],
		[0.55, 0.61, 0.79, 0.85]
	];

	let video: HTMLVideoElement;
	let progressLine: HTMLDivElement;
	let loading = $state(true);
	let loadingProgress = $state(0);

	onMount(() => {
		let scrollProgress = 0;
		let seekCurrent = 0;
		let animationFrame = 0;
		let ready = false;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const updateLoading = () => {
			if (video.buffered.length && video.duration) {
				loadingProgress = Math.min(100, Math.round((video.buffered.end(0) / video.duration) * 100));
			}
		};
		const releaseLoader = () => {
			ready = true;
			loadingProgress = 100;
			window.setTimeout(() => (loading = false), 180);
		};
		const handleScroll = () => {
			const scrollable = document.documentElement.scrollHeight - window.innerHeight;
			scrollProgress = scrollable > 0 ? Math.max(0, Math.min(1, window.scrollY / scrollable)) : 0;
		};
		const smoothstep = (value: number) => value * value * (3 - 2 * value);
		const panelOpacity = (progress: number, cue: number[]) => {
			const [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] = cue;
			if (fadeInStart === fadeInEnd && progress <= fadeOutStart) return 1;
			if (progress <= fadeInStart || progress >= fadeOutEnd) return 0;
			if (progress < fadeInEnd) return smoothstep((progress - fadeInStart) / (fadeInEnd - fadeInStart));
			if (progress <= fadeOutStart) return 1;
			return 1 - smoothstep((progress - fadeOutStart) / (fadeOutEnd - fadeOutStart));
		};
		const animate = () => {
			if (ready && video.duration && Number.isFinite(video.duration)) {
				const target = scrollProgress * video.duration;
				seekCurrent += (target - seekCurrent) * (reducedMotion ? 1 : 0.115);
				if (!video.seeking && Math.abs(video.currentTime - seekCurrent) > 0.01) {
					video.currentTime = Math.max(0, Math.min(video.duration, seekCurrent));
				}
			}
			progressLine.style.transform = `scaleX(${scrollProgress})`;
			document.querySelectorAll<HTMLElement>('.narrative-panel').forEach((panel, index) => {
				const opacity = panelOpacity(scrollProgress, cues[index]);
				panel.style.opacity = `${opacity}`;
				panel.style.transform = `translate3d(0, ${(1 - opacity) * 22}px, 0)`;
				panel.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none';
			});
			animationFrame = requestAnimationFrame(animate);
		};

		video.addEventListener('loadedmetadata', updateLoading);
		video.addEventListener('progress', updateLoading);
		video.addEventListener('canplay', releaseLoader, { once: true });
		video.addEventListener('error', releaseLoader, { once: true });
		if (video.readyState >= 3) releaseLoader();
		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();
		animationFrame = requestAnimationFrame(animate);
		const timeout = window.setTimeout(releaseLoader, 5000);

		return () => {
			cancelAnimationFrame(animationFrame);
			window.clearTimeout(timeout);
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<svelte:head>
	<title>Assumption Alarm · Decision intelligence for teams</title>
	<meta
		name="description"
		content="Assumption Alarm notices when the assumptions behind a team decision stop being true."
	/>
	<link rel="preconnect" href="https://d2ol7oe51mr4n9.cloudfront.net" />
</svelte:head>

<div class="alarm-page">
	{#if loading}
		<div class="preloader" aria-live="polite">
			<div class="preloader-line"><span style={`transform: scaleX(${loadingProgress / 100})`}></span></div>
			<p>LOADING {loadingProgress}%</p>
		</div>
	{/if}

	<div class="video-stage" aria-hidden="true">
		<video bind:this={video} class="scrub-video" muted playsinline preload="auto">
			<source src={videoUrl} type="video/mp4" />
		</video>
		<div class="video-veil"></div>
		<div class="grain"></div>
	</div>

	<div bind:this={progressLine} class="progress-line"></div>

	<header class="chrome">
		<a class="brand" href="/" aria-label="Assumption Alarm home">
			<img class="brand-logo" src="/brand/logo-horizontal.png" alt="Assumption Alarm" />
		</a>
		<nav class="desktop-nav" aria-label="Primary navigation">
			<a href="#how-it-works">How it works</a>
			<a href="#why-it-matters">Why it matters</a>
		</nav>
		<a class="pill-button header-cta" href={data.user ? '/app' : '/login'}>
			{data.user ? 'Open the app' : 'See the demo'}
		</a>
	</header>

	<main class="scroll-track">
		<section class="narrative" id="how-it-works" aria-label="How Assumption Alarm works">
			{#each [
				{
					eyebrow: 'DECISION INTELLIGENCE · BUILT FOR TEAMS',
					title: 'Decisions depend on assumptions.',
					body: "Assumption Alarm remembers what had to remain true for your team's decisions to still make sense.",
					cta: 'See how it works',
					anchor: undefined
				},
				{
					eyebrow: 'REALITY CHANGES',
					title: 'What if the assumptions change?',
					body: 'Most tools remember what your team decided. Assumption Alarm remembers what had to remain true — and watches for evidence that it no longer is.',
					supporting: 'No reminder. No manual check. The agent notices the change itself.',
					anchor: 'why-it-matters'
				},
				{
					eyebrow: 'DECISION MAY NEED REVIEW',
					title: 'Know when a decision stops being safe.',
					body: 'When new evidence invalidates an assumption, Assumption Alarm connects it back to the original decision and shows your team exactly what changed.',
					cta: 'See the demo',
					anchor: undefined
				}
			] as panel, index}
				<article
					id={panel.anchor}
					class:final-panel={index === 2}
					class="narrative-panel"
				>
					<p class="eyebrow">{panel.eyebrow}</p>
					<h1>{panel.title}</h1>
					<p class="panel-body">{panel.body}</p>
					{#if panel.supporting}<p class="panel-supporting">{panel.supporting}</p>{/if}
					{#if panel.cta}<a class="pill-button panel-cta" href={data.user ? '/app' : '/login'}>{panel.cta}<span aria-hidden="true">↗</span></a>{/if}
				</article>
			{/each}
		</section>

		<section class="proof" aria-labelledby="proof-title">
			<div class="proof-heading">
				<p class="eyebrow">PRODUCT PROOF</p>
				<h2 id="proof-title">From decision to clarity.</h2>
				<p>Assumption Alarm keeps the reasoning behind your decisions connected to the reality around them.</p>
			</div>
			<div class="mockup-grid">
				<article class="mockup-card">
					<div class="mockup-frame"><span>PRODUCT SCREENSHOT 01</span></div>
					<p class="mockup-index">01</p>
					<h3>Capture the decision</h3>
					<p>A decision is detected and the assumptions behind it are extracted.</p>
				</article>
				<article class="mockup-card">
					<div class="mockup-frame"><span>PRODUCT SCREENSHOT 02</span></div>
					<p class="mockup-index">02</p>
					<h3>Track what must stay true</h3>
					<p>Your team confirms the assumptions that make the decision safe.</p>
				</article>
				<article class="mockup-card">
					<div class="mockup-frame"><span>PRODUCT SCREENSHOT 03</span></div>
					<p class="mockup-index">03</p>
					<h3>Get alerted when reality changes</h3>
					<p>New evidence breaks an assumption. The original decision is resurfaced automatically.</p>
				</article>
			</div>
		</section>
	</main>

	<footer class="site-footer">DECISIONS AGE. WE KEEP THE REASONING CURRENT.</footer>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500&display=swap');

	:global(html) {
		background: #f2f0ec;
		scroll-behavior: smooth;
	}

	:global(body) {
		margin: 0;
		background: #f2f0ec;
		color: #0d0c0b;
		font-family: 'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.alarm-page {
		--fg: #0d0c0b;
		--fg-soft: rgba(13, 12, 11, 0.64);
		--fg-faint: rgba(13, 12, 11, 0.42);
		--paper: #f2f0ec;
		--rule: rgba(13, 12, 11, 0.16);
		--pill-bg: #0a0908;
		position: relative;
		min-height: 100vh;
		overflow-x: hidden;
		background: var(--paper);
	}

	.video-stage,
	.video-veil,
	.grain {
		position: fixed;
		inset: 0;
		pointer-events: none;
	}

	.video-stage {
		z-index: 0;
		background: var(--paper);
	}

	.scrub-video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.62) contrast(0.92);
	}

	.video-veil {
		background:
			linear-gradient(to bottom, rgba(242, 240, 236, 0.62) 0%, rgba(242, 240, 236, 0.12) 22%, rgba(242, 240, 236, 0.12) 78%, rgba(242, 240, 236, 0.66) 100%),
			radial-gradient(100% 80% at 50% 48%, rgba(242, 240, 236, 0) 0%, rgba(242, 240, 236, 0.34) 100%),
			rgba(242, 240, 236, 0.2);
	}

	.grain {
		z-index: 1;
		opacity: 0.11;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E");
		mix-blend-mode: multiply;
	}

	.progress-line {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 20;
		width: 100%;
		height: 2px;
		background: rgba(13, 12, 11, 0.72);
		transform: scaleX(0);
		transform-origin: left center;
	}

	.chrome {
		position: fixed;
		top: 0;
		right: 0;
		left: 0;
		z-index: 50;
		height: 76px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 44px;
		padding-top: env(safe-area-inset-top);
		color: var(--fg);
	}

	.brand,
	.desktop-nav a,
	.site-footer {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		width: fit-content;
		color: inherit;
		text-decoration: none;
	}

	.brand-logo {
		display: block;
		width: 180px;
		height: auto;
	}

	.desktop-nav {
		display: flex;
		gap: 30px;
	}

	.desktop-nav a {
		color: var(--fg-soft);
		text-decoration: none;
		transition: color 180ms ease;
	}

	.desktop-nav a:hover,
	.desktop-nav a:focus-visible {
		color: var(--fg);
	}

	.header-cta {
		justify-self: end;
	}

	.pill-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 14px;
		min-height: 38px;
		padding: 0 18px;
		border: 1px solid var(--pill-bg);
		border-radius: 999px;
		background: var(--pill-bg);
		color: white;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-decoration: none;
		transition: background 180ms ease, color 180ms ease, transform 180ms ease;
	}

	.pill-button:hover,
	.pill-button:focus-visible {
		background: transparent;
		color: var(--pill-bg);
		transform: translateY(-1px);
	}

	.scroll-track {
		position: relative;
		z-index: 2;
		height: 560vh;
	}

	.narrative {
		position: sticky;
		top: 0;
		height: 100vh;
		min-height: 620px;
		padding-top: 110px;
	}

	.narrative-panel {
		position: absolute;
		top: calc(50% + 38px);
		left: clamp(32px, 7vw, 110px);
		width: min(820px, calc(100% - clamp(64px, 14vw, 220px)));
		transform: translate3d(0, 22px, 0);
		transform-origin: center;
		transition: opacity 80ms linear;
		translate: 0 -50%;
	}

	.narrative-panel h1 {
		max-width: 760px;
		margin: 18px 0 0;
		font-size: clamp(54px, 8vw, 118px);
		font-weight: 400;
		line-height: 0.91;
		letter-spacing: -0.065em;
		text-wrap: balance;
	}

	.eyebrow {
		margin: 0;
		color: var(--fg-soft);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.16em;
		line-height: 1.4;
	}

	.panel-body {
		max-width: 425px;
		margin: 32px 0 0 4px;
		color: var(--fg-soft);
		font-size: 17px;
		line-height: 1.35;
	}

	.panel-supporting {
		max-width: 360px;
		margin: 14px 0 0 4px;
		color: var(--fg-faint);
		font-size: 13px;
		line-height: 1.4;
	}

	.panel-cta {
		margin-top: 28px;
	}

	.final-panel .panel-body {
		max-width: 390px;
	}

	.proof {
		position: relative;
		z-index: 3;
		max-width: 1180px;
		margin: 0 auto;
		padding: 12vh 44px 18vh;
	}

	.proof-heading {
		max-width: 620px;
		margin-bottom: 56px;
	}

	.proof-heading h2 {
		max-width: 620px;
		margin: 18px 0 0;
		font-size: clamp(48px, 7vw, 92px);
		font-weight: 400;
		line-height: 0.94;
		letter-spacing: -0.06em;
		text-wrap: balance;
	}

	.proof-heading > p:last-child {
		max-width: 430px;
		margin: 28px 0 0;
		color: var(--fg-soft);
		font-size: 17px;
		line-height: 1.35;
	}

	.mockup-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 22px;
	}

	.mockup-card {
		min-width: 0;
	}

	.mockup-frame {
		display: grid;
		aspect-ratio: 16 / 10;
		place-items: center;
		border: 1px solid rgba(13, 12, 11, 0.2);
		border-radius: 18px;
		background: rgba(242, 240, 236, 0.86);
		color: var(--fg-faint);
		font-size: 10px;
		letter-spacing: 0.14em;
	}

	.mockup-index {
		margin: 22px 0 8px;
		color: var(--fg-faint);
		font-size: 10px;
		letter-spacing: 0.14em;
	}

	.mockup-card h3 {
		margin: 0;
		font-size: 21px;
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.025em;
	}

	.mockup-card > p:last-child {
		max-width: 290px;
		margin: 12px 0 0;
		color: var(--fg-soft);
		font-size: 14px;
		line-height: 1.4;
	}

	.site-footer {
		position: absolute;
		right: 42px;
		bottom: 24px;
		z-index: 4;
		color: var(--fg-faint);
	}

	.preloader {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--paper);
		color: var(--fg);
	}

	.preloader-line {
		width: min(220px, 55vw);
		height: 1px;
		background: var(--rule);
	}

	.preloader-line span {
		display: block;
		width: 100%;
		height: 1px;
		background: var(--fg);
		transform-origin: left center;
		transition: transform 150ms ease;
	}

	.preloader p {
		margin: 12px 0 0;
		font-size: 10px;
		letter-spacing: 0.12em;
	}

	:focus-visible {
		outline: 2px solid var(--fg);
		outline-offset: 4px;
	}

	@media (max-width: 700px) {
		.video-veil {
			background:
				linear-gradient(to bottom, rgba(242, 240, 236, 0.78) 0%, rgba(242, 240, 236, 0.2) 25%, rgba(242, 240, 236, 0.24) 75%, rgba(242, 240, 236, 0.8) 100%),
				radial-gradient(100% 80% at 50% 48%, rgba(242, 240, 236, 0) 0%, rgba(242, 240, 236, 0.38) 100%),
				rgba(242, 240, 236, 0.24);
		}

		.chrome {
			height: 76px;
			padding: 0 18px;
			padding-top: env(safe-area-inset-top);
		}

		.desktop-nav {
			display: none;
		}

		.brand,
		.desktop-nav a,
		.site-footer {
			font-size: 10px;
		}

		.brand-logo {
			width: min(180px, 48vw);
		}

		.header-cta {
			min-height: 38px;
			padding: 0 15px;
		}

		.narrative-panel {
			left: 18px;
			width: calc(100% - 36px);
			top: calc(50% + 28px);
		}

		.narrative-panel h1 {
			max-width: 500px;
			font-size: clamp(48px, 14vw, 76px);
			line-height: 0.94;
		}

		.panel-body {
			max-width: 330px;
			margin-top: 24px;
			font-size: 16px;
		}

		.panel-supporting {
			font-size: 13px;
		}

		.proof {
			padding: 10vh 18px 16vh;
		}

		.proof-heading {
			margin-bottom: 38px;
		}

		.mockup-grid {
			grid-template-columns: 1fr;
			gap: 42px;
		}

		.site-footer {
			right: auto;
			bottom: max(18px, env(safe-area-inset-bottom));
			left: 20px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}

		.pill-button,
		.preloader-line span {
			transition: none;
		}
	}
</style>
