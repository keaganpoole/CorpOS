/**
 * Server Tools API — /api/tools/*
 * 
 * These endpoints are called by ElevenLabs agents as server tools during live calls.
 * Fast, structured responses. No HTML, no pagination — just the data the LLM needs.
 * 
 * Architecture: Twilio → ElevenLabs Agent → Server Tools → Supabase → Response → ElevenLabs → Caller
 */

const express = require('express');
const router = express.Router();

// ─── Supabase Helpers (injected by controller) ──────────
let sbQuery;
function init(deps) {
  sbQuery = deps.sbQuery;
}

// ─── Helper: normalize phone to E.164 format ────────────
function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    // Assume US if no country code
    if (cleaned.length === 10) cleaned = '+1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = '+' + cleaned;
  }
  return cleaned;
}

// ─── Helper: format appointment for LLM response ────────
function formatAppointment(apt) {
  return {
    id: apt.id,
    date: apt.date,
    time: apt.time,
    duration: apt.duration,
    status: apt.status,
    client_name: apt.client_name,
    receptionist: apt.assigned_receptionist,
    notes: apt.notes,
  };
}

// ══════════════════════════════════════════════════════════
// SERVER TOOLS — Called by ElevenLabs during live calls
// ══════════════════════════════════════════════════════════

/**
 * POST /api/tools/identify-caller
 * 
 * Takes a phone number, returns the customer record and recent appointment history.
 * First thing the agent calls on every inbound call.
 * 
 * Body: { phone: "+12076801233" }
 * Returns: { found: true, customer: {...}, recent_appointments: [...] }
 */
router.post('/identify-caller', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required', found: false });

    const normalized = normalizePhone(phone);

    // Search by phone (try normalized and raw) — encode special chars for Supabase REST
    const enc = encodeURIComponent;
    const people = await sbQuery('people', 'GET', null,
      `?or=(phone.eq.${enc(normalized)},phone.eq.${enc(phone)},phone.eq.${enc(phone.replace(/\D/g, ''))})&order=id.desc&limit=1`
    ) || [];

    if (people.length === 0) {
      return res.json({
        found: false,
        customer: null,
        recent_appointments: [],
        message: 'Caller not found in system',
      });
    }

    const customer = people[0];
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Pull recent appointments for this customer
    const appointments = await sbQuery('appointments', 'GET', null,
      `?lead_id=eq.${customer.id}&order=date.desc&limit=5`
    ) || [];

    res.json({
      found: true,
      customer: {
        id: customer.id,
        name: customerName,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.street_address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip_code,
        preferred_contact: customer.preferred_contact_method,
        notes: customer.notes,
        special_instructions: customer.special_instructions,
        last_intent: customer.last_intent,
        missed_call_count: customer.missed_call_count,
      },
      recent_appointments: appointments.map(formatAppointment),
    });
  } catch (err) {
    console.error('[TOOLS] identify-caller failed:', err.message);
    res.status(500).json({ error: err.message, found: false });
  }
});

/**
 * POST /api/tools/check-availability
 * 
 * Checks appointment calendar for available slots on a given date.
 * Returns conflict-free time slots based on business hours and existing bookings.
 * 
 * Body: { date: "2026-04-15", duration: 30, business_hours: { start: "09:00", end: "17:00" } }
 * Returns: { date: "2026-04-15", available_slots: ["09:00", "09:30", ...], booked_slots: [...], business_hours: {...} }
 */
