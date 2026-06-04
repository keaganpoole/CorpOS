import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Zap, Hourglass, Plus, ArrowRight, GitBranch, Repeat } from 'lucide-react';
import FilterBuilder from './FilterBuilder'; // Use the global FilterBuilder

// --- Time Formatting Helpers ---
const formatTimeLabel = (hours) => {
    if (hours === 0) return { value: '0', unit: 'Instantly' };
    const days = hours / 24;
    if (days < 1) {
        const hourValue = Math.floor(hours);
        return { value: hourValue, unit: `Hour${hourValue === 1 ? '' : 's'}` };
    }
    if (days < 30) {
        const dayValue = Math.round(days);
        return { value: dayValue, unit: `Day${dayValue === 1 ? '' : 's'}` };
    }
    const months = Math.round(days / 30.417);
    if (months < 12) {
        return { value: months, unit: `Month${months === 1 ? '' : 's'}` };
    }
    const years = Math.round(months / 12);
    return { value: years, unit: `Year${years === 1 ? '' : 's'}` };
};

const formatIntervalLabel = (hours) => {
    if (hours === 0) return { value: 'Run', unit: 'Once' };
    const days = hours / 24;
    if (days <= 31) {
        const dayValue = Math.max(1, Math.round(days));
        return { value: dayValue, unit: `Day${dayValue === 1 ? '' : 's'}` };
    }
    const monthValue = Math.round(days / 30.417);
    return { value: monthValue, unit: `Month${monthValue === 1 ? '' : 's'}` };
};

// --- UI Sub-components ---

const ToggleSwitch = ({ isEnabled, onToggle, leftLabel, rightLabel }) => (
    <div className="flex items-center space-x-2 cursor-pointer" onClick={onToggle} title={`Switch to '${isEnabled ? leftLabel : rightLabel}'`}>
        <span className={`text-sm font-medium transition-colors ${!isEnabled ? 'text-white' : 'text-gray-400'}`}>{leftLabel}</span>
        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`}></div>
        </div>
        <span className={`text-sm font-medium transition-colors ${isEnabled ? 'text-white' : 'text-gray-400'}`}>{rightLabel}</span>
    </div>
);

// Renders the core UI of a slider (label, value, track) without the outer box.
const SliderCore = ({ icon: Icon, label, gradient, value, onChange, maxHours, timeFormatter }) => {
    const [isDragging, setIsDragging] = useState(false);
    const displayTime = timeFormatter(value);
    // Prevent division by zero or log of zero if maxHours is 0
    const sliderProgress = maxHours > 0 ? (Math.log(value + 1) / Math.log(maxHours + 1)) * 100 : 0;

    const handleSliderChange = (e) => {
        const linearValue = parseFloat(e.target.value);
        const logValue = Math.exp((linearValue / 100) * Math.log(maxHours + 1)) - 1;
        onChange(Math.round(logValue));
    };

    return (
        <div>
            <style>{`.custom-slider-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 0; height: 0; opacity: 0; }`}</style>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <Icon className="w-6 h-6" style={{ color: gradient.stop }} />
                    <span className="font-semibold text-gray-200">{label}</span>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-bold text-white tracking-tight">{displayTime.value}</span>
                    <span className="text-sm text-gray-400 ml-1.5">{displayTime.unit}</span>
                </div>
            </div>
            <div className="relative h-4 group">
                <input type="range" min="0" max="100" step="0.1" value={sliderProgress} onChange={handleSliderChange} onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)} className="custom-slider-thumb w-full h-2 rounded-lg appearance-none cursor-pointer range-lg bg-transparent absolute top-1/2 -translate-y-1/2 z-10" />
                <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 rounded-full bg-gray-700 overflow-hidden" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                    <div className="h-full" style={{ width: `${sliderProgress}%`, background: `linear-gradient(to right, ${gradient.start}, ${gradient.stop})`, transition: 'width 0.1s ease' }}></div>
                </div>
                <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-transform duration-150 ease-in-out pointer-events-none ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`} style={{ left: `calc(${sliderProgress}% - 10px)`, backgroundColor: gradient.stop, border: '2px solid rgba(0, 0, 0, 0.5)', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', transition: 'left 0.1s ease, transform 0.15s ease' }}></div>
            </div>
        </div>
    );
};

// Renders a single box containing the main slider and its nested interval slider.
const TimeSliderWithInterval = ({ mainSliderProps, intervalSliderProps }) => (
    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 w-full backdrop-blur-sm">
        <SliderCore {...mainSliderProps} />
        <div className="relative pl-8 pt-4 mt-4">
            <div className="absolute left-3 top-0 h-full w-5">
                <div className="h-6 w-full border-b border-l border-gray-700 rounded-bl-lg"></div>
            </div>
            <div className="pl-2">
                <SliderCore {...intervalSliderProps} />
            </div>
        </div>
    </div>
);


