// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, repetitionLevel, type Settings, type MusicEvent, type Chord } from './music';
import { arrangementAt } from './arrangement';
import { nextHarmonyBoundary } from './harmony-v5';
import { chordScale, toneClass, keyPcs, tonicPc, type ToneClass } from './harmony-v17';
import { gridShift, gridTime } from './timing';
import { hash, random } from './seed';
import { chapterBarsV17, melodyRestsV17 } from './melody-v17';

// Generator v32 lead. The v17 sentence solver stays (one shortest path over eight bars), but what
// it is asked to play changes: rhythms are built from a repeated cell and end on a long note with
// a rest, lines follow a contour instead of a random walk, the last four bars are one breath that
// climbs to a peak and comes down, the closing note moves, and the notes carry dynamics.
export const melodyV32 = (s: Settings) => s.generatorVersion >= 32;
// Generator v34: the cell is not sequenced everywhere at once. In v32 the idea stepped its cell,
// the answer copied that, and the development stepped it three more times, so most sentences
// opened with the same half bar four times. Now a sentence has one sequence of two steps:
// in the idea (a quarter of the themes) or in the development (the others).
export const melodyV34 = (s: Settings) => s.generatorVersion >= 34;
/** Share of the v34 themes whose idea still steps its own cell. */
const SEQUENCED = .25;

const JOIN = 0, PART = 1, RING = 2;
type Size = 2 | 3;
/** Half-bar rhythm cells in sixteenths, by note count. */
const CELLS: Record<Size, number[][]> = {
  2: [[0, 3], [0, 4], [0, 6], [2, 4], [2, 6], [0, 2]],
  3: [[0, 2, 4], [0, 3, 6], [0, 2, 6], [0, 4, 6], [2, 4, 6], [0, 3, 4]],
};
/** Cell contours in scale steps from the cell's first note. None returns to a note it just left. */
const SHAPES: Record<Size, number[][]> = {
  2: [[0, 1], [0, -1], [0, 2], [0, -2], [0, 0]],
  3: [[0, 1, 2], [0, -1, -2], [0, 2, 1], [0, -2, -1], [0, 0, 1], [0, 1, 3], [0, 0, -1]],
};
/** Contours of the answering cell, written rising; a falling phrase mirrors them. */
const RISES = [[0, 1], [0, 2], [0, 0]];
/** One-bar cells of the sparse moods (ambient, D&B, low energy). */
const SPARSE = [[0], [0], [4], [2], [0, 8], [0, 10], [4, 12]];
/** Where the three cells of a two-bar idea start: climb, arch, fall, dip. */
const STARTS = [[0, 1, 2], [0, 2, 1], [2, 1, 0], [0, -1, 0]];

