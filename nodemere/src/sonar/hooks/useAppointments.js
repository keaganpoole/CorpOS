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
    _receptionistName: receptionist?.full_name || '',
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
  const shimmerTimersRef = useRef(new Map());

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

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const businessId = businessIdRef.current || await getCurrentBusinessId();
      businessIdRef.current = businessId;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id || null;

      const [{ data: appointmentRows, error: appointmentsError }, peopleRows, { data: serviceRows, error: servicesError }] = await Promise.all([
        supabase.from('appointments').select('id,date,time,duration,status,source,notes,person_id,service_id,staff_id,business_id,receptionist_id,created_at,updated_at').eq('business_id', businessId).order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false }),
        api.getPeople(500),
        supabase.from('services').select('id,name,category,is_active').eq('business_id', businessId).order('category', { ascending: true }).order('sort_order', { ascending: true }),
      ]);
      if (appointmentsError) throw appointmentsError;
      if (servicesError) throw servicesError;

      let receptionistRows = [];
      const apiAgents = await api.getAgents();
      if (Array.isArray(apiAgents) && apiAgents.length > 0) {
        receptionistRows = apiAgents.map((agent) => ({
          id: agent.id,
          full_name: agent.full_name || agent.name || '',
          first_name: agent.first_name || agent.name || '',
          status: agent.status || null,
          avatar: agent.avatar || null,
          banner_id: agent.banner_id ?? null,
          catalog_id: agent.catalog_id ?? null,
          user_id: agent.user_id ?? userId ?? null,
          business_id: agent.business_id ?? businessId ?? null,
        }));
      }

      if (receptionistRows.length === 0) {
        if (businessId && userId) {
          const combinedResponse = await supabase
            .from('hired_receptionists')
            .select('id,full_name,first_name,status,avatar,catalog_id,user_id,business_id')
            .or(`business_id.eq.${businessId},user_id.eq.${userId}`)
            .order('full_name', { ascending: true });
          if (combinedResponse.error) throw combinedResponse.error;
          receptionistRows = combinedResponse.data || [];
        } else if (businessId) {
          const businessResponse = await supabase
            .from('hired_receptionists')
            .select('id,full_name,first_name,status,avatar,catalog_id,user_id,business_id')
            .eq('business_id', businessId)
            .order('full_name', { ascending: true });
          if (businessResponse.error) throw businessResponse.error;
          receptionistRows = businessResponse.data || [];
        } else if (userId) {
          const userResponse = await supabase
            .from('hired_receptionists')
            .select('id,full_name,first_name,status,avatar,catalog_id,user_id,business_id')
            .eq('user_id', userId)
            .order('full_name', { ascending: true });
          if (userResponse.error) throw userResponse.error;
          receptionistRows = userResponse.data || [];
        }
      }

      receptionistRows = Array.from(
        new Map((receptionistRows || []).filter((row) => row?.id != null).map((row) => [String(row.id), row])).values(),
      );

      const catalogIds = Array.from(new Set((receptionistRows || []).map((row) => row.catalog_id).filter((value) => value != null)));
      const { data: receptionistCatalogRows, error: receptionistCatalogError } = catalogIds.length
        ? await supabase.from('receptionist_catalog').select('id,avatar,banner_id').in('id', catalogIds)
        : { data: [], error: null };
      if (receptionistCatalogError) throw receptionistCatalogError;

      if (!abortRef.current) {
        setAppointments(appointmentRows || []);
        setPeople(peopleRows || []);
        setServices(serviceRows || []);
        setReceptionists(receptionistRows || []);
        setReceptionistCatalog(receptionistCatalogRows || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async (payload) => {
        if (businessIdRef.current && payload.new?.business_id && payload.new.business_id !== businessIdRef.current) return;
        if (payload.eventType !== 'DELETE') {
          const {data,error} = await supabase.from('appointments').select('*').eq('id',payload.new.id).maybeSingle();
          if (error || !data || abortRef.current) return;
          payload={...payload,new:data};
        }
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

    const data = await api.createAppointment(payload);
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

    let data;
    try {
      data = await api.updateAppointment(id, payload);
    } catch (err) {
      if (previousRow) {
        setAppointments((prev) => prev.map((row) => (row.id === id ? previousRow : row)));
      }
      throw err;
    }

    setAppointments((prev) => prev.map((row) => (row.id === id ? data : row)));
    return data;
  };

  const deleteAppointment = async (id) => {
    await api.deleteAppointment(id);
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
