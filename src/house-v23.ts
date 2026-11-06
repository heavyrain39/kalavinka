// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import { arrangementAt } from './arrangement';

// Generator v23 deep house (four-on-the-floor only; D&B keeps its own sound).
// v22 house chords lived almost entirely below 1 kHz: sine-built voices behind 1.5–2.2 kHz
// low-passes. v23 gives the chord voices upper partials, raises the part cut-offs, and lets a
// form-following music-bus filter open and close that new top end.
export const houseV23 = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb' && s.generatorVersion >= 23;

// Warmth still means darker, over a range that reaches a bright stab (v22: 3.2 kHz at most).
export const houseChordCutoff = (warmth: number) => Math.round(7000 - warmth * 45); // 62 → 4210 Hz
/** House chords sit forward in the mix (+2.6 dB over v22). */
export const HOUSE_CHORD_GAIN = 1.35;
export const houseLeadCutoff = (warmth: number) => Math.round(5200 - warmth * 28);  // 62 → 3464 Hz
export const houseArpCutoff = (warmth: number) => Math.round(2600 + (100 - warmth) * 30); // 62 → 3740 Hz

// Music-bus low-pass by local bar of the 32-bar form: the intro opens from a muffled mix, the
// groove is open, the breakdown closes, the build-up opens again, and the last two bars close
// into the next intro. Each value is the cut-off at the start of that bar; the filter glides
// exponentially to the next bar's value, so there are no steps.
export const OPEN = 20000;
const ARC = [
  1000, 1300, 1700, 2300, 3300, 5000, 9000, OPEN,   // intro
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,   // groove
  900, 900, 900, 900, 1200, 2000, 3600, 7000,       // breakdown, then build-up
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, 4000, 1800,   // return, closing into the next intro
] as const;
export const sweepHz = (s: Settings, bar: number) => ARC[arrangementAt(s, Math.max(0, bar)).localBar];

/** Glide through `bar` (the song's own bar); the first call of a scene jumps to its value. */
export function scheduleSweep(param: AudioParam, s: Settings, bar: number, barStart: number, barSeconds: number, now: number, first: boolean) {
  const from = Math.max(now, barStart);
  param.cancelAndHoldAtTime(from);
  if (first) param.setValueAtTime(sweepHz(s, bar), from);
  param.exponentialRampToValueAtTime(sweepHz(s, bar + 1), barStart + barSeconds);
}
