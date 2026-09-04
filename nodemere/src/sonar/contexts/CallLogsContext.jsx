import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CallLogsContext = createContext(null);
const CALL_LOGS_PAGE_SIZE = 20;

export const CallLogsProvider = ({ children, normalizeCall }) => {
  const { session, workforce } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const activeQueryRef = useRef('');

  const loadCallLogs = async ({ initial = false, force = false, append = false, searchQuery = activeQueryRef.current } = {}) => {
    if (!session?.access_token || workforce?.tenant?.role === 'STAFF') {
      setCalls([]);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      hasLoadedRef.current = false;
      return;
    }
    if (loadingRef.current) return;
    const normalizedQuery = String(searchQuery || '').trim();
    const queryChanged = normalizedQuery !== activeQueryRef.current;
    if (!force && initial && hasLoadedRef.current && !queryChanged) return;

    loadingRef.current = true;
    activeQueryRef.current = normalizedQuery;
    const offset = append && !queryChanged ? calls.length : 0;
    setLoading(!append && (initial || force || queryChanged || !hasLoadedRef.current));
    setLoadingMore(append);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/sonar/call-logs/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: CALL_LOGS_PAGE_SIZE, offset, q: normalizedQuery }),
      });
      if (!response.ok) throw new Error(`Call logs request failed (${response.status})`);
      const data = await response.json();
      const normalizedCalls = Array.isArray(data) ? data.map(normalizeCall) : [];
      const nextCalls = append && !queryChanged ? [...calls, ...normalizedCalls] : normalizedCalls;
      setCalls(nextCalls);
      setHasMore(normalizedCalls.length === CALL_LOGS_PAGE_SIZE);
      setSelectedId((current) => (
        nextCalls.some((call) => call.id === current)
          ? current
          : nextCalls[0]?.id || null
      ));
      setSelectedForDelete((current) => current.filter((id) => nextCalls.some((call) => call.id === id)));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load call logs.');
      if (!append) {
        setCalls([]);
        setHasMore(false);
      }
    } finally {
      hasLoadedRef.current = true;
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token || workforce?.tenant?.role === 'STAFF') {
      setCalls([]);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      hasLoadedRef.current = false;
      return undefined;
    }

    let cancelled = false;
    let refreshTimer = null;
    const userId = session.user?.id || 'current-user';

    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (!cancelled) loadCallLogs({ force: true });
      }, 350);
    };

    loadCallLogs({ initial: true });
    const pollingTimer = window.setInterval(() => {
      if (!cancelled) loadCallLogs({ force: true });
    }, 5000);
    const channel = supabase
      .channel(`call-logs-dashboard-cache-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs', filter: `business_id=eq.${workforce?.tenant?.business_id}` }, scheduleRefresh)
      .subscribe((status, error) => {
        if (error) {
          console.warn("CallLogsContext.jsx:event_107");
          return;
        }
        console.debug("CallLogsContext.jsx:event_110");
      });

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(pollingTimer);
      supabase.removeChannel(channel);
    };
  }, [session?.access_token, workforce?.tenant?.business_id, workforce?.tenant?.role]);

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
    loadingMore,
    hasMore,
  }), [calls, loading, loadingMore, hasMore, error, selectedId, selectedForDelete]);

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
