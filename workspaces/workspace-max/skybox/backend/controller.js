/**
 * Skybox Controller - Local Backend Service
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

// ─── Supabase Helper ─────────────────────────────────────
function getSBHeaders() {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function sbQuery(table, method = 'GET', body = null, query = '') {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}${query}`;
  const opts = { method, headers: getSBHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

class Controller {
  constructor(port = 7878) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    // CORS for Electron dev mode (Vite on :5173 → backend on :7878)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();

    // Init DB (still needed for tasks, leads, cron_jobs tables)
    const dbPath = require('path').join(__dirname, '..', 'data', 'skybox.db');
    this.db = initDatabase(dbPath);

    // Init event system with Supabase helpers
    this.events = new EventSystem(this.broadcast.bind(this), { sbQuery });

    // In-memory agent state cache (seeded from Supabase)
    this.agentCache = [];

    // In-memory pending model restarts
    this.pendingRestarts = [];

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
      this._sendInitialState(ws).catch(err => {
        console.error('[Skybox] Failed to send initial state:', err.message);
      });

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

  async _sendInitialState(ws) {
    const pipelineData = this._getPipelineData();

    // Fetch agents and state from Supabase
    let agents = [];
    let control = { runtime_mode: 'running', stage: 'code_blue', zone: 1 };
    try {
      agents = await sbQuery('agents', 'GET', null, '?order=hierarchy_level.asc') || [];
      const stateRows = await sbQuery('state', 'GET', null, '?id=eq.1') || [];
      if (stateRows.length > 0) control = stateRows[0];
    } catch (err) {
      console.error('[Skybox] Supabase fetch for initial state failed:', err.message);
    }

    const state = {
      type: 'initial_state',
      tasks: this.db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all(),
      agents: agents,
      control: control,
      session: { status: 'active' },
      recentEvents: this.events.getRecent(50),
      systemLogs: [],
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

    // Create a new task
    this.app.post('/api/tasks', (req, res) => {
      const { id, title, description, owner, actor_type, department, priority, status } = req.body;
      if (!title || !owner) return res.status(400).json({ error: 'title and owner are required' });

      const taskId = id || 'task_' + Date.now();
      const taskStatus = status || 'queued';

      this.db.prepare(`
        INSERT INTO tasks (id, title, description, owner, actor_type, status, department, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, title, description || '', owner, actor_type || 'A', taskStatus, department || 'Operations', priority || 'medium');

      this.events.emit({
        event_type: 'task_created',
        message: `Task created: ${title}`,
        actor: owner,
        actor_type: 'system',
        source: 'skybox_tasks',
        task_id: taskId,
        severity: 'ok',
        payload: { taskId, title, owner, priority: priority || 'medium' },
      });

      res.json({ success: true, task: this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) });
    });

    // Update task status
    this.app.put('/api/tasks/:id', (req, res) => {
      const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const { status, latest_update, priority, title, description } = req.body;
      const changes = [];

      if (status && status !== task.status) changes.push(`${task.status} → ${status}`);
      if (priority && priority !== task.priority) changes.push(`priority: ${priority}`);
      if (title && title !== task.title) changes.push(`title updated`);

      this.db.prepare(`
        UPDATE tasks SET
          status = COALESCE(?, status),
          latest_update = COALESCE(?, latest_update),
          latest_update_at = datetime('now'),
          priority = COALESCE(?, priority),
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(status || null, latest_update || null, priority || null, title || null, description || null, req.params.id);

      // Emit appropriate event
      const eventType = status ? `task_${status}` : 'task_updated';
      this.events.emit({
        event_type: eventType,
        message: latest_update || `Task "${task.title}" ${changes.length > 0 ? changes.join(', ') : 'updated'}`,
        actor: task.owner,
        actor_type: 'system',
        source: 'skybox_tasks',
        task_id: req.params.id,
        severity: status === 'failed' ? 'critical' : status === 'warning' ? 'warning' : 'ok',
      });

      res.json({ success: true, task: this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) });
    });

    // Delete a task
    this.app.delete('/api/tasks/:id', (req, res) => {
      const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      this.db.prepare('DELETE FROM task_updates WHERE task_id = ?').run(req.params.id);
      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

      this.events.emit({
        event_type: 'task_deleted',
        message: `Task deleted: ${task.title}`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_tasks',
        severity: 'warning',
        payload: { taskId: req.params.id, title: task.title },
      });

      res.json({ success: true });
    });

    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await sbQuery('agents', 'GET', null, '?order=id.asc') || [];
        res.json(agents);
      } catch (err) {
        console.error('[Skybox] GET agents failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/agents/:id', async (req, res) => {
      try {
        await sbQuery('agents', 'DELETE', null, `?id=eq.${req.params.id}`);
        this.events.emit({
          event_type: 'agent_deleted',
          message: `Agent removed from the roster`,
          actor: 'system',
          actor_type: 'system',
          source: 'skybox_agents',
          severity: 'warning',
          agent_id: req.params.id,
        });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.patch('/api/agents/:id', async (req, res) => {
      try {
        const updates = req.body;
        const allowed = ['name', 'status', 'current_activity', 'last_heartbeat'];
        const payload = {};
        for (const f of allowed) {
          if (updates[f] !== undefined) payload[f] = updates[f];
        }
        if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });
        const result = await sbQuery('agents', 'PATCH', payload, `?id=eq.${req.params.id}`);
        res.json(result?.[0] || { success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/system/summary', (req, res) => {
      res.json(this._getSystemSummary());
    });

    this.app.get('/api/events/live-pulse', (req, res) => {
      const limit = parseInt(req.query.limit) || 30;
      res.json(this.events.getRecent(limit));
    });

    this.app.get('/api/logs', (req, res) => {
      // Logs are now in-memory events filtered by severity
      const limit = parseInt(req.query.limit) || 50;
      res.json(this.events.getRecent(limit));
    });

    this.app.get('/api/control-state', async (req, res) => {
      try {
        const rows = await sbQuery('state', 'GET', null, '?id=eq.1') || [];
        res.json(rows[0] || { runtime_mode: 'running', stage: 'code_blue', zone: 1 });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/session', (req, res) => {
      // Sessions removed — return placeholder
      res.json({ status: 'active' });
    });

    // --- Command endpoints ---

    this.app.post('/api/control/runtime', async (req, res) => {
      const { mode } = req.body;
      if (!['running', 'paused'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use "running" or "paused"' });
      }

      const eventType = mode === 'paused' ? 'runtime_paused' : 'runtime_resumed';
      this.events.emit({
        event_type: eventType,
        message: mode === 'paused' ? 'Runtime paused by command center' : 'Runtime resumed by command center',
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_control',
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { runtime_mode: mode, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { runtime_mode: mode });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/control/stage', async (req, res) => {
      const { stage } = req.body;
      if (!['code_red', 'code_blue'].includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage. Use "code_red" or "code_blue"' });
      }

      this.events.emit({
        event_type: 'stage_changed',
        message: `Stage changed to ${stage}`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_control',
        payload: { stage },
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { stage, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { stage });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/control/zone', async (req, res) => {
      const { zone } = req.body;
      if (typeof zone !== 'number' || zone < 1 || zone > 7) {
        return res.status(400).json({ error: 'Invalid zone. Must be 1-7' });
      }

      this.events.emit({
        event_type: 'zone_changed',
        message: `Zone changed to ${zone}`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_control',
        payload: { zone },
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { zone, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { zone });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/control/ping-max', async (req, res) => {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const pending = [...this.pendingRestarts];

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
          this.pendingRestarts = this.pendingRestarts.filter(r => r !== item);
        } catch (err) {
          results.push({ agent: item.agent_name, model: item.new_model, error: err.message });
        }
      }

      this.events.emit({
        event_type: 'system_ping',
        message: `Ping Max - ${results.filter(r => r.restarted).length}/${results.length} restart(s) processed`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_control',
        severity: results.some(r => r.error) ? 'warning' : 'ok',
        payload: { results },
      });

      res.json({ success: true, restarted: results });
    });

    // --- Event ingestion endpoint (for OpenClaw runtime) ---
    this.app.post('/api/events', (req, res) => {
      const result = this.events.emit(req.body);
      res.json(result);
    });

    // --- Batch event ingestion (for OpenClaw bulk pushes) ---
    this.app.post('/api/events/batch', (req, res) => {
      const { events: eventList } = req.body;
      if (!Array.isArray(eventList)) return res.status(400).json({ error: 'events array required' });

      const results = [];
      for (const evt of eventList) {
        results.push(this.events.emit(evt));
      }
      res.json({ success: true, emitted: results.length, results });
    });

    // --- Lead CRUD ---

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
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_control',
        severity: 'ok',
      });

      res.json({ success: true, lead: this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) });
    });

    // Create a new lead
    this.app.post('/api/leads', (req, res) => {
      const { id, business_name, url, stage, score, notes, assigned_agent } = req.body;
      if (!business_name) return res.status(400).json({ error: 'business_name is required' });

      const leadId = id || 'lead_' + Date.now();
      const leadStage = stage || 'discovery';

      this.db.prepare(`
        INSERT INTO leads (id, business_name, url, stage, score, notes, assigned_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(leadId, business_name, url || '', leadStage, score || 0, notes || '', assigned_agent || '');

      this.events.emit({
        event_type: 'lead_created',
        message: `New lead: ${business_name} → ${leadStage}`,
        actor: 'system',
        actor_type: 'system',
        source: 'skybox_leads',
        severity: 'ok',
        payload: { leadId, business_name, stage: leadStage },
      });

      res.json({ success: true, lead: this.db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) });
    });

    // Update a lead
    this.app.put('/api/leads/:id', (req, res) => {
      const lead = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      const { business_name, url, score, notes, assigned_agent, stage } = req.body;
      const changes = [];

      if (business_name && business_name !== lead.business_name) changes.push(`name: "${lead.business_name}" → "${business_name}"`);
      if (stage && stage !== lead.stage) changes.push(`stage: ${lead.stage} → ${stage}`);
      if (score !== undefined && score !== lead.score) changes.push(`score: ${lead.score} → ${score}`);
      if (assigned_agent && assigned_agent !== lead.assigned_agent) changes.push(`agent: ${lead.assigned_agent || 'none'} → ${assigned_agent}`);

      this.db.prepare(`
        UPDATE leads SET
          business_name = COALESCE(?, business_name),
          url = COALESCE(?, url),
          stage = COALESCE(?, stage),
          score = COALESCE(?, score),
          notes = COALESCE(?, notes),
          assigned_agent = COALESCE(?, assigned_agent),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        business_name || null,
        url || null,
        stage || null,
        score !== undefined ? score : null,
        notes !== undefined ? notes : null,
        assigned_agent || null,
        req.params.id
      );

      if (changes.length > 0) {
        this.events.emit({
          event_type: 'lead_updated',
          message: `${lead.business_name} updated: ${changes.join(', ')}`,
          actor: 'Keagan',
          actor_type: 'user',
          source: 'skybox_leads',
          severity: 'info',
          payload: { leadId: req.params.id, changes },
        });
      }

      res.json({ success: true, lead: this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) });
    });

    // Delete a lead
    this.app.delete('/api/leads/:id', (req, res) => {
      const lead = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      this.db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);

      this.events.emit({
        event_type: 'lead_deleted',
        message: `Lead deleted: ${lead.business_name}`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_leads',
        severity: 'warning',
        payload: { leadId: req.params.id, business_name: lead.business_name },
      });

      res.json({ success: true });
    });

    // --- Pipeline endpoint (live from leads table) ---
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
    this.app.post('/api/agents/:id/model', async (req, res) => {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: 'model is required' });

      // Prepend 'openrouter/' if not already present
      const normalizedModel = model.startsWith('openrouter/') ? model : `openrouter/${model}`;

      try {
        // Look up agent from Supabase
        const agents = await sbQuery('agents', 'GET', null, `?id=eq.${req.params.id}`) || [];
        if (agents.length === 0) return res.status(404).json({ error: 'Agent not found' });
        const agent = agents[0];

        // Only update global OpenClaw model for Max (main agent)
        if (req.params.id === 'max') {
          try {
            const { execSync } = require('child_process');
            execSync(`openclaw models set "${normalizedModel}"`, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
          } catch (err) {
            console.error('[Skybox] openclaw models set failed:', err.message);
          }
        }

        // Queue a pending restart for model change tracking
        this.pendingRestarts.push({
          agent_id: agent.id,
          agent_name: agent.name,
          new_model: normalizedModel,
          created_at: new Date().toISOString(),
        });

        // Write model back to Supabase
        await sbQuery('agents', 'PATCH', { model: normalizedModel }, `?id=eq.${req.params.id}`);

        this.events.emit({
          event_type: 'agent_model_changed',
          message: `${agent.name} model → ${normalizedModel}`,
          actor: 'Keagan',
          actor_type: 'user',
          source: 'skybox_control',
          agent_id: agent.id,
          severity: 'ok',
          payload: { agent: agent.name, model: normalizedModel },
        });

        res.json({ success: true, agent: { ...agent, model: normalizedModel } });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- Pending restarts (for OpenClaw Max to poll) ---
    this.app.get('/api/pending-restarts', (req, res) => {
      res.json({ pending_restarts: this.pendingRestarts });
    });

    this.app.delete('/api/pending-restarts/:id', (req, res) => {
      const idx = parseInt(req.params.id);
      this.pendingRestarts = this.pendingRestarts.filter((_, i) => i !== idx);
      res.json({ success: true });
    });

    // --- Health check ---
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });

    // --- Webhook endpoint to handle Supabase leads table changes ---
    this.app.post('/api/webhook/leads', (req, res) => {
      const { type, record, old_record } = req.body;
      if (!type || !record || !record.id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const leadId = record.id;
      const eventType = {
        INSERT: 'lead_created',
        UPDATE: 'lead_updated',
        DELETE: 'lead_deleted',
      }[type];

      const companyName = record.company || old_record?.company || 'Unknown Company';
      const actorName = (type === 'INSERT' ? record.created_by : (record.updated_by || old_record?.updated_by)) || 'system';

      if (type === 'INSERT') {
        this.events.emit({
          event_type: 'lead_created',
          message: `Created a new lead for ${companyName} 🆕`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_leads_webhook',
          severity: 'ok',
          payload: { leadId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      if (type === 'DELETE') {
        this.events.emit({
          event_type: 'lead_deleted',
          message: `Deleted the lead for ${companyName} 🗑️`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_leads_webhook',
          severity: 'warning',
          payload: { leadId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      if (!eventType) {
        return res.status(400).json({ error: 'Unsupported event type' });
      }

      let changeParts = [];

      // Smart emoji picker — returns an emoji based on field + direction, or nothing 60% of the time
      const shouldEmoji = () => Math.random() < 0.4;
      function pickEmoji(field, oldVal, newVal) {
        if (!shouldEmoji()) return '';
        const f = field.toLowerCase();

        // Score/quality fields — direction matters
        const numericFields = ['score', 'page_quality_score', 'value', 'revenue', 'traffic', 'rating'];
        if (numericFields.some(n => f.includes(n)) || f.endsWith('_score')) {
          const oldNum = parseFloat(oldVal);
          const newNum = parseFloat(newVal);
          if (!isNaN(oldNum) && !isNaN(newNum)) {
            if (newNum > oldNum) return ' 💰';
            if (newNum < oldNum) return ' 📉';
          } else if (!oldVal || oldVal === 'empty' || oldVal === 'null') {
            return ' 💰'; // filled in an empty value = good
          }
          return '';
        }

        // Contact fields
        if (f.includes('phone') || f.includes('mobile') || f.includes('tel')) return ' 📱';
        if (f.includes('email') || f.includes('mail')) return ' 📧';
        if (f.includes('website') || f.includes('url') || f.includes('site')) return ' 🌐';
        if (f.includes('address') || f.includes('city') || f.includes('state') || f.includes('zip')) return ' 📍';

        // Status/stage changes
        if (f === 'status' || f === 'stage') return '';

        // Assignment
        if (f.includes('assigned') || f.includes('agent')) return '';

        return '';
      }

      // Compare every field dynamically
      if (type === 'UPDATE' && record && old_record) {
        const fieldLabels = {
          company: 'company name',
          status: 'status',
          phone: 'phone number',
          email: 'email',
          website: 'website',
          address: 'address',
          city: 'city',
          state: 'state',
          zip: 'zip code',
          notes: 'notes',
          score: 'score',
          stage: 'stage',
          assigned_agent: 'assigned agent',
        };

        // Skip metadata fields — not worth showing in live pulse
        const skipFields = ['created_by', 'updated_by', 'id'];

        for (const [field, label] of Object.entries(fieldLabels)) {
          const oldVal = old_record[field];
          const newVal = record[field];
          if (oldVal !== newVal) {
            const emoji = pickEmoji(field, oldVal, newVal);
            if (field === 'company') {
              changeParts.push(`renamed from "${oldVal}" to "${newVal}"${emoji}`);
            } else {
              changeParts.push(`${label} from ${oldVal || 'empty'} to ${newVal || 'empty'}${emoji}`);
            }
          }
        }

        // Catch any other changed fields not in the labels map
        for (const field of Object.keys(record)) {
          if (skipFields.includes(field) || field in fieldLabels) continue;
          if (String(record[field]) !== String(old_record[field])) {
            const emoji = pickEmoji(field, old_record[field], record[field]);
            changeParts.push(`${field} from ${old_record[field] || 'empty'} to ${record[field] || 'empty'}${emoji}`);
          }
        }
      }

      let message;
      if (changeParts.length > 0) {
        const changeStr = changeParts.length === 1
          ? changeParts[0]
          : changeParts.slice(0, -1).join(', ') + ' and ' + changeParts[changeParts.length - 1];
        message = `Updated ${companyName}'s ${changeStr}`;
      } else {
        message = `Updated ${companyName}'s record`;
      }

      this.events.emit({
        event_type: eventType,
        message: `${message}.`,
        actor: actorName,
        actor_type: actorName === 'system' ? 'system' : 'user',
        source: 'supabase_leads_webhook',
        severity: 'ok',
        payload: { leadId, actor: actorName, changes: changeParts, time: new Date().toISOString() },
      });

      res.json({ success: true });
    });

    // --- Webhook endpoint to handle Supabase tasks table changes ---
    this.app.post('/api/webhook/tasks', (req, res) => {
      const { type, record, old_record } = req.body;
      if (!type || !record || !record.id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const taskId = record.id;
      const taskName = record.task || old_record?.task || 'Unknown Task';
      const actorName = (type === 'INSERT' ? record.created_by : (record.updated_by || old_record?.updated_by)) || 'system';

      const eventType = {
        INSERT: 'task_created',
        UPDATE: 'task_updated',
        DELETE: 'task_deleted',
      }[type];

      if (!eventType) {
        return res.status(400).json({ error: 'Unsupported event type' });
      }

      if (type === 'INSERT') {
        this.events.emit({
          event_type: 'task_created',
          message: `New task created: ${taskName} 📋`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_tasks_webhook',
          severity: 'ok',
          payload: { taskId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      if (type === 'DELETE') {
        this.events.emit({
          event_type: 'task_deleted',
          message: `Deleted task: ${taskName} 🗑️`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_tasks_webhook',
          severity: 'warning',
          payload: { taskId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      // UPDATE — compare fields dynamically
      let changeParts = [];

      const fieldLabels = {
        task: 'title',
        status: 'status',
        assigned_to: 'assigned to',
        assigned_team: 'team',
        notes: 'notes',
        due_date: 'due date',
        start_date: 'start date',
        completion_date: 'completion date',
        subtasks: 'subtasks',
      };

      const skipFields = ['created_by', 'updated_by', 'id', 'created_at', 'updated_at'];

      for (const [field, label] of Object.entries(fieldLabels)) {
        const oldVal = old_record?.[field];
        const newVal = record[field];
        const oldStr = typeof oldVal === 'object' && oldVal !== null ? JSON.stringify(oldVal) : String(oldVal ?? '');
        const newStr = typeof newVal === 'object' && newVal !== null ? JSON.stringify(newVal) : String(newVal ?? '');
        if (oldStr !== newStr) {
          if (field === 'task') {
            changeParts.push(`renamed from "${oldStr}" to "${newStr}"`);
          } else if (field === 'subtasks') {
            changeParts.push(`subtasks updated`);
          } else {
            changeParts.push(`${label} from ${oldStr || 'empty'} to ${newStr || 'empty'}`);
          }
        }
      }

      let message;
      if (changeParts.length > 0) {
        const changeStr = changeParts.length === 1
          ? changeParts[0]
          : changeParts.slice(0, -1).join(', ') + ' and ' + changeParts[changeParts.length - 1];
        message = `Updated task "${taskName}": ${changeStr}`;
      } else {
        message = `Updated task "${taskName}"`;
      }

      this.events.emit({
        event_type: eventType,
        message: `${message}.`,
        actor: actorName,
        actor_type: actorName === 'system' ? 'system' : 'user',
        source: 'supabase_tasks_webhook',
        severity: 'ok',
        payload: { taskId, actor: actorName, changes: changeParts, time: new Date().toISOString() },
      });

      res.json({ success: true });
    });

    // --- Webhook endpoint to handle Supabase research campaigns table changes ---
    this.app.post('/api/webhook/research-campaigns', (req, res) => {
      const { type, record, old_record } = req.body;
      if (!type || !record || !record.id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const campaignId = record.id;
      const campaignName = record['Campaign Name'] || old_record?.['Campaign Name'] || 'Unknown Campaign';
      const actorName = (type === 'INSERT' ? record.created_by : (record.updated_by || old_record?.updated_by)) || 'system';

      const eventType = {
        INSERT: 'campaign_created',
        UPDATE: 'campaign_updated',
        DELETE: 'campaign_deleted',
      }[type];

      if (!eventType) {
        return res.status(400).json({ error: 'Unsupported event type' });
      }

      if (type === 'INSERT') {
        this.events.emit({
          event_type: 'campaign_created',
          message: `New campaign created: ${campaignName} 📋`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_research_campaigns_webhook',
          severity: 'ok',
          payload: { campaignId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      if (type === 'DELETE') {
        this.events.emit({
          event_type: 'campaign_deleted',
          message: `Deleted campaign: ${campaignName} 🗑️`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_research_campaigns_webhook',
          severity: 'warning',
          payload: { campaignId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      // UPDATE — compare fields dynamically
      let changeParts = [];

      const fieldLabels = {
        'Campaign Name': 'name',
        'Status': 'status',
        'Target Industry': 'target industry',
        'Target State(s)': 'target states',
        'Target City(s)': 'target cities',
        'Lead Count Goal': 'lead count goal',
      };

      const skipFields = ['created_by', 'updated_by', 'id', 'created_at'];

      for (const [field, label] of Object.entries(fieldLabels)) {
        const oldVal = old_record?.[field];
        const newVal = record[field];
        const oldStr = Array.isArray(oldVal) ? oldVal.join(', ') : String(oldVal || '');
        const newStr = Array.isArray(newVal) ? newVal.join(', ') : String(newVal || '');
        if (oldStr !== newStr) {
          changeParts.push(`${label} from "${oldStr || 'empty'}" to "${newStr || 'empty'}"`);
        }
      }

      // Catch any remaining changed fields
      for (const field of Object.keys(record)) {
        if (skipFields.includes(field) || field in fieldLabels) continue;
        const oldStr = String(old_record?.[field] ?? '');
        const newStr = String(record[field] ?? '');
        if (oldStr !== newStr) {
          changeParts.push(`${field} from "${oldStr || 'empty'}" to "${newStr || 'empty'}"`);
        }
      }

      let message;
      if (changeParts.length > 0) {
        const changeStr = changeParts.length === 1
          ? changeParts[0]
          : changeParts.slice(0, -1).join(', ') + ' and ' + changeParts[changeParts.length - 1];
        message = `Updated campaign ${campaignName}: ${changeStr}`;
      } else {
        message = `Updated campaign ${campaignName}`;
      }

      this.events.emit({
        event_type: 'campaign_updated',
        message: `${message}.`,
        actor: actorName,
        actor_type: actorName === 'system' ? 'system' : 'user',
        source: 'supabase_research_campaigns_webhook',
        severity: 'ok',
        payload: { campaignId, actor: actorName, changes: changeParts, time: new Date().toISOString() },
      });

      res.json({ success: true });
    });

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

      this.events.emit({
        event_type: 'cron_synced',
        message: `Cron synced - ${jobs.length} job(s) updated`,
        actor: 'system',
        actor_type: 'system',
        source: 'skybox_cron',
        severity: 'ok',
        payload: { count: jobs.length },
      });

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
        // Yanna = isolated agent turn
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

      this.events.emit({
        event_type: 'cron_created',
        message: `Cron job "${name}" created - ${schedule_kind}: ${schedule_value}`,
        actor: assigned_agent || 'Max',
        actor_type: 'system',
        source: 'skybox_cron',
        severity: 'ok',
        payload: { jobId, name, schedule_kind, schedule_value, assigned_agent, openclawJobId },
      });

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
      const deletedJob = this.db.prepare('SELECT name FROM cron_jobs WHERE id = ?').get(jobId);
      this.db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(jobId);

      this.events.emit({
        event_type: 'cron_deleted',
        message: `Cron job "${deletedJob?.name || jobId}" deleted`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'skybox_cron',
        severity: 'warning',
        payload: { jobId, name: deletedJob?.name },
      });

      res.json({ success: true, openclawError });
    });

    // Reactions - get counts per agent
    this.app.get('/api/reactions', async (req, res) => {
      try {
        const reactions = await sbQuery('reactions', 'GET', null, '?select=agent_name,reaction_type') || [];
        // Aggregate counts per agent
        const counts = {};
        for (const r of reactions) {
          if (!counts[r.agent_name]) counts[r.agent_name] = { agent_name: r.agent_name, compliments: 0, complaints: 0 };
          if (r.reaction_type === 'compliment') counts[r.agent_name].compliments++;
          if (r.reaction_type === 'complaint') counts[r.agent_name].complaints++;
        }
        res.json(Object.values(counts));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/reactions', async (req, res) => {
      const { agent_name, reaction_type, context } = req.body;
      if (!agent_name || !reaction_type) return res.status(400).json({ error: 'agent_name and reaction_type required' });

      try {
        await sbQuery('reactions', 'POST', { agent_name, reaction_type, context: context || '' });

        this.events.emit({
          event_type: reaction_type === 'compliment' ? 'reaction_compliment' : 'reaction_complaint',
          message: `${reaction_type === 'compliment' ? '👏' : '⚠️'} ${agent_name}: ${context || reaction_type}`,
          actor: 'Keagan',
          actor_type: 'user',
          source: 'skybox_reactions',
          severity: reaction_type === 'compliment' ? 'ok' : 'warning',
          payload: { agent_name, reaction_type, context },
        });

        // Get updated counts for this agent
        const reactions = await sbQuery('reactions', 'GET', null, `?agent_name=eq.${agent_name}&select=reaction_type`) || [];
        const compliments = reactions.filter(r => r.reaction_type === 'compliment').length;
        const complaints = reactions.filter(r => r.reaction_type === 'complaint').length;
        res.json({ success: true, agent_name, compliments, complaints });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
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
    // Compute from in-memory events
    const allEvents = this.events.getRecent(200);
    let okCount = 0, warnCount = 0, errCount = 0;
    for (const evt of allEvents) {
      if (evt.severity === 'ok') okCount++;
      else if (evt.severity === 'warning') warnCount++;
      else if (evt.severity === 'critical') errCount++;
    }

    // Agent counts from cache
    const totalAgents = this.agentCache.length || 2;
    const activeAgents = this.agentCache.filter(a => a.status === 'active').length || 0;

    // Derive status from error ratio
    const totalEvents = okCount + warnCount + errCount;
    let status = 'Operational';
    if (totalEvents > 0) {
      const errRatio = errCount / totalEvents;
      if (errRatio > 0.3) status = 'Critical';
      else if (errRatio > 0.1) status = 'Degraded';
      else if (warnCount > 0 && (warnCount / totalEvents) > 0.5) status = 'Degraded';
    }

    // Uptime based on process
    const uptimeSec = process.uptime();
    const mins = Math.floor(uptimeSec / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    let uptime = '0m';
    if (days > 0) uptime = `${days}d ${hrs % 24}h`;
    else if (hrs > 0) uptime = `${hrs}h ${mins % 60}m`;
    else uptime = `${mins}m`;

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
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
    this.server.close();
    this.db.close();
  }
}

module.exports = { Controller };
