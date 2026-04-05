import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLeads } from '../hooks/useLeads';
import LeadsTable from './LeadsTable';
import LeadDetailPanel from './LeadDetailPanel';

const LeadsPage = () => {
  const {
    leads, allLeads, loading, error,
    selectedId, setSelectedId, selectedLead,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter,
    sortBy, sortDir, handleSort,
    createLead, updateLead, deleteLead, refresh,
  } = useLeads();

  const [creating, setCreating] = useState(false);

  const handleCreateNew = () => { setCreating(true); setSelectedId(null); };

  const handleSaveNew = async (data) => {
    const result = await createLead(data);
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
    return await updateLead(selectedId, updates);
  };

  // Inline edit autosave — no debounce, instant save
  const handleInlineUpdate = useCallback(async (leadId, updates) => {
    try {
      await updateLead(leadId, updates);
    } catch (err) {
      console.error('[LeadsPage] Autosave failed:', err.message);
    }
  }, [updateLead]);

  const handleDelete = async () => { if (!selectedId) return; await deleteLead(selectedId); setSelectedId(null); };
  const handleClosePanel = () => { setSelectedId(null); setCreating(false); };

  return (
    <div className="flex h-full bg-[#020202] relative overflow-hidden">
      {/* Background atmospheric effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/[0.03] blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.015]"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

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
        onSelect={(id) => { setSelectedId(id); setCreating(false); }}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter}
        sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
        onCreateNew={handleCreateNew} totalCount={allLeads.length}
        onUpdateLead={handleInlineUpdate}
      />

      {/* Detail Panel (no backdrop blur) */}
      <AnimatePresence>
        {(selectedLead || creating) && (
          <LeadDetailPanel
            key={creating ? 'new' : selectedId}
            lead={creating ? null : selectedLead}
            isNew={creating}
            onSave={creating ? handleSaveNew : handleSaveExisting}
            onDelete={creating ? handleClosePanel : handleDelete}
            onClose={handleClosePanel}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsPage;
