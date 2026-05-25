// src/components/CampaignBuilder/CampaignConfigPanel.jsx
import React, { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilter, faCalendarAlt, faStar } from '@fortawesome/free-solid-svg-icons';
import MainAudienceFilterModule from './MainAudienceFilterModule';
import ConditionalSchedulerModule from './ConditionalSchedulerModule';
import PriorityModule from './PriorityModule';
import useCampaignBuilderStore from '../../stores/campaignBuilderStore';

const CampaignConfigPanel = ({ module, onClose, onSave }) => {
  const { data, updateModuleData, campaignName, setCampaignName } = useCampaignBuilderStore();
  const moduleData = data[module.id] || {};

  // FIX: Memoized callback to avoid triggering infinite re-renders
  const handleModuleDataChange = useCallback((newData) => {
    updateModuleData(module.id, newData);
  }, [module.id, updateModuleData]);

  const renderContent = () => {
    switch (module.type) {
      case 'main_audience_filter':
        return (
          <MainAudienceFilterModule 
            filterConfig={moduleData}
            onFilterConfigChange={handleModuleDataChange}
            campaignName={campaignName}
            onCampaignNameChange={setCampaignName}
          />
        );
      case 'conditional_scheduler':
        return (
          <ConditionalSchedulerModule 
            schedulerConfig={moduleData}
            onSchedulerConfigChange={handleModuleDataChange}
          />
        );
      case 'priority':
        return (
          <PriorityModule 
            priorityConfig={moduleData}
            onPriorityConfigChange={handleModuleDataChange}
          />
        );
      default:
        return <p>No configuration available for this module type.</p>;
    }
  };

  const icons = { main_audience_filter: faFilter, conditional_scheduler: faCalendarAlt, priority: faStar };
  const titles = { main_audience_filter: "Configure Audience Filter", conditional_scheduler: "Configure Conditional Scheduler", priority: "Configure Priority" };

  return (
    <div
      className="contextual-config-panel relative overflow-hidden"
      style={{
        width: '90vw',
        maxWidth: '800px',
        maxHeight: '90vh',
        backgroundColor: 'rgba(10, 11, 15, 0.95)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '16px',
        boxShadow: '0 0 40px rgba(255, 26, 224, 0.3), inset 0 0 10px rgba(255, 26, 224, 0.1)',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
        zIndex: 20,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="panel-header border-b border-gray-700 pb-4 mb-4 flex items-center space-x-3">
        <FontAwesomeIcon icon={icons[module.type]} className="panel-header-icon text-pink-400 text-2xl" />
        <h3 className="text-xl font-bold text-white flex-grow">{titles[module.type]}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors duration-200 text-2xl">
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

    

      <div className="panel-content">{renderContent()}</div>

      <div className="panel-footer pt-4 mt-auto border-t border-gray-700 flex justify-end space-x-3 px-6 pb-6">
        <button className="panel-btn-secondary bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded" onClick={onClose}>
          Cancel
        </button>
        <button className="panel-btn-primary bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-lg shadow-pink-500/30 text-white py-2 px-4 rounded" onClick={onSave}>
          Save & Close
        </button>
      </div>
    </div>
  );
};

export default CampaignConfigPanel;