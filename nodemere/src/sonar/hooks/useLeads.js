import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
const sortPeople = (rows, key, direction) => [...rows].sort((left, right) => {
  const a = left?.[key];
  const b = right?.[key];
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const comparison = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? comparison : -comparison;
});

const timestampMs = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
};

const mergeLocalRow = (row, patch) => ({
  ...row,
  ...patch,
  ...('custom_fields' in patch ? {
    custom_fields: { ...(row?.custom_fields || {}), ...(patch.custom_fields || {}) },
  } : {}),
});

const mergePendingLocalUpdate = (incoming, pending) => {
  if (!incoming || !pending?.updates) return incoming;
  const incomingUpdatedAt = incoming.updated_at;
  const pendingUpdatedAt = pending.updated_at;
  return {
    ...mergeLocalRow(incoming, pending.updates),
    updated_at: timestampMs(pendingUpdatedAt) >= timestampMs(incomingUpdatedAt)
      ? (pendingUpdatedAt || incomingUpdatedAt)
      : incomingUpdatedAt,
  };
};

const mergePendingRows = (rows, pendingUpdates) => rows.map((row) => {
  const pending = pendingUpdates.get(String(row.id));
  return pending ? mergePendingLocalUpdate(row, pending) : row;
});

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
  const pendingLocalUpdatesRef = useRef(new Map());
  const saveJobsRef = useRef(new Map());
  const pendingCreatesRef = useRef(new Map());
  const pendingDeletesRef = useRef(new Set());
  const deletingRef = useRef(new Set());
  const recentCreatesRef = useRef(new Map());
  const clientKeysRef = useRef(new Map());
  const confirmedRowsRef = useRef(new Map());
  const shimmerTimersRef = useRef(new Map());

  useEffect(() => {
    const warnWhileSaving = (event) => {
      if (!pendingCreatesRef.current.size && !saveJobsRef.current.size && !deletingRef.current.size) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnWhileSaving);
    return () => window.removeEventListener('beforeunload', warnWhileSaving);
  }, []);

  const rememberConfirmed = (row) => {
    const key = String(row.id);
    const previous = confirmedRowsRef.current.get(key);
    if (!previous || timestampMs(row.updated_at) >= timestampMs(previous.updated_at)) {
      confirmedRowsRef.current.set(key, row);
    }
  };

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
      const data = [];
      let page = [];
      do {
        page = await api.getPeopleForCRM(500, data.length);
        if (!Array.isArray(page)) throw new Error('People data was not returned.');
        data.push(...page);
      } while (page.length === 500 && !abortRef.current);
      if (!Array.isArray(data)) throw new Error('People data was not returned.');
      if (!abortRef.current) {
        const loaded = data.map((row) => clientKeysRef.current.has(String(row.id))
          ? { ...row, _clientKey: clientKeysRef.current.get(String(row.id)) }
          : row);
        loaded.forEach(rememberConfirmed);
        setLeads((current) => {
          const rows = mergePendingRows(loaded.filter((row) => !pendingDeletesRef.current.has(String(row.id))), pendingLocalUpdatesRef.current);
          const fetchedIds = new Set(rows.map((row) => String(row.id)));
          const drafts = current.filter((row) => pendingCreatesRef.current.has(String(row.id)));
          const recent = [...recentCreatesRef.current.values()].filter((row) => !fetchedIds.has(String(row.id)));
          return [...drafts, ...recent, ...rows];
        });
      }
    } catch (err) {
      if (!abortRef.current) setError(err.message);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current = false;
    fetchLeads();
    return () => {
      abortRef.current = true;
      shimmerTimersRef.current.forEach((timeout) => clearTimeout(timeout));
      shimmerTimersRef.current.clear();
      pendingLocalUpdatesRef.current.forEach(({ timeout }) => clearTimeout(timeout));
      pendingLocalUpdatesRef.current.clear();
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
      console.warn("useLeads.js:event_139");
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('people-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, async (payload) => {
        // Realtime is an invalidation signal, never an unaudited PHI read.
        if (payload.eventType !== 'DELETE') {
          const data = await api.getPerson(payload.new.id);
          if (!data || abortRef.current) return;
          payload = {...payload, new:data};
        }
        if (payload.eventType === 'INSERT') {
          if (clientKeysRef.current.has(String(payload.new.id))) payload.new = { ...payload.new, _clientKey: clientKeysRef.current.get(String(payload.new.id)) };
          rememberConfirmed(payload.new);
          recentCreatesRef.current.delete(String(payload.new.id));
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
          notifyBackend('INSERT', {id:payload.new.id}, null);
        } else if (payload.eventType === 'UPDATE') {
          if (pendingDeletesRef.current.has(String(payload.new.id))) return;
          const pending = pendingLocalUpdatesRef.current.get(String(payload.new.id));
          if (pending && timestampMs(payload.new.updated_at) < timestampMs(pending.updated_at)) {
            return;
          }
          if (clientKeysRef.current.has(String(payload.new.id))) payload.new = { ...payload.new, _clientKey: clientKeysRef.current.get(String(payload.new.id)) };
          rememberConfirmed(payload.new);
          const nextRow = pending ? mergePendingLocalUpdate(payload.new, pending) : payload.new;
          setLeads((prev) => prev.map((row) => (row.id === payload.new.id ? nextRow : row)));
          notifyBackend('UPDATE', {id:payload.new.id}, null);
        } else if (payload.eventType === 'DELETE') {
          confirmedRowsRef.current.delete(String(payload.old.id));
          clientKeysRef.current.delete(String(payload.old.id));
          setLeads((prev) => prev.filter((row) => row.id !== payload.old.id));
          notifyBackend('DELETE', null, {id:payload.old.id});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [markLeadJustAdded, notifyBackend]);

  const createLead = async (leadData, options = {}) => {
    const payload = normalizePayload({ ...leadData }, { isCreate: true });
    const temporaryId = -Date.now() * 1000 - Math.floor(Math.random() * 1000);
    const draft = { ...payload, id: temporaryId, _clientKey: String(temporaryId) };
    const pendingCreate = { updates: {}, waiters: [], cancelled: false, revision: 0 };
    pendingCreatesRef.current.set(String(temporaryId), pendingCreate);
    setLeads((prev) => options.placement === 'end' ? [...prev, draft] : [draft, ...prev]);
    let data;
    try {
      data = await api.createPerson(payload);
      if (!data?.id) throw new Error('The person was not confirmed by the server.');
    } catch (err) {
      pendingCreatesRef.current.delete(String(temporaryId));
      setLeads((prev) => prev.filter((row) => row.id !== temporaryId));
      pendingCreate.waiters.forEach(({ reject }) => reject(err));
      setError(`Could not add person: ${err?.message || 'The request failed.'}`);
      throw err;
    }
    if (pendingCreate.cancelled) {
      pendingCreatesRef.current.delete(String(temporaryId));
      try { await api.deletePerson(data.id); }
      catch (err) {
        setLeads((prev) => [data, ...prev]);
        setError('Could not delete person. The record was restored.');
        throw err;
      }
      pendingCreate.waiters.forEach(({ reject }) => reject(new Error('Person was deleted.')));
      return data;
    }
    if (Object.keys(pendingCreate.updates).length) {
      try {
        let savedRevision;
        do {
          savedRevision = pendingCreate.revision;
          const saved = await api.updatePerson(data.id, pendingCreate.updates);
          if (!saved || String(saved.id) !== String(data.id)) throw new Error('The person save was not confirmed by the server.');
          data = saved;
        } while (savedRevision !== pendingCreate.revision);
      } catch (err) {
        pendingCreate.waiters.forEach(({ reject }) => reject(err));
        setError(`Could not save person changes: ${err?.message || 'The request failed.'}`);
      }
    }
    if (pendingCreate.cancelled) {
      pendingCreatesRef.current.delete(String(temporaryId));
      try { await api.deletePerson(data.id); }
      catch (err) {
        setLeads((prev) => [data, ...prev]);
        setError('Could not delete person. The record was restored.');
        throw err;
      }
      pendingCreate.waiters.forEach(({ reject }) => reject(new Error('Person was deleted.')));
      return data;
    }
    clientKeysRef.current.set(String(data.id), String(temporaryId));
    data = { ...data, _clientKey: String(temporaryId) };
    pendingCreate.waiters.forEach(({ resolve }) => resolve(data));
    pendingCreatesRef.current.delete(String(temporaryId));
    rememberConfirmed(data);
    recentCreatesRef.current.set(String(data.id), data);
    setTimeout(() => recentCreatesRef.current.delete(String(data.id)), 15000);
    setLeads((prev) => {
      const withoutExisting = prev.filter((row) => row.id !== temporaryId && row.id !== data.id);
      const draftIndex = prev.findIndex((row) => row.id === temporaryId);
      if (draftIndex < 0) return options.placement === 'end' ? [...withoutExisting, data] : [data, ...withoutExisting];
      withoutExisting.splice(Math.min(draftIndex, withoutExisting.length), 0, data);
      return withoutExisting;
    });
    setSelectedId((current) => current === temporaryId ? data.id : current);
    markLeadJustAdded(data.id);
    if (options.placement === 'end') {
      pendingInsertPlacementRef.current.set(data.id, 'end');
    }
    return data;
  };

  const updateLead = async (id, updates) => {
    const payload = normalizePayload(updates, { isCreate: false });
    const pendingCreate = pendingCreatesRef.current.get(String(id));
    if (pendingCreate) {
      pendingCreate.updates = mergeLocalRow(pendingCreate.updates, payload);
      pendingCreate.revision += 1;
      setLeads((prev) => prev.map((row) => row.id === id ? mergeLocalRow(row, payload) : row));
      return new Promise((resolve, reject) => pendingCreate.waiters.push({ resolve, reject }));
    }
    const recent = recentCreatesRef.current.get(String(id));
    if (recent) recentCreatesRef.current.set(String(id), mergeLocalRow(recent, payload));
    let previousRow = leads.find((row) => row.id === id) || null;
    const optimisticUpdatedAt = payload.updated_at;
    setError(null);
    setLeads((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      previousRow = row;
      return mergeLocalRow(row, payload);
    }));
    const pendingKey = String(id);
    const existingPending = pendingLocalUpdatesRef.current.get(pendingKey);
    if (existingPending?.timeout) clearTimeout(existingPending.timeout);
    const revision = (existingPending?.revision || 0) + 1;
    const combinedUpdates = mergeLocalRow(existingPending?.updates || {}, payload);
    pendingLocalUpdatesRef.current.set(pendingKey, {
      revision,
      updated_at: optimisticUpdatedAt,
      updates: combinedUpdates,
      timeout: null,
    });

    let data;
    const previousJob = saveJobsRef.current.get(pendingKey) || Promise.resolve();
    const saveJob = previousJob.catch(() => {}).then(async () => {
      const combined = pendingLocalUpdatesRef.current.get(pendingKey)?.updates || payload;
      const saved = await api.updatePerson(id, combined);
      if (!saved || String(saved.id) !== pendingKey) throw new Error('The person save was not confirmed by the server.');
      return saved;
    });
    saveJobsRef.current.set(pendingKey, saveJob);
    try {
      data = await saveJob;
    } catch (err) {
      if (recent) recentCreatesRef.current.set(String(id), recent);
      const pending = pendingLocalUpdatesRef.current.get(pendingKey);
      if (pending?.revision === revision) {
        if (pending.timeout) clearTimeout(pending.timeout);
        pendingLocalUpdatesRef.current.delete(pendingKey);
        const confirmed = confirmedRowsRef.current.get(pendingKey) || previousRow;
        if (confirmed) {
          setLeads((prev) => prev.map((row) => (row.id === id ? confirmed : row)));
        }
      }
      setError(`Could not save person changes: ${err.message}`);
      throw err;
    } finally {
      if (saveJobsRef.current.get(pendingKey) === saveJob) saveJobsRef.current.delete(pendingKey);
    }

    const pending = pendingLocalUpdatesRef.current.get(pendingKey);
    rememberConfirmed(data);
    if (recentCreatesRef.current.has(pendingKey)) recentCreatesRef.current.set(pendingKey, mergePendingLocalUpdate(data, pending));
    if (pending?.revision !== revision) {
      setLeads((prev) => prev.map((row) => (row.id === id ? { ...mergePendingLocalUpdate(data, pending), _clientKey: row._clientKey } : row)));
      return data;
    }

    if (pending.timeout) clearTimeout(pending.timeout);
    const confirmedPending = {
      ...pending,
      updated_at: data?.updated_at || pending.updated_at,
      timeout: setTimeout(() => pendingLocalUpdatesRef.current.delete(pendingKey), 15000),
    };
    pendingLocalUpdatesRef.current.set(pendingKey, confirmedPending);
    setLeads((prev) => prev.map((row) => (row.id === id ? { ...mergePendingLocalUpdate(data, confirmedPending), _clientKey: row._clientKey } : row)));
    return data;
  };

  const deleteLead = async (id) => {
    const pendingCreate = pendingCreatesRef.current.get(String(id));
    if (pendingCreate) {
      pendingCreate.cancelled = true;
      setLeads((prev) => prev.filter((row) => row.id !== id));
      if (selectedId === id) setSelectedId(null);
      return;
    }
    const previous = confirmedRowsRef.current.get(String(id)) || leads.find((row) => row.id === id);
    const key = String(id);
    if (pendingDeletesRef.current.has(key)) return;
    const recent = recentCreatesRef.current.get(key);
    recentCreatesRef.current.delete(key);
    pendingDeletesRef.current.add(key);
    deletingRef.current.add(key);
    setLeads((prev) => prev.filter((row) => row.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await api.deletePerson(id);
    } catch (err) {
      if (err?.status === 404) {
        confirmedRowsRef.current.delete(key);
        setTimeout(() => pendingDeletesRef.current.delete(key), 15000);
        return;
      }
      if (recent) recentCreatesRef.current.set(key, recent);
      pendingDeletesRef.current.delete(key);
      if (previous) setLeads((prev) => prev.some((row) => row.id === id) ? prev : [previous, ...prev]);
      setError(`Could not delete person: ${err.message}. The record was restored.`);
      throw err;
    } finally {
      deletingRef.current.delete(key);
    }
    confirmedRowsRef.current.delete(key);
    clientKeysRef.current.delete(key);
    setTimeout(() => pendingDeletesRef.current.delete(key), 15000);
  };

  const sortedLeads = useMemo(() => sortPeople(leads, sortBy, sortDir), [leads, sortBy, sortDir]);

  const filteredLeads = sortedLeads.filter((row) => {
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
    allLeads: sortedLeads,
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
