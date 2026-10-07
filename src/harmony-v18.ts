// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings, Chord } from './music';
import { hash, random } from './seed';
import { arrangementAt } from './arrangement';
import { QUALITIES_V18, LABELS_V18, MODES_V18, PROGRESSIONS_V18, type QualityV18, type BankV18, type ProgressionV18 } from './harmony-catalog-v18';

// Generator v18 harmony: a seed picks an authored progression from its mood's bank (A) and a
// companion (B) for the breakdown. Chords last whole bars but any number of them, so cycles of
// fifths and ii–V–I fit. Comping voicings are rootless (the bass owns the root) except in ambient.
// Every decision is indexed by absolute bar, so seeking and saved phrases stay exact.
type Degree = readonly [number, QualityV18];
const pc = (n: number) => ((n % 12) + 12) % 12;
const same = (a: Degree, b: Degree) => pc(a[0]) === pc(b[0]) && a[1] === b[1];

export const isV18 = (s: Settings) => s.generatorVersion >= 18 || s.harmonyEngine === 18;
export const bankV18 = (s: Settings): BankV18 => s.profile === 'ambient' ? 'ambient' : s.profile === 'lofi' ? 'lofi' : s.groove === 'dnb' ? 'dnb' : 'house';
/** Bars per catalogue unit: ambient chords breathe twice as long. */
const unitBars = (s: Settings) => s.profile === 'ambient' ? 2 : 1;
const family = (r: ProgressionV18) => r.mode === 'major' || r.mode === 'lydian' ? 'major' : 'minor';
const weighted = (list: readonly ProgressionV18[], h: number) => {
  let x = h % list.reduce((sum, r) => sum + r.weight, 0);
  for (const r of list) { if (x < r.weight) return r; x -= r.weight; }
  return list[0];
};
const pairs = new Map<string, { a: ProgressionV18; b: ProgressionV18 }>();
function pair(s: Settings) {
  const name = bankV18(s), key = `${name}:${s.seed}`, saved = pairs.get(key);
  if (saved) return saved;
  const bank = PROGRESSIONS_V18.filter(r => r.bank === name), a = weighted(bank, hash(`${s.seed}:harmony-v18:${name}`));
  let pool = bank.filter(r => r.id !== a.id && r.mode === a.mode);
  if (!pool.length) pool = bank.filter(r => r.id !== a.id && family(r) === family(a));
  const result = { a, b: weighted(pool, hash(`${s.seed}:harmony-v18:companion`)) };
  if (pairs.size >= 128) pairs.delete(pairs.keys().next().value!);
  pairs.set(key, result);
  return result;
}
export const recipeV18 = (s: Settings) => pair(s).a;
export const companionV18 = (s: Settings) => pair(s).b;
export const tonicPcV18 = (s: Settings) => hash(s.seed) % 12;
export const keyPcsV18 = (s: Settings) => MODES_V18[recipeV18(s).mode].map(n => pc(n + tonicPcV18(s)));
const expanded = (r: ProgressionV18, unit: number): Degree[] => r.chords.flatMap(([d, q, u]) => Array.from({ length: u * unit }, () => [d, q] as Degree));

interface Base { degree: Degree; which: 'A' | 'B'; offset: number; start: number; block: number }
/** The authored chord at a bar: A through intro, groove and return (continuing modulo its length), B in the breakdown. */
function baseAt(s: Settings, bar: number): Base {
  const n = Math.max(0, bar), a = arrangementAt(s, n), { a: A, b: B } = pair(s), unit = unitBars(s);
  const which = a.section === 'open' ? 'B' : 'A', bars = expanded(which === 'B' ? B : A, unit);
  const local = which === 'B' ? a.localBar - a.formLength / 2 : a.localBar, offset = local % bars.length;
  let first = offset;
  while (first > 0 && same(bars[first - 1], bars[offset])) first--;
  return { degree: bars[offset], which, offset, start: n - (offset - first), block: Math.floor(local / bars.length) };
}

