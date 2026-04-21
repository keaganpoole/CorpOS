// src/components/dashboard/MainPanel.jsx
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain } from '@fortawesome/free-solid-svg-icons';
import '../../styles/MainPanel.css';

const MainPanel = ({ setCurrentView }) => {
  return (
    <div className="main-panel">
      <div className="main-panel-nav">
        
      </div>
      <div className="main-panel-actions">
        <Link to="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Plans</Link>
        <Link to="/dashboard/settings" className="text-sm text-gray-400 hover:text-white transition-colors">Account</Link>
      </div>
    </div>
  );
};

export default MainPanel;