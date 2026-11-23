import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePack } from '../dist/offline.mjs';

test('downloads 18 recordings once and opens the same pack without network', async () => {
  const cache = new Map();
  const storage = {match: async key => cache.get(key)?.clone(), put: async (key, value) => cache.set(key, value)};
  const catalog = Array.from({length: 25}, (_, i) => ({id: String(i), token: 'fixture'}));
  const list = async () => catalog;
  const load = async () => new Uint8Array([1, 2, 3]).buffer;
  const pack = await preparePack(storage, 'https://example.com/player/', {list, load});
  assert.equal(pack.entries.length, 18);
  assert.equal(cache.size, 19);
  const fail = () => { throw Error('No internet'); };
  const reopened = await preparePack(storage, 'https://example.com/player/', {list: fail, load: fail});
  assert.deepEqual(reopened.entries, pack.entries);
  assert.deepEqual(new Uint8Array(await reopened.load(reopened.entries[0])), new Uint8Array([1, 2, 3]));
});

test('enriches a legacy offline pack without redownloading audio', async () => {
  const scope = 'https://example.com/player/';
  const entries = Array.from({length: 18}, (_, i) => ({id: String(i)}));
  const records = new Map(entries.map(({id}) => [scope + '.offline-audio/' + id, new Response('audio')]));
  records.set(scope + '.offline-audio/manifest', Response.json(entries));
  const cache = {match: async key => records.get(key)?.clone(), put: async (key, value) => records.set(key, value)};
  const pack = await preparePack(cache, scope, {
    list: async () => entries.map(entry => ({...entry, categoryCode: 'A', createdAt: '2026-10-17T00:00:00Z', durationSeconds: 42})),
    load: () => assert.fail('existing audio should not be downloaded again'),
  });
  assert.equal(pack.entries[0].categoryCode, 'A');
  assert.equal(pack.entries[0].durationSeconds, 42);
});
