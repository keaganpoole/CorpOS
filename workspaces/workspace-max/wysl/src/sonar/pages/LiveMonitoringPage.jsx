import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { sankey, sankeyJustify } from 'd3-sankey';
import {
  CalendarDays,
  CreditCard,
  Phone,
  UserRoundPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const COLORS = {
  source: '#00f2ff',
  middle: '#7000ff',
  target: '#ff00d4',
  text: '#ffffff',
};

const OPACITY = {
  linkInitial: 0.5,
  linkHover: 0.95,
  linkDimmed: 0.1,
  linkHistory: 0.34,
  nodeDimmed: 0.3,
};

const analyticsSeed = [
  { key: 'calls', label: 'Total Calls', icon: Phone },
  { key: 'appointments', label: 'Appointments', icon: CalendarDays },
  { key: 'customers', label: 'New Customers', icon: UserRoundPlus },
  { key: 'revenue', label: 'Revenue', prefix: '$', icon: CreditCard },
];

const sankeyData = {
  nodes: [
    { id: 'incoming', name: 'Incoming Calls', category: 'source', color: '#e4e4e7' },
    { id: 'outgoing', name: 'Outgoing Calls', category: 'source', color: '#a1a1aa' },
    { id: 'records', name: 'Records', category: 'middle', color: '#32f0d9' },
    { id: 'appointments', name: 'Appointments', category: 'middle', color: '#38bdf8' },
    { id: 'payments', name: 'Payments', category: 'middle', color: '#f59e0b' },
    { id: 'record-created', name: 'Record Created', category: 'target', color: '#32f0d9' },
    { id: 'record-updated', name: 'Record Updated', category: 'target', color: '#32f0d9' },
    { id: 'appointment-created', name: 'Appointment Created', category: 'target', color: '#38bdf8' },
    { id: 'appointment-updated', name: 'Appointment Updated', category: 'target', color: '#38bdf8' },
    { id: 'appointment-cancelled', name: 'Appointment Cancelled', category: 'target', color: '#38bdf8' },
    { id: 'payment-received', name: 'Payment Received', category: 'target', color: '#f59e0b' },
    { id: 'invoice-sent', name: 'Invoice Sent', category: 'target', color: '#f59e0b' },
  ],
  links: [
    { id: 'incoming-records', source: 0, target: 2, value: 1 },
    { id: 'incoming-appointments', source: 0, target: 3, value: 1 },
    { id: 'incoming-payments', source: 0, target: 4, value: 1 },
    { id: 'outgoing-records', source: 1, target: 2, value: 1 },
    { id: 'outgoing-appointments', source: 1, target: 3, value: 1 },
    { id: 'outgoing-payments', source: 1, target: 4, value: 1 },
    { id: 'records-record-created', source: 2, target: 5, value: 1 },
    { id: 'records-record-updated', source: 2, target: 6, value: 1 },
    { id: 'appointments-appointment-created', source: 3, target: 7, value: 1 },
    { id: 'appointments-appointment-updated', source: 3, target: 8, value: 1 },
    { id: 'appointments-appointment-cancelled', source: 3, target: 9, value: 1 },
    { id: 'payments-payment-received', source: 4, target: 10, value: 1 },
    { id: 'payments-invoice-sent', source: 4, target: 11, value: 1 },
  ],
};

const nodeColor = (node) => node.color || COLORS[node.category];

const INTENT_ALIASES = {
  intent_call_started: 'call_started',
  intent_neutral_entered: 'neutral',
  neutral_entered: 'neutral',
  intent_appointments: 'appointments',
  intent_records: 'records',
  intent_payments: 'payments',
  create_appointment: 'appointment_created',
  update_appointment: 'appointment_updated',
  cancel_appointment: 'appointment_cancelled',
  delete_appointment: 'appointment_cancelled',
  intent_appointment_created: 'appointment_created',
  intent_appointment_updated: 'appointment_updated',
  intent_appointment_cancelled: 'appointment_cancelled',
  create_record: 'record_created',
  update_record: 'record_updated',
  intent_record_created: 'record_created',
  intent_record_updated: 'record_updated',
  create_payment: 'payment_received',
  update_payment: 'payment_received',
  create_invoice: 'invoice_sent',
  send_invoice: 'invoice_sent',
  intent_payment_received: 'payment_received',
  intent_invoice_sent: 'invoice_sent',
};

const INTENT_ROUTES = {
  appointments: { middle: 'appointments' },
  records: { middle: 'records' },
  payments: { middle: 'payments' },
  appointment_created: { middle: 'appointments', target: 'appointment-created' },
  appointment_updated: { middle: 'appointments', target: 'appointment-updated' },
  appointment_cancelled: { middle: 'appointments', target: 'appointment-cancelled' },
  record_created: { middle: 'records', target: 'record-created' },
  record_updated: { middle: 'records', target: 'record-updated' },
  payment_received: { middle: 'payments', target: 'payment-received' },
  invoice_sent: { middle: 'payments', target: 'invoice-sent' },
};

const LINK_BY_ROUTE = Object.fromEntries(sankeyData.links.map((link) => {
  const source = sankeyData.nodes[link.source]?.id;
  const target = sankeyData.nodes[link.target]?.id;
  return [`${source}->${target}`, link.id];
}));

const canonicalIntent = (intentKey) => {
  const normalized = String(intentKey || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const withoutIntentPrefix = normalized.replace(/^intent_/, '');
  const withoutPhaseSuffix = withoutIntentPrefix.replace(/_(entered|completed|failed)$/, '');
  return INTENT_ALIASES[normalized] || INTENT_ALIASES[withoutIntentPrefix] || INTENT_ALIASES[withoutPhaseSuffix] || withoutPhaseSuffix;
};

const domId = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');

const moneyTableStrokeWidth = (link) => (
  Math.max(3, Math.min(9.75, ((link?.visualWidth || link?.width || 1) / 1.5) * 3))
);

const relaxedSankeyPath = (link) => {
  const sourceX = link.source.x1;
  const targetX = link.target.x0;
  const sourceY = link.y0;
  const targetY = link.y1;
  const span = Math.max(1, targetX - sourceX);
  const verticalDelta = targetY - sourceY;
  const calmness = Math.max(0, Math.min(1, Math.abs(verticalDelta) / 260));
  const lead = span * (0.48 + calmness * 0.08);
  const carry = span * (0.52 + calmness * 0.08);
  const lift = verticalDelta * 0.08;

  return [
    `M${sourceX},${sourceY}`,
    `C${sourceX + lead},${sourceY + lift}`,
    `${targetX - carry},${targetY - lift}`,
    `${targetX},${targetY}`,
  ].join(' ');
};

const stableUnit = (value) => {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const rowPayload = (row) => {
  const record = row?.new || row || {};
  const payload = record.payload || {};
  return {
    ...payload,
    checkpoint_id: record.checkpoint_id ?? payload.checkpoint_id,
    intent_key: record.intent_key ?? payload.intent_key,
    parent_intent_key: record.parent_intent_key ?? payload.parent_intent_key,
    checkpoint_label: record.checkpoint_label ?? payload.checkpoint_label,
    phase: record.phase ?? payload.phase,
    timestamp: record.timestamp ?? payload.timestamp,
    conversation_id: record.conversation_id ?? payload.conversation_id,
    system_conversation_id: record.system_conversation_id ?? payload.system_conversation_id,
    direction: record.direction ?? payload.direction,
    duration: record.duration ?? payload.duration,
    sid: record.sid ?? payload.sid,
    caller_id: record.caller_id ?? payload.caller_id,
    call_id: record.call_id ?? payload.call_id,
    execution_id: record.execution_id ?? payload.execution_id,
    session_id: record.session_id ?? payload.session_id,
  };
};

const checkpointTimestamp = (row) => (
  rowPayload(row).timestamp || row?.created_at || new Date().toISOString()
);

const checkpointSortValue = (row) => new Date(checkpointTimestamp(row)).getTime() || 0;

const conversationKeyForCheckpoint = (payload, row) => (
  payload.conversation_id
  || payload.system_conversation_id
  || payload.call_id
  || payload.sid
  || payload.execution_id
  || payload.session_id
  || `legacy:${payload.scenario_id || row?.scenario_id || 'unknown'}:${checkpointTimestamp(row)}`
);

const parseMaybeJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const scenarioDirection = (scenario) => {
  if (!scenario) return 'outgoing';
  const direct = String(
    scenario.call_direction
    || scenario.direction
    || scenario.call_type
    || scenario.call_types
    || ''
  ).toLowerCase();
  if (direct.includes('inbound') || direct.includes('incoming')) return 'incoming';
  if (direct.includes('outbound') || direct.includes('outgoing')) return 'outgoing';

  const nodes = parseMaybeJson(scenario.nodes_data, []);
  const triggerKeys = Array.isArray(nodes)
    ? nodes.map((node) => String(node.subOptionKey || node.triggerKey || node.actionConfig?._key || '').toLowerCase())
    : [];
  if (triggerKeys.some((key) => ['incoming_call', 'call_answered', 'missed_call', 'call_failed', 'voicemail_received'].includes(key))) {
    return 'incoming';
  }

  return 'outgoing';
};

const payloadDirection = (payload) => {
  const direct = String(payload?.direction || payload?.call_direction || '').toLowerCase();
  if (direct.includes('inbound') || direct.includes('incoming')) return 'incoming';
  if (direct.includes('outbound') || direct.includes('outgoing')) return 'outgoing';
  return null;
};

const mergeRank = { idle: 0, dimmed: 1, history: 1, pulsing: 2, active: 3, partial: 4, completed: 5 };

const strongerState = (a = 'idle', b = 'idle') => (
  (mergeRank[b] || 0) > (mergeRank[a] || 0) ? b : a
);

const TEN_ZERO_BUCKETS = Array.from({ length: 10 }, () => 0);

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfCurrentLocalWeek = () => {
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const percentChange = (current, previous) => {
  if (!previous && !current) return '0%';
  if (!previous) return `+${Math.round(current * 100)}%`;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
};

const safeDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const bucketSeries = (rows, valueForRow = () => 1, start = null, bucketCount = 10, end = new Date()) => {
  const buckets = Array.from({ length: bucketCount }, () => 0);
  const windowEnd = safeDate(end) || new Date();
  const windowStart = safeDate(start) || new Date(windowEnd.getTime() - ((bucketCount - 1) * 60 * 60 * 1000));
  const span = Math.max(1, windowEnd.getTime() - windowStart.getTime());

  for (const row of rows || []) {
    const dt = safeDate(row.created_at || row.started_at);
    if (!dt || dt < windowStart || dt > windowEnd) continue;
    const relative = (dt.getTime() - windowStart.getTime()) / span;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(relative * bucketCount)));
    buckets[idx] += valueForRow(row);
  }

  return buckets;
};

const paymentValue = (payment) => {
  const amount = Number(payment?.amount || 0);
  return Number.isFinite(amount) ? amount / 100 : 0;
};

const formatValue = (item, value) => {
  const body = Math.round(value || 0).toLocaleString();
  return `${item.prefix || ''}${body}`;
};

const sparklinePoints = (series) => {
  const width = 116;
  const height = 42;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const points = series.map((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - ((point - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastY = points[points.length - 1].split(',')[1];
  return { points: points.join(' '), area: `0,44 ${points.join(' ')} 116,44`, lastY };
};

function AnalyticsCard({ item, value, index }) {
  const Icon = item.icon;
  const line = sparklinePoints(item.series);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="live-stat-card"
    >
      <div className="live-stat-head">
        <div className="live-stat-copy">
          <p className="live-stat-label">{item.label}</p>
          <div className="live-stat-value-row">
            <span className="live-stat-value">{formatValue(item, value)}</span>
            <span className="live-stat-delta">{item.delta}</span>
          </div>
        </div>
        <div className="live-stat-icon">
          <Icon size={15} />
        </div>
      </div>
      <div className="live-stat-chart-row">
        <svg className="live-stat-line" viewBox="0 0 116 44" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`live-stat-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d69b" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#00d69b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon className="live-stat-line-fill" points={line.area} fill={`url(#live-stat-fill-${index})`} />
          <polyline className="live-stat-line-shadow" points={line.points} />
          <polyline className="live-stat-line-path" points={line.points} />
          <circle className="live-stat-line-dot" cx="116" cy={line.lastY} r="2.5" />
        </svg>
      </div>
    </motion.div>
  );
}

function useLiveAnalytics() {
  const [analytics, setAnalytics] = useState(() => analyticsSeed.map((item) => ({
    ...item,
    value: 0,
    delta: '0%',
    series: TEN_ZERO_BUCKETS,
  })));

  const refreshAnalytics = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    const fetchAnalytics = async () => {
      try {
        const now = new Date();
        const weekStart = startOfCurrentLocalWeek();
        const nextWeekStart = addDays(weekStart, 7);
        const previousWeekStart = addDays(weekStart, -7);
        const since = previousWeekStart.toISOString();
        const inCurrentWeek = (row) => {
          const dt = safeDate(row.created_at || row.started_at);
          return dt && dt >= weekStart && dt < nextWeekStart;
        };
        const inPreviousWeek = (row) => {
          const dt = safeDate(row.created_at || row.started_at);
          return dt && dt >= previousWeekStart && dt < weekStart;
        };

        const [callsRes, appointmentsRes, customersRes, paymentsRes] = await Promise.all([
          supabase.from('call_logs').select('id,created_at,started_at').gte('created_at', since),
          supabase.from('appointments').select('id,created_at,status').gte('created_at', since),
          supabase.from('people').select('id,created_at').gte('created_at', since),
          supabase.from('payments').select('id,created_at,amount,status').gte('created_at', since),
        ]);

        if (cancelled) return;

        const calls = callsRes.data || [];
        const appointments = (appointmentsRes.data || []).filter((row) => row.status !== 'cancelled');
        const customers = customersRes.data || [];
        const revenuePayments = (paymentsRes.data || []).filter((row) => (
          ['succeeded', 'paid', 'completed'].includes(String(row.status || '').toLowerCase())
        ));

        const currentWeekCalls = calls.filter(inCurrentWeek);
        const previousWeekCalls = calls.filter(inPreviousWeek);
        const currentWeekAppointments = appointments.filter(inCurrentWeek);
        const previousWeekAppointments = appointments.filter(inPreviousWeek);
        const currentWeekCustomers = customers.filter(inCurrentWeek);
        const previousWeekCustomers = customers.filter(inPreviousWeek);
        const currentWeekRevenueRows = revenuePayments.filter(inCurrentWeek);
        const previousWeekRevenueRows = revenuePayments.filter(inPreviousWeek);
        const currentWeekRevenue = currentWeekRevenueRows.reduce((sum, row) => sum + paymentValue(row), 0);
        const previousWeekRevenue = previousWeekRevenueRows.reduce((sum, row) => sum + paymentValue(row), 0);

        const byKey = {
          calls: {
            value: currentWeekCalls.length,
            delta: percentChange(currentWeekCalls.length, previousWeekCalls.length),
            series: bucketSeries(currentWeekCalls, () => 1, weekStart, 7, now),
          },
          appointments: {
            value: currentWeekAppointments.length,
            delta: percentChange(currentWeekAppointments.length, previousWeekAppointments.length),
            series: bucketSeries(currentWeekAppointments, () => 1, weekStart, 7, now),
          },
          customers: {
            value: currentWeekCustomers.length,
            delta: percentChange(currentWeekCustomers.length, previousWeekCustomers.length),
            series: bucketSeries(currentWeekCustomers, () => 1, weekStart, 7, now),
          },
          revenue: {
            value: currentWeekRevenue,
            delta: percentChange(currentWeekRevenue, previousWeekRevenue),
            series: bucketSeries(currentWeekRevenueRows, paymentValue, weekStart, 7, now),
          },
        };

        setAnalytics(analyticsSeed.map((item) => ({ ...item, ...byKey[item.key] })));
      } catch (err) {
        console.error('[LiveMonitoring] analytics refresh failed:', err);
      }
    };

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(fetchAnalytics, 180);
    };

    refreshAnalytics.current = scheduleRefresh;
    fetchAnalytics();

    const channel = supabase
      .channel('live-monitoring-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return analytics;
}

function useLiveSankeyState() {
  const [flowState, setFlowState] = useState({
    linkStates: {},
    nodeStates: {},
    activeNodeIds: [],
    activeLinkIds: [],
    flowLines: [],
    version: 0,
  });
  const scenarioCacheRef = useRef(new Map());
  const sessionsRef = useRef(new Map());
  const seenCheckpointIdsRef = useRef(new Set());
  const flowInstancesRef = useRef([]);
  const latestConversationRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let recoveryTimer = null;
    let catchupTimer = null;

    const resolveScenario = async (scenarioId) => {
      if (!scenarioId) return null;
      if (scenarioCacheRef.current.has(scenarioId)) return scenarioCacheRef.current.get(scenarioId);
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .limit(1)
        .maybeSingle();
      if (error) console.warn('[LiveMonitoring] scenario lookup failed:', error.message);
      scenarioCacheRef.current.set(scenarioId, data || null);
      return data || null;
    };

    const publishState = () => {
      const linkStates = {};
      const nodeStates = {};
      const activeNodeIds = new Set();
      const activeLinkIds = new Set();
      const flowLines = [];
      const latestConversationId = latestConversationRef.current;
      const hasActiveSession = Boolean(latestConversationId);

      const applyNode = (id, state) => {
        if (!id) return;
        nodeStates[id] = strongerState(nodeStates[id], state);
        if (['pulsing', 'active', 'partial', 'completed'].includes(state)) activeNodeIds.add(id);
      };

      const applyLink = (id, state) => {
        if (!id) return;
        linkStates[id] = strongerState(linkStates[id], state);
        if (['active', 'partial', 'completed'].includes(state)) activeLinkIds.add(id);
      };

      sessionsRef.current.forEach((session) => {
        if (session.conversationId !== latestConversationId) {
          applyNode(session.sourceId, 'dimmed');
          return;
        }
        if (session.intent === 'call_started' && !flowInstancesRef.current.some((flow) => flow.conversationId === latestConversationId)) {
          applyNode(session.sourceId, 'pulsing');
        }
      });

      flowInstancesRef.current.slice(-160).forEach((flow) => {
        const isLatest = flow.conversationId === latestConversationId;
        const renderState = isLatest ? flow.baseState : 'history';
        const activeNodeState = renderState === 'completed' ? 'completed' : 'active';
        const renderedFlow = { ...flow, state: renderState };
        flowLines.push(renderedFlow);

        applyNode(renderedFlow.sourceId, renderState === 'history' ? 'dimmed' : activeNodeState);
        applyNode(renderedFlow.middleId, renderState === 'history' ? 'dimmed' : activeNodeState);
        if (renderedFlow.targetId) {
          applyNode(renderedFlow.targetId, renderState === 'history' ? 'dimmed' : renderState);
        }
        applyLink(renderedFlow.sourceLinkId, renderState);
        applyLink(renderedFlow.targetLinkId, renderState === 'active' ? 'partial' : renderState);
      });

      if (hasActiveSession) {
        sankeyData.nodes.forEach((node) => {
          if (!nodeStates[node.id]) nodeStates[node.id] = 'dimmed';
        });
      }

      setFlowState((prev) => ({
        linkStates,
        nodeStates,
        activeNodeIds: [...activeNodeIds],
        activeLinkIds: [...activeLinkIds],
        flowLines,
        version: prev.version + 1,
      }));
    };

    const checkpointIdentity = (row) => {
      const payload = rowPayload(row);
      return (
        row?.id
        || `${payload.scenario_id || row?.scenario_id || 'unknown'}:${payload.intent_key || 'unknown'}:${payload.phase || 'entered'}:${checkpointTimestamp(row)}`
      );
    };

    const applyCheckpoint = async (row, options = {}) => {
      const identity = checkpointIdentity(row);
      if (seenCheckpointIdsRef.current.has(identity)) return;

      const payload = rowPayload(row);
      const intent = canonicalIntent(payload.intent_key);
      const phase = String(payload.phase || 'entered').toLowerCase();
      const scenarioId = String(payload.scenario_id || row?.scenario_id || '');
      if (!scenarioId || cancelled) return;

      const directDirection = payloadDirection(payload);
      const scenario = directDirection ? null : await resolveScenario(scenarioId);
      if (cancelled) return;
      seenCheckpointIdsRef.current.add(identity);

      const sourceId = (directDirection || scenarioDirection(scenario)) === 'incoming' ? 'incoming' : 'outgoing';
      const conversationId = conversationKeyForCheckpoint({ ...payload, scenario_id: scenarioId }, row);
      const isLiveCheckpoint = options.mode !== 'history';

      if (isLiveCheckpoint) {
        latestConversationRef.current = conversationId;
      }

      if (intent === 'neutral') {
        sessionsRef.current.delete(conversationId);
        publishState();
        return;
      }

      if (intent === 'call_started') {
        sessionsRef.current.set(conversationId, {
          scenarioId,
          conversationId,
          intent,
          phase: 'entered',
          state: 'source',
          sourceId,
          timestamp: checkpointTimestamp(row),
        });
        publishState();
        return;
      }

      const route = INTENT_ROUTES[intent];
      if (!route) return;

      const middleId = route.middle;
      const targetId = route.target || null;
      const sourceLinkId = LINK_BY_ROUTE[`${sourceId}->${middleId}`];
      const targetLinkId = targetId ? LINK_BY_ROUTE[`${middleId}->${targetId}`] : null;
      const flowId = conversationId;
      const baseState = options.mode === 'history' ? 'dimmed' : (phase === 'completed' ? 'completed' : 'active');

      const nextSession = {
        scenarioId,
        conversationId,
        intent,
        phase,
        state: baseState,
        sourceId,
        middleId,
        targetId,
        sourceLinkId,
        targetLinkId,
        flowId,
        timestamp: checkpointTimestamp(row),
      };

      const nextFlow = {
        id: flowId,
        conversationId,
        scenarioId,
        intent,
        phase,
        baseState,
        state: baseState,
        sourceId,
        middleId,
        targetId,
        sourceLinkId,
        targetLinkId,
        timestamp: checkpointTimestamp(row),
      };
      const existingFlowIndex = flowInstancesRef.current.findIndex((flow) => flow.id === flowId);
      if (existingFlowIndex >= 0) {
        flowInstancesRef.current[existingFlowIndex] = {
          ...flowInstancesRef.current[existingFlowIndex],
          ...nextFlow,
        };
      } else {
        flowInstancesRef.current.push(nextFlow);
      }
      flowInstancesRef.current = flowInstancesRef.current
        .sort((a, b) => checkpointSortValue({ payload: a, created_at: a.timestamp }) - checkpointSortValue({ payload: b, created_at: b.timestamp }))
        .slice(-160);

      sessionsRef.current.set(conversationId, nextSession);
      publishState();
    };

    const loadRecentCheckpoints = async ({ limit = 1000, mode = 'live' } = {}) => {
      const checkpointsRes = await supabase
        .from('checkpoints')
        .select('*')
        .eq('trigger_key', 'intent_checkpoint')
        .gte('created_at', startOfCurrentLocalWeek().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (checkpointsRes.error) {
        console.warn('[LiveMonitoring] checkpoints query failed:', checkpointsRes.error.message);
      }

      const rows = (checkpointsRes.data || [])
        .sort((a, b) => checkpointSortValue(a) - checkpointSortValue(b));

      for (const row of rows) await applyCheckpoint(row, { mode });
    };

    const recoverRecentCheckpoints = () => {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => {
        loadRecentCheckpoints({
          limit: 100,
          mode: initialLoadCompleteRef.current ? 'live' : 'history',
        }).catch((err) => {
          console.warn('[LiveMonitoring] checkpoint realtime recovery failed:', err);
        });
      }, 350);
    };

    loadRecentCheckpoints({ limit: 1000, mode: 'history' })
      .catch((err) => console.warn('[LiveMonitoring] checkpoint warmup failed:', err))
      .finally(() => {
        initialLoadCompleteRef.current = true;
      });

    const handleInsert = (payload) => {
      console.info('[LiveMonitoring] realtime checkpoint received:', payload.new);
      applyCheckpoint(payload.new).catch((err) => console.warn('[LiveMonitoring] checkpoint apply failed:', err));
    };

    const checkpointChannel = supabase
      .channel('live-monitoring-checkpoints')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkpoints' }, handleInsert)
      .subscribe((status, err) => {
        console.info('[LiveMonitoring] checkpoint realtime status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          recoverRecentCheckpoints();
          window.clearInterval(catchupTimer);
          catchupTimer = window.setInterval(() => {
            loadRecentCheckpoints({
              limit: 100,
              mode: initialLoadCompleteRef.current ? 'live' : 'history',
            }).catch((recoveryErr) => {
              console.warn('[LiveMonitoring] checkpoint catch-up failed:', recoveryErr);
            });
          }, 2500);
          return;
        }
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          window.clearInterval(catchupTimer);
          recoverRecentCheckpoints();
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(recoveryTimer);
      window.clearInterval(catchupTimer);
      supabase.removeChannel(checkpointChannel);
    };
  }, []);

  return flowState;
}

function RealtimeSankey({ flowState }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const graphRef = useRef(null);
  const layersRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphVersion, setGraphVersion] = useState(0);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return undefined;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, []);

  const linkOpacity = (state) => ({
    idle: 0,
    dimmed: OPACITY.linkDimmed,
    history: OPACITY.linkHistory,
    active: OPACITY.linkHover,
    partial: OPACITY.linkHover,
    completed: OPACITY.linkHover,
  }[state] ?? OPACITY.linkInitial);

  const nodeOpacity = (state) => ({
    idle: 0.72,
    dimmed: 0.36,
    pulsing: 1,
    active: 1,
    partial: 1,
    completed: 1,
  }[state] ?? 0.72);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const isCompact = dimensions.width < 760;
    const margin = {
      top: isCompact ? 34 : 62,
      right: isCompact ? 112 : 190,
      bottom: isCompact ? 38 : 70,
      left: isCompact ? 112 : 190,
    };
    const width = Math.max(320, dimensions.width - margin.left - margin.right);
    const height = Math.max(320, dimensions.height - margin.top - margin.bottom);

    const defs = svg.append('defs');

    const glow = defs.append('filter').attr('id', 'live-monitoring-glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMergeGlow = glow.append('feMerge');
    feMergeGlow.append('feMergeNode').attr('in', 'coloredBlur');
    feMergeGlow.append('feMergeNode').attr('in', 'SourceGraphic');

    const layout = sankey()
      .nodeWidth(1.6)
      .nodePadding(2)
      .nodeAlign(sankeyJustify)
      .nodeSort(null)
      .extent([[0, 0], [width, height]]);

    const graph = layout({
      nodes: sankeyData.nodes.map((node) => ({ ...node })),
      links: sankeyData.links.map((link) => ({ ...link })),
    });

    const graphYMin = d3.min(graph.nodes, (item) => item.y0) || 0;
    const graphYMax = d3.max(graph.nodes, (item) => item.y1) || height;
    const graphHeight = graphYMax - graphYMin;
    const yOffset = (height - graphHeight) / 2 - graphYMin;

    graph.nodes.forEach((item) => {
      item.y0 += yOffset;
      item.y1 += yOffset;
    });
    graph.links.forEach((link) => {
      link.y0 += yOffset;
      link.y1 += yOffset;
      link.width *= 0.5;
    });

    graph.nodes.forEach((item) => {
      const originalHeight = item.y1 - item.y0;
      const newSourceHeight = d3.sum(item.sourceLinks, (link) => link.width);
      const newTargetHeight = d3.sum(item.targetLinks, (link) => link.width);
      const newHeight = Math.max(newSourceHeight, newTargetHeight);

      if (originalHeight > 0) {
        const yShift = (originalHeight - newHeight) / 2;
        item.y0 += yShift;
        item.y1 -= yShift;
      }

      let currentSourceY = item.y0;
      item.sourceLinks.forEach((link) => {
        link.y0 = currentSourceY + link.width / 2;
        currentSourceY += link.width;
      });

      let currentTargetY = item.y0;
      item.targetLinks.forEach((link) => {
        link.y1 = currentTargetY + link.width / 2;
        currentTargetY += link.width;
      });
    });

    const graphLinkById = new Map(graph.links.map((link) => [link.id, link]));

    const field = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const linkLayer = field.append('g')
      .attr('fill', 'none')
      .attr('class', 'live-monitoring-link-layer');

    const node = field.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .attr('class', 'live-monitoring-node')
      .attr('transform', (item) => `translate(${item.x0},${item.y0})`);

    node.append('rect')
      .attr('height', (item) => item.y1 - item.y0)
      .attr('y', 0)
      .attr('width', (item) => item.x1 - item.x0)
      .attr('fill', (item) => nodeColor(item))
      .attr('opacity', nodeOpacity('idle'))
      .attr('class', 'live-node-bar live-node-idle')
      .style('filter', 'url(#live-monitoring-glow)');

    node.append('text')
      .attr('x', (item) => {
        if (item.category === 'source') return -16;
        if (item.category === 'target') return 16;
        return item.x0 < width / 2 ? 16 : -16;
      })
      .attr('y', (item) => (item.y1 - item.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (item) => {
        if (item.category === 'source') return 'end';
        if (item.category === 'target') return 'start';
        return item.x0 < width / 2 ? 'start' : 'end';
      })
      .text((item) => item.name)
      .style('fill', COLORS.text)
      .style('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
      .style('font-size', isCompact ? '9px' : '11px')
      .style('font-weight', '700')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '0')
      .style('opacity', 0)
      .transition()
      .duration(700)
      .delay(900)
      .style('opacity', Math.max(0.28, nodeOpacity('idle') * 0.9));

    graphRef.current = { graph, graphLinkById, width, height };
    layersRef.current = { defs, linkLayer, nodeLayer: node };
    setGraphVersion((version) => version + 1);
  }, [dimensions]);

  useEffect(() => {
    const graphRecord = graphRef.current;
    const layers = layersRef.current;
    if (!graphRecord || !layers) return;

    const { graph, graphLinkById, height: flowFieldHeight = dimensions.height } = graphRecord;
    const { defs, linkLayer, nodeLayer } = layers;
    const nodeStates = flowState?.nodeStates || {};
    const linkState = (link) => link.state || 'idle';
    const nodeState = (node) => nodeStates[node.id] || 'idle';
    const isVisibleLink = (link) => linkState(link) !== 'idle';
    const effectiveLinkOpacity = (link) => linkOpacity(linkState(link));
    const linkBlendMode = () => 'screen';
    const calmLinkOpacity = (link) => {
      const state = linkState(link);
      const base = effectiveLinkOpacity(link);
      if (state === 'history') return Math.max(0.22, base * 0.82);
      if (state === 'dimmed') return Math.max(0.06, base * 0.8);
      return base;
    };
    const flowNodesById = new Map();
    const routeCounts = new Map();
    const nodeTouchCounts = new Map();
    (flowState?.flowLines || []).forEach((flow) => {
      const routeKey = `${flow.sourceLinkId || ''}->${flow.targetLinkId || ''}`;
      routeCounts.set(routeKey, (routeCounts.get(routeKey) || 0) + 1);
      const flowNodeIds = [flow.sourceId, flow.middleId, flow.targetId].filter(Boolean);
      flowNodesById.set(flow.id, new Set(flowNodeIds));
      flowNodeIds.forEach((nodeId) => {
        nodeTouchCounts.set(nodeId, (nodeTouchCounts.get(nodeId) || 0) + 1);
      });
    });

    const naturalY = (node, fallbackY, width, routeLane, routeTotal, seedKey) => {
      if (!node) return fallbackY;
      const inset = Math.max(5, moneyTableStrokeWidth({ width }) / 2);
      const min = node.y0 + inset;
      const max = node.y1 - inset;
      const center = node.y0 + (node.y1 - node.y0) / 2;
      if (min >= max) return center;

      const usableHeight = max - min;
      const laneComponent = routeTotal > 1
        ? (routeLane / Math.max(1, (routeTotal - 1) / 2)) * usableHeight * 0.18
        : 0;
      const drift = (stableUnit(seedKey) - 0.5) * usableHeight * 0.28;
      const anchor = center + laneComponent + drift;
      const blended = fallbackY * 0.48 + anchor * 0.52;
      return Math.max(min, Math.min(max, blended));
    };

    const routeIndexes = new Map();
    const preparedFlows = (flowState?.flowLines || []).map((flow) => {
      const sourceLink = graphLinkById.get(flow.sourceLinkId);
      if (!sourceLink) return null;
      const targetLink = flow.targetLinkId ? graphLinkById.get(flow.targetLinkId) : null;
      const routeKey = `${flow.sourceLinkId || ''}->${flow.targetLinkId || ''}`;
      const routeIndex = routeIndexes.get(routeKey) || 0;
      routeIndexes.set(routeKey, routeIndex + 1);
      const routeTotal = routeCounts.get(routeKey) || 1;
      const routeLane = routeIndex - (routeTotal - 1) / 2;
      const widthScale = 0.9 + stableUnit(`${flow.id}:width`) * 0.2;
      const visualWidth = sourceLink.width * widthScale;
      return { flow, sourceLink, targetLink, routeTotal, routeLane, visualWidth };
    }).filter(Boolean);

    const laneGroups = new Map();
    const addLaneCandidate = (node, prepared) => {
      if (!node) return;
      const laneKey = `${prepared.flow.id}:${node.id}`;
      if (!laneGroups.has(node.id)) laneGroups.set(node.id, new Map());
      laneGroups.get(node.id).set(laneKey, { node, prepared });
    };

    preparedFlows.forEach((prepared) => {
      addLaneCandidate(prepared.sourceLink.source, prepared);
      addLaneCandidate(prepared.sourceLink.target, prepared);
      if (prepared.targetLink) addLaneCandidate(prepared.targetLink.target, prepared);
    });

    const laneYByFlowNode = new Map();
    laneGroups.forEach((candidateMap) => {
      const candidates = Array.from(candidateMap.values())
        .sort((a, b) => {
          const aWeight = a.prepared.routeLane + (stableUnit(`${a.prepared.flow.id}:${a.node.id}:lane`) - 0.5) * 0.35;
          const bWeight = b.prepared.routeLane + (stableUnit(`${b.prepared.flow.id}:${b.node.id}:lane`) - 0.5) * 0.35;
          return aWeight - bWeight;
        });
      const node = candidates[0]?.node;
      if (!node) return;

      const strokeWidths = candidates.map(({ prepared }) => moneyTableStrokeWidth({ width: prepared.visualWidth }));
      const averageStrokeWidth = d3.mean(strokeWidths) || 0;
      const idealGap = candidates.length > 1
        ? Math.max(3, averageStrokeWidth * 0.42)
        : 0;
      const totalIdealHeight = d3.sum(strokeWidths) + idealGap * Math.max(0, candidates.length - 1);
      const nodeCenter = node.y0 + (node.y1 - node.y0) / 2;
      const gap = idealGap;
      let cursor = nodeCenter - totalIdealHeight / 2;
      if (cursor < 0) cursor = 0;
      if (cursor + totalIdealHeight > flowFieldHeight) cursor = Math.max(0, flowFieldHeight - totalIdealHeight);

      candidates.forEach(({ node: candidateNode, prepared }, index) => {
        const strokeWidth = strokeWidths[index];
        const y = cursor + strokeWidth / 2;
        laneYByFlowNode.set(`${prepared.flow.id}:${candidateNode.id}`, y);
        cursor += strokeWidth + gap;
      });
    });

    const laneY = (flow, node, fallback, width, routeLane, routeTotal, seedKey) => (
      laneYByFlowNode.get(`${flow.id}:${node?.id}`) ?? naturalY(node, fallback, width, routeLane, routeTotal, seedKey)
    );

    const visibleLinks = preparedFlows.flatMap(({ flow, sourceLink, targetLink, routeTotal, routeLane, visualWidth }) => {
      const sourceY = laneY(flow, sourceLink.source, sourceLink.y0, visualWidth, routeLane, routeTotal, `${flow.id}:source`);
      const middleY = laneY(flow, sourceLink.target, sourceLink.y1, visualWidth, -routeLane, routeTotal, `${flow.id}:middle`);

      const sourceSegment = {
        ...sourceLink,
        id: `${flow.id}-source`,
        source: sourceLink.source,
        target: sourceLink.target,
        y0: sourceY,
        y1: middleY,
        width: visualWidth,
        visualWidth,
        flowId: flow.id,
        baseLinkId: flow.sourceLinkId,
        state: flow.state,
        phase: flow.phase,
        density: Math.max(routeTotal, nodeTouchCounts.get(sourceLink.source.id) || 1, nodeTouchCounts.get(sourceLink.target.id) || 1),
      };

      if (!targetLink) return [sourceSegment];

      const targetY = laneY(flow, targetLink.target, targetLink.y1, sourceSegment.width, routeLane * -0.7, routeTotal, `${flow.id}:target`);
      const targetSegment = {
        ...targetLink,
        id: `${flow.id}-target`,
        source: targetLink.source,
        target: targetLink.target,
        y0: sourceSegment.y1,
        y1: targetY,
        width: sourceSegment.width,
        visualWidth: sourceSegment.visualWidth,
        flowId: flow.id,
        baseLinkId: flow.targetLinkId,
        state: ['dimmed', 'history'].includes(flow.state) ? flow.state : (flow.state === 'completed' ? 'completed' : 'partial'),
        phase: flow.phase,
        density: Math.max(
          routeTotal,
          nodeTouchCounts.get(targetLink.source.id) || 1,
          nodeTouchCounts.get(targetLink.target.id) || 1
        ),
      };

      return [sourceSegment, targetSegment];
    });

    const nodeVisualBounds = new Map();
    const addNodeVisualPoint = (node, y, width) => {
      if (!node) return;
      const halfHeight = moneyTableStrokeWidth({ width }) / 2;
      const breathingRoom = Math.max(2, moneyTableStrokeWidth({ width }) * 0.24);
      const previous = nodeVisualBounds.get(node.id) || { min: Infinity, max: -Infinity };
      nodeVisualBounds.set(node.id, {
        min: Math.min(previous.min, y - halfHeight - breathingRoom),
        max: Math.max(previous.max, y + halfHeight + breathingRoom),
      });
    };

    visibleLinks.forEach((link) => {
      addNodeVisualPoint(link.source, link.y0, link.visualWidth || link.width);
      addNodeVisualPoint(link.target, link.y1, link.visualWidth || link.width);
    });

    const visualNodeBox = (node) => {
      const bounds = nodeVisualBounds.get(node.id);
      const layoutHeight = node.y1 - node.y0;
      const minHeight = nodeState(node) === 'idle' ? 22 : 30;

      if (!bounds) {
        const height = Math.min(layoutHeight, minHeight);
        const center = node.y0 + layoutHeight / 2;
        return {
          y: center - height / 2,
          height,
          center,
        };
      }

      const boundedMin = Math.max(0, bounds.min);
      const boundedMax = Math.min(flowFieldHeight, bounds.max);
      const center = (boundedMin + boundedMax) / 2;
      const height = Math.max(2.4, boundedMax - boundedMin);
      const finalHeight = height;

      return {
        y: center - finalHeight / 2,
        height: finalHeight,
        center,
      };
    };

    const gradients = defs
      .selectAll('linearGradient.live-flow-gradient')
      .data(visibleLinks, (link) => link.id);

    gradients.exit().remove();

    const gradientsEnter = gradients.enter()
      .append('linearGradient')
      .attr('class', 'live-flow-gradient')
      .attr('id', (link) => `live-monitoring-gradient-${domId(link.id)}`)
      .attr('gradientUnits', 'userSpaceOnUse');

    gradientsEnter.merge(gradients)
      .attr('x1', (link) => link.source.x1)
      .attr('x2', (link) => link.target.x0)
      .attr('y1', (link) => link.y0)
      .attr('y2', (link) => link.y1)
      .each(function updateGradient(link) {
        const stops = d3.select(this).selectAll('stop')
          .data([
            ['0%', nodeColor(link.source), 0.28],
            ['24%', nodeColor(link.source), 0.92],
            ['76%', nodeColor(link.target), 0.92],
            ['100%', nodeColor(link.target), 0.28],
          ]);

        stops.enter()
          .append('stop')
          .merge(stops)
          .attr('offset', (stop) => stop[0])
          .attr('stop-color', (stop) => stop[1])
          .attr('stop-opacity', (stop) => stop[2]);

        stops.exit().remove();
      });

    const linkGroup = linkLayer
      .selectAll('g.live-monitoring-link-group')
      .data(visibleLinks, (link) => link.id)
      .join(
        (enter) => {
          const group = enter.append('g')
            .attr('class', 'live-monitoring-link-group')
            .style('mix-blend-mode', (link) => linkBlendMode(link));

          group.append('path')
            .attr('d', relaxedSankeyPath)
            .attr('id', (link) => `live-flow-path-${domId(link.id)}`)
            .attr('stroke', (link) => `url(#live-monitoring-gradient-${domId(link.id)})`)
            .attr('stroke-width', (link) => moneyTableStrokeWidth(link))
            .style('mix-blend-mode', (link) => linkBlendMode(link))
            .style('stroke-opacity', 0)
            .attr('class', (link) => `live-monitoring-sankey-link live-link-${linkState(link)}`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'stroke');

          return group;
        },
        (update) => update,
        (exit) => exit.transition().duration(260).style('opacity', 0).remove()
      );

    linkGroup.order();
    linkGroup.style('mix-blend-mode', (link) => linkBlendMode(link));

    linkGroup.select('path')
      .attr('d', relaxedSankeyPath)
      .attr('stroke', (link) => `url(#live-monitoring-gradient-${domId(link.id)})`)
      .attr('stroke-width', (link) => moneyTableStrokeWidth(link))
      .attr('class', (link) => `live-monitoring-sankey-link live-link-${linkState(link)}`)
      .style('mix-blend-mode', (link) => linkBlendMode(link))
      .style('stroke-opacity', (link) => calmLinkOpacity(link));

    linkGroup.select('path').each(function animatePath(_, index) {
      const datum = d3.select(this).datum();
      const state = linkState(datum);
      const length = this.getTotalLength();
      const partialLength = length * 0.56;
      const previousState = this.dataset.liveState;
      const path = d3.select(this);
      path.interrupt()
        .style('mix-blend-mode', linkBlendMode(datum))
        .style('stroke-opacity', calmLinkOpacity(datum));

      if (state === 'partial') {
        if (!this.dataset.liveMoneyTableAnimated) {
          this.dataset.liveMoneyTableAnimated = 'true';
          path
            .attr('stroke-dasharray', `${partialLength} ${length}`)
            .attr('stroke-dashoffset', length)
            .transition()
            .duration(2000)
            .delay(index * 50)
            .ease(d3.easeCubicInOut)
            .attr('stroke-dashoffset', length - partialLength);
        } else {
          path
            .attr('stroke-dasharray', `${partialLength} ${length}`)
            .attr('stroke-dashoffset', length - partialLength);
        }
        this.dataset.liveState = state;
        return;
      }

      if (state === 'completed' && previousState === 'partial') {
        this.dataset.liveMoneyTableAnimated = 'true';
        path
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length - partialLength)
          .transition()
          .duration(2000)
          .delay(index * 50)
          .ease(d3.easeCubicInOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function clearDash() {
            d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
          });
        this.dataset.liveState = state;
        return;
      }

      if ((state === 'active' || state === 'completed') && !this.dataset.liveMoneyTableAnimated) {
        this.dataset.liveMoneyTableAnimated = 'true';
        path
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length)
          .transition()
          .duration(2000)
          .delay(index * 50)
          .ease(d3.easeCubicInOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function clearDash() {
            d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
          });
        this.dataset.liveState = state;
        return;
      }

      if (state === 'completed' || state === 'dimmed' || state === 'history') {
        path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      }
      this.dataset.liveState = state;
    });

    nodeLayer.select('rect')
      .transition()
      .duration(240)
      .attr('y', (item) => visualNodeBox(item).y - item.y0)
      .attr('height', (item) => visualNodeBox(item).height)
      .attr('width', (item) => Math.max(2.4, item.x1 - item.x0))
      .attr('opacity', (item) => nodeOpacity(nodeState(item)))
      .attr('class', (item) => `live-node-bar live-node-${nodeState(item)}`);

    nodeLayer.select('text')
      .transition()
      .duration(240)
      .attr('y', (item) => visualNodeBox(item).center - item.y0)
      .style('opacity', (item) => Math.max(0.28, nodeOpacity(nodeState(item)) * 0.9));

    const tooltip = d3.select(tooltipRef.current);
    const currentPaths = () => linkLayer.selectAll('path.live-monitoring-sankey-link');
    const highlightConnectedNodes = (nodeIds, duration = 100) => {
      nodeLayer.transition().duration(duration)
        .style('opacity', (candidate) => nodeIds.has(candidate.id) ? 1 : OPACITY.nodeDimmed);

      nodeLayer.select('rect').transition().duration(duration)
        .attr('opacity', (candidate) => {
          if (nodeIds.has(candidate.id)) return 1;
          return Math.min(nodeOpacity(nodeState(candidate)), OPACITY.nodeDimmed);
        });

      nodeLayer.select('text').transition().duration(duration)
        .style('opacity', (candidate) => nodeIds.has(candidate.id) ? 1 : Math.max(0.22, OPACITY.nodeDimmed));
    };

    const restoreNodes = (duration = 100) => {
      nodeLayer.transition().duration(duration).style('opacity', 1);
      nodeLayer.select('rect').transition().duration(duration)
        .attr('opacity', (candidate) => nodeOpacity(nodeState(candidate)));
      nodeLayer.select('text').transition().duration(duration)
        .style('opacity', (candidate) => Math.max(0.28, nodeOpacity(nodeState(candidate)) * 0.9));
    };

    nodeLayer
      .on('mouseenter', (event, hoveredNode) => {
        currentPaths().transition().duration(100)
          .style('stroke-opacity', (link) => {
            if (!isVisibleLink(link)) return 0;
            return link.source === hoveredNode || link.target === hoveredNode
              ? OPACITY.linkHover
              : Math.min(OPACITY.linkDimmed, calmLinkOpacity(link) * 0.45);
          });

        const connectedNodes = new Set([hoveredNode.id]);
        visibleLinks.forEach((link) => {
          if (link.source === hoveredNode || link.target === hoveredNode) {
            connectedNodes.add(link.source.id);
            connectedNodes.add(link.target.id);
          }
        });
        highlightConnectedNodes(connectedNodes);
      })
      .on('mouseleave', () => {
        currentPaths().transition().duration(100)
          .style('mix-blend-mode', (link) => linkBlendMode(link))
          .style('stroke-opacity', (link) => calmLinkOpacity(link));
        restoreNodes();
      });

    linkLayer.selectAll('path.live-monitoring-sankey-link')
      .on('mouseenter', (event, link) => {
        if (!isVisibleLink(link)) return;
        const connectedNodes = flowNodesById.get(link.flowId) || new Set([link.source.id, link.target.id]);
        d3.select(event.currentTarget).transition().duration(100)
          .style('mix-blend-mode', 'screen')
          .style('stroke-opacity', OPACITY.linkHover);
        highlightConnectedNodes(connectedNodes);

        tooltip
          .style('opacity', 1)
          .html(`
            <div style="font-weight:800;color:${nodeColor(link.source)}">${link.source.name}</div>
            <div style="margin:5px 0;color:#555">to</div>
            <div style="font-weight:800;color:${nodeColor(link.target)}">${link.target.name}</div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 14}px`)
          .style('top', `${event.pageY - 18}px`);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).transition().duration(100)
          .style('mix-blend-mode', (link) => linkBlendMode(link))
          .style('stroke-opacity', (link) => calmLinkOpacity(link));
        restoreNodes();
        tooltip.style('opacity', 0);
      });
  }, [flowState?.version, dimensions, graphVersion]);

  return (
    <section ref={containerRef} className="live-sankey-shell">
      <svg ref={svgRef} className="h-full w-full overflow-visible" />
      <div ref={tooltipRef} className="live-sankey-tooltip" />
    </section>
  );
}

