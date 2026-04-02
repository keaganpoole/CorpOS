/**
 * Skybox Controller — Local Backend Service
 * Express REST API + WebSocket broadcast layer
 * Runs inside Electron main process on localhost
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { initDatabase } = require('./db/schema');
const { EventSystem } = require('./events/EventSystem');
const { seedData } = require('./seed');

class Controller {
  constructor(port = 7878) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();

    // Init DB
    const dbPath = require('path').join(__dirname, '..', 'data', 'skybox.db');
    this.db = initDatabase(dbPath);

    // Init event system
    this.events = new EventSystem(this.db, this.broadcast.bind(this));

    // Setup routes
    this._setupRoutes();
    this._setupWebSocket();

    // Seed initial data if empty
    seedData(this.db, this.events);
  }

  // ─── WebSocket ───────────────────────────────────────────
  _setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('[Skybox] WebSocket client connected');

      // Send current state on connect
      this._sendInitialState(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[Skybox] WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        console.error('[Skybox] WebSocket error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  _sendInitialState(ws) {
    const pipelineData = this._getPipelineData();

    const state = {
      type: 'initial_state',
      tasks: this.db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all(),
      agents: this.db.prepare('SELECT * FROM agents ORDER BY hierarchy_level ASC').all(),
      control: this.db.prepare('SELECT * FROM control_state WHERE id = 1').get(),
      session: this.db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get(),
      recentEvents: this.db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 50').all(),
      systemLogs: this.db.prepare('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 50').all(),
      summary: this._getSystemSummary(),
      pipeline: pipelineData,
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(state));
    }
  }

  broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // ─── REST API Routes ─────────────────────────────────────
  _setupRoutes() {
    // --- Data endpoints ---

    this.app.get('/api/tasks', (req, res) => {
      const tasks = this.db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all();
      res.json(tasks);
    });

    this.app.get('/api/tasks/:id', (req, res) => {
      const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      const updates = this.db.prepare('SELECT * FROM task_updates WHERE task_id = ? ORDER BY timestamp DESC').all(req.params.id);
      res.json({ ...task, updates });
    });

    this.app.get('/api/agents', (req, res) => {
      const agents = this.db.prepare('SELECT * FROM agents ORDER BY hierarchy_level ASC').all();
      res.json(agents);
    });

    this.app.get('/api/system/summary', (req, res) => {
      res.json(this._getSystemSummary());
    });

    this.app.get('/api/events/live-pulse', (req, res) => {
      const limit = parseInt(req.query.limit) || 30;
      const events = this.db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?').all(limit);
      res.json(events);
    });

    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      const logs = this.db.prepare('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
      res.json(logs);
    });

    this.app.get('/api/control-state', (req, res) => {
      const state = this.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
      res.json(state);
    });

    this.app.get('/api/session', (req, res) => {
      const session = this.db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
      res.json(session || { status: 'none' });
    });

    // --- Command endpoints ---

    this.app.post('/api/control/runtime', (req, res) => {
      const { mode } = req.body;
      if (!['running', 'paused'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use "running" or "paused"' });
      }

      this._ensureSession();

      const eventType = mode === 'paused' ? 'runtime_paused' : 'runtime_resumed';
      this.events.emit({
        event_type: eventType,
        message: mode === 'paused' ? 'Runtime paused by command center' : 'Runtime resumed by command center',
        actor: 'user',
        actor_type: 'user',
        source: 'skybox_control',
      });

      const control = this.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
      res.json(control);
    });

    this.app.post('/api/control/stage', (req, res) => {
      const { stage } = req.body;
      if (!['code_red', 'code_blue'].includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage. Use "code_red" or "code_blue"' });
      }

      this.events.emit({
        event_type: 'stage_changed',
        message: `Stage changed to ${stage}`,
        actor: 'user',
        actor_type: 'user',
        source: 'skybox_control',
        payload: { stage },
      });

      const control = this.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
      res.json(control);
    });

    this.app.post('/api/control/zone', (req, res) => {
      const { zone } = req.body;
      if (typeof zone !== 'number' || zone < 1 || zone > 7) {
        return res.status(400).json({ error: 'Invalid zone. Must be 1-7' });
      }

      this.events.emit({
        event_type: 'zone_changed',
        message: `Zone changed to ${zone}`,
        actor: 'user',
        actor_type: 'user',
        source: 'skybox_control',
        payload: { zone },
      });

      const control = this.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
      res.json(control);
    });

    this.app.post('/api/control/ping-max', (req, res) => {
      // Ensure there's an active session
      let session = this.db.prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
      if (!session) {
        const sessionId = 'session_' + Date.now();
        this.db.prepare('INSERT INTO sessions (id, trigger_source, status) VALUES (?, ?, ?)').run(sessionId, 'ping_max', 'active');
        session = { id: sessionId };
        this.events.emit({
          event_type: 'session_started',
          message: `Session ${sessionId} started`,
          source: 'skybox_control',
          session_id: sessionId,
        });
        this.broadcast({ type: 'session_change', session: { id: sessionId, status: 'active', trigger_source: 'ping_max' } });
      }

      this.events.emit({
        event_type: 'ping_max_requested',
        message: 'Ping Max — operational check',
        actor: 'user',
        actor_type: 'user',
        source: 'skybox_control',
        severity: 'info',
      });

      res.json({ success: true, message: 'Ping event emitted' });
    });

    // --- Event ingestion endpoint (for OpenClaw runtime) ---
    this.app.post('/api/events', (req, res) => {
      const result = this.events.emit(req.body);
      res.json(result);
    });

    // --- Pipeline endpoint (live from leads table) ---

    this.app.get('/api/pipeline', (req, res) => {
      const stages = this.db.prepare(`
        SELECT stage, COUNT(*) as count FROM leads GROUP BY stage
      `).all();

      const stageMap = {
        discovery: 0,
        qualification: 0,
        outreach: 0,
        proposal: 0,
        closed: 0,
      };
      for (const row of stages) {
        stageMap[row.stage] = row.count;
      }

      const total = this.db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
      const qualified = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage IN ('qualification','outreach','proposal','closed')").get().count;
      const active = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage IN ('outreach','proposal')").get().count;

      res.json({
        stages: [
          { id: 'discovery', label: 'Discovery', count: stageMap.discovery, color: 'indigo' },
          { id: 'qualification', label: 'Qualification', count: stageMap.qualification, color: 'cyan' },
          { id: 'outreach', label: 'Outreach', count: stageMap.outreach, color: 'fuchsia' },
          { id: 'proposal', label: 'Proposal', count: stageMap.proposal, color: 'amber' },
          { id: 'closed', label: 'Closed', count: stageMap.closed, color: 'green' },
        ],
        totalRelics: total,
        qualifiedLeads: qualified,
        activeOutreach: active,
      });
    });

    this.app.get('/api/leads', (req, res) => {
      const stage = req.query.stage;
      let leads;
      if (stage) {
        leads = this.db.prepare('SELECT * FROM leads WHERE stage = ? ORDER BY updated_at DESC').all(stage);
      } else {
        leads = this.db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all();
      }
      res.json(leads);
    });

    this.app.post('/api/leads/:id/stage', (req, res) => {
      const { stage } = req.body;
      if (!['discovery', 'qualification', 'outreach', 'proposal', 'closed'].includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage' });
      }

      const lead = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      this.db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, req.params.id);

      this.events.emit({
        event_type: 'lead_stage_changed',
        message: `${lead.business_name} moved to ${stage}`,
        actor: 'user',
        actor_type: 'user',
        source: 'skybox_control',
        severity: 'ok',
      });

      res.json({ success: true, lead: this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) });
    });

    // --- Health check ---
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });
  }

  _ensureSession() {
    let session = this.db.prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
    if (!session) {
      const sessionId = 'session_' + Date.now();
      this.db.prepare('INSERT INTO sessions (id, trigger_source, status) VALUES (?, ?, ?)').run(sessionId, 'auto', 'active');
      this.events.emit({
        event_type: 'session_started',
        message: `Session ${sessionId} started`,
        source: 'controller',
        session_id: sessionId,
      });
      this.broadcast({ type: 'session_change', session: { id: sessionId, status: 'active', trigger_source: 'auto' } });
      return sessionId;
    }
    return session.id;
  }

  _getPipelineData() {
    const stages = this.db.prepare(`
      SELECT stage, COUNT(*) as count FROM leads GROUP BY stage
    `).all();

    const stageMap = { discovery: 0, qualification: 0, outreach: 0, proposal: 0, closed: 0 };
    for (const row of stages) {
      stageMap[row.stage] = row.count;
    }

    const total = this.db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const qualified = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage IN ('qualification','outreach','proposal','closed')").get().count;
    const active = this.db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage IN ('outreach','proposal')").get().count;

    return {
      stages: [
        { id: 'discovery', label: 'Discovery', count: stageMap.discovery, color: 'indigo' },
        { id: 'qualification', label: 'Qualification', count: stageMap.qualification, color: 'cyan' },
        { id: 'outreach', label: 'Outreach', count: stageMap.outreach, color: 'fuchsia' },
        { id: 'proposal', label: 'Proposal', count: stageMap.proposal, color: 'amber' },
        { id: 'closed', label: 'Closed', count: stageMap.closed, color: 'green' },
      ],
      totalRelics: total,
      qualifiedLeads: qualified,
      activeOutreach: active,
    };
  }

  _getSystemSummary() {
    const session = this.db.prepare("SELECT id, started_at FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
    const sessionId = session ? session.id : null;

    let okCount = 0, warnCount = 0, errCount = 0;
    if (sessionId) {
      const counts = this.db.prepare(`
        SELECT 
          SUM(CASE WHEN severity = 'ok' THEN 1 ELSE 0 END) as ok,
          SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warnings,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as errors
        FROM events WHERE session_id = ?
      `).get(sessionId);
      okCount = counts.ok || 0;
      warnCount = counts.warnings || 0;
      errCount = counts.errors || 0;
    }

    const activeAgents = this.db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get().count;
    const totalAgents = this.db.prepare("SELECT COUNT(*) as count FROM agents").get().count;

    // Derive status from error ratio
    const totalEvents = okCount + warnCount + errCount;
    let status = 'Operational';
    if (totalEvents > 0) {
      const errRatio = errCount / totalEvents;
      if (errRatio > 0.3) status = 'Critical';
      else if (errRatio > 0.1) status = 'Degraded';
      else if (warnCount > 0 && (warnCount / totalEvents) > 0.5) status = 'Degraded';
    }

    // Compute uptime from session start
    let uptime = '0m';
    if (session && session.started_at) {
      const startMs = new Date(session.started_at + 'Z').getTime();
      const elapsed = Date.now() - startMs;
      const mins = Math.floor(elapsed / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) uptime = `${days}d ${hrs % 24}h`;
      else if (hrs > 0) uptime = `${hrs}h ${mins % 60}m`;
      else uptime = `${mins}m`;
    }

    return {
      ok: okCount,
      warnings: warnCount,
      errors: errCount,
      activeAgents,
      totalAgents,
      status,
      uptime,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────
  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[Skybox] Controller running on http://127.0.0.1:${this.port}`);
        resolve(this.port);
      });
      this.server.on('error', reject);
    });
  }

  stop() {
    // End active sessions
    this.db.prepare("UPDATE sessions SET status = 'ended', ended_at = datetime('now') WHERE status = 'active'").run();

    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
    this.server.close();
    this.db.close();
  }

  /**
   * Start a new session
   */
  startSession(id, triggerSource = 'manual') {
    // End any existing active sessions
    this.db.prepare("UPDATE sessions SET status = 'ended', ended_at = datetime('now') WHERE status = 'active'").run();

    this.db.prepare('INSERT INTO sessions (id, trigger_source, status) VALUES (?, ?, ?)').run(id, triggerSource, 'active');

    this.events.emit({
      event_type: 'session_started',
      message: `Session ${id} started`,
      source: 'controller',
      session_id: id,
    });

    this.broadcast({ type: 'session_change', session: { id, status: 'active', trigger_source: triggerSource } });
  }
}

module.exports = { Controller };
