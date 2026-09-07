import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useDropIns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getDropIns();
      setItems(result.items);
      setCanManage(result.can_manage);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const focus = () => { refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  const save = async (draft) => {
    const payload = { name: draft.name, purpose: draft.purpose, prompt: draft.prompt, is_active: draft.is_active, available_on_status: draft.available_on_status };
    const result = draft.id ? await api.updateDropIn(draft.id, payload) : await api.createDropIn(payload);
    setItems(current => [...current.filter(x => x.id !== result.id), { ...current.find(x => x.id === result.id), ...result }]);
    return result;
  };
  const remove = async (id) => {
    await api.deleteDropIn(id);
    setItems(current => current.filter(x => x.id !== id));
  };
  const reorder = async (status, ids) => {
    await api.reorderDropIns({ available_on_status: status, ids });
    setItems(current => current.map(x => ids.includes(x.id) ? { ...x, sort_order: ids.indexOf(x.id) } : x));
  };
  return { items, loading, error, canManage, refresh, save, remove, reorder };
}
