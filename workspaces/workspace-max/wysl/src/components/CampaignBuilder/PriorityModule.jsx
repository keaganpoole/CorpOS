import React, { useState } from 'react';
import { ShieldCheck, Zap, AlertTriangle, ChevronsDown, Eye } from 'lucide-react';

// --- Reusable Child Components (from your existing design system) ---

const ToggleSwitch = ({ isEnabled, onToggle, leftLabel, rightLabel }) => (
    <div className="flex items-center space-x-2 cursor-pointer" onClick={onToggle} title={`Switch to '${isEnabled ? leftLabel : rightLabel}'`}>
        <span className={`text-sm font-medium transition-colors ${!isEnabled ? 'text-white' : 'text-gray-400'}`}>{leftLabel}</span>
        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`}></div>
        </div>
        <span className={`text-sm font-medium transition-colors ${isEnabled ? 'text-white' : 'text-gray-400'}`}>{rightLabel}</span>
    </div>
);


// --- REFACTORED PriorityModule ---

const PriorityModule = ({ priorityConfig, onPriorityConfigChange }) => {
    // Destructure props to use as a controlled component
    const { priorityLevel, exclusiveRun, reviewAiMessages } = priorityConfig;

    // Handler to update the entire config object
    const handleConfigChange = (key, value) => {
        onPriorityConfigChange({
            ...priorityConfig,
            [key]: value
        });
    };

    const priorityOptions = [
        { level: 'High', icon: Zap, color: 'text-purple-400', bgColor: 'bg-purple-600', label: 'High' },
        { level: 'Medium', icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-600', label: 'Medium' },
        { level: 'Low', icon: ChevronsDown, color: 'text-sky-400', bgColor: 'bg-sky-600', label: 'Low' },
    ];

    return (
        <div className="priority-module p-6 font-sans bg-gray-900/50 rounded-2xl border border-gray-700/50 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Campaign Priority</h2>
                <p className="text-gray-400 text-base">Determines this campaign's importance relative to others targeting the same leads.</p>
            </div>
            
            {/* Themed Priority Selector */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Priority Level</label>
                <div className="flex rounded-lg shadow-sm bg-gray-800/60 border border-gray-700 p-1 space-x-1">
                    {priorityOptions.map(({level, icon: Icon, color, bgColor, label}) => (
                        <button
                            key={level}
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-md transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500
                                ${priorityLevel === level ? `${bgColor} text-white shadow-lg scale-105` : 'text-gray-300 hover:bg-gray-700/70'}`}
                            onClick={() => handleConfigChange('priorityLevel', level)}
                        >
                            <Icon className={`w-4 h-4 ${priorityLevel === level ? 'text-white' : color}`} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Consistent Toggle for Exclusive Run */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-pink-400" />
                    <span>Exclusive Run</span>
                </label>
                <div className="flex flex-col md:flex-row flex-wrap items-center justify-between bg-gray-800/60 border border-gray-700 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm max-w-md">
                        Lock leads in this campaign, preventing them from receiving messages from lower-priority campaigns simultaneously.
                    </p>
                    <ToggleSwitch
                        isEnabled={exclusiveRun}
                        onToggle={() => handleConfigChange('exclusiveRun', !exclusiveRun)}
                        leftLabel="Off"
                        rightLabel="On"
                    />
                </div>
            </div>
            
            {/* AI Message Review Toggle */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <span>Review AI Messages</span>
                </label>
                <div className="flex flex-col md:flex-row flex-wrap items-center justify-between bg-gray-800/60 border border-gray-700 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm max-w-md">
                        Manually approve the first message sent by the AI to each lead in this campaign.
                    </p>
                    <ToggleSwitch
                        isEnabled={reviewAiMessages}
                        onToggle={() => handleConfigChange('reviewAiMessages', !reviewAiMessages)}
                        leftLabel="Off"
                        rightLabel="On"
                    />
                </div>
            </div>
        </div>
    );
};


// --- Demonstration Panel (The New Parent Component) ---
const PriorityModuleDemo = () => {
    const [priorityConfig, setPriorityConfig] = useState({
        priorityLevel: 'Medium', // 'High', 'Medium', 'Low'
        exclusiveRun: false,
        reviewAiMessages: false,
    });

    const handlePriorityChange = (newConfig) => {
        console.log("Priority configuration updated in parent:", newConfig);
        setPriorityConfig(newConfig);
    };

    return (
        <div className="p-8 bg-gray-900 text-white min-h-screen">
            <div className="max-w-xl mx-auto">
                <PriorityModule
                    priorityConfig={priorityConfig}
                    onPriorityConfigChange={handlePriorityChange}
                />
            </div>
        </div>
    );
};

export default PriorityModule;