import React, { useState } from 'react';
import { Users, CalendarFold, BookUser, BarChart3, Ellipsis, Phone, Settings, Webhook, CircleQuestionMark, ChevronRight, History, MessagesSquare, Gauge } from 'lucide-react';
import MobileSheet from './MobileSheet';

const destinations = [
  { id: 'receptionists', label: 'Team', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: CalendarFold },
  { id: 'pipeline', label: 'People', icon: BookUser },
  { id: 'live-monitoring', label: 'Reports', icon: BarChart3 },
  { id: 'call-logs', label: 'Calls', icon: Phone },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function MobileNavigation({ currentRoute, onNavigate, onReportProblem, profile, usage, business, onUsage, onAccount }) {
  const [open, setOpen] = useState(false);
  const go = (route) => { setOpen(false); onNavigate(route); };
  const accountSection = (section, action) => { sessionStorage.setItem('sonar-settings-section', section); setOpen(false); action(); };
  const moreActive = open || !destinations.some((item) => item.id === currentRoute) && currentRoute !== 'stats';
  const name = business?.name || usage?.name || profile?.business_name || profile?.name || 'Your business';
  const avatar = business?.avatar || usage?.avatar;
  const included = Number(usage?.current_cycle_included_seconds || 0);
  const used = Number(usage?.current_cycle_used_seconds || 0);
  const percent = included > 0 ? Math.max(0, Math.round(used / included * 100)) : null;
  return <>
    <nav className="dashboard-mobile-nav" aria-label="Dashboard navigation">
      {destinations.map(({ id, label, icon: Icon }) => {
        const active = !open && (currentRoute === id || id === 'live-monitoring' && currentRoute === 'stats');
        return <button key={id} type="button" onClick={() => go(id)} aria-current={active ? 'page' : undefined}><Icon size={21} /><span>{label}</span></button>;
      })}
      <button type="button" aria-label="More navigation" aria-expanded={open} aria-current={moreActive ? 'page' : undefined} onClick={() => setOpen(!open)}><Ellipsis size={23} /><span>More</span></button>
    </nav>
    {open && <MobileSheet title="More" minimalHeader onClose={() => setOpen(false)} className="dashboard-more-sheet">
      <div className="mobile-account-summary">
        <button type="button" aria-label="Account settings" onClick={() => accountSection('account', onAccount)}>
          {avatar ? <img src={avatar} alt="" /> : <span className="mobile-account-initial">{name.charAt(0)}</span>}
          <span>{name}</span>
        </button>
        <button type="button" aria-label="View call usage" onClick={() => accountSection('billing', onUsage)}>
          <span>{percent == null ? `${Math.ceil(used / 60)} min used` : `${percent}% used`}</span>
          {percent != null && <span className="mobile-usage-track"><i style={{ width: `${Math.min(100, percent)}%` }} /></span>}
        </button>
      </div>
      {[
        { label: 'Call Logs', icon: Phone, action: () => go('call-logs') },
        { label: 'Usage & billing', icon: Gauge, action: () => accountSection('billing', onUsage) },
        { label: 'Settings', icon: Settings, action: () => go('settings') },
        { label: 'Scenarios', icon: Webhook, action: () => go('scenarios') },
        { label: 'Nest history', icon: History, action: () => { setOpen(false); document.querySelector('button[aria-label="Open Nest activity history"]')?.click(); } },
        { label: 'Voice conversations', icon: MessagesSquare, action: () => { setOpen(false); document.querySelector('button[aria-label="Open voice conversations"]')?.click(); } },
        { label: 'Report a problem', icon: CircleQuestionMark, action: () => { setOpen(false); onReportProblem(); } },
      ].map(({ label, icon: Icon, action }) => <button className="dashboard-more-link" type="button" key={label} onClick={action}><Icon size={21} /><span>{label}</span><ChevronRight size={18} /></button>)}
    </MobileSheet>}
  </>;
}
