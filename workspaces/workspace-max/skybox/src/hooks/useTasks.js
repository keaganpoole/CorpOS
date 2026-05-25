/**
 * useTasks — Supabase-backed task + column state
 * Real-time subscriptions for live board updates
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Initial Fetch ─────────────────────────────────────
  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTasks(data);
  }, []);

  const loadColumns = useCallback(async () => {
    const { data, error } = await supabase
      .from('task_columns')
      .select('*')
      .order('position', { ascending: true });
    if (!error && data) setColumns(data);
    // If no columns exist, create default columns
    if (!error && data && data.length === 0) {
      const defaultColumns = [
        { id: 'col-queued', display_name: 'Queued', status_value: 'queued', color: '#71717A', position: 0 },
        { id: 'col-inprogress', display_name: 'In Progress', status_value: 'in_progress', color: '#3b82f6', position: 1 },
        { id: 'col-completed', display_name: 'Completed', status_value: 'completed', color: '#10b981', position: 2 },
      ];
      const { error: insertError } = await supabase.from('task_columns').insert(defaultColumns);
      if (!insertError) {
        setColumns(defaultColumns);
      }
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadTasks(), loadColumns()]);
    setLoading(false);
  }, [loadTasks, loadColumns]);

  // ─── Real-time Subscriptions + Polling Fallback ─────────
  useEffect(() => {
    loadAll();

    // Real-time subscriptions (work if Supabase Realtime is enabled for these tables)
    const taskSub = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    const colSub = supabase
      .channel('task-columns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_columns' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setColumns(prev => [...prev, payload.new].sort((a, b) => a.position - b.position));
        } else if (payload.eventType === 'UPDATE') {
          setColumns(prev => prev.map(c => c.id === payload.new.id ? payload.new : c).sort((a, b) => a.position - b.position));
        } else if (payload.eventType === 'DELETE') {
          setColumns(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    // Polling fallback — refreshes every 4s in case Realtime isn't enabled
    const pollTimer = setInterval(() => {
      loadTasks();
      loadColumns();
    }, 4000);

    return () => {
      supabase.removeChannel(taskSub);
      supabase.removeChannel(colSub);
      clearInterval(pollTimer);
    };
  }, [loadAll, loadTasks, loadColumns]);

  // ─── Task CRUD ─────────────────────────────────────────
  const createTask = useCallback(async (taskData) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_by: updates.updated_by || 'Max' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  // ─── Column Operations ─────────────────────────────────
  const updateColumn = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('task_columns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const reorderColumns = useCallback(async (reorderedCols) => {
    // Update positions in batch
    const updates = reorderedCols.map((col, idx) =>
      supabase.from('task_columns').update({ position: idx }).eq('id', col.id)
    );
    await Promise.all(updates);
    // Optimistic local update
    setColumns(reorderedCols.map((c, i) => ({ ...c, position: i })));
  }, []);

  const createColumn = useCallback(async (colData) => {
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1);
    const { data, error } = await supabase
      .from('task_columns')
      .insert([{ ...colData, position: maxPos + 1 }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }, [columns]);

  const deleteColumn = useCallback(async (id) => {
    const { error } = await supabase
      .from('task_columns')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    tasks,
    columns,
    loading,
    createTask,
    updateTask,
    deleteTask,
    updateColumn,
    reorderColumns,
    createColumn,
    deleteColumn,
    refresh: loadAll,
  };
}
