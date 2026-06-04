import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './DeviceInfoModal.css';

const DeviceInfoModal = ({ user, onUpdate, onClose, initialDeviceData, isUpdateMode = false }) => {
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);

  const [selectedMake, setSelectedMake] = useState(initialDeviceData?.make || '');
  const [selectedModel, setSelectedModel] = useState(initialDeviceData?.model || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMakes = async () => {
      const { data, error } = await supabase.from('devices').select('make');
      
      if (error) {
        console.error('Error fetching makes:', error);
        return;
      }
      
      if (data) {
        const distinctMakes = [...new Set(data.map(device => device.make))].sort();
        setMakes(distinctMakes);
      }
    };
    fetchMakes();
  }, []);

  useEffect(() => {
    // Reset dependent dropdowns when make changes, unless in update mode and initial data matches
    if (isUpdateMode && initialDeviceData?.make === selectedMake) {
      setSelectedModel(initialDeviceData?.model || '');
    } else {
      setSelectedModel('');
    }
    setModels([]);

    const fetchModels = async () => {
      if (selectedMake) {
        const { data, error } = await supabase
          .from('devices')
          .select('model')
          .eq('make', selectedMake);

        if (error) {
          console.error('Error fetching models:', error);
          return;
        }

        if (data) {
          const distinctModels = [...new Set(data.map(device => device.model))].sort();
          setModels(distinctModels);
        }
      }
    };
    
    fetchModels();
  }, [selectedMake, isUpdateMode, initialDeviceData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMake || !selectedModel) {
        return;
    }
    setIsSubmitting(true);
    const device = {
      make: selectedMake,
      model: selectedModel,
    };
    
    onUpdate(device);
    setIsSubmitting(false);
  };

  return (
    <div className="device-info-modal-overlay">
      <div className="device-info-modal-content">
        <button onClick={onClose} className="modal-close-btn">
            <FontAwesomeIcon icon={faTimes} />
        </button>
        <h2 className="modal-title">{isUpdateMode ? 'Update Device Details' : 'Tell Us About Your Device'}</h2>
        <p className="modal-subtitle">This helps us provide more accurate assistance.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group-grouped">
            <div className="form-group">
              <label htmlFor="make">Make</label>
              <select
                id="make"
                value={selectedMake}
                onChange={(e) => setSelectedMake(e.target.value)}
                className="modal-select"
                required
              >
                <option value="" disabled>Select Make</option>
                {makes.map(make => <option key={make} value={make}>{make}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="model">Model</label>
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="modal-select"
                disabled={!selectedMake}
                required
              >
                <option value="" disabled>Select Model</option>
                {models.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </div>
             <p className="modal-note"></p>
          </div>

          <div className="modal-actions">
            <button type="submit" className="modal-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save and Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceInfoModal;