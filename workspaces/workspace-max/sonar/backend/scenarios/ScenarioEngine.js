/**
 * ScenarioEngine — Central orchestrator for scenario execution
 *
 * Responsibilities:
 * - Load active scenarios from Supabase on startup
 * - Subscribe to EventSystem events and match triggers
 * - Spawn FlowExecutor for matched scenarios
 * - Manage Scheduler for time-based scenarios
 * - Handle flow pause/resume lifecycle
 *
 * Integration:
 *   const engine = new ScenarioEngine({ eventSystem, sbQuery, broadcast, app });
 *   await engine.start();
 */

const { FlowExecutor } = require('./FlowExecutor');
const { Scheduler } = require('./Scheduler');

// Map frontend trigger keys to EventSystem event types
const TRIGGER_EVENT_MAP = {
  incoming_call: 'incoming_call',
  call_answered: 'call_answered',
  missed_call: 'missed_call',
  call_failed: 'call_failed',
  voicemail_received: 'voicemail_received',
  sms_received: 'sms_received',
  sms_sent: 'sms_sent',
  record_updated: 'record_updated',
  record_created: 'record_created',
  record_deleted: 'record_deleted',
  appointment_created: 'appointment_created',
  appointment_updated: 'appointment_updated',
  appointment_cancelled: 'appointment_cancelled',
  appointment_reminder: 'appointment_reminder',
  manual_trigger: 'manual_trigger',
};

class ScenarioEngine {
  constructor(deps) {
    this.eventSystem = deps.eventSystem;
    this.sbQuery = deps.sbQuery;
    this.broadcast = deps.broadcast;
    this.app = deps.app; // Express app for registering routes

    this.scenarios = []; // Active scenarios cache
    this.scheduler = new Scheduler({ sbQuery: deps.sbQuery });
    this.flowExecutor = null;
  }

  /**
   * Start the engine: load scenarios, subscribe to events, register routes
   */
  async start() {
    console.log('[ScenarioEngine] Starting...');

    // Initialize FlowExecutor
    this.flowExecutor = new FlowExecutor({
      sbQuery: this.sbQuery,
      broadcast: this.broadcast,
      onPause: this._onFlowPause.bind(this),
    });

    // Load active scenarios
    await this.loadScenarios();

    // Subscribe to EventSystem events
    this._subscribeToEvents();

    // Schedule time-based scenarios
    await this.scheduler.start(this.scenarios);

    // Register API routes
    this._registerRoutes();

    console.log(`[ScenarioEngine] Running with ${this.scenarios.length} active scenarios`);
  }

  /**
   * Load all active scenarios from Supabase
   */
  async loadScenarios() {
    try {
      const records = await this.sbQuery('scenarios', 'GET', null,
        '?is_active=is.true&status=eq.active&order=created_at.desc'
      );
      this.scenarios = records || [];
      console.log(`[ScenarioEngine] Loaded ${this.scenarios.length} active scenarios`);
    } catch (err) {
      console.error('[ScenarioEngine] Failed to load scenarios:', err.message);
      this.scenarios = [];
    }
  }

  /**
   * Subscribe to EventSystem for trigger matching
   */
  _subscribeToEvents() {
    // Wrap the original emit to intercept events
    const originalEmit = this.eventSystem.emit.bind(this.eventSystem);
    this.eventSystem.emit = (event) => {
      // Run the original emit
      const result = originalEmit(event);

      // Match against scenario triggers (async, non-blocking)
      this._matchAndExecute(event).catch(err => {
        console.error('[ScenarioEngine] Match error:', err.message);
      });

      return result;
    };

    console.log('[ScenarioEngine] Subscribed to EventSystem');
  }

