import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScanner} from '../dist/player.mjs';

test('reconnect replaces the scan and ignores events from the aborted reader', async () => {
  const readers = [], incoming = [];
  const scanner = makeScanner({
    create: () => {
      const reader = {async scan({signal}) { this.signal = signal; }};
      readers.push(reader);
      return reader;
    },
    onRead: value => incoming.push(value),
  });
  await scanner.restart();
  await scanner.restart();
  assert.equal(readers[0].signal.aborted, true);
  readers[0].onreading('stale');
  readers[1].onreading('active');
  assert.deepEqual(incoming, ['active']);
});

test('a failed scan can be restarted without reloading the page', async () => {
  let attempts = 0;
  const scanner = makeScanner({create: () => ({async scan() {
    if (++attempts === 1) throw Error('NFC unavailable');
  }})});
  await assert.rejects(scanner.restart(), /unavailable/);
  await scanner.restart();
  assert.equal(attempts, 2);
});
