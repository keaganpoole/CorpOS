// src/components/modals/LimitReachedModal.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import './LimitReachedModal.css';

const LimitReachedModal = ({ isOpen, onClose, title, message, pageTheme = 'passwords' }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={`limit-modal-backdrop ${pageTheme}-theme`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="limit-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} className="limit-modal-icon" />
            <h2>{title}</h2>
            <p>{message}</p>
            <div className="limit-modal-actions">
              <button onClick={onClose} className="limit-modal-btn close-btn">
                Got it
              </button>
              <Link to="/pricing" className="limit-modal-btn upgrade-btn">
                Upgrade Plan
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LimitReachedModal;
