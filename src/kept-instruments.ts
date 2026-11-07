// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { INSTRUMENTS, type InstrumentMix } from './instruments';
import { PROFILES, type ProfileId } from './music';

// "Keep sounds" remembers the sounds of each atmosphere separately. While it is on, moving to
// another atmosphere and back returns the sounds that atmosphere had when it was left; an
// atmosphere visited for the first time keeps whatever it starts with. Turning it off forgets them.
export type KeptMixes = Partial<Record<ProfileId, InstrumentMix>>;
const CORE = ['harmony', 'bass', 'rhythm', 'motif'] as const;
const valid = (layer: keyof typeof INSTRUMENTS, id: unknown) => INSTRUMENTS[layer].some(i => i.id === id);

/** A copy of the mix, or undefined when it is not a complete palette mix (e.g. legacy sounds). */
export function keptMix(input: unknown): InstrumentMix | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const mix = input as Partial<InstrumentMix>;
  if (!CORE.every(layer => valid(layer, mix[layer]))) return undefined;
  const out = Object.fromEntries(CORE.map(layer => [layer, mix[layer]])) as InstrumentMix;
  if (valid('arpeggio', mix.arpeggio)) out.arpeggio = mix.arpeggio;
  return out;
}

export function normalizeKept(input: unknown): KeptMixes {
  const kept: KeptMixes = {};
  if (!input || typeof input !== 'object') return kept;
  for (const profile of Object.keys(PROFILES) as ProfileId[]) {
    const mix = keptMix((input as Record<string, unknown>)[profile]);
    if (mix) kept[profile] = mix;
  }
  return kept;
}

export function rememberMix(kept: KeptMixes, profile: ProfileId, mix: InstrumentMix): KeptMixes {
  const copy = keptMix(mix);
  return copy ? { ...kept, [profile]: copy } : kept;
}
