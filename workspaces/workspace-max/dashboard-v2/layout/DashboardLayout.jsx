import React, { useMemo, useState } from 'react';
import Menu from '../components/Menu/Menu';
import StatusBar from '../components/StatusBar/StatusBar';
import Canvas from '../components/Canvas/Canvas';
import NestPage from '../pages/Nest/Nest';
import ScenariosPage from '../pages/Scenarios/Scenarios';
import ScenarioBuilderPage from '../pages/ScenarioBuilder/ScenarioBuilder';
import CRMPage from '../pages/CRM/CRM';
import '../styles/dashboard-v2.css';

const NestIcon = (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-5 9 5v6l-9 5-9-5z" />
    <path d="M12 4.5v15" />
    <path d="M6.5 11h11" />
  </svg>
);

const ScenariosIcon = (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="6.5" width="17" height="11" rx="3" />
    <path d="M9 6.5v11" />
    <path d="M3.5 12.5h17" />
  </svg>
);

const BuilderIcon = (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17l7-12 7 12" />
    <path d="M8 14h8" />
    <path d="M12 9.5v10.5" />
  </svg>
);

const CRMIcon = (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="8" r="2" />
    <circle cx="18" cy="8" r="2" />
    <circle cx="6" cy="16" r="2" />
    <circle cx="18" cy="16" r="2" />
    <path d="M8 8h8M8 16h8" />
    <path d="M12 10v4" />
  </svg>
);

const pageDefinitions = [
  {
    id: 'nest',
    label: 'Nest',
    tagline: 'Command Nexus',
    description: 'A luminous launchpad where every signal is mapped, measured, and mastered.',
    badges: ['Live', 'Synced'],
    stats: [
      { label: 'Active Sessions', value: '14', detail: 'Auto-scheduled refresh in 23 min', accent: '#32f0d9' },
      { label: 'Secure Threads', value: '187', detail: '3.2s average validation', accent: '#32f0d9' },
      { label: 'Resilience', value: '99.4%', detail: 'Uptime this cycle', accent: '#a855f7' },
    ],
    subMetricLabel: 'Signal Integrity',
    subMetricValue: '98.2%',
    accent: '#32f0d9',
    component: NestPage,
    icon: NestIcon,
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    tagline: 'Live Labs',
    description: 'Momentum-based storyboards stitched with predictive color and pace.',
    badges: ['Adaptive', 'Cinematic'],
    stats: [
      { label: 'Live Scenarios', value: '08', detail: 'Streams adjusting adaptive inputs', accent: '#a855f7' },
      { label: 'Outcomes Watched', value: '312', detail: 'Close-loop clarity across every view', accent: '#a855f7' },
      { label: 'Confidence', value: '94%', detail: 'Stays elevated through the run', accent: '#ff6ec7' },
    ],
    subMetricLabel: 'Momentum Focus',
    subMetricValue: '72%',
    accent: '#a855f7',
    component: ScenariosPage,
    icon: ScenariosIcon,
  },
  {
    id: 'scenario-builder',
    label: 'Scenario Builder',
    tagline: 'Creative Lab',
    description: 'Drag, connect, and render audacious narratives in real time.',
    badges: ['Blueprint', 'Live Edit'],
    stats: [
      { label: 'Blocks', value: '26', detail: 'Reusable templates ready for launch', accent: '#ff6ec7' },
      { label: 'Deploy Ready', value: '4', detail: 'Finite lanes awaiting approval', accent: '#ff6ec7' },
      { label: 'Render Time', value: '0.3s', detail: 'Preview latency to keep pace', accent: '#32f0d9' },
    ],
    subMetricLabel: 'Blueprints Primed',
    subMetricValue: '12',
    accent: '#ff6ec7',
    component: ScenarioBuilderPage,
    icon: BuilderIcon,
  },
  {
    id: 'crm',
    label: 'CRM',
    tagline: 'Signal Web',
    description: 'Every relationship glows with context and cinematic storytelling.',
    badges: ['Guided', 'Intent'],
    stats: [
      { label: 'Signal Health', value: '97%', detail: 'Synced across every node', accent: '#32f0d9' },
      { label: 'Engaged Contacts', value: '320', detail: 'Touchpoints flowing', accent: '#32f0d9' },
      { label: 'Guided Journeys', value: '12', detail: 'Live sequences ready to deploy', accent: '#a855f7' },
    ],
    subMetricLabel: 'Intent Alignment',
    subMetricValue: '83%',
    accent: '#32f0d9',
    component: CRMPage,
    icon: CRMIcon,
  },
];

export default function DashboardLayout() {
  const [activePageId, setActivePageId] = useState('scenario-builder');
  const activePage = useMemo(
    () => pageDefinitions.find((page) => page.id === activePageId) ?? pageDefinitions[0],
    [activePageId],
  );

  return (
    <div className="dashboard-v2-shell">
      <div className="dashboard-grid">
        <Menu
          pages={pageDefinitions}
          activePage={activePage.id}
          onPageChange={(id) => setActivePageId(id)}
        />
        <StatusBar isActive />
        <Canvas page={activePage} />
      </div>
    </div>
  );
}
