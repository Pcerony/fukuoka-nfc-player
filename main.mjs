import { readMarker, makeTagGate, makePlayer } from './player.mjs?v=20261123-9';
import { list, loadBytes } from './cloud.mjs?v=20261123-9';
import { PACK_SIZE, preparePack } from './offline.mjs?v=20261123-9';

const deck = document.querySelector('.player');
const button = document.querySelector('.enable');
const status = document.querySelector('[role="status"]');
const fullscreen = document.querySelector('.fullscreen');
const track = document.querySelector('.track');
const pause = document.querySelector('.pause');
const acceptMarker = makeTagGate();
const themes = {A: '食べ物', B: '旅行', C: '出会い', D: 'その他の思い出'};
const japanDate = new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo'});
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
  paused: '一時停止中',
  empty: '再生できる録音がありません', error: '再生できませんでした。もう一度かざしてください。',
};
let context, reader, actualDuration, contextTransition;

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

function state(value, entry) {
  deck.dataset.state = value;
  status.textContent = labels[value];
  track.hidden = value !== 'playing' && value !== 'paused';
  status.toggleAttribute('data-transport', value === 'playing');
  if (value === 'ready' || value === 'paused') {
    const ja = document.createElement('span');
    ja.lang = 'ja';
    ja.textContent = 'レコードを回してください';
    const en = document.createElement('span');
    en.lang = 'en';
    en.textContent = 'Please spin the record';
    status.replaceChildren(ja, document.createElement('br'), en);
  }
  if (entry) {
    const date = Date.parse(entry.createdAt);
    const seconds = Math.round(entry.durationSeconds ?? actualDuration);
    track.querySelector('.theme').textContent = themes[entry.categoryCode] ?? 'テーマ未設定';
    track.querySelector('.date').textContent = Number.isFinite(date) ? japanDate.format(date) : '日付不明';
    track.querySelector('.duration').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  pause.title = value === 'paused' ? '再開' : '一時停止';
  pause.setAttribute('aria-label', pause.title);
}

const player = makePlayer({
  list: async () => pack.entries,
  load: async entry => {
    await contextTransition;
    if (context.state === 'suspended') await context.resume();
    return context.decodeAudioData(await pack.load(entry));
  },
  start(buffer, finish) {
    if (context.state !== 'running') throw Error('Audio suspended');
    const source = context.createBufferSource();
    actualDuration = buffer.duration;
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => { source.disconnect(); finish(); };
    source.start();
    return () => { source.onended = null; source.stop(); source.disconnect(); };
  },
  state,
});

pause.addEventListener('click', async () => {
  const current = deck.dataset.state;
  if (current !== 'paused' && current !== 'playing') return;
  pause.disabled = true;
  try {
    contextTransition = (current === 'paused' ? context.resume() : context.suspend()).catch(() => false);
    if (await contextTransition === false) return;
    if (deck.dataset.state === current) state(current === 'paused' ? 'playing' : 'paused');
  } finally {
    pause.disabled = false;
  }
});

function scanMessage(text) {
  status.removeAttribute('data-transport');
  status.textContent = text;
}

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
      if (pack) scanMessage('カードを検出しましたが、読み取れません');
    };
    reader.onreading = ({message}) => {
      if (!pack) return;
      const marker = readMarker(message.records);
      if (!marker) {
        scanMessage('カードを読み取りましたが、登録されていません');
        return;
      }
      if (!acceptMarker(marker)) return;
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
  } catch {
    scan.abort();
    status.textContent = '準備できませんでした。接続を確認して再試行してください。';
  } finally {
    button.disabled = false;
  }
});
