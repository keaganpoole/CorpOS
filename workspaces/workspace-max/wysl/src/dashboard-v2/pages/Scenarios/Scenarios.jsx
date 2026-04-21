import React from 'react';

export default function ScenariosPage({ accent = '#a855f7' }) {
  return (
    <>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Scenario Queue</span>
        <strong>08 active</strong>
        <p>New simulations queue with adaptive pacing based on current load.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Edge Alerts</span>
        <strong>03 critical</strong>
        <p>Every deviation animates directly into your focus layer for action.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Trigger Map</span>
        <strong>92% on target</strong>
        <p>Momentum tracking keeps scenario tails aligned with projections.</p>
      </div>
    </>
  );
}
