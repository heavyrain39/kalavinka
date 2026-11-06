// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import { random } from './seed';

// The v17+ backing compiler runs as v6 and carries the real version as `harmonyEngine`.
const engine = (s: Settings) => Math.max(s.generatorVersion, s.harmonyEngine ?? 0);
const swingOf = (s: Settings) => s.profile === 'lofi' ? .010 + random(s.seed,'swing')*.008
  : s.profile === 'dub' && s.groove !== 'dnb' ? .002 : 0;

export function gridTime(settings: Settings, bar: number, step: number): number {
  const swing = swingOf(settings), pos = step % 4;
  // v20 lo-fi: the off-sixteenths move with the swung offbeat (half its delay), so every
  // sixteenth subdivides the swung eighths evenly instead of crowding the late offbeat.
  if (settings.profile === 'lofi' && engine(settings) >= 20 && Number.isInteger(step))
    return bar + step / 16 + (pos === 2 ? swing : pos % 2 ? swing / 2 : 0);
  return bar + step / 16 + (pos === 2 ? swing : 0);
}

/**
 * Moves a grid time by whole sixteenths and lands on the swung grid (v20+). Older versions
 * keep their straight offsets, so their scores stay exactly as they were.
 */
export function gridShift(settings: Settings, at: number, steps: number): number {
  if (engine(settings) < 20) return at + steps / 16;
  const bar = Math.floor(at + 1e-9), total = Math.round((at - bar) * 16) + steps;
  return gridTime(settings, bar + Math.floor(total / 16), ((total % 16) + 16) % 16);
}

/** v20+: a straight sixteenth position played on the swung grid; other times pass through. */
export function onGrid(settings: Settings, at: number): number {
  if (engine(settings) < 20) return at;
  const bar = Math.floor(at + 1e-9), step = Math.round((at - bar) * 16);
  return Math.abs(at - bar - step / 16) > 1e-6 ? at : gridTime(settings, bar + Math.floor(step / 16), step % 16);
}
