import { matchesTag, makePlayer } from './player.mjs';
import { list, loadBytes } from './cloud.mjs';

const deck = document.querySelector('.player');
const button = document.querySelector('button');
const status = document.querySelector('[role="status"]');
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
