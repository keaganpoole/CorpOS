// src/components/dashboard/AirtableGrid.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, FileDown, Rows, SlidersHorizontal, Grid3x3 } from 'lucide-react';
import { DraggableHeader } from './DraggableHeader';
import FilterPanel from './FilterPanel';
import '../../styles/AirtableGrid.css';

const SkeletonRow = ({ columns }) => (
    <tr className="skeleton-row">
      {columns.map(col => (
        <td key={col.id || col.accessorKey}>
          <div className="skeleton-loader" style={{ width: `${Math.random() * 40 + 50}%` }}></div>
        </td>
      ))}
    </tr>
  );

export const AirtableGrid = ({ data, columns, isLoading, title, newButtonLink }) => {
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState([]);
  const [activePanel, setActivePanel] = React.useState(null);
  const [columnOrder, setColumnOrder] = React.useState(() => columns.map(c => c.id));
  const [columnFilters, setColumnFilters] = React.useState([]);

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { globalFilter, rowSelection, sorting, columnOrder, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });
  
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder(order => {
        const oldIndex = order.indexOf(active.id);
        const newIndex = order.indexOf(over.id);
        const newOrder = [...order];
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, active.id);
        return newOrder;
      });
    }
  }

  const selectedRowCount = Object.keys(rowSelection).length;
  const handleDeleteSelected = () => {
    alert(`Delete ${selectedRowCount} items functionality to be implemented.`);
    setRowSelection({});
  };
  const handleCreateNew = () => {
    if (newButtonLink) {
      navigate(newButtonLink);
    }
  };
  const togglePanel = (panel) => setActivePanel(activePanel === panel ? null : panel);

  return (
    <div className="grid-container">
      {/* --- Toolbar --- */}
      <div className="grid-toolbar">
        <h1 className="grid-title">{title}</h1>
        <button className="toolbar-button"><Grid3x3 size={16}/>All {title}</button>
        <button className={`toolbar-button ${activePanel === 'filter' ? 'active' : ''}`} onClick={() => togglePanel('filter')}>
          <SlidersHorizontal size={16}/>Filter {columnFilters.length > 0 ? `(${columnFilters.length})` : ''}
        </button>
        <button className={`toolbar-button ${activePanel === 'group' ? 'active' : ''}`} onClick={() => togglePanel('group')}>
          <Rows size={16}/>Group
        </button>
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(String(e.target.value))}
            className="search-input"
            placeholder={`Search ${title.toLowerCase()}...`}
          />
        </div>
      </div>
      
      {/* --- Sub-Panels --- */}
      <AnimatePresence>
        {activePanel && (
          <motion.div
            key={activePanel}
            className="grid-sub-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {activePanel === 'filter' && <FilterPanel table={table} filters={columnFilters} setFilters={setColumnFilters} />}
            {activePanel === 'group' && <div>Grouping functionality coming soon...</div>}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* --- Contextual Action Bar --- */}
      <AnimatePresence>
        {selectedRowCount > 0 && (
          <motion.div
            className="contextual-action-bar"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <span>{selectedRowCount} selected</span>
            <div className="h-6 w-px bg-white/20"></div>
            <button className="toolbar-button" onClick={handleDeleteSelected}><Trash2 size={16} /> Delete</button>
            <button className="toolbar-button"><FileDown size={16} /> Export</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Table --- */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="grid-table-wrapper">
          <table className="grid-table" style={{ width: table.getTotalSize() }}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map(header => (
                      <DraggableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} columns={columns} />)
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="empty-grid-state">
                      <Grid3x3 size={48} className="empty-grid-state-icon" />
                      <h3>No {title} Yet</h3>
                      <p>Click the "+ New" button below to add your first one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={row.getIsSelected() ? 'selected-row' : ''}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      
      {/* --- Footer --- */}
      <div className="new-row-button-container">
          <button onClick={handleCreateNew} className="new-row-button">
              <Plus size={16}/> New {title.slice(0,-1)}
          </button>
      </div>
    </div>
  );
};