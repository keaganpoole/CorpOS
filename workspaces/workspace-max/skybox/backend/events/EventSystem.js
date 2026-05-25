/**
 * Event System — In-memory event stream + Supabase state updates
 * Events flow through here. Broadcasts to frontend, updates state in Supabase.
 */

class EventSystem {
  constructor(broadcastFn, supabaseHelpers) {
    this.broadcast = broadcastFn || (() => {});
    this.sbQuery = supabaseHelpers?.sbQuery || (() => Promise.resolve());
    this.events = []; // in-memory event buffer
    this.maxEvents = 200;
  }

  /**
   * Main event ingestion method
   */
  emit(event) {
    const record = {
      id: Date.now() + Math.random(),
      event_type: event.event_type,
      severity: event.severity || this._deriveSeverity(event.event_type),
      actor: event.actor || 'system',
      actor_type: event.actor_type || 'system',
      source: event.source || 'controller',
      message: event.message || '',
      task_id: event.task_id || null,
      agent_id: event.agent_id || null,
      payload: event.payload || null,
      timestamp: new Date().toISOString(),
    };

    // Store in memory
    this.events.unshift(record);
    if (this.events.length > this.maxEvents) this.events = this.events.slice(0, this.maxEvents);

    // Process side effects (async, non-blocking)
    this._processEvent(event).catch(err => {
      console.error('[EventSystem] Side effect failed:', err.message);
    });

    // Broadcast to frontend
    this.broadcast({
      type: 'event',
      ...record,
    });

    return { success: true };
  }

  /**
   * Get recent events from memory
   */
  getRecent(limit = 50) {
    return this.events.slice(0, limit);
  }

  async _processEvent(event) {
    const type = event.event_type;

    // Agent events → update agent state in Supabase
    if (type.startsWith('agent_') && event.agent_id) {
      const statusMap = {
        agent_idle: 'idle',
        agent_active: 'active',
        agent_waiting: 'waiting',
        agent_paused: 'paused',
        agent_warning: 'warning',
        agent_error: 'error',
        agent_heartbeat: 'active',
      };
      const newStatus = statusMap[type];
      if (newStatus) {
        try {
          await this.sbQuery('agents', 'PATCH', {
            status: newStatus,
            current_activity: event.message || 'Active',
            last_heartbeat: new Date().toISOString(),
          }, `?id=eq.${event.agent_id}`);
        } catch (err) {
          console.error('[EventSystem] Failed to update agent in Supabase:', err.message);
        }
      }
    }

    // Control events → update state in Supabase
    if (type === 'runtime_paused') {
      try {
        await this.sbQuery('state', 'PATCH', { runtime_mode: 'paused', updated_at: new Date().toISOString() }, '?id=eq.1');
      } catch (err) {
        console.error('[EventSystem] Failed to update state:', err.message);
      }
    } else if (type === 'runtime_resumed') {
      try {
        await this.sbQuery('state', 'PATCH', { runtime_mode: 'running', updated_at: new Date().toISOString() }, '?id=eq.1');
      } catch (err) {
        console.error('[EventSystem] Failed to update state:', err.message);
      }
    } else if (type === 'stage_changed') {
      try {
        await this.sbQuery('state', 'PATCH', { stage: event.payload?.stage || 'code_blue', updated_at: new Date().toISOString() }, '?id=eq.1');
      } catch (err) {
        console.error('[EventSystem] Failed to update state:', err.message);
      }
    } else if (type === 'zone_changed') {
      try {
        await this.sbQuery('state', 'PATCH', { zone: event.payload?.zone || 1, updated_at: new Date().toISOString() }, '?id=eq.1');
      } catch (err) {
        console.error('[EventSystem] Failed to update state:', err.message);
      }
    }
  }

  _deriveSeverity(eventType) {
    if (eventType.includes('failed') || eventType.includes('error')) return 'critical';
    if (eventType.includes('warning')) return 'warning';
    if (eventType.includes('completed') || eventType.includes('resumed')) return 'ok';
    return 'info';
  }
}

module.exports = { EventSystem };
