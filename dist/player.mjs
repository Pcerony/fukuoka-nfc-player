const markers = new Set(['v1', 'v1:02', 'v1:03', 'v1:04'].map(value => 'fukuoka-voice-player:' + value));

export function readMarker(records) {
  for (const record of records) {
    if (record.recordType !== 'text' || !record.data) continue;
    try {
      const text = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
      if (markers.has(text)) return text;
    } catch {}
  }
  return null;
}

export function matchesTag(records) {
  return readMarker(records) !== null;
}

export function makeTagGate() {
  let last;
  return marker => {
    if (!marker || marker === last) return false;
    last = marker;
    return true;
  };
}

export function pick(items, last, random = Math.random) {
  const alternatives = items.filter(item => item.id !== last);
  const pool = alternatives.length ? alternatives : items;
  return pool[Math.floor(random() * pool.length)];
}

export function makePlayer({list, load, start, state}) {
  let active, stop, last;
  return {
    async tap() {
      active?.abort();
      const controller = active = new AbortController();
      const {signal} = controller;
      stop?.();
      stop = undefined;
      state('loading');
      try {
        const entry = pick(await list(signal), last);
        if (signal.aborted) return;
        if (!entry) return state('empty');
        const buffer = await load(entry, signal);
        if (signal.aborted) return;
        stop = start(buffer, () => {
          if (!signal.aborted) {
            stop = undefined;
            state('ready');
          }
        });
        last = entry.id;
        state('playing', entry);
      } catch {
        if (!signal.aborted) state('error');
      }
    },
  };
}
