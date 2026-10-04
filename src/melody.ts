// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { melodySentence as legacyMelodySentence } from './melody-v7';
import { chordAt, repetitionLevel, type Settings, type MusicEvent } from './music';
import { arrangementAt } from './arrangement';
import { pitchesOf, diatonicPitches } from './harmony';
import { nextHarmonyBoundary } from './harmony-v5';
import { gridTime } from './timing';
import { hash, random } from './seed';

// Two-bar rhythmic identities. Gaps are part of the motif, not missing notes.
const RHYTHMS = [[0,3,6,12,20,24], [2,6,10,16,19,26], [0,4,7,14,22],
  [0,2,8,18,22,26], [3,6,12,16,24], [0,6,8,14,20,27],
  [2,4,10,18,24,26], [0,3,9,16,22], [4,7,12,18,26]];
interface Gesture { slot: number; step: number; degree: number; gate: number; accent: number }
const clamp = (n:number,lo:number,hi:number) => Math.max(lo,Math.min(hi,n));
// A fixed clock prevents the Variation slider from jumping into another thematic chapter.
export const chapterBars = (s:Settings) => {
  const base=s.profile==='ambient'?128:64,level=repetitionLevel(s);
  return level===0?8:level===1?base/4:level===3?base*2:base;
};

function familyAt(s:Settings,chapter:number){
  const block=Math.floor(chapter/RHYTHMS.length);
  const order=(b:number)=>RHYTHMS.map((_,i)=>i).sort((a,b2)=>hash(`${s.seed}:families:${b}:${a}`)-hash(`${s.seed}:families:${b}:${b2}`));
  const family=order(block);
  // The last item is unaffected by this swap, so checking the previous block is bounded.
  if(block>0&&family[0]===order(block-1).at(-1))[family[0],family[1]]=[family[1],family[0]];
  return family[chapter%RHYTHMS.length];
}

function motif(s:Settings,chapter:number): Gesture[] {
  // Fresh seeded permutations avoid a fixed nine-chapter rhythmic carousel.
  const family=familyAt(s,chapter);
  let degree=0,previousMove=0;
  return RHYTHMS[family].map((step,i)=>{
    const r=random(s.seed,`theme:${chapter}:${i}`);
    let move=i===0?0:r<.36?0:r<.62?1:r<.86?-1:r<.93?2:-2;
    if(Math.abs(previousMove)>1)move=-Math.sign(previousMove);
    degree=clamp(degree+move,-3,3);previousMove=move;
    return {slot:i,step,degree,gate:[.36,.58,.88][hash(`${s.seed}:gate:${chapter}:${i}`)%3],accent:i===0?1.08:i%3===1?.83:.96};
  });
}

