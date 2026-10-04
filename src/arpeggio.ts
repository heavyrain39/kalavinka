// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, hash, random, type Settings, type MusicEvent } from './music';
import { nextHarmonyBoundary } from './harmony-v5';
import { defaultArpeggioInstrument } from './instruments';

// Indices into a compact chord voicing: twelve recognisable, repeatable gestures.
export const ARP_PATTERNS = [
  [0,1,2,3], [3,2,1,0], [0,1,2,3,2,1], [3,2,1,0,1,2],
  [0,2,1,3], [3,1,2,0], [0,1,0,2,0,3], [3,2,3,1,3,0],
  [0,3,1,2], [1,2,0,3], [0,2,3,2,1,2], [2,0,1,3,1,0],
] as const;

export function arpeggioPlan(s:Settings,bar:number){
  const stretch=s.profile==='ambient'||s.groove==='dnb'?2:1;
  const episode=Math.floor(bar/(16*stretch));
  const start=episode*16*stretch+(8+2*(hash(`${s.seed}:arp-entry:${episode}`)%2))*stretch;
  // A seeded permutation visits all twelve before repeating, with no identical neighbours.
  const order=ARP_PATTERNS.map((_,i)=>i).sort((a,b)=>hash(`${s.seed}:arp-order:${a}`)-hash(`${s.seed}:arp-order:${b}`)||a-b);
  return {episode,start,end:start+4*stretch,stretch,pattern:order[episode%order.length]};
}

export function arpeggioEvents(s:Settings,bar:number,backing:MusicEvent[]):MusicEvent[]{
  if(s.generatorVersion<8||s.arpeggio===false)return [];
  const plan=arpeggioPlan(s,bar);
  if(bar<plan.start||bar>=plan.end)return [];
  const contour=ARP_PATTERNS[plan.pattern],phraseLength=2*plan.stretch;
  const phraseStart=plan.start+Math.floor((bar-plan.start)/phraseLength)*phraseLength;
  const step=phraseLength/contour.length;
  const offset=(random(s.seed,`arp-rhythm:${plan.episode}`)<.5?.0625:.125)*plan.stretch;
  const instrument=s.instruments.arpeggio??defaultArpeggioInstrument(s.profile);
  const register=60+(hash(`${s.seed}:arp-register:${plan.episode}`)%2)*3;
  const melody=backing.filter(e=>e.layer==='motif');
  const result:MusicEvent[]=[];
  contour.forEach((degree,i)=>{
    let at=phraseStart+i*step+offset;
    if(Math.floor(at)!==bar)return;
    // Leave the leading melody's attack clear while retaining the arpeggio's contour.
    for(let attempt=0;attempt<2&&melody.some(e=>Math.abs(e.at-at)<.045);attempt++)at+=.0625;
    const chord=chordAt(s,bar);
    const pitches=Array.from({length:24},(_,j)=>register+j).filter(n=>chord.notes.some(c=>c%12===n%12)).slice(0,4);
    const note=pitches[degree];
    const occupied=melody.some(e=>e.at<at+.08&&e.at+e.length>at);
    const release=.06;
    const space=Math.min(step-.07,nextHarmonyBoundary(s,at)-at,plan.end-at)-release*s.bpm/240;
    const length=Math.min(.15*plan.stretch,space-.015);
    if(length<=.025)return;
    const edge=i===0||i===contour.length-1?.82:1;
    result.push({at,length,voice:'arp',layer:'arpeggio',notes:[note],
      gain:(occupied?.012:.019)*edge*(.8+s.energy/500),pan:(plan.episode%2?1:-1)*.22,
      cutoff:1500+(100-s.warmth)*15,release,instrument,role:'arpeggio'});
  });
  return result;
}