interface Gesture {
  step: number; degree: number; hold: number; id: string;
  /** RING: the sixteenth at which the long note stops, leaving the rest of the unit silent. */
  until?: number;
  /** The statement gesture this one restates, and by how many scale steps. */
  src?: string; shift?: number;
  /** An anticipated note falls back to this step when the chord changes under it. */
  push?: number;
  peak?: boolean; cadence?: boolean;
}
interface Theme {
  a: number[]; shape: number[]; b: number[]; rise: number[]; template: number; arch: number; push: boolean;
  /** The idea restates its cell a step away (always, until v34); otherwise `c` with the contour `turn` follows it. */
  seq: boolean; c: number[]; turn: number[];
}
interface Slot {
  at: number; length: number; available: number; bar: number; pos: number; stage: number; chord: Chord; scale: number[];
  strong: boolean; change: boolean; target: number; dir: number; repeat: boolean; id: string; hold: number;
  cadence: boolean; question: boolean; peak: boolean; gap: number; src?: string; shift: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pc = (n: number) => ((n % 12) + 12) % 12;
const riffMode = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb';
const ending = (t: Theme) => t.arch === 0 || t.arch === 3 ? 1 : -1;

/** 0 sparse (ambient, D&B, low energy), then two densities of the cell grammar. */
const densityV32 = (s: Settings) => s.profile === 'ambient' || s.groove === 'dnb' || s.energy < 30 ? 0 : s.energy < 60 ? 1 : 2;

function theme(s: Settings, key: string, density: number): Theme {
  const r = (label: string) => random(s.seed, `m32:${key}:${label}`);
  const of = <T>(list: T[], label: string) => list[Math.floor(r(label) * list.length)];
  const arch = Math.floor(r('arch') * 4);
  if (!density) {
    const a = of(SPARSE, 'a');
    return { a, shape: a.length === 1 ? [0] : [0, of([1, -1, 2, -2], 'shape')], b: [0], rise: [0], template: 0, arch, push: r('push') < .4, seq: true, c: a, turn: [0] };
  }
  const size: Size = r('size') < (density === 1 ? .6 : .3) ? 2 : 3;
  const a = of(CELLS[size], 'a'), shape = of(SHAPES[size], 'shape');
  return { a, shape, b: of(CELLS[2], 'b'), rise: of(RISES, 'rise'), template: Math.floor(r('template') * 5), arch, push: r('push') < .45,
    seq: true, c: a, turn: shape };
}

/** v34: the theme's second cell, of another rhythm and another contour, and whether the idea sequences instead. */
function secondCell(s: Settings, key: string, t: Theme): Theme {
  const r = (label: string) => random(s.seed, `m34:${key}:${label}`);
  const of = <T>(list: T[], label: string) => list[Math.floor(r(label) * list.length)];
  const same = (x: number[], y: number[]) => x.join() === y.join();
  const b = same(t.b, t.a) ? of(CELLS[2].filter(x => !same(x, t.a)), 'b') : t.b;
  // Never busier than the cell it follows: a three-note cell may be answered by two notes, not the reverse.
  const size: Size = t.a.length === 3 && r('size') < .7 ? 3 : 2;
  return { ...t, b, seq: r('seq') < SEQUENCED, c: of(CELLS[size].filter(x => !same(x, t.a) && !same(x, b)), 'c'),
    turn: of(SHAPES[size].filter(x => !same(x, t.shape)), 'turn') };
}

/** The two-bar idea: the cell, the cell again a step away, a turn, then a long note and a rest. */
function idea(t: Theme, key: string, density: number): Gesture[] {
  const out: Gesture[] = [], up = ending(t), [b0, b1, b2] = STARTS[t.arch];
  const put = (onsets: number[], shape: number[], at: number, base: number, tag: string) =>
    onsets.forEach((o, i) => out.push({ step: at + o, degree: base + shape[i], hold: i === onsets.length - 1 ? PART : JOIN, id: `${key}:${tag}${i}` }));
  const ring = (step: number, until: number, tag: string, push?: number) =>
    out.push({ step, degree: out.at(-1)!.degree + up, hold: RING, until, id: `${key}:${tag}`, ...(push === undefined ? {} : { push }) });
  if (!density) {
    put(t.a, t.shape, 0, b0, 'a');
    const early = t.push && t.a.at(-1)! < 11;
    ring(early ? 14 : 16, 28, 'l', early ? 16 : undefined);
    return out;
  }
  // A long note may arrive an eighth early when the cell before it leaves the room.
  const early = (cell: number[]) => t.push && cell.at(-1)! < 5;
  const rise = t.rise.map(x => x * up), [next, contour] = t.seq ? [t.a, t.shape] : [t.c, t.turn];
  put(t.a, t.shape, 0, b0, 'a');
  if (t.template === 0) {
    put(next, contour, 8, b1, 'r'); put(t.push ? t.b.filter(o => o < 5) : t.b, rise, 16, b2, 'b'); ring(t.push ? 22 : 24, 28, 'l');
  } else if (t.template === 1) {
    put(next, contour, 8, b1, 'r'); ring(early(next) ? 14 : 16, 26, 'l', early(next) ? 16 : undefined);
  } else if (t.template === 2) {
    put(next, contour, 16, b1, 'r'); ring(early(next) ? 22 : 24, 28, 'l');
  } else if (t.template === 3) {
    put(t.b, rise, 8, b1, 'b'); ring(early(t.b) ? 14 : 16, 26, 'l', early(t.b) ? 16 : undefined);
  } else {
    ring(8, 12, 'm'); put(next, contour, 16, b1, 'r'); ring(early(next) ? 22 : 24, 28, 'l');
  }
  return out;
}

/** The answer keeps the idea's rhythm and its whole head; only the tail turns the other way and stays open. */
function reply(s: Settings, source: Gesture[], t: Theme, key: string, density: number): Gesture[] {
  // v34: an idea that stepped its cell is answered by the cell and something else, and a third
  // of the other answers keep only the cell and close early. Only the notes still shared with
  // the statement aim at its pitches.
  let base = source, shared = source.length, template = t.template;
  if (melodyV34(s) && density && !riffMode(s)) {
    if (t.seq) { base = idea({ ...t, seq: false }, key, density); shared = t.a.length; }
    else if (t.template !== 3 && random(s.seed, `m34:${key}:free`) < .35) { base = idea({ ...t, template: template = 3 }, key, density); shared = t.a.length; }
  }
  const n = base.length, count = Math.min(n - 1, Math.max(2, density && template === 0 ? base.filter(g => g.step >= 16).length : 2));
  const turn = -(Math.sign(source.at(-1)!.degree - source.at(-2)!.degree) || 1);
  let degree = base[n - count - 1].degree;
  return base.map((g, i) => {
    if (i < n - count) return i < shared ? { ...g, id: `${key}:h${i}`, src: source[i].id, shift: 0 } : { ...g, id: `${key}:h${i}` };
    degree += turn * (random(s.seed, `m32:${key}:tail:${i}`) < .3 ? 2 : 1);
    if (i === n - 1 && degree === 0) degree = turn;
    return { ...g, degree, id: `${key}:t${i}` };
  });
}

/** The closing bars: what is left of the line steps down into one long closing note at `landing`. */
function close(list: Gesture[], landing: number, key: string, density: number): Gesture[] {
  const kept = list.filter(g => g.step <= landing - 2), last = kept.at(-1);
  const from = last?.degree ?? 2, room = landing - (last ? last.step : -4);
  const count = !density ? +(room >= 16) : room >= 12 ? 2 : room >= 8 ? 1 : 0;
  const links: Gesture[] = Array.from({ length: count }, (_, k) => ({ step: landing - 4 * (count - k),
    degree: Math.round(from * (count - k) / (count + 1)), hold: JOIN, id: `${key}:link${k}` }));
  return [...kept, ...links, { step: landing, degree: 0, hold: RING, until: landing === 24 ? 31 : landing + 12, id: `${key}:close`,
    cadence: true, ...(landing === 14 ? { push: 16 } : {}) }];
}

/**
 * Bars five to eight as one breath. The idea's head is broken off and restated higher
 * (fragmentation), the line reaches its single peak, then comes down to the closing note.
 */
function develop(t: Theme, hook: Gesture[], kind: number, landing: number, key: string, density: number, v34: boolean): Gesture[][] {
  const cell = hook.slice(0, t.a.length), top = Math.max(...cell.map(g => g.degree)), high = Math.min(3, 4 - top);
  const frag = (at: number, shift: number, tag: string): Gesture[] =>
    cell.map((g, i) => ({ step: at + g.step, degree: g.degree + shift, hold: g.hold, id: `${key}:${tag}${i}`, src: g.id, shift }));
  const peak = (step: number, until: number, degree: number): Gesture => ({ step, degree, hold: RING, until, id: `${key}:peak`, peak: true });
  const note = (step: number, degree: number, tag: string): Gesture => ({ step, degree, hold: PART, id: `${key}:${tag}` });
  if (!density) {
    return kind % 2 === 0
      ? [[...frag(0, high - 1, 'f'), peak(16, 28, top + high)], close([], landing, key, density)]
      : [[...frag(0, high - 1, 'f'), ...frag(16, high, 'g')], close([peak(0, 10, top + high + 1)], landing, key, density)];
  }
  const fall = t.rise.map(x => -x), summit = top + high + 1;
  const cellAt = (onsets: number[], shape: number[], at: number, base: number, tag: string): Gesture[] =>
    onsets.map((o, i) => ({ step: at + o, degree: base + shape[i], hold: i === onsets.length - 1 ? PART : JOIN, id: `${key}:${tag}${i}` }));
  if (v34 && t.seq) {
    // The idea already climbed in steps, so the development is one line: the second cell runs up to the peak.
    // After a three-note head the run is two notes, so the bar holds five lead notes at most.
    const steps = cell.length === 3 ? t.c.slice(-2) : t.c;
    const run = (at: number, tag: string) => cellAt(steps, steps.map((_, i) => i), at, summit - steps.length, tag);
    if (kind === 0) return [[...frag(0, high - 1, 'f'), ...run(8, 'u'), peak(16, 24, summit)], close(cellAt(t.b, fall, 0, summit - 1, 'd'), landing, key, density)];
    if (kind === 1) return [[...cellAt(t.c, t.turn, 0, 1, 'u'), note(8, 2, 'n'), ...frag(16, high, 'g')], close([peak(0, 6, summit)], landing, key, density)];
    return [[...cellAt(t.b, t.rise, 0, summit - steps.length - 1 - Math.max(...t.rise), 'v'), ...run(8, 'u'), peak(16, 26, summit)],
      close(frag(0, 0, 'h'), landing, key, density)];
  }
  if (v34) {
    // The one sequence of the sentence: two steps up to the peak, where v32 took three.
    const echo = (step: number, shift: number, tag: string) => density >= 2 ? [note(step, cell.at(-1)!.degree + shift - 1, tag)] : [];
    if (kind === 0) return [[...frag(0, high - 1, 'f'), ...echo(12, high - 1, 'e'), ...frag(16, high, 'g'), ...echo(28, high, 'k')],
      close([peak(0, 6, summit)], landing, key, density)];
    if (kind === 1) return [[...frag(0, high - 1, 'f'), ...frag(8, high, 'g'), peak(16, 24, summit)], close(cellAt(t.b, fall, 0, summit - 1, 'd'), landing, key, density)];
    const base = 3 - Math.max(...t.rise);
    return [[...cellAt(t.b, t.rise, 0, base, 'u'), ...cellAt(t.b, t.rise, 8, base + 1, 'v'), peak(16, 24, base + 2 + Math.max(...t.rise))],
      close(frag(0, 0, 'h'), landing, key, density)];
  }
  if (kind === 0) {
    // The head three times, a step higher each bar, then the peak.
    const echo = (step: number, shift: number, tag: string) => density >= 2 ? [note(step, cell.at(-1)!.degree + shift - 1, tag)] : [];
    return [[...frag(0, high - 2, 'f'), ...echo(12, high - 2, 'e'), ...frag(16, high - 1, 'g'), ...echo(28, high - 1, 'k')],
      close([...frag(0, high, 'h'), peak(8, 13, summit)], landing, key, density)];
  }
  if (kind === 1) {
    // Half-bar fragments reach the peak early; the answering cell carries the line down.
    return [[...frag(0, high - 1, 'f'), ...frag(8, high, 'g'), peak(16, 24, summit)],
      close([...cellAt(t.b, fall, 0, summit - 1, 'd'), ...(density >= 2 ? cellAt(t.b, fall, 8, summit - 3, 'c') : [])], landing, key, density)];
  }
  // The answering cell climbs on its own; the hook's head returns before the close.
  const base = 2 - Math.max(...t.rise);
  return [[...cellAt(t.b, t.rise, 0, base, 'u'), ...cellAt(t.b, t.rise, 8, base + 1, 'v'), ...cellAt(t.b.filter(o => o < 5), t.rise, 16, base + 2, 'w'),
    peak(22, 28, base + 3 + Math.max(...t.rise))], close(frag(0, 0, 'h'), landing, key, density)];
}

/** House: one bar (the cell and its reply, kept to four notes) is the riff. */
function riffBar(t: Theme, key: string, density: number): Gesture[] {
  const cellAt = (onsets: number[], shape: number[], at: number, base: number, tag: string): Gesture[] =>
    onsets.map((o, i) => ({ step: at + o, degree: base + shape[i], hold: i === onsets.length - 1 ? PART : JOIN, id: `${key}:${tag}${i}` }));
  return [...cellAt(t.a, t.shape, 0, 0, 'a'), ...cellAt(density >= 2 && t.a.length === 2 ? t.b : t.b.slice(0, 1), t.rise.map(x => x * ending(t)), 8, [1, 2, -1, 0][t.arch], 'b')];
}
/** The riff bar twice. Every restatement points back at the bar it copies. */
const twice = (bar: Gesture[], key: string, shift = 0, own = false): Gesture[] => [0, 16].flatMap(at => bar.map((g, i) =>
  own && !at ? { ...g } : { ...g, step: g.step + at, degree: g.degree + shift, id: `${key}:${at}:${i}`, src: g.id, shift }));

/** Statement, answer, then a four-bar development and close (2 + 2 + 4). */
function sentence(s: Settings, start: number, density: number) {
  const level = repetitionLevel(s), length = chapterBarsV17(s);
  const chapter = Math.floor(start / length), index = Math.floor((start % length) / 8);
  const form = arrangementAt(s, start), after = arrangementAt(s, start + 8);
  // The contrasting theme closes the groove, so each form reads A – B – (breakdown) – A.
  const contrast = level === 2 && form.section === 'groove' && after.section !== 'groove';
  // Only the sentence that ends the form closes on the tonic; the others stay open.
  const full = after.localBar === 0;
  const fresh = level < 2 || random(s.seed, `m32-fresh:${chapter}:${index}`) < .15 + s.evolution * .004;
  const vary = level === 3 ? `${chapter}` : level === 2 ? `${chapter}:${fresh ? index : index % 2}:${contrast ? 'b' : 'a'}` : `s${start}`;
  const roll = random(s.seed, `m32-land:${chapter}:${level === 3 ? index % 2 : index}`);
  const landing = full ? (roll < .6 ? 16 : 24) : roll < .38 ? 16 : roll < .68 ? 24 : 14;
  const turn = level < 2 ? hash(`${s.seed}:m32-plan:${start}`) : hash(`${s.seed}:m32-plan:${chapter}`) + (level === 3 ? 0 : index);
  const name = level === 0 ? `F${start}` : `${contrast ? 'B' : 'A'}${chapter}`;
  let t = theme(s, name, density), key = name;
  if (level === 1) {
    // Only the hook's cell recurs; everything around it is new.
    const hook = t; key = `L${start}`;
    t = { ...theme(s, key, density), a: hook.a, shape: hook.shape };
  }
  const v34 = melodyV34(s) && density > 0 && !riffMode(s);
  if (v34) t = secondCell(s, key, t);
  const quoting = level >= 2 && chapter > 0 && index === 0;
  const before = `A${chapter - 1}`;
  if (riffMode(s) && density) {
    // Riff, exact repeat, one change (a step up, a nudged note, the second riff, or none), close.
    const bar = riffBar(t, key, density), opening = quoting ? riffBar(theme(s, before, density), before, density) : bar;
    const technique = turn % 4, other = `${contrast ? 'A' : 'B'}${chapter}`;
    // The change sits a step or two above the riff, as the v17 development did.
    let change = twice(bar, `c:${vary}`, technique === 0 ? 2 : 1);
    if (technique === 1) {
      const i = 1 + hash(`${s.seed}:m32-mutate:${vary}`) % (bar.length - 1), by = random(s.seed, `m32-mutate:${vary}`) < .5 ? -1 : 1;
      change = change.map((g, j) => j % bar.length === i ? { ...g, degree: g.degree + by, src: undefined } : g);
    } else if (technique === 2) change = twice(riffBar(theme(s, other, density), other, density).map(g => ({ ...g, degree: g.degree + 1 })), `c:${vary}`, 0, true);
    return { stages: [twice(opening, key, 0, true), twice(opening, `r:${key}`), change,
      close(bar.map((g, i) => ({ ...g, id: `e:${vary}:${i}`, src: g.id, shift: 0 })), landing, `e:${vary}`, density)],
      lift: contrast ? 1 : 0, chapter, index, full, riffs: true };
  }
  // A new chapter opens by recalling the last one: its idea and answer, then the new idea takes over the development.
  const statement = idea(t, key, density), old = !quoting ? t : v34 ? secondCell(s, before, theme(s, before, density)) : theme(s, before, density);
  const opening = quoting ? idea(old, before, density) : statement;
  return { stages: [opening, reply(s, opening, old, `r:${vary}`, density), ...develop(t, statement, turn % 3, landing, `d:${vary}`, density, v34)],
    lift: contrast ? 1 : 0, chapter, index, full, riffs: false };
}

/** A unit's gestures in time order, one per step; a long note wins a shared step. */
function tidy(list: Gesture[]) {
  const byStep = new Map<number, Gesture>();
  for (const g of list) {
    const old = byStep.get(g.step);
    if (g.step >= 0 && g.step < 32 && (!old || g.hold === RING || old.hold !== RING)) byStep.set(g.step, g);
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}

const TENSION = { lofi: .45, ambient: .5, dub: .7, dnb: .85 };
/** A slurred step is held this long (seconds) past the next note's start. */
export const SLUR_V32 = .03;

export function melodySentenceV32(s: Settings, start: number, backing: MusicEvent[]): MusicEvent[] {
  if (s.energy < 8 || melodyRestsV17(s, start)) return [];
  const ambient = s.profile === 'ambient', dnb = s.profile === 'dub' && s.groove === 'dnb';
  const density = densityV32(s), plan = sentence(s, start, density), seconds = s.bpm / 240;
  const tonic = tonicPc(s), key = keyPcs(s);
  const ladder = Array.from({ length: 48 }, (_, i) => 48 + i).filter(n => key.includes(pc(n)));
  const center = 69 + hash(`${s.seed}:melody-register`) % 4;
  const rung = (p: number) => ladder.reduce((best, n, i) => Math.abs(n - p) < Math.abs(ladder[best] - p) ? i : best, 0);
  const home = rung(center), homePitch = ladder[home], low = Math.max(60, homePitch - 8), high = Math.min(81, homePitch + 10);
  const cap = ambient ? .8 : dnb ? .9 : .48;
  const slots: Slot[] = [];
  for (let stage = 0; stage < 4; stage++) {
    const first = start + stage * 2;
    // An anticipated long note waits for the downbeat when the chord changes under it.
    const gestures = tidy(plan.stages[stage].map(g => g.push !== undefined
      && chordAt(s, first + Math.floor(g.step / 16)).label !== chordAt(s, first + Math.floor(g.push / 16)).label ? { ...g, step: g.push } : g));
    let lastDegree = gestures[0]?.degree ?? 0;
    for (let i = 0; i < gestures.length; i++) {
      const g = gestures[i], bar = first + Math.floor(g.step / 16), pos = g.step % 16, at = gridTime(s, bar, pos);
      const next = gestures[i + 1], last = i === gestures.length - 1;
      const available = (next ? gridTime(s, first + Math.floor(next.step / 16), next.step % 16) : first + 2) - at;
      // Lengths follow the note's place in the rhythm: inside a cell it is held into the next
      // note, a cell's last note lifts, and the long note rings to its planned end.
      // In the cell grammar no inner note outlasts a dotted eighth, so the long note is the unit's longest.
      const inner = density ? .2 : cap;
      const want = g.hold === RING ? Math.min(g.cadence ? 2 : cap, first + g.until! / 16 - at) : g.hold === PART ? Math.min(available * .72, inner * .75) : Math.min(available, inner);
      const length = Math.min(want, available - .025 * seconds, nextHarmonyBoundary(s, at) - at - .14 * seconds);
      if (length < .035) continue;
      const chord = chordAt(s, bar), previous = slots.at(-1);
      const change = !previous || previous.chord.label !== chord.label;
      const degree = clamp(g.cadence ? 0 : g.degree + plan.lift, -4, 6);
      slots.push({ at, length, available, bar, pos, stage, chord, scale: chordScale(s, chord), change,
        strong: pos % 8 === 0 || change || length >= .2, target: ladder[clamp(home + degree, 0, ladder.length - 1)],
        dir: i === 0 ? 0 : Math.sign(g.degree - lastDegree), repeat: i > 0 && g.degree === lastDegree, id: g.src ?? g.id, hold: g.hold,
        cadence: !!g.cadence, question: stage === 1 && last && !plan.riffs, peak: !!g.peak,
        gap: previous ? at - previous.at - previous.length : 1, src: g.src, shift: g.shift ?? 0 });
      lastDegree = g.degree;
    }
  }
  if (!slots.length) return [];
  // The sentence's single climax: the planned peak, or (house) the highest planned note of the change.
  let peakIndex = slots.findIndex(slot => slot.peak);
  if (peakIndex < 0) peakIndex = slots.reduce((best, slot, i) => slot.stage === 2 && (best < 0 || slot.target > slots[best].target) ? i : best, -1);
  const peak = peakIndex >= 0 ? slots[peakIndex].target : Infinity;
  const tension = TENSION[dnb ? 'dnb' : s.profile];
  const candidates = slots.map(slot => Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(n => slot.scale.includes(pc(n))));
  const classes = slots.map((slot, i) => new Map(candidates[i].map(n => [n, toneClass(slot.chord, slot.scale, n)])));
  const solve = (pin: (number | undefined)[], echo: (number | undefined)[]) => {
    const options = candidates.map((list, i) => pin[i] === undefined ? list : [pin[i]!]);
    const local = (i: number, n: number) => {
      const slot = slots[i], kind = classes[i].get(n)!;
      let cost = slot.strong ? (kind === 'chord' ? 0 : kind === 'tension' ? (slot.length >= .2 && s.profile === 'lofi' ? .3 : tension) : 6)
        : (kind === 'chord' ? 0 : kind === 'tension' ? .2 : 1.1);
      // A restated note aims at the pitch the statement actually played.
      cost += echo[i] === undefined ? Math.abs(n - slot.target) * .32 : Math.abs(n - echo[i]!) * .6;
      const top = Math.max(...slot.chord.notes);
      if (n <= top) cost += .5 + (top - n) * .12; // stay above the comping voicing
      const degree = pc(n - tonic);
      if (slot.cadence) cost += (kind === 'chord' ? 0 : 8) + Math.max(0, Math.abs(n - homePitch) - 5) * .5
        + (plan.full ? (degree === 0 ? 0 : degree === 3 || degree === 4 ? 2.4 : degree === 7 ? 2.8 : 4)
          : (degree === 0 ? 1.6 : degree === 3 || degree === 4 ? 0 : degree === 7 ? .15 : .7));
      if (slot.question) cost += (degree === 0 ? 1.1 : 0) + (kind === 'chord' ? 0 : 1.5);
      if (i === peakIndex) cost += Math.abs(n - peak) * .3 + (kind === 'avoid' ? 4 : 0);
      else if (n >= peak) cost += (n - peak + 1) * .55;
      return cost + random(s.seed, `m32:pitch:${slot.id}:${n - homePitch}`) * .45;
    };
    const transition = (i: number, before: number | undefined, previous: number, n: number) => {
      const slot = slots[i], prior = slots[i - 1], d = n - previous, size = Math.abs(d);
      if (size > 9) return 20; // practically forbidden, but a path always exists
      let cost = size === 0 ? (slot.repeat ? 0 : .7) : size <= 2 ? 0 : size <= 4 ? .35 : size === 5 ? .75 : size === 7 ? 1.2 : 2.4;
      if (size > 2 && slot.gap >= .5) cost *= .6; // a new breath may start elsewhere
      if (size === 0 && before === previous) cost += 2.2;
      if (before !== undefined && size > 0) {
        const was = previous - before;
        if (Math.abs(was) >= 5) cost += Math.sign(d) === Math.sign(was) ? 1.3 : size <= 2 ? -.25 : 0;
        // Rocking between two notes goes nowhere; a stepwise run that keeps going is the line.
        if (n === before) cost += 1;
        else if (size <= 2 && was !== 0 && Math.abs(was) <= 2 && Math.sign(d) === Math.sign(was)) cost -= .3;
      }
      // Keep the planned contour recognisable, most of all in the statement.
      if (slot.dir !== 0 && size > 0 && Math.sign(d) !== slot.dir) cost += slot.stage === 0 ? 1.4 : .9;
      if (slot.dir !== 0 && size === 0 && !slot.repeat) cost += slot.stage === 0 ? .6 : .3;
      // Non-chord tones are approached and left by step; a stressed one resolves downward.
      const was = classes[i - 1].get(previous)!, kind = classes[i].get(n)!;
      if (was !== 'chord') cost += size === 0 || size > 2 ? (prior.strong ? 2.6 : 1.8) : prior.strong && d > 0 ? .5 : 0;
      if (kind !== 'chord' && !slot.strong && (size === 0 || size > 2)) cost += .7;
      // Guide tones: reach the new chord's third or seventh by step.
      if (slot.change && size > 0 && size <= 2 && [3, 4, 10, 11].includes(pc(n - slot.chord.root))) cost -= .45;
      return cost;
    };
    type State = { cost: number; path: number[] };
    let states = new Map<string, State>();
    for (const n of options[0]) states.set(`:${n}`, { cost: local(0, n) + Math.abs(n - homePitch) * .15, path: [n] });
    for (let i = 1; i < slots.length; i++) {
      const next = new Map<string, State>();
      const costs = new Map(options[i].map(n => [n, local(i, n)]));
      for (const state of states.values()) {
        const previous = state.path.at(-1)!, before = state.path.at(-2);
        for (const n of options[i]) {
          const cost = state.cost + costs.get(n)! + transition(i, before, previous, n);
          const k = `${previous}:${n}`, old = next.get(k);
          if (!old || cost < old.cost) next.set(k, { cost, path: [...state.path, n] });
        }
      }
      states = next;
    }
    return [...states.values()].sort((x, y) => x.cost - y.cost)[0].path;
  };
  // Solve once; then hold the statement as played and let every restatement aim at its notes,
  // so the answer's head and the development's fragments are the hook, not a relative of it.
  const draft = solve([], []);
  const sourceOf = slots.map((slot, i) => slot.src === undefined ? -1 : slots.findIndex((x, j) => j !== i && x.src === undefined && x.id === slot.src));
  const path = sourceOf.every(i => i < 0) ? draft : solve(
    slots.map((slot, i) => slot.stage === 0 && sourceOf[i] < 0 ? draft[i] : undefined),
    slots.map((slot, i) => sourceOf[i] < 0 ? undefined : ladder[clamp(rung(draft[sourceOf[i]]) + slot.shift, 0, ladder.length - 1)]));

  const base = ambient ? .048 : dnb ? .058 : .064;
  const peakAt = peakIndex >= 0 ? slots[peakIndex].at : start + 6, endAt = slots.at(-1)!.at;
  const notes: MusicEvent[] = slots.map((slot, i) => {
    const form = arrangementAt(s, slot.bar), arp = form.arpeggio && (!dnb || form.section === 'open');
    const next = slots[i + 1], move = next ? Math.abs(path[i + 1] - path[i]) : 0;
    const kind: ToneClass = classes[i].get(path[i])!, passing = kind !== 'chord' && !!next && move <= 2;
    // Legato: a step inside a cell, under one chord, is held just past the next note's start,
    // so a sustaining lead (the flute) moves without a gap. A leap is lifted a little instead.
    const joined = slot.hold === JOIN && !!next && Math.abs(next.at - slot.at - slot.available) < 1e-9 && slot.length >= slot.available - .025 * seconds - 1e-9;
    const slur = joined && move >= 1 && move <= 2 && nextHarmonyBoundary(s, slot.at) - next.at >= (.14 + SLUR_V32) * seconds;
    const length = slur ? slot.available + SLUR_V32 * seconds : joined && move > 2 ? Math.min(slot.length, slot.available * .8) : slot.length;
    // Dynamics: the bar's own accents, off-beat arrivals leaning in, each phrase's arc, and the
    // last four bars growing into the peak and falling away to the closing note.
    const metric = slot.pos === 0 ? 1.05 : slot.pos === 8 ? 1 : slot.pos % 4 === 0 ? .95 : slot.pos % 2 === 0 ? .88 : .8;
    const lean = slot.hold !== JOIN && slot.pos % 4 !== 0 ? 1.07 : 1;
    const arc = plan.riffs ? (slot.cadence ? .88 : slot.stage === 2 ? 1.04 : 1) : slot.stage === 0 ? 1 : slot.stage === 1 ? .96
      : slot.at <= peakAt ? .95 + .17 * (slot.at - start - 4) / Math.max(.25, peakAt - start - 4) : 1.12 - .26 * (slot.at - peakAt) / Math.max(.25, endAt - peakAt);
    const dynamic = metric * lean * arc * clamp(1 + (path[i] - homePitch) * .006, .95, 1.06) * (passing ? .92 : 1);
    return { at: slot.at, length, voice: arp ? 'arp' : 'pluck', layer: 'motif', notes: [path[i]],
      gain: +(base * dynamic).toFixed(5), velocity: +clamp(.68 + (dynamic - 1) * 1.5, .3, 1).toFixed(2),
      pan: slot.stage % 2 ? .10 : -.10, cutoff: 3400 - s.warmth * 20,
      role: arp ? 'arpeggio' : passing ? 'passing' : 'anchor', ...(passing && !arp ? { resolvesTo: path[i + 1] } : {}),
      release: slur ? .06 : Math.max(.025, Math.min(.14, (slot.available - length) / seconds)),
      // Some phrase endings throw a gentle echo/reverb tail (never in ambient).
      ...(slot.cadence && !ambient && ['groove', 'return'].includes(form.section)
        && random(s.seed, `m18-throw:${plan.chapter}:${plan.index}`) < .6 ? { send: .45 } : {}) };
  });
  // Occasional neighbour pickups inside real rests, resolving to the following note. The
  // statement and the answer's head stay as written.
  const ornaments: MusicEvent[] = [];
  for (let i = 1; i < notes.length; i++) {
    const target = notes[i], prior = notes[i - 1], bar = Math.floor(target.at), stage = slots[i].stage;
    if (stage === 0 || slots[i].src !== undefined || target.voice === 'arp' || prior.role === 'passing'
      || prior.at + prior.length + (prior.release ?? 0) * seconds > target.at - .135) continue;
    if (random(s.seed, `m32-neighbor:${plan.chapter}:${plan.index}:${i}`) > (stage === 1 ? .2 : .3)) continue;
    // v34 answers hold new notes that may take a pickup; a bar stays within six lead notes.
    if (melodyV34(s) && notes.filter(e => Math.floor(e.at) === bar).length >= 6) continue;
    const at = gridShift(s, target.at, -2);
    if (Math.floor(at) !== bar || Math.round((at - bar) * 16) % 4 === 0 || backing.some(e => e.fill !== undefined && Math.abs(e.at - at) < .12)) continue;
    const chord = chordAt(s, bar), scale = chordScale(s, chord);
    const options = Array.from({ length: 5 }, (_, j) => target.notes[0] - 2 + j)
      .filter(n => n >= 60 && n <= 81 && n !== target.notes[0] && scale.includes(pc(n)) && toneClass(chord, scale, n) !== 'chord' && Math.abs(n - prior.notes[0]) <= 4);
    if (!options.length) continue;
    ornaments.push({ ...target, at, length: .05, release: .035, notes: [options[hash(`${s.seed}:m32:${plan.chapter}:${plan.index}:${i}:neighbor`) % options.length]],
      gain: +(target.gain * .68).toFixed(5), velocity: +Math.max(.3, target.velocity! - .2).toFixed(2), role: 'neighbor', resolvesTo: target.notes[0] });
  }
  return [...notes, ...ornaments].sort((a, b) => a.at - b.at);
}

/**
 * Lo-fi: the lead sits 10–25 ms behind the grid, like the keys and the backbeat. Applied after
 * the bass and comping have been written against the on-grid line. Each note ends where it
 * did, so nothing rings further into the next chord.
 */
export function laybackV32(s: Settings, events: MusicEvent[]): MusicEvent[] {
  if (!melodyV32(s) || s.profile !== 'lofi') return events;
  const lazy = .010 + random(s.seed, 'm32-layback') * .008;
  return events.map(e => {
    if (e.layer !== 'motif') return e;
    const late = (lazy + random(s.seed, `m32-layback:${e.at}`) * .007) * s.bpm / 240;
    return { ...e, at: e.at + late, length: Math.max(.03, e.length - late) };
  });
}