/** Absolute-time composition: seek, cache eviction and mute never change the melody. */
export function melodySentence(s:Settings,start:number,backing:MusicEvent[]): MusicEvent[] {
  if(s.generatorVersion<10)return legacyMelodySentence(s,start,backing);
  if(s.energy<8)return [];
  const ambient=s.profile==='ambient',dnb=s.profile==='dub'&&s.groove==='dnb';
  const repetition=repetitionLevel(s);
  const chapter=Math.floor(start/chapterBars(s)),sentence=Math.floor((start%chapterBars(s))/8);
  const current=motif(s,chapter),old=motif(s,Math.max(0,chapter-1));
  const scale=diatonicPitches(s,60,84),center=68+hash(`${s.seed}:melody-register`)%4;
  const home=scale.reduce((best,n,i)=>Math.abs(n-center)<Math.abs(scale[best]-center)?i:best,0);
  const notes:MusicEvent[]=[];
  let previous=scale[home];
  for(let stage=0;stage<4;stage++){
    // The first statement at a chapter boundary quotes the old motif; its answer introduces the new one.
    const quoting=repetition!==0&&chapter>0&&sentence===0&&stage===0;
    const fresh=()=>motif(s,Math.floor(start/2)+stage+100000);
    // Off writes independent two-bar gestures. Low retains only the opening hook.
    const freshGestures=repetition<=1?fresh():current;
    const source=repetition===0?freshGestures:repetition===1&&!quoting
      ?current.map((g,i)=>i<2?g:{...g,degree:freshGestures[i%freshGestures.length].degree,gate:freshGestures[i%freshGestures.length].gate})
      :quoting?old:current;
    const sourceChapter=repetition===0?Math.floor(start/2)+stage+100000:quoting?chapter-1:chapter;
    const turn=sentence===0||repetition===3?0:(hash(`${s.seed}:sentence:${chapter}:${sentence}`)%3)-1;
    let gestures=source.map(g=>({...g}));
    if(stage===1){gestures[gestures.length-1].degree-=1;gestures[gestures.length-1].gate=.9;}
    if(stage===2&&repetition!==3)gestures=gestures.map((g,i)=>({...g,degree:g.degree+(i<3?1:2),step:clamp(g.step+(turn&&g.step<26?turn:0),0,31)}));
    if(stage===3)gestures=gestures.map((g,i)=>({...g,degree:Math.round(g.degree*.5),
      step:i===gestures.length-1?Math.max(24,g.step):g.step,gate:i===gestures.length-1?.92:i===0?.5:.85}));
    // A small, phrase-local edit grows the theme without replacing its rhythmic signature.
    if(sentence>0&&stage===1&&random(s.seed,`edit:${chapter}:${sentence}`)<(.3+s.evolution*.004)*(repetition===3?.2:1))
      gestures=gestures.filter(g=>g.slot!==1);
    if(ambient||dnb||s.energy<30){
      const end=gestures.at(-1)!;
      gestures=gestures.filter(g=>g.slot===0||g.slot===2||stage===3&&g===end);
    }
    for(let i=0;i<gestures.length;i++){
      const g=gestures[i],bar=start+stage*2+Math.floor(g.step/16),step=g.step%16;
      const form=arrangementAt(s,bar),chord=chordAt(s,bar),at=gridTime(s,bar,step);
      if(form.section==='intro'&&i===gestures.length-1&&stage===1)continue;
      const last=i===gestures.length-1,cadence=stage===3&&last;
      const arp=form.arpeggio&&(!dnb||form.section==='open');
      const target=scale[clamp(home+g.degree+(stage===2&&s.evolution>=50?Math.max(0,turn):0),0,scale.length-1)];
      const next=gestures[i+1];
      const nextAt=next?gridTime(s,start+stage*2+Math.floor(next.step/16),next.step%16):start+stage*2+2;
      const available=nextAt-at;
      // Reserve the instrument release before harmonic changes (140 ms in the previous engine).
      const length=Math.min(cadence?available:ambient?.8:dnb?.68:.48,available*g.gate,available-.025*s.bpm/240,nextHarmonyBoundary(s,at)-at-.14*s.bpm/240);
      if(length<.035)continue;
      const bass=backing.filter(e=>e.layer==='bass'&&e.at<at+length&&e.at+e.length>at);
      const candidates=pitchesOf(chord,62,81).filter(n=>Math.abs(n-scale[home])<=4&&Math.abs(n-previous)<=7
        && (!(stage===3||stage===0&&i===0)||Math.abs(n-scale[home])<=3));
      const stable=chord.notes.filter(n=>[0,3,4].includes((n-chord.root+120)%12)).map(n=>n%12);
      const score=(n:number)=>Math.abs(n-target)*.9+Math.abs(n-previous)*.24
        + (cadence&&!stable.includes(n%12)?2.8:0)
        + bass.reduce((cost,b)=>cost+([1,6,11].includes((n-b.notes[0]+120)%12)?5:0),0);
      const ranked=candidates.map(n=>({n,cost:score(n)})).sort((a,b)=>a.cost-b.cost);
      // Bounded weighted choice among musically close options, rather than a unique shortest path.
      const good=ranked.filter(c=>c.cost<=ranked[0].cost+1.5).slice(0,3);
      const weights=good.map(c=>Math.exp(-(c.cost-ranked[0].cost)/.7));
      let pick=random(s.seed,`pitch-v7:${sourceChapter}:${stage<2||repetition===3?0:stage}:${g.slot}`)*weights.reduce((a,b)=>a+b,0);
      const chosen=good.find((_,j)=>(pick-=weights[j])<=0)??good[0];
      const note=chosen.n;previous=note;
      notes.push({at,length,voice:arp?'arp':'pluck',layer:'motif',notes:[note],
        gain:(ambient?.048:dnb?.058:.064)*g.accent*(stage===2?1.06:cadence?.88:1),
        pan:stage%2?.10:-.10,cutoff:3400-s.warmth*20,role:arp?'arpeggio':'anchor',release:Math.max(.025,Math.min(.14,(available-length)*240/s.bpm))});
    }
  }
  // Brief upper/lower neighbours borrow tension from the scale and resolve to a guaranteed anchor.
  // Insert only inside an actual rest; never overwrite a hook, harmony boundary or drum fill.
  const ornaments:MusicEvent[]=[];
  for(let i=1;i<notes.length;i++){
    const target=notes[i],prior=notes[i-1],bar=Math.floor(target.at),stage=Math.floor((target.at-start)/2);
    if(stage!==1&&stage!==2||target.voice==='arp'||prior.at+prior.length+(prior.release??0)*s.bpm/240>target.at-.135)continue;
    if(random(s.seed,`tension:${chapter}:${sentence}:${i}`)>(stage===2?.62:.32))continue;
    const at=target.at-.125;
    if(Math.floor(at)!==bar||Math.round((at-bar)*16)%4===0||backing.some(e=>e.fill!==undefined&&Math.abs(e.at-at)<.12))continue;
    const chord=chordAt(s,bar);
    const neighbors=scale.filter(n=>n>=62&&n<=81&&Math.abs(n-target.notes[0])<=2&&n!==target.notes[0]
      &&Math.abs(n-prior.notes[0])<=4&&!chord.notes.some(c=>c%12===n%12));
    const safe=neighbors.filter(n=>!backing.some(b=>b.layer==='bass'&&b.at<target.at&&b.at+b.length>at&&[1,6,11].includes((n-b.notes[0]+120)%12)));
    if(!safe.length)continue;
    ornaments.push({...target,at,length:.05,release:.035,notes:[safe[hash(`${s.seed}:${chapter}:${sentence}:${i}:neighbor`)%safe.length]],gain:target.gain*.68,role:'neighbor',resolvesTo:target.notes[0]});
  }
  return [...notes,...ornaments].sort((a,b)=>a.at-b.at);
}
