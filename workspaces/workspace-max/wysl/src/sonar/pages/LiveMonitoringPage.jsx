import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';
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
  linkInitial: 0.24,
  linkHover: 0.54,
  linkDimmed: 0.045,
  nodeDimmed: 0.18,
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
  return INTENT_ALIASES[normalized] || normalized.replace(/^intent_/, '');
};

const rowPayload = (row) => row?.payload || row?.new?.payload || {};

const checkpointTimestamp = (row) => (
  rowPayload(row).timestamp || row?.created_at || new Date().toISOString()
);

const checkpointSortValue = (row) => new Date(checkpointTimestamp(row)).getTime() || 0;

const sessionKeyForCheckpoint = (payload) => (
  payload.call_id
  || payload.conversation_id
  || payload.execution_id
  || payload.session_id
  || `${payload.scenario_id || 'unknown'}:${payload.receptionist_id || payload.user_id || 'default'}`
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

const mergeRank = { idle: 0, dimmed: 1, pulsing: 2, active: 3, partial: 4, completed: 5 };

const strongerState = (a = 'idle', b = 'idle') => (
  (mergeRank[b] || 0) > (mergeRank[a] || 0) ? b : a
);

const TEN_ZERO_BUCKETS = Array.from({ length: 10 }, () => 0);

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const percentChange = (current, previous) => {
  if (!previous && !current) return '0%';
  if (!previous) return '+100%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

const safeDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const bucketSeries = (rows, valueForRow = () => 1) => {
  const buckets = [...TEN_ZERO_BUCKETS];
  const now = new Date();
  const start = new Date(now.getTime() - 9 * 60 * 60 * 1000);

  for (const row of rows || []) {
    const dt = safeDate(row.created_at || row.started_at);
    if (!dt || dt < start || dt > now) continue;
    const idx = Math.min(9, Math.max(0, Math.floor((dt - start) / (60 * 60 * 1000))));
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

    const todayStart = startOfLocalDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);
    const since = yesterdayStart.toISOString();

    const betweenToday = (row) => {
      const dt = safeDate(row.created_at || row.started_at);
      return dt && dt >= todayStart && dt < tomorrowStart;
    };

    const betweenYesterday = (row) => {
      const dt = safeDate(row.created_at || row.started_at);
      return dt && dt >= yesterdayStart && dt < todayStart;
    };

    const fetchAnalytics = async () => {
      try {
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

        const todayCalls = calls.filter(betweenToday);
        const yesterdayCalls = calls.filter(betweenYesterday);
        const todayAppointments = appointments.filter(betweenToday);
        const yesterdayAppointments = appointments.filter(betweenYesterday);
        const todayCustomers = customers.filter(betweenToday);
        const yesterdayCustomers = customers.filter(betweenYesterday);
        const todayRevenueRows = revenuePayments.filter(betweenToday);
        const yesterdayRevenueRows = revenuePayments.filter(betweenYesterday);
        const todayRevenue = todayRevenueRows.reduce((sum, row) => sum + paymentValue(row), 0);
        const yesterdayRevenue = yesterdayRevenueRows.reduce((sum, row) => sum + paymentValue(row), 0);

        const byKey = {
          calls: {
            value: todayCalls.length,
            delta: percentChange(todayCalls.length, yesterdayCalls.length),
            series: bucketSeries(todayCalls),
          },
          appointments: {
            value: todayAppointments.length,
            delta: percentChange(todayAppointments.length, yesterdayAppointments.length),
            series: bucketSeries(todayAppointments),
          },
          customers: {
            value: todayCustomers.length,
            delta: percentChange(todayCustomers.length, yesterdayCustomers.length),
            series: bucketSeries(todayCustomers),
          },
          revenue: {
            value: todayRevenue,
            delta: percentChange(todayRevenue, yesterdayRevenue),
            series: bucketSeries(todayRevenueRows, paymentValue),
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
    version: 0,
  });
  const scenarioCacheRef = useRef(new Map());
  const sessionsRef = useRef(new Map());
  const historyRef = useRef([]);
  const seenCheckpointIdsRef = useRef(new Set());

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
      const hasActiveSession = Array.from(sessionsRef.current.values()).some((session) => session.state !== 'history');

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

      historyRef.current.slice(-12).forEach((item) => {
        applyNode(item.sourceId, 'dimmed');
        applyNode(item.middleId, 'dimmed');
        applyNode(item.targetId, item.completed ? 'completed' : 'dimmed');
        applyLink(item.sourceLinkId, 'dimmed');
        applyLink(item.targetLinkId, item.completed ? 'completed' : 'dimmed');
      });

      sessionsRef.current.forEach((session) => {
        if (session.state === 'history') return;
        if (session.intent === 'call_started') {
          applyNode(session.sourceId, 'pulsing');
          return;
        }

        applyNode(session.sourceId, 'active');
        applyNode(session.middleId, 'active');
        applyLink(session.sourceLinkId, session.phase === 'completed' ? 'completed' : 'active');

        if (session.targetId) {
          applyNode(session.targetId, session.phase === 'completed' ? 'completed' : 'active');
          applyLink(session.targetLinkId, session.phase === 'completed' ? 'completed' : 'partial');
        }
      });

      if (hasActiveSession) {
        sankeyData.nodes.forEach((node) => {
          if (!nodeStates[node.id]) nodeStates[node.id] = 'dimmed';
        });
        sankeyData.links.forEach((link) => {
          if (!linkStates[link.id]) linkStates[link.id] = 'dimmed';
        });
      }

      setFlowState((prev) => ({
        linkStates,
        nodeStates,
        activeNodeIds: [...activeNodeIds],
        activeLinkIds: [...activeLinkIds],
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

    const applyCheckpoint = async (row) => {
      const identity = checkpointIdentity(row);
      if (seenCheckpointIdsRef.current.has(identity)) return;
      seenCheckpointIdsRef.current.add(identity);

      const payload = rowPayload(row);
      const intent = canonicalIntent(payload.intent_key);
      const phase = String(payload.phase || 'entered').toLowerCase();
      const scenarioId = String(payload.scenario_id || row?.scenario_id || '');
      if (!scenarioId || cancelled) return;

      const scenario = await resolveScenario(scenarioId);
      if (cancelled) return;

      const sourceId = scenarioDirection(scenario) === 'incoming' ? 'incoming' : 'outgoing';
      const sessionKey = sessionKeyForCheckpoint({ ...payload, scenario_id: scenarioId });

      if (intent === 'neutral') {
        sessionsRef.current.forEach((session, key) => {
          if (session.scenarioId !== scenarioId) return;
          if (session.sourceLinkId || session.targetLinkId) {
            historyRef.current.push({ ...session, completed: session.phase === 'completed' });
          }
          sessionsRef.current.delete(key);
        });
        publishState();
        return;
      }

      if (intent === 'call_started') {
        sessionsRef.current.set(sessionKey, {
          scenarioId,
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
      const previous = sessionsRef.current.get(sessionKey);

      if (previous && (previous.sourceLinkId || previous.targetLinkId) && previous.intent !== intent) {
        historyRef.current.push({ ...previous, completed: previous.phase === 'completed' });
      }

      const nextSession = {
        scenarioId,
        intent,
        phase,
        state: phase === 'completed' ? 'completed' : 'active',
        sourceId,
        middleId,
        targetId,
        sourceLinkId,
        targetLinkId,
        timestamp: checkpointTimestamp(row),
      };

      sessionsRef.current.set(sessionKey, nextSession);
      if (phase === 'completed') {
        historyRef.current.push({ ...nextSession, completed: true });
        historyRef.current = historyRef.current.slice(-20);
      }
      publishState();
    };

    const loadRecentCheckpoints = async (limit = 80) => {
      const checkpointsRes = await supabase
        .from('checkpoints')
        .select('*')
        .eq('trigger_key', 'intent_checkpoint')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (checkpointsRes.error) {
        console.warn('[LiveMonitoring] checkpoints query failed:', checkpointsRes.error.message);
      }

      const rows = (checkpointsRes.data || [])
        .sort((a, b) => checkpointSortValue(a) - checkpointSortValue(b));

      for (const row of rows) await applyCheckpoint(row);
    };

    const recoverRecentCheckpoints = () => {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => {
        loadRecentCheckpoints(20).catch((err) => {
          console.warn('[LiveMonitoring] checkpoint realtime recovery failed:', err);
        });
      }, 350);
    };

    loadRecentCheckpoints().catch((err) => console.warn('[LiveMonitoring] checkpoint warmup failed:', err));

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
            loadRecentCheckpoints(20).catch((recoveryErr) => {
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
    dimmed: 0.035,
    active: 0.58,
    partial: 0.72,
    completed: 0.66,
  }[state] ?? OPACITY.linkInitial);

  const nodeOpacity = (state) => ({
    idle: 0.55,
    dimmed: 0.18,
    pulsing: 1,
    active: 0.92,
    partial: 0.92,
    completed: 1,
  }[state] ?? 0.55);

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

    const glow = defs.append('filter')
      .attr('id', 'live-monitoring-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glow.append('feGaussianBlur')
      .attr('stdDeviation', '2.6')
      .attr('result', 'blur');

    glow.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    const layout = sankey()
      .nodeWidth(2)
      .nodePadding(isCompact ? 24 : 38)
      .nodeAlign(sankeyJustify)
      .nodeSort(null)
      .extent([[0, 0], [width, height]]);

    const graph = layout({
      nodes: sankeyData.nodes.map((node) => ({ ...node })),
      links: sankeyData.links.map((link) => ({ ...link })),
    });

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

    graphRef.current = { graph, width };
    layersRef.current = { defs, linkLayer, nodeLayer: node };
  }, [dimensions]);

  useEffect(() => {
    const graphRecord = graphRef.current;
    const layers = layersRef.current;
    if (!graphRecord || !layers) return;

    const { graph } = graphRecord;
    const { defs, linkLayer, nodeLayer } = layers;
    const linkStates = flowState?.linkStates || {};
    const nodeStates = flowState?.nodeStates || {};
    const linkState = (link) => linkStates[link.id] || 'idle';
    const nodeState = (node) => nodeStates[node.id] || 'idle';
    const isVisibleLink = (link) => linkState(link) !== 'idle';
    const visibleLinks = graph.links.filter(isVisibleLink);

    const gradients = defs
      .selectAll('linearGradient.live-flow-gradient')
      .data(visibleLinks, (link) => link.id);

    gradients.exit().remove();

    const gradientsEnter = gradients.enter()
      .append('linearGradient')
      .attr('class', 'live-flow-gradient')
      .attr('id', (link) => `live-monitoring-gradient-${link.id}`)
      .attr('gradientUnits', 'userSpaceOnUse');

    gradientsEnter.append('stop').attr('offset', '0%');
    gradientsEnter.append('stop').attr('offset', '50%');
    gradientsEnter.append('stop').attr('offset', '100%');

    gradientsEnter.merge(gradients)
      .attr('x1', (link) => link.source.x1)
      .attr('x2', (link) => link.target.x0)
      .attr('y1', (link) => link.y0)
      .attr('y2', (link) => link.y1)
      .each(function updateGradient(link) {
        const flowColor = nodeColor(link.target);
        d3.select(this).selectAll('stop')
          .data([
            ['0%', flowColor, 0.28],
            ['50%', flowColor, 0.82],
            ['100%', flowColor, 1],
          ])
          .attr('offset', (stop) => stop[0])
          .attr('stop-color', (stop) => stop[1])
          .attr('stop-opacity', (stop) => stop[2]);
      });

    const linkGroup = linkLayer
      .selectAll('g.live-monitoring-link-group')
      .data(visibleLinks, (link) => link.id)
      .join(
        (enter) => {
          const group = enter.append('g')
            .attr('class', 'live-monitoring-link-group')
            .style('mix-blend-mode', 'screen');

          group.append('path')
            .attr('d', sankeyLinkHorizontal())
            .attr('id', (link) => `live-flow-path-${link.id}`)
            .attr('stroke', (link) => `url(#live-monitoring-gradient-${link.id})`)
            .attr('stroke-width', (link) => Math.max(1, link.width))
            .attr('stroke-opacity', 0)
            .attr('class', (link) => `live-monitoring-sankey-link live-link-${linkState(link)}`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'stroke');

          return group;
        },
        (update) => update,
        (exit) => exit.transition().duration(260).style('opacity', 0).remove()
      );

    linkGroup.select('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (link) => `url(#live-monitoring-gradient-${link.id})`)
      .attr('stroke-width', (link) => Math.max(1, link.width))
      .attr('class', (link) => `live-monitoring-sankey-link live-link-${linkState(link)}`)
      .transition()
      .duration(240)
      .attr('stroke-opacity', (link) => linkOpacity(linkState(link)));

    linkGroup.select('path').each(function animatePath(_, index) {
      const datum = d3.select(this).datum();
      const state = linkState(datum);
      const length = this.getTotalLength();
      const path = d3.select(this);
      if (state === 'partial') {
        path
          .attr('stroke-dasharray', `${length * 0.56} ${length}`)
          .attr('stroke-dashoffset', 0);
        return;
      }
      if (state === 'active' && !this.dataset.liveAnimated) {
        this.dataset.liveAnimated = 'true';
        path
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length)
          .transition()
          .duration(850)
          .delay(index * 18)
          .ease(d3.easeCubicInOut)
          .attr('stroke-dashoffset', 0);
        return;
      }
      if (state === 'completed' || state === 'dimmed') {
        path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      }
    });

    linkGroup
      .selectAll('circle.live-flow-particle')
      .data((link) => (['active', 'partial'].includes(linkState(link))
        ? [0, 1].map((offset) => ({ link, offset }))
        : []), (item) => `${item.link.id}-${item.offset}`)
      .join(
        (enter) => {
          const particle = enter.append('circle')
            .attr('class', 'live-flow-particle')
            .attr('r', 2.3)
            .attr('fill', ({ link }) => nodeColor(link.target))
            .attr('opacity', 0.86);

          particle.append('animateMotion')
            .attr('dur', ({ offset }) => `${2.2 + offset * 0.45}s`)
            .attr('begin', ({ offset }) => `${offset * 0.7}s`)
            .attr('repeatCount', 'indefinite')
            .append('mpath')
            .attr('href', ({ link }) => `#live-flow-path-${link.id}`);

          return particle;
        },
        (update) => {
          update.attr('fill', ({ link }) => nodeColor(link.target));
          update.select('mpath')
            .attr('href', ({ link }) => `#live-flow-path-${link.id}`);
          return update;
        },
        (exit) => exit.remove()
      );

    nodeLayer.select('rect')
      .transition()
      .duration(240)
      .attr('opacity', (item) => nodeOpacity(nodeState(item)))
      .attr('class', (item) => `live-node-bar live-node-${nodeState(item)}`);

    nodeLayer.select('text')
      .transition()
      .duration(240)
      .style('opacity', (item) => Math.max(0.28, nodeOpacity(nodeState(item)) * 0.9));

    const tooltip = d3.select(tooltipRef.current);
    const currentPaths = () => linkLayer.selectAll('path.live-monitoring-sankey-link');

    nodeLayer
      .on('mouseenter', (event, hoveredNode) => {
        const connectedLinks = new Set([...hoveredNode.sourceLinks, ...hoveredNode.targetLinks]);

        currentPaths().transition().duration(180)
          .style('stroke-opacity', (link) => {
            if (!isVisibleLink(link)) return 0;
            return connectedLinks.has(link) ? OPACITY.linkHover : OPACITY.linkDimmed;
          });

        nodeLayer.transition().duration(180)
          .style('opacity', (candidate) => {
            const connected = candidate === hoveredNode
              || hoveredNode.sourceLinks.some((link) => link.target === candidate)
              || hoveredNode.targetLinks.some((link) => link.source === candidate);
            return connected ? 1 : OPACITY.nodeDimmed;
          });
      })
      .on('mouseleave', () => {
        currentPaths().transition().duration(180).style('stroke-opacity', (link) => linkOpacity(linkState(link)));
        nodeLayer.transition().duration(180).style('opacity', 1);
      });

    linkLayer.selectAll('path.live-monitoring-sankey-link')
      .on('mouseenter', (event, link) => {
        if (!isVisibleLink(link)) return;
        d3.select(event.currentTarget).transition().duration(160)
          .style('stroke-opacity', OPACITY.linkHover);

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
        d3.select(event.currentTarget).transition().duration(160)
          .style('stroke-opacity', (link) => linkOpacity(linkState(link)));
        tooltip.style('opacity', 0);
      });
  }, [flowState?.version, dimensions]);

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
        }

        .live-link-active,
        .live-link-partial {
          filter: drop-shadow(0 0 8px currentColor);
        }

        .live-link-completed {
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.22));
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

        .live-flow-particle {
          filter: drop-shadow(0 0 7px currentColor);
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
