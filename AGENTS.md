# Agents Everywhere — code repo

Personal hackathon app for **Agents Everywhere**. Product/memory docs live in Gecko `04-ventures/hackathons/agents-everywhere/`.

## Stack

SvelteKit 2 + Svelte 5, Tailwind 4, Cloudflare Workers + D1, Better Auth (Google), `@openai/agents`, ChatKit CDN shell, Telegram Bot API.

## Boundaries

- Not Maxii Moola, not SUGI Health.
- Deploy only to Cloudflare account `a412200d80556eb87aeacf16cacb79f5` (Worker `my` / `my.assumption-alarm.workers.dev`). Never Bevy CF. Never the old gdesmedt1 Worker.
- Secrets via `.env` / `.dev.vars` / `wrangler secret`, never git.
