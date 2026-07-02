import React, { useCallback, useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import AppointmentsTable from './AppointmentsTable';

const AppointmentsPage = ({ data = null, className = '' }) => {
  const appointmentsData = useAppointments();
  const {
    appointments, allAppointments, people, services, receptionists, lookups, loading, error,
    justAddedAppointmentIds,
    selectedId, setSelectedId,
    searchQuery, setSearchQuery,
    sourceFilter, setSourceFilter,
    sortBy, sortDir, handleSort,
    createAppointment, updateAppointment, deleteAppointment, refresh,
  } = data || appointmentsData;

  const [tableSchema, setTableSchema] = useState(null);
  const [creating, setCreating] = useState(false);

  const handleInlineCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      await createAppointment({
        date: new Date().toISOString().slice(0, 10),
        time: '09:00',
        duration: 30,
        status: 'pending',
        source: 'manual',
        notes: '',
      }, { placement: 'end' });
    } catch (err) {
      console.error('[AppointmentsPage] Inline create failed:', err.message);
    } finally {
      setCreating(false);
    }
  }, [createAppointment, creating]);

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
    <div className={`relative flex h-full overflow-hidden bg-[#020202] ${className}`.trim()}>
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
        creating={creating}
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
