import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from '../lib/appointmentCustomFields';
import { computeEndTime, normalizeOptionValue, titleCase } from '../lib/appointmentSchema';

const SINGLE_SELECT_FIELDS = new Set(['status', 'source']);
const TRIMMED_TEXT_FIELDS = new Set(['client_name', 'assigned_receptionist', 'notes', 'time']);

const normalizePayload = (payload = {}, { isCreate = false } = {}) => {
  const next = { ...payload };
  const now = new Date().toISOString();
  next.updated_at = now;
  if (isCreate && !next.created_at) next.created_at = now;

  for (const field of SINGLE_SELECT_FIELDS) {
    if (field in next && typeof next[field] === 'string') next[field] = normalizeOptionValue(next[field]);
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

  if ((next.time != null || next.duration != null) && !('end_time' in next)) {
    next.end_time = computeEndTime(next.time, next.duration);
  }

  return next;
};

const matchesSearch = (appointment, query, lookups) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const personName = lookups.peopleById.get(String(appointment.person_id || ''))?.display_name || '';
  const serviceName = lookups.servicesById.get(String(appointment.service_id || ''))?.name || '';
  const receptionistName = lookups.receptionistsById.get(String(appointment.assigned_receptionist_id || ''))?.full_name || '';
  const searchable = [
    appointment.client_name,
    personName,
    serviceName,
    appointment.date,
    appointment.time,
    appointment.status,
    appointment.source,
    appointment.notes,
    appointment.assigned_receptionist,
    receptionistName,
    appointment.created_at,
    appointment.updated_at,
  ].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(q);
};

const decorateAppointment = (appointment, lookups) => {
  const person = lookups.peopleById.get(String(appointment.person_id || ''));
  const service = lookups.servicesById.get(String(appointment.service_id || ''));
  const receptionist = lookups.receptionistsById.get(String(
    appointment.assigned_receptionist_id || appointment.receptionist_id || ''
  ));
  return {
    ...appointment,
    _personName: person?.display_name || appointment.client_name || '',
    _serviceName: service?.name || '',
    _receptionistName: receptionist?.full_name || appointment.assigned_receptionist || '',
    _endTime: computeEndTime(appointment.time, appointment.duration),
  };
};

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [people, setPeople] = useState([]);
  const [services, setServices] = useState([]);
  const [receptionists, setReceptionists] = useState([]);
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
  const shimmerTimersRef = useRef(new Map());

  const lookups = useMemo(() => {
    const peopleById = new Map((people || []).map((person) => {
      const displayName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.phone || person.email || 'Untitled Person';
      return [String(person.id), { ...person, display_name: displayName }];
    }));
    const servicesById = new Map((services || []).map((service) => [String(service.id), service]));
    const receptionistsById = new Map((receptionists || []).map((receptionist) => [String(receptionist.id), receptionist]));
    return { peopleById, servicesById, receptionistsById };
  }, [people, services, receptionists]);

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

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const businessId = businessIdRef.current || await getCurrentBusinessId();
      businessIdRef.current = businessId;
      const [{ data: appointmentRows, error: appointmentsError }, { data: peopleRows, error: peopleError }, { data: serviceRows, error: servicesError }, { data: receptionistRows, error: receptionistError }] = await Promise.all([
        supabase.from('appointments').select('*').eq('business_id', businessId).order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false }),
        supabase.from('people').select('id,first_name,last_name,phone,email').eq('business_id', businessId).order('updated_at', { ascending: false }),
        supabase.from('services').select('id,name,category,is_active').eq('business_id', businessId).order('category', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('hired_receptionists').select('id,full_name,first_name,status').eq('business_id', businessId).order('full_name', { ascending: true }),
      ]);
      if (appointmentsError) throw appointmentsError;
      if (peopleError) throw peopleError;
      if (servicesError) throw servicesError;
      if (receptionistError) throw receptionistError;
      if (!abortRef.current) {
        setAppointments(appointmentRows || []);
        setPeople(peopleRows || []);
        setServices(serviceRows || []);
        setReceptionists(receptionistRows || []);
      }
    } catch (err) {
      if (!abortRef.current) setError(err.message);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    abortRef.current = false;
    fetchAppointments();
    return () => {
      abortRef.current = true;
      shimmerTimersRef.current.forEach((timeout) => clearTimeout(timeout));
      shimmerTimersRef.current.clear();
    };
  }, [fetchAppointments]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        if (businessIdRef.current && payload.new?.business_id && payload.new.business_id !== businessIdRef.current) return;
        if (payload.eventType === 'INSERT') {
          setAppointments((prev) => {
            const withoutExisting = prev.filter((row) => row.id !== payload.new.id);
            const placement = pendingInsertPlacementRef.current.get(payload.new.id);
            if (placement === 'end') {
              pendingInsertPlacementRef.current.delete(payload.new.id);
              return [...withoutExisting, payload.new];
            }
            return [payload.new, ...withoutExisting];
          });
          markJustAdded(payload.new.id);
        } else if (payload.eventType === 'UPDATE') {
          setAppointments((prev) => prev.map((row) => (row.id === payload.new.id ? payload.new : row)));
        } else if (payload.eventType === 'DELETE') {
          setAppointments((prev) => prev.filter((row) => row.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [markJustAdded]);

  const createAppointment = async (appointmentData, options = {}) => {
    const { userId, businessId } = await getCreateContext();
    const payload = normalizePayload({
      ...appointmentData,
      user_id: userId,
      business_id: businessId,
    }, { isCreate: true });

    const { data, error: err } = await supabase
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (err) throw err;
    markJustAdded(data.id);
    if (options.placement === 'end') {
      pendingInsertPlacementRef.current.set(data.id, 'end');
      setAppointments((prev) => {
        const withoutExisting = prev.filter((row) => row.id !== data.id);
        return [...withoutExisting, data];
      });
    }
    return data;
  };

  const updateAppointment = async (id, updates) => {
    const payload = normalizePayload(updates, { isCreate: false });
    let previousRow = null;
    setError(null);
    setAppointments((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      previousRow = row;
      return { ...row, ...payload };
    }));

    const { data, error: err } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (err) {
      if (previousRow) {
        setAppointments((prev) => prev.map((row) => (row.id === id ? previousRow : row)));
      }
      throw err;
    }

    setAppointments((prev) => prev.map((row) => (row.id === id ? data : row)));
    return data;
  };

  const deleteAppointment = async (id) => {
    const { error: err } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    if (err) throw err;
    setAppointments((prev) => prev.filter((row) => row.id !== id));
    if (selectedId === id) setSelectedId(null);
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
    refresh: fetchAppointments,
  };
}
