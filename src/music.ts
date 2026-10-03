// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import { Pattern } from '@strudel/core/pattern.mjs';
import { Hap } from '@strudel/core/hap.mjs';
import { TimeSpan } from '@strudel/core/timespan.mjs';

export type ProfileId = 'lofi' | 'ambient' | 'dub';
export type Layer = 'harmony' | 'bass' | 'rhythm' | 'motif';
export type Voice = 'keys' | 'pad' | 'bass' | 'pluck' | 'kick' | 'snare' | 'hat';
export interface Settings {
  generatorVersion: 1; profile: ProfileId; seed: string; bpm: number; energy: number; warmth: number;
  evolution: number; volume: number; layers: Record<Layer, boolean>;
}
export interface MusicEvent {
  at: number; length: number; voice: Voice; layer: Layer; notes: number[];
  gain: number; pan: number; cutoff: number;
}
export interface Chord { label: string; root: number; notes: number[] }
export const LAYERS: Layer[] = ['harmony', 'bass', 'rhythm', 'motif'];
export const PROFILES = {
  lofi: { name: 'Warm desk', subtitle: '따뜻한 건반, 느긋한 그루브', description: '커피가 식는 동안에도, 생각은 이어지도록.', bpm: 78, energy: 42, warmth: 72, evolution: 35, tag: 'DOWNTEMPO', number: '01' },
  ambient: { name: 'Quiet space', subtitle: '넓은 공간, 느리게 번지는 화음', description: '문장과 생각 사이에, 조용한 여백을.', bpm: 64, energy: 25, warmth: 60, evolution: 25, tag: 'AMBIENT', number: '02' },
  dub: { name: 'After hours', subtitle: '둥근 저음, 절제된 전자 리듬', description: '일정한 박자에 몸을 맡기고, 한 걸음 더.', bpm: 108, energy: 48, warmth: 62, evolution: 40, tag: 'DEEP ELECTRONIC', number: '03' },
} as const;
export const DEFAULTS: Settings = { generatorVersion: 1, profile: 'lofi', seed: 'SLOWFLOW', bpm: 78, energy: 42, warmth: 72, evolution: 35, volume: 55, layers: { harmony: true, bass: true, rhythm: true, motif: true } };
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Stateless randomness: querying a pattern twice or in a different order gives the same music.
export function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return value >>> 0;
}
export const random = (seed: string, label: string) => hash(`${seed}:${label}`) / 4294967296;
export function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(bytes, (n) => chars[n % chars.length]).join('');
}
export function normalizeSettings(input: unknown): Settings {
  const s = input && typeof input === 'object' ? input as Partial<Settings> : {};
  if (s.generatorVersion !== undefined && s.generatorVersion !== 1) return structuredClone(DEFAULTS);
  const number = (key: 'bpm' | 'energy' | 'warmth' | 'evolution' | 'volume', lo: number, hi: number) =>
    typeof s[key] === 'number' && Number.isFinite(s[key]) ? Math.round(clamp(s[key]!, lo, hi)) : DEFAULTS[key];
  return {
    generatorVersion: 1,
    profile: s.profile && s.profile in PROFILES && Object.hasOwn(PROFILES, s.profile) ? s.profile : 'lofi',
    seed: typeof s.seed === 'string' && /^[A-Z0-9]{4,16}$/.test(s.seed) ? s.seed : DEFAULTS.seed,
    bpm: number('bpm', 50, 130), energy: number('energy', 0, 100), warmth: number('warmth', 0, 100),
    evolution: number('evolution', 0, 100), volume: number('volume', 0, 100),
    layers: Object.fromEntries(LAYERS.map((key) => [key, typeof s.layers?.[key] === 'boolean' ? s.layers[key] : true])) as Record<Layer, boolean>,
  };
}
export function selectProfile(settings: Settings, profile: ProfileId): Settings {
  const p = PROFILES[profile];
  return { ...settings, profile, bpm: p.bpm, energy: p.energy, warmth: p.warmth, evolution: p.evolution,
    layers: { harmony: true, bass: true, rhythm: profile !== 'ambient', motif: true } };
}

const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const minor = [0, 3, 7, 10], major = [0, 4, 7, 11], sus = [0, 5, 7, 10];
// Four functional chords; the seed selects a key and one of two deliberately authored progressions.
export function progression(settings: Settings): Chord[] {
  const root = [48, 50, 53, 55][hash(settings.seed) % 4];
  const alternate = hash(`${settings.seed}:progression`) % 2;
  const recipe: [number, number[], string][] = settings.profile === 'ambient'
    ? alternate ? [[0, major, 'maj7'], [7, sus, '7sus4'], [9, minor, 'm7'], [5, major, 'maj7']]
      : [[0, major, 'maj7'], [5, major, 'maj7'], [9, minor, 'm7'], [7, sus, '7sus4']]
    : alternate ? [[0, minor, 'm7'], [5, minor, 'm7'], [8, major, 'maj7'], [10, sus, '7sus4']]
      : [[0, minor, 'm7'], [8, major, 'maj7'], [3, major, 'maj7'], [10, sus, '7sus4']];
  let previous = [57, 60, 64, 67];
  return recipe.map(([offset, intervals, suffix]) => {
    const chordRoot = root + offset;
    const base = intervals.map((n) => chordRoot + n);
    const candidates: number[][] = [];
    for (let inversion = 0; inversion < 4; inversion++) {
      const inverted = [...base.slice(inversion), ...base.slice(0, inversion).map((n) => n + 12)];
      for (const octave of [-12, 0, 12]) {
        const candidate = inverted.map((n) => n + octave);
        if (candidate[0] >= 52 && candidate[3] <= 79) candidates.push(candidate);
      }
    }
    const score = (notes: number[]) => notes.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0)
      + Math.abs(notes.reduce((a, b) => a + b, 0) / 4 - 64) * .15;
    candidates.sort((a, b) => score(a) - score(b));
    const notes = candidates[0]; previous = notes;
    return { label: NAMES[chordRoot % 12] + suffix, root: chordRoot, notes };
  });
}

