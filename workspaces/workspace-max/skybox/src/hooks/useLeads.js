import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date_created');
  const [sortDir, setSortDir] = useState('desc');
  const abortRef = useRef(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('leads')
        .select('*')
        .order(sortBy, { ascending: sortDir === 'asc' });

      if (err) throw err;
      if (!abortRef.current) setLeads(data || []);
    } catch (err) {
      if (!abortRef.current) setError(err.message);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    abortRef.current = false;
    fetchLeads();
    return () => { abortRef.current = true; };
  }, [fetchLeads]);

  // ─── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── CRUD ───────────────────────────────────────────────────────────────
  const createLead = async (leadData) => {
    const { data, error: err } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();
    if (err) throw err;
    return data;
  };

  const updateLead = async (id, updates) => {
    const { data, error: err } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    setLeads(prev => prev.map(l => l.id === id ? data : l));
    return data;
  };

  const deleteLead = async (id) => {
    const { error: err } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    if (err) throw err;
    setLeads(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ─── Filtering & Sorting ───────────────────────────────────────────────
  const filteredLeads = leads
    .filter(l => {
      // Status filter
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      // Source filter
      if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          l.company, l.first_name, l.last_name, l.email,
          l.city, l.state, l.industry, l.phone, l.website,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });

  const selectedLead = leads.find(l => l.id === selectedId) || null;

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  return {
    leads: filteredLeads,
    allLeads: leads,
    loading,
    error,
    selectedId,
    setSelectedId,
    selectedLead,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    sortBy,
    sortDir,
    handleSort,
    createLead,
    updateLead,
    deleteLead,
    refresh: fetchLeads,
  };
}
