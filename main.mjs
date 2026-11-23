import { readMarker, makeTagGate, makePlayer, makeScanner } from './player.mjs?v=20261123-11';
import { list, loadBytes } from './cloud.mjs?v=20261123-11';
import { PACK_SIZE, preparePack } from './offline.mjs?v=20261123-11';

const deck = document.querySelector('.player');
const button = document.querySelector('.enable');
const status = document.querySelector('[role="status"]');
const fullscreen = document.querySelector('.fullscreen');
const track = document.querySelector('.track');
const pause = document.querySelector('.pause');
const reconnect = document.querySelector('.reconnect');
const idleDialog = document.querySelector('.idle-dialog');
const activate = document.querySelector('.activate');
const wakeError = document.querySelector('.wake-error');
const IDLE_MS = 120000;
let lastActivity = Date.now();
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
let context, actualDuration, contextTransition, scanPending, scanSince = 0;

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
  if (value !== deck.dataset.state) lastActivity = Date.now();
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

const scanner = makeScanner({
  create: () => new NDEFReader(),
  onError: () => {
    if (pack) scanMessage('カードを検出しましたが、読み取れません');
  },
  onRead: ({message}) => {
    if (!pack || idleDialog.open) return;
    const marker = readMarker(message.records);
    if (!marker) {
      scanMessage('カードを読み取りましたが、登録されていません');
      return;
    }
    if (!acceptMarker(marker)) return;
    scanSince = Date.now();
    void holdScreen();
    void player.tap();
  },
});

async function reconnectScan(manual = false) {
  if (!pack || document.hidden || scanPending || (idleDialog.open && !manual)) return false;
  scanPending = reconnect.disabled = true;
  scanSince = Date.now();
  try {
    await scanner.restart(10000);
    if (manual || status.dataset.scanFailed) state(deck.dataset.state);
    delete status.dataset.scanFailed;
    return true;
  } catch {
    status.dataset.scanFailed = 'true';
    scanMessage('NFCを再接続できませんでした');
    return false;
  } finally {
    scanPending = reconnect.disabled = false;
  }
}

function checkIdle() {
  if (!pack || idleDialog.open || document.hidden || scanPending) return;
  if (['playing', 'loading'].includes(deck.dataset.state) || Date.now() - lastActivity < IDLE_MS) return;
  scanner.stop();
  idleDialog.showModal();
}

async function activateFromIdle() {
  if (activate.disabled) return;
  activate.disabled = true;
  wakeError.textContent = '';
  lastActivity = Date.now();
  void holdScreen();
  try {
    if (await reconnectScan(true)) idleDialog.close();
    else wakeError.textContent = 'NFCを再接続できませんでした';
  } finally {
    activate.disabled = false;
  }
}

activate.addEventListener('click', () => void activateFromIdle());
idleDialog.addEventListener('click', event => {
  if (event.target === idleDialog) void activateFromIdle();
});
idleDialog.addEventListener('cancel', event => event.preventDefault());
document.addEventListener('pointerdown', () => { lastActivity = Date.now(); });
reconnect.addEventListener('click', () => void reconnectScan(true));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkIdle();
    void reconnectScan();
  }
});

if (!('NDEFReader' in window) || !window.isSecureContext) {
  button.hidden = true;
  status.textContent = 'NFCはAndroid版Chromeで使えます';
}

button.addEventListener('click', async () => {
  button.disabled = true;
  keepAwake = true;
  void holdScreen();
  try {
    context ??= new AudioContext({latencyHint: 'playback'});
    const unlocked = context.resume();
    await Promise.all([unlocked, scanner.restart()]);
  } catch {
    scanner.stop();
    status.textContent = 'NFCを開始できませんでした';
    button.disabled = false;
    return;
  }
  try {
    status.textContent = 'オフライン再生を準備中';
    pack = await setupOffline();
    navigator.storage?.persist?.().catch(() => {});
    button.hidden = true;
    reconnect.hidden = false;
    scanSince = Date.now();
    setInterval(checkIdle, 1000);
    setInterval(() => {
      if (Date.now() - scanSince >= 60000) void reconnectScan();
    }, 15000);
    state('ready');
  } catch {
    scanner.stop();
    status.textContent = '準備できませんでした。接続を確認して再試行してください。';
  } finally {
    button.disabled = false;
  }
});
