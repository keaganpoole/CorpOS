// src/components/dashboard/DraggableHeader.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender } from '@tanstack/react-table';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'; // Removed GripVertical

const SortIcon = ({ isSorted }) => {
  const commonProps = { size: 16, className: `sort-icon ${isSorted ? 'active' : ''}` };
  if (isSorted === 'asc') return <ChevronUp {...commonProps} />;
  if (isSorted === 'desc') return <ChevronDown {...commonProps} />;
  return <ChevronsUpDown {...commonProps} style={{ opacity: 0.4 }}/>;
};

export const DraggableHeader = ({ header }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  });

  const style = {
    width: header.getSize(),
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const isSortable = header.column.getCanSort();

  return (
    <th ref={setNodeRef} style={style} className={isDragging ? 'dragging-header' : ''}>
      <div className="header-content-wrapper">
        <div
          className="header-content"
          onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
          style={{ cursor: isSortable ? 'pointer' : 'default' }}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {isSortable && <SortIcon isSorted={header.column.getIsSorted()} />}
        </div>
        {/* The drag handle is now an invisible element that still captures drag events */}
        <div className="header-drag-handle" {...attributes} {...listeners}>
            {/* Icon removed */}
        </div>
      </div>
    </th>
  );
};