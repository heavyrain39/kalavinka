// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import { chordAt, hash, random, clamp, type Settings, type MusicEvent, type Chord } from './music';

export type Section = 'intro' | 'groove' | 'open' | 'return';
export interface Arrangement {
  section: Section; localBar: number; formLength: number; variant: number;
  beatless: boolean; arpeggio: boolean;
}
export function arrangementAt(settings: Settings, bar: number): Arrangement {
  const ambient = settings.profile === 'ambient';
  const formLength = ambient ? 64 : 32;
  const localBar = bar % formLength, sectionLength = formLength / 4;
  const section = (['intro', 'groove', 'open', 'return'] as const)[Math.floor(localBar / sectionLength)];
  const form = Math.floor(bar / formLength);
  const variant = form > 0 && random(settings.seed, `form:${form}`) < settings.evolution / 100
    ? 1 + hash(`${settings.seed}:develop:${form}`) % 3 : 0;
  const beatless = ambient || (section === 'open' && localBar % 8 < 4);
  const arpeggio = ambient ? localBar % 16 >= 8 && localBar % 16 < 12
    : section === 'open' || (section === 'return' && localBar % 4 === 2 && settings.energy > 30);
  return { section, localBar, formLength, variant, beatless, arpeggio };
}
export function scalePitches(settings: Settings, low: number, high: number): number[] {
  const tonic = [48, 50, 53, 55][hash(settings.seed) % 4] % 12;
  const steps = settings.profile === 'ambient' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return Array.from({ length: high - low + 1 }, (_, i) => i + low).filter((note) => steps.includes((note - tonic + 12) % 12));
}
const chordPitches = (chord: Chord, low: number, high: number) =>
  Array.from({ length: high - low + 1 }, (_, i) => i + low).filter((note) => chord.notes.some((n) => n % 12 === note % 12));
const nearest = (pitches: number[], target: number, previous = target) => [...pitches].sort((a, b) =>
  Math.abs(a - target) + Math.max(0, Math.abs(a - previous) - 7) * 5
  - Math.abs(b - target) - Math.max(0, Math.abs(b - previous) - 7) * 5)[0];

// Four related 4-bar phrases: statement, answer, development, breath/cadence.
const RHYTHMS = [
  [[.125, .375, .625], [.25, .6875], [.0625, .3125, .5, .8125], [.5]],
  [[0, .1875, .4375, .75], [.375], [.125, .5, .75], [.25, .625]],
  [[.0625, .25], [.125, .4375, .75], [.3125, .6875], [.5, .8125]],
  [[.125, .25, .4375, .625, .8125], [], [.25, .625], [.0625, .375, .75]],
];
const CONTOURS = [[2, 3, -2, -3, 1], [3, -1, -2, 2, -1], [-2, 1, 3, -1, -2], [1, 2, -3, 2, -1]];
function melodyPhrase(settings: Settings, start: number): MusicEvent[] {
  const result: MusicEvent[] = [];
  const arrangement = arrangementAt(settings, start);
  const phraseIndex = Math.floor(arrangement.localBar / 4);
  const theme = (hash(`${settings.seed}:theme`) + phraseIndex + arrangement.variant) % RHYTHMS.length;
  const contour = CONTOURS[hash(`${settings.seed}:contour`) % CONTOURS.length];
  const scale = scalePitches(settings, 60, settings.profile === 'ambient' ? 81 : 79);
  let previous = 65 + hash(`${settings.seed}:register`) % 7;
  for (let phraseBar = 0; phraseBar < 4; phraseBar++) {
    const bar = start + phraseBar, section = arrangementAt(settings, bar), chord = chordAt(settings, bar);
    if (section.arpeggio || settings.energy < 8) continue;
    let slots = [...RHYTHMS[theme][phraseBar]];
    if (settings.profile === 'ambient') {
      if (phraseBar === 1 || phraseBar === 3) continue;
      slots = slots.filter((_, i) => i % 2 === 0).slice(0, settings.energy > 55 ? 3 : 2);
    } else {
      const limit = settings.energy > 70 ? 5 : settings.energy > 25 ? 4 : 2;
      slots = slots.slice(0, limit);
      if (settings.profile === 'dub' && section.section === 'intro' && phraseBar === 2) slots = [];
    }
    const pitches = chordPitches(chord, 60, settings.profile === 'ambient' ? 81 : 79);
    let resolution: number | null = null;
    for (let i = 0; i < slots.length; i++) {
      const direction = contour[(i + phraseBar) % contour.length] * (phraseBar % 2 ? -1 : 1);
      let note = resolution ?? nearest(pitches, previous + direction, previous);
      let role: MusicEvent['role'] = 'anchor';
      let resolvesTo: number | undefined;
      resolution = null;
      const weakBeat = Math.abs(slots[i] * 4 - Math.round(slots[i] * 4)) > .01;
      if (i > 0 && i % 2 === 1 && i < slots.length - 1 && weakBeat) {
        const target = nearest(pitches, previous + (direction > 0 ? 3 : -3), previous);
        const passing = scale.filter((n) => n > Math.min(previous, target) && n < Math.max(previous, target)
          && Math.abs(n - target) <= 2 && Math.abs(n - previous) <= 2);
        if (passing.length && Math.abs(target - previous) <= 5) {
          note = nearest(passing, (previous + target) / 2);
          role = 'passing'; resolution = target; resolvesTo = target;
        }
      }
      const gap = i + 1 < slots.length ? slots[i + 1] - slots[i] : 1 - slots[i];
      const legato = settings.profile === 'ambient' ? .75 : phraseBar % 2 ? .66 : .48;
      const length = clamp(gap * legato, .055, settings.profile === 'ambient' ? .6 : .28);
      result.push({ at: bar + slots[i], length, voice: 'pluck', layer: 'motif', notes: [note],
        gain: (settings.profile === 'ambient' ? .055 : .072) * (role === 'passing' ? .72 : 1)
          * (.94 + random(settings.seed, `phrase:${phraseIndex}:${arrangement.variant}:${phraseBar}:${i}`) * .10),
        pan: phraseBar % 2 ? .16 : -.16, cutoff: 3400 - settings.warmth * 20, role, resolvesTo });
      previous = note;
    }
  }
  return result;
}

