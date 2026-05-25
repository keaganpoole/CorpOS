// src/components/CampaignBuilder/CampaignBuilderPage.jsx
import React, { useState } from 'react';
import SchedulerModule from './SchedulerModule';
import PriorityModule from './PriorityModule';

const CampaignBuilderPage = () => {
  const [campaignConfig, setCampaignConfig] = useState({
    scheduler: { timeToFollowUp: 0, rules: [] },
    priority: { priorityLevel: 'Medium', exclusiveRun: false, reviewAiMessages: false },
  });

  const handleSchedulerConfigChange = (newSchedulerConfig) => {
    setCampaignConfig(prevConfig => ({
      ...prevConfig,
      scheduler: newSchedulerConfig,
    }));
  };

  const handlePriorityConfigChange = (newPriorityConfig) => {
    setCampaignConfig(prevConfig => ({
      ...prevConfig,
      priority: newPriorityConfig,
    }));
  };

  // You can add a save/submit button and logic here to handle campaignConfig
  const handleSaveCampaign = () => {
    console.log('Saving Campaign Configuration:', campaignConfig);
    // In a real application, you would send this data to your backend API
    alert('Campaign configuration saved! Check console for details.');
  };

  return (
    <div className="campaign-builder-page p-6 bg-white rounded-lg shadow-lg my-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Campaign Builder</h1>
      
      <div className="flex flex-wrap md:flex-nowrap gap-6">
        <div className="flex-grow w-full md:w-1/2">
          <SchedulerModule 
            schedulerConfig={campaignConfig.scheduler}
            onSchedulerConfigChange={handleSchedulerConfigChange}
          />
        </div>
        <div className="flex-grow w-full md:w-1/2">
          <PriorityModule 
            priorityConfig={campaignConfig.priority}
            onPriorityConfigChange={handlePriorityConfigChange}
          />
        </div>
      </div>

      <button
        onClick={handleSaveCampaign}
        className="mt-8 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Save Campaign
      </button>
    </div>
  );
};

export default CampaignBuilderPage;

