// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {DEFAULTS, PROFILES, type Settings} from './music';
export function resetSliders(settings: Settings): Settings {
  const profile = PROFILES[settings.profile];
  return {...settings,
    ...(settings.generatorVersion>=14?{melodyRepetition:2 as const}:{}),
    bpm: settings.profile === 'dub' && settings.groove === 'dnb' ? 170 : profile.bpm,
    energy: profile.energy, warmth: profile.warmth, evolution: profile.evolution,
    reverb: settings.profile === 'ambient' ? 76 : DEFAULTS.reverb, volume: DEFAULTS.volume,
  };
}
