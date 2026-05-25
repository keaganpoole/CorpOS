import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Users, Plus, X } from 'lucide-react';
import FilterBuilder from './FilterBuilder';

const ToggleSwitch = ({ isEnabled, onToggle, leftLabel, rightLabel }) => (
    <div className="flex items-center space-x-2 cursor-pointer" onClick={onToggle} title={`Switch to '${isEnabled ? leftLabel : rightLabel}'`}>
        <span className={`text-sm font-medium transition-colors ${!isEnabled ? 'text-white' : 'text-gray-400'}`}>{leftLabel}</span>
        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`}></div>
        </div>
        <span className={`text-sm font-medium transition-colors ${isEnabled ? 'text-white' : 'text-gray-400'}`}>{rightLabel}</span>
    </div>
);

const MainAudienceFilterModule = ({ filterConfig, onFilterConfigChange, campaignName, onCampaignNameChange }) => {
    const { conditions, matchType } = filterConfig;

    const handleMatchTypeChange = () => {
        const newMatchType = matchType === 'all' ? 'any' : 'all';
        onFilterConfigChange({ ...filterConfig, matchType: newMatchType });
    };

    const handleConditionChange = (index, newCondition) => {
        const updatedConditions = conditions.map((cond, i) =>
            i === index ? newCondition : cond
        );
        onFilterConfigChange({ ...filterConfig, conditions: updatedConditions });
    };

    const addCondition = () => {
        const newCondition = { id: uuidv4(), field: '', operator: '', value: '' };
        const updatedConditions = [...conditions, newCondition];
        onFilterConfigChange({ ...filterConfig, conditions: updatedConditions });
    };

    const removeCondition = (index) => {
        const updatedConditions = conditions.filter((_, i) => i !== index);
        onFilterConfigChange({ ...filterConfig, conditions: updatedConditions });
    };

    return (
        <div className="main-audience-filter-module w-full max-w-7xl mx-auto p-6 font-sans bg-gray-900/50 rounded-2xl border border-gray-700/50">
            <div className="mb-6">
                <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                <input
                    type="text"
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => onCampaignNameChange(e.target.value)}
                    placeholder="e.g., 'Summer Promo Outreach'"
                    className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Main Audience Filter: Define WHO</h2>
            <p className="text-gray-400 mb-8 text-base">This filter defines the broad audience for the campaign. Leads must match these criteria to enter.</p>

            <div className="relative">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400">
                            <Users className="w-4 h-4" />
                        </div>
                        <h3 className="text-white font-semibold">
                            Include leads who match <span className="text-purple-400 font-bold">{matchType}</span> of the following conditions:
                        </h3>
                    </div>
                    {conditions.length > 1 && (
                        <ToggleSwitch
                            isEnabled={matchType === 'any'}
                            onToggle={handleMatchTypeChange}
                            leftLabel="All"
                            rightLabel="Any"
                        />
                    )}
                </div>

                <div className="ml-4 pl-8 border-l-2 border-gray-700 space-y-4 pb-4">
                    {conditions.length === 0 ? (
                        <div className="text-gray-500 text-sm italic py-2">
                            No conditions defined. The campaign will target all leads.
                        </div>
                    ) : (
                        conditions.map((condition, index) => (
                            <FilterBuilder
                                key={condition.id}
                                condition={condition}
                                onConditionChange={(newCond) => handleConditionChange(index, newCond)}
                                onRemove={() => removeCondition(index)}
                            />
                        ))
                    )}
                    <button onClick={addCondition} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors pt-2">
                        <Plus className="w-4 h-4" /> {conditions.length > 0 ? 'And...' : 'Add Filter'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MainAudienceFilterModule;
