import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryCells, galleryRosterOrder, galleryPersonIndex, zoomAt, hoverFalloff, TILE_GAP, TILE_WIDTH } from './catalogGeometry.js';

test('different identities meet every horizontal masonry edge and vertical edge with four or more people', () => {
  for (let count = 2; count <= 32; count++) for (const distance of [-1000000, -9100, 0, 9700, 1000000]) {
    const cells = galleryCells({ x: distance, y: distance * .7, scale: 1 }, 1440, 900, count);
    for (const a of cells) for (const b of cells) {
      const horizontal = b.x - a.x === TILE_WIDTH + TILE_GAP && a.y < b.y + b.height && b.y < a.y + a.height;
      const vertical = b.x === a.x && b.y - a.y - a.height === TILE_GAP;
      if (horizontal || (vertical && count >= 4)) assert.notEqual(a.personIndex, b.personIndex, `${count}: ${a.key} / ${b.key}`);
    }
  }
});

test('cell assignment stays fixed through pan, zoom and distant coordinates', () => {
  for (const count of [1, 2, 3, 4, 7, 13]) {
    for (const distance of [-1e7, 0, 1e7]) {
    const assignments = new Map();
    for (const view of [{x:0,y:0,scale:1}, {x:100,y:-80,scale:1.4}, {x:-200,y:100,scale:.9}]) {
      view.x += distance * view.scale;
      view.y -= distance * view.scale;
      for (const cell of galleryCells(view, 1200, 800, count)) {
        const [column, row] = cell.key.split(':').map(Number);
        assert.equal(cell.personIndex, galleryPersonIndex(column, row, count));
        if (assignments.has(cell.key)) assert.deepEqual(cell, assignments.get(cell.key));
        assignments.set(cell.key, cell);
      }
    }
    }
  }
});

test('uneven source populations spread across columns and retain every identity', () => {
  for (let count = 1; count <= 32; count++) for (let created = 0; created <= count; created++) {
    const roster = Array.from({ length: count }, (_, id) => ({ id, source: id < created ? 'created_receptionist' : 'stock' }));
    const order = galleryRosterOrder(roster);
    assert.equal(new Set(order).size, count);
    assert.deepEqual([...order].sort((a, b) => a - b), roster.map(person => person.id));
    const reversed = [...roster].reverse();
    assert.deepEqual(galleryRosterOrder(reversed).map(index => reversed[index].id), order.map(index => roster[index].id));
    for (const parity of [0, 1]) {
      const palette = order.filter((_, index) => index % 2 === parity).map(index => roster[index].source);
      if (created >= 2 && count - created >= 2) {
        assert.ok(palette.includes('stock') && palette.includes('created_receptionist'));
      }
    }
  }
});

test('roster ordering mixes sources in both palettes and ignores API ordering', () => {
  for (const count of [4, 8, 12, 20]) {
    const roster = Array.from({length:count}, (_, id) => ({id, elevenlabs_voice_id:`voice-${id}`, ...(id<count/2 ? {source:'created_receptionist',created_receptionist_id:id+100} : {})}));
    const order = galleryRosterOrder(roster);
    const keys = order.map(index => roster[index].elevenlabs_voice_id);
    const reversed = [...roster].reverse();
    assert.deepEqual(galleryRosterOrder(reversed).map(index => reversed[index].elevenlabs_voice_id), keys);
    assert.equal(new Set(order).size, count);
    for (const parity of [0,1]) {
      const palette = order.filter((_,index) => index%2===parity).map(index => Boolean(roster[index].source));
      assert.ok(palette.includes(true) && palette.includes(false));
      for(let i=1;i<palette.length;i++) assert.notEqual(palette[i],palette[i-1]);
    }
  }
});

test('small rosters remain valid and duplicate voice aliases use one identity', () => {
  assert.deepEqual(galleryRosterOrder([]), []);
  assert.deepEqual(galleryRosterOrder([{id:1}]), [0]);
  assert.equal(galleryRosterOrder([{id:1,elevenlabs_voice_id:'same'},{id:2,elevenlabs_voice_id:'same'}]).length, 1);
  for(const count of [1,2,3]) for(let column=-20;column<=20;column++) for(let row=-20;row<=20;row++) {
    const index=galleryPersonIndex(column,row,count);
    assert.ok(index>=0 && index<count);
  }
});

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
