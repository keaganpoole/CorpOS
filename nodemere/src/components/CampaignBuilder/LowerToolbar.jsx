// src/components/CampaignBuilder/LowerToolbar.jsx
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Save, AlertTriangle, X, Bot } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import AgentSelectorModal from './AgentSelectorModal';
import useCampaignBuilderStore from '../../stores/campaignBuilderStore';
import apiService from '../../services/apiService';

const SettingsModal = ({ onClose }) => {
  const [watcherMode, setWatcherMode] = useState('manual');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulatedTime, setSimulatedTime] = useState(new Date());

  useEffect(() => {
    const fetchWatcherStatus = async () => {
      try {
        setIsLoading(true);
        const response = await apiService.get('/watcher/status');
        setWatcherMode(response.data.mode);
        setError(null);
      } catch (err) {
        setError('Failed to fetch watcher status.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWatcherStatus();
  }, []);

  const handleToggleWatcherMode = async () => {
    const newMode = watcherMode === 'manual' ? 'realtime' : 'manual';
    try {
      await apiService.put('/watcher/status', { mode: newMode });
      setWatcherMode(newMode);
      setError(null);
    } catch (err) {
      setError(`Failed to set watcher mode to ${newMode}.`);
      console.error(err);
    }
  };

  const handleRunWatcherManually = async () => {
    try {
      // Pass the simulated time if the mode is manual
      const payload = watcherMode === 'manual' ? { simulated_time: simulatedTime.toISOString() } : {};
      await apiService.post('/watcher/run', payload);
      alert('Watcher run initiated successfully.');
    } catch (err) {
      alert('Failed to initiate watcher run.');
      console.error(err);
    }
  };

  const handleTestMessageScheduler = async () => {
    try {
      await apiService.post('/test-message-scheduler', {});
      alert('Message scheduler test initiated! Check backend logs for details.');
    } catch (error) {
      console.error('Error triggering message scheduler test:', error);
      alert('Failed to trigger message scheduler test. Check console for errors.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full mb-4 w-[400px] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6"
    >
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white">
        <X size={20} />
      </button>
      <h3 className="text-lg font-bold text-white mb-4">Global Campaign Settings</h3>
      
      <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-lg p-3 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mt-1 flex-shrink-0" />
        <p>
          <span className="font-bold">Warning:</span> These settings apply to ALL campaigns and will override any individual campaign configurations.
        </p>
      </div>

      {/* Watcher Controls */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-300">Watcher Settings</h4>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex items-center justify-between p-3 bg-gray-900/70 rounded-lg">
            <label htmlFor="watcher-toggle" className="flex items-center cursor-pointer">
                <span className="mr-3 text-gray-400">Mode:</span>
                <div className="relative">
                    <input type="checkbox" id="watcher-toggle" className="sr-only" checked={watcherMode === 'realtime'} onChange={handleToggleWatcherMode} disabled={isLoading} />
                    <div className={`block w-14 h-8 rounded-full ${watcherMode === 'realtime' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${watcherMode === 'realtime' ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <span className="ml-3 font-medium w-20">{isLoading ? 'Loading...' : watcherMode.charAt(0).toUpperCase() + watcherMode.slice(1)}</span>
            </label>
            <button 
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                onClick={handleRunWatcherManually}
            >
                Run Manually
            </button>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-900/70 rounded-lg">
            <span className="text-gray-400">Test Message Generation:</span>
            <button 
                className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                onClick={handleTestMessageScheduler}
            >
                Test Scheduler
            </button>
        </div>
        
        {/* Conditional Date Picker */}
        <AnimatePresence>
        {watcherMode === 'manual' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-gray-900/70 rounded-lg"
          >
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Simulate Time for Manual Run (EST)
            </label>
            <DatePicker
              selected={simulatedTime}
              onChange={(date) => setSimulatedTime(date)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600"
            />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const LowerToolbar = ({ onSave, isSaving }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAgentSelectorOpen, setIsAgentSelectorOpen] = useState(false);
  const { selectedAgentId, setSelectedAgent } = useCampaignBuilderStore();

  return (
    <>
      <AgentSelectorModal
        isOpen={isAgentSelectorOpen}
        onClose={() => setIsAgentSelectorOpen(false)}
        onSelectAgent={setSelectedAgent}
        selectedAgentId={selectedAgentId}
      />
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="relative flex items-center justify-center">
          <AnimatePresence>
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
          </AnimatePresence>
          
          <div className="flex items-center gap-2 w-[700px] h-16 bg-gray-900/60 border border-gray-700/80 rounded-2xl shadow-2xl backdrop-blur-lg p-2">
            <button 
              onClick={() => setIsSettingsOpen(prev => !prev)}
              className={`p-3 rounded-full transition-colors ${isSettingsOpen ? 'bg-purple-500/30 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
              title="Global Settings"
            >
              <Settings size={24} />
            </button>

            <button 
              onClick={() => setIsAgentSelectorOpen(true)}
              className="p-3 rounded-full text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors"
              title="Choose AI Agent"
            >
              <Bot size={24} />
            </button>
            
            <div className="flex-grow" />

            <button 
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-3 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-pink-500/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              <span>{isSaving ? 'Saving...' : 'Save Campaign'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LowerToolbar;
