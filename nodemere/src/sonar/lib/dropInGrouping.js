import { STATUS_OPTIONS } from './appointmentSchema.js';

const statusOrder = new Map(STATUS_OPTIONS.map((option, index) => [option.value.toLowerCase(), index]));

export function groupDropIns(items) {
  const groups = [];
  const bySignature = new Map();
  const ordered = [...items].sort((a, b) =>
    (statusOrder.get(a.available_on_status) ?? 99) - (statusOrder.get(b.available_on_status) ?? 99)
    || a.sort_order - b.sort_order
    || String(a.id).localeCompare(String(b.id)));

  for (const item of ordered) {
    const signature = JSON.stringify([
      item.name.trim().toLowerCase(), item.purpose.trim().toLowerCase(), item.prompt.trim(),
    ]);
    const matches = bySignature.get(signature) || [];
    let group = matches.find(candidate => !candidate.byStatus[item.available_on_status]);
    if (!group) {
      group = { id: item.id, signature, primary: item, rows: [], byStatus: {} };
      matches.push(group);
      bySignature.set(signature, matches);
      groups.push(group);
    }
    group.rows.push(item);
    group.byStatus[item.available_on_status] = item;
  }
  return groups;
}

export function stabilizeDropInGroups(groups, previous = []) {
  const unmatched = [...previous];
  let nextPosition = Math.max(-1, ...previous.map(group => group.position)) + 1;
  return groups.map(group => {
    let matchIndex = unmatched.findIndex(old => group.rows.some(row => old.rows.some(existing => existing.id === row.id)));
    if (matchIndex < 0) matchIndex = unmatched.findIndex(old => old.signature === group.signature);
    const match = matchIndex >= 0 ? unmatched.splice(matchIndex, 1)[0] : null;
    return {
      ...group,
      id: match?.id ?? group.id,
      position: match?.position ?? nextPosition++,
      firstCreatedAt: match?.firstCreatedAt ?? group.primary.created_at,
      firstUsageCount: match?.firstUsageCount ?? group.primary.usage_count ?? 0,
    };
  });
}
