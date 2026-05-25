// src/components/dashboard/FilterPanel.jsx
import React from 'react';
import { Plus, X } from 'lucide-react';

const FilterOperatorOptions = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
];

const FilterPanel = ({ table, columnFilters, setColumnFilters }) => {
  const addFilter = () => {
    const firstColumn = table.getAllLeafColumns().find(c => c.getCanFilter() && c.id !== 'select');
    if (firstColumn) {
      setColumnFilters([...columnFilters, { id: firstColumn.id, value: '' }]);
    }
  };

  const setFilterValue = (index, value) => {
    const newFilters = [...columnFilters];
    newFilters[index].value = value;
    setColumnFilters(newFilters);
  };
  
  const setFilterColumn = (index, columnId) => {
    const newFilters = [...columnFilters];
    newFilters[index].id = columnId;
    setColumnFilters(newFilters);
  };

  const removeFilter = (index) => {
    setColumnFilters(columnFilters.filter((_, i) => i !== index));
  };
  
  return (
    <div>
      {columnFilters.map((filter, index) => (
        <div key={index} className="filter-row">
          <span>Where</span>
          <select
            value={filter.id}
            onChange={(e) => setFilterColumn(index, e.target.value)}
          >
            {table.getAllLeafColumns().map(column => (
              (column.getCanFilter() && column.id !== 'select') && 
              <option key={column.id} value={column.id}>
                {column.id.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Note: This is a basic text filter. In the future, we can add more complex operators. */}
          <select>
             <option value="contains">contains</option>
          </select>
          
          <input
            type="text"
            value={filter.value}
            onChange={(e) => setFilterValue(index, e.target.value)}
            placeholder={`value...`}
            className="flex-grow"
          />
          <button onClick={() => removeFilter(index)} className="remove-filter-button">
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="filter-controls">
        <button onClick={addFilter} className="add-filter-button">
          <Plus size={16} /> Add filter
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;