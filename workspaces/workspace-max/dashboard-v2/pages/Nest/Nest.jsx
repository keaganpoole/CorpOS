import React from 'react';

export default function NestPage({ accent = '#32f0d9' }) {
  return (
    <>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Command Pulse</span>
        <strong>92% Efficiency</strong>
        <p>Signal integrity remains at peak with automated checks every 3 seconds.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Flow Continuity</span>
        <strong>+18 secure links</strong>
        <p>Nested guards keep every pathway encrypted and traceable.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Focus Layer</span>
        <strong>42 tasks</strong>
        <p>Prioritized tasks are visually pinned to the top of the command grid.</p>
      </div>
    </>
  );
}