export function arrangementEvents(settings: Settings, bar: number): MusicEvent[] {
  const { profile, seed } = settings, energy = settings.energy / 100;
  const a = arrangementAt(settings, bar), chord = chordAt(settings, bar);
  const cutoff = 3200 - settings.warmth * 23;
  const result: MusicEvent[] = [];
  const r = (id: string) => random(seed, `${a.localBar}:${a.variant}:${id}`);
  const add = (voice: MusicEvent['voice'], layer: MusicEvent['layer'], at: number, length: number, notes: number[], gain: number, extra: Partial<MusicEvent> = {}) => {
    result.push({ voice, layer, at: bar + at, length, notes, gain: gain * (.94 + r(`${voice}:${at}`) * .1), pan: 0, cutoff, ...extra });
  };
  const ambient = profile === 'ambient', dub = profile === 'dub';

  if (ambient) {
    if (bar % 2 === 0) {
      add('pad', 'harmony', 0, 1.8, chord.notes, .115);
      const bassNote = nearest(chordPitches(chord, 36, 52), chord.root - 12 + (bar % 4 === 2 ? 7 : 0));
      add('bass', 'bass', 0, bar % 4 ? 1.1 : 1.65, [bassNote], .115, { role: 'anchor' });
    }
  } else {
    if (a.beatless) add('pad', 'harmony', .01, .82, chord.notes, .10);
    else {
      const chordSlots = dub ? a.section === 'intro' ? [.375] : [.125, .625]
        : bar % 2 ? [.03, energy > .5 ? .5625 : .6875] : [.012];
      chordSlots.forEach((at, i) => add('keys', 'harmony', at, dub ? .13 : i ? .22 : .34, chord.notes, i ? .08 : .135));
    }

    const root = chord.root - (chord.root >= 60 ? 24 : 12);
    const tone = (kind: number) => kind === 0 ? root : kind === 1 ? root + 7
      : nearest(chordPitches(chord, root + 2, root + 5), root + 3);
    const patterns: [number, number, number][][] = dub
      ? [[[2, 0, .14], [6, 0, .12], [10, 1, .12], [14, 2, .10]],
        [[2, 0, .15], [7, 2, .10], [10, 0, .14]],
        [[3, 0, .13], [6, 1, .13], [11, 2, .09], [14, 0, .10]],
        [[2, 0, .15], [6, 2, .12], [10, 1, .12], [15, 0, .045]]]
      : [[[0, 0, .22], [6, 1, .12], [10, 0, .14]],
        [[1, 0, .20], [8, 2, .13], [13, 1, .10]],
        [[0, 0, .18], [5, 2, .10], [9, 1, .12], [14, 0, .075]],
        [[2, 0, .23], [9, 1, .12], [14, 2, .075]]];
    let line = patterns[(a.localBar + a.variant + hash(`${seed}:bass`) % 4) % 4];
    if (a.beatless) line = [[0, 0, .62], [.5 * 16, 1, .24]];
    else if (energy < .25 || a.section === 'intro') line = line.filter((_, i) => i !== 2);
    for (let i = 0; i < line.length; i++) {
      const [step, kind, authoredLength] = line[i];
      const at = step / 16;
      const nextAt = i + 1 < line.length ? line[i + 1][0] / 16 : 1;
      const length = Math.min(authoredLength, Math.max(.025, nextAt - at - .06 * settings.bpm / 240));
      add('bass', 'bass', at, length, [tone(kind)], i ? .155 : .19, { role: 'anchor' });
    }
    // A weak-beat diatonic approach leads to the next root, then releases before the downbeat.
    if (!dub && !a.beatless && energy > .3 && bar % 2 === 1) {
      const next = chordAt(settings, bar + 1);
      const target = next.root - (next.root >= 60 ? 24 : 12);
      const scales = scalePitches(settings, 34, 55).filter((n) => n !== target && Math.abs(n - target) <= 2);
      const note = nearest(scales, target - 1);
      // Replace late notes rather than layering a second bass voice on top of them.
      for (let i = result.length - 1; i >= 0; i--) if (result[i].layer === 'bass' && result[i].at >= bar + .75) result.splice(i, 1);
      add('bass', 'bass', .875, .09, [note], .125, { role: 'anticipation', resolvesTo: target });
    }
  }

  if (!a.beatless) {
    const phraseEnd = a.localBar % 4 === 3;
    let kicks = dub ? a.section === 'intro' ? [0, 8] : [0, 4, 8, 12]
      : [[0, 8], [0, 7], [0, 10], [0, 6, 11]][(a.localBar + a.variant) % 4];
    if (energy < .2) kicks = kicks.slice(0, 1);
    if (a.section === 'open') kicks = [];
    const duck = dub ? a.section === 'intro' ? .28 : a.section === 'return' ? .48 : .58
      : energy > .3 && (a.section === 'groove' || a.section === 'return') && a.localBar % 4 === 0 ? .18 : 0;
    kicks.forEach((step, i) => add('kick', 'rhythm', step / 16, .09, [], dub ? .29 : .25, { duck: i === 0 || dub ? duck : 0 }));
    if (energy > .12 && a.section !== 'open') {
      const snareSteps = phraseEnd && energy > .55 ? [4, 12, 14.5] : [4, 12];
      snareSteps.forEach((step, i) => add('snare', 'rhythm', step / 16 + (dub ? 0 : .007), .04, [], i > 1 ? .025 : .058));
    }
    const hatPatterns = [[0, 4, 8, 12], [2, 6, 10, 14], [0, 3, 8, 11, 14], [2, 6, 9, 12]];
    let hats = hatPatterns[(a.localBar + a.variant + hash(`${seed}:hats`)) % 4];
    if (a.section === 'intro' || energy < .25) hats = hats.filter((_, i) => i % 2 === 0);
    if (a.section === 'open') hats = [6, 14];
    if (energy > .75 && !phraseEnd && a.section === 'groove') hats = [...hats, 7, 15].sort((x, y) => x - y);
    hats.forEach((step, i) => {
      const swing = !dub && step % 4 === 2 ? .014 : 0;
      add('hat', 'rhythm', step / 16 + swing, .018, [], i % 2 ? .019 : .029, { pan: i % 2 ? .16 : -.16 });
    });
  } else if (ambient && energy > .55 && a.section === 'return' && bar % 4 === 3) {
    add('hat', 'rhythm', .5, .025, [], .013);
  }

  if (a.arpeggio && energy > .08) {
    const count = ambient ? 2 + Math.floor(energy * 2) : dub ? 4 + Math.floor(energy * 2) : 3 + Math.floor(energy * 2);
    const ascending = (Math.floor(a.localBar / 2) + a.variant) % 2 === 0;
    const order = ascending ? [0, 1, 2, 3, 2, 1] : [3, 2, 1, 0, 1, 2];
    const pitches = chordPitches(chord, 60, 79).slice(0, 4);
    for (let i = 0; i < count; i++) {
      const note = pitches[order[i]];
      const at = ambient ? [.125, .5, .8125, .9375][i] : i / (dub ? 8 : 6) + .0625;
      add('arp', 'motif', at, ambient ? .17 : .055 + (i % 2) * .025, [note], ambient ? .040 : .047,
        { pan: i % 2 ? .22 : -.22, role: 'arpeggio' });
    }
  } else {
    result.push(...melodyPhrase(settings, bar - bar % 4).filter((event) => Math.floor(event.at) === bar));
  }
  return result.filter((event) => settings.layers[event.layer]).sort((x, y) => x.at - y.at);
}
