// Kick-triggered bass gain envelope. A separate gain stage leaves mute/fader automation independent.
// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
export function scheduleDuck(param: AudioParam, start: number, depth: number, bpm: number, now: number) {
  const floor = 1 - Math.min(.65, Math.max(0, depth));
  const release = Math.min(.22, 60 / bpm * .42);
  param.cancelAndHoldAtTime(Math.max(now, start - .004));
  param.linearRampToValueAtTime(floor, start + .006);
  param.setValueAtTime(floor, start + .035);
  param.exponentialRampToValueAtTime(1, start + release);
}
