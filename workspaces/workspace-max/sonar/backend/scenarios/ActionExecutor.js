/**
 * ActionExecutor — Executes action nodes in a scenario flow
 *
 * Handles: SMS, calls, record updates, hangup, transfers
 * Returns result object with status and any data for the flow context
 */

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

class ActionExecutor {
  constructor(deps) {
    this.sbQuery = deps.sbQuery;       // Supabase query function
    this.broadcast = deps.broadcast;   // WebSocket broadcast function
    this.getFlowContext = deps.getFlowContext; // () => current flow context
  }

  /**
   * Execute an action node.
   * Returns: { success: boolean, pause?: boolean, data?: object, error?: string }
   */
  async execute(node, flowContext) {
    const label = node.label || node.actionConfig?._key || 'unknown';
    console.log(`[ActionExecutor] Executing: ${label} (type: ${node.type})`);

    switch (node.type) {
      case 'action': {
        const key = node.actionConfig?._key || node.subOptionKey;
        return this._executeAction(key, node, flowContext);
      }
      case 'end_call':
        return { success: true, data: { action: 'end_call' } };
      default:
        console.warn(`[ActionExecutor] Unknown node type: ${node.type}`);
        return { success: false, error: `Unknown node type: ${node.type}` };
    }
  }

  /**
   * Execute an action by its key.
   */
  async _executeAction(key, node, flowContext) {
    switch (key) {
      case 'send_to_customer':
        console.log('[ActionExecutor] SMS not configured yet — skipping');
        return { success: true, data: { action: 'send_to_customer', skipped: true, reason: 'SMS not configured' } };
      case 'call_customer':
        return this._initiateCall(node, flowContext);
      case 'hang_up':
        return { success: true, data: { action: 'hang_up' } };
      case 'transfer_to_phone_number':
        return this._transferCall(node, flowContext);
      case 'update_appointment':
      case 'create_appointment':
        return this._handleAppointment(key, node, flowContext);
      case 'update_lead_status':
        return this._updateLeadStatus(node, flowContext);
      case 'update_records':
        return this._updateRecords(node, flowContext);
      default:
        console.warn(`[ActionExecutor] Unknown action key: ${key}`);
        return { success: false, error: `Unknown action: ${key}` };
    }
  }

  /**
   * Send SMS via Twilio
   */
  async _sendSMS(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      let message = config.message || '';
      let toNumber = config.to_phone || flowContext.lead?.phone || flowContext.customer?.phone;

      // Resolve agent variables in message
      message = this._resolveVariables(message, flowContext);

      if (!toNumber) {
        return { success: false, error: 'No phone number for SMS' };
      }

      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioSid || !twilioToken || !twilioFrom) {
        console.error('[ActionExecutor] Twilio credentials not configured');
        return { success: false, error: 'Twilio not configured' };
      }

      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams({
        To: toNumber,
        From: twilioFrom,
        Body: message,
      });

