// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings,MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {fillPlan} from './fills';
import {gridTime} from './timing';
import {hash,random} from './seed';

// Generator v18 D&B hats: the two-step break gets a dense, dynamic hat line instead of plain
// eighths. Offbeat eighths carry the accent, sixteenth ghosts give the rolling shuffle.
type Bar=readonly (readonly [number,number])[]; // [step, velocity]
const LEVELS:readonly (readonly (readonly [Bar,Bar])[])[]=[
  // Light: eighths with an accent on the offbeats and one ghost.
  [[[[0,.45],[2,.78],[4,.42],[6,.74],[8,.45],[10,.78],[12,.42],[14,.72]],[[0,.45],[2,.78],[4,.42],[6,.74],[7,.3],[8,.45],[10,.78],[12,.42],[14,.72]]],
   [[[2,.8],[6,.76],[10,.8],[14,.74],[15,.3]],[[2,.8],[6,.76],[7,.3],[10,.8],[14,.74]]]],
  // Two-step shuffle: eighths plus paired sixteenth pickups.
  [[[[0,.5],[2,.8],[3,.32],[6,.78],[8,.5],[10,.8],[11,.3],[14,.76],[15,.34]],[[0,.5],[2,.8],[6,.78],[7,.3],[8,.5],[10,.8],[13,.32],[14,.74]]],
   [[[0,.48],[2,.8],[5,.3],[6,.78],[8,.48],[10,.8],[12,.4],[14,.76],[15,.3]],[[0,.48],[2,.8],[3,.3],[6,.78],[8,.48],[9,.3],[10,.8],[14,.76]]]],
  // Rolling sixteenths with a breath on the second bar.
  [[Array.from({length:16},(_,i)=>[i,i%4===2?.8:i%4===0?.55:i%4===3?.36:.3] as const),
    Array.from({length:16},(_,i)=>[i,i%4===2?.8:i%4===0?.55:i%4===3?.36:.3] as const).filter(([i])=>i!==5&&i!==13)],
   [Array.from({length:16},(_,i)=>[i,i%4===2?.82:i%4===0?.5:i%2?.32:.4] as const).filter(([i])=>i!==9),
    Array.from({length:16},(_,i)=>[i,i%4===2?.82:i%4===0?.5:i%2?.32:.4] as const).filter(([i])=>i!==1&&i!==9)]],
];

export function dnbHatsV18(s:Settings,start:number,events:MusicEvent[]):MusicEvent[]{
  if(s.profile!=='dub'||s.groove!=='dnb')return events;
  const out=[...events];
  for(let bar=start;bar<start+8;bar++){
    const a=arrangementAt(s,bar);
    if(a.beatless||a.section==='open')continue;
    // Rolling sixteenths from moderate energy; the intro sits one level lighter.
    const level=Math.max(0,(s.energy<25?0:s.energy<45?1:2)-(a.section==='intro'?1:0));
    const pattern=LEVELS[level][(hash(`${s.seed}:hats18`)+Math.floor(a.localBar/8)+a.variant)%LEVELS[level].length][bar%2];
    const fills=events.filter(e=>e.fill!==undefined&&Math.floor(e.at)===bar);
    const plan=fillPlan(s,bar),drop=!!plan&&'kind' in plan&&plan.kind==='drop';
    const until=fills.length?Math.min(...fills.map(e=>e.at))-.01:drop?gridTime(s,bar,12)-1e-6:bar+1;
    for(let i=out.length-1;i>=0;i--)if(out[i].voice==='hat'&&out[i].fill===undefined&&Math.floor(out[i].at)===bar)out.splice(i,1);
    for(const [step,velocity] of pattern){
      const at=gridTime(s,bar,step);
      if(at>=until)continue;
      const v=Math.max(.2,Math.min(1,velocity+(random(s.seed,`hats18:${a.localBar%8}:${step}:${a.variant}`)-.5)*.06));
      out.push({voice:'hat',layer:'rhythm',at,length:.018,notes:[],gain:+(.012+.016*v).toFixed(5),pan:step%2?.12:-.12,cutoff:9000,velocity:+v.toFixed(3)});
    }
  }
  return out.sort((x,y)=>x.at-y.at);
}
