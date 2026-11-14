// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
// The social card (public/social-card.png): the app's own ribbon, chord lane and sky, drawn from
// a real phrase of the default song. Rendered by scripts/social-card.mjs.
import '../src/style.css';
import { DEFAULTS } from '../src/music';
import { capturePhrase } from '../src/saved-phrase';
import { ribbonLayout, drawRibbon } from '../src/ribbon';
import { Starfield } from '../src/starfield';

const query = new URLSearchParams(location.search), start = Number(query.get('bar') ?? 24);
if (query.get('lang') === 'ko') {
  // The Korean card, for /ko/.
  document.documentElement.lang = 'ko';
  document.querySelector('#line')!.innerHTML = '작업과 공부를 위한 끝없는 음악,<br /><span>브라우저에서 실시간으로 작곡합니다.</span>';
  document.querySelector('#moods')!.textContent = '로파이 · 앰비언트 · 전자 음악';
  document.querySelector('#address')!.textContent = 'heavyrain39.github.io/kalavinka/ko';
}
const phrase = capturePhrase({ settings: { ...DEFAULTS }, opening: true }, start);
const style = getComputedStyle(document.documentElement), token = (name: string) => style.getPropertyValue(name);

await document.fonts.ready;
// Drawn at 1/1.5 scale and enlarged, so the notes are thick enough to read in a small preview.
const roll = document.querySelector<HTMLCanvasElement>('#roll')!, zoom = 1.5, width = roll.clientWidth / zoom, height = roll.clientHeight / zoom;
roll.width = roll.clientWidth * 2; roll.height = roll.clientHeight * 2;
const context = roll.getContext('2d')!;
context.setTransform(2 * zoom, 0, 0, 2 * zoom, 0, 0);
// The playhead stands in the fifth bar: the notes behind it are lit, as while the music plays.
drawRibbon(context, width, height, ribbonLayout(phrase.events), { position: 4.6, samples: null,
  colors: { dim: token('--line-strong'), mid: token('--text-dim'), bright: token('--text') } });

const runs: { label: string; length: number }[] = [];
for (const chord of phrase.chords) { const last = runs.at(-1); if (last?.label === chord.label) last.length++; else runs.push({ label: chord.label, length: 1 }); }
document.querySelector('#lane')!.append(...runs.map(run => Object.assign(document.createElement('div'), { textContent: run.label, style: `grid-column: span ${run.length}` })));

const sky = new Starfield(document.querySelector<HTMLCanvasElement>('#sky')!);
for (let frame = 0; frame < 90; frame++) sky.draw(frame * 1000 / 30, null, false);
document.body.dataset.ready = 'true';
