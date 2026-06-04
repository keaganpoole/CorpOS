// src/components/modals/PlanChangePopupModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './PlanChangePopupModal.css';

const PlanChangePopupModal = ({ isOpen, onClose, plan }) => {
  const color1 = colors.find(color => color.name === 'color1')?.hex || '#7b8afe';
  const color2 = colors.find(color => color.name === 'color2')?.hex || '#534eef';
  const navigate = useNavigate(); // Initialize navigate

  const handleUpgradeClick = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="plan-change-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ '--color1': color1, '--color2': color2 }} // Pass colors as CSS variables
        >
          <motion.div 
            className="plan-change-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button className="plan-change-modal-close-btn" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            {plan.toLowerCase() === 'free' ? (
              <>
                <h2>You're in! 🎂</h2>
                <p>Your free plan gives you full access with limits. Start your 14-day free trial of the Unlimited plan now for increased limits. </p>
                <div className="plan-change-modal-actions">
                  <motion.button 
                    onClick={handleUpgradeClick} 
                    className="plan-change-modal-btn upgrade-btn text-black"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Try for 14 days
                  </motion.button>
                  <motion.p 
                    onClick={onClose} 
                    className="plan-change-modal-text-link maybe-later-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Maybe later
                  </motion.p>
                </div>
              </>
            ) : (
              <>
                <h2>You're on the {plan} plan! 🎉</h2>
                <p>Enjoy all the features tailored for your current subscription. Keep up the great work!</p>
                <div className="plan-change-modal-actions">
                  <motion.button 
                    onClick={onClose} 
                    className="plan-change-modal-btn got-it-btn text-black"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Got it!
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlanChangePopupModal; 
