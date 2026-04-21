import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Users, Plus, X, Calendar, SlidersHorizontal, Download } from 'lucide-react'; // Added SlidersHorizontal, Download
import Select from 'react-select';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';

// --- Custom Hook for Click Outside ---
const useClickOutside = (ref, handler) => {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
};


// --- Reusable Child Components ---

const ToggleSwitch = ({ isEnabled, onToggle, leftLabel, rightLabel }) => (
    <div className="flex items-center space-x-2 cursor-pointer" onClick={onToggle} title={`Switch to '${isEnabled ? leftLabel : rightLabel}'`}>
        <span className={`text-sm font-medium transition-colors ${!isEnabled ? 'text-white' : 'text-gray-400'}`}>{leftLabel}</span>
        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`}></div>
        </div>
        <span className={`text-sm font-medium transition-colors ${isEnabled ? 'text-white' : 'text-gray-400'}`}>{rightLabel}</span>
    </div>
);

const FILTER_OPTIONS = {
    LEADS: [
        { value: 'add_a_lines', label: 'Add A Lines', type: 'numeric' },
        { value: 'company', label: 'Company', type: 'text' },
        { value: 'created_at', label: 'Created At', type: 'timestamp' },
        { value: 'devices', label: 'Devices', type: 'text_array' },
        { value: 'email', label: 'Email', type: 'text' },
        { value: 'first_name', label: 'First Name', type: 'text' },
        { value: 'last_checked', label: 'Last Checked', type: 'timestamp' },
        { value: 'last_follow_up', label: 'Last Follow Up', type: 'timestamp' },
        { value: 'last_name', label: 'Last Name', type: 'text' },
        { value: 'notes', label: 'Notes', type: 'text' },
        { value: 'phone', label: 'Phone', type: 'text' },
        { value: 'potential_lines', label: 'Potential Lines', type: 'numeric' },
        { value: 'profile', label: 'Profile', type: 'text' },
        { value: 'referrals', label: 'Referrals', type: 'numeric' },
        { value: 'status', label: 'Status', type: 'text' },
        { value: 'upgrades', label: 'Upgrades', type: 'numeric' },
    ],
    PURCHASES: [
        { value: 'created_at', label: 'Created At', type: 'timestamp' },
        { value: 'early_upgrade', label: 'Early Upgrade', type: 'boolean' },
        { value: 'insured', label: 'Insured', type: 'boolean' },
        { value: 'postpaid', label: 'Postpaid', type: 'boolean' },
        { value: 'purchase', label: 'Purchase', type: 'text' },
        { value: 'upgrade_eligible_date', label: 'Upgrade Eligible Date', type: 'date' },
    ],
    MESSAGES: [
        { value: 'created_at', label: 'Created At', type: 'timestamp' },
        { value: 'lead', label: 'Lead', type: 'uuid' },
        { value: 'message', label: 'Message', type: 'text' },
        { value: 'status', label: 'Status', type: 'text' },
    ],
    LEADCAMPAIGNS: [
        { value: 'created_at', label: 'Created At', type: 'timestamp' },
        { value: 'inbound_messages_count', label: 'Inbound Messages Count', type: 'numeric' },
        { value: 'last_response', label: 'Last Response', type: 'timestamp' },
        { value: 'last_sent', label: 'Last Sent', type: 'timestamp' },
        { value: 'outbound_messages_count', label: 'Outbound Messages Count', type: 'numeric' },
        { value: 'response_rate', label: 'Response Rate', type: 'text' },
        { value: 'status', label: 'Status', type: 'text' },
    ],
};

const getOperatorsForType = (type) => {
    switch (type) {
        case 'text':
        case 'text_array':
        case 'uuid':
            return ['is', 'is not', 'contains', 'does not contain', 'starts with', 'ends with'];
        case 'numeric':
            return ['equals', 'not equals', 'greater than', 'less than', 'greater than or equals', 'less than or equals'];
        case 'boolean':
            return ['is true', 'is false'];
        case 'timestamp':
        case 'date':
            return ['is on or after', 'is on or before'];
        default:
            return ['is'];
    }
};

const customSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: '#374151',
        borderColor: state.isFocused ? '#A855F7' : '#4B5563',
        color: '#FFFFFF',
        minHeight: '38px',
        height: '38px',
        borderRadius: '0.375rem',
        boxShadow: state.isFocused ? '0 0 0 1px #A855F7' : 'none',
        transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
            borderColor: '#6D28D9',
        },
        fontSize: '0.875rem',
    }),
    singleValue: (provided) => ({ ...provided, color: '#FFFFFF', fontSize: '0.875rem' }),
    input: (provided) => ({ ...provided, color: '#FFFFFF', margin: '0', padding: '0', fontSize: '0.875rem' }),
    placeholder: (provided) => ({ ...provided, color: '#9CA3AF', fontSize: '0.875rem' }),
    menu: (provided) => ({
        ...provided,
        backgroundColor: '#1F2937',
        borderRadius: '0.5rem',
        border: '1px solid #4B5563',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        marginTop: '8px',
        animation: 'fadeIn 0.1s ease-out',
    }),
    menuPortal: base => ({ ...base, zIndex: 9999 }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#A855F7' : state.isFocused ? '#374151' : 'transparent',
        color: state.isSelected ? '#FFFFFF' : state.isFocused ? '#FFFFFF' : '#E5E7EB',
        padding: '10px 16px',
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out',
        '&:active': { backgroundColor: '#8B5CF6' },
    }),
    groupHeading: (provided) => ({
        ...provided,
        color: '#9CA3AF',
        fontSize: '0.65rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '8px 16px 4px',
    }),
};

const FilterValueInput = ({ type, value, onChange }) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const datePickerRef = useRef(null);
    useClickOutside(datePickerRef, () => setIsCalendarOpen(false));

    const handleDateChange = (date) => {
        onChange(date ? format(date, 'yyyy-MM-dd') : '');
        setIsCalendarOpen(false);
    };

    const inputClasses = "bg-gray-700 border border-gray-600 text-white text-sm rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 block w-full p-2 transition-colors";

    switch (type) {
        case 'boolean':
            return (
                <Select
                    options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]}
                    value={value ? { value, label: value === 'true' ? 'True' : 'False' } : null}
                    onChange={(selectedOption) => onChange(selectedOption ? selectedOption.value : '')}
                    styles={customSelectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select Boolean"
                    className="w-full"
                    classNamePrefix="react-select"
                />
            );
        case 'timestamp':
        case 'date':
            return (
                <div className="relative w-full" ref={datePickerRef}>
                    <div className="relative">
                        <input
                            type="text"
                            value={value ? format(new Date(value), 'MMMM d, yyyy') : ''}
                            readOnly
                            onClick={() => setIsCalendarOpen(o => !o)}
                            className={`${inputClasses} cursor-pointer pr-10`}
                            placeholder="Select Date"
                        />
                        <button
                            type="button"
                            onClick={() => setIsCalendarOpen(o => !o)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                            aria-label="Open calendar"
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                    </div>
                    {isCalendarOpen && (
                        <div
                            className="absolute z-20 mt-2 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-fadeIn"
                            style={{ top: '100%', left: 0 }}
                        >
                            <DayPicker
                                mode="single"
                                selected={value ? new Date(value) : undefined}
                                onSelect={handleDateChange}
                                initialFocus
                                classNames={{
                                    caption: "flex justify-center items-center h-10 relative",
                                    caption_label: "text-sm font-medium text-white",
                                    nav_button: "h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors",
                                    nav_button_previous: "absolute left-2",
                                    nav_button_next: "absolute right-2",
                                    table: "w-full border-collapse mt-1 p-1",
                                    head_row: "flex justify-around text-gray-400 text-xs",
                                    head_cell: "w-8 h-8 font-normal flex items-center justify-center",
                                    row: "flex w-full mt-1 justify-around",
                                    cell: "w-8 h-8",
                                    day: "w-full h-full text-xs flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors cursor-pointer text-gray-200",
                                    day_today: "font-bold text-pink-400 border border-pink-400/50",
                                    day_selected: "bg-purple-500 text-white hover:bg-purple-600 font-bold",
                                    day_outside: "text-gray-500 opacity-50",
                                    day_disabled: "text-gray-600 opacity-50 cursor-not-allowed",
                                }}
                            />
                        </div>
                    )}
                </div>
            );
        case 'numeric':
            return (
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Number"
                />
            );
        default:
            return (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClasses}
                    placeholder="Enter Value"
                />
            );
    }
};

const FilterBuilder = ({ condition, onConditionChange, onRemove }) => {
    const allFields = Object.entries(FILTER_OPTIONS).flatMap(([category, fields]) =>
        fields.map(field => ({ ...field, category }))
    );

    const selectedFieldMeta = allFields.find(f => f.value === condition.field);
    const currentOperators = selectedFieldMeta ? getOperatorsForType(selectedFieldMeta.type) : [];
    const showValueInput = selectedFieldMeta?.type !== 'boolean';

    const groupedOptions = Object.entries(FILTER_OPTIONS).map(([label, options]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
        options: options.map(opt => ({ value: opt.value, label: opt.label, type: opt.type }))
    }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)_minmax(0,_4fr)_auto] gap-3 items-center group">
            <Select
                options={groupedOptions}
                value={selectedFieldMeta ? { value: selectedFieldMeta.value, label: selectedFieldMeta.label } : null}
                onChange={(selectedOption) => onConditionChange({ ...condition, field: selectedOption ? selectedOption.value : '', operator: '', value: '' })}
                styles={customSelectStyles}
                menuPortalTarget={document.body}
                placeholder="Select Field"
                classNamePrefix="react-select"
            />
            <Select
                options={currentOperators.map(op => ({ value: op, label: op }))}
                value={condition.operator ? { value: condition.operator, label: condition.operator } : null}
                onChange={(selectedOption) => onConditionChange({ ...condition, operator: selectedOption ? selectedOption.value : '' })}
                styles={customSelectStyles}
                menuPortalTarget={document.body}
                placeholder="Operator"
                isDisabled={!condition.field}
                classNamePrefix="react-select"
            />
            {showValueInput && (
                <FilterValueInput
                    type={selectedFieldMeta?.type}
                    value={condition.value}
                    onChange={(newValue) => onConditionChange({ ...condition, value: newValue })}
                />
            )}
            <button onClick={onRemove} className="text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 -mr-2">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default FilterBuilder;
