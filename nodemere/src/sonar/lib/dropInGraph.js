export const NODE_WIDTH = 212;
export const NODE_HEIGHT = 62;
export const LEVEL_GAP = 146;
export const STATUSES = ['pending', 'confirmed', 'completed', 'missed', 'cancelled'];
export const ordered = (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id.localeCompare(b.id);
export const siblings = (items, parentId) => items.filter(x => (x.parent_id || null) === (parentId || null)).sort(ordered);

export function descendants(items, id) {
  const found = new Set(), queue = [id];
  const children = new Map();
  for (const item of items) {
    if (!children.has(item.parent_id)) children.set(item.parent_id, []);
    children.get(item.parent_id).push(item.id);
  }
  while (queue.length) for (const child of children.get(queue.pop()) || []) {
    if (child !== id && !found.has(child)) { found.add(child); queue.push(child); }
  }
  return found;
}

export function ancestry(items, id) {
  const byId = new Map(items.map(x => [x.id, x])), path = [], seen = new Set([id]);
  let parent = byId.get(id)?.parent_id;
  while (parent && byId.has(parent) && !seen.has(parent)) {
    seen.add(parent); path.unshift(parent); parent = byId.get(parent).parent_id;
  }
  return path;
}

// Iterative layout: hierarchy depth is not limited by the JS call stack.
export function layoutGraph(items, force = false) {
  const children = new Map(), roots = [];
  const ids = new Set(items.map(x => x.id));
  for (const item of [...items].sort(ordered)) {
    if (!item.parent_id || !ids.has(item.parent_id)) roots.push(item);
    else { if (!children.has(item.parent_id)) children.set(item.parent_id, []); children.get(item.parent_id).push(item); }
  }
  const traversal = [], queue = roots.map(item => ({ item, depth: 0 })), seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]; if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id); traversal.push(entry);
    for (const child of children.get(entry.item.id) || []) queue.push({ item: child, depth: entry.depth + 1 });
  }
  const positions = new Map(), stride = NODE_WIDTH + 36, rightEdge = new Map();
  roots.forEach((item, i) => positions.set(item.id, { x: i * stride * 2, y: 0 }));
  for (const { item, depth } of traversal) {
    const group = children.get(item.id) || [];
    if (!group.length) continue;
    // Compact by row rather than reserving every descendant's width at every
    // level. Grandchildren can use the space beneath their aunts and uncles.
    const start = Math.max(positions.get(item.id).x - (group.length - 1) * stride / 2, rightEdge.get(depth + 1) ?? -Infinity);
    group.forEach((child, i) => positions.set(child.id, { x: start + i * stride, y: (depth + 1) * LEVEL_GAP }));
    rightEdge.set(depth + 1, start + group.length * stride);
  }
  return items.map(item => ({ ...item,
    canvas_x: !force && Number.isFinite(item.canvas_x) ? item.canvas_x : positions.get(item.id)?.x || 0,
    canvas_y: !force && Number.isFinite(item.canvas_y) ? item.canvas_y : positions.get(item.id)?.y || 0,
  }));
}

export function visibleGraph(items, collapsed) {
  const hidden = new Set();
  for (const id of collapsed) for (const child of descendants(items, id)) hidden.add(child);
  return items.filter(x => !hidden.has(x.id));
}

export function previewGraph(items) {
  const active = new Map(items.filter(x => x.is_active).map(x => [x.id, x]));
  const parents = new Set(items.map(x => x.parent_id).filter(Boolean));
  return items.filter(x => x.is_active && ancestry(items, x.id).every(id => active.has(id))).map(x => ({ ...x, has_children: parents.has(x.id) })).sort(ordered);
}

export function removeNode(items, id) {
  const node = items.find(x => x.id === id);
  return items.filter(x => x.id !== id).map(x => x.parent_id === id ? { ...x, parent_id: node?.parent_id || null } : x);
}

export function orderByPosition(items, status, parentId) {
  const group = items.filter(x => x.available_on_status === status && (x.parent_id || null) === (parentId || null))
    .sort((a,b) => a.canvas_x - b.canvas_x || a.canvas_y - b.canvas_y || ordered(a,b));
  const order = new Map(group.map((x,index) => [x.id,index]));
  return items.map(x => order.has(x.id) ? { ...x, sort_order: order.get(x.id) } : x);
}

export function freePosition(items, parentId = null, preferred) {
  const parent = items.find(x => x.id === parentId);
  let x = preferred?.x ?? (parent ? parent.canvas_x : Math.max(-284, ...items.map(x => x.canvas_x + NODE_WIDTH)) + 72);
  let y = preferred?.y ?? (parent ? parent.canvas_y + LEVEL_GAP : 0);
  x = Math.round(x / 16) * 16; y = Math.round(y / 16) * 16;
  while (items.some(item => Math.abs(item.canvas_x - x) < NODE_WIDTH + 24 && Math.abs(item.canvas_y - y) < NODE_HEIGHT + 32)) x += NODE_WIDTH + 36;
  return { x, y };
}

export function validateGraph(items) {
  const byId = new Map(items.map(x => [x.id, x]));
  if (byId.size !== items.length) return 'Duplicate drop-in identifiers. Reload before saving.';
  for (const node of items) {
    if (!node.name.trim() || !node.purpose.trim() || !node.prompt.trim()) return `Complete the name, purpose and instructions for “${node.name || 'New drop-in'}”.`;
    if (node.name.length > 64 || node.purpose.length > 30 || node.prompt.length > 6000) return 'One of your fields exceeds its character limit.';
    if (!STATUSES.includes(node.available_on_status)) return 'Choose a valid appointment status.';
    if (node.parent_id && (!byId.has(node.parent_id) || byId.get(node.parent_id).available_on_status !== node.available_on_status)) return 'Parents and children must belong to the same status.';
    const seen = new Set([node.id]); let id = node.parent_id;
    while (id) { if (seen.has(id)) return 'A drop-in cannot be nested inside itself.'; seen.add(id); id = byId.get(id)?.parent_id; }
  }
  return '';
}

export function builderPayload(items, baseline) {
  const fields = ['id', 'name', 'button_label', 'purpose', 'prompt', 'is_active', 'available_on_status', 'parent_id', 'sort_order', 'canvas_x', 'canvas_y'];
  return {
    items: items.map(item => Object.fromEntries(fields.map(key => [key, item[key] ?? (key === 'parent_id' ? null : 0)]))),
    baseline: baseline.map(item => ({ id: item.id, updated_at: item.updated_at })),
  };
}