// Chord colour: richer extensions of the same function (only tones that already fit its chord-scale).
const COLOUR: Partial<Record<QualityV18, QualityV18[]>> = {
  maj7: ['maj9','6/9'], maj9: ['6/9','maj7'], '6/9': ['maj9'], add9: ['6/9','maj9'], 'maj7#11': ['maj9'],
  m7: ['m9','m11'], m9: ['m11','m7'], m11: ['m9'], madd9: ['m9'],
  '7': ['9','13'], '9': ['13'], '13': ['9'], '7sus4': ['9sus4'],
};
const AMBIENT_COLOURS = new Set<QualityV18>(['add9','maj9','6/9','m9','m11','madd9','9sus4','maj7#11']);
const fits = (s: Settings, d: Degree, q: QualityV18) => {
  const scale = chordScaleV18(s, chordOf(s, d));
  return QUALITIES_V18[q].every(i => scale.includes(pc(tonicPcV18(s) + d[0] + i)));
};
function colouredAt(s: Settings, bar: number): Degree {
  const base = baseAt(s, bar), a = arrangementAt(s, base.start);
  if (a.section === 'intro') return base.degree;
  const ambient = s.profile === 'ambient', evolution = s.evolution / 100;
  const r = (label: string) => random(s.seed, `harmony-v18:${base.which}:${base.block}:${base.offset - (bar - base.start)}:${a.variant}:${label}`);
  const chance = (ambient ? .2 : .15) + evolution * .3 + (a.variant ? .1 : 0);
  const options = (COLOUR[base.degree[1]] ?? []).filter(q => (!ambient || AMBIENT_COLOURS.has(q)) && fits(s, base.degree, q));
  return options.length && r('colour') < chance ? [base.degree[0], options[Math.floor(r('colour-pick') * options.length)]] : base.degree;
}

const MINORISH = new Set<QualityV18>(['m7','m9','m11','m6','madd9','m6/9']);
const DOMINANT = new Set<QualityV18>(['7','9','13','7b9','7#9','9#11','7sus4','9sus4']);
/** Options that lead into the next chord: [chords replacing the end of the held one, weight]. */
function approaches(s: Settings, current: Degree, target: Degree, room: number): [Degree[], number][] {
  const bank = bankV18(s), major = family(recipeV18(s)) === 'major', r = pc(target[0]), q = target[1];
  const minor = MINORISH.has(q), stable = !['m7b5','dim7'].includes(q), out: [Degree[], number][] = [];
  if (bank === 'ambient') {
    if (r === 0 && major) out.push([[[10,'add9']], 2], [[[7,'9sus4']], 1]);
    if (pc(current[0]) === 5 && major && !MINORISH.has(current[1])) out.push([[[5,'m6']], 2]);
  } else if (bank === 'house') {
    if (stable && !DOMINANT.has(q)) out.push([[[r + 7,'9sus4']], 2]);
    if (pc(current[0]) === 5 && major && r === 0) out.push([[[5,'m9']], 1]);
  } else {
    if (stable) out.push([[[r + 7, minor ? '7b9' : '13']], 3]);
    if (stable) out.push([[[r + 1,'9#11']], bank === 'lofi' ? 2 : 1]);
    if (r === 0 && major) out.push([[[10,'9']], bank === 'dnb' ? 2 : 1]);
    if (pc(current[0]) === 5 && major && r === 0 && !MINORISH.has(current[1])) out.push([[[5,'m9']], 2]);
    if (stable && room >= 4) out.push([[[r + 2, minor ? 'm7b5' : 'm9'], [r + 7, minor ? '7b9' : '13']], 2]);
  }
  return out.map(([chords, w]) => [chords.map(d => [pc(d[0]), d[1]] as Degree), w] as [Degree[], number])
    .filter(([chords]) => !chords.some(d => same(d, current) || same(d, target)));
}

