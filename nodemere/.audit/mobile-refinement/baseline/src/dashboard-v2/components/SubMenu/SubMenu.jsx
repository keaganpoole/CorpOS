import React from 'react';

const dockItems = [
  { icon: '+', label: 'Create' },
  { icon: '⚙', label: 'Settings' },
  { icon: '📊', label: 'Reports' },
];

export default function SubMenu() {
  return (
    <div className="sub-menu-dock">
      {dockItems.map((item) => (
        <div key={item.label} className="sub-menu-item">
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