      const res = await fetch(`${TWILIO_API_BASE}/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Twilio error: ${res.status} ${text}` };
      }

      const result = await res.json();
      console.log(`[ActionExecutor] SMS sent: ${result.sid}`);
      return { success: true, data: { message_sid: result.sid, to: toNumber, body: message } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Initiate outbound call via ElevenLabs
   * This is an async action — the flow pauses and resumes via webhook
   */
  async _initiateCall(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      console.log('[ActionExecutor] Call context:', { 
        to_phone: config.to_phone, 
        customer_phone: flowContext.customer?.phone,
        person_phone: flowContext.person?.phone,
        has_customer: !!flowContext.customer,
        customer_keys: flowContext.customer ? Object.keys(flowContext.customer) : []
      });
      let toNumber = config.to_phone || flowContext.customer?.phone || flowContext.person?.phone;

      if (!toNumber) {
        return { success: false, error: 'No phone number for call' };
      }

      const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
      const agentId = process.env.ELEVENLABS_AGENT_ID_OUTBOUND;

      if (!elevenlabsKey || !agentId) {
        return { success: false, error: 'ElevenLabs not configured' };
      }

      // Build dynamic variables for the agent from flow context
      const dynamicVars = {
        user_id: flowContext.business?.user_id || '',
        company_name: flowContext.business?.name || '',
        business_hours: flowContext.business?.business_hours || '',
        receptionist_name: flowContext.receptionist?.first_name || 'Receptionist',
        customer_name: flowContext.customer?.first_name || flowContext.customer?.name || '',
        flow_execution_id: flowContext._executionId || '',
        mission: node.actionConfig?.main_content || '',
        ...flowContext.agent, // Include any agent-captured data from previous calls
      };

      // Load core prompt — mission plugs in via {{mission}} dynamic variable
      const fs = require('fs');
      const path = require('path');
      let corePrompt = '';
      try {
        corePrompt = fs.readFileSync(path.join(__dirname, '..', 'elevenlabs', 'core_prompt_outbound.txt'), 'utf8');
      } catch (e) {
        console.warn('[ActionExecutor] Could not load core_prompt_outbound.txt:', e.message);
      }

      // Build prompt additions for agent variable capture
      const agentVars = this._extractAgentVariables(flowContext._scenario);
      if (agentVars.length > 0) {
        const varList = agentVars.map(v => `- ${v}: collect this from the call`).join('\n');
        dynamicVars._scenario_prompt = `\nDuring this call, collect the following data:\n${varList}\nUse the set_agent_data tool to record each value.`;
      }

      const res = await fetch(`${ELEVENLABS_API}/convai/twilio/outbound-call`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID || '',
          to_number: toNumber,
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: corePrompt,
              },
            },
          },
          conversation_initiation_client_data: {
            dynamic_variables: dynamicVars,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `ElevenLabs error: ${res.status} ${text}` };
      }

      const result = await res.json();
      console.log(`[ActionExecutor] Call initiated: ${result.conversation_id || result.call_id || 'unknown'}`);

      // Pause the flow — it will resume when the call ends (webhook callback)
      return {
        success: true,
        pause: true,
        data: {
          call_id: result.conversation_id || result.call_id,
          to: toNumber,
          initiated_at: new Date().toISOString(),
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Transfer call via Twilio
   */
  async _transferCall(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const toNumber = config.to_phone;
      const currentCallSid = flowContext.call?.call_sid;

      if (!toNumber) {
        return { success: false, error: 'No transfer phone number' };
      }

      if (currentCallSid) {
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

        const params = new URLSearchParams({
          Url: `<Response><Dial><Number>${toNumber}</Number></Dial></Response>`,
          Method: 'POST',
        });

        await fetch(
          `${TWILIO_API_BASE}/Accounts/${twilioSid}/Calls/${currentCallSid}.json`,
          { method: 'POST', headers: { 'Authorization': `Basic ${auth}` }, body: params.toString() }
        );
      }

      return { success: true, data: { transferred_to: toNumber } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Update lead status
   */
  async _updateLeadStatus(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const newStatus = this._resolveVariables(config.status || '', flowContext);
      const leadId = flowContext.lead?.id;

      if (!leadId) {
        return { success: false, error: 'No lead ID in flow context' };
      }

      await this.sbQuery('leads', 'PATCH', {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }, `?id=eq.${leadId}`);

      console.log(`[ActionExecutor] Lead ${leadId} status → ${newStatus}`);
      return { success: true, data: { lead_id: leadId, status: newStatus } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Update records in a Supabase table
   */
  async _updateRecords(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const table = config.table || 'leads';
      const recordId = this._resolveVariables(config.record_id || '', flowContext);

      if (!recordId) {
        return { success: false, error: 'No record ID specified' };
      }

      // Build update payload from configured field mappings
      const updates = {};
      if (config.field_mappings && Array.isArray(config.field_mappings)) {
        for (const mapping of config.field_mappings) {
          updates[mapping.field] = this._resolveVariables(mapping.value, flowContext);
        }
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      updates.updated_at = new Date().toISOString();

      await this.sbQuery(table, 'PATCH', updates, `?id=eq.${recordId}`);

      console.log(`[ActionExecutor] Updated ${table}:${recordId}`, Object.keys(updates));
      return { success: true, data: { table, record_id: recordId, updated_fields: Object.keys(updates) } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle appointment actions
   */
  async _handleAppointment(actionKey, node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const appointmentConfig = node.appointmentConfig || {};

      if (actionKey === 'create_appointment') {
        const appointment = {
          lead_id: flowContext.lead?.id || null,
          client_name: this._resolveVariables(appointmentConfig.client_name || config.client_name || '', flowContext),
          date: this._resolveVariables(appointmentConfig.date || config.date || '', flowContext),
          time: this._resolveVariables(appointmentConfig.time || config.time || '', flowContext),
          duration: appointmentConfig.duration || config.duration || 30,
          status: 'pending',
          assigned_receptionist: appointmentConfig.assigned_receptionist || config.assigned_receptionist || '',
          notes: this._resolveVariables(appointmentConfig.notes || config.notes || '', flowContext),
          user_id: flowContext.business?.user_id || '',
          created_at: new Date().toISOString(),
        };

        const result = await this.sbQuery('appointments', 'POST', appointment);
        console.log(`[ActionExecutor] Appointment created: ${result?.[0]?.id}`);
        return { success: true, data: result?.[0] };
      }

      return { success: false, error: `Unhandled appointment action: ${actionKey}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Resolve {{variable}} placeholders in a string using flow context
   */
  _resolveVariables(text, flowContext) {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const parts = key.trim().split('.');
      let value = flowContext;
      for (const part of parts) {
        if (value == null) return match;
        value = value[part];
      }
      return value != null ? String(value) : match;
    });
  }

  /**
   * Extract agent variable names from a scenario's graph
   * Looks for {{agent.*}} references in node action configs
   */
  _extractAgentVariables(scenario) {
    if (!scenario?.nodes_data) return [];
    const vars = new Set();
    const nodes = typeof scenario.nodes_data === 'string'
      ? JSON.parse(scenario.nodes_data)
      : scenario.nodes_data;

    for (const node of nodes) {
      const config = node.actionConfig || node.appointmentConfig || node.scheduleConfig || {};
      for (const val of Object.values(config)) {
        if (typeof val === 'string') {
          const matches = val.matchAll(/\{\{agent\.([^}]+)\}\}/g);
          for (const m of matches) {
            vars.add(m[1].trim());
          }
        }
      }
    }

    return [...vars];
  }
}

module.exports = { ActionExecutor };
