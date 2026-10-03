// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import './style.css';
import {browserLanguage, translate, instrumentName, type Language, type TextKey} from './i18n';
import {resetSliders} from './controls';
import { Starfield } from './starfield';
import { recipeFor, hasEnding } from './harmony-v5';
import { INSTRUMENTS } from './instruments';
import { MusicEngine } from './audio';
import { LAYERS, PROFILES, normalizeSettings, upgradeSettings, regenerateSettings, selectProfile, progression, chordHold, musicScore, type Settings, type ProfileId, type Layer } from './music';

const PORTFOLIO = 'https://heavyrain39.github.io/portfolio/';
const STORAGE = 'worksong.v1';
const FAVORITES = 'worksong.favorites.v1';
const read = (key: string) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
let language: Language = browserLanguage(navigator.language);
const t = (key: TextKey, values: Record<string, string | number> = {}) => translate(language, key, values);
const aria = (key: TextKey) => `data-i18n-aria="${key}" aria-label="${t(key)}"`;
const label = (key: TextKey) => `<span data-i18n="${key}">${t(key)}</span>`;
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
const FADERS = [
  ['bpm',50,180,'BPM',''], ['energy',0,100,'%','energyTip'], ['warmth',0,100,'%','warmthTip'],
  ['evolution',0,100,'%','evolutionTip'], ['reverb',0,100,'%',''], ['volume',0,100,'%',''],
] as const;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="${location.pathname}" ${aria('home')}><span class="brand-name" aria-hidden="true"><span class="brand-en" lang="en">Kalavinka</span><span class="brand-ko" lang="ko">가릉빈가</span></span><span class="brand-cross" aria-hidden="true">+</span></a>
    <div class="header-actions"><div class="language-switch" role="group" ${aria('language')}><button data-language="ko" ${aria('korean')}>KO</button><button data-language="en" ${aria('english')}>EN</button></div><div class="theme-switch" role="group" ${aria('theme')}><button data-theme="light" ${aria('light')}>◑</button><button data-theme="dark" ${aria('dark')}>◐</button><button data-theme="system" ${aria('system')}>◒</button></div></div>
  </header>
  <main class="workspace">
    <div class="console-grid">
      <aside class="panel atmosphere-panel">
        <div class="profile-list" role="group" ${aria('atmosphere')}>${(Object.keys(PROFILES) as ProfileId[]).map((id) => `<button class="profile" data-profile="${id}" aria-pressed="false"><svg class="profile-art" viewBox="0 0 64 48" aria-hidden="true">${profileGraphic(id)}</svg><span class="profile-name" data-i18n="${id}">${t(id)}</span><span class="profile-indicator" aria-hidden="true"></span></button>`).join('')}</div>
      </aside>
      <section class="panel player-panel" ${aria('player')}>
        <div class="deck">
          <div class="deck-top"><h1 id="now-title"></h1><span class="mono" id="elapsed">00:00</span></div>
          <div class="scope-wrap"><canvas id="scope" ${aria('waveform')}></canvas></div>
          <div class="playback-info"><span id="status-text" role="status"></span><span class="mono" id="bar-label"></span></div>
          <div class="chord-lane" id="chords" ${aria('chords')}></div>
          <div class="transport">
            <button class="play-button" id="play">${icon('play')}${label('play')}</button>
            <button class="compact-btn regenerate" id="regenerate">${icon('refresh')}${label('regenerate')}</button>
            <button class="icon-button tip" id="favorite" ${aria('save')}>${icon('save')}<span class="tooltip" role="tooltip" data-i18n="save">${t('save')}</span></button>
            <button class="icon-button tip" id="share" ${aria('share')}>${icon('share')}<span class="tooltip" role="tooltip" data-i18n="share">${t('share')}</span></button>
          </div>
          <div class="player-bottom"><select id="groove" class="instrument-select groove-select" ${aria('groove')}><option value="straight" data-i18n="straight">${t('straight')}</option><option value="dnb" data-i18n="dnb">${t('dnb')}</option></select><button class="text-button" id="focus" aria-pressed="false">${icon('focus')}<span>${t('focus')}</span></button></div>
        </div>
        <div class="layer-grid" role="group" ${aria('instruments')}>${LAYERS.map((layer) => `<div class="part"><button class="layer" data-layer="${layer}" aria-pressed="true">${label(layer)}<span class="switch" aria-hidden="true"></span></button><select class="instrument-select" data-instrument="${layer}" aria-label="${t('timbre',{part:t(layer)})}"></select></div>`).join('')}</div>
      </section>
      <aside class="right-column"><div class="panel starfield"><canvas id="starfield" role="img" ${aria('sky')}></canvas></div><section class="panel controls-panel">
        <div class="panel-head controls-head"><h2 data-i18n="controls">${t('controls')}</h2><button class="text-button" id="reset-controls" ${aria('resetLabel')}>${label('reset')}</button></div>
        <div class="fader-list">${FADERS.map(([key,min,max,unit,tip]) => `<div class="fader"><div class="fader-heading"><label for="${key}" data-i18n="${key}">${t(key)}</label>${tip ? `<button class="help tip" data-help="${key}" aria-label="${t('help',{label:t(key)})}" aria-describedby="${key}-tip">?<span id="${key}-tip" class="tooltip" role="tooltip" data-i18n="${tip}">${t(tip)}</span></button>` : ''}<span class="fader-value"><output id="${key}-value" for="${key}"></output><span class="unit">${unit}</span></span></div><input id="${key}" type="range" min="${min}" max="${max}" step="1"/></div>`).join('')}</div>
        <div class="timer-section"><div class="timer-head">${label('timer')}<span class="mono" id="timer-left"></span></div><div class="timer-options" role="group" ${aria('focusTimer')}><button data-timer="0" aria-pressed="true" data-i18n="continuous">${t('continuous')}</button><button data-timer="25" aria-pressed="false" data-i18n-minutes="25">${t('minutes',{count:25})}</button><button data-timer="50" aria-pressed="false" data-i18n-minutes="50">${t('minutes',{count:50})}</button></div></div>
      </section></aside>
    </div>
    <section class="panel saved-panel"><h2 data-i18n="saved">${t('saved')}</h2><div id="favorites"></div></section>
  </main>
  <footer><span>© 2026 <a class="developer-link" href="${PORTFOLIO}" target="_blank" rel="noopener noreferrer" ${aria('authorPortfolio')}>Yakshawan</a></span><div><a href="./LICENSE.txt" target="_blank" rel="noopener noreferrer" data-i18n="terms">${t('terms')}</a><button class="text-button" id="about" data-i18n="about">${t('about')}</button></div></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="about-dialog"><div class="dialog-head"><h2 data-i18n="appName">${t('appName')}</h2><button id="close-about" class="icon-button" ${aria('close')}>×</button></div><p data-i18n="aboutMusic">${t('aboutMusic')}</p><p data-i18n="aboutPrivacy">${t('aboutPrivacy')}</p><p data-i18n="aboutKeys">${t('aboutKeys')}</p><p>v0.10.0 · © 2026 Yakshawan · ${label('rights')}</p><div class="dialog-links"><a class="inline-link" href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener noreferrer">${label('thirdParty')} ${icon('arrow')}</a><a class="inline-link portfolio-link" href="${PORTFOLIO}" target="_blank" rel="noopener noreferrer">${label('portfolio')} ${icon('arrow')}</a></div></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let currentToast: {key: TextKey; values: Record<string,string|number>} | null = null;
