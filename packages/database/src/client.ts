import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as schema from './schema.js';
import { createLogger } from '@mave/shared';
import fs from 'node:fs';
import path from 'node:path';

const logger = createLogger({ name: 'mave:database' });

export interface MaveDatabase {
  db: SQLJsDatabase<typeof schema>;
  sqlite: SqlJsDatabase;
  close: () => void;
  save: () => void;
}

export async function createMaveDatabase(dbPath: string = ':memory:'): Promise<MaveDatabase> {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  logger.info(
    { dbPath: dbPath === ':memory:' ? ':memory:' : path.basename(dbPath) },
    'initializing database'
  );

  const SQL = await initSqlJs();
  let sqlite: SqlJsDatabase;

  if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlite = new SQL.Database(fileBuffer);
  } else {
    sqlite = new SQL.Database();
  }

  // Ensure Foreign Keys are enabled
  sqlite.run('PRAGMA foreign_keys = ON;');

  // Initialize schema DDL
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      mode TEXT NOT NULL,
      summary TEXT,
      duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      active_provider_id TEXT,
      title TEXT,
      metadata TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS conversation_turns (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      interrupted INTEGER NOT NULL DEFAULT 0,
      request_id TEXT,
      provider_id TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      updated_at INTEGER,
      error TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      normalized_word TEXT NOT NULL UNIQUE,
      meaning_th TEXT,
      example TEXT,
      confidence REAL DEFAULT 1.0,
      times_seen INTEGER NOT NULL DEFAULT 1,
      times_used INTEGER NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mistakes (
      id TEXT PRIMARY KEY,
      original_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      category TEXT,
      explanation TEXT,
      times_repeated INTEGER NOT NULL DEFAULT 1,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      source_conversation_id TEXT,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      speaking_seconds INTEGER NOT NULL DEFAULT 0,
      english_turns INTEGER NOT NULL DEFAULT 0,
      new_words INTEGER NOT NULL DEFAULT 0,
      corrections INTEGER NOT NULL DEFAULT 0,
      sessions INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Ensure newly added columns exist in existing SQLite databases
  function ensureColumn(table: string, column: string, columnDef: string) {
    const info = sqlite.exec(`PRAGMA table_info(${table});`);
    const columns = info[0]?.values.map((col) => col[1] as string) ?? [];
    if (!columns.includes(column)) {
      sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef};`);
    }
  }

  ensureColumn('conversations', 'status', "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn('conversations', 'active_provider_id', 'TEXT');
  ensureColumn('conversations', 'title', 'TEXT');
  ensureColumn('conversations', 'metadata', 'TEXT');
  ensureColumn('conversations', 'updated_at', 'INTEGER');

  ensureColumn('conversation_turns', 'request_id', 'TEXT');
  ensureColumn('conversation_turns', 'provider_id', 'TEXT');
  ensureColumn('conversation_turns', 'status', "TEXT NOT NULL DEFAULT 'completed'");
  ensureColumn('conversation_turns', 'updated_at', 'INTEGER');
  ensureColumn('conversation_turns', 'error', 'TEXT');
  ensureColumn('conversation_turns', 'metadata', 'TEXT');


  function save() {
    if (dbPath !== ':memory:') {
      const data = sqlite.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
      logger.info('database state persisted to disk');
    }
  }

  save();

  logger.info('database tables initialized successfully');

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    save,
    close: () => {
      save();
      sqlite.close();
      logger.info('database connection closed');
    }
  };
}
