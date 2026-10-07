import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useDropIns(enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const mutationVersion = useRef(0);
  const pendingMutations = useRef(0);
  const hasLoaded = useRef(false);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const version = mutationVersion.current;
    if (!hasLoaded.current) setLoading(true);
    try {
      const result = await api.getDropIns();
      if (version === mutationVersion.current && pendingMutations.current === 0) setItems(result.items);
      setCanManage(result.can_manage);
      setError('');
    } catch (e) { setError(e.message); }
    finally { hasLoaded.current = true; setLoading(false); }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh();
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    const focus = () => { refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [enabled, refresh]);
  const save = async (draft, { optimistic = true } = {}) => {
    const payload = { name: draft.name, purpose: draft.purpose, prompt: draft.prompt, is_active: draft.is_active, available_on_status: draft.available_on_status };
    const tempId = optimistic && !draft.id ? `pending-${crypto.randomUUID()}` : null;
    const previous = optimistic && draft.id ? items.find(item => item.id === draft.id) : null;
    if (optimistic) {
      mutationVersion.current += 1;
      pendingMutations.current += 1;
      setItems(current => draft.id
        ? current.map(item => item.id === draft.id ? { ...item, ...payload } : item)
        : [...current, { ...payload, id: tempId, sort_order: Math.max(-1, ...current.filter(item => item.available_on_status === payload.available_on_status).map(item => item.sort_order ?? 0)) + 1, usage_count: 0, created_at: new Date().toISOString() }]);
    }
    try {
      const result = draft.id ? await api.updateDropIn(draft.id, payload) : await api.createDropIn(payload);
      setItems(current => [...current.filter(item => item.id !== result.id && item.id !== tempId), { ...current.find(item => item.id === result.id), ...result }]);
      return result;
    } catch (error) {
      if (optimistic) setItems(current => draft.id
        ? current.map(item => item.id === draft.id ? previous || item : item)
        : current.filter(item => item.id !== tempId));
      throw error;
    } finally {
      if (optimistic) { pendingMutations.current -= 1; mutationVersion.current += 1; }
    }
  };
  const remove = async (id, { optimistic = true } = {}) => {
    const previous = optimistic ? items.find(item => item.id === id) : null;
    if (optimistic) {
      mutationVersion.current += 1;
      pendingMutations.current += 1;
      setItems(current => current.filter(item => item.id !== id));
    }
    try {
      await api.deleteDropIn(id);
      if (!optimistic) setItems(current => current.filter(item => item.id !== id));
    } catch (error) {
      if (optimistic && previous) setItems(current => current.some(item => item.id === id) ? current : [...current, previous]);
      throw error;
    } finally {
      if (optimistic) { pendingMutations.current -= 1; mutationVersion.current += 1; }
    }
  };
  const reorder = async (status, ids) => {
    const previous = items.filter(item => ids.includes(item.id)).map(item => ({ id: item.id, sort_order: item.sort_order }));
    mutationVersion.current += 1;
    pendingMutations.current += 1;
    setItems(current => current.map(item => ids.includes(item.id) ? { ...item, sort_order: ids.indexOf(item.id) } : item));
    try { await api.reorderDropIns({ available_on_status: status, ids }); }
    catch (error) {
      setItems(current => current.map(item => {
        const original = previous.find(row => row.id === item.id);
        return original ? { ...item, sort_order: original.sort_order } : item;
      }));
      throw error;
    } finally {
      pendingMutations.current -= 1;
      mutationVersion.current += 1;
    }
  };
  return { items, loading, error, canManage, refresh, save, remove, reorder };
}
