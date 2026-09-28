export const TILE_WIDTH = 210;
export const TILE_GAP = 4;
export const MIN_GALLERY_ZOOM = 0.9;
const AVATAR_VIDEO_BASE = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/videos';
export function avatarVideoUrl(value) {
  if (!value) return '';
  const path = String(value).trim();
  if (/^https?:\/\//i.test(path)) return path;
  return `${AVATAR_VIDEO_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
const HEIGHTS = [190, 286, 224, 334];
const PERIOD = HEIGHTS.reduce((sum, height) => sum + height + TILE_GAP, 0);
export const wrap = (value, length) => ((value % length) + length) % length;

const identity = person => String(person.elevenlabs_voice_id || `${person.source || 'stock'}:${person.created_receptionist_id ?? person.custom_voice_id ?? person.id}`);
const hash = value => {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
};

// Deal each source across both column palettes, then interleave sources within
// each palette. Sorting by identity makes API ordering irrelevant.
export function galleryRosterOrder(receptionists, seed = '') {
  const unique = new Map();
  receptionists.forEach((person, index) => {
    const key = identity(person);
    if (!unique.has(key)) unique.set(key, { key, index, custom: Boolean(person.created_receptionist_id || person.custom_voice_id || ['created_receptionist', 'voice_clone', 'custom_voice'].includes(person.source)) });
  });
  const groups = [false, true].map(custom => [...unique.values()].filter(person => person.custom === custom)
    .sort((a, b) => hash(`${seed}:${a.key}`) - hash(`${seed}:${b.key}`) || a.key.localeCompare(b.key)));
  const palettes = [[], []];
  for (const group of groups) for (const person of group) {
    palettes[palettes[0].length <= palettes[1].length ? 0 : 1].push(person);
  }
  const mixed = palettes.map(palette => {
    const stock = palette.filter(person => !person.custom), custom = palette.filter(person => person.custom);
    const result = [], total = palette.length, customCount = custom.length;
    // Spread the smaller source group throughout the larger one.
    while (result.length < total) {
      const position = result.length;
      const takeCustom = Math.floor((position + 1) * customCount / total) > Math.floor(position * customCount / total);
      result.push((takeCustom ? custom : stock).shift().index);
    }
    return result;
  });
  const order = Array.from({ length: unique.size }, (_, index) => mixed[index % 2][Math.floor(index / 2)]);
  const preferred = ['kayla', 'maggie', 'chloe'];
  const preferredIndexes = preferred.map(name => {
    const entry = [...unique.values()].find(item => String(receptionists[item.index]?.full_name || '').toLowerCase().includes(name));
    return entry?.index;
  }).filter(index => index != null);
  preferredIndexes.forEach((personIndex, slot) => {
    const currentPosition = order.indexOf(personIndex);
    if (currentPosition < 0 || currentPosition === slot) return;
    [order[slot], order[currentPosition]] = [order[currentPosition], order[slot]];
  });
  return order;
}

export function galleryPersonIndex(column, row, count) {
  if (count <= 1) return 0;
  // Adjacent masonry columns can overlap several rows. Disjoint palettes
  // prevent duplicates across every overlapping edge, not just equal row IDs.
  const parity = wrap(column, 2);
  const length = Math.floor((count + 1 - parity) / 2);
  // Walk the roster with a coprime stride so repeated receptionist images
  // are separated across the masonry instead of appearing in nearby rows.
  const stride = length > 3 && length % 5 !== 0 ? 5 : (length > 3 && length % 2 !== 0 ? 2 : 1);
  return parity + 2 * wrap(row * stride + Math.floor(column / 2), length);
}

// A periodic masonry world: every column fills continuously, including negative
// coordinates. Only cells near the viewport are mounted.
export function galleryCells(view, width, height, count) {
  if (!count) return [];
  const cells = [];
  const step = TILE_WIDTH + TILE_GAP;
  const left = -view.x / view.scale - step;
  const right = (width - view.x) / view.scale + step;
  const top = -view.y / view.scale - 350;
  const bottom = (height - view.y) / view.scale + 350;
  for (let column = Math.floor(left / step); column <= Math.ceil(right / step); column++) {
    const offset = wrap(column, 3) * 97;
    for (let cycle = Math.floor((top - offset) / PERIOD); cycle <= Math.floor((bottom - offset) / PERIOD); cycle++) {
      let y = cycle * PERIOD + offset;
      for (let slot = 0; slot < HEIGHTS.length; slot++) {
        const tileHeight = HEIGHTS[wrap(slot + column, HEIGHTS.length)];
        if (y + tileHeight >= top && y <= bottom) {
          const row = cycle * HEIGHTS.length + slot;
          const personIndex = galleryPersonIndex(column, row, count);
          cells.push({ key: `${column}:${row}`, x: column * step, y, width: TILE_WIDTH,
            height: tileHeight, personIndex });
        }
        y += tileHeight + TILE_GAP;
      }
    }
  }
  return cells;
}

export function zoomAt(view, scale, point) {
  const nextScale = Math.max(MIN_GALLERY_ZOOM, Math.min(1.8, scale));
  const ratio = nextScale / view.scale;
  return { scale: nextScale, x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio };
}

export function hoverFalloff(distance, radius) {
  return Math.pow(Math.max(0, 1 - distance / radius), 1.5);
}
