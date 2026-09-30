import React from 'react';

// The same live billing snapshot as the desktop account menu. No estimates are
// calculated client-side beyond converting the server's seconds/cents to units.
export default function MobileUsageSummary({ usage, onUpgrade }) {
  if (!usage) return <p role="status">Usage is loading…</p>;
  const used = Number(usage.current_cycle_used_seconds || 0) / 60;
  const included = Number(usage.current_cycle_included_seconds || 0) / 60;
  const overage = Math.max(Number(usage.billable_overage_minutes || 0), Number(usage.current_cycle_overage_seconds ?? usage.overage_seconds ?? 0) / 60);
  const minutes = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
  const percent = included > 0 ? Math.round(used / included * 100) : null;
  return <section className="mobile-usage-summary" aria-label="Call usage">
    <header><h3>Call usage</h3><button type="button" onClick={onUpgrade}>Upgrade</button></header>
    <div className="mobile-usage-total"><span>{minutes(used)} <small>min used</small></span><span>{percent == null ? 'No included allowance' : `${percent}%`}</span></div>
    {percent != null && <div className="mobile-usage-meter"><span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>}
    <dl><div><dt>Included minutes</dt><dd>{minutes(included)}</dd></div>
      {usage.overage_enabled && <><div><dt>Overage minutes</dt><dd>{minutes(overage)}</dd></div><div><dt>Estimated overage</dt><dd>{money(usage.estimated_overage_amount_cents)}</dd></div><div><dt>Overage rate</dt><dd>{money(usage.overage_price_per_minute_cents ?? 30)}/min</dd></div>{Number(usage.overage_cap_cents) > 0 && <div><dt>Overage limit</dt><dd>{money(usage.overage_cap_cents)}</dd></div>}</>}
    </dl>
    {usage.alert_level === 'warning' && <p role="status">You’re nearing your included minute limit.</p>}
    {usage.alert_level === 'limit' && !usage.overage_enabled && <p role="status">Included minutes are exhausted. Upgrade to continue calls.</p>}
    {usage.alert_level === 'overage' && usage.overage_enabled && <p role="status">Estimated overage will be added to your next Stripe invoice.</p>}
    {usage.overage_limit_reached && <p role="status">New calls are paused until billing is updated.</p>}
  </section>;
}
