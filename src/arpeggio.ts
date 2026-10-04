// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, hash, type Settings, type MusicEvent } from './music';
import { nextHarmonyBoundary } from './harmony-v5';
import { defaultArpeggioInstrument } from './instruments';
import { ARP_PATTERNS, arpeggioPlan as legacyPlan, arpeggioEvents as legacyArpeggioEvents } from './arpeggio-v9';
export { ARP_PATTERNS } from './arpeggio-v9';

// Eight-bar phrases: opening half, answering half, or a late entrance carried to the end.
const WINDOWS={early:[0,4],late:[4,8],build:[2,8],rest:[0,0]} as const;
// Seven entries per chapter, with room to return to the opening half after a late ending.
// Every transition leaves at least two bars clear, including the chapter boundary.
const CHAPTERS=[
  ['build','late','rest','early','early','build','late','build'],
  ['build','rest','early','early','late','build','late','build'],
  ['build','late','build','rest','early','early','build','late'],
] as const;

export function arpeggioPlan(s:Settings,bar:number){
  if(s.generatorVersion<11)return legacyPlan(s,bar);
  const stretch=s.profile==='ambient'||s.groove==='dnb'?2:1;
  if(s.generatorVersion>=12){
    const chapter=Math.floor(bar/64),slot=Math.floor(bar/8)%8;
    const layout=CHAPTERS[hash(`${s.seed}:arp-layout:${chapter}`)%CHAPTERS.length];
    const episode=chapter*7+layout.slice(0,slot).filter(w=>w!=='rest').length;
    const [from,to]=WINDOWS[layout[slot]],base=chapter*64+slot*8;
    return {...legacyPlan(s,episode*16*stretch),start:base+from,end:base+to};
  }
  const episode=Math.floor(bar/(8*stretch));
  const plan=legacyPlan(s,episode*16*stretch);
  const start=episode*8*stretch+2;
  return {...plan,start,end:start+4*stretch};
}

export function arpeggioEvents(s:Settings,bar:number,backing:MusicEvent[]):MusicEvent[]{
  if(s.generatorVersion<10)return legacyArpeggioEvents(s,bar,backing);
  if(s.arpeggio===false)return [];
  const plan=arpeggioPlan(s,bar);
  if(bar<plan.start||bar>=plan.end)return [];
  const contour=ARP_PATTERNS[plan.pattern];
  // One uninterrupted sequencer clock per episode: eighth notes, or half-time in D&B.
  // Melody collisions affect level only; they never shift or omit a step.
  const step=s.groove==='dnb'?.25:.125,stepsPerBar=1/step;
  const instrument=s.instruments.arpeggio??defaultArpeggioInstrument(s.profile),nylon=instrument==='m-nylon';
  const chord=chordAt(s,bar),register=(nylon?48:60)+(hash(`${s.seed}:arp-register:${plan.episode}`)%2)*3;
  const pitches=Array.from({length:24},(_,i)=>register+i).filter(n=>chord.notes.some(c=>c%12===n%12)).slice(0,4);
  const melody=backing.filter(e=>e.layer==='motif');
  return Array.from({length:stepsPerBar},(_,i)=>{
    const index=(bar-plan.start)*stepsPerBar+i,degree=contour[index%contour.length];
    const at=bar+i*step,release=nylon?.085:.04;
    const occupied=melody.some(e=>e.at<at+step&&e.at+e.length>at);
    const accent=index%contour.length===0?1.08:.96;
    const boundary=nylon?Math.min(nextHarmonyBoundary(s,at),plan.end):nextHarmonyBoundary(s,at);
    return {at,length:Math.min(step*(nylon?2.2:.56),boundary-at-release*s.bpm/240-.01),
      voice:'arp' as const,layer:'arpeggio' as const,notes:[pitches[degree]],
      gain:(s.groove==='dnb'||s.profile==='ambient'?.013:.0175)*accent*(occupied?.9:1)*(.8+s.energy/500),pan:(plan.episode%2?1:-1)*.22,
      cutoff:1500+(100-s.warmth)*15,release,instrument,role:'arpeggio' as const,
      ...(nylon?{velocity:.52+(hash(`${s.seed}:nylon-touch:${bar}:${i}`)%1000)/10000,variation:hash(`${s.seed}:nylon-hand:${bar}:${i}`)%2}:{})};
  });
}
