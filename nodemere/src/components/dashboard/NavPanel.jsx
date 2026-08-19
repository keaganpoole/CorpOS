// src/components/dashboard/NavPanel.jsx
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faKey, faCommentDots, faCalendarDays, faCog, faClipboardList
} from '@fortawesome/free-solid-svg-icons';import '../../styles/NavPanel.css';

const mainNavItems = [
  { path: 'passwords', icon: faKey, text: 'Key Vault' },
  { path: 'phone-helper', icon: faCommentDots, text: 'Ask Breezy' },
];

const bottomNavItems = [
  { path: 'pricing', icon: faClipboardList, text: 'Plans', external: true }, // External link to /pricing
  { path: 'settings', icon: faCog, text: 'Settings' },
];

const navVariants = {
  collapsed: { width: 72 },
  expanded: { width: 220 },
};

const NavPanel = ({ isExpanded, setIsExpanded }) => {
  return (
    <motion.div
      animate={isExpanded ? "expanded" : "collapsed"}
      variants={navVariants}
      className={`nav-panel ${isExpanded ? 'expanded' : 'collapsed'}`}
      onHoverStart={() => setIsExpanded(true)}
      onHoverEnd={() => setIsExpanded(false)}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
    >
      <div className="nav-header">
        <img 
          src="https://d393ec8814550259215504977855f0b8.cdn.bubble.io/cdn-cgi/image/w=128,h=115,f=auto,dpr=0.75,fit=contain/f1751416721976x644012852837373400/lgooo.png" 
          alt="Logo" 
          className="nav-logo"
        />
      </div>

      <div className="nav-links flex-grow">
        {mainNavItems.map((item) => (
          item.external ? (
            <Link
              key={item.path}
              to={`/${item.path}`}
              className="nav-item"
            >
              <FontAwesomeIcon icon={item.icon} className="nav-item-icon" />
              <span className="nav-item-text">{item.text}</span>
            </Link>
          ) : (
            <NavLink
              key={item.path}
              to={`/dashboard/${item.path}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={item.icon} className="nav-item-icon" />
              <span className="nav-item-text">{item.text}</span>
            </NavLink>
          )
        ))}
      </div>

      <div className="nav-links-bottom">
        {bottomNavItems.map((item) => (
          item.external ? (
            <Link
              key={item.path}
              to={`/${item.path}`}
              className="nav-item"
            >
              <FontAwesomeIcon icon={item.icon} className="nav-item-icon" />
              <span className="nav-item-text">{item.text}</span>
            </Link>
          ) : (
            <NavLink
              key={item.path}
              to={`/dashboard/${item.path}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={item.icon} className="nav-item-icon" />
              <span className="nav-item-text">{item.text}</span>
            </NavLink>
          )
        ))}
      </div>
    </motion.div>
  );
};

export default NavPanel;
