// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings, MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {random} from './seed';
import {gridTime} from './timing';
import {fillPlan} from './fills';

// Develop the existing shared kick/bass plan; main kicks and backbeats stay fixed.
export function drumPerformance(s: Settings, bar: number, original: MusicEvent[]): MusicEvent[] {
  const dnb=s.profile==='dub'&&s.groove==='dnb', a=arrangementAt(s,bar);
  const r=(key:string)=>random(s.seed,`drummer:${s.profile}:${bar%2}:${a.variant}:${key}`);
  const result=original.map(e=>{
    if(e.layer!=='rhythm')return e;
    const step=Math.round((e.at-bar)*16), hat=e.voice==='hat';
    const strong=step%4===0;
    // Hats lean behind the anchors; the repeating gesture uses a few milliseconds.
    const lag=hat ? (s.profile==='lofi'?.004:dnb?.0015:.003)*(step%4===2?1:.35) : 0;
    // v17 fills carry their own crescendo and hat articulation.
    const velocity=e.fill!==undefined&&e.velocity!==undefined?e.velocity:e.voice==='kick'?(step===0?.96:.86):e.voice==='snare'?(e.fill===undefined?.88:.40+Math.min(.45,e.gain*8))
      :hat?(strong?.75:step%4===2?.66:.43):.68;
    const articulation: MusicEvent['articulation']=!hat?'closed':e.fill!==undefined?e.articulation??'closed'
      :s.profile==='dub'&&step%4===2&&a.section!=='intro'&&s.energy>35?(dnb?(step===14&&bar%2===1?'half':'closed'):r(`open:${step}`)>.48?'open':'half'):'closed';
    return {...e,at:Math.min(bar+.999,e.at+lag*s.bpm/240),velocity:Math.max(.2,Math.min(1,velocity+(r(`${step}:${e.voice}`)-.5)*.06)),
      articulation,variation:Math.floor(r(`rr:${step}:${e.voice}`)*2),pan:hat?(step%4===0?-.10:.10):e.pan};
  });
  // Quiet replies around the backbeat, withheld in intros, breakdowns and fills.
  if(s.profile!=='ambient'&&!a.beatless&&a.section!=='intro'&&a.section!=='open'&&s.energy>=35&&!original.some(e=>e.fill!==undefined)) {
    const steps=dnb?(bar%2?[3,11,14.5]:[7,15]):s.profile==='lofi'?[11]:[15];
    // A v17 stop keeps its last beat silent.
    const plan=fillPlan(s,bar),stop=!!plan&&'kind' in plan&&plan.kind==='drop';
    for(const step of steps) {
      if(stop&&step>=12)continue;
      if(r(`ghost:${step}`)>(dnb?.66:.32))continue;
      const at=gridTime(s,bar,step);
      if(result.some(e=>e.layer==='rhythm'&&e.voice!=='hat'&&Math.abs(e.at-at)<.045))continue;
      result.push({voice:'snare',layer:'rhythm',at,length:.018,notes:[],gain:dnb?.014:.011,pan:0,cutoff:4500,
        velocity:.26+r(`soft:${step}`)*.10,ghost:true,variation:Math.floor(r(`ghost-rr:${step}`)*2)});
    }
  }
  return result.sort((x,y)=>x.at-y.at);
}
