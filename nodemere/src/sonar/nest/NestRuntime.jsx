import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useCallLogs } from '../contexts/CallLogsContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  DEFAULT_NEST_CONCEPTS,
  getDailyNestQuote,
  getNestConcept,
} from './nestRegistry';

const NestContext = createContext(null);
const MAX_HISTORY = 50;
const ACTIVE_CALL_STATUSES = new Set(['initiated', 'queued', 'ringing', 'in-progress', 'in_progress', 'ongoing', 'answered', 'connected']);
const TERMINAL_CALL_STATUSES = new Set(['completed', 'failed', 'missed', 'busy', 'no-answer', 'no_answer', 'canceled', 'cancelled']);
const PAYMENT_SUCCESS = new Set(['paid', 'succeeded', 'successful', 'complete', 'completed']);
const PAYMENT_FAILED = new Set(['failed', 'declined', 'canceled', 'cancelled']);
const PRIORITY = { routine: 1, major: 2, critical: 3 };

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const sanitizeHistoryEvent = (event) => {
  if (!event || typeof event !== 'object') return null;
  const rawMessage = typeof event.message === 'string' ? event.message.trim() : '';
  const looksLikePayload = rawMessage.startsWith("{'payload'")
    || rawMessage.startsWith('{"payload"')
    || rawMessage === '[object Object]';
  return { ...event, message: looksLikePayload ? '' : rawMessage };
};

const normalizeStatus = (row = {}) => String(row.status || row.call_status || row.call_successful || '').trim().toLowerCase();
const eventStamp = (row = {}) => row.updated_at || row.ended_at || row.started_at || row.event_timestamp || row.created_at || new Date().toISOString();
const eventId = (source, row, type) => `${source}:${row?.id || 'unknown'}:${type}:${eventStamp(row)}`;
const displayName = (row = {}) => {
  const joined = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return joined || row.name || row.caller_name || row.customer_name || '';
};

const formatAppointmentWhen = (row = {}) => [row.date, row.time].filter(Boolean).join(' · ');

const formatAmount = (row = {}) => {
  const raw = row.amount ?? row.amount_received ?? row.amount_total;
  if (raw === null || raw === undefined || raw === '') return '';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return String(raw);
  const normalized = numeric > 10000 ? numeric / 100 : numeric;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(row.currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(normalized);
  } catch {
    return `$${normalized.toFixed(2)}`;
  }
};

const durationForEvent = (event) => {
  if (event?.duration_ms) return event.duration_ms;
  if (event?.category === 'messages') return 12000;
  if (event?.priority === 'critical') return 14000;
  if (event?.priority === 'major') return 9500;
  return 7000;
};

