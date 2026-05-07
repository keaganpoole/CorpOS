/**
 * Sonar Management API — /api/sonar/*
 * 
 * CRUD endpoints for the Sonar dashboard frontend.
 * Business profile, services, appointments, customers, receptionists, call logs.
 * 
 * Separate from the Server Tools API — these are for the dashboard, not ElevenLabs.
 */

const express = require('express');
let stripe = require('stripe')(process.env.STRIPE_API_SECRET_TEST_KEY_CORPOS);
const router = express.Router();

// ─── Supabase Helpers (injected by controller) ──────────
let sbQuery;
let eventSystem;
function init(deps) {
  sbQuery = deps.sbQuery;
  eventSystem = deps.eventSystem;
}

function emitPaymentEvent(eventType, { message, payload = {}, severity = 'info' } = {}) {
  if (!eventSystem) return;

  eventSystem.emit({
    event_type: eventType,
    actor: 'api',
    actor_type: 'system',
    source: 'sonar-api',
    severity,
    message: message || eventType,
    payload,
  });
}

function buildPaymentPayload({
  payment = null,
  intent = null,
  person_id = null,
  appointment_id = null,
  scenario_id = null,
  user_id = null,
  extra = {},
} = {}) {
  return {
    payment_id: payment?.id || null,
    stripe_payment_intent_id: intent?.id || payment?.stripe_payment_intent_id || null,
    person_id: person_id || payment?.person_id || intent?.metadata?.person_id || null,
    appointment_id: appointment_id || payment?.appointment_id || intent?.metadata?.appointment_id || null,
    scenario_id: scenario_id || payment?.scenario_id || null,
    user_id: user_id || payment?.user_id || intent?.metadata?.user_id || null,
    amount: payment?.amount ?? intent?.amount ?? null,
    currency: payment?.currency || intent?.currency || null,
    status: payment?.status || intent?.status || null,
    description: payment?.description || intent?.description || null,
    ...extra,
  };
}

function buildInvoicePayload({
  invoice = null,
  person_id = null,
  appointment_id = null,
  service_id = null,
  scenario_id = null,
  user_id = null,
  extra = {},
} = {}) {
  return {
    invoice_id: invoice?.id || null,
    customer_id: invoice?.customer || null,
    person_id: person_id || invoice?.metadata?.person_id || null,
    appointment_id: appointment_id || invoice?.metadata?.appointment_id || null,
    service_id: service_id || invoice?.metadata?.service_id || null,
    scenario_id,
    user_id,
    amount_due: invoice?.amount_due ?? null,
    amount_paid: invoice?.amount_paid ?? null,
    currency: invoice?.currency || null,
    status: invoice?.status || null,
    hosted_invoice_url: invoice?.hosted_invoice_url || null,
    invoice_pdf: invoice?.invoice_pdf || null,
    description: invoice?.description || null,
    due_date: invoice?.due_date || null,
    metadata: invoice?.metadata || null,
    ...extra,
  };
}

// ─── Helper: normalize phone ─────────────────────────────
function normalizeStripeTimestamp(value) {
  if (!value) return null;
  const ts = typeof value === 'number' ? value * 1000 : Number(value) * 1000;
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function buildInvoiceRecord(invoice, overrides = {}) {
  if (!invoice?.id) return null;

  const metadata = invoice.metadata || {};
  return {
    user_id: overrides.user_id || metadata.user_id || null,
    person_id: overrides.person_id || metadata.person_id || null,
    appointment_id: overrides.appointment_id || metadata.appointment_id || null,
    service_id: overrides.service_id || metadata.service_id || null,
    payment_id: overrides.payment_id || metadata.payment_id || null,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer || null,
    stripe_payment_intent_id: invoice.payment_intent || null,
    amount_due: invoice.amount_due ?? 0,
    amount_paid: invoice.amount_paid ?? 0,
    currency: invoice.currency || 'usd',
    status: overrides.status || invoice.status || 'draft',
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf: invoice.invoice_pdf || null,
    description: invoice.description || null,
    due_date: normalizeStripeTimestamp(invoice.due_date),
    paid_at: normalizeStripeTimestamp(invoice.status_transitions?.paid_at),
    finalized_at: normalizeStripeTimestamp(invoice.status_transitions?.finalized_at),
    voided_at: normalizeStripeTimestamp(invoice.status_transitions?.voided_at),
    metadata,
    raw_stripe_invoice: invoice,
    updated_at: new Date().toISOString(),
  };
}

async function upsertInvoiceFromStripe(invoice, overrides = {}) {
  if (!invoice?.id || !sbQuery) return null;

  const payload = buildInvoiceRecord(invoice, overrides);
  if (!payload) return null;

  const existing = await sbQuery('invoices', 'GET', null, `?stripe_invoice_id=eq.${invoice.id}&limit=1`);
  if (existing?.length) {
    const updated = await sbQuery('invoices', 'PATCH', payload, `?stripe_invoice_id=eq.${invoice.id}`);
    return updated?.[0] || existing[0] || null;
  }

  const inserted = await sbQuery('invoices', 'POST', payload);
  return inserted?.[0] || null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) cleaned = '+1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) cleaned = '+' + cleaned;
  }
  return cleaned;
}

