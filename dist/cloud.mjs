const base = 'https://ngcvfpyyihhkjqtdvivx.supabase.co/functions/v1/';
const apikey = 'sb_publishable_4dZKnrLRzGHhpKeOSgQBdA_GPlp_Oqg';

async function request(path, signal, body) {
  const response = await fetch(base + path, {
    cache: 'no-store', signal, method: body ? 'POST' : 'GET',
    headers: body ? {apikey, 'content-type': 'application/json'} : {apikey},
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw Error('Recording service unavailable');
  return response.json();
}

export async function list(signal) {
  const entries = new Map(), visited = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({limit: '100'});
    if (cursor) query.set('cursor', cursor);
    const page = await request('public-map?' + query, signal);
    for (const {id, token} of page.items) entries.set(id, {id, token});
    cursor = page.nextCursor;
    if (cursor !== null && (typeof cursor !== 'string' || !cursor || visited.has(cursor) || visited.size >= 100)) {
      throw Error('Invalid recording catalog');
    }
    visited.add(cursor);
  } while (cursor);
  return [...entries.values()];
}

export async function loadBytes(entry, signal) {
  const {url} = await request('public-playback-url', signal, {token: entry.token});
  const response = await fetch(url, {cache: 'no-store', signal});
  if (!response.ok) throw Error('Recording unavailable');
  return response.arrayBuffer();
}
