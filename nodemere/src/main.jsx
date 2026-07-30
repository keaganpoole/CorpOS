//main.jsx
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import colors from '../color.js';

colors.forEach(color => {
  document.documentElement.style.setProperty(`--${color.name}`, color.hex);
  if (color.name.startsWith('accent_color')) {
    const hex = color.hex.startsWith('#') ? color.hex.slice(1) : color.hex;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty(`--${color.name}-rgb`, `${r}, ${g}, ${b}`);
  }
});

// Function to set the viewport height custom property
const setAppHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

// Initial set and event listener
setAppHeight();
window.addEventListener('resize', setAppHeight);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)