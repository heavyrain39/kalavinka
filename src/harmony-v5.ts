// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings, Chord } from './music';
import { hash, random } from './seed';
import { arrangementAt } from './arrangement';
import { HARMONIES, QUALITIES, type Degree } from './harmony-catalog';
import { isV17, hasEndingV17, nextBoundaryV17 } from './harmony-v17';
import { isV18, hasEndingV18, nextBoundaryV18 } from './harmony-v18';
const NAMES = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
export const recipeFor = (s: Settings) => {
  const bank = HARMONIES.filter(r => r.profile === s.profile);
  return bank[hash(`${s.seed}:harmony-v5:${s.profile}`) % bank.length];
};
export const holdFor = (s: Settings) => s.profile === 'ambient' || s.groove === 'dnb' ? 4 : 2;
export function scaleFor(s: Settings, low: number, high: number) {
  const steps = recipeFor(s).mode === 'major' ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10];
  const tonic = hash(s.seed) % 12;
  return Array.from({length:high-low+1},(_,i)=>low+i).filter(n=>steps.includes((n-tonic+120)%12));
}
const movement = (a: number[], b: number[]) => a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0);
const register = (a: number[]) => Math.abs(a.reduce((sum,n)=>sum+n,0)/4-64)*.4;
function candidates(tonic: number, degree: Degree) {
  const root = tonic + degree[0], base = QUALITIES[degree[1]].map(n=>root+n);
  const options: number[][] = [];
  for (let inversion=0;inversion<4;inversion++) for(const octave of [-24,-12,0,12]) {
    const notes=[...base.slice(inversion),...base.slice(0,inversion).map(n=>n+12)].map(n=>n+octave).sort((a,b)=>a-b);
    if(notes[0]>=52&&notes[3]<=79&&notes[3]-notes[0]<=18&&!options.some(a=>a.join(',')===notes.join(',')))options.push(notes);
  }
  return {root,label:NAMES[root%12]+degree[1],options};
}
const cache = new Map<string,{base:Chord[];ending:Chord}>();
function voiced(s:Settings) {
  const key=`${s.profile}:${s.seed}`,saved=cache.get(key);if(saved)return saved;
  const recipe=recipeFor(s),tonic=48+hash(s.seed)%12,chords=recipe.chords.map(d=>candidates(tonic,d));
  let best={cost:Infinity,path:[] as number[]};
  for(let first=0;first<chords[0].options.length;first++) {
    let states=[{cost:register(chords[0].options[first]),path:[first]}];
    for(let i=1;i<4;i++)states=chords[i].options.map((notes,j)=>states.map(state=>({cost:state.cost+movement(chords[i-1].options[state.path.at(-1)!],notes)+register(notes),path:[...state.path,j]})).sort((a,b)=>a.cost-b.cost)[0]);
    for(const state of states){const cost=state.cost+movement(chords[3].options[state.path[3]],chords[0].options[first]);if(cost<best.cost)best={cost,path:state.path};}
  }
  const base=chords.map((c,i)=>({root:c.root,label:c.label,notes:c.options[best.path[i]]}));
  const end=candidates(tonic,recipe.ending);
  const notes=end.options.sort((a,b)=>(movement(base[3].notes,a)+movement(a,base[0].notes)+register(a))-(movement(base[3].notes,b)+movement(b,base[0].notes)+register(b)))[0];
  const result={base,ending:{root:end.root,label:end.label,notes}};
  if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
}
export function hasEnding(s:Settings,bar:number) {
  if(isV18(s))return hasEndingV18(s,bar);
  if(isV17(s))return hasEndingV17(s,bar);
  const n=Math.floor(Math.max(0,bar)),cycle=holdFor(s)*4,a=arrangementAt(s,n);
  if(n%cycle!==cycle-1||a.section==='intro')return false;
  // A repeatable plan inside the form; evolution changes it only at a form boundary.
  return random(s.seed,`cadence:${s.profile}:${Math.floor(a.localBar/cycle)}:${a.variant}`)<.68;
}
export function progressionV5(s:Settings,bar=0):Chord[] {
  const {base,ending}=voiced(s);
  return hasEnding(s,bar)?[...base.slice(0,3),ending]:base;
}
export function chordV5(s:Settings,bar:number):Chord {
  return progressionV5(s,bar)[Math.floor(Math.max(0,bar)/holdFor(s))%4];
}
export function nextHarmonyBoundary(s:Settings,at:number) {
  if(isV18(s))return nextBoundaryV18(s,at);
  if(isV17(s))return nextBoundaryV17(s,at);
  const hold=holdFor(s),usual=(Math.floor(at/hold)+1)*hold;
  const endingBar=Math.floor(at/(hold*4))*(hold*4)+hold*4-1;
  return endingBar>at&&hasEnding(s,endingBar)?Math.min(usual,endingBar):usual;
}
