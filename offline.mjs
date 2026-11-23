export const PACK_SIZE = 18;

export async function preparePack(cache, scope, {list, load, progress = () => {}}) {
  const manifest = new URL('.offline-audio/manifest', scope).href;
  const path = id => new URL('.offline-audio/' + encodeURIComponent(id), scope).href;
  const stored = await cache.match(manifest);
  let entries = stored ? await stored.json() : [];
  if (entries.length !== PACK_SIZE || !(await Promise.all(entries.map(({id}) => cache.match(path(id))))).every(Boolean)) {
    const candidates = (await list()).sort((a, b) => a.id.localeCompare(b.id));
    entries = [];
    progress(0);
    for (const entry of candidates) {
      const url = path(entry.id);
      if (!(await cache.match(url))) {
        let bytes;
        try { bytes = await load(entry); } catch { continue; }
        if (!bytes.byteLength) continue;
        await cache.put(url, new Response(bytes));
      }
      entries.push({id: entry.id});
      progress(entries.length);
      if (entries.length === PACK_SIZE) break;
    }
    if (entries.length !== PACK_SIZE) throw Error('Offline audio pack incomplete');
    await cache.put(manifest, Response.json(entries));
  }
  return {
    entries,
    async load({id}) {
      const response = await cache.match(path(id));
      if (!response) throw Error('Offline recording unavailable');
      return response.arrayBuffer();
    },
  };
}
