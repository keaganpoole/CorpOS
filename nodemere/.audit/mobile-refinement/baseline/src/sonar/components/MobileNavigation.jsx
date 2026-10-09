import React, { useState } from 'react';
import { Users, CalendarFold, BookUser, BarChart3, Ellipsis, Phone, Settings, Webhook, CircleQuestionMark, ChevronRight, History, MessagesSquare } from 'lucide-react';
import MobileSheet from './MobileSheet';

const destinations = [
  { id: 'receptionists', label: 'Team', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: CalendarFold },
  { id: 'pipeline', label: 'People', icon: BookUser },
  { id: 'live-monitoring', label: 'Reports', icon: BarChart3 },
];

export default function MobileNavigation({ currentRoute, onNavigate, onReportProblem }) {
  const [open, setOpen] = useState(false);
  const go = (route) => { setOpen(false); onNavigate(route); };
  const moreActive = open || !destinations.some((item) => item.id === currentRoute) && currentRoute !== 'stats';
  return <>
    <nav className="dashboard-mobile-nav" aria-label="Dashboard navigation">
      {destinations.map(({ id, label, icon: Icon }) => {
        const active = !open && (currentRoute === id || id === 'live-monitoring' && currentRoute === 'stats');
        return <button key={id} type="button" onClick={() => go(id)} aria-current={active ? 'page' : undefined}><Icon size={21} /><span>{label}</span></button>;
      })}
      <button type="button" aria-label="More navigation" aria-expanded={open} aria-current={moreActive ? 'page' : undefined} onClick={() => setOpen(!open)}><Ellipsis size={23} /><span>More</span></button>
    </nav>
    {open && <MobileSheet title="More" onClose={() => setOpen(false)} className="dashboard-more-sheet">
      {[
        { label: 'Call Logs', icon: Phone, action: () => go('call-logs') },
        { label: 'Settings', icon: Settings, action: () => go('settings') },
        { label: 'Scenarios', icon: Webhook, action: () => go('scenarios') },
        { label: 'Nest history', icon: History, action: () => { setOpen(false); document.querySelector('button[aria-label="Open Nest activity history"]')?.click(); } },
        { label: 'Voice conversations', icon: MessagesSquare, action: () => { setOpen(false); document.querySelector('button[aria-label="Open voice conversations"]')?.click(); } },
        { label: 'Report a problem', icon: CircleQuestionMark, action: () => { setOpen(false); onReportProblem(); } },
      ].map(({ label, icon: Icon, action }) => <button className="dashboard-more-link" type="button" key={label} onClick={action}><Icon size={21} /><span>{label}</span><ChevronRight size={18} /></button>)}
    </MobileSheet>}
  </>;
}
