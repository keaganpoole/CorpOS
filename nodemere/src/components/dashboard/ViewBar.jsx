import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ViewToggle from './ViewToggle';
import '../../styles/ViewBar.css';

const ViewBar = ({ view, setView }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSetView = (newView) => {
    if (view !== newView) {
      setIsAnimating(true);
      setView(newView);
      // The CSS animation is 800ms, so we reset after that
      setTimeout(() => setIsAnimating(false), 800);
    }
  };

  return (
    <div className={`view-bar-container ${isAnimating ? 'liquid-fill-active' : ''}`}>
      <motion.div className="aurora-background" />
      <div className="view-bar-content">
        <div className="decorative-element left" />
        <ViewToggle view={view} setView={handleSetView} />
        <div className="decorative-element right" />
      </div>
    </div>
  );
};

export default ViewBar;