router.post('/check-availability', async (req, res) => {
  try {
    const { date, duration = 30 } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    // Get business hours from settings
    let businessHours = { start: '09:00', end: '17:00' };
    try {
      const settings = await sbQuery('settings', 'GET', null, '?key=eq.business_hours&limit=1') || [];
      if (settings.length > 0 && settings[0].value) {
        const parsed = typeof settings[0].value === 'string' ? JSON.parse(settings[0].value) : settings[0].value;
        if (parsed.start && parsed.end) businessHours = parsed;
      }
    } catch (_) { /* use defaults */ }

    // Get existing appointments for the date
    const existing = await sbQuery('appointments', 'GET', null,
      `?date=eq.${date}&status=in.(pending,confirmed)&order=time.asc`
    ) || [];

    // Build time slots from business hours
    const slots = [];
    const [startH, startM] = businessHours.start.split(':').map(Number);
    const [endH, endM] = businessHours.end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    for (let m = startMin; m + duration <= endMin; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      // Check if this slot conflicts with any existing appointment
      const slotStart = m;
      const slotEnd = m + duration;
      const hasConflict = existing.some(apt => {
        const [ah, am] = apt.time.split(':').map(Number);
        const aptStart = ah * 60 + am;
        const aptEnd = aptStart + (apt.duration || 30);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      if (!hasConflict) {
        slots.push(timeStr);
      }
    }

    const bookedSlots = existing.map(apt => ({
      time: apt.time,
      duration: apt.duration,
      client_name: apt.client_name,
      status: apt.status,
    }));

    res.json({
      date,
      available_slots: slots,
      booked_slots: bookedSlots,
      business_hours: businessHours,
      slot_duration: duration,
      total_available: slots.length,
    });
  } catch (err) {
    console.error('[TOOLS] check-availability failed:', err.message);
    res.status(500).json({ error: err.message, available_slots: [] });
  }
});

/**
 * POST /api/tools/create-appointment
 * 
 * Books a new appointment. The agent calls this after confirming details with the caller.
 * 
 * Body: {
 *   client_name: "John Smith",
 *   phone: "+12076801233",
 *   date: "2026-04-15",
 *   time: "14:00",
 *   duration: 30,
 *   service: "Consultation",
 *   notes: "First-time caller",
 *   receptionist_id: 5,
 *   lead_id: 123  (optional — will look up or create)
 * }
 * Returns: { success: true, appointment: {...} }
 */
router.post('/create-appointment', async (req, res) => {
  try {
    const { client_name, phone, date, time, duration = 30, service, notes, receptionist_id, lead_id } = req.body;

    if (!client_name || !date || !time) {
      return res.status(400).json({ error: 'client_name, date, and time are required' });
    }

    // Verify no conflict before booking
    const existing = await sbQuery('appointments', 'GET', null,
      `?date=eq.${date}&status=in.(pending,confirmed)`
    ) || [];

    const [reqH, reqM] = time.split(':').map(Number);
    const reqStart = reqH * 60 + reqM;
    const reqEnd = reqStart + duration;

    const conflict = existing.some(apt => {
      const [ah, am] = apt.time.split(':').map(Number);
      const aptStart = ah * 60 + am;
      const aptEnd = aptStart + (apt.duration || 30);
      return reqStart < aptEnd && reqEnd > aptStart;
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Time slot is no longer available',
        conflict: true,
        suggested_action: 'check_availability',
      });
    }

    // Resolve lead_id — use provided, look up by phone, or null
    let resolvedLeadId = lead_id || null;
    if (!resolvedLeadId && phone) {
      const normalized = normalizePhone(phone);
      const people = await sbQuery('people', 'GET', null,
        `?phone=eq.${encodeURIComponent(normalized)}&limit=1`
      ) || [];
      if (people.length > 0) resolvedLeadId = people[0].id;
    }

    // Get receptionist name for confirmation
    let receptionistName = null;
    if (receptionist_id) {
      try {
        const agents = await sbQuery('hired_receptionists', 'GET', null, `?id=eq.${receptionist_id}&limit=1`) || [];
        if (agents.length > 0) receptionistName = agents[0].full_name || agents[0].name;
      } catch (_) { /* skip */ }
    }

    // Insert appointment
    const payload = {
      lead_id: resolvedLeadId,
      client_name,
      date,
      time,
      duration,
      status: 'pending',
      assigned_receptionist: receptionistName,
      notes: notes || null,
    };

    const result = await sbQuery('appointments', 'POST', payload);
    const appointment = result?.[0] || payload;

    res.json({
      success: true,
      appointment: formatAppointment(appointment),
      message: `Appointment booked for ${client_name} on ${date} at ${time}`,
    });
  } catch (err) {
    console.error('[TOOLS] create-appointment failed:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

/**
 * POST /api/tools/update-appointment
 * 
 * Reschedules an existing appointment. Validates the new time slot first.
 * 
 * Body: {
 *   appointment_id: "uuid",
 *   new_date: "2026-04-16",
 *   new_time: "15:00",
 *   reason: "Caller requested reschedule"
 * }
 * Returns: { success: true, appointment: {...}, changes: {...} }
 */
router.post('/update-appointment', async (req, res) => {
  try {
    const { appointment_id, new_date, new_time, reason } = req.body;
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });

    // Fetch current appointment
    const current = await sbQuery('appointments', 'GET', null, `?id=eq.${appointment_id}&limit=1`) || [];
    if (current.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const apt = current[0];
    const changes = {};

    // If new date/time provided, check for conflicts
    if (new_date || new_time) {
      const targetDate = new_date || apt.date;
      const targetTime = new_time || apt.time;
      const duration = apt.duration || 30;

      const existing = await sbQuery('appointments', 'GET', null,
        `?date=eq.${targetDate}&status=in.(pending,confirmed)&id=neq.${appointment_id}`
      ) || [];

      const [reqH, reqM] = targetTime.split(':').map(Number);
      const reqStart = reqH * 60 + reqM;
      const reqEnd = reqStart + duration;

      const conflict = existing.some(other => {
        const [ah, am] = other.time.split(':').map(Number);
        const aptStart = ah * 60 + am;
        const aptEnd = aptStart + (other.duration || 30);
        return reqStart < aptEnd && reqEnd > aptStart;
      });

      if (conflict) {
        return res.status(409).json({
          error: 'New time slot is not available',
          conflict: true,
          current_date: apt.date,
          current_time: apt.time,
        });
      }

      if (new_date && new_date !== apt.date) changes.date = { from: apt.date, to: new_date };
      if (new_time && new_time !== apt.time) changes.time = { from: apt.time, to: new_time };
    }

    // Build update payload
    const updatePayload = {};
    if (changes.date) updatePayload.date = changes.date.to;
    if (changes.time) updatePayload.time = changes.time.to;
    if (reason) updatePayload.notes = (apt.notes ? apt.notes + ' | ' : '') + `Rescheduled: ${reason}`;

    if (Object.keys(updatePayload).length === 0) {
      return res.json({ success: true, appointment: formatAppointment(apt), changes: {}, message: 'No changes requested' });
    }

    const result = await sbQuery('appointments', 'PATCH', updatePayload, `?id=eq.${appointment_id}`);
    const updated = result?.[0] || { ...apt, ...updatePayload };

    res.json({
      success: true,
      appointment: formatAppointment(updated),
      changes,
      message: `Appointment updated for ${apt.client_name}`,
    });
  } catch (err) {
    console.error('[TOOLS] update-appointment failed:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

/**
 * POST /api/tools/cancel-appointment
 * 
 * Cancels an appointment. Sets status to 'cancelled' (soft delete — record preserved for analytics).
 * 
 * Body: { appointment_id: "uuid", reason: "Caller cancelled" }
 * Returns: { success: true, appointment: {...} }
 */
router.post('/cancel-appointment', async (req, res) => {
  try {
    const { appointment_id, reason } = req.body;
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });

    // Fetch current appointment
    const current = await sbQuery('appointments', 'GET', null, `?id=eq.${appointment_id}&limit=1`) || [];
    if (current.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const apt = current[0];

    if (apt.status === 'cancelled') {
      return res.json({ success: true, appointment: formatAppointment(apt), message: 'Appointment was already cancelled' });
    }

    const updatePayload = { status: 'cancelled' };
    if (reason) updatePayload.notes = (apt.notes ? apt.notes + ' | ' : '') + `Cancelled: ${reason}`;

    const result = await sbQuery('appointments', 'PATCH', updatePayload, `?id=eq.${appointment_id}`);
    const updated = result?.[0] || { ...apt, ...updatePayload };

    res.json({
      success: true,
      appointment: formatAppointment(updated),
      message: `Appointment for ${apt.client_name} on ${apt.date} at ${apt.time} has been cancelled`,
    });
  } catch (err) {
    console.error('[TOOLS] cancel-appointment failed:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

/**
 * POST /api/tools/lookup-customer
 * 
 * Searches for a customer by name, email, or phone. Used when the caller
 * isn't found by phone alone or when the receptionist needs to look up someone else.
 * 
 * Body: { name?: "Smith", email?: "john@example.com", phone?: "+1207..." }
 * Returns: { customers: [...], count: number }
 */
router.post('/lookup-customer', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name && !email && !phone) {
      return res.status(400).json({ error: 'At least one search field required (name, email, phone)' });
    }

    const filters = [];
    if (phone) {
      const normalized = normalizePhone(phone);
      filters.push(`phone=eq.${encodeURIComponent(normalized)}`);
    }
    if (email) filters.push(`email=eq.${encodeURIComponent(email.toLowerCase())}`);
    if (name) filters.push(`or=(first_name.ilike.%25${name}%25,last_name.ilike.%25${name}%25)`);

    const query = '?' + filters.join('&') + '&limit=10';
    const results = await sbQuery('people', 'GET', null, query) || [];

    const customers = results.map(p => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
      email: p.email,
      city: p.city,
      state: p.state,
    }));

    res.json({
      customers,
      count: customers.length,
      query: { name, email, phone },
    });
  } catch (err) {
    console.error('[TOOLS] lookup-customer failed:', err.message);
    res.status(500).json({ error: err.message, customers: [] });
  }
});

/**
 * GET /api/tools/get-services
 * 
 * Returns all active services from the business. Agent uses this to answer
 * pricing and service questions during calls.
 * 
 * Returns: { services: [...], count: number }
 */
router.get('/get-services', async (req, res) => {
  try {
    const services = await sbQuery('services', 'GET', null,
      '?is_active=eq.true&order=sort_order.asc,name.asc'
    ) || [];

    const formatted = services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price_type: s.price_type,
      price_display: formatPrice(s),
      category: s.category,
    }));

    res.json({ services: formatted, count: formatted.length });
  } catch (err) {
    console.error('[TOOLS] get-services failed:', err.message);
    res.status(500).json({ error: err.message, services: [] });
  }
});

function formatPrice(s) {
  switch (s.price_type) {
    case 'fixed': return `$${s.price_min}`;
    case 'starting_at': return `Starting at $${s.price_min}`;
    case 'range': return `$${s.price_min} - $${s.price_max}`;
    case 'quote': return 'Free quote';
    case 'free': return 'Free';
    default: return 'Call for pricing';
  }
}

/**
 * POST /api/tools/get-business-info
 * 
 * Returns knowledge base content for the agent to use during calls.
 * 
 * Body: { section?: "about" | "services" | "policies" | "faq" }
 * Returns: { business_name, phone, hours, knowledge_base: {...} }
 */
router.post('/get-business-info', async (req, res) => {
  try {
    const { section } = req.body || {};

    // Fetch business settings
    let settings = {};
    try {
      const rows = await sbQuery('settings', 'GET', null, '?order=key.asc') || [];
      for (const row of rows) {
        settings[row.key] = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return row.value; } })() : row.value;
      }
    } catch (_) { /* return defaults */ }

    // Build knowledge base from settings
    const knowledgeBase = {
      about: settings.kb_about || settings.about_us || '',
      services: settings.kb_services || settings.services_info || '',
      policies: settings.kb_policies || settings.policies || '',
      faq: settings.kb_faq || settings.faq || '',
    };

    // If section requested, return only that section
    if (section && knowledgeBase[section] !== undefined) {
      return res.json({
        business_name: settings.business_name || settings.name || '',
        section,
        content: knowledgeBase[section],
      });
    }

    // Return everything
    res.json({
      business_name: settings.business_name || settings.name || '',
      phone: settings.phone || '',
      email: settings.email || '',
      address: settings.address || '',
      hours: settings.business_hours || settings.hours || {},
      timezone: settings.timezone || 'America/New_York',
      knowledge_base: knowledgeBase,
    });
  } catch (err) {
    console.error('[TOOLS] get-business-info failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tools/log-call-outcome
 * 
 * Logs the result of a call for analytics. Called by the agent at end of each call.
 * 
 * Body: {
 *   caller_phone: "+12076801233",
 *   caller_name: "John Smith",
 *   caller_id: 123,
 *   receptionist_id: 5,
 *   scenario_id: "uuid",
 *   outcome: "booked" | "modified" | "cancelled" | "info_only" | "transferred" | "no_answer" | "missed",
 *   appointment_id: "uuid",
 *   duration_seconds: 180,
 *   notes: "Called to book appointment",
 *   raw_transcript: [...]
 * }
 * Returns: { success: true, call_log: {...} }
 */
router.post('/log-call-outcome', async (req, res) => {
  try {
    const {
      caller_phone, caller_name, caller_id, receptionist_id, scenario_id,
      outcome, appointment_id, duration_seconds, notes, raw_transcript
    } = req.body;

    const validOutcomes = ['booked', 'modified', 'cancelled', 'info_only', 'transferred', 'no_answer', 'missed'];
    if (outcome && !validOutcomes.includes(outcome)) {
      return res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    }

    // Auto-resolve caller_id from phone if not provided
    let resolvedCallerId = caller_id || null;
    if (!resolvedCallerId && caller_phone) {
      const normalized = normalizePhone(caller_phone);
      const people = await sbQuery('people', 'GET', null, `?phone=eq.${encodeURIComponent(normalized)}&limit=1`) || [];
      if (people.length > 0) resolvedCallerId = people[0].id;
    }

    const payload = {
      caller_phone: caller_phone || null,
      caller_name: caller_name || null,
      caller_id: resolvedCallerId,
      receptionist_id: receptionist_id || null,
      scenario_id: scenario_id || null,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: duration_seconds || null,
      outcome: outcome || 'info_only',
      appointment_id: appointment_id || null,
      notes: notes || null,
      raw_transcript: raw_transcript ? JSON.stringify(raw_transcript) : null,
    };

    const result = await sbQuery('call_logs', 'POST', payload);
    const log = result?.[0] || payload;

    res.json({
      success: true,
      call_log: {
        id: log.id,
        caller_name: log.caller_name,
        caller_phone: log.caller_phone,
        outcome: log.outcome,
        duration_seconds: log.duration_seconds,
        appointment_id: log.appointment_id,
      },
    });
  } catch (err) {
    console.error('[TOOLS] log-call-outcome failed:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

/**
 * POST /api/tools/transfer-call
 * 
 * Signals that the call needs human transfer. Returns the business's forwarding number.
 * 
 * Body: { reason: "Caller wants to speak with manager", caller_phone: "+1..." }
 * Returns: { transfer: true, forwarding_number: "+1...", message: "..." }
 */
router.post('/transfer-call', async (req, res) => {
  try {
    const { reason } = req.body;

    // Get forwarding number from settings
    let forwardingNumber = null;
    try {
      const settings = await sbQuery('settings', 'GET', null, '?key=eq.forwarding_number&limit=1') || [];
      if (settings.length > 0) forwardingNumber = settings[0].value;
    } catch (_) { /* no forwarding configured */ }

    res.json({
      transfer: true,
      forwarding_number: forwardingNumber,
      reason: reason || 'Caller requested transfer',
      message: forwardingNumber
        ? 'Transferring you now. Please hold.'
        : 'I apologize, but I don\'t have a transfer number configured. Let me take a message.',
    });
  } catch (err) {
    console.error('[TOOLS] transfer-call failed:', err.message);
    res.status(500).json({ error: err.message, transfer: false });
  }
});

module.exports = { router, init };
