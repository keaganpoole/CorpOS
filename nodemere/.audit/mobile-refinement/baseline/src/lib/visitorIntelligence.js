export const HOMEPAGE_SECTIONS = [
  { id: 'hero', label: 'Hero' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'people-crm', label: 'People & CRM' },
  { id: 'live-monitoring', label: 'Live Monitoring' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'security', label: 'Security' },
];

export const EMPTY_COMMAND_CENTER = {
  generated_at: null,
  overview: {},
  homepage: { sections: [], clicks: [], flow: [] },
  deep: {
    acquisition: { sources: [], campaigns: [], referrers: [] },
    behavior: { pages: [] },
    engagement: {}, conversion: {},
    devices: { devices: [], browsers: [] },
    geography: { available: false, items: [], message: 'Location data is not collected by the current privacy-safe instrumentation.' },
  },
  comparison: {}, filters: { sources: [], campaigns: [] },
};

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function formatCount(value) {
  return new Intl.NumberFormat(undefined, { notation: number(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(number(value));
}

export function formatPercent(value) {
  return `${number(value).toFixed(number(value) >= 10 ? 0 : 1)}%`;
}

export function formatDuration(value) {
  const seconds = Math.max(0, Math.round(number(value)));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function attentionTone(state) {
  return ({ Hot: 'hot', Warm: 'warm', Cool: 'cool', Dormant: 'dormant' })[state] || 'dormant';
}

export function createVisitorInsights(snapshot) {
  const sections = snapshot?.homepage?.sections || [];
  const sources = snapshot?.deep?.acquisition?.sources || [];
  const comparison = snapshot?.comparison || {};
  const insights = [];
  const reliable = sections.filter((section) => number(section.unique_visitors) >= 5);

  const strongest = reliable.reduce((best, item) => number(item.attention_score) > number(best?.attention_score) ? item : best, null);
  if (strongest && number(strongest.attention_score) >= 45) {
    insights.push({ kind: 'attention', title: `${strongest.label} holds attention`, body: `${formatPercent(strongest.reach_rate)} reach and ${formatDuration(strongest.average_visible_seconds)} average visible time make it the strongest homepage section.`, section: strongest.id });
  }

  const dropoff = reliable.filter((item) => number(item.attention_samples) !== 0 || number(item.dropoffs) !== 0)
    .reduce((worst, item) => number(item.dropoff_rate) > number(worst?.dropoff_rate) ? item : worst, null);
  if (dropoff && number(dropoff.dropoff_rate) >= 35) {
    insights.push({ kind: 'dropoff', title: `${dropoff.label} is the clearest exit point`, body: `${formatPercent(dropoff.dropoff_rate)} of measured section visits stopped before the next homepage section.`, section: dropoff.id });
  }

  const totalVisitors = number(snapshot?.overview?.visitors);
  const topSource = sources[0];
  if (topSource && totalVisitors >= 10 && number(topSource.visitors) >= 5) {
    insights.push({ kind: 'source', title: `${topSource.source} leads acquisition`, body: `${formatCount(topSource.visitors)} visitors came through this source in the selected period.` });
  }

  const fresh = comparison.new;
  const returning = comparison.returning;
  if (number(fresh?.visitors) >= 5 && number(returning?.visitors) >= 5) {
    const gap = number(returning.avg_engaged_seconds) - number(fresh.avg_engaged_seconds);
    if (Math.abs(gap) >= 5) {
      const leader = gap > 0 ? 'Returning visitors' : 'New visitors';
      insights.push({ kind: 'comparison', title: `${leader} engage longer`, body: `The difference is ${formatDuration(Math.abs(gap))} per session for the selected period.` });
    }
  }

  return insights.slice(0, 4);
}

export function mergeRecentActivity(current, incoming, maximum = 30) {
  const seen = new Set();
  return [...(incoming || []), ...(current || [])].filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, maximum);
}
