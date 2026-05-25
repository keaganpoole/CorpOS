
import React from 'react';
import './SubMenu.css';

const SubMenu = () => {
  return (
    <div className="submenu">
      <a href="#" className="submenu-item">
        <span className="icon">➕</span>
        <span className="label">Create</span>
      </a>
      <a href="#" className="submenu-item">
        <span className="icon">⚙️</span>
        <span className="label">Settings</span>
      </a>
      <a href="#" className="submenu-item">
        <span className="icon">📊</span>
        <span className="label">Reports</span>
      </a>
    </div>
  );
};

export default SubMenu;
