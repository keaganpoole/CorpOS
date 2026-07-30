// src/components/modals/SwiperIntroModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faHandPointRight, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import colors from '../../../color';
import './SwiperIntroModal.css';

const SwiperIntroModal = ({ isOpen, onClose, onConfirm }) => {
  const [dontRemindAgain, setDontRemindAgain] = useState(false);
  const color1 = colors.find(color => color.name === 'color1')?.hex || '#7b8afe';
  const color2 = colors.find(color => color.name === 'color2')?.hex || '#534eef';

  const isDesktop = window.innerWidth > 1024; // Adjusted breakpoint for desktop

  const handleConfirm = () => {
    onConfirm(dontRemindAgain);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && !isDesktop && (
        <motion.div
          className="swiper-intro-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ '--color1': color1, '--color2': color2 }}
        >
          <motion.div
            className="swiper-intro-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button className="swiper-intro-modal-close-btn" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="swiper-intro-modal-body">
              <h2>Quick Navigation</h2>
              <p>Swipe left or right to switch between dashboard pages.</p>

              <div className="swiper-animation-container">
                <motion.div
                  className="swiper-animation-hand"
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: [ -50, 50, -50 ], opacity: [0, 1, 1, 1, 0] }}
                  transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                >
                  <FontAwesomeIcon icon={faHandPointRight} />
                </motion.div>
                <div className="swiper-animation-arrows">
                  <FontAwesomeIcon icon={faChevronLeft} className="swiper-arrow-left" />
                  <FontAwesomeIcon icon={faChevronRight} className="swiper-arrow-right" />
                </div>
              </div>

              <label className="dont-remind-checkbox">
                <input
                  type="checkbox"
                  checked={dontRemindAgain}
                  onChange={(e) => setDontRemindAgain(e.target.checked)}
                />
                Don't show this again
              </label>
              <div className="swiper-intro-modal-actions">
                <motion.button
                  onClick={handleConfirm}
                  className="swiper-intro-modal-btn got-it-btn text-black"
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

export default SwiperIntroModal; 
