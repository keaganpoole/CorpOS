import React, { useEffect, useState, useCallback } from 'react';
import { useLeads } from '../hooks/useLeads';
import LeadsTable from './LeadsTable';

const PeoplePage = ({ hideTitle = false, onToolbarMetaChange = null }) => {
  const {
    leads, allLeads, loading, error,
    justAddedLeadIds,
    selectedId, setSelectedId,
    searchQuery, setSearchQuery,
    sourceFilter, setSourceFilter,
    sortBy, sortDir, handleSort,
    createLead, updateLead, deleteLead, refresh,
  } = useLeads();

  const [creating, setCreating] = useState(false);
  const [tableSchema, setTableSchema] = useState(null);

  useEffect(() => {
    onToolbarMetaChange?.({ count: allLeads.length, loading });
  }, [allLeads.length, loading, onToolbarMetaChange]);

  const handleInlineCreate = async () => {
    try {
      await createLead({}, { placement: 'end' });
      setCreating(false);
    } catch (err) {
      console.error("LeadsPage.jsx:event_28");
    }
  };

  const handleSaveNew = async (data) => {
    const result = await createLead(data);
    setCreating(false);
    return result;
  };

  // Inline edit autosave — no debounce, instant save
  const handleInlineUpdate = useCallback(async (leadId, updates) => {
    try {
      await updateLead(leadId, updates);
    } catch (err) {
      console.error("LeadsPage.jsx:event_43");
    }
  }, [updateLead]);

  const handleDeleteMany = async (ids) => {
    for (const id of ids) {
      await deleteLead(id);
    }
  };

  return (
    <div className="flex h-full bg-[#020202] relative overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-rose-500/10 border-b border-rose-500/20 px-8 py-2 flex items-center gap-3">
          <span className="text-[11px] text-rose-400 font-medium">{error}</span>
          <button onClick={refresh} className="text-[10px] text-rose-400 underline hover:text-rose-300 ml-auto">Retry</button>
        </div>
      )}

      {/* Table */}
      <LeadsTable
        leads={leads} loading={loading} selectedId={selectedId}
        justAddedLeadIds={justAddedLeadIds}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter}
        sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
        totalCount={allLeads.length}
        onCreateInline={handleInlineCreate}
        onDeleteMany={handleDeleteMany}
        onUpdateLead={handleInlineUpdate}
        onSchemaChange={setTableSchema}
        hideTitle={hideTitle}
      />
    </div>
  );
};

export default PeoplePage;
