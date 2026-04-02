/**
 * Skybox Operational Database — SQLite Schema
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

  // --- Create all tables ---
  db.exec(`
    -- 1) Sessions: Track OpenClaw runtime sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      trigger_source TEXT DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended', 'crashed'))
    );

    -- 2) Events: Master operational event stream (append-only)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'ok' CHECK(severity IN ('ok', 'warning', 'critical', 'info')),
      actor TEXT NOT NULL DEFAULT 'system',
      actor_type TEXT DEFAULT 'system' CHECK(actor_type IN ('agent', 'sub_agent', 'system', 'user')),
      source TEXT,
      message TEXT NOT NULL,
      task_id TEXT,
      agent_id TEXT,
      payload_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- 3) Tasks: Current task state table (fast reads)
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
    );

    -- 4) Task Updates: Historical task update stream
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

    -- 5) Agents: Current agent state table
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      team TEXT,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'active', 'waiting', 'paused', 'warning', 'error', 'offline')),
      current_activity TEXT DEFAULT 'Waiting for instruction',
      last_heartbeat_at TEXT,
      show_team_letter INTEGER DEFAULT 0,
      team_letter TEXT,
      hierarchy_level INTEGER DEFAULT 1,
      reports_to TEXT,
      department TEXT DEFAULT 'Operations',
      model TEXT,
      platform TEXT DEFAULT 'Discord',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6) System Logs: Operational system log feed
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('ok', 'warning', 'critical', 'info', 'cmd')),
      source TEXT DEFAULT 'system',
      message TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- 7) Leads: Relic pipeline leads (for pipeline view)
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

    -- 8) Control State: Current global operational control values
    CREATE TABLE IF NOT EXISTS control_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      runtime_mode TEXT NOT NULL DEFAULT 'running' CHECK(runtime_mode IN ('running', 'paused')),
      stage TEXT NOT NULL DEFAULT 'code_blue' CHECK(stage IN ('code_red', 'code_blue')),
      zone INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for fast queries
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_system_logs_session ON system_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
  `);

  // Seed control_state if empty
  const controlRow = db.prepare('SELECT id FROM control_state WHERE id = 1').get();
  if (!controlRow) {
    db.prepare('INSERT INTO control_state (id, runtime_mode, stage, zone) VALUES (1, ?, ?, ?)').run('running', 'code_blue', 1);
  }

  return db;
}

module.exports = { initDatabase };
