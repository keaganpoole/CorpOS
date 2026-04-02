/**
 * Event System — Central structured event ingestion
 * All events flow through here. Validates, stores, updates state, broadcasts.
 */

class EventSystem {
  constructor(db, broadcastFn) {
    this.db = db;
    this.broadcast = broadcastFn || (() => {});

    // Prepare statements for performance
    this._prepareStatements();
  }

  _prepareStatements() {
    this.stmts = {
      insertEvent: this.db.prepare(`
        INSERT INTO events (session_id, event_type, severity, actor, actor_type, source, message, task_id, agent_id, payload_json)
        VALUES (@session_id, @event_type, @severity, @actor, @actor_type, @source, @message, @task_id, @agent_id, @payload_json)
      `),

      insertSystemLog: this.db.prepare(`
        INSERT INTO system_logs (session_id, level, source, message, metadata_json)
        VALUES (@session_id, @level, @source, @message, @metadata_json)
      `),

      updateTaskState: this.db.prepare(`
        UPDATE tasks SET status = @status, latest_update = @message, latest_update_at = datetime('now'), updated_at = datetime('now')
        WHERE id = @task_id
      `),

      insertTaskUpdate: this.db.prepare(`
        INSERT INTO task_updates (task_id, status, message, severity, actor)
        VALUES (@task_id, @status, @message, @severity, @actor)
      `),

      updateAgentState: this.db.prepare(`
        UPDATE agents SET status = @status, current_activity = @activity, last_heartbeat_at = datetime('now'), updated_at = datetime('now')
        WHERE id = @agent_id
      `),

      updateControlState: this.db.prepare(`
        UPDATE control_state SET ${''} updated_at = datetime('now') WHERE id = 1
      `),
    };
  }

  /**
   * Main event ingestion method
   * @param {Object} event - The event to ingest
   */
  emit(event) {
    const session_id = event.session_id || this._getCurrentSessionId();

    const record = {
      session_id,
      event_type: event.event_type,
      severity: event.severity || this._deriveSeverity(event.event_type),
      actor: event.actor || 'system',
      actor_type: event.actor_type || 'system',
      source: event.source || 'controller',
      message: event.message || '',
      task_id: event.task_id || null,
      agent_id: event.agent_id || null,
      payload_json: event.payload ? JSON.stringify(event.payload) : null,
    };

    try {
      // Store event
      const result = this.stmts.insertEvent.run(record);

      // Derive state updates based on event type
      this._processEvent(event, session_id);

      // Broadcast to frontend
      this.broadcast({
        type: 'event',
        id: result.lastInsertRowid,
        ...record,
        timestamp: new Date().toISOString(),
      });

      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      console.error('[EventSystem] Failed to emit event:', err.message);
      return { success: false, error: err.message };
    }
  }

  _processEvent(event, session_id) {
    const type = event.event_type;

    // Task events → update task state
    if (type.startsWith('task_') && event.task_id) {
      const statusMap = {
        task_created: 'queued',
        task_queued: 'queued',
        task_started: 'in_progress',
        task_progress: 'in_progress',
        task_completed: 'completed',
        task_failed: 'failed',
        task_warning: 'warning',
        task_paused: 'paused',
      };
      const newStatus = statusMap[type];
      if (newStatus) {
        this.stmts.updateTaskState.run({
          task_id: event.task_id,
          status: newStatus,
          message: event.message || '',
        });
        this.stmts.insertTaskUpdate.run({
          task_id: event.task_id,
          status: newStatus,
          message: event.message || '',
          severity: event.severity || 'ok',
          actor: event.actor || 'system',
        });
      }
    }

    // Agent events → update agent state
    if (type.startsWith('agent_') && event.agent_id) {
      const statusMap = {
        agent_idle: 'idle',
        agent_active: 'active',
        agent_waiting: 'waiting',
        agent_paused: 'paused',
        agent_warning: 'warning',
        agent_error: 'error',
        agent_heartbeat: null, // just update heartbeat time
      };
      const newStatus = statusMap[type];
      if (newStatus !== undefined) {
        this.stmts.updateAgentState.run({
          agent_id: event.agent_id,
          status: newStatus || 'active',
          activity: event.message || 'Active',
        });
      } else if (type === 'agent_heartbeat') {
        this.db.prepare('UPDATE agents SET last_heartbeat_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').run(event.agent_id);
      }
    }

    // System events → write to system log
    if (type.startsWith('system_') || type === 'session_started' || type === 'session_ended' || type === 'log_entry') {
      this.stmts.insertSystemLog.run({
        session_id,
        level: event.severity || 'info',
        source: event.source || 'system',
        message: event.message || '',
        metadata_json: event.payload ? JSON.stringify(event.payload) : null,
      });
    }

    // Control events → update control state
    if (type === 'runtime_paused') {
      this.db.prepare("UPDATE control_state SET runtime_mode = 'paused', updated_at = datetime('now') WHERE id = 1").run();
    } else if (type === 'runtime_resumed') {
      this.db.prepare("UPDATE control_state SET runtime_mode = 'running', updated_at = datetime('now') WHERE id = 1").run();
    } else if (type === 'stage_changed') {
      this.db.prepare("UPDATE control_state SET stage = ?, updated_at = datetime('now') WHERE id = 1").run(event.payload?.stage || 'code_blue');
    } else if (type === 'zone_changed') {
      this.db.prepare("UPDATE control_state SET zone = ?, updated_at = datetime('now') WHERE id = 1").run(event.payload?.zone || 1);
    }
  }

  _deriveSeverity(eventType) {
    if (eventType.includes('failed') || eventType.includes('error')) return 'critical';
    if (eventType.includes('warning')) return 'warning';
    if (eventType.includes('completed') || eventType.includes('resumed')) return 'ok';
    return 'info';
  }

  _getCurrentSessionId() {
    const session = this.db.prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
    if (session) return session.id;

    // Auto-create a session so events have somewhere to live
    const sessionId = 'session_' + Date.now();
    this.db.prepare('INSERT INTO sessions (id, trigger_source, status) VALUES (?, ?, ?)').run(sessionId, 'auto', 'active');
    this.broadcast({ type: 'session_change', session: { id: sessionId, status: 'active', trigger_source: 'auto' } });
    return sessionId;
  }
}

module.exports = { EventSystem };
