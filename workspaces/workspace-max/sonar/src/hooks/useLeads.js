import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  normalizeOptionValue,
  normalizeMultiSelectValue,
  titleCase,
  DEFAULT_STATUS,
} from '../lib/leadSchema';

const SINGLE_SELECT_FIELDS = new Set([
  'status',
  'source',
  'preferred_contact_method',
  'last_call_status',
  'last_outcome',
  'last_sms_status',
  'last_email_status',
  'payment_status',
  'call_route',
]);

const TRIMMED_TEXT_FIELDS = new Set([
  'first_name',
  'last_name',
  'phone',
  'email',
  'street_address',
  'city',
  'state',
  'zip_code',
  'preferred_language',
  'best_time_to_contact',
  'lead_source_detail',
  'last_intent',
  'assigned_staff',
  'invoice_id',
]);

const normalizePayload = (payload = {}, { isCreate = false } = {}) => {
  const next = { ...payload };
  const now = new Date().toISOString();
  next.updated_at = now;
  if (isCreate && !next.created_at) next.created_at = now;

  for (const field of SINGLE_SELECT_FIELDS) {
    if (field in next && typeof next[field] === 'string') {
      next[field] = normalizeOptionValue(next[field]);
    }
  }

  if ('tags' in next) {
    next.tags = normalizeMultiSelectValue(next.tags);
  }

  for (const field of TRIMMED_TEXT_FIELDS) {
    if (typeof next[field] === 'string') {
      next[field] = next[field].trim();
    }
  }

  if (typeof next.state === 'string' && next.state) {
    next.state = next.state.toUpperCase();
  }

  if (typeof next.zip_code === 'string') {
    next.zip_code = next.zip_code.trim();
  }

  if (typeof next.balance_due === 'string' && next.balance_due !== '') {
    const parsed = parseFloat(next.balance_due.replace(/[^0-9.]/g, ''));
    next.balance_due = Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof next.missed_call_count === 'string' && next.missed_call_count !== '') {
    const parsed = parseInt(next.missed_call_count, 10);
    next.missed_call_count = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  if (!next.status) {
    next.status = DEFAULT_STATUS;
  }

  return next;
};

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const abortRef = useRef(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('people')
        .select('*')
        .order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });

      if (err) throw err;
      if (!abortRef.current) setLeads(data || []);
    } catch (err) {
      if (!abortRef.current) setError(err.message);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    abortRef.current = false;
    fetchLeads();
    return () => { abortRef.current = true; };
  }, [fetchLeads]);

  const notifyBackend = useCallback(async (eventType, record, oldRecord) => {
    try {
      await fetch('http://127.0.0.1:7878/api/webhook/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: eventType, record, old_record: oldRecord }),
      });
    } catch (err) {
      console.warn('[useLeads] Failed to notify backend:', err.message);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('people-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads((prev) => [payload.new, ...prev]);
          notifyBackend('INSERT', payload.new, null);
        } else if (payload.eventType === 'UPDATE') {
          setLeads((prev) => prev.map((row) => (row.id === payload.new.id ? payload.new : row)));
          notifyBackend('UPDATE', payload.new, null);
        } else if (payload.eventType === 'DELETE') {
          setLeads((prev) => prev.filter((row) => row.id !== payload.old.id));
          notifyBackend('DELETE', null, payload.old);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [notifyBackend]);

  const createLead = async (leadData) => {
    const payload = normalizePayload(leadData, { isCreate: true });
    const { data, error: err } = await supabase
      .from('people')
      .insert(payload)
      .select()
      .single();
    if (err) throw err;
    return data;
  };

  const updateLead = async (id, updates) => {
    const payload = normalizePayload(updates, { isCreate: false });
    const { data, error: err } = await supabase
      .from('people')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    setLeads((prev) => prev.map((row) => (row.id === id ? data : row)));
    return data;
  };

  const deleteLead = async (id) => {
    const { error: err } = await supabase
      .from('people')
      .delete()
      .eq('id', id);
    if (err) throw err;
    setLeads((prev) => prev.filter((row) => row.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filteredLeads = leads.filter((row) => {
    if (statusFilter !== 'All' && titleCase(row.status).toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (sourceFilter !== 'All' && titleCase(row.source).toLowerCase() !== sourceFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        row.first_name,
        row.last_name,
        row.phone,
        row.email,
        row.street_address,
        row.city,
        row.state,
        row.zip_code,
        row.preferred_contact_method,
        row.preferred_language,
        row.best_time_to_contact,
        row.status,
        row.source,
        row.lead_source_detail,
        Array.isArray(row.tags) ? row.tags.join(' ') : row.tags,
        row.last_intent,
        row.last_outcome,
        row.assigned_staff,
        row.payment_status,
        row.invoice_id,
        row.notes,
        row.special_instructions,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  const selectedLead = leads.find((row) => row.id === selectedId) || null;

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  return {
    leads: filteredLeads,
    allLeads: leads,
    loading,
    error,
    selectedId,
    setSelectedId,
    selectedLead,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    sortBy,
    sortDir,
    handleSort,
    createLead,
    updateLead,
    deleteLead,
    refresh: fetchLeads,
  };
}
