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
