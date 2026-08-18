import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import {
  normalizeOptionValue,
  titleCase,
} from '../lib/leadSchema';

const SINGLE_SELECT_FIELDS = new Set([
  'source',
  'preferred_contact_method',
  'last_call_status',
  'payment_status',
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
  'special_instructions',
  'stripe_customer_id',
  'stripe_payment_method_id',
]);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
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

  return next;
};

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [justAddedLeadIds, setJustAddedLeadIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const abortRef = useRef(false);
  const pendingInsertPlacementRef = useRef(new Map());
  const shimmerTimersRef = useRef(new Map());

  const markLeadJustAdded = useCallback((leadId) => {
    if (!leadId) return;
    setJustAddedLeadIds((prev) => (prev.includes(leadId) ? prev : [...prev, leadId]));
    const existing = shimmerTimersRef.current.get(leadId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      shimmerTimersRef.current.delete(leadId);
      setJustAddedLeadIds((prev) => prev.filter((id) => id !== leadId));
    }, 1200);
    shimmerTimersRef.current.set(leadId, timeout);
  }, []);

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
    return () => {
      abortRef.current = true;
      shimmerTimersRef.current.forEach((timeout) => clearTimeout(timeout));
      shimmerTimersRef.current.clear();
    };
  }, [fetchLeads]);

  const notifyBackend = useCallback(async (eventType, record, oldRecord) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE_URL}/api/webhook/people`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
          setLeads((prev) => {
            const withoutExisting = prev.filter((row) => row.id !== payload.new.id);
            const placement = pendingInsertPlacementRef.current.get(payload.new.id);
            if (placement === 'end') {
              pendingInsertPlacementRef.current.delete(payload.new.id);
              return [...withoutExisting, payload.new];
            }
            return [payload.new, ...withoutExisting];
          });
          markLeadJustAdded(payload.new.id);
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
  }, [markLeadJustAdded, notifyBackend]);

  const createLead = async (leadData, options = {}) => {
    const payload = normalizePayload({ ...leadData }, { isCreate: true });
    const data = await api.createPerson(payload);
    markLeadJustAdded(data.id);
    if (options.placement === 'end') {
      pendingInsertPlacementRef.current.set(data.id, 'end');
      setLeads((prev) => {
        const withoutExisting = prev.filter((row) => row.id !== data.id);
        return [...withoutExisting, data];
      });
    }
    return data;
  };

  const updateLead = async (id, updates) => {
    const payload = normalizePayload(updates, { isCreate: false });
    let previousRow = null;
    setError(null);
    setLeads((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      previousRow = row;
      return { ...row, ...payload };
    }));

    let data;
    try {
      data = await api.updatePerson(id, payload);
    } catch (err) {
      if (previousRow) {
        setLeads((prev) => prev.map((row) => (row.id === id ? previousRow : row)));
      }
      throw err;
    }

    setLeads((prev) => prev.map((row) => (row.id === id ? data : row)));
    return data;
  };

  const deleteLead = async (id) => {
    await api.deletePerson(id);
    setLeads((prev) => prev.filter((row) => row.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filteredLeads = leads.filter((row) => {
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
        row.source,
        row.lead_source_detail,
        row.updated_at,
        row.last_inbound_call_at,
        row.last_outbound_call_at,
        row.last_call_status,
        row.missed_call_count,
        row.callback_due_at,
        row.payment_status,
        row.balance_due,
        row.special_instructions,
        row.stripe_customer_id,
        row.stripe_payment_method_id,
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
    justAddedLeadIds,
    loading,
    error,
    selectedId,
    setSelectedId,
    selectedLead,
    searchQuery,
    setSearchQuery,
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
