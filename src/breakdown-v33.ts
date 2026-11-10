// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent, Settings } from './music';
import { arrangementAt } from './arrangement';
import { halftimeOn } from './drop-v29';
import { drumPerformance } from './drum-performance';
import { random } from './seed';
import { gridTime } from './timing';

// Generator v33: the breakdown is not the same silence every time. Until v32 every form took
// all the drums out for four bars and ticked two hats a bar through the build. Now each form
// plays one of three breakdowns, chosen by the seed:
//   empty — as before: four bars of nothing, then the sparse build.
//   hats  — offbeat hats keep ticking, soft and rising, all the way to the fill (D&B: the
//           eighths of its own hat line).
//   light — the hats plus a halftime skeleton: a soft kick on one, then a soft snare on three.
// A song has a base breakdown; the Variation slider sets how often a form moves to another
// one. At 0 every form repeats the base. A run of forms with the same breakdown repeats it
// exactly. The hats go through the same drummer as the groove (swing, lag, round robin, the
// house's opening offbeat) and the kick and snare are the groove's own, two bars into the
// return, so the kit and the feel match the bars around the breakdown.
export type Breakdown = 'empty' | 'hats' | 'light';
export interface BreakdownPlan { kind: Breakdown; /** The form in which this breakdown was drawn. */ since: number }

export const breakdownV33 = (s: Settings) => s.generatorVersion >= 33 && s.profile !== 'ambient';
const WEIGHTS: Record<Breakdown, number> = { empty: .4, hats: .4, light: .2 };
/** Chance per form of moving to another breakdown: Variation 35 → 56%, 0 → never. */
export const changeChance = (s: Settings) => Math.min(.9, s.evolution * .016);
/** Level of the added hats relative to the groove's offbeat hat, bar by bar through the eight bars. */
export const HAT_LEVEL = [.62, .68, .74, .8, .86, .92, .96, 1];
const kickLevel = (i: number) => Math.min(.8, .5 + i * .05), snareLevel = (i: number) => Math.min(.75, .4 + i * .05);

function pick(roll: number, without?: Breakdown): Breakdown {
  const kinds = (Object.keys(WEIGHTS) as Breakdown[]).filter(k => k !== without);
  let left = roll * kinds.reduce((sum, k) => sum + WEIGHTS[k], 0);
  for (const kind of kinds) { left -= WEIGHTS[kind]; if (left < 0) return kind; }
  return kinds[kinds.length - 1];
}

const plans = new Map<string, BreakdownPlan[]>();
/** The breakdown of a form (0 = the first 32 bars). */
export function breakdownPlan(s: Settings, form: number): BreakdownPlan {
  const key = [s.seed, s.profile, s.groove, s.evolution].join(':');
  let list = plans.get(key);
  if (!list) { if (plans.size >= 64) plans.delete(plans.keys().next().value!); plans.set(key, list = []); }
  for (let f = list.length; f <= form; f++) {
    const previous = list[f - 1];
    list.push(!previous ? { kind: pick(random(s.seed, 'break33:base')), since: 0 }
      : random(s.seed, `break33:change:${f}`) < changeChance(s) ? { kind: pick(random(s.seed, `break33:kind:${f}`), previous.kind), since: f }
      : previous);
  }
  return list[form];
}

/** The breakdown that plays in this bar, or null outside a breakdown. */
export function breakdownAt(s: Settings, bar: number): BreakdownPlan | null {
  if (!breakdownV33(s) || bar < 0) return null;
  const a = arrangementAt(s, bar);
  return a.section === 'open' ? breakdownPlan(s, Math.floor(bar / a.formLength)) : null;
}

/**
 * The bar with the drums of its breakdown. `written` is the bar so far; `template` returns the
 * performed drums of a groove bar. A hats or light breakdown replaces the two sparse hats of
 * the build with its own line, so the hats do not double up.
 */
export function breakdownDrums(s: Settings, bar: number, written: MusicEvent[], template: (bar: number) => MusicEvent[]): MusicEvent[] {
  const plan = breakdownAt(s, bar);
  if (!plan || plan.kind === 'empty' || s.energy < 15) return written;
  const a = arrangementAt(s, bar), i = a.localBar % 8, dnb = s.profile === 'dub' && s.groove === 'dnb';
  // The groove two bars into the return, same half of its two-bar pattern.
  const from = bar - i + 10 + i % 2;
  const groove = template(from).filter(e => e.layer === 'rhythm' && !e.ghost && e.fill === undefined);
  // The fill owns the end of its bar: nothing is added from just before its first stroke.
  const fill = Math.min(bar + 1, ...written.filter(e => e.fill !== undefined).map(e => e.at)) - .01;
  const entry = plan.kind === 'light' ? 0 : [0, 0, 1, 2][Math.floor(random(s.seed, `break33:entry:${plan.since}`) * 4)];
  const present = i < entry ? written : written.filter(e => !(e.layer === 'rhythm' && e.voice === 'hat' && e.fill === undefined && e.at < fill));
  const out: MusicEvent[] = [];
  const add = (e: MusicEvent, at: number, level: number) => {
    if (at >= fill || present.some(p => p.layer === 'rhythm' && p.voice === e.voice && Math.abs(p.at - at) < .02)) return;
    out.push({ ...e, at, gain: e.gain * level, velocity: +Math.max(.2, (e.velocity ?? .6) * level).toFixed(3),
      ...(e.duck === undefined ? {} : { duck: +(e.duck * level).toFixed(3) }) });
  };
  // Hats enter in bar one, two or three of the breakdown.
  if (i >= entry) {
    // Closed until the build; from there the groove's own half-open and open hats come through.
    const voiced = (hat: MusicEvent): MusicEvent => i < 4 ? { ...hat, articulation: 'closed' } : hat;
    if (dnb) for (const hat of groove.filter(e => e.voice === 'hat' && Math.round((e.at - from) * 16) % 2 === 0)) add(voiced(hat), hat.at - from + bar, HAT_LEVEL[i]);
    else {
      // Offbeat eighths (the two after the backbeats when the energy is low).
      const line = (s.energy < 35 ? [6, 14] : [2, 6, 10, 14]).map((step, k): MusicEvent => ({ voice: 'hat', layer: 'rhythm',
        at: gridTime(s, bar, step), length: .018, notes: [], gain: k % 2 ? .019 : .024, pan: 0, cutoff: 3200 - s.warmth * 23 }));
      for (const hat of drumPerformance(s, bar, line)) add(voiced(hat), hat.at, HAT_LEVEL[i]);
    }
  }
  if (plan.kind === 'light' && !halftimeOn(s, bar)) {
    const kick = groove.find(e => e.voice === 'kick'), snare = groove.find(e => e.voice === 'snare');
    if (kick && i >= 1) add(kick, bar, kickLevel(i));
    // In the fill's bar the snare belongs to the fill.
    if (snare && i >= 2 && fill > bar + 1 - .02) add(snare, bar + .5, snareLevel(i));
  }
  return out.length || present.length < written.length ? [...present, ...out] : written;
}
