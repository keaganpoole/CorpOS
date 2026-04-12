/**
 * useSonarState — React hook for live backend state
 * Connects to WebSocket on mount, manages all operational data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, connectWebSocket, addMessageListener, disconnectWebSocket } from '../lib/api';
import { supabase } from '../lib/supabase';

export function useSonarState() {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [controlState, setControlState] = useState({ runtime_mode: 'running', stage: 'code_blue', zone: 1 });
  const [session, setSession] = useState(null);
  const [livePulse, setLivePulse] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [pipeline, setPipeline] = useState({ stages: [], totalRelics: 0, qualifiedLeads: 0, activeOutreach: 0 });
  const [cronJobs, setCronJobs] = useState([]);
const [reactions, setReactions] = useState([]);
  const [summary, setSummary] = useState({ ok: 0, warnings: 0, errors: 0, activeAgents: 0, totalAgents: 0 });
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [isPaused, setIsPaused] = useState(false);

  // Load initial data via REST
  const loadInitialData = useCallback(async () => {
    const [agentsData, controlData, sessionData, pulseData, logsData, summaryData, pipelineData, cronData, reactionsData] = await Promise.all([
      api.getAgents(),
      api.getControlState(),
      api.getSession(),
      api.getLivePulse(30),
      api.getLogs(50),
      api.getSystemSummary(),
      api.getPipeline(),
      api.getCronJobs(),
      api.getReactions(),
    ]);

    // Note: tasksData removed - Sonar no longer uses tasks
    if (agentsData) setAgents(agentsData);
    if (controlData) {
      setControlState(controlData);
      setIsPaused(controlData.runtime_mode === 'paused');
    }
    if (sessionData) setSession(sessionData);
    if (pulseData) setLivePulse(pulseData);
    if (logsData) setSystemLogs(logsData);
    if (summaryData) setSummary(summaryData);
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
        setControlState(data.control || {});
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
        setControlState(s);
        setIsPaused(s.runtime_mode === 'paused');
      })
      .subscribe();

    const agentsSub = supabase
      .channel('agents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAgents(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setAgents(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        } else if (payload.eventType === 'DELETE') {
          setAgents(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe();

    const reactionsSub = supabase
      .channel('reactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => {
        // Refresh reaction counts on any change
        api.getReactions().then(d => { if (d) setReactions(d); });
      })
      .subscribe();

    // Polling fallback — refreshes every 10s in case WebSocket goes stale
    const pollTimer = setInterval(() => {
      loadInitialData();
    }, 10000);

    return () => {
      clearInterval(pollTimer);
      removeListener();
      disconnectWebSocket();
      supabase.removeChannel(stateSub);
      supabase.removeChannel(agentsSub);
      supabase.removeChannel(reactionsSub);
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
    // Update UI immediately
    setControlState(prev => ({ ...prev, zone }));
    // Sync to backend in background
    if (window.sonar?.control) {
      window.sonar.control.setZone(zone);
    } else {
      api.setZone(zone);
    }
  }, []);

  const pingMax = useCallback(async () => {
    if (window.sonar?.control) {
      await window.sonar.control.pingMax();
    } else {
      await api.pingMax();
    }
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
    isPaused,
    toggleRuntime,
    setStage,
    setZone,
    pingMax,
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