const normalizeRealtimePayload = (table, payload, history = []) => {
  const row = payload?.new || {};
  const old = payload?.old || {};
  const change = payload?.eventType || payload?.event || 'UPDATE';
  const alreadyHadCategory = (category) => history.some((event) => event.category === category);
  const alreadyHadEvent = (eventType) => history.some((event) => event.event_type === eventType);

  if (table === 'appointments') {
    const nextStatus = normalizeStatus(row);
    const oldStatus = normalizeStatus(old);
    let type = 'appointment_updated';
    let title = 'Appointment updated';
    let priority = 'routine';
    if (change === 'INSERT') {
      type = alreadyHadCategory('appointments') ? 'appointment_booked' : 'first_appointment';
      title = type === 'first_appointment' ? 'First appointment booked' : 'Appointment booked';
      priority = type === 'first_appointment' ? 'major' : 'routine';
    } else if (['cancelled', 'canceled'].includes(nextStatus) && nextStatus !== oldStatus) {
      type = 'appointment_cancelled';
      title = 'Appointment cancelled';
    } else if (nextStatus === 'completed' && nextStatus !== oldStatus) {
      type = 'appointment_completed';
      title = 'Appointment completed';
    } else if (nextStatus === 'missed' && nextStatus !== oldStatus) {
      type = 'appointment_missed';
      title = 'Appointment missed';
      priority = 'major';
    } else if (row.date !== old.date || row.time !== old.time) {
      type = 'appointment_rescheduled';
      title = 'Appointment rescheduled';
    }
    return {
      id: eventId(table, row, type), category: type === 'first_appointment' ? 'milestones' : 'appointments',
      event_type: type, title, message: formatAppointmentWhen(row), priority, occurred_at: eventStamp(row), payload: row,
    };
  }

  if (table === 'people' && change === 'INSERT') {
    const first = !alreadyHadCategory('people');
    return {
      id: eventId(table, row, first ? 'first_person' : 'person_added'),
      category: first ? 'milestones' : 'people', event_type: first ? 'first_person' : 'person_added',
      title: first ? 'First person added' : 'New person added', message: displayName(row),
      priority: first ? 'major' : 'routine', occurred_at: eventStamp(row), payload: row,
    };
  }

  if (table === 'payments') {
    const status = normalizeStatus(row);
    const oldStatus = normalizeStatus(old);
    if (status === oldStatus && change !== 'INSERT') return null;
    if (PAYMENT_SUCCESS.has(status)) {
      return {
        id: eventId(table, row, 'payment_received'), category: 'payments', event_type: 'payment_received',
        title: 'Payment received', message: formatAmount(row), priority: 'major', occurred_at: eventStamp(row), payload: row,
      };
    }
    if (PAYMENT_FAILED.has(status)) {
      return {
        id: eventId(table, row, 'payment_failed'), category: 'warnings', event_type: 'payment_failed',
        title: 'Payment failed', message: formatAmount(row), priority: 'critical', occurred_at: eventStamp(row), payload: row,
      };
    }
  }

  if (table === 'hired_receptionists' && change === 'INSERT') {
    const first = !alreadyHadEvent('receptionist_hired');
    return {
      id: eventId(table, row, 'receptionist_hired'), category: 'milestones', event_type: 'receptionist_hired',
      title: first ? 'First receptionist hired' : 'Receptionist hired', message: row.name || row.receptionist_name || 'Your front desk is growing',
      priority: first ? 'major' : 'routine', occurred_at: eventStamp(row), payload: row,
    };
  }

  if (table === 'nest_events' && change === 'INSERT') {
    return {
      id: row.id || eventId(table, row, row.event_type || 'workflow_event'),
      category: row.category || 'workflows', event_type: row.event_type || 'workflow_event',
      title: row.title || 'Workflow activity', message: row.message || '',
      priority: row.priority || 'routine', occurred_at: row.occurred_at || eventStamp(row), payload: row.payload || row,
    };
  }

  if (table === 'businesses' && change === 'UPDATE') {
    const used = Number(row.used_call_seconds ?? row.call_seconds_used ?? row.usage_seconds ?? 0);
    const included = Number(row.included_call_seconds ?? row.call_seconds_included ?? row.usage_limit_seconds ?? 0);
    const oldUsed = Number(old.used_call_seconds ?? old.call_seconds_used ?? old.usage_seconds ?? 0);
    if (included > 0) {
      const ratio = used / included;
      const oldRatio = oldUsed / included;
      if (ratio >= 1 && oldRatio < 1) {
        return {
          id: eventId(table, row, 'minutes_exhausted'), category: 'warnings', event_type: 'minutes_exhausted',
          title: 'Call minutes exhausted', message: 'Review your plan to keep calls running', priority: 'critical', occurred_at: eventStamp(row), payload: row,
        };
      }
      if (ratio >= 0.8 && oldRatio < 0.8) {
        return {
          id: eventId(table, row, 'usage_warning'), category: 'warnings', event_type: 'usage_warning',
          title: 'Call minutes running low', message: `${Math.max(0, Math.ceil((included - used) / 60))} minutes remaining`,
          priority: 'critical', occurred_at: eventStamp(row), payload: row,
        };
      }
    }
  }

  return null;
};

const callRow = (call) => call?.raw || call || {};

