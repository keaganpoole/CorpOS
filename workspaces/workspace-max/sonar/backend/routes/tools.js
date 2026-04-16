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
 * Takes a phone number (and optional called_number), returns the customer record,
 * business context, and recent appointment history.
 * First thing the agent calls on every inbound call.
 * 
 * Body: { phone: "+12076801233", called_number: "+12075550199" }
 * Returns: { found: true, customer: {...}, business: {...}, receptionist: {...}, recent_appointments: [...] }
 */
router.post('/identify-caller', async (req, res) => {
  try {
    const { phone, called_number } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required', found: false });

    // Step 1: Resolve business via called_number → user_id
    let business = null;
    let receptionist = null;
    let userId = null;

    if (called_number) {
      const enc = encodeURIComponent;
      const bizRows = await sbQuery('businesses', 'GET', null,
        `?phone=eq.${enc(called_number)}&limit=1`
      ) || [];

      if (bizRows.length > 0) {
        business = bizRows[0];
        userId = business.user_id;

        // Find the active inbound receptionist for this business
        const repRows = await sbQuery('hired_receptionists', 'GET', null,
          `?user_id=eq.${userId}&call_types=in.(inbound,both)&is_active=is.true&limit=1`
        ) || [];

        if (repRows.length > 0) {
          receptionist = repRows[0];
        }
      }
    }

    // Step 2: Look up caller — scope by user_id if available
    const normalized = normalizePhone(phone);
    const enc = encodeURIComponent;
    let peopleFilter = `?or=(phone.eq.${enc(normalized)},phone.eq.${enc(phone)},phone.eq.${enc(phone.replace(/\D/g, ''))})`;
    if (userId) {
      peopleFilter += `&user_id=eq.${userId}`;
    }
    peopleFilter += '&order=id.desc&limit=1';

    const people = await sbQuery('people', 'GET', null, peopleFilter) || [];

    if (people.length === 0) {
      return res.json({
        found: false,
        customer: null,
        business: business ? { name: business.name, phone: business.phone, hours: business.hours } : null,
        receptionist: receptionist ? { name: receptionist.first_name, personality: receptionist.description, role: receptionist.stereotype } : null,
        recent_appointments: [],
        message: 'Caller not found in system',
      });
    }

    const customer = people[0];
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Pull recent appointments for this customer, scoped by user_id
    let aptFilter = `?lead_id=eq.${customer.id}&order=date.desc&limit=5`;
    if (userId) {
      aptFilter += `&user_id=eq.${userId}`;
    }
    const appointments = await sbQuery('appointments', 'GET', null, aptFilter) || [];

    res.json({
      found: true,
      user_id: userId,
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
      business: business ? { name: business.name, phone: business.phone, hours: business.hours } : null,
      receptionist: receptionist ? { name: receptionist.first_name, personality: receptionist.description, role: receptionist.stereotype } : null,
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
 * Body: { date: "2026-04-15", duration: 30, user_id: "uuid" }
 * Returns: { date: "2026-04-15", available_slots: ["09:00", "09:30", ...], booked_slots: [...], business_hours: {...} }
 */
router.post('/check-availability', async (req, res) => {
  try {
    const { date, duration = 30, user_id } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    // Get business hours from businesses table
    let businessHours = { start: '09:00', end: '17:00' };
    try {
      let bizFilter = '?limit=1';
      if (user_id) bizFilter += `&user_id=eq.${user_id}`;
      const bizRows = await sbQuery('businesses', 'GET', null, bizFilter) || [];
      if (bizRows.length > 0 && bizRows[0].hours) {
        // Parse hours string like "Mon-Fri 9:00 AM - 7:00 PM, Sat 9:00 AM - 5:00 PM, Sun Closed"
        // Default to Mon-Fri hours for availability
        const hoursStr = bizRows[0].hours;
        const match = hoursStr.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (match) {
          const parseTime = (t) => {
            const [time, period] = t.trim().split(/\s+/);
            let [h, m] = time.split(':').map(Number);
            if (period && period.toUpperCase() === 'PM' && h !== 12) h += 12;
            if (period && period.toUpperCase() === 'AM' && h === 12) h = 0;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };
          businessHours = { start: parseTime(match[1]), end: parseTime(match[2]) };
        }
      }
    } catch (_) { /* use defaults */ }

    // Get existing appointments for the date, scoped by user_id
    let aptFilter = `?date=eq.${date}&status=in.(pending,confirmed)&order=time.asc`;
    if (user_id) aptFilter += `&user_id=eq.${user_id}`;
    const existing = await sbQuery('appointments', 'GET', null, aptFilter) || [];

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
 *   lead_id: 123,  (optional — will look up or create)
 *   user_id: "uuid"  (optional — business context)
 * }
 * Returns: { success: true, appointment: {...} }
 */
router.post('/create-appointment', async (req, res) => {
  try {
    const { client_name, phone, date, time, duration = 30, service, notes, receptionist_id, lead_id, user_id } = req.body;

    if (!client_name || !date || !time) {
      return res.status(400).json({ error: 'client_name, date, and time are required' });
    }

    // Verify no conflict before booking, scoped by user_id
    let conflictFilter = `?date=eq.${date}&status=in.(pending,confirmed)`;
    if (user_id) conflictFilter += `&user_id=eq.${user_id}`;
    const existing = await sbQuery('appointments', 'GET', null, conflictFilter) || [];

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
      user_id: user_id || null,
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
 *   date?: "2026-04-16",       // accepts 'date' or 'new_date'
 *   time?: "15:00",             // accepts 'time' or 'new_time'
 *   duration?: 45,
 *   notes?: "updated notes",
 *   reason?: "Caller requested reschedule"
 * }
 * Returns: { success: true, appointment: {...}, changes: {...} }
 */
router.post('/update-appointment', async (req, res) => {
  try {
    const { appointment_id, new_date, new_time, reason } = req.body;
    // Accept both naming conventions: 'date' or 'new_date', 'time' or 'new_time'
    const date = req.body.date || new_date;
    const time = req.body.time || new_time;
    const { duration, notes } = req.body;
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });

    // Fetch current appointment
    const current = await sbQuery('appointments', 'GET', null, `?id=eq.${appointment_id}&limit=1`) || [];
    if (current.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const apt = current[0];
    const changes = {};

    // If new date/time provided, check for conflicts
    if (date || time) {
      const targetDate = date || apt.date;
      const targetTime = time || apt.time;
      const targetDuration = duration || apt.duration || 30;

      const existing = await sbQuery('appointments', 'GET', null,
        `?date=eq.${targetDate}&status=in.(pending,confirmed)&id=neq.${appointment_id}`
      ) || [];

      const [reqH, reqM] = targetTime.split(':').map(Number);
      const reqStart = reqH * 60 + reqM;
      const reqEnd = reqStart + targetDuration;

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

      if (date && date !== apt.date) changes.date = { from: apt.date, to: date };
      if (time && time !== apt.time) changes.time = { from: apt.time, to: time };
    }

    if (duration && duration !== apt.duration) {
      changes.duration = { from: apt.duration, to: duration };
    }
    if (notes !== undefined && notes !== apt.notes) {
      changes.notes = { from: apt.notes, to: notes };
    }

    // Build update payload
    const updatePayload = {};
    if (changes.date) updatePayload.date = changes.date.to;
    if (changes.time) updatePayload.time = changes.time.to;
    if (changes.duration) updatePayload.duration = changes.duration.to;
    if (changes.notes) updatePayload.notes = changes.notes.to;
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
 * Body: { name?: "Smith", email?: "john@example.com", phone?: "+1207...", user_id?: "uuid" }
 * Returns: { customers: [...], count: number }
 */
router.post('/lookup-customer', async (req, res) => {
  try {
    const { name, email, phone, user_id } = req.body;
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
    if (user_id) filters.push(`user_id=eq.${user_id}`);

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
 * POST /api/tools/update-customer
 * 
 * Updates customer info in the people table. Use when the caller wants to
 * update their contact details (phone, email, address, etc.).
 * 
 * Body: { customer_id: 123, name?: "...", phone?: "...", email?: "...", 
 *         street_address?: "...", city?: "...", state?: "...", zip_code?: "...",
 *         preferred_contact_method?: "...", notes?: "...", special_instructions?: "...",
 *         user_id?: "uuid" }
 * Returns: { success: true, customer: {...} }
 */
router.post('/update-customer', async (req, res) => {
  try {
    const { customer_id, user_id, ...updates } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

    const allowedFields = [
      'first_name', 'last_name', 'phone', 'email',
      'street_address', 'city', 'state', 'zip_code',
      'preferred_contact_method', 'notes', 'special_instructions',
      'last_intent'
    ];

    const payload = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) payload[field] = updates[field];
    }

    // Handle full_name → first_name/last_name splitting
    if (updates.name && !updates.first_name && !updates.last_name) {
      const parts = updates.name.trim().split(/\s+/);
      if (parts.length === 1) {
        payload.first_name = parts[0];
      } else {
        payload.first_name = parts[0];
        payload.last_name = parts.slice(1).join(' ');
      }
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    let filter = `?id=eq.${customer_id}`;
    if (user_id) filter += `&user_id=eq.${user_id}`;

    const result = await sbQuery('people', 'PATCH', payload, filter);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result[0];
    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        phone: customer.phone,
        email: customer.email,
        address: customer.street_address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip_code,
      },
    });
  } catch (err) {
    console.error('[TOOLS] update-customer failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tools/create-customer
 * 
 * Creates a new customer in the people table. Use when an unknown caller
 * wants to book an appointment or needs to be added to the system.
 * 
 * Body: { name: "John Smith", phone: "+1207...", email?: "...", 
 *         street_address?: "...", city?: "...", state?: "...", zip_code?: "...",
 *         user_id?: "uuid" }
 * Returns: { success: true, customer: {...} }
 */
router.post('/create-customer', async (req, res) => {
  try {
    const { name, phone, email, street_address, city, state, zip_code, user_id } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

    const normalized = normalizePhone(phone);
    const enc = encodeURIComponent;
    const existing = await sbQuery('people', 'GET', null,
      `?or=(phone.eq.${enc(normalized)},phone.eq.${enc(phone)},phone.eq.${enc(phone.replace(/\D/g, ''))})&limit=1`
    ) || [];

    if (existing.length > 0) {
      return res.json({
        success: true,
        customer: {
          id: existing[0].id,
          name: [existing[0].first_name, existing[0].last_name].filter(Boolean).join(' '),
          phone: existing[0].phone,
          email: existing[0].email,
        },
        message: 'Customer already exists',
      });
    }

    const parts = name.trim().split(/\s+/);
    const first_name = parts[0] || '';
    const last_name = parts.length > 1 ? parts.slice(1).join(' ') : '';

    const payload = {
      first_name,
      last_name,
      phone: normalized,
      email: email || null,
      street_address: street_address || null,
      city: city || null,
      state: state || null,
      zip_code: zip_code || null,
      user_id: user_id || null,
    };

    const result = await sbQuery('people', 'POST', payload);
    const customer = result?.[0] || {};

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        phone: customer.phone,
        email: customer.email,
      },
    });
  } catch (err) {
    console.error('[TOOLS] create-customer failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tools/get-services
 * 
 * Returns all active services for the business. Agent uses this to answer
 * pricing and service questions during calls.
 * 
 * Query: ?user_id=<uuid>
 * Returns: { services: [...], count: number }
 */
router.get('/get-services', async (req, res) => {
  try {
    const { user_id } = req.query;
    let filter = '?is_active=eq.true';
    if (user_id) filter += `&user_id=eq.${user_id}`;
    filter += '&order=sort_order.asc,name.asc';

    const services = await sbQuery('services', 'GET', null, filter) || [];

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
 * Returns business info and knowledge base content for the agent to use during calls.
 * Reads from the businesses table, scoped by user_id.
 * 
 * Body: { user_id?: "uuid", category?: "about" | "policies" | "faq" | "general", question?: string }
 * Returns: { business_name, phone, hours, address, knowledge_base: {...} }
 */
router.post('/get-business-info', async (req, res) => {
  try {
    const { user_id, category, question } = req.body || {};

    // Fetch business from businesses table, scoped by user_id
    let business = {};
    try {
      let filter = '?limit=1';
      if (user_id) filter += `&user_id=eq.${user_id}`;
      const rows = await sbQuery('businesses', 'GET', null, filter) || [];
      business = rows[0] || {};
    } catch (_) { /* return defaults */ }

    // Build knowledge base from businesses table
    const knowledgeBase = {
      about: business.about_us || '',
      policies: business.policies || '',
      faq: business.faq || '',
    };

    // If specific category requested, return only that section
    if (category && category !== 'general' && knowledgeBase[category] !== undefined) {
      return res.json({
        business_name: business.name || '',
        phone: business.phone || '',
        email: business.email || '',
        address: [business.address, business.city, business.state, business.zip].filter(Boolean).join(', '),
        hours: business.hours || '',
        category,
        content: knowledgeBase[category],
      });
    }

    // Return everything
    res.json({
      business_name: business.name || '',
      phone: business.phone || '',
      email: business.email || '',
      address: [business.address, business.city, business.state, business.zip].filter(Boolean).join(', '),
      website: business.website || '',
      hours: business.hours || '',
      timezone: 'America/New_York',
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
