import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Bot, Plus, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAvailableAgents } from '../../services/apiService'; // Correctly import the new service

const AgentCard = ({ agent, isSelected, onSelect }) => {
  // Use first_name for the display name, fallback to a default if needed
  const name = agent.first_name || "Unnamed Agent";
  const isDefault = agent.access === 'open'; // A simple way to check if it's a public/default agent

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 ${isSelected ? 'bg-purple-600/50 ring-2 ring-purple-400' : 'bg-gray-800/60 hover:bg-gray-700/80'}`}
      onClick={() => onSelect(agent)}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-3 bg-purple-500 text-white rounded-full p-1"
          >
            <CheckCircle size={20} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-gray-700 to-gray-900">
          {isDefault ? <Bot size={40} className="text-cyan-400" /> : <Users size={40} className="text-pink-400" />}
        </div>
        <h3 className="text-xl font-bold text-white">{name}</h3>
        <p className="text-sm text-gray-400">{agent.description || (isDefault ? 'Public Agent' : 'Your Custom Agent')}</p>
      </div>
    </motion.div>
  );
};

const CreateAgentCard = () => {
  const navigate = useNavigate();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="p-6 rounded-2xl cursor-pointer transition-all duration-300 bg-gray-800/60 hover:bg-gray-700/80 border-2 border-dashed border-gray-600 hover:border-purple-500"
      onClick={() => navigate('/agent-playground')}
    >
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="mb-4 p-4 rounded-full bg-gray-700/50">
          <Plus size={40} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Create New Agent</h3>
        <p className="text-sm text-gray-400">Go to the Agent Playground</p>
      </div>
    </motion.div>
  );
};

const AgentSelectorModal = ({ isOpen, onClose, onSelectAgent, selectedAgentId }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchAgents = async () => {
        console.log("Fetching AI agents...");
        setLoading(true);
        try {
          const response = await getAvailableAgents();
          if (response.data) {
            console.log("Agents fetched successfully:", response.data);
            setAgents(response.data);
            // Set the selected agent based on the prop, or default to the first agent in the list
            const currentlySelected = response.data.find(a => a.id === selectedAgentId) || response.data[0] || null;
            setSelectedAgent(currentlySelected);
          } else {
            // Handle cases where API returns a success status but no data
            console.warn("Fetched agents but data array is empty or null.");
            setAgents([]);
          }
        } catch (error) {
          // Log the full error for better debugging
          console.error("Failed to fetch AI agents:", error.response ? error.response.data : error.message, error);
          setAgents([]); // Clear agents on error to prevent rendering stale data
        } finally {
          // Ensure loading is always turned off
          setLoading(false);
          console.log("Finished fetching agents.");
        }
      };
      fetchAgents();
    }
  }, [isOpen, selectedAgentId]);

  const handleSelect = (agent) => {
    setSelectedAgent(agent);
  };

  const handleConfirm = () => {
    onSelectAgent(selectedAgent);
    onClose();
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-4xl bg-gray-900/80 border border-gray-700 rounded-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Choose Your AI Agent</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </header>

            <main className="p-8 flex-grow">
              {loading ? (
                <div className="text-center text-gray-400">Loading agents...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {agents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} isSelected={selectedAgent?.id === agent.id} onSelect={handleSelect} />
                  ))}
                  <CreateAgentCard />
                </div>
              )}
            </main>

            <footer className="p-6 border-t border-gray-700 flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={!selectedAgent}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-pink-500/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Selection
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgentSelectorModal;
