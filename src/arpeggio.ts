// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, hash, type Settings, type MusicEvent } from './music';
import { nextHarmonyBoundary } from './harmony-v5';
import { defaultArpeggioInstrument } from './instruments';
import { ARP_PATTERNS, arpeggioPlan, arpeggioEvents as legacyArpeggioEvents } from './arpeggio-v9';
export { ARP_PATTERNS, arpeggioPlan } from './arpeggio-v9';

export function arpeggioEvents(s:Settings,bar:number,backing:MusicEvent[]):MusicEvent[]{
  if(s.generatorVersion<10)return legacyArpeggioEvents(s,bar,backing);
  if(s.arpeggio===false)return [];
  const plan=arpeggioPlan(s,bar);
  if(bar<plan.start||bar>=plan.end)return [];
  const contour=ARP_PATTERNS[plan.pattern];
  // One uninterrupted sequencer clock per episode: eighth notes, or half-time in D&B.
  // Melody collisions affect level only; they never shift or omit a step.
  const step=s.groove==='dnb'?.25:.125,stepsPerBar=1/step;
  const chord=chordAt(s,bar),register=60+(hash(`${s.seed}:arp-register:${plan.episode}`)%2)*3;
  const pitches=Array.from({length:24},(_,i)=>register+i).filter(n=>chord.notes.some(c=>c%12===n%12)).slice(0,4);
  const melody=backing.filter(e=>e.layer==='motif');
  const instrument=s.instruments.arpeggio??defaultArpeggioInstrument(s.profile);
  return Array.from({length:stepsPerBar},(_,i)=>{
    const index=(bar-plan.start)*stepsPerBar+i,degree=contour[index%contour.length];
    const at=bar+i*step,release=.04;
    const occupied=melody.some(e=>e.at<at+step&&e.at+e.length>at);
    const accent=index%contour.length===0?1.08:.96;
    return {at,length:Math.min(step*.56,nextHarmonyBoundary(s,at)-at-release*s.bpm/240-.01),
      voice:'arp' as const,layer:'arpeggio' as const,notes:[pitches[degree]],
      gain:(s.groove==='dnb'||s.profile==='ambient'?.013:.0175)*accent*(occupied?.9:1)*(.8+s.energy/500),pan:(plan.episode%2?1:-1)*.22,
      cutoff:1500+(100-s.warmth)*15,release,instrument,role:'arpeggio' as const};
  });
}