const callLifecycleEvent = (call, status) => {
  const row = callRow(call);
  const direction = String(row.direction || call?.direction || 'incoming').toLowerCase();
  const name = displayName(row) || call?.name || (direction.startsWith('out') ? 'Outgoing call' : 'Incoming call');
  const failed = status === 'failed';
  const missed = ['missed', 'busy', 'no-answer', 'no_answer'].includes(status);
  return {
    id: eventId('call_logs', row, failed ? 'call_failed' : missed ? 'call_missed' : 'call_completed'),
    category: failed ? 'warnings' : 'calls',
    event_type: failed ? 'call_failed' : missed ? 'call_missed' : 'call_completed',
    title: failed ? 'Call needs attention' : missed ? 'Call missed' : 'Call completed',
    message: name,
    priority: failed ? 'critical' : missed ? 'major' : 'routine',
    occurred_at: eventStamp(row),
    payload: row,
  };
};

export const NestProvider = ({ children, businessId, tasklistState }) => {
  const { session } = useAuth();
  const { calls, loading: callsLoading } = useCallLogs();
  const [history, setHistory] = useState([]);
  const [queue, setQueue] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [previewEvent, setPreviewEvent] = useState(null);
  const [liveCall, setLiveCall] = useState(null);
  const [introStarted, setIntroStarted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('nodemere:nest:privacy') === 'true');
  const [selectedConcepts, setSelectedConcepts] = useState(() => ({
    ...DEFAULT_NEST_CONCEPTS,
    ...safeJsonParse(localStorage.getItem('nodemere:nest:concepts'), {}),
  }));
  const historyRef = useRef([]);
  const activeRef = useRef(null);
  const seenRef = useRef(new Set());
  const callsBaselineRef = useRef(null);
  const tasklistBaselineRef = useRef(null);
  const timerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const businessKey = businessId || session?.user?.id || 'anonymous';
  const historyStorageKey = `nodemere:nest:history:${businessKey}`;

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { activeRef.current = activeEvent; }, [activeEvent]);

  const persistHistory = useCallback((events) => {
    try { localStorage.setItem(historyStorageKey, JSON.stringify(events.slice(0, MAX_HISTORY))); } catch { /* storage is optional */ }
  }, [historyStorageKey]);

  const addToHistory = useCallback((event) => {
    setHistory((current) => {
      const next = [event, ...current.filter((item) => item.id !== event.id)].slice(0, MAX_HISTORY);
      persistHistory(next);
      return next;
    });
  }, [persistHistory]);

  const enqueue = useCallback((incoming, { preview = false } = {}) => {
    if (!incoming?.id || (!preview && seenRef.current.has(incoming.id))) return;
    const event = {
      priority: 'routine',
      occurred_at: new Date().toISOString(),
      ...incoming,
      preview,
    };
    if (!preview) {
      seenRef.current.add(event.id);
      addToHistory(event);
    }

    const currentActive = activeRef.current;
    if (event.priority === 'critical' && currentActive && PRIORITY[currentActive.priority] < PRIORITY.critical) {
      setQueue((current) => [currentActive, ...current]);
      setActiveEvent(event);
      return;
    }
    if (!currentActive) {
      setActiveEvent(event);
      return;
    }
    setQueue((current) => {
      const next = [...current, event];
      return next.sort((a, b) => PRIORITY[b.priority] - PRIORITY[a.priority]);
    });
  }, [addToHistory]);

  const previewConcept = useCallback((concept, category) => {
    const categoryDefinition = category;
    const event = {
      id: `preview:${concept.id}:${Date.now()}`,
      category: categoryDefinition.id,
      event_type: `preview_${categoryDefinition.id}`,
      title: categoryDefinition.sample.title,
      message: categoryDefinition.sample.message,
      priority: categoryDefinition.sample.priority,
      persistent: Boolean(categoryDefinition.sample.persistent),
      occurred_at: categoryDefinition.sample.occurred_at || new Date().toISOString(),
      concept_id: concept.id,
      duration_ms: 7600,
      preview: true,
    };
    // Studio previews are an independent visual layer: they replace the Nest
    // immediately without entering history or interrupting real event queueing.
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    setPreviewEvent(event);
    previewTimerRef.current = window.setTimeout(() => setPreviewEvent(null), event.duration_ms);
  }, []);

  useEffect(() => () => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
  }, []);

  useEffect(() => {
    if (!activeEvent) {
      if (queue.length) {
        const [next, ...rest] = queue;
        setQueue(rest);
        setActiveEvent(next);
      }
      return undefined;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setActiveEvent(null), durationForEvent(activeEvent));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [activeEvent, queue]);

  useEffect(() => {
    const localHistory = safeJsonParse(localStorage.getItem(historyStorageKey), []);
    const localEvents = Array.isArray(localHistory) ? localHistory.map(sanitizeHistoryEvent).filter(Boolean) : [];
    localEvents.forEach((event) => seenRef.current.add(event.id));
    setHistory(localEvents.slice(0, MAX_HISTORY));
    if (!session?.access_token) return;
    let cancelled = false;
    api.getNestHistory(40).then((response) => {
      if (cancelled) return;
      const remoteEvents = Array.isArray(response?.events) ? response.events.map(sanitizeHistoryEvent).filter(Boolean) : [];
      const merged = [...localEvents, ...remoteEvents]
        .filter((event, index, list) => list.findIndex((candidate) => candidate.id === event.id) === index)
        .sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')))
        .slice(0, MAX_HISTORY);
      merged.forEach((event) => seenRef.current.add(event.id));
      setHistory(merged);
      persistHistory(merged);
    });
    return () => { cancelled = true; };
  }, [historyStorageKey, persistHistory, session?.access_token]);

  useEffect(() => {
    if (!businessId || !session?.access_token) return undefined;
    const handle = (table) => (payload) => {
      const normalized = normalizeRealtimePayload(table, payload, historyRef.current);
      if (normalized) enqueue(normalized);
    };
    let channel = supabase.channel(`nest-live-${businessId}-${session.user?.id || 'user'}`);
    channel = channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `business_id=eq.${businessId}` }, handle('appointments'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'people', filter: `business_id=eq.${businessId}` }, handle('people'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` }, handle('payments'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hired_receptionists', filter: `business_id=eq.${businessId}` }, handle('hired_receptionists'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` }, handle('businesses'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nest_events', filter: `business_id=eq.${businessId}` }, handle('nest_events'))
      .subscribe((status, error) => {
        if (error) console.warn('[Nest] Realtime subscription error:', error);
        else if (status === 'SUBSCRIBED') console.info('[Nest] Realtime connected');
      });
    return () => { supabase.removeChannel(channel); };
  }, [businessId, enqueue, session?.access_token, session?.user?.id]);

  useEffect(() => {
    if (callsLoading) return;
    const current = new Map((calls || []).map((call) => [String(call.id), normalizeStatus(callRow(call))]));
    if (callsBaselineRef.current === null) {
      callsBaselineRef.current = current;
    } else {
      const previous = callsBaselineRef.current;
      (calls || []).forEach((call) => {
        const id = String(call.id);
        const status = current.get(id);
        const priorStatus = previous.get(id);
        if (TERMINAL_CALL_STATUSES.has(status) && priorStatus !== status && (ACTIVE_CALL_STATUSES.has(priorStatus) || !priorStatus)) {
          enqueue(callLifecycleEvent(call, status));
        }
      });
      callsBaselineRef.current = current;
    }

    const activeCall = (calls || []).find((call) => ACTIVE_CALL_STATUSES.has(normalizeStatus(callRow(call))));
    if (!activeCall) {
      setLiveCall(null);
      return;
    }
    const row = callRow(activeCall);
    const direction = String(row.direction || activeCall.direction || 'incoming').toLowerCase();
    setLiveCall({
      id: `live-call:${activeCall.id}`,
      category: 'calls',
      event_type: 'call_active',
      title: direction.startsWith('out') ? 'Outgoing call' : 'Call in progress',
      message: displayName(row) || activeCall.name || (direction.startsWith('out') ? 'Connecting' : 'Live now'),
      priority: 'routine',
      persistent: true,
      occurred_at: row.started_at || row.created_at || new Date().toISOString(),
      payload: row,
    });
  }, [calls, callsLoading, enqueue]);

  useEffect(() => {
    if (!tasklistState || typeof tasklistState !== 'object') return;
    const completed = new Set();
    Object.entries(tasklistState).forEach(([taskId, task]) => {
      Object.entries(task?.subtasks || {}).forEach(([subtaskId, state]) => {
        if (state?.completed === true) completed.add(`${taskId}:${subtaskId}`);
      });
    });
    if (tasklistBaselineRef.current === null) {
      tasklistBaselineRef.current = completed;
      return;
    }
    completed.forEach((key) => {
      if (!tasklistBaselineRef.current.has(key)) {
        enqueue({
          id: `task:${key}:${Date.now()}`, category: 'milestones', event_type: 'task_completed',
          title: 'Setup task completed', message: key.split(':').slice(-1)[0].replaceAll('_', ' '),
          priority: 'routine', occurred_at: new Date().toISOString(),
        });
      }
    });
    tasklistBaselineRef.current = completed;
  }, [enqueue, tasklistState]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const now = new Date();
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const quoteKey = `nodemere:nest:quote:${businessKey}:${day}`;
    if (localStorage.getItem(quoteKey)) return undefined;
    const timer = window.setTimeout(() => {
      localStorage.setItem(quoteKey, 'true');
      enqueue({
        id: `daily-quote:${businessKey}:${day}`,
        category: 'messages', event_type: 'daily_quote', title: getDailyNestQuote(now), message: '',
        priority: 'routine', duration_ms: 12000, occurred_at: now.toISOString(),
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [businessKey, enqueue, session?.user?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (import.meta.env.DEV && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setStudioOpen((open) => !open);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setHistoryOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectConcept = useCallback((categoryId, conceptId) => {
    setSelectedConcepts((current) => {
      const next = { ...current, [categoryId]: conceptId };
      localStorage.setItem('nodemere:nest:concepts', JSON.stringify(next));
      return next;
    });
  }, []);

  const togglePrivacy = useCallback(() => {
    setPrivacyMode((current) => {
      const next = !current;
      localStorage.setItem('nodemere:nest:privacy', String(next));
      return next;
    });
  }, []);

  const markIntroStarted = useCallback(() => {
    setIntroStarted(true);
  }, []);

  const displayEvent = previewEvent || activeEvent || liveCall;
  const selectedPreference = displayEvent ? selectedConcepts[displayEvent.category] : null;
  const hasSavedPreference = selectedPreference !== null && typeof selectedPreference === 'object';
  const selectedConceptId = hasSavedPreference ? selectedPreference.conceptId : selectedPreference;
  const displayConcept = displayEvent
    ? { ...getNestConcept(displayEvent.category, displayEvent.concept_id || selectedConceptId), motion: 'rise' }
    : null;

  const value = useMemo(() => ({
    activeEvent,
    displayEvent,
    displayConcept,
    liveCall,
    introStarted,
    markIntroStarted,
    queueLength: queue.length,
    history,
    historyOpen,
    setHistoryOpen,
    studioOpen,
    setStudioOpen,
    privacyMode,
    togglePrivacy,
    selectedConcepts,
    selectConcept,
    previewConcept,
  }), [activeEvent, displayEvent, displayConcept, history, historyOpen, introStarted, liveCall, markIntroStarted, previewConcept, previewEvent, privacyMode, queue.length, selectConcept, selectedConcepts, studioOpen, togglePrivacy]);

  return <NestContext.Provider value={value}>{children}</NestContext.Provider>;
};

export const useNest = () => {
  const context = useContext(NestContext);
  if (!context) throw new Error('useNest must be used inside NestProvider');
  return context;
};
