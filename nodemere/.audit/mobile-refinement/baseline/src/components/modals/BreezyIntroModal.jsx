// src/components/modals/BreezyIntroModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color';
import './BreezyIntroModal.css';

const BreezyIntroModal = ({ isOpen, onClose, firstName, breezyIntroImage, deviceModel }) => {
  const color1 = colors.find(color => color.name === 'color1').hex;
  const color2 = colors.find(color => color.name === 'color2').hex;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="breezy-intro-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ '--color1': color1, '--color2': color2 }} // Pass colors as CSS variables
        >
          <motion.div 
            className="breezy-intro-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button className="breezy-intro-modal-close-btn" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="breezy-intro-modal-columns">
              <div className="breezy-intro-modal-image-column">
                {breezyIntroImage && (
                  <img src={breezyIntroImage} alt="Breezy Intro" className="breezy-intro-image" />
                )}
              </div>
              <div className="breezy-intro-modal-text-column">
                <h2>Hey, {firstName}!</h2>
                <p>"I’m Breezy — your personal device and login assistant. Whether you’re having trouble signing in or need help navigating your device, I’m here to guide you! 😊"</p>
                <div className="breezy-intro-modal-actions">
                  <motion.button 
                    onClick={onClose} 
                    className="breezy-intro-modal-btn got-it-btn font-inter font-medium text-sm text-black"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start chatting
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BreezyIntroModal;
