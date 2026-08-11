// src/components/DashboardLoadingScreen.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import colors from '../../color'; // Adjust path as needed
import './DashboardLoadingScreen.css';

const loadingTexts = ["receptionists", "calls", "workflows", "contacts", "settings"];

const DashboardLoadingScreen = ({ isLoading }) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [showText, setShowText] = useState(true);

  const accentColor1 = colors.find(color => color.name === 'accent_color1').hex;
  const accentColor2 = colors.find(color => color.name === 'accent_color2').hex;
 
  useEffect(() => {
    if (!isLoading) return;

    const textInterval = setInterval(() => {
      setShowText(false); // Start fade out
      setTimeout(() => {
        setCurrentTextIndex((prevIndex) => (prevIndex + 1) % loadingTexts.length);
        setShowText(true); // Start fade in
      }, 500); // Half a second for fade out
    }, 2000); // Change text every 2 seconds

    return () => clearInterval(textInterval);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="dashboard-loading-screen-backdrop"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.5 } }}
          style={{ '--accent-color1': accentColor1, '--accent-color2': accentColor2 }}
        >
          <motion.div
            className="dashboard-loading-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src="https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png"
              alt="Nodemere logo"
              className="dashboard-loading-logo"
            />
            <div className="loader">
              Loading
              <div className="words">
                {loadingTexts.map((text, index) => (
                  <span key={index} className="word">{text}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DashboardLoadingScreen;