const windows = new Map<string, { bars: Degree[]; base: Degree[] }>();
/** Eight bars of harmony: authored chords, colours, then approach chords and turnarounds. */
function windowPlan(s: Settings, w: number) {
  const key = [s.profile, s.seed, s.groove, s.evolution, w].join(':'), saved = windows.get(key);
  if (saved) return saved;
  const first = w * 8, at = (i: number) => colouredAt(s, first + i);
  const base = Array.from({ length: 8 }, (_, i) => at(i)), bars = [...base];
  const ambient = s.profile === 'ambient', evolution = s.evolution / 100, bank = bankV18(s);
  const form = arrangementAt(s, first), r = (bar: number, label: string) => random(s.seed, `harmony-v18:approach:${arrangementAt(s, bar).localBar}:${form.variant}:${label}`);
  let budget = form.variant ? 2 : 1;
  const order = Array.from({ length: 8 }, (_, i) => i).sort((x, y) => r(first + x, 'order') - r(first + y, 'order'));
  for (const i of order) {
    const bar = first + i, a = arrangementAt(s, bar), next = at(i + 1);
    if (a.section === 'intro' || same(base[i], next)) continue;
    let room = 1;
    while (room < 8 && same(at(i - room), base[i])) room++;
    if (room < 2) continue;
    // The eighth bar is a turnaround: the v5 68% cadence plan; elsewhere a budgeted approach.
    const turnaround = i === 7;
    const weight = a.section === 'groove' ? .8 : a.section === 'return' ? 1.2 : 1;
    const chance = turnaround ? .68 * (ambient ? .6 : bank === 'house' ? .5 : 1)
      : ((ambient ? .15 : bank === 'lofi' ? .32 : bank === 'dnb' ? .28 : .14) + evolution * (ambient ? .2 : .35)) * weight;
    if ((!turnaround && !budget) || r(bar, 'chance') >= chance) continue;
    const options = approaches(s, base[i], next, room).filter(([chords]) => chords.length <= i + 1 && chords.length < room);
    if (!options.length) continue;
    let x = r(bar, 'pick') * options.reduce((sum, [, w]) => sum + w, 0), chosen = options[0][0];
    for (const [chords, wt] of options) { if (x < wt) { chosen = chords; break; } x -= wt; }
    chosen.forEach((d, j) => { bars[i - chosen.length + 1 + j] = d; });
    if (!turnaround) budget--;
  }
  const plan = { bars, base };
  if (windows.size >= 256) windows.delete(windows.keys().next().value!);
  windows.set(key, plan);
  return plan;
}

// ---- Voicing ----
/** Comping voices in order of importance: guide tones, colour tones, then fifth and root. */
function voiceSet(q: QualityV18, withRoot: boolean): number[] {
  const iv = [...new Set(QUALITIES_V18[q].map(pc))], third = iv.includes(4) ? 4 : iv.includes(3) ? 3 : null;
  const seventh = iv.includes(10) ? 10 : iv.includes(11) ? 11 : null;
  const rank = (x: number) => x === 0 ? (withRoot ? -1 : 4) : x === third || (third === null && (x === 5 || x === 2)) ? 0
    : x === seventh || (seventh === null && x === 9) ? 1 : x === 6 && !iv.includes(7) ? 1.5 : x === 7 ? 3 : 2;
  return iv.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).slice(0, 4).map(v => v.x);
}
const movement = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0);
// Comping sits below the lead; low clusters are muddy, so they cost extra.
const register = (a: number[]) => Math.abs(a.reduce((sum, n) => sum + n, 0) / 4 - 61) * .4 + Math.max(0, a[3] - 67) * .45
  + a.slice(1).reduce((sum, n, i) => sum + (n - a[i] === 1 ? (a[i] < 64 ? 4.5 : 1.2) : n - a[i] === 2 && a[i] < 55 ? .8 : 0), 0);
