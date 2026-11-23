import { matchesTag, makePlayer } from './player.mjs?v=20261123-5';
import { list, loadBytes } from './cloud.mjs?v=20261123-5';
import { PACK_SIZE, preparePack } from './offline.mjs?v=20261123-5';

const deck = document.querySelector('.player');
const button = document.querySelector('.controls button');
const status = document.querySelector('[role="status"]');
const fullscreen = document.querySelector('.fullscreen');
const scope = new URL('./', location.href).href;
let pack, wakeLock, wakePending, keepAwake = false;

async function holdScreen() {
  if (!keepAwake || wakePending || !navigator.wakeLock || document.hidden || (wakeLock && !wakeLock.released)) return;
  wakePending = true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    // The OS can deny a wake lock without affecting playback.
  } finally {
    wakePending = false;
  }
}

document.addEventListener('visibilitychange', holdScreen);

if (document.fullscreenEnabled) {
  fullscreen.hidden = false;
  document.addEventListener('fullscreenchange', () => {
    const expanded = Boolean(document.fullscreenElement);
    fullscreen.setAttribute('aria-pressed', String(expanded));
    fullscreen.title = expanded ? '全画面を終了' : '全画面';
    void holdScreen();
  });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      fullscreen.title = '全画面に切り替えられませんでした';
    }
  });
}
const labels = {
  ready: 'カードをかざす', loading: '読み込み中', playing: '再生中',
  empty: '再生できる録音がありません', error: '再生できませんでした。もう一度かざしてください。',
};
let context, reader, lastTap = -Infinity;

async function setupOffline() {
  await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(Error('Offline page not ready')), 15000)),
  ]);
  const cache = await caches.open('fukuoka-nfc-audio-v1:' + scope);
  return preparePack(cache, scope, {
    list: () => list(AbortSignal.timeout(20000)),
    load: entry => loadBytes(entry, AbortSignal.timeout(12000)),
    progress: count => { status.textContent = `ダウンロード中 ${count}/${PACK_SIZE}`; },
  });
}

function state(value) {
  deck.dataset.state = value;
  status.textContent = labels[value];
}

const player = makePlayer({
  list: async () => pack.entries,
  load: async entry => context.decodeAudioData(await pack.load(entry)),
  start(buffer, finish) {
    if (context.state !== 'running') throw Error('Audio suspended');
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => { source.disconnect(); finish(); };
    source.start();
    return () => { source.onended = null; source.stop(); source.disconnect(); };
  },
  state,
});

if (!('NDEFReader' in window) || !window.isSecureContext) {
  button.hidden = true;
  status.textContent = 'NFCはAndroid版Chromeで使えます';
}

button.addEventListener('click', async () => {
  button.disabled = true;
  keepAwake = true;
  void holdScreen();
  const scan = new AbortController();
  try {
    context ??= new AudioContext({latencyHint: 'playback'});
    const unlocked = context.resume();
    reader ??= new NDEFReader();
    reader.onreadingerror = () => {
      if (pack) status.textContent = 'カードを検出しましたが、読み取れません';
    };
    reader.onreading = ({message}) => {
      if (!pack) return;
      if (!matchesTag(message.records)) {
        status.textContent = 'カードを読み取りましたが、登録されていません';
        return;
      }
      const now = performance.now();
      if (now - lastTap < 450) return;
      lastTap = now;
      void holdScreen();
      void player.tap();
    };
    await Promise.all([unlocked, reader.scan({signal: scan.signal})]);
  } catch {
    scan.abort();
    status.textContent = 'NFCを開始できませんでした';
    button.disabled = false;
    return;
  }
  try {
    status.textContent = 'オフライン再生を準備中';
    pack = await setupOffline();
    navigator.storage?.persist?.().catch(() => {});
    button.hidden = true;
    state('ready');
    status.textContent = 'オフライン準備完了 · カードをかざす';
  } catch {
    scan.abort();
    status.textContent = '準備できませんでした。接続を確認して再試行してください。';
  } finally {
    button.disabled = false;
  }
});
