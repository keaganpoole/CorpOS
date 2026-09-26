import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryCells, zoomAt, hoverFalloff, TILE_GAP } from './catalogGeometry.js';

test('zoom preserves the world point underneath the pointer and clamps limits', () => {
  const view = { x: -220, y: 170, scale: .8 }, point = { x: 530, y: 310 };
  for (const scale of [.01, .6, 1, 1.5, 20]) {
    const next = zoomAt(view, scale, point);
    assert.ok(next.scale >= .45 && next.scale <= 1.8);
    assert.ok(Math.abs((point.x - view.x) / view.scale - (point.x - next.x) / next.scale) < 1e-9);
    assert.ok(Math.abs((point.y - view.y) / view.scale - (point.y - next.y) / next.scale) < 1e-9);
  }
});

test('masonry fills each column continuously and maps repeated portraits to valid people', () => {
  for (const count of [1, 8, 9]) for (const scale of [.45, 1, 1.8]) for (const x of [-9000, 0, 9100]) {
    const view = { x, y: x * .7, scale };
    const cells = galleryCells(view, 1440, 900, count);
    assert.ok(cells.length > 0 && cells.length < 250);
    assert.equal(new Set(cells.map(cell => cell.key)).size, cells.length);
    assert.ok(cells.every(cell => cell.personIndex >= 0 && cell.personIndex < count));
    const columns = new Map();
    for (const cell of cells) { const column = columns.get(cell.x) || []; column.push(cell); columns.set(cell.x, column); }
    for (const column of columns.values()) {
      column.sort((a, b) => a.y - b.y);
      assert.ok(column[0].y * scale + view.y <= 0);
      assert.ok((column.at(-1).y + column.at(-1).height) * scale + view.y >= 900);
      for (let i = 1; i < column.length; i++) assert.equal(column[i].y - column[i - 1].y - column[i - 1].height, TILE_GAP);
    }
  }
  assert.deepEqual(galleryCells({ x: 0, y: 0, scale: 1 }, 100, 100, 0), []);
});

test('hover lift falls off gently to zero beyond its radius', () => {
  assert.equal(hoverFalloff(0, 360), 1);
  assert.equal(hoverFalloff(360, 360), 0);
  assert.equal(hoverFalloff(500, 360), 0);
  assert.ok(hoverFalloff(90, 360) > hoverFalloff(180, 360));
  assert.ok(hoverFalloff(180, 360) < .5);
});