function toast(key: TextKey, values: Record<string,string|number> = {}) {
  currentToast = {key,values};
  $('#toast').textContent = t(key,values); $('#toast').classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => { $('#toast').classList.remove('visible'); currentToast = null; }, 3600);
}
function persist() { if (!write(STORAGE, settings)) toast('storageFailed'); }
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
    select.innerHTML = (settings.generatorVersion < 3 ? `<option value="legacy">${t('legacy')}</option>` : '') + INSTRUMENTS[layer].map(i => `<option value="${i.id}">${instrumentName(i.id,language)}</option>`).join('');
    select.value = settings.instruments[layer];
    select.setAttribute('aria-label',t('timbre',{part:t(layer)}));
  }
  $<HTMLSelectElement>('#groove').hidden = settings.profile !== 'dub';
  $<HTMLSelectElement>('#groove').value = settings.groove;
  $('#now-title').textContent = t(settings.profile);
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
  $('#favorites').innerHTML = favorites.length ? `<div class="favorite-grid">${favorites.map((item) => `<div class="favorite-item"><button class="favorite-load" data-load="${item.id}" aria-label="${t('loadSaved',{name:t(item.settings.profile),seed:item.settings.seed})}"><span>${t(item.settings.profile)}</span></button><button class="favorite-delete" data-delete="${item.id}" aria-label="${t('deleteSaved',{name:t(item.settings.profile),seed:item.settings.seed})}">×</button></div>`).join('')}</div>` : `<span class="collection-empty">—</span>`;
}
function renderPlayback() {
  const playing = engine.playing;
  $('#play').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${busy ? t('preparing') : playing ? t('stop') : t('play')}</span>`;
  $('#play').setAttribute('aria-label', playing ? t('stopMusic') : t('playMusic'));
  $<HTMLButtonElement>('#play').disabled = busy;
  $<HTMLButtonElement>('#regenerate').disabled = busy;
  $<HTMLButtonElement>('#reset-controls').disabled = busy;
  document.querySelectorAll<HTMLSelectElement>('[data-instrument], #groove').forEach(select => { select.disabled = busy; });
  document.body.classList.toggle('is-playing', playing);
  $('#status-text').textContent = busy ? t('preparing') : playing ? t('playing') : t('stop');
}
async function togglePlayback() {
  if (busy) return;
  busy = true; renderPlayback();
  try {
    if (engine.playing) await engine.stop();
    else { await engine.start(settings); engine.setVolume(settings.volume); engine.setReverb(settings.reverb); engine.setTimer(timer); }
  } catch (error) { await engine.stop(); toast(error instanceof Error && error.message === 'AUDIO_UNAVAILABLE' ? 'audioUnavailable' : error instanceof Error && error.message === 'AUDIO_LOCKED' ? 'audioLocked' : 'startFailed'); }
  finally { busy = false; renderPlayback(); updateMediaSession(); }
}
async function replace(next: Settings) {
  if (busy) return;
  settings = normalizeSettings(next); persist(); renderSettings();
  if (engine.playing) {
    busy = true; renderPlayback();
    try { await engine.regenerate(settings); engine.setVolume(settings.volume); engine.setReverb(settings.reverb); } catch { await engine.stop(); toast('changeFailed'); }
    finally { busy = false; renderPlayback(); }
  }
  updateMediaSession();
}
function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t('appName');
  document.querySelector('meta[name="description"]')?.setAttribute('content',t('description'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as TextKey); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label',t(el.dataset.i18nAria as TextKey)));
  document.querySelectorAll<HTMLElement>('[data-i18n-minutes]').forEach(el => { el.textContent = t('minutes',{count:el.dataset.i18nMinutes!}); });
  document.querySelectorAll<HTMLElement>('[data-help]').forEach(el => el.setAttribute('aria-label',t('help',{label:t(el.dataset.help as TextKey)})));
  document.querySelectorAll<HTMLElement>('[data-language]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.language === language)));
  $('#focus').innerHTML = `${icon('focus')}<span>${focusMode ? t('full') : t('focus')}</span>`;
  if (currentToast) $('#toast').textContent = t(currentToast.key,currentToast.values);
  renderSettings(); renderPlayback(); updateMediaSession();
}
document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.language as Language; applyLanguage();
}));
$('#reset-controls').addEventListener('click', () => {
  if (busy) return;
  settings = resetSliders(settings); engine.update(settings); persist(); renderSettings(); toast('resetDone');
});
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
  if (favorites.some((item) => JSON.stringify(item.settings) === same)) { toast('alreadySaved'); return; }
  if (favorites.length >= 12) { toast('savedLimit'); return; }
  favorites = [{ id: String(Date.now()), settings: structuredClone(settings) }, ...favorites];
  const stored = write(FAVORITES, favorites); renderFavorites();
  toast(stored ? 'savedDone' : 'savedTemporary');
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
    write(FAVORITES, favorites); renderFavorites(); toast('deleted');
  }
});
$('#share').addEventListener('click', async () => {
  const url = new URL(location.href); url.hash = `mix=${encodeURIComponent(JSON.stringify(settings))}`;
  try { await navigator.clipboard.writeText(url.href); toast('copied'); }
  catch { const input = document.createElement('textarea'); input.value = url.href; document.body.append(input); input.select();
    const copied = document.execCommand('copy'); input.remove(); toast(copied ? 'copied' : 'copyFailed'); }
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-timer]')) button.addEventListener('click', () => {
  timer = Number(button.dataset.timer); engine.setTimer(timer);
  document.querySelectorAll('[data-timer]').forEach((item) => item.setAttribute('aria-pressed', String(Number((item as HTMLElement).dataset.timer) === timer)));
  if (!engine.playing && timer) toast('timerReady',{count:timer});
});
$('#focus').addEventListener('click', () => {
  focusMode = !focusMode; document.body.classList.toggle('focus-mode', focusMode);
  $('#focus').setAttribute('aria-pressed', String(focusMode));
  $('#focus').innerHTML = `${icon('focus')}<span>${focusMode ? t('full') : t('focus')}</span>`;
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
engine.onStop = () => { renderPlayback(); updateMediaSession(); toast('timerDone'); };
engine.onError = () => { toast('audioError'); renderPlayback(); };
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: t(settings.profile), artist: t('appName'), album: t('album') });
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
  $('#status-text').textContent = busy ? t('preparing') : engine.playing ? engine.pending ? t('pending') : t('playing') : t('stop');
  for (const cell of document.querySelectorAll<HTMLElement>('[data-chord]')) {
    const current = engine.playing && Math.floor(barWithin / hold) === Number(cell.dataset.chord);
    cell.classList.toggle('current', current);
    cell.style.setProperty('--chord-progress', current ? `${(barWithin % hold) / hold * 100}%` : '0%');
  }
  $('#timer-left').textContent = engine.remaining === null ? timer ? `${timer}:00` : '' : time(engine.remaining);

}
// Read-only inspection surface for browser/audio verification; it is not needed by the player.
Object.defineProperty(window, '__worksong', { value: { diagnostics: () => ({ ...engine.diagnostics(), peak, language, sky: starfield.diagnostics(), harmony: { recipe: (engine.audibleSettings ?? settings).generatorVersion >= 5 ? recipeFor(engine.audibleSettings ?? settings).id : null, ending: (engine.audibleSettings ?? settings).generatorVersion >= 5 && hasEnding(engine.audibleSettings ?? settings, engine.bar), chords: progression(engine.audibleSettings ?? settings, engine.bar).map(c=>c.label) }, settings: structuredClone(settings) }),
  events: (begin: number, end: number) => musicScore(settings).onsets(begin, end).length } });
applyTheme(); applyLanguage(); requestAnimationFrame(draw);
if (shared) toast('sharedLoaded');
