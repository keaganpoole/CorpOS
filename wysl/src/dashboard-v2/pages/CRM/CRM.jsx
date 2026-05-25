import React from 'react';

export default function CRMPage({ accent = '#32f0d9' }) {
  return (
    <>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Signal Health</span>
        <strong>97% synced</strong>
        <p>Client timelines stay luminous with instant context.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Engagement</span>
        <strong>+320 touchpoints</strong>
        <p>Micro-actions ripple through your CRM so nothing feels stale.</p>
      </div>
      <div className="page-extra-card" style={{ borderColor: accent }}>
        <span>Guides</span>
        <strong>12 live sequences</strong>
        <p>Every workflow is prepped and ready for holographic review.</p>
      </div>
    </>
  );
}
