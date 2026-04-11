import React from 'react';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import SubMenu from '../SubMenu/SubMenu';

export default function Canvas({ page }) {
  if (!page) return null;
  const PageDetail = page.component;
  const isScenarioBuilder = page.id === 'scenario-builder';

  return (
    <div className={`canvas ${isScenarioBuilder ? 'canvas-builder-mode' : ''}`}>
      <ProfileMenu />
      {isScenarioBuilder ? (
        <div className="scenario-builder-wrapper">
          <PageDetail accent={page.accent} />
        </div>
      ) : (
        <div className="canvas-content">
          <div className="canvas-hero">
            <p className="hero-label">{page.tagline}</p>
            <h1>{page.label}</h1>
            <p>{page.description}</p>
            <div className="hero-badges">
              {page.badges.map((badge) => (
                <span key={badge} className="hero-badge">
                  {badge}
                </span>
              ))}
            </div>
            <div className="hero-spotlight">
              <span>{page.subMetricLabel}</span>
              <strong>{page.subMetricValue}</strong>
            </div>
          </div>
          <div className="page-body">
            {page.stats.map((stat) => (
              <article key={stat.label} className="page-card">
                <h3>{stat.label}</h3>
                <div className="value" style={{ color: stat.accent || '#fff' }}>
                  {stat.value}
                </div>
                <span>{stat.detail}</span>
              </article>
            ))}
          </div>
          {PageDetail ? (
            <div className="page-extra">
              <PageDetail accent={page.accent} />
            </div>
          ) : null}
        </div>
      )}
      {!isScenarioBuilder && <SubMenu />}
    </div>
  );
}