function options(s: Settings, d: Degree) {
  const root = 48 + tonicPcV18(s) + d[0], set = voiceSet(d[1], s.profile === 'ambient').map(i => pc(root + i)), out: number[][] = [];
  const keep = (notes: number[], span: number) => {
    if (notes[0] >= 50 && notes[3] <= 72 && notes[3] - notes[0] <= span && !out.some(o => o.join() === notes.join())) out.push(notes);
  };
  for (const bottom of set) {
    const order = [...set].sort((x, y) => pc(x - bottom) - pc(y - bottom));
    for (let low = 48; low <= 64; low++) {
      if (pc(low) !== bottom) continue;
      const notes = [low];
      for (const p of order.slice(1)) { let n = notes.at(-1)! + 1; while (pc(n) !== p) n++; notes.push(n); }
      keep(notes, 16);
      // Drop-2: the second voice from the top moves down an octave for an open spread.
      keep([notes[2] - 12, notes[0], notes[1], notes[3]].sort((x, y) => x - y), 19);
    }
  }
  return out;
}
const homes = new Map<string, number[]>();
/** One home voicing per song; every chord is voiced near it, so the comping stays in one register. */
function home(s: Settings) {
  const key = `${s.profile}:${s.groove}:${s.seed}`, saved = homes.get(key);
  if (saved) return saved;
  const chords = recipeV18(s).chords.map(([d, q]) => options(s, [d, q]));
  let best = { cost: Infinity, notes: chords[0][0] };
  for (const first of chords[0]) {
    const cost = register(first) + chords.slice(1).reduce((sum, list) => sum + Math.min(...list.map(o => register(o) + movement(first, o) * .6)), 0);
    if (cost < best.cost) best = { cost, notes: first };
  }
  if (homes.size >= 128) homes.delete(homes.keys().next().value!);
  homes.set(key, best.notes);
  return best.notes;
}
const chords = new Map<string, Chord>();
function chordOf(s: Settings, d: Degree): Chord {
  const key = `${s.profile}:${s.groove}:${s.seed}:${d[0]}:${d[1]}`, saved = chords.get(key);
  if (saved) return saved;
  const root = 48 + tonicPcV18(s) + pc(d[0]), anchor = home(s);
  const notes = options(s, d).sort((x, y) => register(x) + movement(anchor, x) * .6 - register(y) - movement(anchor, y) * .6)[0];
  const chord = { root, label: spell(s, root) + LABELS_V18[d[1]], notes, tones: [...new Set(QUALITIES_V18[d[1]].map(i => pc(root + i)))], quality: d[1] };
  if (chords.size >= 512) chords.delete(chords.keys().next().value!);
  chords.set(key, chord);
  return chord;
}
// Chord names are spelled by scale degree in the song's key: C♯13 in D major, A♭maj9 in C minor.
const LETTERS = ['C','D','E','F','G','A','B'], NATURAL = [0,2,4,5,7,9,11], STEPS = [0,1,1,2,2,3,4,4,5,5,6,6];
const RELATIVE: Record<string, number> = { major: 0, lydian: 7, minor: 3, dorian: 10 };
function spell(s: Settings, root: number): string {
  const tonic = tonicPcV18(s), sharps = [7,2,9,4,11].includes(pc(tonic + RELATIVE[recipeV18(s).mode]));
  const letter = NATURAL.includes(tonic) ? NATURAL.indexOf(tonic) : sharps ? NATURAL.indexOf(pc(tonic - 1)) : NATURAL.indexOf(pc(tonic + 1));
  const index = (letter + STEPS[pc(root - tonic)]) % 7, diff = pc(root - NATURAL[index]);
  if (diff === 0) return LETTERS[index];
  if (diff === 1 || diff === 11) return LETTERS[index] + (diff === 1 ? '♯' : '♭');
  return NATURAL.includes(pc(root)) ? LETTERS[NATURAL.indexOf(pc(root))] : sharps ? LETTERS[NATURAL.indexOf(pc(root - 1))] + '♯' : LETTERS[NATURAL.indexOf(pc(root + 1))] + '♭';
}
const copy = (c: Chord): Chord => ({ ...c, notes: [...c.notes], tones: [...c.tones!] });

