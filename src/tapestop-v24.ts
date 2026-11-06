// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent, Settings } from './music';
import { arrangementAt } from './arrangement';
import { random } from './seed';

// Generator v24 lo-fi: an occasional tape stop on the last beat before the breakdown.
// The whole tape (music, drums, hiss) slows to a halt, the breakdown's soft pad starts in the
// silence after it. Nothing is random at play time: the seed decides, once per 32-bar form.
export const tapeStopV24 = (s: Settings) => s.profile === 'lofi' && s.generatorVersion >= 24;
/** Where in the bar the stop begins (beat four). */
export const STOP_AT = .75;
export const STOP_CHANCE = .55;

export function tapeStopBar(s: Settings, bar: number): boolean {
  if (!tapeStopV24(s) || s.energy < 25 || bar < 0) return false;
  const a = arrangementAt(s, bar), next = arrangementAt(s, bar + 1);
  if (a.section !== 'groove' || next.section !== 'open') return false;
  // Never in two forms running: a form whose predecessor drew a stop leaves it out.
  const form = Math.floor(bar / a.formLength), draw = (f: number) => random(s.seed, `tapestop24:${f}`) < STOP_CHANCE;
  return draw(form) && (form === 0 || !draw(form - 1));
}

/** Notes may ring into the stop (they slow down with it), but nothing new starts inside it. */
export function applyTapeStop(s: Settings, bar: number, events: MusicEvent[]): MusicEvent[] {
  return tapeStopBar(s, bar) ? events.filter(e => e.at < bar + STOP_AT - 1e-9) : events;
}

// Playback speed falls as 1 - u^1.3 (u: 0 → 1 across the stop): it sags at first, then gives way.
// A delay line plays that speed when its delay grows by the integral of the lost speed.
const SHAPE = 1.3, POINTS = 96;
export const stopSpeed = (u: number) => 1 - u ** SHAPE;
export const stopDelay = (u: number, seconds: number) => seconds * u ** (SHAPE + 1) / (SHAPE + 1);
/** Volume falls away over the last 45% of the stop, as the tape loses speed. */
export const stopLevel = (u: number) => u < .55 ? 1 : Math.cos((u - .55) / .45 * Math.PI / 2) ** 2;

export function scheduleTapeStop(delay: AudioParam, level: AudioParam, base: number, start: number, end: number, now: number) {
  const seconds = end - start;
  if (seconds <= .05 || start < now) return false;
  const d = Float32Array.from({ length: POINTS }, (_, i) => base + stopDelay(i / (POINTS - 1), seconds));
  const g = Float32Array.from({ length: POINTS }, (_, i) => stopLevel(i / (POINTS - 1)));
  delay.cancelAndHoldAtTime(start); level.cancelAndHoldAtTime(start);
  delay.setValueCurveAtTime(d, start, seconds); level.setValueCurveAtTime(g, start, seconds);
  // Silent at the bar line: rewind the tape, then let the next bar in within 10 ms.
  delay.setValueAtTime(base, end + .001);
  level.setValueAtTime(0, end + .002); level.linearRampToValueAtTime(1, end + .012);
  return true;
}
