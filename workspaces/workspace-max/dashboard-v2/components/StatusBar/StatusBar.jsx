import React from 'react';

export default function StatusBar({ isActive }) {
  return <div className={`status-bar ${isActive ? 'status-bar-active' : ''}`} />;
}
