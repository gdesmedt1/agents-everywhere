#!/usr/bin/env node
/**
 * Set Telegram webhook to this Worker's /api/telegram/webhook
 * Usage: node scripts/set-telegram-webhook.mjs https://agents-everywhere.<subdomain>.workers.dev
 */
import { readFileSync, existsSync } from 'node:fs';

function loadEnvFile(path) {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (!m) continue;
		if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
	}
}

loadEnvFile('.dev.vars');
loadEnvFile('.env');

const base = process.argv[2] || process.env.ORIGIN;
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!base) {
	console.error('Pass public origin: node scripts/set-telegram-webhook.mjs https://…');
	process.exit(1);
}
if (!token) {
	console.error('TELEGRAM_BOT_TOKEN missing');
	process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/api/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		url,
		secret_token: secret || undefined,
		allowed_updates: ['message', 'callback_query']
	})
});
const json = await res.json();
console.log(json);
