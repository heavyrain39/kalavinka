// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, repetitionLevel, type Settings, type MusicEvent, type Chord } from './music';
import { arrangementAt } from './arrangement';
import { nextHarmonyBoundary } from './harmony-v5';
import { chordScale, toneClass, keyPcs, tonicPc, type ToneClass } from './harmony-v17';
import { gridTime } from './timing';
import { hash, random } from './seed';

// Two-bar rhythmic identities in sixteenths. Onsets at 28–30 act as pickups into the next unit.
const RHYTHMS = [[0,3,6,12,20,24], [2,6,10,16,19,26], [0,4,7,14,22], [0,2,8,18,22,26], [3,6,12,16,24],
  [0,6,8,14,20,27], [2,4,10,18,24,26], [0,3,9,16,22], [4,7,12,18,26],
  [0,6,12,16,22,30], [4,8,10,16,24,28], [0,8,11,14,20], [2,6,8,12,18,24,30], [0,10,16,19,22,26], [6,8,14,16,24,28]];
interface Gesture { step: number; degree: number; gate: number; accent: number; repeat: boolean; id: string }
interface Slot {
  at: number; length: number; available: number; bar: number; stage: number; chord: Chord; scale: number[];
  strong: boolean; change: boolean; target: number; dir: number; repeat: boolean; id: string;
  cadence: boolean; question: boolean; accent: number; gap: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pc = (n: number) => ((n % 12) + 12) % 12;

/** Theme length in bars. Normal is half of v16 so a motif develops without wearing thin;
 * moods whose chords last four bars (ambient, D&B) keep twice as long. */
export const chapterBarsV17 = (s: Settings) => {
  const base = s.profile === 'ambient' || s.groove === 'dnb' ? 64 : 32, level = repetitionLevel(s);
  return level === 0 ? 8 : level === 1 ? base / 2 : level === 3 ? base * 2 : base;
};

function family(s: Settings, chapter: number, salt: string) {
  const block = Math.floor(chapter / RHYTHMS.length);
  const order = (b: number) => RHYTHMS.map((_, i) => i).sort((x, y) => hash(`${s.seed}:m17-${salt}:${b}:${x}`) - hash(`${s.seed}:m17-${salt}:${b}:${y}`));
  const list = order(block);
  if (block > 0 && list[0] === order(block - 1).at(-1)) [list[0], list[1]] = [list[1], list[0]];
  return list[chapter % RHYTHMS.length];
}
/** A relative scale-step contour: mostly steps, occasional leaps that are filled back by step. */
function contour(s: Settings, key: string, rhythm: number): Gesture[] {
  let degree = 0, previous = 0;
  return RHYTHMS[rhythm].map((step, i) => {
    const r = random(s.seed, `m17:${key}:move:${i}`);
    let move = i === 0 ? 0 : r < .24 ? 0 : r < .48 ? 1 : r < .7 ? -1 : r < .8 ? 2 : r < .89 ? -2 : r < .95 ? 3 : -3;
    if (Math.abs(previous) >= 2 && (move === 0 || Math.sign(move) === Math.sign(previous))) move = -Math.sign(previous);
    const next = clamp(degree + move, -3, 4);
    move = next - degree; degree = next; previous = move;
    return { step, degree, gate: [.42,.62,.9][hash(`${s.seed}:m17:${key}:gate:${i}`) % 3],
      accent: i === 0 ? 1.08 : i % 3 === 1 ? .85 : .96, repeat: i > 0 && move === 0, id: `${key}:${i}` };
  });
}
const theme = (s: Settings, chapter: number) => {
  const a = family(s, chapter, 'a');
  let b = family(s, chapter + 7, 'b');
  if (b === a) b = (a + 4) % RHYTHMS.length;
  return { a: contour(s, `A${chapter}`, a), b: contour(s, `B${chapter}`, b) };
};
const copy = (g: Gesture[]) => g.map(x => ({ ...x }));
/** Same rhythm and opening; a new tail that stops away from home (antecedent). */
function answer(s: Settings, source: Gesture[], key: string) {
  const out = copy(source), n = out.length;
  for (let i = Math.max(1, n - 2); i < n; i++) {
    const r = random(s.seed, `m17:${key}:tail:${i}`);
    out[i] = { ...out[i], degree: clamp(out[i - 1].degree + (r < .35 ? -1 : r < .7 ? 1 : r < .85 ? -2 : 2), -3, 4), repeat: false, id: `${key}:tail:${i}` };
  }
  const last = out[n - 1];
  if (last.degree === 0) last.degree = random(s.seed, `m17:${key}:open`) < .5 ? 1 : -1;
  last.gate = .9;
  return out;
}
const sequence = (source: Gesture[], shift: number) => copy(source).map(g => ({ ...g, degree: clamp(g.degree + shift, -3, 5) }));
function fragment(source: Gesture[]) {
  const head = source.filter(g => g.step < 16);
  if (head.length < 2) return sequence(source, 1);
  return [...copy(head), ...head.map(g => ({ ...g, step: g.step + 16, degree: clamp(g.degree + 1, -3, 5), repeat: false }))];
}
const invert = (source: Gesture[]) => copy(source).map(g => ({ ...g, degree: clamp(source[0].degree * 2 - g.degree + 1, -3, 5) }));
/** The statement's head, then a long closing note in the second bar (consequent). */
function cadence(source: Gesture[], key: string) {
  const head = copy(source.filter(g => g.step < 20)).map(g => ({ ...g, degree: Math.round(g.degree * .6) }));
  const last = head.at(-1);
  const step = Math.max(24, last ? last.step + 4 : 24);
  return [...head, { step: Math.min(step, 28), degree: 0, gate: .95, accent: .9, repeat: false, id: `${key}:close` }];
}

/** Four two-bar stages: statement, answer, development, cadence. */
function sentence(s: Settings, start: number) {
  const level = repetitionLevel(s), length = chapterBarsV17(s);
  const chapter = Math.floor(start / length), index = Math.floor((start % length) / 8);
  if (level === 0) {
    const fresh = (stage: number) => contour(s, `F${start / 2 + stage}`, hash(`${s.seed}:m17-fresh:${start / 2 + stage}`) % RHYTHMS.length);
    return { stages: [fresh(0), answer(s, fresh(0), `F${start}`), fresh(2), cadence(fresh(3), `F${start}`)], lift: 0, chapter, index };
  }
  const t = theme(s, chapter);
  if (level === 1) {
    // Only the hook's first two gestures recur; each tail is new.
    const hooked = (stage: number) => {
      const fresh = contour(s, `L${start / 2 + stage}`, hash(`${s.seed}:m17-low:${start / 2 + stage}`) % RHYTHMS.length);
      const head = t.a.slice(0, 2), tail = fresh.filter(g => g.step > (head.at(-1)?.step ?? 0) + 1);
      return [...copy(head), ...tail.map(g => ({ ...g, degree: clamp(g.degree + head.at(-1)!.degree, -3, 4) }))];
    };
    return { stages: [hooked(0), answer(s, hooked(0), `L${start}`), hooked(2), cadence(t.a, `L${start}`)], lift: 0, chapter, index };
  }
  // Normal varies development, answers and the period shape per sentence; High keeps them per chapter.
  // The contrasting theme closes the groove, so each form reads A – B – (breakdown) – A.
  const contrast = level === 2 && arrangementAt(s, start).section === 'groove' && arrangementAt(s, start + 8).section !== 'groove';
  const statement = contrast ? t.b : t.a;
  const quoting = chapter > 0 && index === 0;
  const technique = level === 3 ? hash(`${s.seed}:m17-dev:${chapter}`) % 4 : (hash(`${s.seed}:m17-dev:${chapter}`) + index) % 4;
  const develop = technique === 0 ? sequence(statement, 1) : technique === 1 ? fragment(statement)
    : technique === 2 ? sequence(contrast ? t.a : t.b, 1) : invert(statement);
  const answerKey = level === 3 ? `ans:${chapter}` : `ans:${chapter}:${index % 2}:${contrast ? 'b' : 'a'}`;
  return {
    stages: [quoting ? theme(s, chapter - 1).a : statement, answer(s, statement, answerKey), develop, cadence(statement, `C${chapter}:${contrast}`)],
    lift: contrast ? 2 : 0, chapter, index,
  };
}

const TENSION = { lofi: .45, ambient: .5, dub: .7, dnb: .85 };

/**
 * The lead rests for one whole eight-bar sentence in the breakdown (the first half of
 * ambient's sixteen-bar breakdown). Rests aligned with the form read as intent, not dropout;
 * the build-up fill then announces the theme's return.
 */
export function melodyRestsV17(s: Settings, start: number) {
  const form = arrangementAt(s, start);
  return form.section === 'open' && (s.profile !== 'ambient' || form.localBar % 16 < 8);
}

/** Absolute-time sentence composition, solved as one shortest path over all eight bars. */
export function melodySentenceV17(s: Settings, start: number, backing: MusicEvent[]): MusicEvent[] {
  if (s.energy < 8) return [];
  const ambient = s.profile === 'ambient', dnb = s.profile === 'dub' && s.groove === 'dnb';
  const level = repetitionLevel(s), plan = sentence(s, start);
  const tonic = tonicPc(s), key = keyPcs(s);
  const ladder = Array.from({ length: 48 }, (_, i) => 48 + i).filter(n => key.includes(pc(n)));
  const center = 69 + hash(`${s.seed}:melody-register`) % 4;
  const home = ladder.reduce((best, n, i) => Math.abs(n - center) < Math.abs(ladder[best] - center) ? i : best, 0);
  const homePitch = ladder[home], low = Math.max(60, homePitch - 8), high = Math.min(81, homePitch + 10);
  const sparse = ambient || dnb || s.energy < 30;
  if (melodyRestsV17(s, start)) return [];
  const slots: Slot[] = [];
  for (let stage = 0; stage < 4; stage++) {
    let gestures = plan.stages[stage].map(g => ({ ...g }));
    if (plan.index > 0 && stage === 1 && random(s.seed, `m17-edit:${plan.chapter}:${plan.index}`) < (.3 + s.evolution * .004) * (level === 3 ? .2 : 1))
      gestures = gestures.filter((_, i) => i !== 1);
    if (sparse) {
      const end = gestures.at(-1)!;
      gestures = gestures.filter((g, i) => i === 0 || i === 2 || stage === 3 && g === end || s.energy > 60 && i === 4);
    }
    const lift = plan.lift + (stage === 2 ? (s.energy >= 50 ? 2 : 1) : stage === 3 ? -1 : 0);
    let lastDegree = gestures[0]?.degree ?? 0;
    for (let i = 0; i < gestures.length; i++) {
      const g = gestures[i], bar = start + stage * 2 + Math.floor(g.step / 16), step = g.step % 16, at = gridTime(s, bar, step);
      const next = gestures[i + 1], last = i === gestures.length - 1, isCadence = stage === 3 && last;
      const nextAt = next ? gridTime(s, start + stage * 2 + Math.floor(next.step / 16), next.step % 16) : start + stage * 2 + 2;
      const available = nextAt - at;
      // Reserve the instrument release before harmonic changes (same budget as v16).
      const length = Math.min(isCadence ? available : ambient ? .8 : dnb ? .68 : .48, available * g.gate, available - .025 * s.bpm / 240, nextHarmonyBoundary(s, at) - at - .14 * s.bpm / 240);
      if (length < .035) continue;
      const chord = chordAt(s, bar), previous = slots.at(-1);
      const change = !previous || previous.chord.label !== chord.label;
      const degree = isCadence ? 0 : g.degree + lift;
      slots.push({ at, length, available, bar, stage, chord, scale: chordScale(s, chord), change,
        strong: step % 8 === 0 || change || length >= .2, target: ladder[clamp(home + degree, 0, ladder.length - 1)],
        dir: i === 0 ? 0 : Math.sign(g.degree - lastDegree), repeat: g.repeat, id: g.id, cadence: isCadence,
        question: stage === 1 && last, accent: g.accent, gap: previous ? at - previous.at - previous.length : 1 });
      lastDegree = g.degree;
    }
  }
  if (!slots.length) return [];
  // The highest planned note of the development is the sentence's single climax.
  const peakIndex = slots.reduce((best, slot, i) => slot.stage === 2 && (best < 0 || slot.target > slots[best].target) ? i : best, -1);
  const peak = peakIndex >= 0 ? slots[peakIndex].target : Infinity;
  const tension = TENSION[dnb ? 'dnb' : s.profile];
  const candidates = slots.map(slot => Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(n => slot.scale.includes(pc(n))));
  const classes = slots.map((slot, i) => new Map(candidates[i].map(n => [n, toneClass(slot.chord, slot.scale, n)])));
  const local = (i: number, n: number) => {
    const slot = slots[i], kind = classes[i].get(n)!;
    let cost = slot.strong ? (kind === 'chord' ? 0 : kind === 'tension' ? (slot.length >= .2 && s.profile === 'lofi' ? .3 : tension) : 6)
      : (kind === 'chord' ? 0 : kind === 'tension' ? .2 : 1.1);
    cost += Math.abs(n - slot.target) * .32;
    const top = Math.max(...slot.chord.notes);
    if (n <= top) cost += .5 + (top - n) * .12; // stay above the comping voicing
    const degree = pc(n - tonic);
    if (slot.cadence) cost += (kind === 'chord' ? 0 : 8) + (degree === 0 ? 0 : degree === 3 || degree === 4 ? .25 : degree === 7 ? .7 : 2.2) + Math.max(0, Math.abs(n - homePitch) - 5) * .5;
    if (slot.question) cost += (degree === 0 ? 1.1 : 0) + (kind === 'chord' ? 0 : 1.5);
    if (i === peakIndex) cost += Math.abs(n - peak) * .3 + (kind === 'avoid' ? 4 : 0);
    else if (n >= peak) cost += (n - peak + 1) * .55;
    return cost + random(s.seed, `m17:pitch:${slot.id}:${n - homePitch}`) * .45;
  };
  const transition = (i: number, before: number | undefined, previous: number, n: number) => {
    const slot = slots[i], prior = slots[i - 1], d = n - previous, size = Math.abs(d);
    if (size > 9) return 20; // practically forbidden, but a path always exists
    let cost = size === 0 ? (slot.repeat ? 0 : .7) : size <= 2 ? 0 : size <= 4 ? .35 : size === 5 ? .75 : size === 7 ? 1.2 : 2.4;
    if (size > 2 && slot.gap >= .5) cost *= .6; // a new breath may start elsewhere
    if (size === 0 && before === previous) cost += 2.2;
    if (before !== undefined && Math.abs(previous - before) >= 5 && size > 0) cost += Math.sign(d) === Math.sign(previous - before) ? 1.3 : size <= 2 ? -.25 : 0;
    // Keep the motif's up/down shape recognisable, most of all in the statement.
    if (slot.dir !== 0 && size > 0 && Math.sign(d) !== slot.dir) cost += slot.stage === 0 ? 1.4 : .9;
    if (slot.dir !== 0 && size === 0 && !slot.repeat) cost += slot.stage === 0 ? .6 : .3;
    // Non-chord tones are approached and left by step; a stressed one resolves downward.
    const was = classes[i - 1].get(previous)!, kind = classes[i].get(n)!;
    if (was !== 'chord') cost += size === 0 || size > 2 ? (prior.strong ? 2.6 : 1.8) : prior.strong && d > 0 ? .5 : 0;
    if (kind !== 'chord' && !slot.strong && (size === 0 || size > 2)) cost += .7;
    // Guide tones: reach the new chord's third or seventh by step.
    if (slot.change && size > 0 && size <= 2 && [3,4,10,11].includes(pc(n - slot.chord.root))) cost -= .45;
    return cost;
  };
  type State = { cost: number; path: number[] };
  let states = new Map<string, State>();
  for (const n of candidates[0]) states.set(`:${n}`, { cost: local(0, n) + Math.abs(n - homePitch) * .15, path: [n] });
  for (let i = 1; i < slots.length; i++) {
    const next = new Map<string, State>();
    const costs = new Map(candidates[i].map(n => [n, local(i, n)]));
    for (const state of states.values()) {
      const previous = state.path.at(-1)!, before = state.path.at(-2);
      for (const n of candidates[i]) {
        const cost = state.cost + costs.get(n)! + transition(i, before, previous, n);
        const k = `${previous}:${n}`, old = next.get(k);
        if (!old || cost < old.cost) next.set(k, { cost, path: [...state.path, n] });
      }
    }
    states = next;
  }
  const path = [...states.values()].sort((x, y) => x.cost - y.cost)[0].path;
  const notes: MusicEvent[] = slots.map((slot, i) => {
    const form = arrangementAt(s, slot.bar), arp = form.arpeggio && (!dnb || form.section === 'open');
    const kind: ToneClass = classes[i].get(path[i])!, passing = kind !== 'chord' && i + 1 < slots.length && Math.abs(path[i + 1] - path[i]) <= 2;
    return { at: slot.at, length: slot.length, voice: arp ? 'arp' : 'pluck', layer: 'motif', notes: [path[i]],
      gain: (ambient ? .048 : dnb ? .058 : .064) * slot.accent * (slot.stage === 2 ? 1.06 : slot.cadence ? .88 : 1) * (passing ? .92 : 1),
      pan: slot.stage % 2 ? .10 : -.10, cutoff: 3400 - s.warmth * 20,
      role: arp ? 'arpeggio' : passing ? 'passing' : 'anchor', ...(passing && !arp ? { resolvesTo: path[i + 1] } : {}),
      release: Math.max(.025, Math.min(.14, (slot.available - slot.length) * 240 / s.bpm)) };
  });
  // Occasional neighbour pickups inside real rests, resolving to the following note.
  const ornaments: MusicEvent[] = [];
  for (let i = 1; i < notes.length; i++) {
    const target = notes[i], prior = notes[i - 1], bar = Math.floor(target.at), stage = Math.floor((target.at - start) / 2);
    if ((stage !== 1 && stage !== 2) || target.voice === 'arp' || prior.role === 'passing' || prior.at + prior.length + (prior.release ?? 0) * s.bpm / 240 > target.at - .135) continue;
    if (random(s.seed, `m17-neighbor:${plan.chapter}:${plan.index}:${i}`) > (stage === 2 ? .4 : .22)) continue;
    const at = target.at - .125;
    if (Math.floor(at) !== bar || Math.round((at - bar) * 16) % 4 === 0 || backing.some(e => e.fill !== undefined && Math.abs(e.at - at) < .12)) continue;
    const chord = chordAt(s, bar), scale = chordScale(s, chord);
    const options = Array.from({ length: 5 }, (_, j) => target.notes[0] - 2 + j)
      .filter(n => n >= 60 && n <= 81 && n !== target.notes[0] && scale.includes(pc(n)) && toneClass(chord, scale, n) !== 'chord' && Math.abs(n - prior.notes[0]) <= 4);
    if (!options.length) continue;
    ornaments.push({ ...target, at, length: .05, release: .035, notes: [options[hash(`${s.seed}:m17:${plan.chapter}:${plan.index}:${i}:neighbor`) % options.length]],
      gain: target.gain * .68, role: 'neighbor', resolvesTo: target.notes[0] });
  }
  return [...notes, ...ornaments].sort((a, b) => a.at - b.at);
}
