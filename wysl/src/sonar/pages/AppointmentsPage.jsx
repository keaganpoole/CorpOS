import React, { useState, useCallback } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import AppointmentsTable from './AppointmentsTable';

const AppointmentsPage = () => {
  const {
    appointments, allAppointments, people, services, receptionists, lookups, loading, error,
    justAddedAppointmentIds,
    selectedId, setSelectedId,
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
    return result;
  };

  const handleInlineUpdate = useCallback(async (appointmentId, updates) => {
    try {
      await updateAppointment(appointmentId, updates);
    } catch (err) {
      console.error('[AppointmentsPage] Autosave failed:', err.message);
    }
  }, [updateAppointment]);

  const handleDeleteMany = async (ids) => {
    for (const id of ids) {
      await deleteAppointment(id);
    }
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
    </div>
  );
};

export default AppointmentsPage;
