/**
 * SONAR Operational Database — SQLite Schema
 * WAL mode enabled for concurrent read/write safety
 * Designed for future Postgres/Supabase migration
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent access safety
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // --- Create tables (only what remains in SQLite) ---
  db.exec(`
    -- Tasks: Current task state table (fast reads)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      owner TEXT NOT NULL,
      actor_type TEXT NOT NULL DEFAULT 'A' CHECK(actor_type IN ('A', 'SA')),
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'in_progress', 'completed', 'warning', 'failed', 'paused')),
      department TEXT DEFAULT 'Operations',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      latest_update TEXT,
      latest_update_at TEXT DEFAULT (datetime('now')),
      session_id TEXT,
      parent_task_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      campaign_id TEXT,
      campaign_name TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Task Updates: Historical task update stream
    CREATE TABLE IF NOT EXISTS task_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'ok',
      actor TEXT NOT NULL DEFAULT 'system',
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Leads: Relic pipeline leads
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      url TEXT,
      stage TEXT NOT NULL DEFAULT 'discovery' CHECK(stage IN ('discovery', 'qualification', 'outreach', 'proposal', 'closed')),
      score INTEGER DEFAULT 0,
      notes TEXT,
      assigned_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cron Jobs: OpenClaw scheduled tasks mirrored for Chronos
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule_kind TEXT NOT NULL DEFAULT 'at' CHECK(schedule_kind IN ('at', 'every', 'cron')),
      schedule_value TEXT,
      payload_kind TEXT DEFAULT 'systemEvent',
      payload_text TEXT,
      session_target TEXT DEFAULT 'main',
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('active', 'queued', 'completed', 'stopped')),
      enabled INTEGER DEFAULT 1,
      assigned_agent TEXT,
      department TEXT DEFAULT 'Operations',
      next_run_at TEXT,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_cron_status ON cron_jobs(status);
  `);

  return db;
}

module.exports = { initDatabase };