function parseCentsAmount(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);
  const text = String(input).trim().replace(/[$,]/g, '');
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

// ══════════════════════════════════════════════════════════
// BUSINESS PROFILE & SETTINGS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/sonar/business/profile
 * Returns the full business profile from the businesses table.
 */
router.get('/business/profile', async (req, res) => {
  try {
    const rows = await sbQuery('businesses', 'GET', null, '?limit=1') || [];
    const b = rows[0] || {};

    res.json({
      name: b.name || '',
      phone: b.phone || '',
      email: b.email || '',
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      zip: b.zip || '',
      website: b.website || '',
      hours: b.hours || '',
      business_timezone: b.business_timezone || 'America/New_York',
    });
  } catch (err) {
    console.error('[SONAR-API] get profile failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/business/profile
 * Updates business profile fields in the businesses table.
 */
router.put('/business/profile', async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'website', 'hours', 'business_timezone'];

    const payload = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    }
    payload.updated_at = new Date().toISOString();

    if (Object.keys(payload).length === 1) return res.status(400).json({ error: 'No valid fields' }); // only updated_at

    // Get the row id first
    const existing = await sbQuery('businesses', 'GET', null, '?limit=1') || [];
    if (existing.length === 0) {
      const result = await sbQuery('businesses', 'POST', payload);
      return res.json({ success: true, updated: payload });
    }

    const result = await sbQuery('businesses', 'PATCH', payload, `?id=eq.${existing[0].id}`);
    res.json({ success: true, updated: payload });
  } catch (err) {
    console.error('[SONAR-API] update profile failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/business/knowledge-base
 * Returns knowledge base content from the businesses table.
 */
router.get('/business/knowledge-base', async (req, res) => {
  try {
    const rows = await sbQuery('businesses', 'GET', null, '?limit=1') || [];
    const b = rows[0] || {};

    res.json({
      about: b.about_us || '',
      policies: b.policies || '',
      faq: b.faq || '',
    });
  } catch (err) {
    console.error('[SONAR-API] get knowledge-base failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sonar/business/knowledge-base
 * Updates knowledge base sections in the businesses table.
 */
router.put('/business/knowledge-base', async (req, res) => {
  try {
    const fieldMap = {
      about: 'about_us',
      policies: 'policies',
      faq: 'faq',
    };

    const payload = {};
    for (const [bodyField, dbField] of Object.entries(fieldMap)) {
      if (req.body[bodyField] !== undefined) payload[dbField] = req.body[bodyField];
    }
    payload.updated_at = new Date().toISOString();

    if (Object.keys(payload).length === 1) return res.status(400).json({ error: 'No valid fields (about, policies, faq)' });

    const existing = await sbQuery('businesses', 'GET', null, '?limit=1') || [];
    if (existing.length === 0) {
      const result = await sbQuery('businesses', 'POST', payload);
      return res.json({ success: true, stored: Object.keys(payload).filter(k => k !== 'updated_at') });
    }

    await sbQuery('businesses', 'PATCH', payload, `?id=eq.${existing[0].id}`);
    res.json({ success: true, stored: Object.keys(payload).filter(k => k !== 'updated_at') });
  } catch (err) {
    console.error('[SONAR-API] update knowledge-base failed:', err.message);
    res.status(500).json({ error: err.message });
  }
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
    const updated = result?.[0] || payload;

    // Emit event if status changed
    if (payload.status && eventSystem) {
      const statusEventMap = {
        cancelled: 'appointment_cancelled',
        confirmed: 'appointment_confirmed',
        completed: 'appointment_completed',
        pending: 'appointment_updated',
      };
      const eventType = statusEventMap[payload.status] || 'appointment_updated';
      eventSystem.emit({
        event_type: eventType,
        actor: 'api',
        actor_type: 'system',
        source: 'sonar-api',
        message: `Appointment ${req.params.id} status → ${payload.status}`,
        payload: {
          appointment_id: req.params.id,
          new_status: payload.status,
          ...updated,
        },
      });
    } else if (eventSystem) {
      eventSystem.emit({
        event_type: 'appointment_updated',
        actor: 'api',
        actor_type: 'system',
        source: 'sonar-api',
        message: `Appointment ${req.params.id} updated`,
        payload: { appointment_id: req.params.id, ...updated },
      });
    }

    res.json({ success: true, appointment: updated });
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
    const updated = result?.[0] || { id: req.params.id, status: 'cancelled' };

    if (eventSystem) {
      eventSystem.emit({
        event_type: 'appointment_cancelled',
        actor: 'api',
        actor_type: 'system',
        source: 'sonar-api',
        message: `Appointment ${req.params.id} cancelled (deleted)`,
        payload: { appointment_id: req.params.id, new_status: 'cancelled', ...updated },
      });
    }

    res.json({ success: true, appointment: updated });
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
 * GET /api/sonar/search-records?table=people&user_id=xxx&limit=10
 * Generic search endpoint for scenario node execution.
 * Queries any table filtered by user_id.
 */
router.get('/search-records', async (req, res) => {
  try {
    const { table, user_id, limit } = req.query;
    if (!table) return res.status(400).json({ error: 'table parameter required' });

    const allowedTables = ['people', 'appointments', 'services', 'payments', 'businesses', 'hired_receptionists', 'call_logs'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: `Invalid table: ${table}. Allowed: ${allowedTables.join(', ')}` });
    }

    const maxRecords = Math.min(parseInt(limit) || 10, 100);
    let query = `?order=created_at.desc&limit=${maxRecords}`;
    if (user_id) {
      query += `&user_id=eq.${user_id}`;
    }

    const results = await sbQuery(table, 'GET', null, query) || [];
    res.json({ records: results, count: results.length, table });
  } catch (err) {
    console.error('[SONAR-API] search-records failed:', err.message);
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

    // Emit record_updated event
    if (eventSystem) {
      eventSystem.emit({
        event_type: 'record_updated',
        actor: 'api',
        actor_type: 'system',
        source: 'sonar-api',
        message: `Person ${req.params.id} updated`,
        payload: {
          person_id: parseInt(req.params.id),
          record_id: req.params.id,
          ...payload,
        },
      });
    }

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

// ══════════════════════════════════════════════════════════
// PAYMENTS (Stripe Integration)
// ══════════════════════════════════════════════════════════

const getStripe = () => {
  const key = process.env.STRIPE_API_SECRET_TEST_KEY_CORPOS;
  if (!key) throw new Error('Stripe API key not configured');
  return require('stripe')(key);
};

/**
 * POST /api/sonar/payments/test-mode
 * Set Stripe test mode globally.
 * Body: { enabled: true|false }
 */
router.post('/payments/test-mode', async (req, res) => {
  try {
    process.env.STRIPE_TEST_MODE = 'true';
    stripe = getStripe();
    console.log('[SONAR-API] Stripe test mode: ON (locked to test key)');
    res.json({ success: true, testMode: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/payments/test-mode
 * Get current Stripe test mode status.
 */
router.get('/payments/test-mode', async (req, res) => {
  res.json({ testMode: process.env.STRIPE_TEST_MODE === 'true' });
});

/**
 * POST /api/sonar/payments/charge
 * Create a Stripe PaymentIntent and record it.
 * Body: { amount, currency, person_id, user_id, description, scenario_id }
 */
router.post('/payments/charge', async (req, res) => {
  try {
    const stripe = getStripe();
    const { amount, currency = 'usd', person_id, user_id, description, scenario_id } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Amount in cents
    const amountCents = Math.round(parseFloat(amount) * 100);

    // Create PaymentIntent
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description: description || 'Payment via Sonar',
      metadata: { person_id: person_id || '', user_id: user_id || '' },
      automatic_payment_methods: { enabled: true },
    });

    // Record in database
    const paymentRecord = {
      user_id: user_id || null,
      person_id: person_id ? parseInt(person_id) : null,
      scenario_id: scenario_id || null,
      stripe_payment_intent_id: intent.id,
      amount: amountCents,
      currency,
      status: 'pending',
      description: description || 'Payment via Sonar',
      metadata: JSON.stringify({ stripe_status: intent.status }),
    };

    const dbResult = await sbQuery('payments', 'POST', paymentRecord);
    const payment = dbResult?.[0];

    emitPaymentEvent('invoice_created', {
      message: `Payment record created for ${intent.id}`,
      payload: buildPaymentPayload({
        payment: payment || paymentRecord,
        intent,
        person_id,
        user_id,
        scenario_id,
      }),
    });

    res.json({
      success: true,
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      payment_id: payment?.id || null,
    });
  } catch (err) {
    console.error('[SONAR-API] charge failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/payments/confirm
 * Confirm a PaymentIntent succeeded (called after Stripe webhook or client confirmation).
 * Body: { payment_intent_id }
 */
router.post('/payments/confirm', async (req, res) => {
  try {
    const stripe = getStripe();
    const { payment_intent_id } = req.body;

    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    const isSucceeded = intent.status === 'succeeded';
    const isFailed = intent.status === 'canceled'
      || intent.status === 'requires_payment_method'
      || Boolean(intent.last_payment_error);

    // Update payment record
    const updateData = {
      status: isSucceeded ? 'succeeded' : (isFailed ? 'failed' : 'processing'),
      receipt_url: intent.charges?.data?.[0]?.receipt_url || null,
      metadata: JSON.stringify({ stripe_status: intent.status }),
    };

    const updated = await sbQuery('payments', 'PATCH', updateData, `?stripe_payment_intent_id=eq.${payment_intent_id}`);
    const payment = updated?.[0] || null;

    if (isSucceeded) {
      const payload = buildPaymentPayload({
        payment,
        intent,
        person_id: payment?.person_id || intent.metadata?.person_id || null,
        appointment_id: payment?.appointment_id || intent.metadata?.appointment_id || null,
        user_id: payment?.user_id || intent.metadata?.user_id || null,
      });
      emitPaymentEvent('invoice_paid', {
        message: `Payment succeeded: ${payment_intent_id}`,
        payload,
      });
      emitPaymentEvent('payment_succeeded', {
        message: `Payment succeeded: ${payment_intent_id}`,
        payload,
      });
    } else if (isFailed) {
      emitPaymentEvent('payment_failed', {
        message: `Payment failed: ${payment_intent_id}`,
        payload: buildPaymentPayload({
          payment,
          intent,
          person_id: payment?.person_id || intent.metadata?.person_id || null,
          appointment_id: payment?.appointment_id || intent.metadata?.appointment_id || null,
          user_id: payment?.user_id || intent.metadata?.user_id || null,
          extra: {
            failure_message: intent.last_payment_error?.message || intent.cancellation_reason || 'Payment failed',
          },
        }),
        severity: 'critical',
      });
    }

    res.json({ success: true, status: intent.status });
  } catch (err) {
    console.error('[SONAR-API] confirm payment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/stripe/webhook
 * Stripe webhook for invoice/payment events.
 * Requires STRIPE_WEBHOOK_SECRET when signature verification is enabled.
 */
router.post('/stripe/webhook', async (req, res) => {
  try {
    const stripe = getStripe();
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event = null;
    if (webhookSecret && signature && req.rawBody) {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } else if (req.body?.type) {
      event = req.body;
    } else {
      return res.status(400).json({ error: 'Invalid Stripe webhook payload' });
    }

    const invoice = event.data?.object || null;
    const invoiceId = invoice?.id || null;
    console.log(`[SONAR-API] Stripe webhook received: ${event.type}${invoiceId ? ` (${invoiceId})` : ''}`);

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      await upsertInvoiceFromStripe(invoice, {
        status: 'paid',
        person_id: invoice?.metadata?.person_id || null,
        appointment_id: invoice?.metadata?.appointment_id || null,
        service_id: invoice?.metadata?.service_id || null,
        user_id: invoice?.metadata?.user_id || null,
      });

      emitPaymentEvent('invoice_paid', {
        message: `Stripe invoice paid: ${invoiceId || 'unknown'}`,
        payload: buildInvoicePayload({
          invoice,
          extra: {
            invoice,
            stripe_event_type: event.type,
          },
        }),
      });
    } else if (event.type === 'invoice.payment_failed') {
      await upsertInvoiceFromStripe(invoice, {
        status: 'open',
        person_id: invoice?.metadata?.person_id || null,
        appointment_id: invoice?.metadata?.appointment_id || null,
        service_id: invoice?.metadata?.service_id || null,
        user_id: invoice?.metadata?.user_id || null,
      });

      emitPaymentEvent('payment_failed', {
        message: `Stripe invoice payment failed: ${invoiceId || 'unknown'}`,
        payload: buildInvoicePayload({
          invoice,
          extra: {
            invoice,
            stripe_event_type: event.type,
            failure_message: invoice?.last_finalization_error?.message || invoice?.attempted ? 'Invoice payment failed' : 'Invoice payment failed',
          },
        }),
        severity: 'critical',
      });
    } else if (event.type === 'invoice.sent') {
      await upsertInvoiceFromStripe(invoice, {
        status: 'open',
        person_id: invoice?.metadata?.person_id || null,
        appointment_id: invoice?.metadata?.appointment_id || null,
        service_id: invoice?.metadata?.service_id || null,
        user_id: invoice?.metadata?.user_id || null,
      });

      emitPaymentEvent('invoice_sent', {
        message: `Stripe invoice sent: ${invoiceId || 'unknown'}`,
        payload: buildInvoicePayload({
          invoice,
          extra: {
            invoice,
            stripe_event_type: event.type,
          },
        }),
      });
    } else if (event.type === 'invoice.created') {
      await upsertInvoiceFromStripe(invoice, {
        status: invoice?.status || 'draft',
        person_id: invoice?.metadata?.person_id || null,
        appointment_id: invoice?.metadata?.appointment_id || null,
        service_id: invoice?.metadata?.service_id || null,
        user_id: invoice?.metadata?.user_id || null,
      });

      emitPaymentEvent('invoice_created', {
        message: `Stripe invoice created: ${invoiceId || 'unknown'}`,
        payload: buildInvoicePayload({
          invoice,
          extra: {
            invoice,
            stripe_event_type: event.type,
          },
        }),
      });
    } else {
      console.log(`[SONAR-API] Stripe webhook ignored: ${event.type}`);
    }

    res.json({ received: true, type: event.type });
  } catch (err) {
    console.error('[SONAR-API] stripe webhook failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/payments/refund
 * Refund a previous charge.
 * Body: { payment_id, amount (optional — partial refund), reason }
 */
router.post('/payments/refund', async (req, res) => {
  try {
    const stripe = getStripe();
    const { payment_id, amount, reason } = req.body;

    // Look up the payment record
    const payments = await sbQuery('payments', 'GET', null, `?id=eq.${payment_id}&limit=1`);
    if (!payments?.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = payments[0];

    // Create refund
    const refundParams = { payment_intent: payment.stripe_payment_intent_id };
    if (amount) refundParams.amount = Math.round(parseFloat(amount) * 100);
    if (reason) refundParams.reason = reason;

    const refund = await stripe.refunds.create(refundParams);

    // Update payment record
    const refundAmountCents = refund.amount || payment.amount;
    const isFullRefund = refundAmountCents >= payment.amount;
    const updateData = {
      status: isFullRefund ? 'refunded' : 'partial_refund',
      refunded_amount: refundAmountCents,
      metadata: JSON.stringify({ refund_id: refund.id, refund_status: refund.status }),
    };

    await sbQuery('payments', 'PATCH', updateData, `?id=eq.${payment_id}`);

    res.json({
      success: true,
      refund_id: refund.id,
      status: isFullRefund ? 'refunded' : 'partial_refund',
    });
  } catch (err) {
    console.error('[SONAR-API] refund failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/payments
 * List payments with optional filters.
 * Query: ?person_id=17&status=succeeded&limit=25
 */
router.get('/payments', async (req, res) => {
  try {
    const { person_id, status, user_id, limit = 50, offset = 0 } = req.query;
    let query = '?order=created_at.desc';
    if (person_id) query += `&person_id=eq.${person_id}`;
    if (status) query += `&status=eq.${status}`;
    if (user_id) query += `&user_id=eq.${user_id}`;
    query += `&limit=${limit}&offset=${offset}`;

    const payments = await sbQuery('payments', 'GET', null, query) || [];
    res.json({ payments });
  } catch (err) {
    console.error('[SONAR-API] list payments failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sonar/payments/:id
 * Get a single payment by ID.
 */
router.get('/payments/:id', async (req, res) => {
  try {
    const payments = await sbQuery('payments', 'GET', null, `?id=eq.${req.params.id}&limit=1`);
    if (!payments?.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ payment: payments[0] });
  } catch (err) {
    console.error('[SONAR-API] get payment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/create-payment-profile
 * Create a Stripe Customer + SetupIntent, return a payment link.
 * The customer clicks the link to enter their card, which saves it for future charges.
 */
router.post('/create-payment-profile', async (req, res) => {
  try {
    const { amount, currency, description, person_id, customer_name, customer_email, customer_phone } = req.body;
    if (!person_id) return res.status(400).json({ error: 'person_id required' });

    // Look up person
    const personRows = await sbQuery('people', 'GET', null, `?id=eq.${person_id}&limit=1`);
    if (!personRows?.length) return res.status(404).json({ error: 'Person not found' });
    const person = personRows[0];

    // Create or retrieve Stripe Customer
    let stripeCustomerId = person.stripe_customer_id;
    if (!stripeCustomerId) {
      const customerParams = { metadata: { person_id } };
      if (customer_name) customerParams.name = customer_name;
      if (customer_email) customerParams.email = customer_email;
      if (customer_phone) customerParams.phone = customer_phone;
      const stripeCustomer = await stripe.customers.create(customerParams);
      stripeCustomerId = stripeCustomer.id;
      // Store on person
      await sbQuery('people', 'PATCH', { stripe_customer_id: stripeCustomerId }, `?id=eq.${person_id}`);
    }

    // Create SetupIntent (saves card for future use — no charge yet)
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: { person_id, amount: String(amount || ''), currency: currency || 'usd' },
    });

    // Create Stripe-hosted payment link (Customer Payment Page)
    let paymentUrl = null;
    let checkoutError = null;
    try {
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'setup',
        currency: currency || 'usd',
        payment_method_types: ['card'],
        success_url: `${process.env.APP_URL || 'http://localhost:5173'}/settings?payment_profile=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5173'}/settings?payment_profile=cancelled`,
      });
      paymentUrl = session.url;
    } catch (sessionErr) {
      checkoutError = sessionErr.message;
      console.error('[Create Payment Profile] Checkout session creation failed:', sessionErr.message);
      // Fallback: generate a direct Stripe Customer Portal link
      try {
        const portal = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${process.env.APP_URL || 'http://localhost:5173'}/settings`,
        });
        paymentUrl = portal.url;
        checkoutError = null;
    } catch (portalErr) {
        console.error('[Create Payment Profile] Portal fallback also failed:', portalErr.message);
        checkoutError = `Checkout: ${sessionErr.message} | Portal: ${portalErr.message}`;
      }
    }

    if (paymentUrl) {
      emitPaymentEvent('invoice_sent', {
        message: `Payment profile link prepared for person ${person_id}`,
        payload: {
          person_id,
          customer_id: stripeCustomerId,
          setup_intent_id: setupIntent.id,
          payment_url: paymentUrl,
          amount: amount || 0,
          currency: currency || 'usd',
          status: setupIntent.status,
          description: description || '',
          checkout_error: checkoutError,
          payment_profile: true,
        },
      });
    }

    res.json({
      customer_id: stripeCustomerId,
      setup_intent_id: setupIntent.id,
      client_secret: setupIntent.client_secret,
      payment_url: paymentUrl,
      checkout_error: checkoutError,
      amount: amount || 0,
      currency: currency || 'usd',
      status: setupIntent.status,
      customer_name: customer_name || person.first_name + ' ' + person.last_name,
      customer_email: customer_email || person.email,
    });
  } catch (err) {
    console.error('[SONAR-API] create-payment-profile failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/create-invoice
 * Create a Stripe draft invoice with one invoice item.
 */
router.post('/create-invoice', async (req, res) => {
  try {
    const {
      amount,
      currency,
      description,
      person_id,
      appointment_id,
      service_id,
      customer_name,
      customer_email,
      customer_phone,
      due_days,
    } = req.body;

    if (!person_id) return res.status(400).json({ error: 'person_id required' });
    const amountCents = parseCentsAmount(amount);
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: 'amount required' });

    const personRows = await sbQuery('people', 'GET', null, `?id=eq.${person_id}&limit=1`);
    if (!personRows?.length) return res.status(404).json({ error: 'Person not found' });
    const person = personRows[0];

    let stripeCustomerId = person.stripe_customer_id;
    if (!stripeCustomerId) {
      const customerParams = {
        metadata: {
          person_id,
          appointment_id: appointment_id || '',
          service_id: service_id || '',
        },
      };
      if (customer_name || person.first_name || person.last_name) {
        customerParams.name = customer_name || [person.first_name, person.last_name].filter(Boolean).join(' ');
      }
      if (customer_email || person.email) customerParams.email = customer_email || person.email;
      if (customer_phone || person.phone) customerParams.phone = customer_phone || person.phone;

      const stripeCustomer = await stripe.customers.create(customerParams);
      stripeCustomerId = stripeCustomer.id;
      await sbQuery('people', 'PATCH', { stripe_customer_id: stripeCustomerId }, `?id=eq.${person_id}`);
    }

    const invoiceMetadata = {
      person_id: String(person_id),
      appointment_id: appointment_id ? String(appointment_id) : '',
      service_id: service_id ? String(service_id) : '',
    };

    const draftInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: Math.max(parseInt(due_days, 10) || 7, 1),
      auto_advance: false,
      metadata: invoiceMetadata,
      description: description || undefined,
    });

    const invoiceItem = await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: draftInvoice.id,
      amount: amountCents,
      currency: currency || 'usd',
      description: description || 'Invoice item',
      metadata: invoiceMetadata,
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
    await upsertInvoiceFromStripe(finalizedInvoice, {
      person_id,
      appointment_id,
      service_id,
    });

    emitPaymentEvent('invoice_created', {
      message: `Invoice created: ${finalizedInvoice.id}`,
      payload: buildInvoicePayload({
        invoice: finalizedInvoice,
        person_id,
        appointment_id,
        service_id,
        extra: {
          invoice: finalizedInvoice,
          invoice_item_id: invoiceItem.id,
          amount: finalizedInvoice.amount_due,
        },
      }),
    });

    res.json({
      invoice_id: finalizedInvoice.id,
      id: finalizedInvoice.id,
      customer_id: stripeCustomerId,
      amount_due: finalizedInvoice.amount_due,
      amount_paid: finalizedInvoice.amount_paid,
      currency: finalizedInvoice.currency,
      status: finalizedInvoice.status,
      hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
      invoice_pdf: finalizedInvoice.invoice_pdf,
      metadata: finalizedInvoice.metadata,
      due_date: finalizedInvoice.due_date,
    });
  } catch (err) {
    console.error('[SONAR-API] create-invoice failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sonar/send-invoice
 * Finalize and send an existing Stripe invoice.
 */
router.post('/send-invoice', async (req, res) => {
  try {
    const { invoice_id } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });

    const invoice = await stripe.invoices.retrieve(invoice_id);
    let workingInvoice = invoice;
    if (workingInvoice.status === 'draft') {
      workingInvoice = await stripe.invoices.finalizeInvoice(invoice_id);
    }

    const sentInvoice = await stripe.invoices.sendInvoice(invoice_id);
    await upsertInvoiceFromStripe(sentInvoice, {
      person_id: sentInvoice.metadata?.person_id || null,
      appointment_id: sentInvoice.metadata?.appointment_id || null,
      service_id: sentInvoice.metadata?.service_id || null,
      user_id: sentInvoice.metadata?.user_id || null,
    });

    emitPaymentEvent('invoice_sent', {
      message: `Invoice sent: ${sentInvoice.id}`,
      payload: buildInvoicePayload({
        invoice: sentInvoice,
        extra: {
          invoice: sentInvoice,
        },
      }),
    });

    res.json({
      invoice_id: sentInvoice.id,
      id: sentInvoice.id,
      customer_id: sentInvoice.customer,
      amount_due: sentInvoice.amount_due,
      amount_paid: sentInvoice.amount_paid,
      currency: sentInvoice.currency,
      status: sentInvoice.status,
      hosted_invoice_url: sentInvoice.hosted_invoice_url,
      invoice_pdf: sentInvoice.invoice_pdf,
      metadata: sentInvoice.metadata,
      due_date: sentInvoice.due_date,
    });
  } catch (err) {
    console.error('[SONAR-API] send-invoice failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/create-payment', async (req, res) => {
  try {
    const { amount, currency, payment_method_type, description, person_id, appointment_id } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount (in cents) required' });

    // If person_id provided, look up their Stripe IDs
    let stripe_customer_id = null;
    let stripe_payment_method_id = null;
    if (person_id) {
      try {
        const personRows = await sbQuery('people', 'GET', null, `?id=eq.${person_id}&select=stripe_customer_id,stripe_payment_method_id&limit=1`);
        if (personRows?.length) {
          stripe_customer_id = personRows[0].stripe_customer_id;
          stripe_payment_method_id = personRows[0].stripe_payment_method_id;
        }
      } catch (dbErr) {
        console.error('[SONAR-API] Failed to look up person:', dbErr.message);
      }
    }

    const params = {
      amount: Math.round(amount),
      currency: currency || 'usd',
      payment_method_types: [payment_method_type || 'card'],
      description: description || 'Scenario Builder test payment',
    };
    if (stripe_customer_id) params.customer = stripe_customer_id;
    if (stripe_payment_method_id) params.payment_method = stripe_payment_method_id;
    if (person_id) params.metadata = { person_id };
    if (appointment_id) params.metadata = { ...(params.metadata || {}), appointment_id };

    const paymentIntent = await stripe.paymentIntents.create(params);

    // Store in Supabase payments table
    let paymentRow = null;
    try {
      const inserted = await sbQuery('payments', 'POST', {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method: payment_method_type || 'card',
        description: description || '',
        stripe_payment_intent_id: paymentIntent.id,
        person_id: person_id || null,
        appointment_id: appointment_id || null,
      });
      paymentRow = inserted?.[0] || null;
    } catch (dbErr) {
      console.error('[SONAR-API] Failed to store payment:', dbErr.message);
    }

    emitPaymentEvent('invoice_created', {
      message: `Payment created: ${paymentIntent.id}`,
      payload: buildPaymentPayload({
        payment: paymentRow,
        intent: paymentIntent,
        person_id,
        appointment_id,
      }),
    });

    if (paymentIntent.status === 'succeeded') {
      const payload = buildPaymentPayload({
        payment: paymentRow,
        intent: paymentIntent,
        person_id,
        appointment_id,
      });
      emitPaymentEvent('invoice_paid', {
        message: `Payment succeeded: ${paymentIntent.id}`,
        payload,
      });
      emitPaymentEvent('payment_succeeded', {
        message: `Payment succeeded: ${paymentIntent.id}`,
        payload,
      });
    } else if (paymentIntent.status === 'canceled' || paymentIntent.status === 'requires_payment_method') {
      emitPaymentEvent('payment_failed', {
        message: `Payment failed: ${paymentIntent.id}`,
        payload: buildPaymentPayload({
          payment: paymentRow,
          intent: paymentIntent,
          person_id,
          appointment_id,
          extra: {
            failure_message: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
        }),
        severity: 'critical',
      });
    }

    res.json({
      id: paymentIntent.id,
      object: paymentIntent.object,
      amount: paymentIntent.amount,
      amount_received: paymentIntent.amount_received,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      client_secret: paymentIntent.client_secret,
      customer: paymentIntent.customer,
      payment_method: paymentIntent.payment_method,
      description: paymentIntent.description,
      created: paymentIntent.created,
      receipt_email: paymentIntent.receipt_email,
      latest_charge: paymentIntent.latest_charge,
      metadata: paymentIntent.metadata,
    });
  } catch (err) {
    console.error('[SONAR-API] create-payment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, init };