export default function LiveMonitoringPage() {
  const analytics = useLiveAnalytics();
  const flowState = useLiveSankeyState();

  return (
    <div className="h-full overflow-hidden bg-[#020202] text-white relative">
      <style>{`
        .live-monitor-grid {
          background: #020202;
        }

        .live-monitor-grid,
        .live-monitor-grid * {
          letter-spacing: 0 !important;
        }

        .live-stat-card {
          position: relative;
          min-height: 102px;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid #1f1f22;
          background: #070707;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 22px 48px rgba(0,0,0,0.34);
          padding: 12px 16px;
        }

        .live-stat-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.018), transparent 52%);
          pointer-events: none;
        }

        .live-stat-head {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .live-stat-copy {
          flex: 1;
          min-width: 0;
        }

        .live-stat-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 8px;
          color: #a1a1aa;
          border: 1px solid #27272a;
          background: linear-gradient(180deg, rgba(39,39,42,0.62), rgba(24,24,27,0.35));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.055);
        }

        .live-stat-label {
          color: #7c7c84;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          line-height: 0.9;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .live-stat-value-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
        }

        .live-stat-value {
          display: block;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
        }

        .live-stat-delta {
          color: #18d79d;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          border-radius: 5px;
          background: rgba(0,214,155,0.12);
          padding: 4px 6px;
          line-height: 1;
        }

        .live-stat-chart-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 10px;
        }

        .live-stat-line {
          width: 116px;
          height: 34px;
          flex: 0 1 116px;
          overflow: visible;
        }

        .live-stat-line-fill {
          opacity: 1;
        }

        .live-stat-line-path,
        .live-stat-line-shadow {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .live-stat-line-shadow {
          stroke: #00d69b;
          stroke-width: 4;
          opacity: 0.14;
          filter: blur(2px);
        }

        .live-stat-line-path {
          stroke: #00d69b;
          stroke-width: 2;
          opacity: 1;
        }

        .live-stat-line-dot {
          fill: #00d69b;
          filter: drop-shadow(0 0 6px #00d69b);
        }

        .live-sankey-shell {
          position: relative;
          min-height: 0;
          flex: 1;
          overflow: visible;
          border: 0;
          background: #020202;
          box-shadow: none;
          user-select: none;
        }

        .live-monitoring-sankey-link {
          transition: stroke-opacity 180ms ease;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .live-link-active,
        .live-link-partial,
        .live-link-completed {
          filter: none;
        }

        .live-node-bar {
          transition: opacity 180ms ease;
        }

        .live-node-pulsing,
        .live-node-active,
        .live-node-partial {
          animation: liveNodeBreath 1.7s ease-in-out infinite;
        }

        .live-node-completed {
          animation: liveNodeConfirm 900ms ease-out 1;
        }

        @keyframes liveNodeBreath {
          0%, 100% { opacity: 0.62; }
          50% { opacity: 1; }
        }

        @keyframes liveNodeConfirm {
          0% { opacity: 0.58; }
          35% { opacity: 1; }
          100% { opacity: 0.86; }
        }

        .live-sankey-tooltip {
          pointer-events: none;
          position: fixed;
          z-index: 50;
          min-width: 140px;
          opacity: 0;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(9,9,11,0.92);
          box-shadow: 0 0 30px rgba(0,0,0,0.8);
          color: white;
          padding: 14px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          backdrop-filter: blur(18px);
          transition: opacity 160ms ease;
        }
      `}</style>

      <div className="live-monitor-grid h-full overflow-auto custom-scrollbar px-7 py-5">
        <div className="min-h-full flex flex-col gap-4">
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
            {analytics.map((item, index) => (
              <AnalyticsCard key={item.label} item={item} value={item.value} index={index} />
            ))}
          </section>

          <RealtimeSankey flowState={flowState} />
        </div>
      </div>
    </div>
  );
}
