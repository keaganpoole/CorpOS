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
      case 'update_record':
        return this._updateRecords(node, flowContext);
      case 'search_records':
        return this._searchRecords(node, flowContext);
      case 'create_new_record':
        return this._createNewRecord(node, flowContext);
      case 'create_payment':
        return this._createPayment(node, flowContext);
      case 'update_payment':
        return this._updatePayment(node, flowContext);
      case 'check_payment_status':
        return this._checkPaymentStatus(node, flowContext);
      case 'issue_refund':
        return this._issueRefund(node, flowContext);
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
      const missionText = (node.actionConfig?.main_content || '').toLowerCase();
      const dynamicVars = {
        user_id: flowContext.business?.user_id || '',
        company_name: flowContext.business?.name || '',
        business_hours: flowContext.business?.business_hours || '',
        receptionist_name: flowContext.receptionist?.first_name || 'Receptionist',
        customer_name: flowContext.customer?.first_name || flowContext.customer?.name || '',
        flow_execution_id: flowContext._executionId || '',
        mission: node.actionConfig?.main_content || '',
        ...flowContext.agent, // Include any agent-captured data from previous calls
        // Include all person/customer fields (auto-adapts when people table schema changes)
        ...(flowContext.person ? Object.fromEntries(
          Object.entries(flowContext.person).filter(([k, v]) => v != null && k !== 'user_id').map(([k, v]) => [`person_${k}`, v])
        ) : {}),
        // Include all appointment fields if the prompt mentions "appointment"
        ...(missionText.includes('appointment') && flowContext.appointment ? Object.fromEntries(
          Object.entries(flowContext.appointment).filter(([k, v]) => v != null).map(([k, v]) => [`appt_${k}`, v])
        ) : {}),
        // Include all payment fields if the prompt mentions payment-related words
        ...((() => {
          const paymentKeywords = ['payment', 'billing', 'card', 'charge', 'refund', 'invoice', 'receipt', 'subscription', 'balance'];
          const needsPaymentData = paymentKeywords.some(kw => missionText.includes(kw));
          return needsPaymentData && flowContext.payment ? Object.fromEntries(
            Object.entries(flowContext.payment).filter(([k, v]) => v != null).map(([k, v]) => [`payment_${k}`, v])
          ) : {};
        })()),
      };

      // Categorized variable descriptions for agent data collection
      const VAR_DESCRIPTIONS = {
        // People / Customer Record fields
        record_id: 'The unique ID of the customer record in the system',
        first_name: 'The customer\'s first name',
        last_name: 'The customer\'s last name',
        email: 'The customer\'s email address',
        notes: 'A brief summary of the conversation and key details discussed',
        special_instructions: 'Any special notes or preferences about this customer',
        best_time_to_contact: 'The best time to reach this customer',
        callback_needed: 'Whether the customer requested a callback (true or false)',
        callback_due_at: 'When the customer asked to be called back',
        status: 'The customer\'s current status (e.g. "active", "inactive")',
        last_call_status: 'The status of this call (e.g. "completed", "voicemail")',
        last_outcome: 'The outcome of the call (e.g. "rescheduled", "cancelled", "no_answer")',
        consent_sms: 'Whether the customer consented to SMS (true or false)',
        consent_call: 'Whether the customer consented to calls (true or false)',
        // Appointment fields
        new_appt_date: 'The date the customer wants to book (YYYY-MM-DD)',
        new_appt_time: 'The time the customer wants to book (HH:MM)',
        new_appt_duration: 'How long the appointment should be in minutes',
        new_appt_service: 'The service or appointment type the customer wants',
        new_appt_client_name: 'The name to book the appointment under',
        cancel_appt_id: 'The ID of the appointment being cancelled',
        update_appt_id: 'The ID of the appointment being updated',
        update_appt_date: 'The new date for the appointment (YYYY-MM-DD)',
        update_appt_time: 'The new time for the appointment (HH:MM)',
      };

      // Categorize extracted variables
      const APPOINTMENT_VARS = new Set(['new_appt_date', 'new_appt_time', 'new_appt_duration', 'new_appt_service', 'new_appt_client_name', 'cancel_appt_id', 'update_appt_id', 'update_appt_date', 'update_appt_time']);
      const PEOPLE_VARS = new Set(['record_id', 'first_name', 'last_name', 'email', 'notes', 'special_instructions', 'best_time_to_contact', 'callback_needed', 'callback_due_at', 'status', 'last_call_status', 'last_outcome', 'consent_sms', 'consent_call']);

      // Default intel values (prevent empty variable errors)
      let intelAppointments = 'No appointment-related data to collect in this call.';
      let intelPeople = 'No customer record data to collect in this call.';

      // Build categorized intel from extracted variables
      const agentVars = this._extractAgentVariables(flowContext._scenario);
      if (agentVars.length > 0) {
        const apptVars = agentVars.filter(v => APPOINTMENT_VARS.has(v));
        const peopleVars = agentVars.filter(v => PEOPLE_VARS.has(v));

        if (apptVars.length > 0) {
          intelAppointments = apptVars.map(v => `- ${v} — ${VAR_DESCRIPTIONS[v] || 'Collect this value'}`).join('\n');
        }
        if (peopleVars.length > 0) {
          intelPeople = peopleVars.map(v => `- ${v} — ${VAR_DESCRIPTIONS[v] || 'Collect this value'}`).join('\n');
        }
      }

      dynamicVars.intel_appointments = intelAppointments;
      dynamicVars.intel_people = intelPeople;

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
      // Support both formats: frontend (target_table + field_* keys) and backend (table + field_mappings)
      const table = (config.target_table || config.table || 'leads').toLowerCase();
      const recordId = this._resolveVariables(config.record_id || '', flowContext);

      if (!recordId) {
        return { success: false, error: 'No record ID specified' };
      }

      // Build update payload — support both field_mappings and flat field_* keys
      const updates = {};
      if (config.field_mappings && Array.isArray(config.field_mappings)) {
        for (const mapping of config.field_mappings) {
          updates[mapping.field] = this._resolveVariables(mapping.value, flowContext);
        }
      } else {
        // Frontend format: flat keys with field_ prefix
        const skipKeys = (key) => key.startsWith('_') || key === 'target_table' || key === 'record_id' || key === 'record_lookup_value';
        for (const [key, value] of Object.entries(config)) {
          if (skipKeys(key) || value == null || value === '') continue;
          const columnKey = key.startsWith('field_') ? key.slice(6) : key;
          updates[columnKey] = this._resolveVariables(String(value), flowContext);
        }
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      updates.updated_at = new Date().toISOString();

      await this.sbQuery(table, 'PATCH', updates, `?id=eq.${recordId}`);

      console.log(`[ActionExecutor] Updated ${table}:${recordId}`, Object.keys(updates));
      return { success: true, data: { table, record_id: recordId, updated_fields: Object.keys(updates), ...updates } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a new record in a Supabase table
   */
  async _createNewRecord(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const table = (config.target_table || config.table || 'leads').toLowerCase();

      // Build insert payload from flat field_* keys
      const data = {};
      const skipKeys = (key) => key.startsWith('_') || key === 'target_table' || key === 'record_id';
      for (const [key, value] of Object.entries(config)) {
        if (skipKeys(key) || value == null || value === '') continue;
        const columnKey = key.startsWith('field_') ? key.slice(6) : key;
        data[columnKey] = this._resolveVariables(String(value), flowContext);
      }

      if (Object.keys(data).length === 0) {
        return { success: false, error: 'No fields to create' };
      }

      data.created_at = new Date().toISOString();
      data.updated_at = data.created_at;

      const result = await this.sbQuery(table, 'POST', data, '?select=id');
      const recordId = Array.isArray(result) ? result[0]?.id : result?.id;

      console.log(`[ActionExecutor] Created ${table}:${recordId}`, Object.keys(data));
      return { success: true, data: { table, record_id: recordId, created_fields: Object.keys(data), ...data } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Search records from a table (for Search Records node)
   */
  async _searchRecords(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const searchConfig = node.searchConfig || {};
      const table = (searchConfig.table || config.table || 'people').toLowerCase();
      const limit = searchConfig.limit || config.limit || 10;
      const userId = searchConfig.user_id || config.user_id || flowContext.business?.user_id || '';

      const baseUrl = `http://127.0.0.1:${process.env.PORT || 7878}`;
      const params = new URLSearchParams({ table, limit: String(limit) });
      if (userId) params.set('user_id', userId);

      const resp = await fetch(`${baseUrl}/api/sonar/search-records?${params.toString()}`);
      const result = await resp.json();

      if (!resp.ok || result.error) {
        return { success: false, error: result.error || 'Search failed' };
      }

      console.log(`[ActionExecutor] Search Records: ${table} → ${result.count} records`);
      return {
        success: true,
        data: {
          action: 'search_records',
          table: result.table,
          records: result.records,
          count: result.count,
        },
      };
    } catch (err) {
      console.error('[ActionExecutor] searchRecords failed:', err.message);
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

  /**
   * Create a payment via Stripe
   */
  async _createPayment(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const amount = this._resolveVariables(config.amount || '', flowContext);
      const description = this._resolveVariables(config.description || '', flowContext);
      const currency = this._resolveVariables(config.currency || 'usd', flowContext);
      const paymentMethod = this._resolveVariables(config.payment_method || 'card', flowContext);

      if (!amount || parseFloat(amount) <= 0) {
        return { success: false, error: 'Invalid payment amount' };
      }

      const baseUrl = `http://127.0.0.1:${process.env.PORT || 7878}`;
      const resp = await fetch(`${baseUrl}/api/sonar/payments/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          people_id: flowContext.person?.id || flowContext.people_id,
          user_id: flowContext.business?.user_id,
          description,
          payment_method: paymentMethod,
          scenario_id: flowContext._scenario?.id,
        }),
      });

      const result = await resp.json();
      if (!resp.ok || result.error) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          action: 'create_payment',
          payment_intent_id: result.payment_intent_id,
          payment_id: result.payment_id,
          client_secret: result.client_secret,
          amount,
          currency,
        },
      };
    } catch (err) {
      console.error('[ActionExecutor] chargeCustomer failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update an existing payment record
   */
  async _updatePayment(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const baseUrl = `http://127.0.0.1:${process.env.PORT || 7878}`;

      // Resolve payment ID from config or flow context
      let paymentId = this._resolveVariables(config.payment_id || '', flowContext);
      if (!paymentId && flowContext.payment?.stripe_payment_intent_id) {
        paymentId = flowContext.payment.stripe_payment_intent_id;
      }
      if (!paymentId) {
        return { success: false, error: 'No payment ID provided for update' };
      }

      const status = this._resolveVariables(config.status || '', flowContext);
      const amount = this._resolveVariables(config.amount || '', flowContext);
      const description = this._resolveVariables(config.description || '', flowContext);
      const notes = this._resolveVariables(config.notes || '', flowContext);

      // If status is refund-related, use the refund endpoint
      if (status === 'refunded' || status === 'partial_refund') {
        const resp = await fetch(`${baseUrl}/api/sonar/payments/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_id: paymentId,
            amount: amount ? parseFloat(amount) : null,
            reason: description || notes || '',
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) {
          return { success: false, error: result.error };
        }
        return {
          success: true,
          data: { action: 'update_payment', status: result.status, refund_id: result.refund_id },
        };
      }

      // Otherwise update the payment record directly via Supabase
      // Find the payment by stripe_payment_intent_id
      const findResp = await fetch(`${baseUrl}/api/sonar/payments/${paymentId}`);
      const findResult = await findResp.json();
      if (!findResp.ok || findResult.error || !findResult.payment) {
        return { success: false, error: 'Payment not found' };
      }

      // Use sbQuery PATCH for the update
      const updateData = {};
      if (status) updateData.status = status;
      if (description) updateData.description = description;

      const resp = await fetch(`${baseUrl}/api/sonar/payments/${findResult.payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      return {
        success: true,
        data: { action: 'update_payment', payment_id: paymentId, status: status || 'updated' },
      };
    } catch (err) {
      console.error('[ActionExecutor] updatePayment failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check payment status
   */
  async _checkPaymentStatus(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const baseUrl = `http://127.0.0.1:${process.env.PORT || 7878}`;

      // Build query params
      const params = new URLSearchParams();
      if (config.search_by === 'Customer Name' && flowContext.person) {
        params.set('people_id', flowContext.person.id);
      } else if (flowContext.payment?.id) {
        // Direct payment lookup
        const resp = await fetch(`${baseUrl}/api/sonar/payments/${flowContext.payment.id}`);
        const result = await resp.json();
        return { success: true, data: { action: 'check_payment_status', payment: result.payment } };
      }
      if (flowContext.business?.user_id) {
        params.set('user_id', flowContext.business.user_id);
      }

      const resp = await fetch(`${baseUrl}/api/sonar/payments?${params.toString()}`);
      const result = await resp.json();

      return {
        success: true,
        data: {
          action: 'check_payment_status',
          payments: result.payments || [],
        },
      };
    } catch (err) {
      console.error('[ActionExecutor] checkPaymentStatus failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Issue refund
   */
  async _issueRefund(node, flowContext) {
    try {
      const config = node.actionConfig || {};
      const baseUrl = `http://127.0.0.1:${process.env.PORT || 7878}`;

      // Payment ID from config (resolved from variable) or from flow context
      let paymentId = this._resolveVariables(config.payment_id || '', flowContext);
      if (!paymentId && flowContext.payment?.id) {
        paymentId = flowContext.payment.id;
      }

      if (!paymentId) {
        return { success: false, error: 'No payment ID provided for refund' };
      }

      const resp = await fetch(`${baseUrl}/api/sonar/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          reason: this._resolveVariables(config.refund_reason || '', flowContext),
        }),
      });

      const result = await resp.json();
      if (!resp.ok || result.error) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          action: 'issue_refund',
          refund_id: result.refund_id,
          status: result.status,
        },
      };
    } catch (err) {
      console.error('[ActionExecutor] issueRefund failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = { ActionExecutor };