export function chordV18(s: Settings, bar: number): Chord {
  const n = Math.floor(Math.max(0, bar));
  return copy(chordOf(s, windowPlan(s, Math.floor(n / 8)).bars[n % 8]));
}
/** An approach/turnaround chord, or a change on an odd bar: the half-time comping re-strikes it. */
export function hasEndingV18(s: Settings, bar: number) {
  const n = Math.floor(Math.max(0, bar)), plan = windowPlan(s, Math.floor(n / 8));
  if (!same(plan.bars[n % 8], plan.base[n % 8])) return true;
  return n % 2 === 1 && chordV18(s, n).label !== chordV18(s, n - 1).label;
}
export function nextBoundaryV18(s: Settings, at: number) {
  const n = Math.floor(Math.max(0, at)), current = chordV18(s, n);
  for (let b = n + 1; b <= n + 32; b++) {
    const c = chordV18(s, b);
    if (c.label !== current.label || c.notes.join() !== current.notes.join()) return b;
  }
  return n + 32;
}
export function progressionV18(s: Settings, bar = 0): Chord[] {
  const first = Math.floor(Math.max(0, bar) / 8) * 8, list = Array.from({ length: 8 }, (_, i) => chordV18(s, first + i));
  return list.filter((c, i) => !i || c.label !== list[i - 1].label);
}

// ---- Chord-scales ----
const IONIAN = [0,2,4,5,7,9,11], LYDIAN = [0,2,4,6,7,9,11], MIXO = [0,2,4,5,7,9,10], LYD_DOM = [0,2,4,6,7,9,10];
const MIXO_B13 = [0,2,4,5,7,8,10], PHRY_DOM = [0,1,4,5,7,8,10], ALTERED = [0,1,3,4,7,8,10];
const DORIAN = [0,2,3,5,7,9,10], AEOLIAN = [0,2,3,5,7,8,10], PHRYGIAN = [0,1,3,5,7,8,10], MELODIC = [0,2,3,5,7,9,11];
const LOCRIAN = [0,1,3,5,6,8,10], LOCRIAN2 = [0,2,3,5,6,8,10], WHOLE_HALF = [0,2,3,5,6,8,9,11];
const TEMPLATES: Record<QualityV18, number[][]> = {
  maj7: [IONIAN, LYDIAN], maj9: [IONIAN, LYDIAN], '6': [IONIAN, LYDIAN], '6/9': [IONIAN, LYDIAN], add9: [IONIAN, LYDIAN], 'maj7#11': [LYDIAN],
  m7: [DORIAN, AEOLIAN, PHRYGIAN], m9: [DORIAN, AEOLIAN], m11: [DORIAN, AEOLIAN], madd9: [AEOLIAN, DORIAN], m6: [DORIAN, MELODIC], 'm6/9': [DORIAN, MELODIC],
  m7b5: [LOCRIAN, LOCRIAN2], dim7: [WHOLE_HALF],
  '7': [MIXO, LYD_DOM, MIXO_B13, PHRY_DOM], '9': [MIXO, LYD_DOM, MIXO_B13], '13': [MIXO, LYD_DOM], '7b9': [PHRY_DOM], '7#9': [ALTERED], '9#11': [LYD_DOM],
  '7sus4': [MIXO], '9sus4': [MIXO],
};
const scales = new Map<string, number[]>();
/**
 * The chord's own scale, chosen to share the most notes with the key: V7/ii becomes
 * mixolydian ♭13, a tritone substitute lydian dominant, a borrowed iv dorian. Every chord tone is in it.
 */
export function chordScaleV18(s: Settings, chord: Chord): number[] {
  const key = keyPcsV18(s), q = chord.quality as QualityV18, root = pc(chord.root), tones = chord.tones!;
  const id = `${key.join()}:${root}:${q}`, saved = scales.get(id);
  if (saved) return [...saved];
  let list = TEMPLATES[q].map(t => t.map(i => pc(root + i)));
  const complete = list.filter(scale => tones.every(t => scale.includes(t)));
  if (complete.length) list = complete;
  const overlap = (scale: number[]) => scale.filter(n => key.includes(n)).length;
  const scale = new Set(list.reduce((best, x) => overlap(x) > overlap(best) ? x : best));
  for (const t of tones) if (!scale.has(t)) {
    for (const n of [pc(t + 1), pc(t - 1)]) if (scale.has(n) && !tones.includes(n)) { scale.delete(n); break; }
    scale.add(t);
  }
  const result = [...scale].sort((x, y) => x - y);
  if (scales.size >= 512) scales.delete(scales.keys().next().value!);
  scales.set(id, result);
  return [...result];
}
