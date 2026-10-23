import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectUpcomingHomeFixtures, sixSlotPages, rankScrollAt, pinnedOwnRowY } from './reference-behavior.mjs';

test('welkom filtert voor sorteren/limiteren en gebruikt echte identiteiten en tijd', async () => {
  const data = JSON.parse(await readFile(new URL('./welcome-fixtures.json', import.meta.url), 'utf8'));
  const result = selectUpcomingHomeFixtures(data.fixtures, {
    ...data.context, nowMs: Date.parse(data.context.now)
  });
  assert.deepEqual(result.map(x => x.id), data.expectedIds);
  assert.equal(selectUpcomingHomeFixtures([], { ownClubId: 'own', ownTeamIds: [], nowMs: 0 }).length, 0);
});

test('zes slots blijven op hun plek voor nul tot zes items', () => {
  for (let count = 0; count <= 6; count++) {
    const items = Array.from({ length: count }, (_, i) => `item-${i}`);
    const [slots] = sixSlotPages(items);
    assert.equal(slots.length, 6);
    assert.deepEqual(slots.slice(0, count), items);
    assert.ok(slots.slice(count).every(x => x === null));
  }
});

test('meer dan zes records gaan naar volgende pagina’s zonder verlies', () => {
  const items = Array.from({ length: 13 }, (_, i) => ({ id: i }));
  const pages = sixSlotPages(items);
  assert.equal(pages.length, 3);
  assert.ok(pages.every(x => x.length === 6));
  assert.deepEqual(pages.flat().filter(Boolean), items);
  assert.deepEqual(pages[2].slice(1), [null, null, null, null, null]);
});

test('stand heeft beginpauze, heenreis, eindpauze, terugreis en herhaling', () => {
  const at = elapsedMs => rankScrollAt({ elapsedMs, maxScroll: 300 });
  for (const [time, y] of [[0,0],[2499,0],[2500,0],[7500,150],[12500,300],[14999,300],[15000,300],[20000,150],[25000,0],[26000,0]]) {
    assert.equal(at(time), y);
  }
  assert.equal(at(20000), at(20000));
  assert.equal(rankScrollAt({ elapsedMs: 99999, maxScroll: 0 }), 0);
  assert.equal(rankScrollAt({ elapsedMs: 99999, maxScroll: -10 }), 0);
  assert.equal(rankScrollAt({ elapsedMs: 3500, maxScroll: 300, speed: 19 }), 19);
  assert.equal(rankScrollAt({ elapsedMs: 3500, maxScroll: 300, speed: 48 }), 48);
});

test('eigen rij beweegt mee en klemt boven en onder, ook eerste/laatste plek', () => {
  const y = (normalY, scrollY) => pinnedOwnRowY({ normalY, scrollY, viewportHeight: 400, rowHeight: 50 });
  assert.equal(y(0, 0), 0);
  assert.equal(y(0, 300), 0);
  assert.equal(y(650, 0), 350);
  assert.equal(y(200, 0), 200);
  assert.equal(y(200, 100), 100);
  assert.equal(y(200, 300), 0);
  assert.equal(y(null, 0), null);
});
