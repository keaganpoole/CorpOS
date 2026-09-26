export const TILE_WIDTH = 210;
export const TILE_GAP = 4;
const HEIGHTS = [190, 286, 224, 334];
const PERIOD = HEIGHTS.reduce((sum, height) => sum + height + TILE_GAP, 0);
export const wrap = (value, length) => ((value % length) + length) % length;

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
          cells.push({ key: `${column}:${row}`, x: column * step, y, width: TILE_WIDTH,
            height: tileHeight, personIndex: wrap(column * 7 + row * 3 + cycle, count) });
        }
        y += tileHeight + TILE_GAP;
      }
    }
  }
  return cells;
}

export function zoomAt(view, scale, point) {
  const nextScale = Math.max(.45, Math.min(1.8, scale));
  const ratio = nextScale / view.scale;
  return { scale: nextScale, x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio };
}

export function hoverFalloff(distance, radius) {
  return Math.pow(Math.max(0, 1 - distance / radius), 1.5);
}
