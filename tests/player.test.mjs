import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesTag, pick, makePlayer } from '../dist/player.mjs';

test('accepts only the exhibition NDEF text marker', () => {
  const data = new TextEncoder().encode('fukuoka-voice-player:v1');
  assert.equal(matchesTag([{recordType: 'text', data}]), true);
  assert.equal(matchesTag([{recordType: 'url', data}]), false);
  assert.equal(matchesTag([{recordType: 'text', data: data.subarray(1)}]), false);
});

test('never immediately repeats when alternatives exist', () => {
  assert.equal(pick([{id: 'a'}, {id: 'b'}], 'a', () => 0).id, 'b');
  assert.equal(pick([{id: 'a'}], 'a', () => 0).id, 'a');
});

test('a newer tap wins and natural completion does not advance', async () => {
  let release;
  let first = true;
  let ended;
  const states = [];
  const played = [];
  const player = makePlayer({
    list: async () => [{id: 'a'}],
    load: () => first ? (first = false, new Promise(r => { release = r; })) : 'new',
    start: (buffer, finish) => { played.push(buffer); ended = finish; return () => {}; },
    state: status => states.push(status),
  });
  const old = player.tap();
  await Promise.resolve();
  await player.tap();
  release('old');
  await old;
  ended();
  assert.deepEqual(played, ['new']);
  assert.equal(states.at(-1), 'ready');
});
