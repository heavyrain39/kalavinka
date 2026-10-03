// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import { random } from './seed';
export function gridTime(settings: Settings, bar: number, step: number): number {
  const swing = settings.profile === 'lofi' ? .010 + random(settings.seed,'swing')*.008
    : settings.profile === 'dub' && settings.groove !== 'dnb' ? .002 : 0;
  return bar + step / 16 + (step % 4 === 2 ? swing : 0);
}
