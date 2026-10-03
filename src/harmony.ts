// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings, Chord } from './music';
import { hash } from './seed';
import { scaleFor } from './harmony-v5';
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const QUALITY = { m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '7sus4': [0, 5, 7, 10] };
type Degree = [number, keyof typeof QUALITY];
const MINOR: Degree[][] = [
  [[0,'m7'],[8,'maj7'],[3,'maj7'],[10,'7sus4']], [[0,'m7'],[5,'m7'],[8,'maj7'],[10,'7sus4']],
  [[0,'m7'],[3,'maj7'],[5,'m7'],[10,'7sus4']], [[0,'m7'],[10,'7sus4'],[8,'maj7'],[5,'m7']],
  [[8,'maj7'],[10,'7sus4'],[0,'m7'],[5,'m7']], [[0,'m7'],[5,'m7'],[3,'maj7'],[8,'maj7']],
];
const MAJOR: Degree[][] = [
  [[0,'maj7'],[9,'m7'],[5,'maj7'],[7,'7sus4']], [[0,'maj7'],[4,'m7'],[5,'maj7'],[2,'m7']],
  [[0,'maj7'],[5,'maj7'],[2,'m7'],[7,'7sus4']], [[9,'m7'],[5,'maj7'],[0,'maj7'],[7,'7sus4']],
  [[2,'m7'],[7,'7sus4'],[0,'maj7'],[5,'maj7']], [[0,'maj7'],[2,'m7'],[9,'m7'],[5,'maj7']],
];
export const tonicFor = (settings: Settings) => 48 + hash(settings.seed) % 12;
export function diatonicPitches(settings: Settings, low: number, high: number): number[] {
  if (settings.generatorVersion >= 5) return scaleFor(settings, low, high);
  const scale = settings.profile === 'ambient' ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10];
  return Array.from({length: high-low+1}, (_,i)=>low+i).filter(n=>scale.includes((n-tonicFor(settings)%12+12)%12));
}
export const pitchesOf = (chord: Chord, low: number, high: number) => Array.from({ length: high-low+1 }, (_,i)=>low+i)
  .filter(n=>chord.notes.some(c=>c%12===n%12));
const cache = new Map<string, Chord[]>();
export function ensembleProgression(settings: Settings): Chord[] {
  const key = `${settings.profile}:${settings.seed}`;
  const saved = cache.get(key); if (saved) return saved;
  const recipe = (settings.profile === 'ambient' ? MAJOR : MINOR)[hash(`${settings.seed}:harmony`) % 6];
  const chords = recipe.map(([degree, quality]) => {
    const root = tonicFor(settings) + degree, base = QUALITY[quality].map(n=>root+n);
    const candidates: number[][] = [];
    for (let inversion=0; inversion<4; inversion++) for (const octave of [-24,-12,0,12]) {
      const notes = [...base.slice(inversion), ...base.slice(0,inversion).map(n=>n+12)].map(n=>n+octave);
      if (notes[0]>=52 && notes[3]<=79) candidates.push(notes);
    }
    return { root, label: NAMES[root%12]+quality, candidates };
  });
  const movement = (a: number[], b: number[]) => a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0);
  const register = (a: number[]) => Math.abs(a.reduce((sum,n)=>sum+n,0)/4-64)*.4;
  // Dynamic programming, including the last→first edge, avoids an unvoiced loop seam.
  let best: { cost: number; path: number[] } = { cost: Infinity, path: [] };
  for (let first=0; first<chords[0].candidates.length; first++) {
    let states = [{ cost: register(chords[0].candidates[first]), path: [first] }];
    for (let i=1;i<4;i++) states = chords[i].candidates.map((notes,j)=> {
      const options = states.map(state=>({ cost: state.cost+movement(chords[i-1].candidates[state.path.at(-1)!],notes)+register(notes), path:[...state.path,j] }));
      return options.sort((a,b)=>a.cost-b.cost)[0];
    });
    for (const state of states) {
      const cost = state.cost+movement(chords[3].candidates[state.path[3]],chords[0].candidates[first]);
      if (cost<best.cost) best={cost,path:state.path};
    }
  }
  const result = chords.map((c,i)=>({ root:c.root,label:c.label,notes:c.candidates[best.path[i]] }));
  if (cache.size>=128) cache.delete(cache.keys().next().value!);
  cache.set(key,result);return result;
}
