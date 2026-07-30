// src/components/dashboard/LeadBuilderCanvas.jsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useBuilderStore from '../../stores/builderStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faMobileScreen, faPlug, faPlus, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import '../../styles/LeadBuilder.css';

// --- Constants ---
const BUBBLE_SIZE = 200;
const SPACING = 60;
const moduleSequence = ['personal_info', 'devices', 'accessories'];

const deviceData = {
  "iPhones": ["iPhone 17", "iPhone 17 Plus", "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 16e", "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max"],
  "Android Devices": ["Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy Z Fold6"],
};
const accessoryData = ["AirPods", "Bluetooth Speaker", "Car Mount", "Case", "Charging Block", "Power Bank", "Screen Protector"];

// --- Sub Components ---
const CustomCheckbox = ({ label, name, checked, onChange }) => (
  <label className="custom-checkbox">
    <input type="checkbox" name={name} checked={checked} onChange={onChange} />
    <span className="checkbox-box"><FontAwesomeIcon icon={faCheck} className="icon" /></span>
    {label}
  </label>
);

const AddStepHandle = ({ onClick, nextModuleType }) => {
  const text = `Add ${nextModuleType.replace('_', ' ')}`;
  return (
    <motion.div 
      className="add-step-handle" 
      onClick={onClick}
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
    >
      <span className="add-step-handle-text">{text}</span>
      <FontAwesomeIcon icon={faPlus} />
    </motion.div>
  );
};

