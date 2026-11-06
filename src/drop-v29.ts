// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent, Settings } from './music';
import { arrangementAt } from './arrangement';
import { fillPlanV17 } from './fills-v17';
import { random } from './seed';

// Generator v29 D&B: two gestures of the genre around the drop (the return after the breakdown).
//  1. Halftime build: the hats-only bars before the drop get a halftime beat — kick on one,
//     snare on three — rising bar by bar, so the drop's full-time break lands twice as fast.
//  2. Pre-drop silence: everything stops for the last beat before the drop; the crash and the
//     break come in out of that silence.
// Both are decided by the seed, once per 32-bar form, and never become a routine: the halftime
// plays in every other form of a run, the silence in about half the forms and never two running.
export const dropV29 = (s: Settings) => s.profile === 'dub' && s.groove === 'dnb' && s.generatorVersion >= 29;
/** Where in the bar the silence starts (beat four). */
export const SILENCE_AT = .75;
export const SILENCE_CHANCE = .55;
/** Halftime level relative to the groove's kick and snare, rising through the build. */
export const HALFTIME_LEVEL = [.62, .74, .86];

const dropAhead = (s: Settings, bar: number) => bar >= 0 && arrangementAt(s, bar).section === 'open' && arrangementAt(s, bar + 1).section === 'return';
const formOf = (s: Settings, bar: number) => Math.floor(bar / arrangementAt(s, bar).formLength);

export function silenceBar(s: Settings, bar: number): boolean {
  if (!dropV29(s) || s.energy < 25 || !dropAhead(s, bar)) return false;
  const form = formOf(s, bar), draw = (f: number) => random(s.seed, `drop29:silence:${f}`) < SILENCE_CHANCE;
  return draw(form) && (form === 0 || !draw(form - 1));
}

/** Bars of the build (drums out, no fill) that carry the halftime beat, oldest first. */
function halftimeBars(s: Settings, bar: number): number[] {
  const a = arrangementAt(s, bar);
  if (a.section !== 'open') return [];
  let drop = bar; while (drop < bar + 8 && !dropAhead(s, drop)) drop++;
  if (!dropAhead(s, drop)) return [];
  const bars: number[] = [];
  for (let b = drop; b > drop - 8 && arrangementAt(s, b).section === 'open'; b--) {
    if (arrangementAt(s, b).beatless) break;
    if (!fillPlanV17(s, b)) bars.unshift(b);
  }
  return bars.slice(-HALFTIME_LEVEL.length);
}

export function halftimeOn(s: Settings, bar: number): boolean {
  if (!dropV29(s) || s.energy < 35) return false;
  const bars = halftimeBars(s, bar);
  if (!bars.includes(bar)) return false;
  // In a run of forms only every other one goes halftime (counting back from the first).
  const form = formOf(s, bar), length = arrangementAt(s, bar).formLength;
  let run = 0;
  while (run < form && halftimeBars(s, bar - (run + 1) * length).length) run++;
  return run % 2 === 0 && random(s.seed, `drop29:halftime:${form}`) < .85;
}

/** Kick on one and snare on three, voiced from the song's own groove kick and snare. */
export function halftimeEvents(s: Settings, bar: number, template: () => MusicEvent[]): MusicEvent[] {
  if (!halftimeOn(s, bar)) return [];
  const level = HALFTIME_LEVEL[halftimeBars(s, bar).indexOf(bar) + HALFTIME_LEVEL.length - halftimeBars(s, bar).length];
  const groove = template();
  const kick = groove.find(e => e.voice === 'kick' && !e.ghost), snare = groove.find(e => e.voice === 'snare' && !e.ghost && e.fill === undefined);
  const out: MusicEvent[] = [];
  if (kick) out.push({ ...kick, at: bar, gain: kick.gain * level, velocity: +((kick.velocity ?? .8) * level).toFixed(3) });
  if (snare) out.push({ ...snare, at: bar + .5, gain: snare.gain * level, velocity: +((snare.velocity ?? .8) * level).toFixed(3) });
  return out;
}

/** Nothing starts in the silence, and notes ringing into it stop at its edge. */
export function applySilence(s: Settings, bar: number, events: MusicEvent[]): MusicEvent[] {
  if (!dropV29(s)) return events;
  const edge = silenceBar(s, bar) ? bar + SILENCE_AT : silenceBar(s, bar + 1) ? bar + 1 + SILENCE_AT : undefined;
  if (edge === undefined) return events;
  if (edge < bar + 1) {
    // The build fill sits on beat four: it moves up to beat three, which it replaces, and the
    // silence follows it — fill, a beat of nothing, then the drop.
    const fill = events.filter(e => e.layer === 'rhythm' && (e.voice === 'snare' || e.voice === 'tom') && e.at >= edge - 1e-9);
    if (fill.length) events = [
      ...events.filter(e => !(e.layer === 'rhythm' && e.at >= edge - .25 - 1e-9)),
      ...fill.map(e => ({ ...e, at: +(e.at - .25).toFixed(8) })),
    ].sort((a, b) => a.at - b.at);
  }
  return events.flatMap(e => {
    if (e.at >= edge - 1e-9) return [];
    if (e.at + e.length <= edge) return [e];
    const length = +(edge - e.at - .005).toFixed(8);
    return length < .01 ? [] : [{ ...e, length, ...(e.layer === 'harmony' || e.layer === 'motif' || e.layer === 'arpeggio' ? { release: .06 } : {}) }];
  });
}
