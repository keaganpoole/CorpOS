import React from 'react';
import { motion } from 'framer-motion';
import './StatusBar.css';

const StatusBar = ({ isExpanded }) => {
  return (
    <div className="status-bar">
      <motion.div
        className="status-bar-indicator"
        animate={{
          height: isExpanded ? '100%' : '0%',
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
};

export default StatusBar;
