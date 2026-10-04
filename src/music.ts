// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { narrativeEvents } from './ensemble-v7';
import { arpeggioEvents } from './arpeggio';
import { drumPerformance } from './drum-performance';
import { Score } from './score';
import { eventsForBar as legacyEventsForBar, progression as legacyProgression } from './music-v1';
import { arrangementEvents } from './arrangement';
import { ensembleEvents as v3Events } from './ensemble-v3';
import { ensembleEvents } from './ensemble';
import { ensembleEvents as v4Events } from './ensemble-v4';
import { progressionV5, chordV5 } from './harmony-v5';
import { ensembleProgression } from './harmony';
import { chooseInstruments, normalizeInstruments, legacyInstruments, type InstrumentMix } from './instruments';
import { hash, random, newSeed } from './seed';
export { hash, random, newSeed } from './seed';

export type ProfileId = 'lofi' | 'ambient' | 'dub';
export type Layer = 'harmony' | 'bass' | 'rhythm' | 'motif';
export type AudioLayer = Layer | 'arpeggio';
export type Voice = 'keys' | 'pad' | 'bass' | 'pluck' | 'arp' | 'kick' | 'snare' | 'hat' | 'tom' | 'rim';
export interface Settings {
  generatorVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; profile: ProfileId; seed: string; bpm: number; energy: number; warmth: number;
  arpeggio?: boolean;
  evolution: number; reverb: number; volume: number; layers: Record<Layer, boolean>; instruments: InstrumentMix; groove: 'straight' | 'dnb';
}
export interface MusicEvent {
  at: number; length: number; voice: Voice; layer: AudioLayer; notes: number[];
  gain: number; pan: number; cutoff: number;
  role?: 'anchor' | 'passing' | 'anticipation' | 'arpeggio' | 'neighbor';
  resolvesTo?: number;
  /** Optional melodic release ceiling in seconds; absent on historical scores. */
  release?: number;
  duck?: number;
  instrument?: string;
  fill?: number;
  articulation?: 'closed' | 'half' | 'open';
  velocity?: number;
  ghost?: boolean;
  variation?: number;
}
export interface Chord { label: string; root: number; notes: number[] }
export const LAYERS: Layer[] = ['harmony', 'bass', 'rhythm', 'motif'];
export const AUDIO_LAYERS: AudioLayer[] = [...LAYERS, 'arpeggio'];
export const layerEnabled = (s: Settings, layer: AudioLayer) => layer === 'arpeggio' ? s.generatorVersion >= 8 && s.arpeggio !== false : s.layers[layer];
export const PROFILES = {
  lofi: { name: 'Warm desk', subtitle: '따뜻한 건반, 느긋한 그루브', description: '커피가 식는 동안에도, 생각은 이어지도록.', bpm: 78, energy: 42, warmth: 72, evolution: 35, tag: 'DOWNTEMPO', number: '01' },
  ambient: { name: 'Quiet space', subtitle: '넓은 공간, 느리게 번지는 화음', description: '문장과 생각 사이에, 조용한 여백을.', bpm: 64, energy: 25, warmth: 60, evolution: 25, tag: 'AMBIENT', number: '02' },
  dub: { name: 'After hours', subtitle: '둥근 저음, 절제된 전자 리듬', description: '일정한 박자에 몸을 맡기고, 한 걸음 더.', bpm: 108, energy: 48, warmth: 62, evolution: 40, tag: 'DEEP ELECTRONIC', number: '03' },
} as const;
export const DEFAULTS: Settings = { generatorVersion: 10, arpeggio: true, groove: 'straight', instruments: chooseInstruments('lofi', 'SLOWFLOW'), profile: 'lofi', seed: 'SLOWFLOW', bpm: 78, energy: 42, warmth: 72, evolution: 35, reverb: 28, volume: 55, layers: { harmony: true, bass: true, rhythm: true, motif: true } };
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function normalizeSettings(input: unknown): Settings {
  const s = input && typeof input === 'object' ? input as Partial<Settings> : {};
  if (s.generatorVersion !== undefined && s.generatorVersion !== 1 && s.generatorVersion !== 2 && s.generatorVersion !== 3 && s.generatorVersion !== 4 && s.generatorVersion !== 5 && s.generatorVersion !== 6 && s.generatorVersion !== 7 && s.generatorVersion !== 8 && s.generatorVersion !== 9 && s.generatorVersion !== 10) return structuredClone(DEFAULTS);
  const number = (key: 'bpm' | 'energy' | 'warmth' | 'evolution' | 'volume', lo: number, hi: number) =>
    typeof s[key] === 'number' && Number.isFinite(s[key]) ? Math.round(clamp(s[key]!, lo, hi)) : DEFAULTS[key];
  const profile = typeof s.profile === 'string' && Object.hasOwn(PROFILES, s.profile) ? s.profile : 'lofi';
  const seed = typeof s.seed === 'string' && /^[A-Z0-9]{4,16}$/.test(s.seed) ? s.seed : DEFAULTS.seed;
  const version = s.generatorVersion === 1 || (s.generatorVersion === undefined && typeof s.seed === 'string') ? 1 : s.generatorVersion === 2 ? 2 : s.generatorVersion === 3 ? 3 : s.generatorVersion === 4 ? 4 : s.generatorVersion === 5 ? 5 : s.generatorVersion === 6 ? 6 : s.generatorVersion === 7 ? 7 : s.generatorVersion === 8 ? 8 : s.generatorVersion === 9 ? 9 : 10;
  return {
    instruments: version >= 3 ? normalizeInstruments(s.instruments, profile, seed) : legacyInstruments(),
    generatorVersion: version,
    ...(version >= 8 ? {arpeggio: s.arpeggio !== false} : {}),
    groove: version >= 3 && profile === 'dub' && s.groove === 'dnb' ? 'dnb' : 'straight',
    profile,
    seed,
    bpm: number('bpm', 50, version >= 3 ? 180 : 130), energy: number('energy', 0, 100), warmth: number('warmth', 0, 100),
    evolution: number('evolution', 0, 100), volume: number('volume', 0, 100),
    reverb: typeof s.reverb === 'number' && Number.isFinite(s.reverb) ? Math.round(clamp(s.reverb, 0, 100)) : profile === 'ambient' ? 76 : 28,
    layers: Object.fromEntries(LAYERS.map((key) => [key, typeof s.layers?.[key] === 'boolean' ? s.layers[key] : true])) as Record<Layer, boolean>,
  };
}
export function selectProfile(settings: Settings, profile: ProfileId): Settings {
  const p = PROFILES[profile];
  return { ...settings, generatorVersion: 10, arpeggio: true, groove: 'straight', instruments: chooseInstruments(profile, settings.seed), profile, bpm: p.bpm, energy: p.energy, warmth: p.warmth, evolution: p.evolution,
    layers: { harmony: true, bass: true, rhythm: profile !== 'ambient', motif: true } };
}

