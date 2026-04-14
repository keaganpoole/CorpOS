/**
 * CallEngine — The AI receptionist runtime
 *
 * Takes a caller's phone number and a conversation,
 * produces responses with actions using the LLM + Supabase data.
 */

const { CallerService } = require('./CallerService');
const { ContextLoader } = require('./ContextLoader');

class CallEngine {
  constructor({ supabase, openRouterKey }) {
    this.supabase = supabase;
    this.openRouterKey = openRouterKey;
    this.callerService = new CallerService(supabase);
    this.contextLoader = new ContextLoader(supabase);
    this.sessions = new Map(); // phone -> session state
  }

  /**
   * Start a new call session. Loads caller data + business context.
   */
  async startCall(callerPhone) {
    const caller = await this.callerService.findByPhone(callerPhone);
    const context = await this.contextLoader.loadAll();

    const session = {
      callerPhone,
      caller,           // null if unknown
      context,          // settings, knowledge base, services
      conversation: [], // message history
      state: {
        caller_name: caller ? `${caller.first_name} ${caller.last_name}`.trim() : null,
        caller_first_name: caller?.first_name || null,
        caller_id: caller?.id || null,
        detected_intent: null,
        extracted: {},   // temp data collected during conversation
        actions_taken: [],
        transferred: false,
        call_ended: false,
      },
      startedAt: new Date().toISOString(),
    };

    // Build the initial system prompt
    session.systemPrompt = this._buildSystemPrompt(session);

    this.sessions.set(callerPhone, session);
    return session;
  }

  /**
   * Process one turn of conversation. Returns the AI's response.
   * @param {string} callerPhone
   * @param {string} userMessage — transcribed speech from the caller
   * @returns {{ response: string, actions: Array, state: object }}
   */
  async processMessage(callerPhone, userMessage) {
    const session = this.sessions.get(callerPhone);
    if (!session) throw new Error(`No active call for ${callerPhone}`);

    // Add user message to history
    session.conversation.push({ role: 'user', content: userMessage });

    // Call the LLM
    const llmResponse = await this._callLLM(session);

    // Parse response — could be JSON with actions or plain text
    const parsed = this._parseResponse(llmResponse);

    // Execute any actions
    const actionResults = [];
    if (parsed.actions && parsed.actions.length > 0) {
      for (const action of parsed.actions) {
        const result = await this._executeAction(session, action);
        actionResults.push(result);
      }
    }

    // Add AI response to history
    session.conversation.push({ role: 'assistant', content: parsed.response });

    // Check for call end
    if (parsed.state?.call_ended) {
      await this.endCall(callerPhone);
    }

    return {
      response: parsed.response,
      actions: actionResults,
      state: session.state,
    };
  }

  /**
   * End a call session. Logs everything to Supabase.
   */
  async endCall(callerPhone) {
    const session = this.sessions.get(callerPhone);
    if (!session) return;

    session.state.call_ended = true;
    session.endedAt = new Date().toISOString();
    session.duration = Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000);

    // Write back to people table
    if (session.state.caller_id) {
      await this.callerService.updateAfterCall(session.state.caller_id, {
        last_inbound_call_at: session.endedAt,
        last_intent: session.state.detected_intent,
        last_outcome: session.state.actions_taken.length > 0
          ? session.state.actions_taken.map(a => a.type).join(', ')
          : 'general_inquiry',
      });
    }

