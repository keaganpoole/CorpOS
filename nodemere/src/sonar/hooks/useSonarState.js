/**
 * useSonarState — React hook for live backend state
 * Connects to WebSocket on mount, manages all operational data
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, connectWebSocket, addMessageListener, disconnectWebSocket } from '../lib/api';
import { supabase } from '../lib/supabase';

function normalizeCallDirection(value) {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (normalized === 'incoming') return 'inbound';
  if (normalized === 'outgoing') return 'outbound';
  if (normalized === 'off' || normalized === 'disabled') return 'none';
  return ['inbound', 'outbound', 'all', 'none'].includes(normalized) ? normalized : 'all';
}

function directionConflicts(selectedDirection, existingDirection) {
  const selected = normalizeCallDirection(selectedDirection);
  const existing = normalizeCallDirection(existingDirection);
  if (selected === 'all') return existing !== 'none';
  if (selected === 'inbound') return existing === 'inbound' || existing === 'all';
  if (selected === 'outbound') return existing === 'outbound' || existing === 'all';
  return false;
}

function withSelectedDirection(items, agentId, direction) {
  return items.map(agent => {
    if (String(agent.id) === String(agentId)) {
      return {
        ...agent,
        direction,
        status: agent.is_active === false ? 'Offline' : direction === 'none' ? 'Idle' : 'Online',
      };
    }
    return directionConflicts(direction, agent.direction)
      ? { ...agent, direction: 'none', status: agent.is_active === false ? 'Offline' : 'Idle' }
      : agent;
  });
}

export function useSonarState() {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pendingDirections, setPendingDirections] = useState([]);
  const pendingDirectionsRef = useRef([]);
  const directionRevisionRef = useRef(0);
  const directionWriteQueueRef = useRef(Promise.resolve());
  const agentsRequestEpochRef = useRef(0);
  const visibleAgents = useMemo(() => pendingDirections.reduce(
    (items, pending) => withSelectedDirection(items, pending.agentId, pending.direction),
    agents,
  ), [agents, pendingDirections]);
  const [controlState, setControlState] = useState({ runtime_mode: 'running', stage: 'code_blue', calls_filter: 'all' });
  const [session, setSession] = useState(null);
  const [livePulse, setLivePulse] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [pipeline, setPipeline] = useState({ stages: [], totalRelics: 0, qualifiedLeads: 0, activeOutreach: 0 });
  const [cronJobs, setCronJobs] = useState([]);
const [reactions, setReactions] = useState([]);
  const [summary, setSummary] = useState({ ok: 0, warnings: 0, errors: 0, activeAgents: 0, totalAgents: 0 });
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [accountSettingsId, setAccountSettingsId] = useState(null);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // Load initial data via REST
  const loadInitialData = useCallback(async () => {
    // Receptionist cards are the primary content on this screen. Resolve that
    // request independently so a slow, unrelated dashboard widget cannot hold
    // the whole page behind one Promise.all barrier.
    const requestEpoch = agentsRequestEpochRef.current;
    const agentsRequest = api.getAgents();
    setAgentsLoading(true);
    agentsRequest.then((agentsData) => {
      if (!Array.isArray(agentsData) || requestEpoch !== agentsRequestEpochRef.current) return;
      setAgents(agentsData);
      const activeAgents = agentsData.filter((agent) => agent?.is_active !== false).length;
      setSummary({ ok: activeAgents, warnings: 0, errors: 0, activeAgents, totalAgents: agentsData.length });
    }).catch(() => {}).finally(() => setAgentsLoading(false));

    const bootstrap = await api.getDashboardBootstrap();
    const controlData = bootstrap?.control;
    const sessionData = bootstrap?.session;
    const pulseData = bootstrap?.live_pulse;
    const logsData = bootstrap?.logs;
    const pipelineData = bootstrap?.pipeline;
    const cronData = bootstrap?.cron;
    const reactionsData = bootstrap?.reactions;
    const accountSettings = bootstrap?.account_settings;

    // Note: tasksData removed - Sonar no longer uses tasks
    if (controlData) {
      setControlState(prev => ({ ...prev, ...controlData, calls_filter: prev.calls_filter || 'all' }));
      setIsPaused(controlData.runtime_mode === 'paused');
    }
    if (accountSettings) {
      setAccountSettingsId(accountSettings.id || null);
      setControlState(prev => ({
        ...prev,
        calls_filter: String(accountSettings.call_routing || prev.calls_filter || 'all').toLowerCase(),
      }));
    }
    if (sessionData) setSession(sessionData);
    if (pulseData) setLivePulse(pulseData);
    if (logsData) setSystemLogs(logsData);
    // Derive these counters from the agent snapshot instead of issuing a
    // second authenticated request that repeats the same database query.
    if (pipelineData) setPipeline(pipelineData);
    if (cronData) setCronJobs(cronData);
    if (reactionsData) setReactions(reactionsData);
  }, []);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'initial_state':
        setTasks(data.tasks || []);
        if (!pendingDirectionsRef.current.length) setAgents(data.agents || []);
        setAgentsLoading(false);
        setControlState(prev => ({ ...prev, ...(data.control || {}), calls_filter: prev.calls_filter || 'all' }));
        setSession(data.session);
        setLivePulse(data.recentEvents || []);
        setSystemLogs(data.systemLogs || []);
        setSummary(data.summary || {});
        if (data.pipeline) setPipeline(data.pipeline);
        setIsPaused(data.control?.runtime_mode === 'paused');
        break;

      case 'event':
        // Add to live pulse
        setLivePulse(prev => [data, ...prev].slice(0, 50));

        // Refresh affected data based on event type
        if (data.event_type?.startsWith('task_')) {
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === data.task_id);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status: mapTaskStatus(data.event_type), latest_update: data.message, latest_update_at: data.timestamp };
            return updated;
          });
        }

        if (data.event_type?.startsWith('agent_')) {
          setAgents(prev => {
            const idx = prev.findIndex(a => a.id === data.agent_id);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status: mapAgentStatus(data.event_type), current_activity: data.message, last_heartbeat_at: data.timestamp };
            return updated;
          });
        }

        if (data.event_type === 'runtime_paused') {
          setIsPaused(true);
          setControlState(prev => ({ ...prev, runtime_mode: 'paused' }));
        } else if (data.event_type === 'runtime_resumed') {
          setIsPaused(false);
          setControlState(prev => ({ ...prev, runtime_mode: 'running' }));
        } else if (data.event_type === 'stage_changed') {
          setControlState(prev => ({ ...prev, stage: data.payload?.stage || prev.stage }));
        }

        // Refresh pipeline on lead events
        if (data.event_type?.startsWith('lead_')) {
          api.getPipeline().then(d => { if (d) setPipeline(d); });
        }

        // Campaign events refresh handled by Supabase realtime in useCampaigns hook

        if (data.event_type?.startsWith('system_') || data.event_type === 'log_entry') {
          setSystemLogs(prev => [{
            timestamp: data.timestamp,
            level: data.severity || 'info',
            source: data.source || 'system',
            message: data.message,
          }, ...prev].slice(0, 50));
        }
        break;

      case 'session_change':
        setSession(data.session);
        break;
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    loadInitialData();
    connectWebSocket(setWsStatus);
    const removeListener = addMessageListener(handleWsMessage);

    // Supabase real-time subscriptions for state, agents, reactions
    const stateSub = supabase
      .channel('state-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'state' }, (payload) => {
        const s = payload.new;
        setControlState(prev => ({ ...prev, ...s, calls_filter: prev.calls_filter || 'all' }));
        setIsPaused(s.runtime_mode === 'paused');
      })
      .subscribe();

    const agentsSub = supabase
      .channel('agents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hired_receptionists' }, (payload) => {
        const changed = payload.new || payload.record || {};
        const changedId = String(changed.id || payload.old?.id || '');
        const isRemoved = payload.eventType === 'DELETE'
          || (payload.eventType === 'UPDATE' && (changed.is_active === false || ['archived', 'deleted', 'terminated'].includes(String(changed.status || '').toLowerCase())));

        if (isRemoved && changedId) {
          let hadAgent = false;
          setAgents(prev => {
            hadAgent = prev.some(agent => String(agent.id) === changedId);
            return prev.filter(agent => String(agent.id) !== changedId);
          });
          if (hadAgent) setSummary(prev => ({ ...prev, activeAgents: Math.max(0, (prev.activeAgents || 0) - 1), totalAgents: Math.max(0, (prev.totalAgents || 0) - 1) }));
          return;
        }

        // Refresh only for other changes that may affect field mapping.
        const requestEpoch = agentsRequestEpochRef.current;
        api.getAgents().then(d => {
          if (!Array.isArray(d) || requestEpoch !== agentsRequestEpochRef.current) return;
          setAgents(d);
        });
      })
      .subscribe();

    const reactionsSub = supabase
      .channel('reactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => {
        // Refresh reaction counts on any change
        api.getReactions().then(d => { if (d) setReactions(d); });
      })
      .subscribe();

    const accountSettingsSub = supabase
      .channel('account-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_settings' }, (payload) => {
        const next = payload.new || payload.record || null;
        if (!next) return;
        const normalized = String(next.call_routing || 'all').toLowerCase();
        setAccountSettingsId(next.id || null);
        setControlState(prev => ({
          ...prev,
          calls_filter: normalized || prev.calls_filter || 'all',
        }));
        setAgents(prev => prev.map(agent => {
          const currentStatus = String(agent.status || '').trim().toLowerCase();
          if (currentStatus === 'offline') return agent;
          return {
            ...agent,
            status: normalized === 'inbound' || normalized === 'outbound' || normalized === 'all'
              ? 'Online'
              : 'Idle',
          };
        }));
      })
      .subscribe();

    return () => {
      removeListener();
      disconnectWebSocket();
      supabase.removeChannel(stateSub);
      supabase.removeChannel(agentsSub);
      supabase.removeChannel(reactionsSub);
      supabase.removeChannel(accountSettingsSub);
    };
  }, [loadInitialData, handleWsMessage]);

  // Control actions — optimistic updates, API calls in background
  const toggleRuntime = useCallback(async () => {
    const newMode = isPaused ? 'running' : 'paused';
    // Update UI immediately
    setIsPaused(newMode === 'paused');
    setControlState(prev => ({ ...prev, runtime_mode: newMode }));
    // Sync to backend in background
    if (window.sonar?.control) {
      window.sonar.control.setRuntime(newMode);
    } else {
      api.setRuntime(newMode);
    }
  }, [isPaused]);

  const setStage = useCallback((stage) => {
    // Update UI immediately
    setControlState(prev => ({ ...prev, stage }));
    // Sync to backend in background
    if (window.sonar?.control) {
      window.sonar.control.setStage(stage);
    } else {
      api.setStage(stage);
    }
  }, []);

  const setCallsFilter = useCallback(async (callsFilter) => {
    const normalized = String(callsFilter || 'all').trim().toLowerCase();
    const previous = controlState.calls_filter || 'all';

    setControlState(prev => ({ ...prev, calls_filter: normalized }));
    setAgents(prev => prev.map(agent => {
      const currentStatus = String(agent.status || '').trim().toLowerCase();
      if (currentStatus === 'offline') return agent;
      return {
        ...agent,
        status: normalized === 'inbound' || normalized === 'outbound' || normalized === 'all'
          ? 'Online'
          : 'Idle',
      };
    }));

    try {
      if (accountSettingsId) {
        const { data, error } = await supabase
          .from('account_settings')
          .update({ call_routing: normalized })
          .eq('id', accountSettingsId)
          .select('id, call_routing')
          .single();
        if (error) throw error;
        if (data?.id) setAccountSettingsId(data.id);
      } else {
        const { data: existingSettings, error: existingError } = await supabase
          .from('account_settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingSettings?.id) {
          const { data, error } = await supabase
            .from('account_settings')
            .update({ call_routing: normalized })
            .eq('id', existingSettings.id)
            .select('id, call_routing')
            .single();
          if (error) throw error;
          if (data?.id) setAccountSettingsId(data.id);
        } else {
          const { data, error } = await supabase
            .from('account_settings')
            .insert({ call_routing: normalized })
            .select('id, call_routing')
            .single();
          if (error) throw error;
          if (data?.id) setAccountSettingsId(data.id);
        }
      }
    } catch (err) {
      console.error("useSonarState.js:event_310");
      setControlState(prev => ({ ...prev, calls_filter: previous }));
      setAgents(prev => prev.map(agent => {
        const currentStatus = String(agent.status || '').trim().toLowerCase();
        if (currentStatus === 'offline') return agent;
        return {
          ...agent,
          status: previous === 'inbound' || previous === 'outbound' || previous === 'all'
            ? 'Online'
            : 'Idle',
        };
      }));
      return null;
    }

    return normalized;
  }, [accountSettingsId, controlState.calls_filter]);

  const pingMax = useCallback(async () => {
    if (window.sonar?.control) {
      await window.sonar.control.pingMax();
    } else {
      await api.pingMax();
    }
  }, []);

  const updateAgentActive = useCallback(async (agentId, isActive) => {
    let previousAgents = null;
    const nextStatus = isActive ? 'Online' : 'Offline';

    setAgents(prev => {
      previousAgents = prev;
      return prev.map(agent => {
        if (String(agent.id) === String(agentId)) {
          return {
            ...agent,
            is_active: isActive,
            status: nextStatus,
          };
        }
        if (isActive) {
          return {
            ...agent,
            is_active: false,
            status: 'Offline',
          };
        }
        return agent;
      });
    });

    const result = await api.patchAgent(agentId, {
      is_active: isActive,
      status: nextStatus,
    });

    if (!result) {
      if (previousAgents) {
        setAgents(previousAgents);
      }
      return null;
    }

    setAgents(prev => prev.map(agent => (
      String(agent.id) === String(agentId)
        ? {
            ...agent,
            ...result,
            is_active: result.is_active ?? isActive,
            status: result.status ?? nextStatus,
          }
        : agent
    )));

    return result;
  }, []);

  const updateAgentDirection = useCallback((agentId, direction) => {
    const normalizedDirection = normalizeCallDirection(direction);
    const revision = ++directionRevisionRef.current;
    const pending = { agentId, direction: normalizedDirection, revision };
    pendingDirectionsRef.current = [...pendingDirectionsRef.current, pending];
    agentsRequestEpochRef.current += 1;
    setPendingDirections(pendingDirectionsRef.current);

    // Serialize rapid changes so an older save cannot land after the latest choice.
    const save = async () => {
      try {
        const result = await api.patchAgent(agentId, { direction: normalizedDirection });
        if (!result) throw new Error('Could not save receptionist role.');
        // Commit this save even if a second card was changed while it ran.
        // The later choice stays layered over this confirmed result.
        setAgents(prev => withSelectedDirection(prev, agentId, normalizedDirection));
        agentsRequestEpochRef.current += 1;
        const requestEpoch = agentsRequestEpochRef.current;
        const refreshed = await api.getAgents();
        if (Array.isArray(refreshed) && requestEpoch === agentsRequestEpochRef.current) {
          setAgents(refreshed);
        }
        pendingDirectionsRef.current = pendingDirectionsRef.current.filter(item => item.revision !== revision);
        setPendingDirections(pendingDirectionsRef.current);
        return result;
      } catch (error) {
        agentsRequestEpochRef.current += 1;
        const requestEpoch = agentsRequestEpochRef.current;
        const refreshed = await api.getAgents();
        if (Array.isArray(refreshed) && requestEpoch === agentsRequestEpochRef.current) setAgents(refreshed);
        pendingDirectionsRef.current = pendingDirectionsRef.current.filter(item => item.revision !== revision);
        setPendingDirections(pendingDirectionsRef.current);
        throw error;
      }
    };
    const request = directionWriteQueueRef.current.then(save, save);
    directionWriteQueueRef.current = request.catch(() => {});
    return request;
  }, []);

  const removeAgent = useCallback((agentId) => {
    setAgents(prev => prev.filter(agent => String(agent.id) !== String(agentId)));
    setSummary(prev => ({ ...prev, activeAgents: Math.max(0, (prev.activeAgents || 0) - 1), totalAgents: Math.max(0, (prev.totalAgents || 0) - 1) }));
  }, []);

  return {
    tasks,
    agents: visibleAgents,
    controlState,
    session,
    livePulse,
    systemLogs,
    pipeline,
    cronJobs,
    reactions,
    summary,
    wsStatus,
    agentsLoading,
    isPaused,
    toggleRuntime,
    setCallsFilter,
    pingMax,
    updateAgentActive,
    updateAgentDirection,
    removeAgent,
    refresh: loadInitialData,
  };
}

// Map backend task statuses to frontend-friendly values
function mapTaskStatus(eventType) {
  const map = {
    task_created: 'queued',
    task_queued: 'queued',
    task_started: 'In Progress',
    task_progress: 'In Progress',
    task_completed: 'completed',
    task_failed: 'failed',
    task_warning: 'warning',
    task_paused: 'paused',
  };
  return map[eventType] || 'queued';
}

// Map backend agent statuses to frontend-friendly values
function mapAgentStatus(eventType) {
  const map = {
    agent_idle: 'idle',
    agent_active: 'active',
    agent_waiting: 'waiting',
    agent_paused: 'paused',
    agent_warning: 'warning',
    agent_error: 'error',
    agent_heartbeat: 'active',
  };
  return map[eventType] || 'idle';
}
