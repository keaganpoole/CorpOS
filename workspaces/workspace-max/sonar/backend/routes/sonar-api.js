/**
 * Sonar Management API — /api/sonar/*
 * 
 * CRUD endpoints for the Sonar dashboard frontend.
 * Business profile, services, appointments, customers, receptionists, call logs.
 * 
 * Separate from the Server Tools API — these are for the dashboard, not ElevenLabs.
 */

const express = require('express');
const router = express.Router();

// ─── Supabase Helpers (injected by controller) ──────────
let sbQuery;
function init(deps) {
  sbQuery = deps.sbQuery;
}

// ─── Helper: normalize phone ─────────────────────────────
function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = '+' + cleaned;
  }
  return cleaned;
}

// ══════════════════════════════════════════════════════════
// BUSINESS PROFILE & SETTINGS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/business/profile
 * Returns the full business profile from the account_settings table.
 */
router.get('/business/profile', async (req, res) => {
  try {
    const rows = await sbQuery('account_settings', 'GET', null, '?limit=1') || [];
    const s = rows[0] || {};

    res.json({
      business_name: s.business_name || '',
      phone: s.business_phone || '',
      email: s.business_email || '',
      address: s.business_address || '',
      timezone: s.business_timezone || 'America/New_York',
      appointment_duration: s.default_appointment_duration || 30,
      appointment_buffer: s.appointment_buffer_minutes || 0,
      business_hours: s.business_hours || {},
      forwarding_number: s.forwarding_number || '',
    });
  } catch (err) {
    console.error('[SONAR-API] get profile failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/business/profile
 * Updates business profile fields in account_settings.
 */
router.put('/business/profile', async (req, res) => {
  try {
    const fieldMap = {
      business_name: 'business_name',
      phone: 'business_phone',
      email: 'business_email',
      address: 'business_address',
      timezone: 'business_timezone',
      appointment_duration: 'default_appointment_duration',
      appointment_buffer: 'appointment_buffer_minutes',
      forwarding_number: 'forwarding_number',
    };

    const payload = {};
    for (const [bodyField, dbField] of Object.entries(fieldMap)) {
      if (req.body[bodyField] !== undefined) payload[dbField] = req.body[bodyField];
    }
    if (req.body.business_hours !== undefined) payload.business_hours = req.body.business_hours;

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });

    // Get the row id first
    const existing = await sbQuery('account_settings', 'GET', null, '?limit=1') || [];
    if (existing.length === 0) {
      // Insert a new row
      const result = await sbQuery('account_settings', 'POST', payload);
      return res.json({ success: true, updated: payload });
    }

    const result = await sbQuery('account_settings', 'PATCH', payload, `?id=eq.${existing[0].id}`);
    res.json({ success: true, updated: payload });
  } catch (err) {
    console.error('[SONAR-API] update profile failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/business/knowledge-base
 * Returns knowledge base content. Currently stored in-memory until KB table is added.
 */
router.get('/business/knowledge-base', async (req, res) => {
  // account_settings doesn't have KB columns yet — return empty structure
  res.json({
    about: '',
    services: '',
    policies: '',
    faq: '',
  });
});

/**
 * PUT /api/sonar/business/knowledge-base
 * Updates knowledge base sections. Stub until KB table is added.
 */
router.put('/business/knowledge-base', async (req, res) => {
  // account_settings doesn't have KB columns yet — accept but no-op
  const fields = Object.keys(req.body).filter(k => ['about', 'services', 'policies', 'faq'].includes(k));
  if (fields.length === 0) return res.status(400).json({ error: 'No valid fields (about, services, policies, faq)' });

  res.json({ success: true, stored: fields, note: 'Knowledge base will persist once KB columns are added to account_settings' });
});

// ══════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/services
 * List all services, optionally filtered by active status.
 * Query: ?active=true
 */
router.get('/services', async (req, res) => {
  try {
    let query = '?order=sort_order.asc,name.asc';
    if (req.query.active === 'true') query += '&is_active=eq.true';
    if (req.query.active === 'false') query += '&is_active=eq.false';

    const services = await sbQuery('services', 'GET', null, query) || [];
    res.json(services);
  } catch (err) {
    console.error('[SONAR-API] get services failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/services
 * Create a new service.
 * Body: { name, description, price_type, price_min, price_max, unit, category, is_active, sort_order }
 */
router.post('/services', async (req, res) => {
  try {
    const { name, description, price_type, price_min, price_max, unit, category, is_active, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const crypto = require('crypto');
    const payload = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      price_type: price_type || 'fixed',
      price_min: price_min || null,
      price_max: price_max || null,
      unit: unit || '',
      category: category || 'General',
      is_active: is_active !== undefined ? is_active : true,
      sort_order: sort_order || 0,
    };

    const result = await sbQuery('services', 'POST', payload);
    res.json({ success: true, service: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] create service failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/services/:id
 * Update a service.
 */
router.put('/services/:id', async (req, res) => {
  try {
    const allowed = ['name', 'description', 'price_type', 'price_min', 'price_max', 'unit', 'category', 'is_active', 'sort_order'];
    const payload = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const result = await sbQuery('services', 'PATCH', payload, `?id=eq.${req.params.id}`);
    res.json({ success: true, service: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] update service failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sonar/services/:id
 * Delete a service.
 */
router.delete('/services/:id', async (req, res) => {
  try {
    await sbQuery('services', 'DELETE', null, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[SONAR-API] delete service failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// APPOINTMENTS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/appointments
 * List appointments with optional filters.
 * Query: ?date=2026-04-15&status=pending&receptionist=Brian&start=2026-04-01&end=2026-04-30&page=1&limit=50
 */
router.get('/appointments', async (req, res) => {
  try {
    const { date, status, receptionist, start, end, page = 1, limit = 50 } = req.query;
    let query = '?order=date.asc,time.asc';

    if (date) query += `&date=eq.${date}`;
    if (status) query += `&status=eq.${status}`;
    if (receptionist) query += `&assigned_receptionist=eq.${receptionist}`;
    if (start && end) query += `&date=gte.${start}&date=lte.${end}`;
    else if (start) query += `&date=gte.${start}`;
    else if (end) query += `&date=lte.${end}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += `&limit=${limit}&offset=${offset}`;

    const appointments = await sbQuery('appointments', 'GET', null, query) || [];

    // Get total count for pagination
    let countQuery = '?select=count';
    if (date) countQuery += `&date=eq.${date}`;
    if (status) countQuery += `&status=eq.${status}`;
    if (start && end) countQuery += `&date=gte.${start}&date=lte.${end}`;

    let total = appointments.length;
    try {
      const countRes = await sbQuery('appointments', 'GET', null, countQuery + '&limit=1');
      if (countRes && countRes[0]?.count !== undefined) total = parseInt(countRes[0].count);
    } catch (_) { /* use array length */ }

    res.json({
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[SONAR-API] get appointments failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/appointments/stats
 * Appointment statistics for calendar heat map and dashboard.
 * Query: ?start=2026-04-01&end=2026-04-30
 */
router.get('/appointments/stats', async (req, res) => {
  try {
    let query = '?status=in.(pending,confirmed,cancelled)';
    if (req.query.start && req.query.end) {
      query = `?date=gte.${req.query.start}&date=lte.${req.query.end}&status=in.(pending,confirmed,cancelled)`;
    }

    const appointments = await sbQuery('appointments', 'GET', null, query) || [];

    const stats = {
      total: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      by_date: {},
      by_receptionist: {},
    };

    for (const apt of appointments) {
      if (!stats.by_date[apt.date]) stats.by_date[apt.date] = 0;
      stats.by_date[apt.date]++;
      const rep = apt.assigned_receptionist || 'Unassigned';
      if (!stats.by_receptionist[rep]) stats.by_receptionist[rep] = 0;
      stats.by_receptionist[rep]++;
    }

    res.json(stats);
  } catch (err) {
    console.error('[SONAR-API] get appointment stats failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/appointments/:id
 * Get single appointment detail.
 */
router.get('/appointments/:id', async (req, res) => {
  try {
    const result = await sbQuery('appointments', 'GET', null, `?id=eq.${req.params.id}&limit=1`) || [];
    if (result.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(result[0]);
  } catch (err) {
    console.error('[SONAR-API] get appointment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/appointments
 * Create appointment from dashboard.
 */
router.post('/appointments', async (req, res) => {
  try {
    const { lead_id, client_name, date, time, duration, status, assigned_receptionist, notes, scenario_id } = req.body;
    if (!client_name || !date || !time) {
      return res.status(400).json({ error: 'client_name, date, and time are required' });
    }

    const payload = {
      lead_id: lead_id || null,
      client_name,
      date,
      time,
      duration: duration || 30,
      status: status || 'pending',
      assigned_receptionist: assigned_receptionist || null,
      notes: notes || null,
      scenario_id: scenario_id || null,
    };

    const result = await sbQuery('appointments', 'POST', payload);
    res.json({ success: true, appointment: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] create appointment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/appointments/:id
 * Update appointment from dashboard.
 */
router.put('/appointments/:id', async (req, res) => {
  try {
    const allowed = ['client_name', 'date', 'time', 'duration', 'status', 'assigned_receptionist', 'notes', 'lead_id'];
    const payload = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const result = await sbQuery('appointments', 'PATCH', payload, `?id=eq.${req.params.id}`);
    res.json({ success: true, appointment: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] update appointment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sonar/appointments/:id
 * Cancel/delete appointment from dashboard.
 */
router.delete('/appointments/:id', async (req, res) => {
  try {
    // Soft delete — set status to cancelled
    const result = await sbQuery('appointments', 'PATCH', { status: 'cancelled' }, `?id=eq.${req.params.id}`);
    res.json({ success: true, appointment: result?.[0] || { id: req.params.id, status: 'cancelled' } });
  } catch (err) {
    console.error('[SONAR-API] delete appointment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// PEOPLE (Customers)
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/people
 * List all customers with pagination and search.
 * Query: ?search=john&page=1&limit=25
 */
router.get('/people', async (req, res) => {
  try {
    const { search, page = 1, limit = 25 } = req.query;
    let query = '?order=id.desc';

    if (search) {
      query += `&or=(first_name.ilike.%25${search}%25,last_name.ilike.%25${search}%25,phone.ilike.%25${search}%25,email.ilike.%25${search}%25)`;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += `&limit=${limit}&offset=${offset}`;

    const people = await sbQuery('people', 'GET', null, query) || [];
    res.json({ people, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[SONAR-API] get people failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/people/search?q=john
 * Search customers by name, phone, or email.
 */
router.get('/people/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q query parameter required' });

    const results = await sbQuery('people', 'GET', null,
      `?or=(first_name.ilike.%25${q}%25,last_name.ilike.%25${q}%25,phone.ilike.%25${q}%25,email.ilike.%25${q}%25)&limit=20`
    ) || [];

    res.json({ results, query: q, count: results.length });
  } catch (err) {
    console.error('[SONAR-API] search people failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/people/:id
 * Get customer detail with appointment history.
 */
router.get('/people/:id', async (req, res) => {
  try {
    const person = await sbQuery('people', 'GET', null, `?id=eq.${req.params.id}&limit=1`) || [];
    if (person.length === 0) return res.status(404).json({ error: 'Person not found' });

    // Get their appointments
    const appointments = await sbQuery('appointments', 'GET', null,
      `?lead_id=eq.${req.params.id}&order=date.desc&limit=20`
    ) || [];

    res.json({ ...person[0], appointments });
  } catch (err) {
    console.error('[SONAR-API] get person failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/people
 * Create a new customer record.
 */
router.post('/people', async (req, res) => {
  try {
    const { first_name, last_name, phone, email, street_address, city, state, zip_code, notes } = req.body;

    const payload = {
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone ? normalizePhone(phone) : null,
      email: email || null,
      street_address: street_address || null,
      city: city || null,
      state: state || null,
      zip_code: zip_code || null,
      notes: notes || null,
    };

    const result = await sbQuery('people', 'POST', payload);
    res.json({ success: true, person: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] create person failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/people/:id
 * Update customer info.
 */
router.put('/people/:id', async (req, res) => {
  try {
    const allowed = ['first_name', 'last_name', 'phone', 'email', 'street_address', 'city', 'state', 'zip_code', 'notes', 'special_instructions'];
    const payload = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        payload[field] = field === 'phone' ? normalizePhone(req.body[field]) : req.body[field];
      }
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const result = await sbQuery('people', 'PATCH', payload, `?id=eq.${req.params.id}`);
    res.json({ success: true, person: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] update person failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sonar/people/:id
 * Delete customer record.
 */
router.delete('/people/:id', async (req, res) => {
  try {
    await sbQuery('people', 'DELETE', null, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[SONAR-API] delete person failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// RECEPTIONISTS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/receptionists/catalog
 * List all available receptionists from the catalog (for hire modal).
 */
router.get('/receptionists/catalog', async (req, res) => {
  try {
    const catalog = await sbQuery('receptionist_catalog', 'GET', null, '?order=id.asc') || [];
    res.json(catalog);
  } catch (err) {
    console.error('[SONAR-API] get catalog failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/receptionists/hired
 * List user's hired receptionists.
 */
router.get('/receptionists/hired', async (req, res) => {
  try {
    const hired = await sbQuery('hired_receptionists', 'GET', null, '?order=id.asc') || [];
    res.json(hired);
  } catch (err) {
    console.error('[SONAR-API] get hired failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/receptionists/hire
 * Hire a receptionist (copy from catalog → hired_receptionists).
 * Body: { catalog_id: 1 }
 */
router.post('/receptionists/hire', async (req, res) => {
  try {
    const { catalog_id } = req.body;
    if (!catalog_id) return res.status(400).json({ error: 'catalog_id is required' });

    // Fetch from catalog
    const catalog = await sbQuery('receptionist_catalog', 'GET', null, `?id=eq.${catalog_id}&limit=1`) || [];
    if (catalog.length === 0) return res.status(404).json({ error: 'Receptionist not found in catalog' });

    const source = catalog[0];

    // Build hired record (copy all fields + defaults)
    const payload = {
      catalog_id: source.id,
      full_name: source.full_name || source.name,
      name: source.name,
      description: source.description,
      traits: source.traits,
      voice: source.voice,
      voice_id: source.voice_id,
      elevenlabs_voice_id: source.elevenlabs_voice_id,
      stereotype: source.stereotype || source.role || 'Receptionist',
      avatar: source.avatar,
      status: 'active',
      call_types: 'none',
      is_active: false,
      model: source.model || '',
      compliments: 0,
      complaints: 0,
    };

    const result = await sbQuery('hired_receptionists', 'POST', payload);
    const hired = result?.[0] || payload;

    res.json({ success: true, receptionist: hired });
  } catch (err) {
    console.error('[SONAR-API] hire receptionist failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/receptionists/:id
 * Update hired receptionist settings.
 */
router.put('/receptionists/:id', async (req, res) => {
  try {
    const allowed = ['full_name', 'status', 'call_types', 'phone_number', 'is_active', 'model', 'current_activity'];
    const payload = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const result = await sbQuery('hired_receptionists', 'PATCH', payload, `?id=eq.${req.params.id}`);
    res.json({ success: true, receptionist: result?.[0] || payload });
  } catch (err) {
    console.error('[SONAR-API] update receptionist failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sonar/receptionists/:id
 * Fire/release a hired receptionist.
 */
router.delete('/receptionists/:id', async (req, res) => {
  try {
    await sbQuery('hired_receptionists', 'DELETE', null, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[SONAR-API] fire receptionist failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/receptionists/:id/call-types
 * Set call handling type (off/in/out/both) + phone number.
 * Body: { call_types: "inbound", phone_number: "+12075551234" }
 */
router.post('/receptionists/:id/call-types', async (req, res) => {
  try {
    const { call_types, phone_number } = req.body;
    const validTypes = ['none', 'inbound', 'outbound', 'both'];
    if (call_types && !validTypes.includes(call_types)) {
      return res.status(400).json({ error: `call_types must be one of: ${validTypes.join(', ')}` });
    }

    const payload = {};
    if (call_types) payload.call_types = call_types;
    if (phone_number !== undefined) payload.phone_number = phone_number;
    if (call_types && call_types !== 'none') payload.is_active = true;
    if (call_types === 'none') payload.is_active = false;

    const result = await sbQuery('hired_receptionists', 'PATCH', payload, `?id=eq.${req.params.id}`);
    res.json({ success: true, ...payload });
  } catch (err) {
    console.error('[SONAR-API] set call-types failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/receptionists/:id/scenario
 * Assign a scenario to a receptionist.
 * Body: { scenario_id: "uuid" }
 */
router.post('/receptionists/:id/scenario', async (req, res) => {
  try {
    const { scenario_id } = req.body;

    const result = await sbQuery('hired_receptionists', 'PATCH',
      { scenario_id: scenario_id || null },
      `?id=eq.${req.params.id}`
    );

    res.json({ success: true, scenario_id });
  } catch (err) {
    console.error('[SONAR-API] assign scenario failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// CALL LOGS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/call-logs
 * List call logs with optional filters.
 * Query: ?start=2026-04-01&end=2026-04-30&outcome=booked&receptionist_id=5&page=1&limit=25
 */
router.get('/call-logs', async (req, res) => {
  try {
    const { start, end, outcome, receptionist_id, page = 1, limit = 25 } = req.query;
    let query = '?order=started_at.desc';

    if (start) query += `&started_at=gte.${start}`;
    if (end) query += `&started_at=lte.${end}`;
    if (outcome) query += `&outcome=eq.${outcome}`;
    if (receptionist_id) query += `&receptionist_id=eq.${receptionist_id}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += `&limit=${limit}&offset=${offset}`;

    const logs = await sbQuery('call_logs', 'GET', null, query) || [];
    res.json({ logs, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[SONAR-API] get call-logs failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/call-logs/stats
 * Call analytics: total calls, booking rate, common intents, peak hours.
 * Query: ?start=2026-04-01&end=2026-04-30
 */
router.get('/call-logs/stats', async (req, res) => {
  try {
    let query = '?order=started_at.desc&limit=1000';
    if (req.query.start && req.query.end) {
      query += `&started_at=gte.${req.query.start}&started_at=lte.${req.query.end}`;
    }

    const logs = await sbQuery('call_logs', 'GET', null, query) || [];

    const stats = {
      total_calls: logs.length,
      by_outcome: {},
      by_receptionist: {},
      by_hour: {},
      avg_duration: 0,
      booking_rate: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const log of logs) {
      // By outcome
      const outcome = log.outcome || 'unknown';
      stats.by_outcome[outcome] = (stats.by_outcome[outcome] || 0) + 1;

      // By receptionist
      const rep = log.receptionist_id || 'Unknown';
      stats.by_receptionist[rep] = (stats.by_receptionist[rep] || 0) + 1;

      // By hour
      if (log.started_at) {
        const hour = new Date(log.started_at).getHours();
        stats.by_hour[hour] = (stats.by_hour[hour] || 0) + 1;
      }

      // Duration
      if (log.duration_seconds) {
        totalDuration += log.duration_seconds;
        durationCount++;
      }
    }

    if (durationCount > 0) stats.avg_duration = Math.round(totalDuration / durationCount);
    if (stats.total_calls > 0) {
      const booked = stats.by_outcome['booked'] || 0;
      stats.booking_rate = Math.round((booked / stats.total_calls) * 100);
    }

    res.json(stats);
  } catch (err) {
    console.error('[SONAR-API] get call-log stats failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, init };
