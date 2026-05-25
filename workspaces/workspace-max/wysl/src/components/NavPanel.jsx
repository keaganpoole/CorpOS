// src/components/dashboard/NavPanel.jsx

import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTableCells, faBolt, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

const navItems = [
  { path: 'new', icon: faPlus, text: 'Create Lead' },
  { path: 'leads', icon: faTableCells, text: 'Leads' },
  { path: 'campaign-builder', icon: faBolt, text: 'Campaign Builder' },
];

const navVariants = {
  collapsed: { width: 80 },
  expanded: { width: 240 },
};

const NavPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      animate={isExpanded ? "expanded" : "collapsed"}
      variants={navVariants}
      className="nav-panel"
      onHoverStart={() => setIsExpanded(true)}
      onHoverEnd={() => setIsExpanded(false)}
    >
      <div className="nav-logo-container">
        <Link to="/">
          <div className="nav-logo text-base font-black tracking-tighter text-white mb-6">
            W
          </div>
        </Link>
      </div>

      <div className="nav-items-container">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path === 'new' ? '/dashboard/leads/new' : `/dashboard/${item.path}`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            // For the "Leads" link, we want it active for both the grid and builder
            end={item.path !== 'leads'}
          >
            <FontAwesomeIcon icon={item.icon} className="nav-item-icon" />
            <span className="nav-item-text">{item.text}</span>
          </NavLink>
        ))}
      </div>
    </motion.div>
  );
};

export default NavPanel;