// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {chordAt,type Settings,type MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {nextHarmonyBoundary} from './harmony-v5';
import {gridTime} from './timing';
import {hash,random} from './seed';

// Generator v18 comping. Two-bar rhythm cells per mood with written dynamics:
// l = long, m = medium, s = short stab, g = ghost chord, p = push (an eighth early into a new chord).
// It is written after the melody and bass, so a push never lands against a clashing lead note.
type Kind='l'|'m'|'s'|'g'|'p';
type Hit=readonly [number,Kind,number]; // step within two bars (0–31), kind, velocity
const LOFI:readonly (readonly Hit[])[]=[
  [[0,'l',.88],[10,'s',.5],[16,'m',.78],[22,'s',.55],[30,'p',.7]],
  [[2,'m',.8],[8,'g',.42],[14,'p',.7],[18,'m',.72],[26,'s',.5]],
  [[0,'l',.85],[7,'s',.55],[16,'l',.8],[23,'g',.42],[30,'p',.66]],
  [[0,'m',.86],[6,'s',.6],[12,'g',.4],[18,'m',.76],[24,'s',.55],[30,'p',.62]],
  [[0,'l',.84],[16,'l',.74],[28,'s',.5]],
  [[3,'m',.78],[10,'s',.55],[19,'m',.74],[26,'g',.45],[30,'p',.6]],
];
const HOUSE:readonly (readonly Hit[])[]=[
  [[2,'s',.82],[10,'s',.72],[18,'s',.8],[26,'s',.68]],
  [[2,'s',.8],[6,'g',.5],[10,'s',.74],[14,'g',.5],[18,'s',.8],[26,'s',.7],[30,'g',.48]],
  [[0,'m',.76],[6,'s',.7],[14,'p',.6],[22,'s',.72],[28,'s',.58]],
  [[3,'s',.8],[19,'s',.76]], // dub-techno chord: the delay answers it
  [[2,'s',.8],[7,'s',.6],[12,'s',.66],[18,'s',.8],[23,'s',.6],[28,'s',.62]],
];
const pc=(n:number)=>((n%12)+12)%12;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));

/** Filter colour for the breakdown: dark while the beat is out, opening through the build-up. */
export function compingFilterV18(s:Settings,bar:number){
  const a=arrangementAt(s,bar),local=a.localBar%8;
  const section=a.section!=='open'||s.profile==='ambient'?1:a.beatless?.5:.55+(local-3)*.1;
  // Deep house breathes with a slow 32-bar filter swell (±10%).
  const swell=s.profile==='dub'&&s.groove!=='dnb'?.9+.1*Math.cos(2*Math.PI*a.localBar/32):1;
  return section*swell;
}

export function compingV18(s:Settings,start:number,melody:MusicEvent[]):MusicEvent[]{
  if(s.profile==='ambient')return [];
  const dnb=s.groove==='dnb',lofi=s.profile==='lofi',seconds=240/s.bpm,out:MusicEvent[]=[];
  const release=.6/seconds,lag=lofi?.006/seconds:0,base=3200-s.warmth*23;
  const clash=(notes:number[],at:number,end:number)=>melody.some(m=>m.at<end&&m.at+m.length+(m.release??.1)/seconds>at
    &&notes.some(n=>[1,11].includes(pc(m.notes[0]-n))));
  const add=(at:number,length:number,notes:number[],velocity:number,kind:Kind,bar:number,push=false)=>{
    const cutoff=Math.round(base*compingFilterV18(s,bar)),gain=(dnb?.12:.105)*velocity/.82;
    const event:MusicEvent={at,length:+length.toFixed(8),voice:dnb?'pad':'keys',layer:'harmony',notes,gain,pan:0,cutoff,velocity:+velocity.toFixed(3),...(push?{role:'anticipation' as const}:{})};
    // Lo-fi rolls longer chords from the bottom up (12 ms), like a relaxed keyboard hand.
    if(lofi&&(kind==='l'||kind==='m')&&random(s.seed,`comp18:roll:${bar}:${at}`)<.55){
      const split=Math.ceil(notes.length/2),late=.012/seconds;
      out.push({...event,notes:notes.slice(0,split),gain:gain*split/notes.length});
      if(length>late+.03)out.push({...event,at:at+late,length:+(length-late).toFixed(8),notes:notes.slice(split),gain:gain*(notes.length-split)/notes.length});
      return;
    }
    out.push(event);
  };
  for(let bar=start;bar<start+8;bar++){
    const a=arrangementAt(s,bar),chord=chordAt(s,bar);
    if(dnb){
      // Liquid pads: struck on every chord change and every second bar, sustained until the next strike.
      const changed=bar===0||chord.label!==chordAt(s,bar-1).label;
      if(!changed&&bar%2)continue;
      let next=bar+1;while(next<bar+2&&chordAt(s,next).label===chord.label&&next%2)next++;
      const length=Math.min(next-bar-.03,nextHarmonyBoundary(s,bar)-bar-release);
      if(length>=.1)add(bar,length,chord.notes,(changed?.78:.64)+(random(s.seed,`comp18:pad:${a.localBar}:${a.variant}`)-.5)*.06,'l',bar);
      continue;
    }
    if(a.beatless){
      // Breakdown without drums: one soft held chord per bar.
      const length=Math.min(.9,nextHarmonyBoundary(s,bar)-bar-lag-release);
      if(length>=.1)add(bar+lag,length,chord.notes,.6,'l',bar);
      continue;
    }
    const cells=lofi?LOFI:HOUSE,part=(bar-start)%2;
    const cell=cells[(hash(`${s.seed}:comp18:${s.profile}`)+Math.floor(a.localBar/8)+a.variant)%cells.length];
    let hits=cell.filter(([step])=>step>=part*16&&step<part*16+16);
    if(a.section==='intro')hits=hits.filter(([,kind],i)=>!i||kind==='l'||kind==='m').slice(0,2);
    if(s.energy<30)hits=hits.filter(([,kind],i)=>!i||kind==='l'||kind==='m'||kind==='p');
    else if(s.energy<45)hits=hits.filter(([,kind])=>kind!=='g');
    // Dynamics follow the form: a softer intro and a crescendo through the build-up.
    const ramp=a.section==='intro'?.85:a.section==='open'?.7+(a.localBar%8-4)*.08:1;
    hits.forEach(([cellStep,kind,velocity],i)=>{
      const step=cellStep%16,at=gridTime(s,bar,step)+lag;
      let notes=chord.notes,boundary=nextHarmonyBoundary(s,at),push=false;
      if(kind==='p'){
        const next=chordAt(s,bar+1);
        if(next.label!==chord.label){
          if(clash(next.notes,at,bar+1+.06))return;
          notes=next.notes;boundary=nextHarmonyBoundary(s,bar+1);push=true;
        }
      }
      const following=hits[i+1]?gridTime(s,bar,hits[i+1][0]%16)+lag:bar+1;
      const wanted=kind==='l'?Math.min(.45,following-at):kind==='m'?.25:kind==='g'?.06:lofi?.12:.1;
      const length=Math.min(wanted,boundary-at-release);
      if(length<.025)return;
      const v=clamp(velocity*ramp+(random(s.seed,`comp18:v:${a.localBar}:${step}:${a.variant}`)-.5)*.06,.2,1);
      add(at,length,notes,v,kind,bar,push);
    });
  }
  return out;
}
