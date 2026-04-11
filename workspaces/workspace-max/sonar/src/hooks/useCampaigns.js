import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    abortRef.current = false;
    try {
      const { data, error: err } = await supabase
        .from('research_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      if (!abortRef.current) setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[useCampaigns] Fetch error:', err);
      if (!abortRef.current) {
        setError(err?.message || 'Failed to fetch campaigns');
        setCampaigns([]);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, []);

  const createCampaign = async (campaignData) => {
    const { data, error: err } = await supabase
      .from('research_campaigns')
      .insert(campaignData)
      .select()
      .single();
    if (err) throw err;
    return data;
  };

  const updateCampaign = async (id, updates) => {
    const { data, error: err } = await supabase
      .from('research_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    setCampaigns(prev => prev.map(c => c.id === id ? data : c));
    return data;
  };

  const deleteCampaign = async (id) => {
    const { error: err } = await supabase
      .from('research_campaigns')
      .delete()
      .eq('id', id);
    if (err) throw err;
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
}
