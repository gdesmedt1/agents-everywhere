# Agents Everywhere

Hackathon scaffold: SvelteKit + Cloudflare Workers + Better Auth (Google) + OpenAI Agents SDK + ChatKit shell + Telegram bot.

Gecko memory: `04-ventures/hackathons/agents-everywhere/`

## Quick start

```bash
cd D:\github\gdesmedt1\agents-everywhere
cp .env.example .env
cp .env.example .dev.vars   # wrangler / Cloudflare Vite plugin
# fill GOOGLE_*, BETTER_AUTH_SECRET, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, ORIGIN

pnpm install
pnpm exec wrangler d1 create agents-everywhere
# paste database_id into wrangler.jsonc
pnpm run db:migrate:local
pnpm run dev
```

Open http://localhost:5173 → Google login → `/app`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Vite + Cloudflare plugin (D1 local) |
| `pnpm build` | Production Worker build |
| `pnpm deploy` | Deploy Worker |
| `pnpm db:migrate:local` | Apply D1 migrations locally |
| `pnpm telegram:set-webhook` | Point BotFather bot at `/api/telegram/webhook` |

## Secrets

See `.env.example`. Never commit `.env` / `.dev.vars`.

Google OAuth redirect: `${ORIGIN}/api/auth/callback/google`

Scopes: Calendar events + Gmail modify (requested at login).

## Architecture

- **Brain:** `src/lib/server/agent.ts` (`@openai/agents`)
- **Web chat:** `/api/chat` + Agents SDK panel (always works)
- **ChatKit:** CDN widget + `/api/chatkit/session` when `OPENAI_CHATKIT_WORKFLOW_ID` is set
- **Telegram:** `/api/telegram/webhook` → same agent; link via `/start CODE`
- **Auth:** Better Auth + Google on D1

ChatKit's *custom protocol server* is Python-first. This scaffold does not reimplement it on Workers. Day-of demo path is Agents SDK.

## Deploy notes

Prefer personal Cloudflare account (`gdesmedt1` / Gecko), not Bevy Product. After deploy:

```bash
pnpm exec wrangler secret put OPENAI_API_KEY
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put TELEGRAM_WEBHOOK_SECRET
pnpm telegram:set-webhook
```

Set `ORIGIN` to the workers.dev (or custom) URL.
