/**
 * useSonarState — React hook for live backend state
 * Connects to WebSocket on mount, manages all operational data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, connectWebSocket, addMessageListener, disconnectWebSocket } from '../lib/api';
import { supabase } from '../lib/supabase';

function normalizeAutonomyIndex(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(5, Math.max(1, parsed));
}

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

export function useSonarState() {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [controlState, setControlState] = useState({ runtime_mode: 'running', stage: 'code_blue', zone: 1, calls_filter: 'all' });
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
    const agentsRequest = api.getAgents();
    setAgentsLoading(true);
    agentsRequest.then((agentsData) => {
      if (!Array.isArray(agentsData)) return;
      setAgents(agentsData);
      const activeAgents = agentsData.filter((agent) => agent?.is_active !== false).length;
      setSummary({ ok: activeAgents, warnings: 0, errors: 0, activeAgents, totalAgents: agentsData.length });
    }).catch(() => {}).finally(() => setAgentsLoading(false));

    const [controlData, sessionData, pulseData, logsData, pipelineData, cronData, reactionsData, settingsResponse] = await Promise.all([
      api.getControlState(),
      api.getSession(),
      api.getLivePulse(30),
      api.getLogs(50),
      api.getPipeline(),
      api.getCronJobs(),
      api.getReactions(),
      supabase.from('account_settings').select('id, call_routing, autonomy_index').limit(1).maybeSingle(),
    ]);

    // Note: tasksData removed - Sonar no longer uses tasks
    if (controlData) {
      setControlState(prev => ({ ...prev, ...controlData, calls_filter: prev.calls_filter || 'all' }));
      setIsPaused(controlData.runtime_mode === 'paused');
    }
    if (!settingsResponse?.error && settingsResponse?.data) {
      setAccountSettingsId(settingsResponse.data.id || null);
      setControlState(prev => ({
        ...prev,
        calls_filter: String(settingsResponse.data.call_routing || prev.calls_filter || 'all').toLowerCase(),
        zone: normalizeAutonomyIndex(settingsResponse.data.autonomy_index ?? prev.zone),
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
        setAgents(data.agents || []);
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
        } else if (data.event_type === 'zone_changed') {
          setControlState(prev => ({ ...prev, zone: data.payload?.zone || prev.zone }));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hired_receptionists' }, () => {
        // Refresh agents from API to get proper field mapping
        api.getAgents().then(d => { if (d) setAgents(d); });
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
        const autonomyIndex = normalizeAutonomyIndex(next.autonomy_index);
        setAccountSettingsId(next.id || null);
        setControlState(prev => ({
          ...prev,
          calls_filter: normalized || prev.calls_filter || 'all',
          zone: autonomyIndex,
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

  const setZone = useCallback((zone) => {
    const autonomyIndex = normalizeAutonomyIndex(zone);
    let previousZone = controlState.zone;

    setControlState(prev => {
      previousZone = prev.zone;
      return { ...prev, zone: autonomyIndex };
    });

    const persistAutonomyIndex = async () => {
      try {
        if (accountSettingsId) {
          const { data, error } = await supabase
            .from('account_settings')
            .update({ autonomy_index: autonomyIndex })
            .eq('id', accountSettingsId)
            .select('id, autonomy_index')
            .single();
          if (error) throw error;
          if (data?.id) setAccountSettingsId(data.id);
          return data;
        }

        const { data: existingSettings, error: existingError } = await supabase
          .from('account_settings')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existingSettings?.id) {
          const { data, error } = await supabase
            .from('account_settings')
            .update({ autonomy_index: autonomyIndex })
            .eq('id', existingSettings.id)
            .select('id, autonomy_index')
            .single();
          if (error) throw error;
          if (data?.id) setAccountSettingsId(data.id);
          return data;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error('User not found');

        const { data, error } = await supabase
          .from('account_settings')
          .insert({ user_id: userId, autonomy_index: autonomyIndex })
          .select('id, autonomy_index')
          .single();
        if (error) throw error;
        if (data?.id) setAccountSettingsId(data.id);
        return data;
      } catch (err) {
        console.error('[SonarState] Failed to save autonomy index:', err.message || err);
        setControlState(prev => ({ ...prev, zone: previousZone }));
        return null;
      }
    };

    void persistAutonomyIndex();
  }, [accountSettingsId, controlState.zone]);

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
      console.error('[SonarState] Failed to save receptionist call filter:', err.message || err);
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

  const updateAgentDirection = useCallback(async (agentId, direction) => {
    const normalizedDirection = normalizeCallDirection(direction);
    let previousAgents = null;

    setAgents(prev => {
      previousAgents = prev;
      return prev.map(agent => (
        String(agent.id) === String(agentId)
          ? {
              ...agent,
              direction: normalizedDirection,
              status: agent.is_active === false ? 'Offline' : 'Online',
            }
          : directionConflicts(normalizedDirection, agent.direction)
            ? {
                ...agent,
                direction: 'none',
                status: agent.is_active === false ? 'Offline' : 'Idle',
              }
          : agent
      ));
    });

    const result = await api.patchAgent(agentId, {
      direction: normalizedDirection,
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
            direction: normalizeCallDirection(result.direction ?? normalizedDirection),
            status: result.status ?? agent.status,
          }
        : agent
    )));

    return result;
  }, []);

  return {
    tasks,
    agents,
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
    setZone,
    setCallsFilter,
    pingMax,
    updateAgentActive,
    updateAgentDirection,
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
