import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppointments } from '../hooks/useAppointments';
import AppointmentsTable from './AppointmentsTable';
import AppointmentDetailPanel from './AppointmentDetailPanel';

const AppointmentsPage = () => {
  const {
    appointments, allAppointments, people, services, receptionists, lookups, loading, error,
    justAddedAppointmentIds,
    selectedId, setSelectedId, selectedAppointment,
    searchQuery, setSearchQuery,
    sourceFilter, setSourceFilter,
    sortBy, sortDir, handleSort,
    createAppointment, updateAppointment, deleteAppointment, refresh,
  } = useAppointments();

  const [creating, setCreating] = useState(false);
  const [tableSchema, setTableSchema] = useState(null);

  const handleInlineCreate = async () => {
    setCreating(true);
    setSelectedId(null);
  };

  const handleSaveNew = async (data) => {
    const result = await createAppointment(data);
    setCreating(false);
    setSelectedId(result.id);
    return result;
  };

  const handleSaveExisting = async (data) => {
    if (!selectedId) return;
    const updates = {};
    for (const key of Object.keys(data)) {
      if (key === 'id' || key === 'created_at') continue;
      updates[key] = data[key];
    }
    return await updateAppointment(selectedId, updates);
  };

  const handleInlineUpdate = useCallback(async (appointmentId, updates) => {
    try {
      await updateAppointment(appointmentId, updates);
    } catch (err) {
      console.error('[AppointmentsPage] Autosave failed:', err.message);
    }
  }, [updateAppointment]);

  const handleDelete = async () => {
    if (!selectedId) return;
    await deleteAppointment(selectedId);
    setSelectedId(null);
  };

  const handleDeleteMany = async (ids) => {
    for (const id of ids) {
      await deleteAppointment(id);
    }
  };

  const handleClosePanel = () => {
    setSelectedId(null);
    setCreating(false);
  };

  return (
    <div className="flex h-full bg-[#020202] relative overflow-hidden">
      {error && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-rose-500/10 border-b border-rose-500/20 px-8 py-2 flex items-center gap-3">
          <span className="text-[11px] text-rose-400 font-medium">{error}</span>
          <button onClick={refresh} className="text-[10px] text-rose-400 underline hover:text-rose-300 ml-auto">Retry</button>
        </div>
      )}

      <AppointmentsTable
        appointments={appointments}
        loading={loading}
        selectedId={selectedId}
        justAddedAppointmentIds={justAddedAppointmentIds}
        onSelect={(id) => { setSelectedId(id); setCreating(false); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        totalCount={allAppointments.length}
        onCreateInline={handleInlineCreate}
        onDeleteMany={handleDeleteMany}
        onUpdateAppointment={handleInlineUpdate}
        onSchemaChange={setTableSchema}
        people={people}
        services={services}
        receptionists={receptionists}
        lookups={lookups}
      />

      <AnimatePresence>
        {(selectedAppointment || creating) && (
          <AppointmentDetailPanel
            key={creating ? 'new' : selectedId}
            appointment={creating ? null : selectedAppointment}
            isNew={creating}
            onSave={creating ? handleSaveNew : handleSaveExisting}
            onDelete={creating ? handleClosePanel : handleDelete}
            onClose={handleClosePanel}
            tableSchema={tableSchema}
            people={people}
            services={services}
            receptionists={receptionists}
            lookups={lookups}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppointmentsPage;