// --- Main Module ---
const ConditionalSchedulerModule = ({ schedulerConfig, onSchedulerConfigChange }) => {
    const rule = schedulerConfig?.branches?.[0];
    if (!rule) return null;

    const updateRule = (updatedRule) => {
        const updatedBranches = schedulerConfig.branches.map(b => b.id === updatedRule.id ? updatedRule : b);
        onSchedulerConfigChange({ ...schedulerConfig, branches: updatedBranches });
    };

    const handleMatchTypeChange = () => updateRule({ ...rule, matchType: rule.matchType === 'all' ? 'any' : 'all' });
    const handleConditionChange = (idx, newCond) => {
        const updatedConditions = rule.conditions.map((c, i) => i === idx ? newCond : c);
        updateRule({ ...rule, conditions: updatedConditions });
    };
    const handleTimeChange = (type, time) => updateRule({ ...rule, [type]: time });
    
    const addConditionToRule = () => {
        const newCondition = { id: uuidv4(), field: '', operator: '', value: '' };
        updateRule({ ...rule, conditions: [...rule.conditions, newCondition] });
    };
    
    const removeConditionFromRule = (idx) => {
        const updatedConditions = rule.conditions.filter((_, i) => i !== idx);
        updateRule({ ...rule, conditions: updatedConditions });
    };

    const acceleratedGradient = { start: '#a855f7', stop: '#ec4899' };
    const standardGradient = { start: '#a855f7', stop: '#ec4899' };
    const intervalGradient = { start: '#38bdf8', stop: '#34d399' };

    return (
        <div className="p-6 font-sans bg-gray-900/50 rounded-2xl border border-gray-700/50 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3"><GitBranch className="text-purple-400" /> Conditional Follow-up</h2>
                <p className="text-gray-400 text-base">Define a rule to change follow-up speed based on lead properties.</p>
            </div>
            
            <div className="space-y-8">
                {/* IF Block */}
                <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm">IF</div>
                            <h3 className="text-white font-semibold">Lead meets <span className="text-purple-400 font-bold">{rule.matchType}</span> of the following conditions:</h3>
                        </div>
                        {rule.conditions.length > 1 && <ToggleSwitch isEnabled={rule.matchType === 'any'} onToggle={handleMatchTypeChange} leftLabel="All" rightLabel="Any" />}
                    </div>
                    <div className="ml-4 pl-8 border-l-2 border-gray-700 space-y-3 pb-8">
                        {rule.conditions.length === 0 && <div className="text-gray-400 text-sm italic py-2">No conditions defined. The standard follow-up will be used.</div>}
                        {rule.conditions.map((condition, i) => <FilterBuilder key={condition.id} condition={condition} onConditionChange={(c) => handleConditionChange(i, c)} onRemove={() => removeConditionFromRule(i)} />)}
                        <button onClick={addConditionToRule} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors pt-2"><Plus className="w-4 h-4" /> {rule.conditions.length > 0 ? 'And...' : 'Add Filter'}</button>
                    </div>
                    <div className="absolute left-4 top-10 w-px h-[calc(100%-2.5rem)] bg-gray-700 -z-10"></div>
                </div>

                {/* THEN Block */}
                <div className={`relative transition-opacity duration-300 ${rule.conditions.length === 0 ? 'opacity-50' : 'opacity-100'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400"><ArrowRight className="w-4 h-4" /></div>
                        <h3 className="text-white font-semibold">Then, trigger this accelerated follow-up:</h3>
                    </div>
                    <div className="ml-12">
                        <TimeSliderWithInterval
                            mainSliderProps={{
                                icon: Zap,
                                label: "Initial Follow-up",
                                gradient: acceleratedGradient,
                                value: rule.ifTime,
                                onChange: (time) => handleTimeChange('ifTime', time),
                                maxHours: 24 * 365,
                                timeFormatter: formatTimeLabel,
                            }}
                            intervalSliderProps={{
                                icon: Repeat,
                                label: "Then every...",
                                gradient: intervalGradient,
                                value: rule.ifInterval,
                                onChange: (time) => handleTimeChange('ifInterval', time),
                                maxHours: 24 * 30.417 * 36,
                                timeFormatter: formatIntervalLabel,
                            }}
                        />
                    </div>
                </div>

                {/* ELSE Block */}
                <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-600/20 text-gray-400 font-bold text-sm">ELSE</div>
                        <h3 className="text-gray-300 font-semibold">Otherwise, use the standard follow-up:</h3>
                    </div>
                    <div className="ml-12">
                        <TimeSliderWithInterval
                            mainSliderProps={{
                                icon: Hourglass,
                                label: "Initial Follow-up",
                                gradient: standardGradient,
                                value: rule.elseTime,
                                onChange: (time) => handleTimeChange('elseTime', time),
                                maxHours: 24 * 365,
                                timeFormatter: formatTimeLabel,
                            }}
                            intervalSliderProps={{
                                icon: Repeat,
                                label: "Then every...",
                                gradient: intervalGradient,
                                value: rule.elseInterval,
                                onChange: (time) => handleTimeChange('elseInterval', time),
                                maxHours: 24 * 30.417 * 36,
                                timeFormatter: formatIntervalLabel,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConditionalSchedulerModule;