    this.sessions.delete(callerPhone);
    return session;
  }

  /**
   * Build the system prompt from context.
   */
  _buildSystemPrompt(session) {
    const { context, caller, state } = session;
    const settings = context.settings || {};
    const knowledge = context.knowledge || {};
    const services = context.services || [];

    const callerInfo = caller
      ? `The caller is ${state.caller_name}. Phone: ${session.callerPhone}. They are an existing contact.`
      : `The caller is calling from ${session.callerPhone}. This is their first call — you don't have their info yet. Ask politely for their name.`;

    const businessHours = settings.business_hours
      ? Object.entries(settings.business_hours)
          .filter(([_, h]) => h.enabled)
          .map(([day, h]) => `${day}: ${h.open} - ${h.close}`)
          .join('\n')
      : 'Business hours not configured.';

    const servicesList = services.length > 0
      ? services.filter(s => s.is_active).map(s => {
          let price = '';
          if (s.price_type === 'free') price = 'Free';
          else if (s.price_type === 'quote') price = 'Free quote';
          else if (s.price_type === 'fixed') price = `$${s.price_min}`;
          else if (s.price_type === 'starting_at') price = `From $${s.price_min}`;
          else if (s.price_type === 'range') price = `$${s.price_min} - $${s.price_max}`;
          if (s.unit && s.price_type !== 'free' && s.price_type !== 'quote') price += ` ${s.unit}`;
          return `- ${s.name}: ${price}${s.description ? ` — ${s.description}` : ''}`;
        }).join('\n')
      : 'No services configured.';

    return `You are ${settings.receptionist_name || 'Sonar'}, the AI receptionist for ${settings.business_name || 'our business'}.

${callerInfo}

BUSINESS INFO:
Address: ${settings.business_address || 'Not provided'}
Phone: ${settings.business_phone || 'Not provided'}
Timezone: ${settings.business_timezone || 'America/New_York'}

BUSINESS HOURS:
${businessHours}

SERVICES & PRICING:
${servicesList}

${knowledge.about ? `ABOUT US:\n${knowledge.about}\n` : ''}
${knowledge.policies ? `POLICIES:\n${knowledge.policies}\n` : ''}
${knowledge.faq ? `FAQ:\n${knowledge.faq}\n` : ''}

YOUR ROLE:
You answer calls, help callers, and take action. You are warm, professional, and efficient — like a real human receptionist.

INTENT DETECTION:
Classify every caller message into one of these intents and track it in state:
- booking: wants to schedule an appointment
- reschedule: wants to move an existing appointment
- cancel: wants to cancel an appointment
- inquiry: asking about services, pricing, hours, location
- complaint: unhappy about something
- status_check: asking about an existing appointment or order
- message: wants to leave a message for someone
- transfer: wants to speak to a human
- general: just chatting or unclear

ACTIONS YOU CAN TAKE:
1. create_appointment — book a new appointment. You need: date, time, client_name. Optional: duration, notes.
2. check_availability — check open slots for a given date.
3. lookup_appointments — find existing appointments for the caller.
4. cancel_appointment — cancel an existing appointment.
5. update_appointment — reschedule or modify an existing appointment.
6. transfer_call — transfer to a human. Provide a reason.
7. take_message — record a message for someone.
8. end_call — end the conversation gracefully.

CRITICAL: You must respond with EXACTLY ONE JSON object. Do NOT provide multiple response options or conditional branches. Do NOT say "If the caller..." — just respond directly to what they said. One response, one JSON object.

RESPONSE FORMAT:
Always respond with a SINGLE JSON object in this format:
{
  "response": "What you say to the caller — ONE response, not multiple options",
  "actions": [],
  "state": {
    "detected_intent": "...",
    "caller_name": "...",
    "call_ended": false
  }
}

The "actions" array contains action objects:
{ "type": "create_appointment", "data": { ... } }

RULES:
- Never make up prices. Use only the services list above.
- If you don't know something, say so honestly and offer to connect them with someone who does.
- If a caller gets frustrated or the situation is complex, offer to transfer to a human.
- Remember what the caller told you earlier in the conversation. Don't ask for the same info twice.
- If it's outside business hours, let them know politely and offer to take a message or schedule a callback.
- Keep responses short and natural — this is spoken conversation, not an essay.
- Never mention you are AI unless directly asked. You are the receptionist.
- When booking appointments, confirm the details back to the caller before finalizing.
- NEVER provide multiple response options or "if the caller says X, then say Y" — just respond to what they actually said.
- Your "response" field is what you literally say to the caller right now. It must be ONE direct response.`;
  }

  /**
   * Call the LLM via OpenRouter.
   */
  async _callLLM(session) {
    const messages = [
      { role: 'system', content: session.systemPrompt },
      ...session.conversation,
    ];

    // Add current state as context for the LLM
    const stateContext = `\n\nCURRENT CALL STATE: ${JSON.stringify(session.state)}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: session.systemPrompt + stateContext },
          ...session.conversation,
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM call failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Parse LLM response. Tries JSON first, falls back to plain text.
   */
  _parseResponse(raw) {
    // Clean up escaped quotes from LLM wrapping
    let cleaned = raw.trim();
    // Remove markdown code block wrapping
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    // Unescape double-escaped quotes
    cleaned = cleaned.replace(/\\"/g, '"');

    // Try to extract JSON
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0];
        // Fix remaining escaped issues
        jsonStr = jsonStr.replace(/\\n/g, '\n');
        const parsed = JSON.parse(jsonStr);
        if (parsed.response) {
          // Update session state
          const session = Array.from(this.sessions.values()).pop();
          if (session && parsed.state) {
            if (parsed.state.detected_intent) session.state.detected_intent = parsed.state.detected_intent;
            if (parsed.state.caller_name) {
              session.state.caller_name = parsed.state.caller_name;
              if (!session.state.caller_first_name) {
                session.state.caller_first_name = parsed.state.caller_name.split(' ')[0];
              }
            }
            if (parsed.state.call_ended) session.state.call_ended = true;
          }
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, fall through
      }
    }

    // Plain text response — no actions
    return {
      response: raw.trim(),
      actions: [],
      state: {},
    };
  }

  /**
   * Execute an action requested by the LLM.
   */
  async _executeAction(session, action) {
    // Clean action type (LLM may add escaped quotes)
    const actionType = (action.type || '').replace(/["\\]/g, '').trim();
    const actionData = action.data || {};
    const result = { type: actionType, success: false, data: null };

    try {
      switch (actionType) {
        case 'create_appointment':
          result.data = await this._createAppointment(session, actionData);
          result.success = true;
          break;

        case 'check_availability':
          result.data = await this._checkAvailability(actionData);
          result.success = true;
          break;

        case 'lookup_appointments':
          result.data = await this._lookupAppointments(session);
          result.success = true;
          break;

        case 'cancel_appointment':
          result.data = await this._cancelAppointment(actionData);
          result.success = true;
          break;

        case 'update_appointment':
          result.data = await this._updateAppointment(actionData);
          result.success = true;
          break;

        case 'transfer_call':
          session.state.transferred = true;
          session.state.transfer_reason = actionData?.reason || 'Caller requested';
          result.success = true;
          break;

        case 'take_message':
          result.data = await this._takeMessage(session, actionData);
          result.success = true;
          break;

        case 'end_call':
          session.state.call_ended = true;
          result.success = true;
          break;

        default:
          result.data = { error: `Unknown action: ${action.type}` };
      }
    } catch (err) {
      result.data = { error: err.message };
    }

    session.state.actions_taken.push(result);
    return result;
  }

  // ─── Action Implementations ───────────────────────────────────────

  async _createAppointment(session, data) {
    const leadId = session.state.caller_id;
    const clientName = data.client_name || session.state.caller_name || 'Unknown';
    const appointment = {
      lead_id: leadId,
      client_name: clientName,
      date: data.date,
      time: data.time,
      duration: data.duration || 30,
      status: data.status || 'confirmed',
      assigned_receptionist: session.context.settings?.receptionist_name || 'Sonar',
      notes: data.notes || '',
    };

    const { data: result, error } = await this.supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async _checkAvailability(data) {
    const date = data.date;
    const duration = data.duration || 30;

    const { data: existing, error } = await this.supabase
      .from('appointments')
      .select('time, duration')
      .eq('date', date)
      .neq('status', 'cancelled');

    if (error) throw error;

    // Simple 30-min slot availability check (8 AM - 6 PM)
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotStart = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const slotEndMinutes = hour * 60 + min + duration;
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMin = slotEndMinutes % 60;

        if (slotEndHour > 18) continue;

        const slotEndTime = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`;

        const isTaken = existing?.some(appt => {
          const apptStart = appt.time;
          const apptEndMinutes = parseInt(appt.time.split(':')[0]) * 60 + parseInt(appt.time.split(':')[1]) + (appt.duration || 30);
          const apptEndHour = Math.floor(apptEndMinutes / 60);
          const apptEndMin = apptEndMinutes % 60;
          const apptEnd = `${String(apptEndHour).padStart(2, '0')}:${String(apptEndMin).padStart(2, '0')}`;

          // Check overlap
          return slotStart < apptEnd && slotEndTime > apptStart;
        });

        if (!isTaken) {
          slots.push(slotStart);
        }
      }
    }

    return { date, available_slots: slots, checked_at: new Date().toISOString() };
  }

  async _lookupAppointments(session) {
    const leadId = session.state.caller_id;
    if (!leadId) return { appointments: [], message: 'No caller ID found' };

    const { data, error } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', leadId)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;
    return { appointments: data || [] };
  }

  async _cancelAppointment(data) {
    const { appointment_id, date, time, lead_id } = data;

    let query = this.supabase.from('appointments').update({ status: 'cancelled' });

    if (appointment_id) {
      query = query.eq('id', appointment_id);
    } else if (lead_id && date) {
      query = query.eq('lead_id', lead_id).eq('date', date);
      if (time) query = query.eq('time', time);
    } else {
      throw new Error('Need appointment_id or lead_id + date to cancel');
    }

    const { data: result, error } = await query.select().single();
    if (error) throw error;
    return result;
  }

  async _updateAppointment(data) {
    const { appointment_id, ...updates } = data;
    if (!appointment_id) throw new Error('appointment_id required for update');

    const { data: result, error } = await this.supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointment_id)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async _takeMessage(session, data) {
    // Store the message on the caller's record
    if (session.state.caller_id && data?.message) {
      const existing = session.context.services?.notes || '';
      const newNote = `[Message ${new Date().toISOString().split('T')[0]}]: ${data.message}`;
      await this.callerService.appendNote(session.state.caller_id, newNote);
    }
    return { taken: true, message: data?.message };
  }
}

module.exports = { CallEngine };
