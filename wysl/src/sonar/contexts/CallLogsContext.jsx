import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CallLogsContext = createContext(null);

export const CallLogsProvider = ({ children, normalizeCall }) => {
  const { session } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);

  const loadCallLogs = async ({ initial = false, force = false } = {}) => {
    if (!session?.access_token) {
      setCalls([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }
    if (loadingRef.current) return;
    if (!force && initial && hasLoadedRef.current) return;

    loadingRef.current = true;
    setLoading(initial && !hasLoadedRef.current);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs?limit=100`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error(`Call logs request failed (${response.status})`);
      const data = await response.json();
      const normalizedCalls = Array.isArray(data) ? data.map(normalizeCall) : [];
      setCalls(normalizedCalls);
      setSelectedId((current) => (
        normalizedCalls.some((call) => call.id === current)
          ? current
          : normalizedCalls[0]?.id || null
      ));
      setSelectedForDelete((current) => current.filter((id) => normalizedCalls.some((call) => call.id === id)));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load call logs.');
      setCalls([]);
    } finally {
      hasLoadedRef.current = true;
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (!cancelled) loadCallLogs({ force: true });
      }, 350);
    };

    loadCallLogs({ initial: true });
    const channel = supabase
      .channel('call-logs-dashboard-cache')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [session?.access_token]);

  const value = useMemo(() => ({
    calls,
    setCalls,
    loading,
    error,
    setError,
    selectedId,
    setSelectedId,
    selectedForDelete,
    setSelectedForDelete,
    loadCallLogs,
  }), [calls, loading, error, selectedId, selectedForDelete]);

  return (
    <CallLogsContext.Provider value={value}>
      {children}
    </CallLogsContext.Provider>
  );
};

export const useCallLogs = () => {
  const context = useContext(CallLogsContext);
  if (!context) throw new Error('useCallLogs must be used inside CallLogsProvider');
  return context;
};