export function chordAt(settings: Settings, bar: number): Chord {
  const hold = settings.profile === 'ambient' ? 4 : 2;
  return progression(settings)[Math.floor(Math.max(0, bar) / hold) % 4];
}
export function eventsForBar(settings: Settings, bar: number): MusicEvent[] {
  const { profile, seed } = settings, energy = settings.energy / 100, warmth = settings.warmth / 100;
  const loopLength = profile === 'ambient' ? 16 : 8;
  const position = bar % loopLength;
  const block = Math.floor(bar / 16);
  const evolves = block > 0 && random(seed, `evolve:${block}`) < settings.evolution / 100;
  const variant = evolves ? hash(`${seed}:variant:${block}`) % 3 : 0;
  const r = (id: string) => random(seed, `${position}:${variant}:${id}`);
  const chord = chordAt(settings, bar);
  const cutoff = 3200 - warmth * 2300;
  const result: MusicEvent[] = [];
  const add = (voice: Voice, layer: Layer, at: number, length: number, notes: number[], gain: number, pan = 0) => {
    if (!settings.layers[layer]) return;
    result.push({ voice, layer, at: bar + at, length, notes, gain: gain * (.92 + r(`${voice}:${at}:velocity`) * .12), pan, cutoff });
  };
  if (profile === 'ambient') {
    if (bar % 2 === 0) {
      add('pad', 'harmony', 0, 1.85, chord.notes, .11 + energy * .025);
      add('bass', 'bass', 0, 1.65, [chord.root - 12], .12);
    }
    if (bar % 4 === 2 && energy > .08) {
      const note = chord.notes[variant % 4] + (chord.notes[variant % 4] < 64 ? 12 : 0);
      add('pluck', 'motif', .25, .5, [note], .045, -.2);
      if (energy > .55) {
        let second = chord.notes[(variant + 2) % 4];
        if (second < 64) second += 12;
        add('pluck', 'motif', .75, .4, [second], .035, .2);
      }
    }
    if (energy > .6 && bar % 2 === 1) add('hat', 'rhythm', .5, .02, [], .014);
  } else {
    const dub = profile === 'dub';
    add('keys', 'harmony', dub ? .125 : .012, dub ? .16 : .38, chord.notes, dub ? .105 : .15);
    if (energy > .28 && bar % 2 === 1) add('keys', 'harmony', dub ? .625 : .52, dub ? .12 : .27, chord.notes, .09);
    const bassRoot = chord.root - 12;
    add('bass', 'bass', 0, dub ? .17 : .22, [bassRoot], .2);
    add('bass', 'bass', .5, .16, [bassRoot], .16);
    if (energy > .48) add('bass', 'bass', .8125, .12, [bassRoot + (position % 2 ? 7 : 0)], .12);
    const kicks = dub ? [0, .25, .5, .75] : energy > .55 ? [0, .4375, .625] : [0, .5];
    for (const step of kicks) add('kick', 'rhythm', step, .09, [], dub ? .32 : .27);
    if (energy > .12) for (const step of [.25, .75]) add('snare', 'rhythm', step + (dub ? 0 : .008), .05, [], dub ? .045 : .07);
    const hats = energy < .25 ? 4 : 8;
    for (let i = 0; i < hats; i++) {
      const swing = !dub && i % 2 ? .018 : 0;
      const jitter = i === 0 ? 0 : (r(`hat:${i}:timing`) - .5) * .003;
      add('hat', 'rhythm', i / hats + swing + jitter, .018, [], i % 2 ? .023 : .035, i % 2 ? .18 : -.18);
    }
    // A short, repeated motif with rests. Variation changes one chord tone, never the entire phrase.
    if (energy > .12 && position % 4 === 1) {
      const indices = [[2, 1, 3], [1, 2, 3], [3, 2, 1]][variant];
      for (let i = 0; i < (energy > .7 ? 3 : 2); i++) {
        let note = chord.notes[indices[i]];
        if (note < 64) note += 12;
        add('pluck', 'motif', [.375, .6875, .875][i], .10, [note], .052 + energy * .02, i % 2 ? .25 : -.25);
      }
    }
  }
  return result.sort((a, b) => a.at - b.at);
}

export function musicPattern(settings: Settings): Pattern {
  const cache = new Map<number, MusicEvent[]>();
  return new Pattern((state) => {
    const begin = Number(state.span.begin), end = Number(state.span.end);
    const haps: Hap[] = [];
    for (let bar = Math.max(0, Math.floor(begin) - 2); bar < Math.ceil(end); bar++) {
      if (!cache.has(bar)) cache.set(bar, eventsForBar(settings, bar));
      for (const event of cache.get(bar)!) {
        const whole = new TimeSpan(event.at, event.at + event.length);
        const part = whole.intersection(state.span);
        if (part) haps.push(new Hap(whole, part, event));
      }
    }
    for (const key of cache.keys()) if (key < Math.floor(begin) - 4 || key > Math.ceil(end) + 4) cache.delete(key);
    return haps;
  });
}
