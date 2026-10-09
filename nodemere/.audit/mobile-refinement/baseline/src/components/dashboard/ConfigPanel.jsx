// src/components/dashboard/ConfigPanel.jsx

import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import useBuilderStore from '../../stores/builderStore';

const ConfigPanel = ({ module, data, onClose, onSave }) => {
  const { updateModuleData } = useBuilderStore.getState();
  const moduleData = data[module.id] || {};

  const handleChange = (e) => {
    updateModuleData(module.id, { [e.target.name]: e.target.value });
  };
  
  const panelVariants = {
    hidden: { opacity: 0, scale: 0.95, x: -20 },
    visible: { opacity: 1, scale: 1, x: 0 },
  };

  return (
    <motion.div
      className="contextual-config-panel"
      style={{
        top: module.position.y - 100, // Position relative to the bubble
        left: module.position.x + 80,
      }}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="panel-header">
        <h3>Configure Info</h3>
        <button onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
      </div>
      
      <div className="panel-content">
        {module.type === 'personal_info' && (
          <>
            <div className="input-block">
              <label>First Name</label>
              <input name="first_name" value={moduleData.first_name || ''} onChange={handleChange} placeholder="e.g., Jane"/>
            </div>
            <div className="input-block">
              <label>Last Name</label>
              <input name="last_name" value={moduleData.last_name || ''} onChange={handleChange} placeholder="e.g., Doe"/>
            </div>
            <div className="input-block">
              <label>Email</label>
              <input name="email" type="email" value={moduleData.email || ''} onChange={handleChange} placeholder="jane.doe@example.com"/>
            </div>
            <div className="input-block">
              <label>Phone</label>
              <input name="phone" type="tel" value={moduleData.phone || ''} onChange={handleChange} placeholder="(555) 123-4567"/>
            </div>
            <div className="input-block">
              <label>Notes</label>
              <textarea name="notes" value={moduleData.notes || ''} onChange={handleChange} rows="3" placeholder="Add any relevant notes..."></textarea>
            </div>
          </>
        )}
        {/* Add UI for 'devices' and 'accessories' modules here later */}
      </div>

      <div className="panel-footer">
        <button className="panel-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="panel-btn-primary" onClick={onSave}>Save</button>
      </div>
    </motion.div>
  );
};

export default ConfigPanel;