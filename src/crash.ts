// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings,MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {fillPlan} from './fills';
import {random} from './seed';
import {isV17} from './harmony-v17';

/** A downbeat wash after selected eight-bar transitions, with one boundary of space. */
export function crashEvent(s:Settings,bar:number):MusicEvent|undefined {
  if(s.generatorVersion<16||s.profile==='ambient'||s.energy<25||bar<=0||bar%8!==0)return;
  const eligible=(at:number)=>at>0&&!arrangementAt(s,at).beatless&&arrangementAt(s,at).section!=='open';
  const lead=(at:number)=>{
    const plan=fillPlan(s,at-1);
    if(!isV17(s)||!plan||!('kind' in plan))return plan?.62:.24;
    // v17: build-ups usually land on a cymbal; a stop or small turn rarely does.
    return plan.kind==='build'?.85:plan.kind==='lift'?.62:plan.kind==='drop'?.1:.2;
  };
  const wants=(at:number)=>eligible(at)&&random(s.seed,`crash16:${s.profile}:${s.groove}:${at}`)
    <lead(at)+s.energy*.0012;
  if(!wants(bar))return;
  // Every 32-bar form has an ineligible open boundary. Walk from that reset so
  // cooldown follows emitted accents, never a suppressed random proposal.
  let from=bar-8;
  while(from>0&&eligible(from))from-=8;
  let last=-16;
  for(let at=from+8;at<=bar;at+=8)if(wants(at)&&at-last>=16)last=at;
  if(last!==bar)return;
  return {at:bar,length:.125,voice:'crash',layer:'rhythm',notes:[],
    gain:(s.profile==='lofi'?.080:.100)*(.85+s.energy*.003),pan:.12,cutoff:9000,
    velocity:.60+random(s.seed,`crash16-velocity:${bar}`)*.22,
    variation:Math.floor(random(s.seed,`crash16-variation:${bar}`)*2)};
}
