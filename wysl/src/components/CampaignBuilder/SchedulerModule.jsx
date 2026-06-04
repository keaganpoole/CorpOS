// src/components/CampaignBuilder/SchedulerModule.jsx
import React, { useState, useEffect } from 'react';
import TimeSlider from './TimeSlider';
import RuleBlockStack from './RuleBlockStack';

const SchedulerModule = ({ schedulerConfig, onSchedulerConfigChange }) => {
  const [timeToFollowUp, setTimeToFollowUp] = useState(schedulerConfig?.timeToFollowUp || 0);
  const [rules, setRules] = useState(schedulerConfig?.rules || []);

  useEffect(() => {
    onSchedulerConfigChange({
      timeToFollowUp,
      rules,
    });
  }, [timeToFollowUp, rules]);

  return (
    <div className="scheduler-module p-6 bg-gray-100 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Scheduler: Define WHO and WHEN</h2>
      
      <div className="mb-6">
        <TimeSlider value={timeToFollowUp} onChange={setTimeToFollowUp} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Follow-up Rules (OR-based)</h3>
        <RuleBlockStack rules={rules} onRulesChange={setRules} />
      </div>
    </div>
  );
};

export default SchedulerModule;
