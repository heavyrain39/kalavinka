// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import { arrangementAt } from './arrangement';

// Generator v23 deep house (four-on-the-floor only; D&B keeps its own sound).
// The house voices keep their warm v22 timbre, which lives mostly between 150 Hz and 1 kHz.
// A form-following low-pass on the music bus works in that range: the intro opens from a
// muffled, "next room" mix, the groove is open, the breakdown closes, the build-up opens again.
export const houseV23 = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb' && s.generatorVersion >= 23;

// Cut-off at the start of each local bar of the 32-bar form; the filter glides exponentially to
// the next bar's value, so there are no steps. OPEN is far above anything the voices play.
export const OPEN = 20000;
const ARC = [
  180, 200, 230, 270, 320, 400, 600, OPEN,          // intro: from a muffled room to the full mix
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,   // groove
  280, 280, 280, 280, 300, 380, 550, 1000,          // breakdown, then build-up
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, 600, 250,     // return, closing into the next intro
] as const;
export const sweepHz = (s: Settings, bar: number) => ARC[arrangementAt(s, Math.max(0, bar)).localBar];

/** Glide through `bar` (the song's own bar); the first call of a scene jumps to its value. */
export function scheduleSweep(param: AudioParam, s: Settings, bar: number, barStart: number, barSeconds: number, now: number, first: boolean) {
  const from = Math.max(now, barStart);
  param.cancelAndHoldAtTime(from);
  if (first) param.setValueAtTime(sweepHz(s, bar), from);
  param.exponentialRampToValueAtTime(sweepHz(s, bar + 1), barStart + barSeconds);
}
