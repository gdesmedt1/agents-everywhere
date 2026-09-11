import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** One-time codes linking a logged-in web user to Telegram. */
export const telegramLink = sqliteTable('telegram_link', {
	code: text('code').primaryKey(),
	userId: text('user_id').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

/** Maps Telegram chat/user id → Better Auth user id. */
export const telegramAccount = sqliteTable('telegram_account', {
	telegramUserId: text('telegram_user_id').primaryKey(),
	userId: text('user_id').notNull(),
	chatId: text('chat_id').notNull(),
	linkedAt: integer('linked_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

/** Lightweight action drafts from the agent (calendar / todo). */
export const actionDraft = sqliteTable('action_draft', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	kind: text('kind').notNull(), // calendar | todo | note
	title: text('title').notNull(),
	payloadJson: text('payload_json').notNull(),
	status: text('status').notNull().default('pending'), // pending | approved | skipped
	source: text('source').notNull().default('web'), // web | telegram
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

export * from './auth.schema';
