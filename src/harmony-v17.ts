// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings, Chord } from './music';
import { hash, random } from './seed';
import { arrangementAt } from './arrangement';
import { HARMONIES, QUALITIES, type Degree } from './harmony-catalog';
import { isV18, keyPcsV18, chordScaleV18 } from './harmony-v18';

// Generator v17 harmony: the seed's authored loop stays the song's identity, while each
// form section may borrow a companion loop, change chord colour or approach the next chord.
// Every decision is indexed by absolute bar, so seeking and saved phrases stay exact.
const NAMES = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const MAJOR = [0,2,4,5,7,9,11], MINOR = [0,2,3,5,7,8,10];
type Quality = Degree[1];
const pc = (n: number) => ((n % 12) + 12) % 12;
const same = (a: Degree, b: Degree) => a[0] === b[0] && a[1] === b[1];

/** The backing compiler runs as v6 for its drums, so it carries this internal harmony marker. */
export const isV17 = (s: Settings) => s.generatorVersion >= 17 || s.harmonyEngine === 17 || s.harmonyEngine === 18;
export const holdV17 = (s: Settings) => s.profile === 'ambient' || s.groove === 'dnb' ? 4 : 2;
// Same choice as v5: a seed keeps its familiar progression after the upgrade.
const recipeA = (s: Settings) => {
  const bank = HARMONIES.filter(r => r.profile === s.profile);
  return bank[hash(`${s.seed}:harmony-v5:${s.profile}`) % bank.length];
};
const recipeB = (s: Settings) => {
  const a = recipeA(s), bank = HARMONIES.filter(r => r.profile === s.profile && r.mode === a.mode && r.id !== a.id);
  return bank[hash(`${s.seed}:harmony-v17:companion`) % bank.length];
};
export const tonicPc = (s: Settings) => hash(s.seed) % 12;
export const keyPcs = (s: Settings) => isV18(s) ? keyPcsV18(s) : (recipeA(s).mode === 'major' ? MAJOR : MINOR).map(n => pc(n + tonicPc(s)));
const diatonic = (s: Settings, d: Degree) => QUALITIES[d[1]].every(n => keyPcs(s).includes(pc(tonicPc(s) + d[0] + n)));

// Colour changes keep the chord's function: maj7 ↔ 6 ↔ add9, m7 ↔ madd9 ↔ m6 (diatonic only).
const COLOUR: Partial<Record<Quality, Quality[]>> = {
  maj7: ['6','add9'], '6': ['maj7','add9'], add9: ['maj7','6'], m7: ['madd9','m6'], madd9: ['m7','m6'],
};
/** One-bar approach chords that lead into the following chord. */
function approach(s: Settings, current: Degree, next: Degree, roll: number): Degree | null {
  const major = recipeA(s).mode === 'major', ambient = s.profile === 'ambient', options: Degree[] = [];
  const minorTarget = ['m7','madd9','m6'].includes(next[1]);
  if (major && current[0] === 5 && current[1] !== '7') options.push([5,'m6']);  // IV → borrowed iv
  if (ambient) {
    if (next[0] === 0) options.push([10,'add9']); // modal ♭VII, never a strong dominant
  } else if (major) {
    if (next[0] === 0) options.push([7,'7'],[10,'7']);              // V7 or backdoor ♭VII7
    if ((next[0] === 2 || next[0] === 9) && minorTarget) options.push([(next[0] + 7) % 12,'7']); // V/ii, V/vi
    if (next[0] === 5) options.push([0,'7']);                       // V/IV
  } else {
    if (next[0] === 0) options.push([7,'7']);                       // harmonic-minor dominant
    if (next[0] === 5) options.push([0,'7']);                       // V/iv
    if (next[0] === 3) options.push([10,'7']);                      // V/III
  }
  const valid = options.filter(o => !same(o, current) && !same(o, next));
  return valid.length ? valid[Math.floor(roll * valid.length)] : null;
}

