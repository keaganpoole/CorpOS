import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'nodemere-cookie-notice-v1';

const CookieNotice = () => {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'acknowledged';
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  const acknowledge = () => {
    try { localStorage.setItem(STORAGE_KEY, 'acknowledged'); } catch { /* no-op */ }
    setVisible(false);
  };

  return (
    <section className="cookie-notice" aria-label="Cookie notice">
      <p>We use essential browser storage and limited first-party preference cookies. <Link to="/cookie-notice">Cookie Notice</Link></p>
      <button type="button" onClick={acknowledge}>Got it</button>
    </section>
  );
};

export default CookieNotice;