  /**
   * Match an event to scenario triggers and execute matching scenarios
   */
  async _matchAndExecute(event) {
    const eventType = event.event_type;
    if (!eventType) return;

    console.log(`[ScenarioEngine] Received event: "${eventType}", active scenarios: ${this.scenarios.length}`);

    for (const scenario of this.scenarios) {
      const triggerMatch = this._checkTriggerMatch(scenario, eventType, event);
      if (triggerMatch) {
        console.log(`[ScenarioEngine] Event "${eventType}" matched scenario: ${scenario.name}`);

        // Build flow context from event payload
        const flowContext = await this._buildFlowContext(scenario, event);

        // Start the flow
        await this.flowExecutor.start(scenario, event, flowContext);
      }
    }
  }

  /**
   * Check if a scenario's trigger node matches the given event type
   */
  _checkTriggerMatch(scenario, eventType, event) {
    const nodes = typeof scenario.nodes_data === 'string'
      ? JSON.parse(scenario.nodes_data)
      : scenario.nodes_data;

    if (!nodes) return false;

    // Find trigger nodes (configured nodes in the TRIGGERS category)
    const triggerNodes = nodes.filter(n =>
      n.configured && n.categoryType === 'TRIGGERS'
    );

    console.log(`[ScenarioEngine] Found ${triggerNodes.length} trigger nodes in "${scenario.name}"`);
    triggerNodes.forEach(n => {
      const key = n.subOptionKey || n.actionConfig?._key || '';
      console.log(`[ScenarioEngine]   Trigger: ${n.label} subOptionKey=${n.subOptionKey} configured=${n.configured} categoryType=${n.categoryType}`);
    });

    for (const node of triggerNodes) {
      const triggerKey = node.subOptionKey || node.actionConfig?._key || '';
      const expectedEventType = TRIGGER_EVENT_MAP[triggerKey];

      if (expectedEventType === eventType) {
        return true;
      }

      // Also match raw trigger keys (in case event type is the key itself)
      if (triggerKey === eventType) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build flow context by enriching the event payload with Supabase data
   */
  async _buildFlowContext(scenario, event) {
    const context = {
      ...event.payload,
      event_type: event.event_type,
      actor: event.actor,
    };

    // Fetch appointment data if appointment_id is available
    const appointmentId = event.payload?.appointment_id;
    if (appointmentId) {
      try {
        const appointments = await this.sbQuery('appointments', 'GET', null, `?id=eq.${appointmentId}&limit=1`);
        if (appointments?.length > 0) {
          context.appointment = appointments[0];
          if (!context.lead_id && appointments[0].lead_id) context.lead_id = appointments[0].lead_id;
          if (!context.people_id && appointments[0].people_id) context.people_id = appointments[0].people_id;
        }
      } catch (err) {
        console.warn('[ScenarioEngine] Could not fetch appointment:', err.message);
      }
    }

    // Fetch lead data if lead_id is available
    const leadId = context.lead_id || event.payload?.lead_id;
    if (leadId) {
      try {
        const leads = await this.sbQuery('leads', 'GET', null, `?id=eq.${leadId}&limit=1`);
        if (leads?.length > 0) {
          context.lead = leads[0];
          context.customer = leads[0]; // Alias
        }
      } catch (err) {
        console.warn('[ScenarioEngine] Could not fetch lead:', err.message);
      }
    }

    // Fetch person data — lead_id and people_id both point to people table
    const peopleId = context.people_id || context.lead_id || event.payload?.people_id;
    if (peopleId) {
      try {
        const people = await this.sbQuery('people', 'GET', null, `?id=eq.${peopleId}&limit=1`);
        if (people?.length > 0) {
          context.person = people[0];
          context.customer = people[0];
        }
      } catch (err) {
        console.warn('[ScenarioEngine] Could not fetch person:', err.message);
      }
    }

    // Fetch business data — use user_id from event, person, scenario, or created_by
    const userId = event.payload?.user_id
      || context.person?.user_id
      || scenario.user_id
      || scenario.created_by;
    if (userId) {
      try {
        const businesses = await this.sbQuery('businesses', 'GET', null, `?user_id=eq.${userId}&limit=1`);
        if (businesses?.length > 0) {
          context.business = businesses[0];
        }
      } catch (err) {
        console.warn('[ScenarioEngine] Could not fetch business:', err.message);
      }
    }

    // Fetch active receptionist if business is available
    if (context.business) {
      try {
        const receptionists = await this.sbQuery('hired_receptionists', 'GET', null,
          `?user_id=eq.${context.business.user_id}&is_active=is.true&limit=1`
        );
        if (receptionists?.length > 0) {
          context.receptionist = receptionists[0];
        }
      } catch (err) {
        console.warn('[ScenarioEngine] Could not fetch receptionist:', err.message);
      }
    }

    return context;
  }

  /**
   * Called when a flow pauses (async action like call)
   */
  _onFlowPause(executionId, node, context, pauseData) {
    console.log(`[ScenarioEngine] Flow paused at "${node.label}" — execution ${executionId}`);
    // The FlowExecutor already saved the state to Supabase
    // We just need to know when to resume (handled by the resume webhook)
  }

  /**
   * Register API routes for scenario management and flow control
   */
  _registerRoutes() {
    if (!this.app) return;

    const router = require('express').Router();

    /**
     * POST /api/scenarios/resume
     * Resume a paused flow execution (called by ElevenLabs webhook when call ends)
     * Body: { execution_id, agent_data: { email: "...", notes: "..." }, call_sid }
     */
    router.post('/resume', async (req, res) => {
      try {
        const { execution_id, agent_data, call_sid, call_outcome } = req.body;

        if (!execution_id) {
          return res.status(400).json({ error: 'execution_id required' });
        }

        const resumeData = {
          agent: agent_data || {},
          call: { call_sid, call_outcome },
        };

        const result = await this.flowExecutor.resume(execution_id, resumeData);

        if (result.success) {
          res.json({ ok: true, paused: result.paused, completed: result.completed });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (err) {
        console.error('[ScenarioEngine] Resume error:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * POST /api/scenarios/trigger/:scenarioId
     * Manually trigger a scenario (for testing)
     */
    router.post('/trigger/:scenarioId', async (req, res) => {
      try {
        const { scenarioId } = req.params;

        // Always fetch fresh from Supabase
        const records = await this.sbQuery('scenarios', 'GET', null, `?id=eq.${scenarioId}&limit=1`);
        if (!records?.length) {
          return res.status(404).json({ error: 'Scenario not found' });
        }

        const scenario = records[0];
        const event = {
          event_type: 'manual_trigger',
          payload: req.body,
        };
        const flowContext = await this._buildFlowContext(scenario, event);
        const result = await this.flowExecutor.start(scenario, event, flowContext);

        res.json(result);
      } catch (err) {
        console.error('[ScenarioEngine] Manual trigger error:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /api/scenarios/executions
     * List recent flow executions
     */
    router.get('/executions', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const records = await this.sbQuery('flow_executions', 'GET', null,
          `?order=started_at.desc&limit=${limit}`
        );
        res.json(records || []);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /api/scenarios/executions/:id
     * Get a specific execution with full context
     */
    router.get('/executions/:id', async (req, res) => {
      try {
        const records = await this.sbQuery('flow_executions', 'GET', null, `?id=eq.${req.params.id}&limit=1`);
        if (!records?.length) {
          return res.status(404).json({ error: 'Execution not found' });
        }
        res.json(records[0]);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * POST /api/scenarios/reload
     * Reload all active scenarios from Supabase (after config changes)
     */
    router.post('/reload', async (req, res) => {
      await this.loadScenarios();
      await this.scheduler.start(this.scenarios);
      res.json({ ok: true, count: this.scenarios.length });
    });

    this.app.use('/api/scenarios', router);
    console.log('[ScenarioEngine] Routes registered at /api/scenarios/*');
  }

  /**
   * Get the engine status
   */
  getStatus() {
    return {
      active: true,
      scenario_count: this.scenarios.length,
      scenarios: this.scenarios.map(s => ({
        id: s.id,
        name: s.name,
        is_active: s.is_active,
      })),
    };
  }
}

module.exports = { ScenarioEngine };