interface CyclePlan { base: Degree[]; bars: Degree[] }
const plans = new Map<string, CyclePlan>();
function cyclePlan(s: Settings, cycle: number): CyclePlan {
  const key = [s.profile, s.seed, s.groove, s.evolution, cycle].join(':'), saved = plans.get(key);
  if (saved) return saved;
  const h = holdV17(s), length = h * 4, start = cycle * length, a = arrangementAt(s, start);
  const local = Math.floor(a.localBar / length), evolution = s.evolution / 100, ambient = s.profile === 'ambient';
  const r = (label: string) => random(s.seed, `harmony-v17:${s.profile}:${local}:${a.variant}:${label}`);
  const A = recipeA(s), loop = a.section === 'open' ? recipeB(s) : A;
  const slots: Degree[] = loop.chords.map(d => [d[0], d[1]] as Degree);
  if (a.section !== 'intro') {
    const chance = (ambient ? .2 : .15) + evolution * .3 + (a.variant ? .1 : 0);
    slots.forEach((d, i) => {
      const colours = (COLOUR[d[1]] ?? []).filter(q => diatonic(s, [d[0], q]));
      if (colours.length && r(`colour:${i}`) < chance) slots[i] = [d[0], colours[Math.floor(r(`colour-pick:${i}`) * colours.length)]];
    });
  }
  const base = slots.flatMap(d => Array.from({ length: h }, () => d));
  const bars = [...base];
  if (a.section !== 'intro') {
    const weight = a.section === 'groove' ? .8 : a.section === 'return' ? 1.2 : 1;
    const chance = ((ambient ? .15 : s.profile === 'lofi' ? .3 : .25) + evolution * (ambient ? .2 : .35)) * weight;
    let budget = a.variant ? 2 : 1;
    const order = [0,1,2].sort((x, y) => r(`order:${x}`) - r(`order:${y}`));
    for (const i of order) {
      if (!budget || r(`approach:${i}`) >= chance || same(slots[i], slots[i + 1])) continue;
      const chord = approach(s, slots[i], slots[i + 1], r(`approach-pick:${i}`));
      if (chord) { bars[i * h + h - 1] = chord; budget--; }
    }
  }
  // v5 cadence gate: the same 68% plan inside the form, with stronger optional dominants.
  if (a.section !== 'intro' && random(s.seed, `cadence:${s.profile}:${local}:${a.variant}`) < .68) {
    let ending: Degree = A.ending;
    if (A.mode === 'minor' && same(ending, [7,'m7']) && r('harmonic') < .45 + evolution * .3) ending = [7,'7'];
    if (A.mode === 'major' && !ambient && same(ending, [7,'7sus4']) && r('resolve') < .35 + evolution * .3) ending = [7,'7'];
    bars[length - 1] = ending;
    // Four-bar chords leave time for a ii before a dominant ending.
    if (h === 4 && !ambient && ['7','7sus4'].includes(ending[1]) && r('two-five') < .4) {
      const two: Degree = [(ending[0] + 7) % 12, A.mode === 'minor' && ending[0] === 7 ? 'm7b5' : 'm7'];
      if (two[1] === 'm7b5' || diatonic(s, two)) bars[length - 2] = two;
    }
  }
  const plan = { base, bars };
  if (plans.size >= 256) plans.delete(plans.keys().next().value!);
  plans.set(key, plan);
  return plan;
}

const movement = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0);
// Comping sits below the lead: a lower centre leaves the melody's register clear.
// Low semitone clusters (e.g. C–D♭ under middle C) are muddy, so they cost extra.
const register = (a: number[]) => Math.abs(a.reduce((sum, n) => sum + n, 0) / 4 - 61) * .4 + Math.max(0, a[3] - 67) * .45
  + a.slice(1).reduce((sum, n, i) => sum + (n - a[i] === 1 ? (a[i] < 64 ? 4.5 : 1.2) : 0), 0);
