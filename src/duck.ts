// Kick-triggered bass gain envelope. A separate gain stage leaves mute/fader automation independent.
// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
export function scheduleDuck(param: AudioParam, start: number, depth: number, bpm: number, now: number) {
  const floor = 1 - Math.min(.65, Math.max(0, depth));
  const release = Math.min(.22, 60 / bpm * .42);
  param.cancelAndHoldAtTime(Math.max(now, start - .004));
  param.linearRampToValueAtTime(floor, start + .006);
  param.setValueAtTime(floor, start + .035);
  param.exponentialRampToValueAtTime(1, start + release);
}

// Generator v22 deep house: the whole music bus (chords, lead, arpeggio and their echo/room
// returns) breathes with the four-on-the-floor kick. The bass bypasses it and keeps its own,
// tighter duck, exactly as before.
export const pumpEnabled = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb' && s.generatorVersion >= 22;
/** Pump depth follows the written kick duck: about -3.9 dB in the groove, -1.8 dB in the intro. */
export const pumpDepth = (kickDuck: number) => Math.min(.38, Math.max(0, kickDuck * .75));

/** A softer, longer swell than the bass duck: dips in 12 ms, recovers over about 60% of a beat. */
export function schedulePump(param: AudioParam, start: number, depth: number, bpm: number, now: number) {
  const floor = 1 - Math.min(.5, Math.max(0, depth)), beat = 60 / bpm;
  param.cancelAndHoldAtTime(Math.max(now, start - .004));
  param.linearRampToValueAtTime(floor, start + .012);
  param.setValueAtTime(floor, start + .04);
  param.setTargetAtTime(1, start + .04, beat * .16);
  param.setValueAtTime(1, start + Math.max(.08, beat * .82));
}
