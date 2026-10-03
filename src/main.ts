// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import './style.css';
import { MusicEngine } from './audio';
import { LAYERS, PROFILES, normalizeSettings, newSeed, selectProfile, progression, musicPattern, type Settings, type ProfileId, type Layer } from './music';

const SOURCE = 'https://github.com/heavyrain39/worksong';
const STORAGE = 'worksong.v1';
const FAVORITES = 'worksong.favorites.v1';
const read = (key: string) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const saved = read(STORAGE);
let settings = normalizeSettings(saved);
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
const profileGraphic = (id: ProfileId) => id === 'lofi' ? '<path d="M0 26h7V12h6v26h6V18h6v13h6V8h6v35h6V16h6v19h6V22h7"/>' : id === 'ambient'
  ? '<path d="M0 30c10 0 9-17 20-17s10 23 22 23S53 15 64 15M0 36c9 0 12-14 21-14s12 20 23 20S55 25 64 25"/>'
  : '<path d="M0 32h8V13h8v19h8V13h8v19h8V13h8v19h8V13h8"/>';
const layerNames: Record<Layer, string> = { harmony: '화음', bass: '베이스', rhythm: '리듬', motif: '멜로디' };
const layerDescriptions: Record<Layer, string> = { harmony: '음악의 온도', bass: '흐름의 중심', rhythm: '작업의 박자', motif: '작은 디테일' };

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="${location.pathname}" aria-label="WORKSONG 홈">WORKSONG<span class="brand-cross">+</span></a>
    <div class="header-description">당신의 속도로 흐르는 음악</div>
    <div class="header-right"><span class="version">PROTOTYPE / 01</span><div class="theme-switch" role="group" aria-label="화면 테마"><button data-theme="light" title="밝은 테마" aria-label="밝은 테마">◑</button><button data-theme="dark" title="어두운 테마" aria-label="어두운 테마">◐</button><button data-theme="system" title="시스템 테마" aria-label="시스템 테마">◒</button></div></div>
  </header>
  <main class="workspace">
    <div class="intro"><div><div class="eyebrow">GENERATIVE WORK MUSIC</div><h1>일에 몰입할 시간.</h1><p>분위기를 고르고, 재생을 누르세요. 나머지는 음악에 맡겨두세요.</p></div><span class="intro-mark" aria-hidden="true">⌖</span></div>
    <div class="console-grid">
      <aside class="panel atmosphere-panel">
        <div class="panel-head"><h2>분위기</h2><span class="section-number">01 / ATMOSPHERE</span></div>
        <div class="profile-list" role="group" aria-label="음악 분위기">${(Object.keys(PROFILES) as ProfileId[]).map((id) => {
          const p = PROFILES[id]; return `<button class="profile" data-profile="${id}" aria-pressed="false"><div class="profile-top"><span class="mono">${p.number}</span><span class="profile-indicator" aria-hidden="true"></span></div><svg class="profile-art" viewBox="0 0 64 50" aria-hidden="true">${profileGraphic(id)}</svg><span class="profile-name">${p.name}</span><span class="profile-subtitle">${p.subtitle}</span><span class="profile-tag">${p.tag}</span></button>`;
        }).join('')}</div>
        <div class="atmosphere-note"><span class="eyebrow">MADE FOR YOUR FLOW</span><p id="profile-description"></p></div>
      </aside>
      <section class="panel player-panel">
        <div class="panel-head"><h2>지금 흐르는 음악</h2><div class="status"><span class="status-led"></span><span id="status-text" role="status" aria-live="polite">재생 준비</span></div></div>
        <div class="deck">
          <div class="deck-top"><span id="now-title">Warm desk</span><span class="mono" id="elapsed">00:00</span></div>
          <div class="scope-wrap"><canvas id="scope" aria-label="재생 오디오 파형"></canvas><div class="scope-idle" id="scope-idle"><span class="idle-symbol">∿</span><span>음악이 시작될 자리를 남겨두었어요.</span></div><div class="scope-label"><span>STEREO / LIVE</span><span id="level-label">— dB</span></div></div>
          <div class="chord-header"><span class="eyebrow">HARMONIC FLOW</span><span class="mono" id="bar-label">BAR 01 / 08</span></div>
          <div class="chord-lane" id="chords" aria-label="코드 진행"></div>
          <div class="transport">
            <button class="play-button" id="play" aria-label="음악 재생">${icon('play')}<span>재생</span></button>
            <button class="compact-btn regenerate" id="regenerate">${icon('refresh')}<span>새 흐름</span></button>
            <button class="icon-button" id="favorite" aria-label="현재 음악 저장" title="현재 음악 저장">${icon('save')}</button>
            <button class="icon-button" id="share" aria-label="현재 음악 링크 복사" title="현재 음악 링크 복사">${icon('share')}</button>
          </div>
          <div class="player-bottom"><span class="mono" id="seed-label">SEED / SLOWFLOW</span><button class="text-button" id="focus" aria-pressed="false">${icon('focus')}<span>집중 화면</span></button></div>
        </div>
        <div class="layer-section"><div class="layer-heading"><span class="eyebrow">YOUR MIX</span><span>필요한 소리만 남겨두세요.</span></div><div class="layer-grid">${LAYERS.map((layer, i) => `<button class="layer" data-layer="${layer}" aria-pressed="true"><span class="layer-top"><span class="mono">0${i + 1}</span><span class="switch" aria-hidden="true"></span></span><span class="layer-name">${layerNames[layer]}</span><span class="layer-description">${layerDescriptions[layer]}</span><div class="layer-meter" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div></button>`).join('')}</div></div>
      </section>
      <aside class="panel controls-panel">
        <div class="panel-head"><h2>나의 속도</h2><span class="section-number">02 / TUNE</span></div>
        <div class="fader-list">
          ${[
            ['bpm', '템포', '느긋하게', '경쾌하게', 50, 130, 'BPM'],
            ['energy', '에너지', '차분하게', '선명하게', 0, 100, '%'],
            ['warmth', '온기', '맑게', '포근하게', 0, 100, '%'],
            ['evolution', '변화', '익숙하게', '새롭게', 0, 100, '%'],
          ].map(([key, label, left, right, min, max, unit]) => `<div class="fader"><label for="${key}">${label}<span class="fader-value"><output id="${key}-value" for="${key}"></output><span class="unit">${unit}</span></span></label><input id="${key}" type="range" min="${min}" max="${max}" step="1"/><div class="fader-ends"><span>${left}</span><span>${right}</span></div></div>`).join('')}
        </div>
        <div class="volume-section"><div class="fader"><label for="volume">볼륨<span class="fader-value"><output id="volume-value" for="volume"></output><span class="unit">%</span></span></label><input id="volume" type="range" min="0" max="100" step="1" aria-label="마스터 볼륨"/></div></div>
        <div class="timer-section"><div class="timer-head"><span>집중 타이머</span><span class="mono" id="timer-left">계속 재생</span></div><div class="timer-options" role="group" aria-label="집중 타이머"><button data-timer="0" aria-pressed="true">계속</button><button data-timer="25" aria-pressed="false">25분</button><button data-timer="50" aria-pressed="false">50분</button></div><p>시간이 끝나면 음악이 부드럽게 멈춰요.</p></div>
      </aside>
    </div>
    <section class="panel saved-panel"><div class="panel-head"><h2>다시 듣고 싶은 흐름</h2><span class="section-number">03 / COLLECTION</span></div><div id="favorites"></div></section>
    <div class="help-row"><span>새 흐름으로 음악을 바꾸고, ♡로 마음에 드는 구성을 저장하세요.</span><span>SPACE — 재생 / 정지</span></div>
  </main>
  <footer><span>WORKSONG <span class="footer-divider">/</span> MADE BY YAKSHAWAN</span><div><a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">Strudel © contributors</a><span>·</span><a href="${SOURCE}" target="_blank" rel="noopener noreferrer">오픈소스 · AGPL-3.0</a><button class="text-button" id="about">이 앱에 대하여</button></div></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="about-dialog"><div class="dialog-head"><span class="eyebrow">ABOUT WORKSONG</span><button id="close-about" class="icon-button" aria-label="닫기">×</button></div><h2>오래 듣기 위한 작은 음악 도구.</h2><p>음악은 브라우저에서 실시간으로 만들어집니다. 정해진 화음과 리듬에 작은 변화를 더해, 작업 중 듣기 편한 흐름을 만듭니다.</p><p>로그인·음원 업로드·유료 API가 없습니다. 설정과 저장한 흐름은 이 브라우저에만 보관됩니다. 공유 링크에는 음악 설정이 담깁니다.</p><p>현재는 합성음 기반 프로토타입입니다. 재생 탭을 열어두면 다른 탭에서 작업할 수 있으며, 브라우저를 닫거나 기기가 잠자기에 들어가면 재생이 멈출 수 있습니다.</p><p>Strudel © Strudel contributors. 이 앱과 Strudel은 AGPL-3.0-or-later로 제공됩니다.</p><a class="inline-link" href="${SOURCE}" target="_blank" rel="noopener noreferrer">소스 코드 보기 ${icon('arrow')}</a></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
