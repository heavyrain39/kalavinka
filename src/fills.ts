// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings, MusicEvent } from './music';
import { arrangementAt } from './arrangement';
import { hash, random } from './seed';
import { gridTime } from './timing';
type Hit = readonly [number, 'snare'|'hat'|'rim'|'tom', number, number?];
export const FILL_RECIPES: readonly (readonly Hit[])[] = [
  [[14,'snare',.55],[15,'snare',.85]],
  [[13,'rim',.7],[15,'rim',1]],
  [[12,'hat',.7],[14,'hat',.5],[15,'hat',1]],
  [[13,'tom',.8,52],[15,'tom',1,45]],
  [[13,'snare',.45],[14,'snare',.65],[15,'snare',.9]],
  [[13,'tom',.8,50],[14.5,'tom',1,45],[15.5,'hat',.6]],
  [[10,'rim',.65],[13,'rim',.85],[15,'hat',.75]],
  [[10,'snare',.5],[11,'snare',.65],[14,'tom',1,45]],
  [[13,'hat',.5],[14,'hat',.7],[15,'hat',1]],
  [[12.5,'tom',.7,52],[13.5,'tom',.85,48],[15,'tom',1,43]],
  [[13,'snare',.65],[15,'rim',1]],
  [[10,'rim',.65],[14,'snare',.8],[15,'hat',.7]],
];
export function fillPlan(s:Settings,bar:number):{index:number;hits:readonly Hit[]}|null {
  const a=arrangementAt(s,bar);
  if(s.generatorVersion<5||s.profile==='ambient'||a.beatless||a.section==='open'||a.section==='intro'||s.energy<20||bar%8!==7)return null;
  // Chance at each eligible boundary, plus a one-boundary cooldown. Never every bar.
  const eligible=(n:number)=>{const f=arrangementAt(s,n);return n>=0&&f.section!=='intro'&&f.section!=='open'&&!f.beatless;};
  const wants=(n:number)=>{const f=arrangementAt(s,n);return random(s.seed,`fill-gate:${s.profile}:${f.localBar}:${f.variant}`)<.30+s.energy*.003;};
  if(!wants(bar)||(eligible(bar-8)&&wants(bar-8)))return null;
  const ordinal=Math.floor(a.localBar/8)+a.variant*5;
  // Coprime walk through the palette prevents the same gesture at successive slots.
  const index=(hash(`${s.seed}:${s.profile}:fill`)+ordinal*5)%FILL_RECIPES.length;
  let hits=FILL_RECIPES[index];
  if(s.energy<45)hits=hits.slice(-2);
  return {index,hits};
}
export function addFill(s:Settings,bar:number,events:MusicEvent[]) {
  const plan=fillPlan(s,bar);if(!plan)return;
  const begin=gridTime(s,bar,plan.hits[0][0]);
  // Clear the tail's optional hats/ghost snares, retaining the kick and 2/4 backbeat.
  for(let i=events.length-1;i>=0;i--) {
    const e=events[i];
    if(e.at>=begin&&e.at<bar+1&&(e.voice==='hat'||(e.voice==='snare'&&e.gain<.03)))events.splice(i,1);
  }
  plan.hits.forEach(([step,voice,accent,note],i)=>events.push({
    at:gridTime(s,bar,step),length:voice==='tom'?.045:.018,voice,layer:'rhythm',notes:note?[note]:[],
    gain:(voice==='tom'?.040:voice==='hat'?.023:.026)*accent*(.75+s.energy*.0025),
    pan:voice==='tom'?(i%2?.22:-.22):voice==='hat'?.16:0,cutoff:5000,fill:plan.index,
  }));
}
