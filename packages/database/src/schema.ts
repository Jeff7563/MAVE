import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  mode: text('mode').notNull(),
  summary: text('summary'),
  durationSeconds: integer('duration_seconds')
});

export const conversationTurns = sqliteTable('conversation_turns', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  speaker: text('speaker').notNull(), // 'user' | 'assistant'
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  interrupted: integer('interrupted', { mode: 'boolean' }).notNull().default(false)
});

export const vocabulary = sqliteTable('vocabulary', {
  id: text('id').primaryKey(),
  word: text('word').notNull(),
  normalizedWord: text('normalized_word').notNull().unique(),
  meaningTh: text('meaning_th'),
  example: text('example'),
  confidence: real('confidence').default(1.0),
  timesSeen: integer('times_seen').notNull().default(1),
  timesUsed: integer('times_used').notNull().default(0),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const mistakes = sqliteTable('mistakes', {
  id: text('id').primaryKey(),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  category: text('category'),
  explanation: text('explanation'),
  timesRepeated: integer('times_repeated').notNull().default(1),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const learningEvents = sqliteTable('learning_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  sourceConversationId: text('source_conversation_id'),
  payloadJson: text('payload_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const dailyStats = sqliteTable('daily_stats', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  speakingSeconds: integer('speaking_seconds').notNull().default(0),
  englishTurns: integer('english_turns').notNull().default(0),
  newWords: integer('new_words').notNull().default(0),
  corrections: integer('corrections').notNull().default(0),
  sessions: integer('sessions').notNull().default(0)
});

export type Setting = typeof settings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationTurn = typeof conversationTurns.$inferSelect;
export type Vocabulary = typeof vocabulary.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
export type LearningEvent = typeof learningEvents.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