function toast(message: string) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => $('#toast').classList.remove('visible'), 3600);
}
function persist() { if (!write(STORAGE, settings)) toast('브라우저 저장 공간을 사용할 수 없어 이번 설정은 저장되지 않았어요.'); }
function renderSettings() {
  for (const key of ['bpm', 'energy', 'warmth', 'evolution', 'volume'] as const) {
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
  $('#profile-description').textContent = PROFILES[settings.profile].description;
  $('#now-title').textContent = PROFILES[settings.profile].name;
  $('#seed-label').textContent = `SEED / ${settings.seed}`;
  renderChords(); renderFavorites();
}
function renderChords() {
  const hold = settings.profile === 'ambient' ? 4 : 2;
  $('#chords').innerHTML = progression(settings).map((chord, i) => `<div class="chord-cell" data-chord="${i}"><span class="mono chord-index">${String(i * hold + 1).padStart(2, '0')}–${String((i + 1) * hold).padStart(2, '0')}</span><span class="chord-name">${chord.label}</span><div class="chord-progress"></div></div>`).join('');
}
function renderFavorites() {
  const exists = favorites.some((item) => item.settings.seed === settings.seed && item.settings.profile === settings.profile);
  $('#favorite').classList.toggle('is-saved', exists);
  $('#favorites').innerHTML = favorites.length ? `<div class="favorite-grid">${favorites.map((item) => `<div class="favorite-item"><button class="favorite-load" data-load="${item.id}"><span>${PROFILES[item.settings.profile].name}</span><span class="mono">${item.settings.bpm} BPM <span class="favorite-seed">/ ${item.settings.seed}</span></span></button><button class="favorite-delete" data-delete="${item.id}" aria-label="${item.settings.seed} 저장 삭제">×</button></div>`).join('')}</div>` : `<div class="collection-empty"><span class="empty-heart">♡</span><p>마음에 드는 순간을 남겨두세요.<br/><span>저장한 흐름은 같은 구성으로 다시 시작할 수 있어요.</span></p></div>`;
}
function renderPlayback() {
  const playing = engine.playing;
  $('#play').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${busy ? '준비 중' : playing ? '정지' : '재생'}</span>`;
  $('#play').setAttribute('aria-label', playing ? '음악 정지' : '음악 재생');
  $<HTMLButtonElement>('#play').disabled = busy;
  $<HTMLButtonElement>('#regenerate').disabled = busy;
  document.body.classList.toggle('is-playing', playing);
  $('#scope-idle').hidden = playing;
  $('#status-text').textContent = busy ? '소리를 준비하는 중' : playing ? '재생 중' : '재생 준비';
}
async function togglePlayback() {
  if (busy) return;
  busy = true; renderPlayback();
  try {
    if (engine.playing) await engine.stop();
    else { await engine.start(settings); engine.setTimer(timer); }
  } catch (error) { await engine.stop(); toast(error instanceof Error ? error.message : '음악을 시작하지 못했어요. 다시 시도해 주세요.'); }
  finally { busy = false; renderPlayback(); updateMediaSession(); }
}
async function replace(next: Settings) {
  if (busy) return;
  settings = normalizeSettings(next); persist(); renderSettings();
  if (engine.playing) {
    busy = true; renderPlayback();
    try { await engine.regenerate(settings); } catch { await engine.stop(); toast('음악을 바꾸지 못했어요. 다시 재생해 주세요.'); }
    finally { busy = false; renderPlayback(); }
  }
  updateMediaSession();
}
$('#play').addEventListener('click', () => void togglePlayback());
$('#regenerate').addEventListener('click', () => { void replace({ ...settings, seed: newSeed() }); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-profile]')) button.addEventListener('click', () => {
  if (button.dataset.profile !== settings.profile) void replace(selectProfile(settings, button.dataset.profile as ProfileId));
});
for (const key of ['bpm', 'energy', 'warmth', 'evolution', 'volume'] as const) {
  $<HTMLInputElement>(`#${key}`).addEventListener('input', (event) => {
    settings = { ...settings, [key]: Number((event.target as HTMLInputElement).value) };
    if (key === 'volume') engine.setVolume(settings.volume); else engine.update(settings);
    persist(); renderSettings();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-layer]')) button.addEventListener('click', () => {
  const layer = button.dataset.layer as Layer;
  settings = { ...settings, layers: { ...settings.layers, [layer]: !settings.layers[layer] } };
  engine.update(settings); persist(); renderSettings();
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
  navigator.mediaSession.metadata = new MediaMetadata({ title: PROFILES[settings.profile].name, artist: 'WORKSONG', album: '당신의 속도로 흐르는 음악' });
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
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function draw(timestamp: number) {
  requestAnimationFrame(draw);
  if (timestamp - lastFrame < (reduceMotion.matches || !engine.playing ? 200 : 50)) return;
  lastFrame = timestamp;
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
      const x = i / samples.length * width, y = height / 2 - samples[i] * height * 2.6;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  } else {
    context.strokeStyle = style.getPropertyValue('--line-strong'); context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
  }
  $('#level-label').textContent = engine.playing && peak > .00001 ? `${Math.round(20 * Math.log10(peak))} dB` : '— dB';
  $('#elapsed').textContent = time(engine.elapsed);
  const audible = engine.audibleSettings ?? settings;
  const bar = engine.bar, length = audible.profile === 'ambient' ? 16 : 8, hold = length / 4;
  const barWithin = bar % length;
  $('#bar-label').textContent = `BAR ${String(Math.floor(barWithin) + 1).padStart(2, '0')} / ${length}`;
  $('#status-text').textContent = busy ? '소리를 준비하는 중' : engine.playing ? engine.pending ? '다음 마디에 반영' : '재생 중' : '재생 준비';
  for (const cell of document.querySelectorAll<HTMLElement>('[data-chord]')) {
    const current = engine.playing && Math.floor(barWithin / hold) === Number(cell.dataset.chord);
    cell.classList.toggle('current', current);
    cell.style.setProperty('--chord-progress', current ? `${(barWithin % hold) / hold * 100}%` : '0%');
  }
  $('#timer-left').textContent = engine.remaining === null ? timer ? `${timer}:00` : '계속 재생' : time(engine.remaining);
  for (const layer of document.querySelectorAll<HTMLElement>('[data-layer]')) {
    const active = engine.playing && settings.layers[layer.dataset.layer as Layer];
    const bars = layer.querySelectorAll('i');
    bars.forEach((item, i) => item.classList.toggle('lit', active && i < Math.min(12, Math.floor(peak * 100 + 1))));
  }
}
// Read-only inspection surface for browser/audio verification; it is not needed by the player.
Object.defineProperty(window, '__worksong', { value: { diagnostics: () => ({ ...engine.diagnostics(), peak, settings: structuredClone(settings) }),
  events: (begin: number, end: number) => musicPattern(settings).queryArc(begin, end).filter((hap) => hap.hasOnset()).length } });
applyTheme(); renderSettings(); renderPlayback(); requestAnimationFrame(draw);
if (shared) toast('공유한 흐름을 불러왔어요. 재생을 눌러 시작하세요.');
