// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import './style.css';
import { Starfield } from './starfield';
import { recipeFor, hasEnding } from './harmony-v5';
import { INSTRUMENTS } from './instruments';
import { MusicEngine } from './audio';
import { LAYERS, PROFILES, normalizeSettings, upgradeSettings, regenerateSettings, selectProfile, progression, chordHold, musicScore, type Settings, type ProfileId, type Layer } from './music';

const STORAGE = 'worksong.v1';
const FAVORITES = 'worksong.favorites.v1';
const read = (key: string) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const saved = read(STORAGE);
let settings = upgradeSettings(saved);
let shared = false;
if (location.hash.startsWith('#mix=')) {
  try { settings = normalizeSettings(JSON.parse(decodeURIComponent(location.hash.slice(5)))); shared = true; } catch { /* ignore invalid links */ }
}
interface Favorite { id: string; settings: Settings }
const rawFavorites = read(FAVORITES);
let favorites: Favorite[] = Array.isArray(rawFavorites) ? rawFavorites.slice(0, 12).filter((item) => item && typeof item.id === 'string' && /^[0-9]+$/.test(item.id)).map((item) => ({ id: item.id, settings: normalizeSettings(item.settings) })) : [];
const engine = new MusicEngine();
let busy = false;
let timer = 0;
let focusMode = false;
let toastTimeout = 0;
const icons = {
  play: '<path d="m8 5 12 7-12 7z"/>', pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 8a7 7 0 0 1 11-2l3 6M4 12l3 6a7 7 0 0 0 11-2"/>',
  save: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11Z"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${name === 'play' || name === 'pause' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter">${icons[name]}</svg>`;
const profileGraphic = (id: ProfileId) => id === 'lofi'
  ? '<circle cx="30" cy="24" r="16"/><circle cx="30" cy="24" r="8"/><circle cx="30" cy="24" r="1.5"/><path d="M50 8v17l-8 7"/>'
  : id === 'ambient'
  ? '<path d="M8 16c8-8 16-8 24 0s16 8 24 0M8 24c8-8 16-8 24 0s16 8 24 0M8 32c8-8 16-8 24 0s16 8 24 0"/>'
  : '<path d="M12 20v8m10-15v22m10-29v36m10-29v22m10-15v8"/>';
const layerNames: Record<Layer, string> = { harmony: '화음', bass: '베이스', rhythm: '리듬', motif: '멜로디' };
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="${location.pathname}" aria-label="Kalavinka · 가릉빈가 홈"><span class="brand-name" aria-hidden="true"><span class="brand-en" lang="en">Kalavinka</span><span class="brand-ko" lang="ko">가릉빈가</span></span><span class="brand-cross" aria-hidden="true">+</span></a>
    <div class="theme-switch" role="group" aria-label="화면 테마"><button data-theme="light" aria-label="밝은 테마">◑</button><button data-theme="dark" aria-label="어두운 테마">◐</button><button data-theme="system" aria-label="시스템 테마">◒</button></div>
  </header>
  <main class="workspace">
    <div class="console-grid">
      <aside class="panel atmosphere-panel">
        <div class="profile-list" role="group" aria-label="음악 분위기">${(Object.keys(PROFILES) as ProfileId[]).map((id) => `<button class="profile" data-profile="${id}" aria-pressed="false"><svg class="profile-art" viewBox="0 0 64 48" aria-hidden="true">${profileGraphic(id)}</svg><span class="profile-name">${PROFILES[id].name}</span><span class="profile-indicator" aria-hidden="true"></span></button>`).join('')}</div>
      </aside>
      <section class="panel player-panel" aria-label="음악 플레이어">
        <div class="deck">
          <div class="deck-top"><h1 id="now-title">Warm desk</h1><span class="mono" id="elapsed">00:00</span></div>
          <div class="scope-wrap"><canvas id="scope" aria-label="전체 출력 파형"></canvas></div>
          <div class="playback-info"><span id="status-text" role="status">정지</span><span class="mono" id="bar-label"></span></div>
          <div class="chord-lane" id="chords" aria-label="코드 진행"></div>
          <div class="transport">
            <button class="play-button" id="play" aria-label="음악 재생">${icon('play')}<span>재생</span></button>
            <button class="compact-btn regenerate" id="regenerate">${icon('refresh')}<span>새 흐름</span></button>
            <button class="icon-button tip" id="favorite" aria-label="현재 음악 저장">${icon('save')}<span class="tooltip" role="tooltip">현재 음악 저장</span></button>
            <button class="icon-button tip" id="share" aria-label="현재 음악 링크 복사">${icon('share')}<span class="tooltip" role="tooltip">음악 링크 복사</span></button>
          </div>
          <div class="player-bottom"><select id="groove" class="instrument-select groove-select" aria-label="리듬 패턴"><option value="straight">Four on the floor</option><option value="dnb">Drum &amp; bass</option></select><button class="text-button" id="focus" aria-pressed="false">${icon('focus')}<span>집중 화면</span></button></div>
        </div>
        <div class="layer-grid" role="group" aria-label="악기">${LAYERS.map((layer) => `<div class="part"><button class="layer" data-layer="${layer}" aria-pressed="true"><span>${layerNames[layer]}</span><span class="switch" aria-hidden="true"></span></button><select class="instrument-select" data-instrument="${layer}" aria-label="${layerNames[layer]} 음색"></select></div>`).join('')}</div>
      </section>
      <aside class="right-column"><div class="panel starfield"><canvas id="starfield" role="img" aria-label="소리에 반응하는 별하늘"></canvas></div><section class="panel controls-panel">
        <div class="panel-head"><h2>조절</h2></div>
        <div class="fader-list">${[
          ['bpm', '템포', 50, 180, 'BPM', ''],
          ['energy', '에너지', 0, 100, '%', '음표와 리듬의 밀도'],
          ['warmth', '온기', 0, 100, '%', '높을수록 부드러운 음색'],
          ['evolution', '변화', 0, 100, '%', '다음 구간에서 프레이즈가 변할 확률'],
          ['reverb', '리버브', 0, 100, '%', ''],
          ['volume', '볼륨', 0, 100, '%', ''],
        ].map(([key, label, min, max, unit, tip]) => `<div class="fader"><div class="fader-heading"><label for="${key}">${label}</label>${tip ? `<button class="help tip" aria-label="${label} 설명" aria-describedby="${key}-tip">?<span id="${key}-tip" class="tooltip" role="tooltip">${tip}</span></button>` : ''}<span class="fader-value"><output id="${key}-value" for="${key}"></output><span class="unit">${unit}</span></span></div><input id="${key}" type="range" min="${min}" max="${max}" step="1"/></div>`).join('')}</div>
        <div class="timer-section"><div class="timer-head"><span>타이머</span><span class="mono" id="timer-left"></span></div><div class="timer-options" role="group" aria-label="집중 타이머"><button data-timer="0" aria-pressed="true">계속</button><button data-timer="25" aria-pressed="false">25분</button><button data-timer="50" aria-pressed="false">50분</button></div></div>
      </section></aside>
    </div>
    <section class="panel saved-panel"><h2>저장한 음악</h2><div id="favorites"></div></section>
  </main>
  <footer><span>© 2026 Yakshawan</span><div><a href="./LICENSE.txt" target="_blank" rel="noopener noreferrer">이용 조건</a><button class="text-button" id="about">앱 정보</button></div></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="about-dialog"><div class="dialog-head"><h2>Kalavinka · 가릉빈가</h2><button id="close-about" class="icon-button" aria-label="닫기">×</button></div><p>30종 코드 진행에 화음, 프레이즈, 베이스와 리듬을 배치합니다. 구간 끝의 코드 변형과 간헐적인 드럼 필인이 이어집니다. 비트가 쉬는 구간과 아르페지오가 이어지고, 변화 값을 높이면 다음 편곡에서 프레이즈가 더 자주 바뀝니다.</p><p>음악은 브라우저에서 합성하고 EQ·컴프레션·피크 제어로 전체 출력을 다듬습니다. 설정과 저장한 음악은 이 브라우저에 보관되며 공유 링크에는 음악 설정이 담깁니다. 기존에 저장한 음악과 링크는 이전 생성 규칙으로 재생됩니다.</p><p>Space: 재생·정지. 탭을 닫거나 기기가 잠자기에 들어가면 재생이 멈출 수 있습니다.</p><p>v0.9.0 · © 2026 Yakshawan · All rights reserved.</p><a class="inline-link" href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener noreferrer">외부 구성요소 ${icon('arrow')}</a></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
function toast(message: string) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => $('#toast').classList.remove('visible'), 3600);
}
function persist() { if (!write(STORAGE, settings)) toast('브라우저 저장 공간을 사용할 수 없어 이번 설정은 저장되지 않았어요.'); }
function renderSettings() {
  $<HTMLInputElement>('#bpm').max = settings.generatorVersion >= 3 ? '180' : '130';
  for (const key of ['bpm', 'energy', 'warmth', 'evolution', 'reverb', 'volume'] as const) {
    const input = $<HTMLInputElement>(`#${key}`);
    input.value = String(settings[key]);
    input.style.setProperty('--progress', `${(settings[key] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
    $(`#${key}-value`).textContent = String(settings[key]);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-profile]')) {
    button.setAttribute('aria-pressed', String(button.dataset.profile === settings.profile));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-layer]')) {
    button.setAttribute('aria-pressed', String(settings.layers[button.dataset.layer as Layer]));
  }
  for (const select of document.querySelectorAll<HTMLSelectElement>('[data-instrument]')) {
    const layer = select.dataset.instrument as Layer;
    select.innerHTML = (settings.generatorVersion < 3 ? '<option value="legacy">기존 음색</option>' : '') + INSTRUMENTS[layer].map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    select.value = settings.instruments[layer];
  }
  $<HTMLSelectElement>('#groove').hidden = settings.profile !== 'dub';
  $<HTMLSelectElement>('#groove').value = settings.groove;
  $('#now-title').textContent = PROFILES[settings.profile].name;
  renderChords(); renderFavorites();
}
let chordLabels = '';
function renderChords(audible = settings, bar = 0) {
  const chords = progression(audible, bar), labels = chords.map(c=>c.label).join('|');
  if(labels === chordLabels) return;
  chordLabels = labels;
  $('#chords').innerHTML = chords.map((chord, i) => `<div class="chord-cell" data-chord="${i}"><span class="chord-name">${chord.label}</span><div class="chord-progress"></div></div>`).join('');
}
function renderFavorites() {
  const exists = favorites.some((item) => JSON.stringify(item.settings) === JSON.stringify(settings));
  $('#favorite').classList.toggle('is-saved', exists);
  $('#favorites').innerHTML = favorites.length ? `<div class="favorite-grid">${favorites.map((item) => `<div class="favorite-item"><button class="favorite-load" data-load="${item.id}" aria-label="${PROFILES[item.settings.profile].name} ${item.settings.seed} 불러오기"><span>${PROFILES[item.settings.profile].name}</span></button><button class="favorite-delete" data-delete="${item.id}" aria-label="${PROFILES[item.settings.profile].name} ${item.settings.seed} 저장 삭제">×</button></div>`).join('')}</div>` : `<span class="collection-empty">—</span>`;
}
function renderPlayback() {
  const playing = engine.playing;
  $('#play').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${busy ? '준비 중' : playing ? '정지' : '재생'}</span>`;
  $('#play').setAttribute('aria-label', playing ? '음악 정지' : '음악 재생');
  $<HTMLButtonElement>('#play').disabled = busy;
  $<HTMLButtonElement>('#regenerate').disabled = busy;
  document.querySelectorAll<HTMLSelectElement>('[data-instrument], #groove').forEach(select => { select.disabled = busy; });
  document.body.classList.toggle('is-playing', playing);
  $('#status-text').textContent = busy ? '준비 중' : playing ? '재생 중' : '정지';
}
async function togglePlayback() {
  if (busy) return;
  busy = true; renderPlayback();
  try {
    if (engine.playing) await engine.stop();
    else { await engine.start(settings); engine.setVolume(settings.volume); engine.setReverb(settings.reverb); engine.setTimer(timer); }
  } catch (error) { await engine.stop(); toast(error instanceof Error ? error.message : '음악을 시작하지 못했어요. 다시 시도해 주세요.'); }
  finally { busy = false; renderPlayback(); updateMediaSession(); }
}
async function replace(next: Settings) {
  if (busy) return;
  settings = normalizeSettings(next); persist(); renderSettings();
  if (engine.playing) {
    busy = true; renderPlayback();
    try { await engine.regenerate(settings); engine.setVolume(settings.volume); engine.setReverb(settings.reverb); } catch { await engine.stop(); toast('음악을 바꾸지 못했어요. 다시 재생해 주세요.'); }
    finally { busy = false; renderPlayback(); }
  }
  updateMediaSession();
}
$('#play').addEventListener('click', () => void togglePlayback());
$('#regenerate').addEventListener('click', () => { void replace(regenerateSettings(settings)); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-profile]')) button.addEventListener('click', () => {
  if (button.dataset.profile !== settings.profile) void replace(selectProfile(settings, button.dataset.profile as ProfileId));
});
for (const key of ['bpm', 'energy', 'warmth', 'evolution', 'reverb', 'volume'] as const) {
  $<HTMLInputElement>(`#${key}`).addEventListener('input', (event) => {
    settings = { ...settings, [key]: Number((event.target as HTMLInputElement).value) };
    if (key === 'volume') engine.setVolume(settings.volume);
    else if (key === 'reverb') engine.setReverb(settings.reverb);
    else engine.update(settings);
    persist(); renderSettings();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-layer]')) button.addEventListener('click', () => {
  const layer = button.dataset.layer as Layer;
  settings = { ...settings, layers: { ...settings.layers, [layer]: !settings.layers[layer] } };
  engine.update(settings); persist(); renderSettings();
});
for (const select of document.querySelectorAll<HTMLSelectElement>('[data-instrument]')) select.addEventListener('change', () => {
  const layer = select.dataset.instrument as Layer;
  const upgraded = upgradeSettings(settings);
  const next = { ...upgraded, instruments: { ...upgraded.instruments, [layer]: select.value } };
  if (next.generatorVersion !== settings.generatorVersion) { void replace(next); return; }
  settings = next; engine.update(settings); persist(); renderSettings();
});
$('#groove').addEventListener('change', () => {
  const groove = $<HTMLSelectElement>('#groove').value as Settings['groove'];
  void replace({ ...upgradeSettings(settings), groove, bpm: groove === 'dnb' ? 170 : PROFILES.dub.bpm });
});
$('#favorite').addEventListener('click', () => {
  const same = JSON.stringify(settings);
  if (favorites.some((item) => JSON.stringify(item.settings) === same)) { toast('이미 저장한 흐름이에요.'); return; }
  if (favorites.length >= 12) { toast('12개까지 저장할 수 있어요. 이전 흐름을 지우고 새로 저장해 주세요.'); return; }
  favorites = [{ id: String(Date.now()), settings: structuredClone(settings) }, ...favorites];
  const stored = write(FAVORITES, favorites); renderFavorites();
  toast(stored ? '이 흐름을 저장했어요.' : '브라우저 저장 공간이 없어 새로고침하면 저장이 사라져요.');
});
$('#favorites').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!target) return;
  if (target.dataset.load) {
    const favorite = favorites.find((item) => item.id === target.dataset.load);
    if (favorite) void replace(structuredClone(favorite.settings));
  }
  if (target.dataset.delete) {
    favorites = favorites.filter((item) => item.id !== target.dataset.delete);
    write(FAVORITES, favorites); renderFavorites(); toast('저장한 흐름을 지웠어요.');
  }
});
$('#share').addEventListener('click', async () => {
  const url = new URL(location.href); url.hash = `mix=${encodeURIComponent(JSON.stringify(settings))}`;
  try { await navigator.clipboard.writeText(url.href); toast('같은 음악으로 시작하는 링크를 복사했어요.'); }
  catch { const input = document.createElement('textarea'); input.value = url.href; document.body.append(input); input.select();
    const copied = document.execCommand('copy'); input.remove(); toast(copied ? '음악 링크를 복사했어요.' : '링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.'); }
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-timer]')) button.addEventListener('click', () => {
  timer = Number(button.dataset.timer); engine.setTimer(timer);
  document.querySelectorAll('[data-timer]').forEach((item) => item.setAttribute('aria-pressed', String(Number((item as HTMLElement).dataset.timer) === timer)));
  if (!engine.playing && timer) toast(`재생을 시작하면 ${timer}분 타이머가 시작돼요.`);
});
$('#focus').addEventListener('click', () => {
  focusMode = !focusMode; document.body.classList.toggle('focus-mode', focusMode);
  $('#focus').setAttribute('aria-pressed', String(focusMode));
  $('#focus').innerHTML = `${icon('focus')}<span>${focusMode ? '전체 화면' : '집중 화면'}</span>`;
});
const systemDark = matchMedia('(prefers-color-scheme: dark)');
let theme = read('worksong.theme') ?? 'dark';
if (!['dark', 'light', 'system'].includes(theme)) theme = 'dark';
function applyTheme() {
  document.documentElement.dataset.themeMode = theme === 'system' ? systemDark.matches ? 'dark' : 'light' : theme;
  document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === theme)));
}
document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => button.addEventListener('click', () => { theme = button.dataset.theme; write('worksong.theme', theme); applyTheme(); }));
systemDark.addEventListener('change', applyTheme);
$('#about').addEventListener('click', () => $<HTMLDialogElement>('#about-dialog').showModal());
$('#close-about').addEventListener('click', () => $<HTMLDialogElement>('#about-dialog').close());
document.querySelectorAll<HTMLButtonElement>('.help').forEach((button) => button.addEventListener('click', () => {
  const open = !button.classList.contains('open');
  document.querySelectorAll('.help.open').forEach((item) => item.classList.remove('open'));
  button.classList.toggle('open', open);
}));
document.addEventListener('pointerdown', (event) => {
  if (!(event.target as HTMLElement).closest('.help')) document.querySelectorAll('.help.open').forEach((item) => item.classList.remove('open'));
});
$<HTMLDialogElement>('#about-dialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) $<HTMLDialogElement>('#about-dialog').close(); });
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (event.code === 'Space' && !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'A'].includes(target.tagName) && !$<HTMLDialogElement>('#about-dialog').open) {
    event.preventDefault(); void togglePlayback();
  }
});
engine.onStop = () => { renderPlayback(); updateMediaSession(); toast('집중 시간이 끝났어요. 잠깐 쉬어가세요.'); };
engine.onError = (message) => { toast(message); renderPlayback(); };
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: PROFILES[settings.profile].name, artist: 'Kalavinka', album: '당신의 속도로 흐르는 음악' });
  navigator.mediaSession.playbackState = engine.playing ? 'playing' : 'paused';
  for (const action of ['play', 'pause', 'stop'] as MediaSessionAction[]) {
    try { navigator.mediaSession.setActionHandler(action, () => { if ((action === 'play') !== engine.playing) void togglePlayback(); }); } catch { /* unsupported media key */ }
  }
}
const time = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const canvas = $<HTMLCanvasElement>('#scope');
const context = canvas.getContext('2d')!;
let samples = new Float32Array(2048);
let lastFrame = 0;
let peak = 0;
const starfield = new Starfield($<HTMLCanvasElement>('#starfield'));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function draw(timestamp: number) {
  requestAnimationFrame(draw);
  if (document.hidden || timestamp - lastFrame < (reduceMotion.matches ? 200 : engine.playing ? 1000 / 30 : 66)) return;
  lastFrame = timestamp;
  starfield.draw(timestamp, engine.playing ? engine.analyser ?? null : null, reduceMotion.matches);
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
  const style = getComputedStyle(document.documentElement);
  context.strokeStyle = style.getPropertyValue('--line'); context.lineWidth = 1;
  for (let y = 1; y < 4; y++) { context.beginPath(); context.moveTo(0, height * y / 4); context.lineTo(width, height * y / 4); context.stroke(); }
  for (let x = 1; x < 12; x++) { context.beginPath(); context.moveTo(width * x / 12, 0); context.lineTo(width * x / 12, height); context.stroke(); }
  peak = 0;
  if (engine.playing && engine.analyser) {
    engine.analyser.getFloatTimeDomainData(samples); context.strokeStyle = style.getPropertyValue('--text'); context.lineWidth = 1.2;
    context.beginPath();
    for (let i = 0; i < samples.length; i += 4) {
      peak = Math.max(peak, Math.abs(samples[i]));
      const x = i / samples.length * width, y = height / 2 - samples[i] * height * .52;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  } else {
    context.strokeStyle = style.getPropertyValue('--line-strong'); context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
  }
  $('#elapsed').textContent = time(engine.elapsed);
  const audible = engine.audibleSettings ?? settings;
  const bar = engine.bar, hold = chordHold(audible), length = hold * 4;
  const barWithin = bar % length;
  renderChords(audible, bar);
  $('#bar-label').textContent = engine.playing ? `${Math.floor(barWithin) + 1} / ${length}` : '';
  $('#status-text').textContent = busy ? '준비 중' : engine.playing ? engine.pending ? '다음 마디에 반영' : '재생 중' : '정지';
  for (const cell of document.querySelectorAll<HTMLElement>('[data-chord]')) {
    const current = engine.playing && Math.floor(barWithin / hold) === Number(cell.dataset.chord);
    cell.classList.toggle('current', current);
    cell.style.setProperty('--chord-progress', current ? `${(barWithin % hold) / hold * 100}%` : '0%');
  }
  $('#timer-left').textContent = engine.remaining === null ? timer ? `${timer}:00` : '' : time(engine.remaining);

}
// Read-only inspection surface for browser/audio verification; it is not needed by the player.
Object.defineProperty(window, '__worksong', { value: { diagnostics: () => ({ ...engine.diagnostics(), peak, sky: starfield.diagnostics(), harmony: { recipe: (engine.audibleSettings ?? settings).generatorVersion >= 5 ? recipeFor(engine.audibleSettings ?? settings).id : null, ending: (engine.audibleSettings ?? settings).generatorVersion >= 5 && hasEnding(engine.audibleSettings ?? settings, engine.bar), chords: progression(engine.audibleSettings ?? settings, engine.bar).map(c=>c.label) }, settings: structuredClone(settings) }),
  events: (begin: number, end: number) => musicScore(settings).onsets(begin, end).length } });
applyTheme(); renderSettings(); renderPlayback(); requestAnimationFrame(draw);
if (shared) toast('공유한 흐름을 불러왔어요. 재생을 눌러 시작하세요.');