const ConfigPanel = ({ module, onClose, onSave }) => {
  const { data, updateModuleData } = useBuilderStore();
  const moduleData = data[module.id] || {};

  const handleSimpleChange = (e) => {
    const { name, value } = e.target;
    updateModuleData(module.id, { [name]: value });
  };

  const handleDeviceChange = (deviceName, field, value) => {
    const currentDeviceData = moduleData.devices ? { ...moduleData.devices } : {};
    if (!currentDeviceData[deviceName]) {
      currentDeviceData[deviceName] = {};
    }
    currentDeviceData[deviceName][field] = value;
    updateModuleData(module.id, { devices: currentDeviceData });
  };

  const handleAccessoryChange = (accessoryName, isSelected) => {
    const currentAccessoryData = moduleData.accessories ? { ...moduleData.accessories } : {};
    currentAccessoryData[accessoryName] = isSelected;
    updateModuleData(module.id, { accessories: currentAccessoryData });
  };

  const renderContent = () => {
    switch (module.type) {
      case 'personal_info':
        return (
          <>
            <div className="input-block"><input name="first_name" id={`fn_${module.id}`} className="input-block-input" value={moduleData.first_name || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`fn_${module.id}`} className="input-block-label">First Name</label></div>
            <div className="input-block"><input name="last_name" id={`ln_${module.id}`} className="input-block-input" value={moduleData.last_name || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`ln_${module.id}`} className="input-block-label">Last Name</label></div>
            <div className="input-block"><input name="company" id={`co_${module.id}`} className="input-block-input" value={moduleData.company || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`co_${module.id}`} className="input-block-label">Company</label></div>
            <div className="input-block"><input name="phone" type="tel" id={`ph_${module.id}`} className="input-block-input" value={moduleData.phone || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`ph_${module.id}`} className="input-block-label">Phone</label></div>
            <div className="input-block"><input name="email" type="email" id={`em_${module.id}`} className="input-block-input" value={moduleData.email || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`em_${module.id}`} className="input-block-label">Email</label></div>
            <div className="input-block">
              <select name="profile" id={`pr_${module.id}`} className="input-block-select" value={moduleData.profile || ''} onChange={handleSimpleChange}>
                <option value="" disabled hidden></option>
                <option value="financier">Financier 🤑</option>
                <option value="techy">Techy 🤓</option>
                <option value="legacy">Legacy 👴</option>
              </select>
              <label htmlFor={`pr_${module.id}`} className="input-block-label">Profile</label>
            </div>
            <div className="input-block">
              <select name="status" id={`st_${module.id}`} className="input-block-select" value={moduleData.status || ''} onChange={handleSimpleChange}><option value="" disabled hidden></option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="lost">Lost</option></select>
              <label htmlFor={`st_${module.id}`} className="input-block-label">Status</label>
            </div>
            <div className="numeric-grid">
              <div className="input-block"><input name="potential_lines" type="number" id={`pl_${module.id}`} className="input-block-input" value={moduleData.potential_lines || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`pl_${module.id}`} className="input-block-label">Potential Lines</label></div>
              <div className="input-block"><input name="add_a_lines" type="number" id={`al_${module.id}`} className="input-block-input" value={moduleData.add_a_lines || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`al_${module.id}`} className="input-block-label">Lines Added</label></div>
              <div className="input-block"><input name="upgrades" type="number" id={`ug_${module.id}`} className="input-block-input" value={moduleData.upgrades || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`ug_${module.id}`} className="input-block-label">Upgrades</label></div>
              <div className="input-block"><input name="referrals" type="number" id={`rf_${module.id}`} className="input-block-input" value={moduleData.referrals || ''} onChange={handleSimpleChange} placeholder=" " /><label htmlFor={`rf_${module.id}`} className="input-block-label">Referrals</label></div>
            </div>
            <div className="input-block"><textarea name="notes" id={`no_${module.id}`} className="input-block-input" value={moduleData.notes || ''} onChange={handleSimpleChange} placeholder=" "></textarea><label htmlFor={`no_${module.id}`} className="input-block-label">Notes</label></div>
          </>
        );
      case 'devices':
        return Object.entries(deviceData).map(([category, devices]) => (
          <React.Fragment key={category}>
            <h4 className="panel-section-header">{category}</h4>
            <div className="item-list">
              {devices.map(device => {
                const isSelected = moduleData.devices?.[device]?.selected;
                return (
                  <div key={device} className="device-item">
                    <CustomCheckbox label={device} checked={isSelected || false} onChange={e => handleDeviceChange(device, 'selected', e.target.checked)} />
                    {isSelected && (
                      <div className="device-options">
                        <CustomCheckbox label="Insured" checked={moduleData.devices?.[device]?.insured || false} onChange={e => handleDeviceChange(device, 'insured', e.target.checked)} />
                        <CustomCheckbox label="Early Upgrade" checked={moduleData.devices?.[device]?.early_upgrade || false} onChange={e => handleDeviceChange(device, 'early_upgrade', e.target.checked)} />
                        <CustomCheckbox label="Postpaid" checked={moduleData.devices?.[device]?.postpaid || false} onChange={e => handleDeviceChange(device, 'postpaid', e.target.checked)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ));
      case 'accessories':
        return (
          <div className="item-list">
            {accessoryData.map(accessory => (
              <div key={accessory} className="device-item">
                 <CustomCheckbox label={accessory} checked={moduleData.accessories?.[accessory] || false} onChange={e => handleAccessoryChange(accessory, e.target.checked)} />
              </div>
            ))}
          </div>
        );
      default:
        return <p>No configuration available for this module type.</p>;
    }
  };

  const icons = { personal_info: faUser, devices: faMobileScreen, accessories: faPlug };
  const titles = { personal_info: "Configure Lead Info", devices: "Select Devices", accessories: "Add Accessories" };

  return (
    <div className="contextual-config-panel" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <FontAwesomeIcon icon={icons[module.type]} className="panel-header-icon" />
        <h3>{titles[module.type]}</h3>
        <button onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
      </div>
      <div className="panel-content">{renderContent()}</div>
      <div className="panel-footer">
        <button className="panel-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="panel-btn-primary" onClick={onSave}>Save & Close</button>
      </div>
    </div>
  );
};

const SvgConnector = ({ from, to }) => {
  const startPoint = { x: from.x + BUBBLE_SIZE / 2, y: from.y + BUBBLE_SIZE / 2 };
  const endPoint = { x: to.x + BUBBLE_SIZE / 2, y: to.y + BUBBLE_SIZE / 2 };
  const d = `M ${startPoint.x + BUBBLE_SIZE/2} ${startPoint.y} C ${startPoint.x + BUBBLE_SIZE/2 + SPACING/2} ${startPoint.y}, ${endPoint.x - BUBBLE_SIZE/2 - SPACING/2} ${endPoint.y}, ${endPoint.x - BUBBLE_SIZE/2} ${endPoint.y}`;
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: -1 }}>
      <defs><linearGradient id="connector-gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#c026d3" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient></defs>
      <motion.path d={d} fill="none" stroke="url(#connector-gradient)" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: 'easeInOut' }}/>
    </svg>
  );
};

const Bubble = ({ module, onAddNextStep, onSelect }) => {
  const { data, activeModuleId } = useBuilderStore();
  const moduleData = data[module.id] || {};
  const isActive = activeModuleId === module.id;
  
  const isConfigured = (() => {
    if (module.type === 'personal_info') return !!(moduleData.first_name && moduleData.last_name);
    if (module.type === 'devices') return moduleData.devices && Object.values(moduleData.devices).some(d => d.selected);
    if (module.type === 'accessories') return moduleData.accessories && Object.values(moduleData.accessories).some(a => a);
    return false;
  })();

  const icons = { personal_info: faUser, devices: faMobileScreen, accessories: faPlug };
  
  const currentIndex = moduleSequence.indexOf(module.type);
  const nextModuleType = moduleSequence[currentIndex + 1];
  const nextModuleExists = useBuilderStore(state => state.modules.some(m => m.type === nextModuleType));

  return (
    <motion.div 
      className="module-wrapper" 
      style={{ top: module.position.y, left: module.position.x }}
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div 
        className={`bubble-module ${isConfigured ? 'configured' : ''} ${isActive ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(module.id); }}
      >
        <FontAwesomeIcon icon={isConfigured ? icons[module.type] : faPlus} className="bubble-icon" />
      </div>
      {isConfigured && onAddNextStep && nextModuleType && !nextModuleExists &&
        <AddStepHandle onClick={(e) => { e.stopPropagation(); onAddNextStep(module); }} nextModuleType={nextModuleType} />}
      {isConfigured && <span className="module-label">{module.type.replace('_', ' ')}</span>}
    </motion.div>
  );
};

// --- Main Canvas Component ---
const LeadBuilderCanvas = () => {
  const navigate = useNavigate();
  const { modules, data, activeModuleId, setModulePositions, addModule, openConfigPanel, closeConfigPanel, reset, saveLead, isSaving } = useBuilderStore();
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  const centerOnModule = useCallback((moduleId, currentModules) => {
    if (!canvasRef.current || !moduleId) return;
    const moduleToCenter = currentModules.find(m => m.id === moduleId);
    if (moduleToCenter && moduleToCenter.position) {
      setViewport({
        x: -moduleToCenter.position.x + (canvasRef.current.clientWidth / 2) - (BUBBLE_SIZE / 2),
        y: -moduleToCenter.position.y + (canvasRef.current.clientHeight / 2) - (BUBBLE_SIZE / 2),
      });
    }
  }, []);

  const recalculateLayout = useCallback((modulesToLayout) => {
    if (!canvasRef.current) return {};
    const sortedModules = [...modulesToLayout].sort((a, b) => moduleSequence.indexOf(a.type) - moduleSequence.indexOf(b.type));
    const totalWidth = (sortedModules.length * BUBBLE_SIZE) + ((sortedModules.length - 1) * SPACING);
    const startX = (canvasRef.current.clientWidth - totalWidth) / 2;
    const startY = (canvasRef.current.clientHeight - BUBBLE_SIZE) / 2;
    const newPositions = {};
    let currentX = startX;
    for (const module of sortedModules) {
      newPositions[module.id] = { x: currentX, y: startY };
      currentX += BUBBLE_SIZE + SPACING;
    }
    return newPositions;
  }, []);

  useEffect(() => {
    const { modules: currentModules, initialize } = useBuilderStore.getState();
    if (currentModules.length === 0 && canvasRef.current) {
      const initialPosition = { x: (canvasRef.current.clientWidth - BUBBLE_SIZE) / 2, y: (canvasRef.current.clientHeight - BUBBLE_SIZE) / 2 };
      initialize(initialPosition);
    }
    const handleResize = () => {
        const { modules: resizedModules, activeModuleId: resizedActiveId } = useBuilderStore.getState();
        if (resizedModules.length > 0) {
            const newPositions = recalculateLayout(resizedModules);
            setModulePositions(newPositions);
            const idToCenter = resizedActiveId || resizedModules[resizedModules.length - 1].id;
            centerOnModule(idToCenter, resizedModules.map(m => ({ ...m, position: newPositions[m.id] })));
        }
    };
    window.addEventListener('resize', handleResize);
    return () => {
        reset();
        window.removeEventListener('resize', handleResize);
    };
  }, [reset, recalculateLayout, setModulePositions, centerOnModule]);

  useEffect(() => {
    if (canvasRef.current && modules.length > 0) {
      const newPositions = recalculateLayout(modules);
      setModulePositions(newPositions);
      const idToCenter = activeModuleId || modules[modules.length - 1].id;
      centerOnModule(idToCenter, modules.map(m => ({ ...m, position: newPositions[m.id] })));
    }
  }, [modules.length, activeModuleId, recalculateLayout, setModulePositions, centerOnModule]);

  const handleSelectModule = (moduleId) => { openConfigPanel(moduleId); };
  
  const handleAddNextModule = (parentModule) => {
    const currentIndex = moduleSequence.indexOf(parentModule.type);
    const nextModuleType = moduleSequence[currentIndex + 1];
    if (!nextModuleType || modules.some(m => m.type === nextModuleType)) return;
    const newModuleId = uuidv4();
    const futureModules = [...modules, { id: newModuleId, type: nextModuleType, position: {x:0, y:0} }];
    const newPositions = recalculateLayout(futureModules);
    setModulePositions(newPositions); 
    addModule(nextModuleType, newPositions[newModuleId], newModuleId);
  };
  
  const handleClosePanel = () => { closeConfigPanel(); };

  const activeModule = modules.find(m => m.id === activeModuleId);
  const sortedModules = [...modules].sort((a, b) => moduleSequence.indexOf(a.type) - moduleSequence.indexOf(b.type));
  const panelVariants = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } };

  return (
    <div ref={canvasRef} className="builder-canvas" onClick={handleClosePanel}>
      <motion.div className="module-container" style={{ position: 'relative', width: '100%', height: '100%' }} animate={{ x: viewport.x, y: viewport.y }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}>
        {sortedModules.map(module => <Bubble key={module.id} module={module} onAddNextStep={handleAddNextModule} onSelect={handleSelectModule} />)}
        {sortedModules.map((module, index) => {
          if (index === sortedModules.length - 1) return null;
          const nextModule = sortedModules[index + 1];
          if (module.position && nextModule.position) return <SvgConnector key={`${module.id}-to-${nextModule.id}`} from={module.position} to={nextModule.position} />;
          return null;
        })}

        <AnimatePresence>
          {activeModule && (
            <motion.div
              style={{ position: 'absolute', top: activeModule.position.y, left: activeModule.position.x + BUBBLE_SIZE - 20, height: BUBBLE_SIZE, display: 'flex', alignItems: 'center', zIndex: 20 }}
              variants={panelVariants} initial="hidden" animate="visible" exit="hidden" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
              <ConfigPanel module={activeModule} onClose={handleClosePanel} onSave={handleClosePanel} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {modules.some(m => data[m.id]?.first_name) && (
        <button className="save-fab" onClick={() => saveLead(navigate)} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Create Lead'}
        </button>
      )}
    </div>
  );
};

export default LeadBuilderCanvas;