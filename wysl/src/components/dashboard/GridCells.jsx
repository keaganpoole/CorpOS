// src/components/dashboard/GridCells.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useLeadsStore from '../../stores/leadsStore';
import useActionBarStore from '../../stores/actionBarStore';
import { Check, Minus } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { motion, AnimatePresence } from 'framer-motion';

const CellContentWrapper = ({ children, className }) => (
  <div className={`cell-content-wrapper ${className || ''}`}>{children}</div>
);

export const EditableCell = ({ getValue, row, column }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const { updateLead } = useLeadsStore();

  const onBlur = () => {
    if (value !== initialValue) {
      updateLead(row.original.id, { [column.id]: value });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <CellContentWrapper>
      <input
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full bg-transparent outline-none"
      />
    </CellContentWrapper>
  );
};

export const StatusSelectCell = ({ getValue, row, column, options }) => {
  const status = getValue();
  const { updateLead } = useLeadsStore();
  const triggerStatusMode = useActionBarStore((state) => state.triggerStatusMode);
  const statusClasses = {
    Won: 'won',
    Interest: 'interest',
    Aware: 'aware',
    DNC: 'dnc',
  };

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (newStatus) => {
    updateLead(row.original.id, { [column.id]: newStatus });
    triggerStatusMode(newStatus);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="cell-content-wrapper w-full text-left relative"
      >
        <div className="flex items-center gap-2">
          <span className={`status-gradient-dot ${statusClasses[status] || ''}`}></span>
          <span>{status}</span>
        </div>
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="status-select-popover"
              style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                zIndex: 100,
              }}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {options.map((option) => (
                <div
                  key={option}
                  onClick={() => handleSelect(option)}
                  className="status-option cursor-pointer px-2 py-1 hover:bg-gray-900 rounded"
                >
                  <span className={`status-gradient-dot ${statusClasses[option] || ''} mr-2`}></span>
                  <span>{option}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export const DateCell = ({ getValue, row, column }) => {
  const { updateLead } = useLeadsStore();
  const [date, setDate] = useState(new Date(getValue()));
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (selectedDate) => {
    if (selectedDate) {
      setDate(selectedDate);
      updateLead(row.original.id, { [column.id]: selectedDate.toISOString() });
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="cell-content-wrapper text-left w-full h-full relative"
      >
        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="date-picker-popover"
              style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                zIndex: 100,
              }}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <DayPicker mode="single" selected={date} onSelect={handleSelect} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export const StatusCell = ({ getValue }) => {
  const status = getValue();
  const statusClasses = {
    Won: 'won',
    Interest: 'interest',
    Aware: 'aware',
    DNC: 'dnc',
  };
  return (
    <CellContentWrapper className="status-cell">
      <span className={`status-gradient-dot ${statusClasses[status] || ''}`}></span>
      <span>{status}</span>
    </CellContentWrapper>
  );
};

const CustomCheckbox = ({ checked, indeterminate }) => (
  <span className="custom-checkbox">
    <AnimatePresence>
      {(checked || indeterminate) && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {checked && <Check size={16} strokeWidth={3} className="check-icon" />}
          {indeterminate && <Minus size={16} strokeWidth={3} className="check-icon" />}
        </motion.div>
      )}
    </AnimatePresence>
  </span>
);

export const CheckboxCell = ({ row }) => (
  <CellContentWrapper className="justify-center">
    <label>
      <input
        type="checkbox"
        className="sr-only"
        {...{
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
          onChange: row.getToggleSelectedHandler(),
        }}
      />
      <CustomCheckbox checked={row.getIsSelected()} />
    </label>
  </CellContentWrapper>
);

export const CheckboxHeader = ({ table }) => (
  <CellContentWrapper className="justify-center">
    <label>
      <input
        type="checkbox"
        className="sr-only"
        {...{
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
          onChange: table.getToggleAllRowsSelectedHandler(),
        }}
      />
      <CustomCheckbox checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} />
    </label>
  </CellContentWrapper>
);
