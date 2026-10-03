// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, type Settings, type MusicEvent } from './music';
import { arrangementAt } from './arrangement';
import { pitchesOf } from './harmony';
import { hash } from './seed';
import { gridTime } from './timing';
import { kickSteps } from './groove';
import { nextHarmonyBoundary } from './harmony-v5';

// Each family is a four-bar A/B/A/B′ riff, not independently ranked random hits.
const RIFFS = [
  [[0,6,10],[0,10],[0,6,10],[0,8,14]],
  [[0],[6,12],[0],[8,14]],
  [[2,8,14],[4,10],[2,8,14],[6,12]],
  [[0,4,10],[0,6,12],[0,4,10],[0,10]],
  [[0,10],[6],[0,10],[2,8]],
  [[2,6,12],[2,10],[2,6,12],[2,8,14]],
  [[0,8],[2,12],[0,8],[6]],
  [[4,10,14],[0,8],[4,10,14],[0,12]],
];
const AMBIENT = [
  [[0],[],[4],[]], [[2],[],[],[0]], [[0],[],[0],[8]], [[],[0],[],[4]],
  [[0],[10],[],[4]], [[4],[],[8],[]], [[0],[],[12],[]], [[8],[12],[0],[10]],
];
const INTERVALS = [[0,0,7,0],[0,7,12,7],[7,0,3,0],[0,12,0,7],[0,-5,0,3],[0,3,7,0],[0,7,3,7],[0,12,7,3]];
const GATES = [.88,1.35,.50,.66,1.12,.43,.95,.58];
export function bassPhrase(settings: Settings, start: number): MusicEvent[] {
  const ambient=settings.profile==='ambient', electronic=settings.profile==='dub', dnb=electronic&&settings.groove==='dnb';
  const a=arrangementAt(settings,start);
  const family=(hash(`${settings.seed}:${settings.profile}:bass-riff`)+a.variant)%RIFFS.length;
  const shape=INTERVALS[family], result:MusicEvent[]=[];
  let previous=40;
  for(let part=0;part<4;part++) {
    const bar=start+part, section=arrangementAt(settings,bar), chord=chordAt(settings,bar);
    const root=36+chord.root%12, tones=pitchesOf(chord,34,52);
    let targets=[...(ambient?AMBIENT:RIFFS)[family][part]];
    if(ambient) {
      if(section.section==='open'&&part%2)targets=[];
      if(section.section==='return'&&part===3&&!targets.length)targets=[8];
    } else {
      if(section.section==='intro'||settings.energy<30)targets=targets.slice(0,part%2?1:2);
      if(section.section==='open')targets=part%2 ? [] : targets.slice(0,1);
      if(section.section==='return'&&part===3&&settings.energy>65&&targets.length<3)targets.push(14);
    }
    const kicks=kickSteps(settings,bar);
    const candidates=Array.from({length:16},(_,i)=>i).filter(step=>1-step/16>=.10*settings.bpm/240).filter(step=>!electronic||kicks.every(k=>Math.abs(gridTime(settings,bar,step)-gridTime(settings,bar,k))*240/settings.bpm>=.085));
    const steps:number[]=[];
    for(const target of targets) {
      const valid=candidates.filter(step=>steps.every(other=>Math.abs(other-step)>=2));
      const ranked=valid.sort((x,y)=> {
        const cost=(step:number)=>Math.abs(step-target)+(electronic&&(step===4||step===12)?1.25:0);
        return cost(x)-cost(y)||x-y;
      });
      if(ranked.length)steps.push(ranked[0]);
    }
    steps.sort((x,y)=>x-y);
    steps.forEach((step,i)=>{
      const answer=part%2===1;
      // A repeats; B replies with a different chord degree instead of restarting 1–5–3.
      const interval=shape[(i+(answer?2:0))%shape.length];
      const desired=root+(interval===3&&chord.notes.some(n=>(n-chord.root+24)%12===4)?4:interval);
      let note=[...tones].sort((x,y)=>(Math.abs(x-desired)+.12*Math.abs(x-previous))-(Math.abs(y-desired)+.12*Math.abs(y-previous)))[0];
      if(part===3&&i===steps.length-1&&!ambient) {
        const nextRoot=36+chordAt(settings,bar+1).root%12;
        // A chord-tone turnaround leads toward the next root; it does not add a chromatic clash.
        note=[...tones].sort((x,y)=>(Math.abs(x-nextRoot)+.25*Math.abs(x-note))-(Math.abs(y-nextRoot)+.25*Math.abs(y-note)))[0];
      }
      previous=note;
      const beats=ambient ? [6.8,4.4,3.2,5.6][(family+part)%4]*(section.section==='return'?.82:1) : (section.section==='open'?2.6:GATES[family]*(i%2?.68:1)*(dnb?1.5:1));
      result.push({voice:'bass',layer:'bass',at:gridTime(settings,bar,step),length:beats/4,notes:[note],
        gain:ambient?.12:i===0?.18:.145,pan:0,cutoff:3200-settings.warmth*23,role:'anchor'});
    });
  }
  // Monophonic gates stop before the next onset AND the next harmonic boundary.
  for(let i=0;i<result.length;i++) {
    const e=result[i], boundary=nextHarmonyBoundary(settings,e.at);
    const available=Math.min(result[i+1]?.at??start+4,boundary,start+4)-e.at;
    e.length=Math.round(Math.max(.02,Math.min(e.length,available-.08*settings.bpm/240))*1e8)/1e8;
  }
  return result;
}
