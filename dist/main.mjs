import { matchesTag, makePlayer } from './player.mjs?v=20261123-2';
import { list, loadBytes } from './cloud.mjs?v=20261123-2';

const deck = document.querySelector('.player');
const button = document.querySelector('.controls button');
const status = document.querySelector('[role="status"]');
const fullscreen = document.querySelector('.fullscreen');

if (document.fullscreenEnabled) {
  fullscreen.hidden = false;
  document.addEventListener('fullscreenchange', () => {
    const expanded = Boolean(document.fullscreenElement);
    fullscreen.setAttribute('aria-pressed', String(expanded));
    fullscreen.title = expanded ? '全画面を終了' : '全画面';
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

function state(value) {
  deck.dataset.state = value;
  status.textContent = labels[value];
}

const player = makePlayer({
  list,
  load: async (entry, signal) => context.decodeAudioData(await loadBytes(entry, signal)),
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
  try {
    context ??= new AudioContext({latencyHint: 'playback'});
    const unlocked = context.resume();
    reader ??= new NDEFReader();
    reader.onreading = ({message}) => {
      if (!matchesTag(message.records)) return;
      const now = performance.now();
      if (now - lastTap < 450) return;
      lastTap = now;
      void player.tap();
    };
    await Promise.all([unlocked, reader.scan()]);
    button.hidden = true;
    state('ready');
  } catch {
    status.textContent = 'NFCを開始できませんでした';
  } finally {
    button.disabled = false;
  }
});