export function upgradeSettings(input: unknown): Settings {
  const s = normalizeSettings(input);
  return s.generatorVersion === 10 ? s : { ...s, generatorVersion: 10, arpeggio: s.arpeggio !== false, instruments: s.generatorVersion >= 3 ? s.instruments : chooseInstruments(s.profile, s.seed) };
}
export function regenerateSettings(settings: Settings, seed = newSeed()): Settings {
  return { ...settings, generatorVersion: 10, arpeggio: settings.arpeggio !== false, seed, instruments: chooseInstruments(settings.profile, seed, settings.instruments) };
}

const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const minor = [0, 3, 7, 10], major = [0, 4, 7, 11], sus = [0, 5, 7, 10];
// Four functional chords; the seed selects a key and one of two deliberately authored progressions.
export function progression(settings: Settings, bar = 0): Chord[] {
  if (settings.generatorVersion >= 5) return progressionV5(settings, bar);
  if (settings.generatorVersion === 1) return legacyProgression({ ...settings, generatorVersion: 1 });
  if (settings.generatorVersion >= 3) return ensembleProgression(settings);
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

export const chordHold = (settings: Settings) => settings.profile === 'ambient' || (settings.generatorVersion >= 4 && settings.profile === 'dub' && settings.groove === 'dnb') ? 4 : 2;
export function chordAt(settings: Settings, bar: number): Chord {
  if (settings.generatorVersion >= 5) return chordV5(settings, bar);
  const hold = chordHold(settings);
  return progression(settings)[Math.floor(Math.max(0, bar) / hold) % 4];
}
export function eventsForBar(settings: Settings, bar: number): MusicEvent[] {
  if (settings.generatorVersion === 1) return legacyEventsForBar({ ...settings, generatorVersion: 1 }, bar);
  if (settings.generatorVersion === 2) return arrangementEvents(settings, bar);
  const events = settings.generatorVersion >= 7 ? narrativeEvents(settings, bar) : settings.generatorVersion === 3 ? v3Events(settings, bar) : settings.generatorVersion === 4 ? v4Events(settings, bar) : ensembleEvents(settings, bar);
  const performed = settings.generatorVersion >= 6 ? drumPerformance(settings, bar, events) : events;
  const combined = settings.generatorVersion >= 8 ? [...performed, ...arpeggioEvents(settings, bar, events)] : performed;
  return combined.filter(e=>layerEnabled(settings,e.layer)).map(e=>({ ...e, instrument: e.layer === 'arpeggio' ? e.instrument : settings.instruments[e.layer] }));
}
export function musicScore(settings: Settings): Score {
  const snapshot = structuredClone(settings);
  return new Score(bar => eventsForBar(snapshot, bar));
}
