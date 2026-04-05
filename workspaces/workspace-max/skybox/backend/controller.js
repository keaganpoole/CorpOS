/**
 * Skybox Controller — Local Backend Service
 * Express REST API + WebSocket broadcast layer
 * Runs inside Electron main process on localhost
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Load OpenClaw .env so we can access OPENROUTER_API_KEY
const envPath = path.join(os.homedir(), '.openclaw', '.env');
console.log('[Skybox] Loading env from:', envPath, '| Exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('[Skybox] OPENROUTER_API_KEY after load:', process.env.OPENROUTER_API_KEY ? 'SET (' + process.env.OPENROUTER_API_KEY.substring(0, 8) + '...)' : 'NOT SET');
}

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
    // CORS for Electron dev mode (Vite on :5173 → backend on :7878)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });
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

    this.app.post('/api/control/ping-max', async (req, res) => {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const pending = this.db.prepare(
        'SELECT * FROM pending_restarts ORDER BY created_at ASC LIMIT 10'
      ).all();

      if (pending.length === 0) {
        return res.json({ success: true, message: 'No pending restarts', restarted: [] });
      }

      const results = [];
      for (const item of pending) {
        try {
          // Find Max's active Discord session
          const { stdout } = await execAsync('openclaw sessions', { timeout: 10000 });
          const lines = stdout.split('\n');
          let sessionKey = null;
          for (const line of lines) {
            if (line.includes('direct') && line.includes('discord') && line.includes('main')) {
              const match = line.match(/(direct|group)\s+(agent:[^\s]+)\s+/);
              if (match) { sessionKey = match[2]; break; }
            }
          }

          if (!sessionKey) {
            results.push({ agent: item.agent_name, model: item.new_model, error: 'No active Discord session found' });
            continue;
          }

          // Restart with new model
          await execAsync(`openclaw sessions restart "${sessionKey}" --model "${item.new_model}"`, { timeout: 30000 });
          results.push({ agent: item.agent_name, model: item.new_model, restarted: true });

          // Clear this pending restart
          this.db.prepare('DELETE FROM pending_restarts WHERE id = ?').run(item.id);
        } catch (err) {
          results.push({ agent: item.agent_name, model: item.new_model, error: err.message });
        }
      }

      res.json({ success: true, restarted: results });
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

    // --- OpenRouter Models ---
    this.app.get('/api/openrouter/models', async (req, res) => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenRouter API key not configured' });
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: `OpenRouter error: ${text}` });
        }
        const data = await response.json();

        // Flatten and normalize the model list
        const models = (data.data || []).map(m => ({
          id: m.id,
          name: m.name || m.id,
          provider: m.id.split('/')[0] || 'unknown',
          description: m.description || '',
          contextLength: m.context_length || 0,
          promptPrice: m.pricing?.prompt || 0,
          completionPrice: m.pricing?.completion || 0,
          modality: m.architecture?.modality || 'text->text',
          supportedParameters: m.supported_parameters || [],
        }));

        // Sort: featured/popular first, then alphabetically
        const preferred = ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-sonnet-4-20250514', 'anthropic/claude-3-5-sonnet-latest', 'google/gemini-2.5-pro-preview-06-05', 'meta-llama/llama-4-maverick', 'deepseek/deepseek-chat-v3-0324', 'openrouter/minimax/minimax-m2.7'];
        models.sort((a, b) => {
          const aIdx = preferred.indexOf(a.id);
          const bIdx = preferred.indexOf(b.id);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        res.json({ models });
      } catch (err) {
        console.error('[Skybox] OpenRouter fetch failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // --- Update agent model ---
    this.app.post('/api/agents/:id/model', (req, res) => {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: 'model is required' });

      const agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });

      this.db.prepare('UPDATE agents SET model = ?, updated_at = datetime("now") WHERE id = ?').run(model, req.params.id);

      // Queue a pending restart so Max can pick it up via polling
      this.db.prepare(
        'INSERT INTO pending_restarts (agent_id, agent_name, new_model) VALUES (?, ?, ?)'
      ).run(agent.id, agent.name, model);

      const updated = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
      res.json({ success: true, agent: updated });
    });

    // --- Pending restarts (for OpenClaw Max to poll) ---
    this.app.get('/api/pending-restarts', (req, res) => {
      const pending = this.db.prepare(
        'SELECT * FROM pending_restarts ORDER BY created_at ASC LIMIT 10'
      ).all();
      res.json({ pending_restarts: pending });
    });

    this.app.delete('/api/pending-restarts/:id', (req, res) => {
      this.db.prepare('DELETE FROM pending_restarts WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    });

    // --- Health check ---
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });

    // --- Cron Jobs (Chronos) ---
    this.app.get('/api/cron', (req, res) => {
      const jobs = this.db.prepare('SELECT * FROM cron_jobs ORDER BY next_run_at ASC').all();
      res.json(jobs);
    });

    this.app.post('/api/cron/sync', (req, res) => {
      const { jobs } = req.body;
      if (!Array.isArray(jobs)) return res.status(400).json({ error: 'jobs array required' });

      const upsert = this.db.prepare(`
        INSERT INTO cron_jobs (id, name, schedule_kind, schedule_value, payload_kind, payload_text, session_target, status, enabled, assigned_agent, department, next_run_at, updated_at)
        VALUES (@id, @name, @schedule_kind, @schedule_value, @payload_kind, @payload_text, @session_target, @status, @enabled, @assigned_agent, @department, @next_run_at, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = @name, schedule_kind = @schedule_kind, schedule_value = @schedule_value,
          payload_kind = @payload_kind, payload_text = @payload_text, session_target = @session_target,
          status = @status, enabled = @enabled, assigned_agent = @assigned_agent,
          department = @department, next_run_at = @next_run_at, updated_at = datetime('now')
      `);

      const syncAll = this.db.transaction((items) => {
        for (const j of items) {
          upsert.run(j);
        }
      });

      syncAll(jobs);
      const result = this.db.prepare('SELECT * FROM cron_jobs ORDER BY next_run_at ASC').all();
      res.json({ success: true, jobs: result });
    });

    // Create a new cron job (Skybox + OpenClaw)
    this.app.post('/api/cron', (req, res) => {
      const { name, schedule_kind, schedule_value, payload_text, assigned_agent, department } = req.body;
      if (!name || !schedule_kind || !schedule_value) {
        return res.status(400).json({ error: 'name, schedule_kind, and schedule_value are required' });
      }

      const { execSync } = require('child_process');
      const crypto = require('crypto');
      const jobId = crypto.randomUUID();

      // Compute next_run_at
      let nextRunAt;
      if (schedule_kind === 'at') {
        nextRunAt = schedule_value;
      } else if (schedule_kind === 'every') {
        nextRunAt = new Date(Date.now() + parseInt(schedule_value)).toISOString();
      } else {
        // For cron expressions, set next_run_at to now (OpenClaw handles actual scheduling)
        nextRunAt = new Date().toISOString();
      }

      // Build openclaw cron add command
      const isMainAgent = !assigned_agent || assigned_agent === 'Max';
      let cmd = 'openclaw cron add';
      cmd += ` --name "${name.replace(/"/g, '\\"')}"`;

      if (schedule_kind === 'at') {
        cmd += ` --at "${schedule_value}"`;
      } else if (schedule_kind === 'every') {
        cmd += ` --every "${schedule_value}"`;
      } else if (schedule_kind === 'cron') {
        cmd += ` --cron "${schedule_value}"`;
      }

      if (isMainAgent) {
        // Max = main session system event
        cmd += ` --session main`;
        if (payload_text) {
          cmd += ` --system-event "${payload_text.replace(/"/g, '\\"')}"`;
        }
        cmd += ` --wake now`;
      } else {
        // Lauren / Yanna = isolated agent turn
        cmd += ` --session isolated`;
        cmd += ` --agent ${assigned_agent.toLowerCase()}`;
        if (payload_text) {
          cmd += ` --message "${payload_text.replace(/"/g, '\\"')}"`;
        }
        cmd += ` --announce`;
      }

      // Execute OpenClaw cron add
      let openclawJobId = null;
      let openclawError = null;
      try {
        const output = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
        // Parse job ID from output (format: "Created job <id>")
        const match = output.match(/(?:Created job|jobId)[:\s]+([a-f0-9-]+)/i) || output.match(/([a-f0-9-]{36})/);
        if (match) openclawJobId = match[1];
      } catch (err) {
        openclawError = err.message;
        console.error('[Skybox] OpenClaw cron add failed:', err.message);
      }

      // Save to Skybox DB
      this.db.prepare(`
        INSERT INTO cron_jobs (id, name, schedule_kind, schedule_value, payload_kind, payload_text, session_target, status, enabled, assigned_agent, department, next_run_at)
        VALUES (?, ?, ?, ?, 'systemEvent', ?, 'main', 'queued', 1, ?, ?, ?)
      `).run(jobId, name, schedule_kind, schedule_value, payload_text || '', assigned_agent || 'Max', department || 'Operations', nextRunAt);

      const job = this.db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(jobId);
      res.json({ success: true, job, openclawJobId, openclawError });
    });

    // Delete a cron job (Skybox + OpenClaw)
    this.app.delete('/api/cron/:id', (req, res) => {
      const jobId = req.params.id;
      const { execSync } = require('child_process');

      // Remove from OpenClaw
      let openclawError = null;
      try {
        execSync(`openclaw cron remove ${jobId}`, { encoding: 'utf8', timeout: 10000 });
      } catch (err) {
        openclawError = err.message;
      }

      // Remove from Skybox DB
      this.db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(jobId);

      res.json({ success: true, openclawError });
    });

    // Reactions — get counts per agent
    this.app.get('/api/reactions', (req, res) => {
      const counts = this.db.prepare(`
        SELECT agent_name,
          SUM(CASE WHEN reaction_type = 'compliment' THEN 1 ELSE 0 END) as compliments,
          SUM(CASE WHEN reaction_type = 'complaint' THEN 1 ELSE 0 END) as complaints
        FROM reactions GROUP BY agent_name
      `).all();
      res.json(counts);
    });

    // Reactions — add a new reaction
    this.app.post('/api/reactions', (req, res) => {
      const { agent_name, reaction_type, context } = req.body;
      if (!agent_name || !reaction_type) return res.status(400).json({ error: 'agent_name and reaction_type required' });
      this.db.prepare('INSERT INTO reactions (agent_name, reaction_type, context) VALUES (?, ?, ?)').run(agent_name, reaction_type, context || '');
      const counts = this.db.prepare(`
        SELECT agent_name,
          SUM(CASE WHEN reaction_type = 'compliment' THEN 1 ELSE 0 END) as compliments,
          SUM(CASE WHEN reaction_type = 'complaint' THEN 1 ELSE 0 END) as complaints
        FROM reactions WHERE agent_name = ? GROUP BY agent_name
      `).get(agent_name);
      res.json({ success: true, ...counts });
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