function voicings(s: Settings, d: Degree) {
  const root = 48 + tonicPc(s) + d[0], base = QUALITIES[d[1]].map(n => root + n), options: number[][] = [];
  const keep = (notes: number[], span: number) => {
    if (notes[0] >= 50 && notes[3] <= 72 && notes[3] - notes[0] <= span && !options.some(o => o.join() === notes.join())) options.push(notes);
  };
  for (let inversion = 0; inversion < 4; inversion++) for (const octave of [-24,-12,0,12]) {
    const notes = [...base.slice(inversion), ...base.slice(0, inversion).map(n => n + 12)].map(n => n + octave).sort((x, y) => x - y);
    keep(notes, 16);
    // Drop-2: the second voice from the top moves down an octave for an open, pianistic spread.
    keep([notes[2] - 12, notes[0], notes[1], notes[3]].sort((x, y) => x - y), 19);
  }
  return { root, label: NAMES[pc(root)] + (d[1] === 'm7b5' ? 'm7♭5' : d[1]), options };
}
const homes = new Map<string, number[]>();
/** The seed loop's first voicing, chosen with its loop seam; every cycle departs and returns here. */
function home(s: Settings) {
  const key = `${s.profile}:${s.seed}`, saved = homes.get(key);
  if (saved) return saved;
  const chords = recipeA(s).chords.map(d => voicings(s, d));
  let best = { cost: Infinity, first: [] as number[] };
  for (const first of chords[0].options) {
    let states = [{ cost: register(first), last: first }];
    for (let i = 1; i < 4; i++) states = chords[i].options.map(notes => states.map(st => ({ cost: st.cost + movement(st.last, notes) + register(notes), last: notes })).sort((x, y) => x.cost - y.cost)[0]);
    for (const st of states) { const cost = st.cost + movement(st.last, first); if (cost < best.cost) best = { cost, first }; }
  }
  if (homes.size >= 128) homes.delete(homes.keys().next().value!);
  homes.set(key, best.first);
  return best.first;
}
const voiced = new Map<string, Chord[]>();
function cycleChords(s: Settings, cycle: number): Chord[] {
  const key = [s.profile, s.seed, s.groove, s.evolution, cycle].join(':'), saved = voiced.get(key);
  if (saved) return saved;
  const { bars } = cyclePlan(s, cycle), segments: { degree: Degree; length: number }[] = [];
  for (const d of bars) { const last = segments.at(-1); if (last && same(last.degree, d)) last.length++; else segments.push({ degree: d, length: 1 }); }
  const options = segments.map(seg => voicings(s, seg.degree)), anchor = home(s);
  let states = options[0].options.map((notes, j) => ({ cost: register(notes) + movement(anchor, notes) * .5, path: [j] }));
  for (let i = 1; i < options.length; i++) states = options[i].options.map((notes, j) => states.map(st => ({
    cost: st.cost + movement(options[i - 1].options[st.path.at(-1)!], notes) + register(notes), path: [...st.path, j],
  })).sort((x, y) => x.cost - y.cost)[0]);
  const best = states.map(st => ({ ...st, cost: st.cost + movement(options.at(-1)!.options[st.path.at(-1)!], anchor) * .5 })).sort((x, y) => x.cost - y.cost)[0];
  const result = segments.flatMap((seg, i) => Array.from({ length: seg.length }, () => ({ root: options[i].root, label: options[i].label, notes: [...options[i].options[best.path[i]]] })));
  if (voiced.size >= 256) voiced.delete(voiced.keys().next().value!);
  voiced.set(key, result);
  return result;
}

export function chordV17(s: Settings, bar: number): Chord {
  const n = Math.floor(Math.max(0, bar)), length = holdV17(s) * 4;
  return cycleChords(s, Math.floor(n / length))[n % length];
}
/** A one-bar approach or cadence chord inside a held slot; the comping re-strikes it. */
export function hasEndingV17(s: Settings, bar: number) {
  const n = Math.floor(Math.max(0, bar)), h = holdV17(s), length = h * 4;
  const plan = cyclePlan(s, Math.floor(n / length)), i = n % length;
  return i % h !== 0 && !same(plan.bars[i], plan.base[i]);
}
export function nextBoundaryV17(s: Settings, at: number) {
  const h = holdV17(s), usual = (Math.floor(at / h) + 1) * h;
  for (let b = Math.floor(Math.max(0, at)) + 1; b < usual; b++) if (chordV17(s, b).label !== chordV17(s, b - 1).label) return b;
  return usual;
}
export function progressionV17(s: Settings, bar = 0): Chord[] {
  const length = holdV17(s) * 4, chords = cycleChords(s, Math.floor(Math.max(0, bar) / length));
  return chords.filter((c, i) => !i || c.label !== chords[i - 1].label);
}

/**
 * Chord-scale: the key with each chromatic chord tone replacing the key tone it alters.
 * A chromatic major third/seventh is a raised degree (A7's C♯ replaces C); any other
 * chromatic tone is lowered (borrowed iv's A♭ replaces A, ♭VII7's B♭ replaces B).
 */
export function chordScale(s: Settings, chord: Chord): number[] {
  if (chord.quality) return chordScaleV18(s, chord);
  const key = keyPcs(s), root = pc(chord.root), scale = new Set(key);
  for (const t of new Set(chord.notes.map(pc))) {
    if (key.includes(t)) continue;
    scale.delete([4,11].includes(pc(t - root)) ? pc(t - 1) : pc(t + 1));
    scale.add(t);
  }
  return [...scale].sort((x, y) => x - y);
}
export type ToneClass = 'chord' | 'tension' | 'avoid' | 'out';
/** Avoid notes sit a semitone above a chord tone (or replace a sus4's missing third). */
export function toneClass(chord: Chord, scale: number[], note: number): ToneClass {
  const p = pc(note), tones = (chord.tones ?? chord.notes).map(pc), root = pc(chord.root);
  if (tones.includes(p)) return 'chord';
  if (!scale.includes(p)) return 'out';
  if (tones.some(t => pc(p - t) === 1)) return 'avoid';
  const sus = tones.includes(pc(root + 5)) && !tones.includes(pc(root + 3)) && !tones.includes(pc(root + 4));
  return sus && (p === pc(root + 3) || p === pc(root + 4)) ? 'avoid' : 'tension';
}
