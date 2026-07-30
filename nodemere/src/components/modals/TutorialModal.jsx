// src/components/modals/TutorialModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color';
import './TutorialModal.css';

const TutorialModal = ({ isOpen, onClose, onConfirm }) => {
  const [dontRemindAgain, setDontRemindAgain] = useState(false);
  const color1 = colors.find(color => color.name === 'color1')?.hex || '#7b8afe';
  const color2 = colors.find(color => color.name === 'color2')?.hex || '#534eef';

  const handleConfirm = () => {
    onConfirm(dontRemindAgain);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="tutorial-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ '--color1': color1, '--color2': color2 }}
        >
          <motion.div
            className="tutorial-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button className="tutorial-modal-close-btn" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="tutorial-modal-body">
              <h2>Tutorial 📝</h2>
              <p>Watch this quick tutorial to get started.</p>

              <div className="video-container">
                <iframe
                  width="560"
                  height="315"
                  src="https://www.youtube.com/embed/U8emXhW4YF4"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>

              <label className="dont-remind-checkbox">
                <input
                  type="checkbox"
                  checked={dontRemindAgain}
                  onChange={(e) => setDontRemindAgain(e.target.checked)}
                />
                Don't show this again
              </label>
              <div className="tutorial-modal-actions">
                <motion.button
                  onClick={handleConfirm}
                  className="tutorial-modal-btn got-it-btn text-black"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Got it!
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TutorialModal;