// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Layer, ProfileId } from './music';
import { random } from './seed';
export type InstrumentMix = Record<Layer, string> & { arpeggio?: string };
const CORE_PARTS: Layer[] = ['harmony', 'bass', 'rhythm', 'motif'];
export const defaultArpeggioInstrument = (profile: ProfileId): string => ({lofi:'m-marimba',ambient:'m-bell',dub:'m-pluck'})[profile];
export const INSTRUMENTS = {
  harmony: [{ id: 'h-felt', name: '펠트 건반' }, { id: 'h-electric', name: '일렉 피아노' }, { id: 'h-organ', name: '오르간' }, { id: 'h-pad', name: '스트링 패드' }],
  bass: [{ id: 'b-round', name: '라운드' }, { id: 'b-sub', name: '서브' }, { id: 'b-pluck', name: '플럭 베이스' }, { id: 'b-analog', name: '아날로그' }],
  rhythm: [{ id: 'r-brush', name: '브러시' }, { id: 'r-tape', name: '테이프 킷' }, { id: 'r-electro', name: '일렉트로' }, { id: 'r-click', name: '미니멀 킷' }],
  motif: [{ id: 'm-bell', name: '벨' }, { id: 'm-marimba', name: '마림바' }, { id: 'm-flute', name: '소프트 플루트' }, { id: 'm-pluck', name: '플럭' }],
  arpeggio: [{ id: 'm-bell', name: '벨' }, { id: 'm-marimba', name: '마림바' }, { id: 'm-flute', name: '소프트 플루트' }, { id: 'm-pluck', name: '플럭' }],
} as const;
const weights: Record<ProfileId, Record<Layer, number[]>> = {
  lofi: { harmony: [4, 5, 2, 1], bass: [4, 2, 4, 1], rhythm: [4, 5, 1, 2], motif: [2, 4, 3, 3] },
  ambient: { harmony: [2, 1, 3, 5], bass: [3, 5, 1, 2], rhythm: [4, 1, 1, 5], motif: [4, 2, 5, 2] },
  dub: { harmony: [1, 4, 4, 2], bass: [3, 4, 2, 5], rhythm: [1, 3, 5, 3], motif: [3, 1, 2, 5] },
};
export function chooseInstruments(profile: ProfileId, seed: string, previous?: InstrumentMix): InstrumentMix {
  const mix = {} as InstrumentMix;
  for (const layer of CORE_PARTS) {
    const candidates = INSTRUMENTS[layer].map((item, i) => ({ ...item, weight: weights[profile][layer][i] }))
      .filter((item) => item.id !== previous?.[layer]);
    // Avoid stacking two particularly bright attacks as often, but retain every manual choice.
    if (layer === 'motif' && mix.harmony === 'h-electric') candidates.forEach((c) => { if (c.id === 'm-bell') c.weight *= .4; });
    let pick = random(seed, `instrument:${layer}`) * candidates.reduce((sum, c) => sum + c.weight, 0);
    mix[layer] = candidates.at(-1)!.id;
    for (const candidate of candidates) { pick -= candidate.weight; if (pick < 0) { mix[layer] = candidate.id; break; } }
  }
  const preferred = defaultArpeggioInstrument(profile);
  const candidates = INSTRUMENTS.arpeggio.filter(i => i.id !== mix.motif
    && (!previous || i.id !== (previous.arpeggio ?? preferred)));
  mix.arpeggio = !previous && preferred !== mix.motif ? preferred
    : candidates[Math.floor(random(seed, 'instrument:arpeggio') * candidates.length)].id;
  return mix;
}
export function normalizeInstruments(input: unknown, profile: ProfileId, seed: string): InstrumentMix {
  const supplied = input && typeof input === 'object' ? input as Partial<InstrumentMix> : {};
  const fallback = chooseInstruments(profile, seed);
  const mix = Object.fromEntries(CORE_PARTS.map((layer) => [layer,
    INSTRUMENTS[layer].some((item) => item.id === supplied[layer]) ? supplied[layer] : fallback[layer]])) as InstrumentMix;
  // Omitted choices retain the original v8 profile sound and historical settings shape.
  if (INSTRUMENTS.arpeggio.some(i => i.id === supplied.arpeggio)) mix.arpeggio = supplied.arpeggio;
  return mix;
}
export const legacyInstruments = (): InstrumentMix => ({ harmony: 'legacy', bass: 'legacy', rhythm: 'legacy', motif: 'legacy' });

// Old scores predate selectable kits. Resolve their sound without rewriting the score.
export const resolveDrumKit = (id: string | undefined, profile: ProfileId): string =>
  INSTRUMENTS.rhythm.some(kit => kit.id === id) ? id! : {lofi:'r-tape', ambient:'r-brush', dub:'r-electro'}[profile];
