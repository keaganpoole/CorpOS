import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from '../lib/customFields';
import { computeEndTime, normalizeOptionValue, titleCase } from '../lib/appointmentSchema';
import { api } from '../lib/api';

const getReceptionistBannerUrl = (bannerId) => (
  bannerId ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${bannerId}.png` : null
);

const SINGLE_SELECT_FIELDS = new Set(['status', 'source']);
const TRIMMED_TEXT_FIELDS = new Set(['notes', 'time']);

const timestampMs = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
};

const mergePendingLocalUpdate = (incoming, pending) => {
  if (!incoming || !pending?.updates) return incoming;
  const incomingUpdatedAt = incoming.updated_at;
  const pendingUpdatedAt = pending.updated_at;
  return {
    ...incoming,
    ...pending.updates,
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
    if (!(field in next) || typeof next[field] !== 'string') continue;
    next[field] = field === 'status'
      ? next[field].trim().toLowerCase()
      : normalizeOptionValue(next[field]);
  }

  for (const field of TRIMMED_TEXT_FIELDS) {
    if (typeof next[field] === 'string') next[field] = next[field].trim();
  }

  if (typeof next.duration === 'string' && next.duration !== '') {
    const parsed = parseInt(next.duration, 10);
    next.duration = Number.isNaN(parsed) ? null : Math.max(0, parsed);
  }

  if ('time' in next && typeof next.time === 'string' && next.time.length > 5) {
    next.time = next.time.slice(0, 5);
  }

  return next;
};

const matchesSearch = (appointment, query, lookups) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const personName = lookups.peopleById.get(String(appointment.person_id || ''))?.display_name || '';
  const serviceName = lookups.servicesById.get(String(appointment.service_id || ''))?.name || '';
  const receptionistName = lookups.receptionistsById.get(String(appointment.receptionist_id || ''))?.full_name || '';
  const searchable = [
    personName,
    serviceName,
    appointment.date,
    appointment.time,
    appointment.status,
    appointment.source,
    appointment.notes,
    receptionistName,
    appointment.created_at,
    appointment.updated_at,
  ].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(q);
};

const decorateAppointment = (appointment, lookups) => {
  const person = lookups.peopleById.get(String(appointment.person_id || ''));
  const service = lookups.servicesById.get(String(appointment.service_id || ''));
  const receptionistKey = String(appointment.receptionist_id || '');
  const receptionist =
    lookups.receptionistsById.get(receptionistKey) ||
    lookups.receptionistsByCatalogId.get(receptionistKey) ||
    null;
  const receptionistCatalog = receptionist?.catalog_id ? lookups.receptionistCatalogById.get(String(receptionist.catalog_id)) : null;
  const bannerUrl = getReceptionistBannerUrl(receptionistCatalog?.banner_id || receptionist?.banner_id || null);
  return {
    ...appointment,
    _personName: person?.display_name || '',
    _serviceName: service?.name || '',
    _receptionistName: receptionist?.first_name || receptionist?.full_name?.split(/\s+/)[0] || '',
    _receptionistAvatar: receptionist?.avatar || receptionistCatalog?.avatar || bannerUrl || '',
    _receptionistBannerUrl: bannerUrl || receptionist?.avatar || receptionistCatalog?.avatar || '',
    _receptionistCatalogId: receptionist?.catalog_id || null,
    _endTime: computeEndTime(appointment.time, appointment.duration),
  };
};

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [people, setPeople] = useState([]);
  const [services, setServices] = useState([]);
  const [receptionists, setReceptionists] = useState([]);
  const [receptionistCatalog, setReceptionistCatalog] = useState([]);
  const [justAddedAppointmentIds, setJustAddedAppointmentIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const abortRef = useRef(false);
  const businessIdRef = useRef(null);
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

  const appointmentError = (err) => err?.detail?.reason || err?.message || 'The request failed.';

  const lookups = useMemo(() => {
    const peopleById = new Map((people || []).map((person) => {
      const displayName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.phone || person.email || 'Untitled Person';
      return [String(person.id), { ...person, display_name: displayName }];
    }));
    const servicesById = new Map((services || []).map((service) => [String(service.id), service]));
    const receptionistsById = new Map((receptionists || []).map((receptionist) => [String(receptionist.id), receptionist]));
    const receptionistsByCatalogId = new Map((receptionists || [])
      .filter((receptionist) => receptionist.catalog_id != null)
      .map((receptionist) => [String(receptionist.catalog_id), receptionist]));
    const receptionistCatalogById = new Map((receptionistCatalog || []).map((entry) => [String(entry.id), entry]));
    return { peopleById, servicesById, receptionistsById, receptionistsByCatalogId, receptionistCatalogById };
  }, [people, services, receptionists, receptionistCatalog]);

  const markJustAdded = useCallback((appointmentId) => {
    if (!appointmentId) return;
    setJustAddedAppointmentIds((prev) => (prev.includes(appointmentId) ? prev : [...prev, appointmentId]));
    const existing = shimmerTimersRef.current.get(appointmentId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      shimmerTimersRef.current.delete(appointmentId);
      setJustAddedAppointmentIds((prev) => prev.filter((id) => id !== appointmentId));
    }, 1200);
    shimmerTimersRef.current.set(appointmentId, timeout);
  }, []);

  const getCreateContext = useCallback(async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not found');
    const businessId = await getCurrentBusinessId();
    businessIdRef.current = businessId;
    return { userId: user.id, businessId };
  }, []);

  const fetchAppointments = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    if (!background) setError(null);
    try {
      const appointmentRows = await api.getAppointmentsForCRM(500);
      if (!abortRef.current && Array.isArray(appointmentRows)) {
        const loaded = appointmentRows.map((row) => clientKeysRef.current.has(String(row.id))
          ? { ...row, _clientKey: clientKeysRef.current.get(String(row.id)) }
          : row);
        loaded.forEach(rememberConfirmed);
        setAppointments((current) => {
          const rows = mergePendingRows(loaded.filter((row) => !pendingDeletesRef.current.has(String(row.id))), pendingLocalUpdatesRef.current);
          const fetchedIds = new Set(rows.map((row) => String(row.id)));
          const drafts = current.filter((row) => pendingCreatesRef.current.has(String(row.id)));
          const recent = [...recentCreatesRef.current.values()].filter((row) => !fetchedIds.has(String(row.id)));
          return [...drafts, ...recent, ...rows];
        });
        if (!background) setLoading(false);
      }
      if (!abortRef.current && !Array.isArray(appointmentRows)) {
        setError('Could not refresh appointments. Showing the last loaded records.');
        if (!background) setLoading(false);
        return;
      }

      const [peopleResult, servicesResult, agentsResult] = await Promise.allSettled([
        api.getPeopleForCRM(500),
        api.getServices(),
        api.getAgents(),
      ]);
      if (abortRef.current) return;

      const peopleRows = peopleResult.status === 'fulfilled' && Array.isArray(peopleResult.value) ? peopleResult.value : null;
      const serviceRows = servicesResult.status === 'fulfilled' && Array.isArray(servicesResult.value) ? servicesResult.value : null;
      const apiAgents = agentsResult.status === 'fulfilled' && Array.isArray(agentsResult.value) ? agentsResult.value : null;
      const receptionistRows = Array.from(
        new Map((apiAgents || [])
          .map((agent) => ({
            id: agent.id,
            full_name: agent.full_name || agent.name || '',
            first_name: agent.first_name || agent.name || '',
            status: agent.status || null,
            is_active: agent.is_active !== false,
            direction: agent.direction || 'all',
            avatar: agent.avatar || null,
            banner_id: agent.banner_id ?? null,
            catalog_id: agent.catalog_id ?? null,
            user_id: agent.user_id ?? null,
            business_id: agent.business_id ?? null,
          }))
          .filter((row) => row?.id != null)
          .map((row) => [String(row.id), row])).values(),
      );

      if (peopleRows) setPeople(peopleRows);
      if (serviceRows) setServices(serviceRows);
      if (apiAgents) setReceptionists(receptionistRows);
      if (receptionistRows.length) {
        const catalogResult = await api.getReceptionistCatalog();
        if (abortRef.current) return;
        const catalogIds = new Set(receptionistRows.map((row) => row.catalog_id).filter((value) => value != null).map(String));
        setReceptionistCatalog(Array.isArray(catalogResult)
          ? catalogResult.filter((row) => row?.id != null && catalogIds.has(String(row.id)))
          : []);
      } else {
        setReceptionistCatalog([]);
      }
    } catch (err) {
      if (!abortRef.current) setError(err.message);
    } finally {
      if (!abortRef.current && !background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current = false;
    fetchAppointments();
    return () => {
      abortRef.current = true;
      shimmerTimersRef.current.forEach((timeout) => clearTimeout(timeout));
      shimmerTimersRef.current.clear();
      pendingLocalUpdatesRef.current.forEach(({ timeout }) => clearTimeout(timeout));
      pendingLocalUpdatesRef.current.clear();
    };
  }, [fetchAppointments]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async (payload) => {
        if (businessIdRef.current && payload.new?.business_id && payload.new.business_id !== businessIdRef.current) return;
        await fetchAppointments(true);
        if (payload.eventType === 'INSERT' && payload.new?.id) markJustAdded(payload.new.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAppointments, markJustAdded]);

  const createAppointment = async (appointmentData, options = {}) => {
    const temporaryId = `pending-${crypto.randomUUID()}`;
    const draft = { ...normalizePayload(appointmentData, { isCreate: true }), id: temporaryId, _clientKey: temporaryId };
    const pendingCreate = { updates: {}, waiters: [], cancelled: false, revision: 0 };
    pendingCreatesRef.current.set(temporaryId, pendingCreate);
    setAppointments((prev) => options.placement === 'end' ? [...prev, draft] : [draft, ...prev]);
    let data;
    try {
      const { userId, businessId } = await getCreateContext();
      const payload = { ...draft, user_id: userId, business_id: businessId };
      delete payload.id;
      delete payload._clientKey;
      data = await api.createAppointment(payload);
      if (!data?.id) throw new Error('The appointment was not confirmed by the server.');
    } catch (err) {
      pendingCreatesRef.current.delete(temporaryId);
      setAppointments((prev) => prev.filter((row) => row.id !== temporaryId));
      pendingCreate.waiters.forEach(({ reject }) => reject(err));
      setError(`Could not add appointment: ${appointmentError(err)}`);
      throw err;
    }
    if (pendingCreate.cancelled) {
      pendingCreatesRef.current.delete(temporaryId);
      try { await api.deleteAppointment(data.id); }
      catch (err) {
        setAppointments((prev) => [data, ...prev]);
        setError('Could not delete appointment. The record was restored.');
        throw err;
      }
      pendingCreate.waiters.forEach(({ reject }) => reject(new Error('Appointment was deleted.')));
      return data;
    }
    if (Object.keys(pendingCreate.updates).length) {
      try {
        let savedRevision;
        do {
          savedRevision = pendingCreate.revision;
          const saved = await api.updateAppointment(data.id, pendingCreate.updates);
          if (!saved || String(saved.id) !== String(data.id)) throw new Error('The appointment save was not confirmed by the server.');
          data = saved;
        } while (savedRevision !== pendingCreate.revision);
      } catch (err) {
        pendingCreate.waiters.forEach(({ reject }) => reject(err));
        setError(`Could not save appointment changes: ${appointmentError(err)}`);
      }
    }
    if (pendingCreate.cancelled) {
      pendingCreatesRef.current.delete(temporaryId);
      try { await api.deleteAppointment(data.id); }
      catch (err) {
        setAppointments((prev) => [data, ...prev]);
        setError('Could not delete appointment. The record was restored.');
        throw err;
      }
      pendingCreate.waiters.forEach(({ reject }) => reject(new Error('Appointment was deleted.')));
      return data;
    }
    clientKeysRef.current.set(String(data.id), temporaryId);
    data = { ...data, _clientKey: temporaryId };
    pendingCreate.waiters.forEach(({ resolve }) => resolve(data));
    pendingCreatesRef.current.delete(temporaryId);
    rememberConfirmed(data);
    recentCreatesRef.current.set(String(data.id), data);
    setTimeout(() => recentCreatesRef.current.delete(String(data.id)), 15000);
    setAppointments((prev) => {
      const withoutExisting = prev.filter((row) => row.id !== temporaryId && row.id !== data.id);
      const draftIndex = prev.findIndex((row) => row.id === temporaryId);
      if (draftIndex < 0) return options.placement === 'end' ? [...withoutExisting, data] : [data, ...withoutExisting];
      withoutExisting.splice(Math.min(draftIndex, withoutExisting.length), 0, data);
      return withoutExisting;
    });
    setSelectedId((current) => current === temporaryId ? data.id : current);
    markJustAdded(data.id);
    if (options.placement === 'end') {
      pendingInsertPlacementRef.current.set(data.id, 'end');
    }
    return data;
  };

  const updateAppointment = async (id, updates) => {
    const payload = normalizePayload(updates, { isCreate: false });
    const pendingCreate = pendingCreatesRef.current.get(String(id));
    if (pendingCreate) {
      pendingCreate.updates = { ...pendingCreate.updates, ...payload };
      pendingCreate.revision += 1;
      setAppointments((prev) => prev.map((row) => row.id === id ? { ...row, ...payload } : row));
      return new Promise((resolve, reject) => pendingCreate.waiters.push({ resolve, reject }));
    }
    const recent = recentCreatesRef.current.get(String(id));
    if (recent) recentCreatesRef.current.set(String(id), { ...recent, ...payload });
    let previousRow = appointments.find((row) => row.id === id) || null;
    setError(null);
    setAppointments((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      previousRow = row;
      return { ...row, ...payload };
    }));
    const pendingKey = String(id);
    const existingPending = pendingLocalUpdatesRef.current.get(pendingKey);
    if (existingPending?.timeout) clearTimeout(existingPending.timeout);
    const revision = (existingPending?.revision || 0) + 1;
    const combinedUpdates = { ...(existingPending?.updates || {}), ...payload };
    pendingLocalUpdatesRef.current.set(pendingKey, {
      revision,
      updated_at: payload.updated_at,
      updates: combinedUpdates,
      timeout: null,
    });

    let data;
    const previousJob = saveJobsRef.current.get(pendingKey) || Promise.resolve();
    const saveJob = previousJob.catch(() => {}).then(async () => {
      const combined = pendingLocalUpdatesRef.current.get(pendingKey)?.updates || payload;
      const saved = await api.updateAppointment(id, combined);
      if (!saved || String(saved.id) !== pendingKey) throw new Error('The appointment save was not confirmed by the server.');
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
          setAppointments((prev) => prev.map((row) => (row.id === id ? confirmed : row)));
        }
      }
      setError(`Could not save appointment changes: ${appointmentError(err)}`);
      throw err;
    } finally {
      if (saveJobsRef.current.get(pendingKey) === saveJob) saveJobsRef.current.delete(pendingKey);
    }

    const pending = pendingLocalUpdatesRef.current.get(pendingKey);
    rememberConfirmed(data);
    if (recentCreatesRef.current.has(pendingKey)) recentCreatesRef.current.set(pendingKey, mergePendingLocalUpdate(data, pending));
    if (pending?.revision !== revision) {
      setAppointments((prev) => prev.map((row) => (row.id === id ? { ...mergePendingLocalUpdate(data, pending), _clientKey: row._clientKey } : row)));
      return data;
    }

    if (pending.timeout) clearTimeout(pending.timeout);
    const confirmedPending = {
      ...pending,
      updated_at: data?.updated_at || pending.updated_at,
      timeout: setTimeout(() => pendingLocalUpdatesRef.current.delete(pendingKey), 15000),
    };
    pendingLocalUpdatesRef.current.set(pendingKey, confirmedPending);
    setAppointments((prev) => prev.map((row) => (row.id === id ? { ...mergePendingLocalUpdate(data, confirmedPending), _clientKey: row._clientKey } : row)));
    return data;
  };

  const deleteAppointment = async (id) => {
    const pendingCreate = pendingCreatesRef.current.get(String(id));
    if (pendingCreate) {
      pendingCreate.cancelled = true;
      setAppointments((prev) => prev.filter((row) => row.id !== id));
      if (selectedId === id) setSelectedId(null);
      return;
    }
    const previous = confirmedRowsRef.current.get(String(id)) || appointments.find((row) => row.id === id);
    const key = String(id);
    if (pendingDeletesRef.current.has(key)) return;
    const recent = recentCreatesRef.current.get(key);
    recentCreatesRef.current.delete(key);
    pendingDeletesRef.current.add(key);
    deletingRef.current.add(key);
    setAppointments((prev) => prev.filter((row) => row.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await api.deleteAppointment(id);
    } catch (err) {
      if (err?.status === 404) {
        confirmedRowsRef.current.delete(key);
        setTimeout(() => pendingDeletesRef.current.delete(key), 15000);
        return;
      }
      pendingDeletesRef.current.delete(key);
      if (recent) recentCreatesRef.current.set(key, recent);
      if (previous) setAppointments((prev) => prev.some((row) => row.id === id) ? prev : [previous, ...prev]);
      setError(`Could not delete appointment: ${appointmentError(err)}. The record was restored.`);
      throw err;
    } finally {
      deletingRef.current.delete(key);
    }
    confirmedRowsRef.current.delete(key);
    clientKeysRef.current.delete(key);
    setTimeout(() => pendingDeletesRef.current.delete(key), 15000);
  };

  const allAppointments = useMemo(
    () => appointments.map((appointment) => decorateAppointment(appointment, lookups)),
    [appointments, lookups],
  );

  const filteredAppointments = useMemo(() => allAppointments.filter((appointment) => {
    if (sourceFilter !== 'All' && titleCase(appointment.source).toLowerCase() !== sourceFilter.toLowerCase()) return false;
    return matchesSearch(appointment, searchQuery, lookups);
  }), [allAppointments, lookups, searchQuery, sourceFilter]);

  const selectedAppointment = allAppointments.find((row) => row.id === selectedId) || null;

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  return {
    appointments: filteredAppointments,
    allAppointments,
    people,
    services,
    receptionists,
    lookups,
    justAddedAppointmentIds,
    loading,
    error,
    selectedId,
    setSelectedId,
    selectedAppointment,
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    sortBy,
    sortDir,
    handleSort,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refresh: () => fetchAppointments(),
  };
}
