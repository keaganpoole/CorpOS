/**
 * SONAR Controller - Local Backend Service
 * Express REST API + WebSocket broadcast layer
 * Runs inside Electron main process on localhost
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Load OpenClaw .env so we can access OPENROUTER_API_KEY
const envPath = path.join(os.homedir(), '.openclaw', '.env');
console.log('[SONAR] Loading env from:', envPath, '| Exists:', fs.existsSync(envPath));
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
  console.log('[SONAR] OPENROUTER_API_KEY after load:', process.env.OPENROUTER_API_KEY ? 'SET (' + process.env.OPENROUTER_API_KEY.substring(0, 8) + '...)' : 'NOT SET');
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { EventSystem } = require('./events/EventSystem');
const { syncAgentVoice } = require('./elevenlabs/sync-voice');
const { ScenarioEngine } = require('./scenarios/ScenarioEngine');

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
    this.app.use(express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    }));
    // Root health endpoint
    this.app.get('/', (req, res) => {
      res.json({ status: 'ok', service: 'sonar-backend', port: this.port });
    });
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

    // Init event system with Supabase helpers
    this.events = new EventSystem(this.broadcast.bind(this), { sbQuery });

    // Init scenario engine
    this.scenarioEngine = new ScenarioEngine({
      eventSystem: this.events,
      sbQuery,
      broadcast: this.broadcast.bind(this),
      app: this.app,
    });

    // In-memory agent state cache (seeded from Supabase)
    this.agentCache = [];

    // In-memory pending model restarts
    this.pendingRestarts = [];

    // Setup routes
    this._setupRoutes();
    this._setupWebSocket();


  }

  // ─── WebSocket ───────────────────────────────────────────
  _setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('[SONAR] WebSocket client connected');

      // Send current state on connect
      this._sendInitialState(ws).catch(err => {
        console.error('[SONAR] Failed to send initial state:', err.message);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[SONAR] WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        console.error('[SONAR] WebSocket error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  // Map hired_receptionists fields to the field names the frontend expects
  _mapAgentFields(agent) {
    return {
      ...agent,
      name: agent.full_name || agent.name,
      role: agent.stereotype || agent.role || 'Receptionist',
      model: agent.language_model || agent.model || null,
      compliments: agent.compliments ?? 0,
      complaints: agent.complaints ?? 0,
      memory_items: agent.memory_items ?? 0,
      tasks_done: agent.tasks_done ?? 0,
    };
  }

  async _sendInitialState(ws) {
    const pipelineData = await this._getPipelineData();

    // Fetch agents and state from Supabase
    let agents = [];
    let control = { runtime_mode: 'running', stage: 'code_blue', zone: 1 };
    try {
      agents = await sbQuery('hired_receptionists', 'GET', null, '?order=id.asc') || [];
      agents = agents.map(a => this._mapAgentFields(a));
      const stateRows = await sbQuery('state', 'GET', null, '?id=eq.1') || [];
      if (stateRows.length > 0) control = stateRows[0];
      // State table not configured, using defaults
    } catch (err) {}

    const state = {
      type: 'initial_state',
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

    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await sbQuery('hired_receptionists', 'GET', null, '?order=id.asc') || [];
        res.json(agents.map(a => this._mapAgentFields(a)));
      } catch (err) {
        console.error('[SONAR] GET agents failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/agents/:id', async (req, res) => {
      try {
        await sbQuery('hired_receptionists', 'DELETE', null, `?id=eq.${req.params.id}`);
        this.events.emit({
          event_type: 'agent_deleted',
          message: `Agent removed from the roster`,
          actor: 'system',
          actor_type: 'system',
          source: 'SONAR_agents',
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
        const allowed = ['name', 'status', 'current_activity', 'last_heartbeat', 'phone_number', 'call_types', 'is_active'];
        const payload = {};
        for (const f of allowed) {
          if (updates[f] !== undefined) payload[f] = updates[f];
        }
        if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });
        const result = await sbQuery('hired_receptionists', 'PATCH', payload, `?id=eq.${req.params.id}`);

        // Sync voice to ElevenLabs when call_types changes
        if (payload.call_types !== undefined) {
          const receptionist = result?.[0] || {};
          if (payload.call_types !== 'none') {
            syncAgentVoice(receptionist.elevenlabs_voice_id, receptionist.full_name || 'Unknown');
          } else {
            syncAgentVoice(null, receptionist.full_name || 'Unknown');
          }
        }

        res.json(this._mapAgentFields(result?.[0]) || { success: true });
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
        res.json({ runtime_mode: 'running', stage: 'code_blue', zone: 1 });
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
        source: 'SONAR_control',
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { runtime_mode: mode, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { runtime_mode: mode });
      } catch (err) {
        res.json({ runtime_mode: mode });
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
        source: 'SONAR_control',
        payload: { stage },
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { stage, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { stage });
      } catch (err) {
        res.json({ stage });
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
        source: 'SONAR_control',
        payload: { zone },
      });

      try {
        const rows = await sbQuery('state', 'PATCH', { zone, updated_at: new Date().toISOString() }, '?id=eq.1');
        res.json(rows?.[0] || { zone });
      } catch (err) {
        res.json({ zone });
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
        source: 'SONAR_control',
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

    // --- Pipeline (Supabase people table) ---

    this.app.get('/api/pipeline', async (req, res) => {
      try {
        const people = await sbQuery('people', 'GET', null, '?select=status') || [];
        const statusMap = {};
        for (const p of people) {
          const s = p.status || 'New';
          statusMap[s] = (statusMap[s] || 0) + 1;
        }

        const stages = [
          { id: 'new', label: 'New', count: statusMap['New'] || 0, color: 'indigo' },
          { id: 'contacted', label: 'Contacted', count: statusMap['Contacted'] || 0, color: 'cyan' },
          { id: 'qualified', label: 'Qualified', count: statusMap['Qualified'] || 0, color: 'fuchsia' },
          { id: 'booked', label: 'Booked', count: statusMap['Booked'] || 0, color: 'amber' },
          { id: 'closed', label: 'Closed', count: statusMap['Closed'] || 0, color: 'green' },
        ];

        res.json({
          stages,
          totalRelics: people.length,
          qualifiedLeads: (statusMap['Qualified'] || 0) + (statusMap['Booked'] || 0) + (statusMap['Closed'] || 0),
          activeOutreach: (statusMap['Contacted'] || 0) + (statusMap['Qualified'] || 0),
        });
      } catch (err) {
        console.error('[SONAR] Pipeline query failed:', err.message);
        res.json({
          stages: [
            { id: 'new', label: 'New', count: 0, color: 'indigo' },
            { id: 'contacted', label: 'Contacted', count: 0, color: 'cyan' },
            { id: 'qualified', label: 'Qualified', count: 0, color: 'fuchsia' },
            { id: 'booked', label: 'Booked', count: 0, color: 'amber' },
            { id: 'closed', label: 'Closed', count: 0, color: 'green' },
          ],
          totalRelics: 0, qualifiedLeads: 0, activeOutreach: 0,
        });
      }
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
        console.error('[SONAR] OpenRouter fetch failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // --- Update agent model ---
    this.app.post('/api/agents/:id/model', async (req, res) => {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: 'model is required' });

      // Strip 'openrouter/' prefix if present — store clean model name
      const normalizedModel = model.replace(/^openrouter\//, '');

      try {
        // Look up agent from Supabase
        const agents = await sbQuery('hired_receptionists', 'GET', null, `?id=eq.${req.params.id}`) || [];
        if (agents.length === 0) return res.status(404).json({ error: 'Agent not found' });
        const agent = this._mapAgentFields(agents[0]);

        // Only update global OpenClaw model for Max (main agent)
        if (req.params.id === 'max') {
          try {
            const { execSync } = require('child_process');
            execSync(`openclaw models set "${normalizedModel}"`, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
          } catch (err) {
            console.error('[SONAR] openclaw models set failed:', err.message);
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
        await sbQuery('hired_receptionists', 'PATCH', { language_model: normalizedModel }, `?id=eq.${req.params.id}`);

        this.events.emit({
          event_type: 'agent_model_changed',
          message: `${agent.name} model → ${normalizedModel}`,
          actor: 'Keagan',
          actor_type: 'user',
          source: 'SONAR_control',
          agent_id: agent.id,
          severity: 'ok',
          payload: { agent: agent.name, model: normalizedModel },
        });

        res.json({ success: true, agent: { ...agent, model: normalizedModel } });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- Agent Call Types (receptionists table) ---
    this.app.post('/api/agents/:id/call-types', async (req, res) => {
      const { call_types } = req.body;
      const validTypes = ['none', 'inbound', 'outbound', 'both'];
      if (!validTypes.includes(call_types)) {
        return res.status(400).json({ error: 'call_types must be one of: ' + validTypes.join(', ') });
      }

      try {
        const r = await sbQuery('hired_receptionists', 'GET', null, `?id=eq.${req.params.id}`) || [];
        if (r.length === 0) return res.status(404).json({ error: 'Receptionist not found' });

        await sbQuery('hired_receptionists', 'PATCH', { call_types }, `?id=eq.${req.params.id}`);

        // Sync voice to ElevenLabs agent when call handling is activated
        const receptionist = r[0];
        if (call_types !== 'none') {
          syncAgentVoice(receptionist.elevenlabs_voice_id, receptionist.full_name);
        } else {
          syncAgentVoice(null, receptionist.full_name);
        }

        res.json({ success: true, call_types });
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

    // --- Webhook endpoint to handle Supabase people table changes ---
    this.app.post(['/api/webhook/leads', '/api/webhook/people'], (req, res) => {
      const { type, record, old_record } = req.body;
      if (!type || !record || !record.id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const personId = record.id;
      const eventType = {
        INSERT: 'lead_created',
        UPDATE: 'lead_updated',
        DELETE: 'lead_deleted',
      }[type];

      const companyName = [record.first_name || old_record?.first_name, record.last_name || old_record?.last_name]
        .filter(Boolean)
        .join(' ') || record.phone || record.email || 'Unknown Person';
      const actorName = (type === 'INSERT' ? record.created_by : (record.updated_by || old_record?.updated_by)) || 'system';

      if (type === 'INSERT') {
        this.events.emit({
          event_type: 'lead_created',
          message: `Created a new person record for ${companyName}`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_people_webhook',
          severity: 'ok',
          payload: { personId, actor: actorName, time: new Date().toISOString() },
        });
        return res.json({ success: true });
      }

      if (type === 'DELETE') {
        this.events.emit({
          event_type: 'lead_deleted',
          message: `Deleted the person record for ${companyName}`,
          actor: actorName,
          actor_type: actorName === 'system' ? 'system' : 'user',
          source: 'supabase_people_webhook',
          severity: 'warning',
          payload: { personId, actor: actorName, time: new Date().toISOString() },
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
        const numericFields = ['missed_call_count', 'balance_due'];
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
          first_name: 'first name',
          last_name: 'last name',
          phone: 'phone number',
          email: 'email',
          street_address: 'street address',
          city: 'city',
          state: 'state',
          zip_code: 'zip code',
          preferred_contact_method: 'preferred contact method',
          preferred_language: 'preferred language',
          best_time_to_contact: 'best time to contact',
          status: 'status',
          source: 'source',
          lead_source_detail: 'source detail',
          tags: 'tags',
          last_inbound_call_at: 'last inbound call',
          last_outbound_call_at: 'last outbound call',
          last_call_status: 'last call status',
          last_intent: 'last intent',
          last_outcome: 'last outcome',
          missed_call_count: 'missed call count',
          last_inbound_sms_at: 'last inbound sms',
          last_outbound_sms_at: 'last outbound sms',
          last_sms_status: 'last sms status',
          last_inbound_email_at: 'last inbound email',
          last_outbound_email_at: 'last outbound email',
          last_email_status: 'last email status',
          callback_needed: 'callback needed',
          callback_due_at: 'callback due',
          handoff_required: 'handoff required',
          assigned_staff: 'assigned staff',
          call_route: 'call route',
          payment_status: 'payment status',
          balance_due: 'balance due',
          invoice_id: 'invoice id',
          notes: 'notes',
          special_instructions: 'special instructions',
          internal_notes: 'internal notes',
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
        source: 'supabase_people_webhook',
        severity: 'ok',
        payload: { personId, actor: actorName, changes: changeParts, time: new Date().toISOString() },
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

    this.app.get('/api/cron', async (req, res) => {
      try {
        const jobs = await sbQuery('cron_jobs', 'GET', null, '?order=next_run_at.asc') || [];
        res.json(jobs);
      } catch (err) {
        res.json([]);
      }
    });

    // Create a new cron job (SONAR + OpenClaw)
    this.app.post('/api/cron', async (req, res) => {
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
        cmd += ` --session main`;
        if (payload_text) {
          cmd += ` --system-event "${payload_text.replace(/"/g, '\\"')}"`;
        }
        cmd += ` --wake now`;
      } else {
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
        const match = output.match(/(?:Created job|jobId)[:\s]+([a-f0-9-]+)/i) || output.match(/([a-f0-9-]{36})/);
        if (match) openclawJobId = match[1];
      } catch (err) {
        openclawError = err.message;
        console.error('[SONAR] OpenClaw cron add failed:', err.message);
      }

      // Save to Supabase
      try {
        const job = await sbQuery('cron_jobs', 'POST', {
          id: jobId,
          name,
          schedule_kind,
          schedule_value,
          payload_kind: 'systemEvent',
          payload_text: payload_text || '',
          session_target: 'main',
          status: 'queued',
          enabled: true,
          assigned_agent: assigned_agent || 'Max',
          department: department || 'Operations',
          next_run_at: nextRunAt,
        });

        this.events.emit({
          event_type: 'cron_created',
          message: `Cron job "${name}" created - ${schedule_kind}: ${schedule_value}`,
          actor: assigned_agent || 'Max',
          actor_type: 'system',
          source: 'SONAR_cron',
          severity: 'ok',
          payload: { jobId, name, schedule_kind, schedule_value, assigned_agent, openclawJobId },
        });

        res.json({ success: true, job: job?.[0] || { id: jobId, name }, openclawJobId, openclawError });
      } catch (err) {
        console.error('[SONAR] Cron insert failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Delete a cron job (SONAR + OpenClaw)
    this.app.delete('/api/cron/:id', async (req, res) => {
      const jobId = req.params.id;
      const { execSync } = require('child_process');

      // Remove from OpenClaw
      let openclawError = null;
      try {
        execSync(`openclaw cron remove ${jobId}`, { encoding: 'utf8', timeout: 10000 });
      } catch (err) {
        openclawError = err.message;
      }

      // Remove from Supabase
      let jobName = jobId;
      try {
        const existing = await sbQuery('cron_jobs', 'GET', null, `?id=eq.${jobId}&select=name`) || [];
        if (existing.length > 0) jobName = existing[0].name;
        await sbQuery('cron_jobs', 'DELETE', null, `?id=eq.${jobId}`);
      } catch (err) {
        console.error('[SONAR] Cron delete failed:', err.message);
      }

      this.events.emit({
        event_type: 'cron_deleted',
        message: `Cron job "${jobName}" deleted`,
        actor: 'Keagan',
        actor_type: 'user',
        source: 'SONAR_cron',
        severity: 'warning',
        payload: { jobId, name: jobName },
      });

      res.json({ success: true, openclawError });
    });

    // Reactions - get counts per agent
    this.app.get('/api/reactions', async (req, res) => {
      try {
        const reactions = await sbQuery('reactions', 'GET', null, '?select=agent_name,reaction_type') || [];
        const counts = {};
        for (const r of reactions) {
          if (!counts[r.agent_name]) counts[r.agent_name] = { agent_name: r.agent_name, compliments: 0, complaints: 0 };
          if (r.reaction_type === 'compliment') counts[r.agent_name].compliments++;
          if (r.reaction_type === 'complaint') counts[r.agent_name].complaints++;
        }
        res.json(Object.values(counts));
      } catch (err) {
        res.json([]);
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
          source: 'SONAR_reactions',
          severity: reaction_type === 'compliment' ? 'ok' : 'warning',
          payload: { agent_name, reaction_type, context },
        });

        const reactions = await sbQuery('reactions', 'GET', null, `?agent_name=eq.${agent_name}&select=reaction_type`) || [];
        const compliments = reactions.filter(r => r.reaction_type === 'compliment').length;
        const complaints = reactions.filter(r => r.reaction_type === 'complaint').length;
        res.json({ success: true, agent_name, compliments, complaints });
      } catch (err) {
        res.json({ success: true, agent_name, compliments: 0, complaints: 0 });
      }
    });

    // ─── Route Tracker (tracks all /api/* hits) ──────────────
    const { createRouteTracker } = require('./routes/tracker');
    this.routeTracker = createRouteTracker(this.app, this.broadcast.bind(this));

    // Routes page endpoints
    this.app.get('/api/routes/recent', (req, res) => {
      res.json(this.routeTracker.getRecent(parseInt(req.query.limit) || 50));
    });

    this.app.get('/api/routes/stats', (req, res) => {
      res.json(this.routeTracker.getStats());
    });

    // ─── Sonar Server Tools API (ElevenLabs server tools) ────
    const { router: toolsRouter, init: initTools } = require('./routes/tools');
    initTools({ sbQuery });
    this.app.use('/api/tools', toolsRouter);

    // ─── Sonar Management API (dashboard CRUD) ───────────────
    const { router: sonarApiRouter, init: initSonarApi } = require('./routes/sonar-api');
    initSonarApi({ sbQuery, eventSystem: this.events });
    this.app.use('/api/sonar', sonarApiRouter);

    // --- Call Router (pre-call resolution middleware) ---
    const callRouter = require('./routes/call-router');
    this.app.use('/api/call', callRouter);
  }

  async _getPipelineData() {
    try {
      const people = await sbQuery('people', 'GET', null, '?select=status') || [];
      const statusMap = {};
      for (const p of people) {
        const s = p.status || 'New';
        statusMap[s] = (statusMap[s] || 0) + 1;
      }

      return {
        stages: [
          { id: 'new', label: 'New', count: statusMap['New'] || 0, color: 'indigo' },
          { id: 'contacted', label: 'Contacted', count: statusMap['Contacted'] || 0, color: 'cyan' },
          { id: 'qualified', label: 'Qualified', count: statusMap['Qualified'] || 0, color: 'fuchsia' },
          { id: 'booked', label: 'Booked', count: statusMap['Booked'] || 0, color: 'amber' },
          { id: 'closed', label: 'Closed', count: statusMap['Closed'] || 0, color: 'green' },
        ],
        totalRelics: people.length,
        qualifiedLeads: (statusMap['Qualified'] || 0) + (statusMap['Booked'] || 0) + (statusMap['Closed'] || 0),
        activeOutreach: (statusMap['Contacted'] || 0) + (statusMap['Qualified'] || 0),
      };
    } catch {
      return { stages: [], totalRelics: 0, qualifiedLeads: 0, activeOutreach: 0 };
    }
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
      this.server.listen(this.port, '127.0.0.1', async () => {
        console.log(`[SONAR] Controller running on http://127.0.0.1:${this.port}`);

        // Start scenario engine
        try {
          await this.scenarioEngine.start();
        } catch (err) {
          console.error('[SONAR] Scenario engine failed to start:', err.message);
        }

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
  }
}

module.exports = { Controller };
