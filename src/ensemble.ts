// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import { chordAt, type Settings, type MusicEvent, type Chord } from './music';
import { arrangementAt } from './arrangement';
import { diatonicPitches, pitchesOf } from './harmony';
import { hash, random } from './seed';
import { gridTime } from './timing';
import { kickSteps } from './groove';
import { bassPhrase } from './bass';
import { hasEnding, nextHarmonyBoundary } from './harmony-v5';
import { addFill } from './fills';
export { gridTime } from './timing';

// A maximally even binary pulse distribution (rotation-equivalent Euclidean rhythm).
export function evenPulses(hits: number, steps = 16, rotation = 0): number[] {
  const count = Math.max(0, Math.min(steps, Math.round(hits)));
  if (!count) return [];
  const pulses = Array.from({length:steps},(_,i)=>i).filter(i=>Math.floor((i+1)*count/steps)>Math.floor(i*count/steps));
  const first = pulses[0];
  return pulses.map(i=>(i-first+rotation+steps*2)%steps).sort((a,b)=>a-b);
}
const nearest = (notes: number[], target: number) => [...notes].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
const meter = (step: number) => step%8===0 ? 1 : step%4===0 ? .7 : step%2===0 ? .35 : .1;
const cache = new Map<string, MusicEvent[]>();
const CONTOURS = [[0,2,1,4,2,0], [0,-1,2,1,-2,0], [0,3,2,1,0,-1], [0,1,3,4,2,0], [0,-2,-1,1,2,0], [0,2,4,3,1,0]];
interface MelodySlot { at: number; bar: number; step: number; chord: Chord; target: number; arp: boolean }

function chooseSteps(candidates: number[], count: number, score: (step:number)=>number, anchors: number[] = []): number[] {
  const selected = [...anchors];
  for (const step of [...candidates].sort((a,b)=>score(b)-score(a))) {
    if (selected.length>=count) break;
    if (selected.every(other=>Math.abs(step-other)>=2)) selected.push(step);
  }
  return selected.sort((a,b)=>a-b);
}

function compilePhrase(settings: Settings, start: number): MusicEvent[] {
  const events: MusicEvent[] = bassPhrase(settings,start), slots: MelodySlot[] = [];
  const energy=settings.energy/100, ambient=settings.profile==='ambient', dub=settings.profile==='dub';
  const dnb=dub&&settings.groove==='dnb';
  const form = arrangementAt(settings,start), phrase = Math.floor(form.localBar/4);
  const signature = dnb ? `dnb:${form.variant}` : `${phrase}:${form.variant}`;
  const r = (label:string)=>random(settings.seed,`ensemble:${signature}:${label}`);
  const center = 68+hash(`${settings.seed}:register`)%5;
  const contour = CONTOURS[(hash(`${settings.seed}:contour`)+form.variant)%CONTOURS.length];
  const pulseCount = 3+hash(`${settings.seed}:pulse`)%3;
  const rotation = (hash(`${settings.seed}:phase`)+form.variant*2)%8;
  const pulse = evenPulses(pulseCount,16,rotation);
  const cutoff=3200-settings.warmth*23;
  const add = (voice: MusicEvent['voice'], layer: MusicEvent['layer'], bar:number, step:number, length:number, notes:number[], gain:number, extra:Partial<MusicEvent>={}) => {
    events.push({voice,layer,at:gridTime(settings,bar,step),length,notes,gain:gain*(.94+r(`${bar%(dnb?2:4)}:${voice}:${step}`)*.10),pan:0,cutoff,...extra});
  };
  for(let part=0;part<4;part++){
    const bar=start+part, a=arrangementAt(settings,bar), chord=chordAt(settings,bar);
    const thin=a.section==='intro', open=a.section==='open';
    // One shared drum/metrical plan feeds both the bass and melody placement costs.
    const kicks = kickSteps(settings,bar);
    const snares=a.beatless||open||energy<.12?[]:[4,12];
    kicks.forEach((step,i)=>add('kick','rhythm',bar,step,.085,[],dub?.27:.235,{duck:dub?(thin?.25:.48):!thin&&part%2===0&&i===0?.15:0}));
    snares.forEach(step=>add('snare','rhythm',bar,step,.035,[],.05));

    let hats=a.beatless?[]:evenPulses((thin||open?2:3)+Math.floor(energy*(open?1:4)),16,(rotation+part%2*2)%4);
    if(dnb&&!a.beatless&&!open) hats=evenPulses(thin?4:8,16,0);
    if(ambient && energy>.55 && a.section==='return' && part===3) hats=[8];
    hats.forEach((step,i)=>add('hat','rhythm',bar,step,.018,[],i%2?.018:.025,{pan:i%2?.16:-.16}));

    addFill(settings,bar,events);

    // Offbeat chord punctuation leaves space for a shared kick/bass/melody downbeat.
    const chordSteps=hasEnding(settings,bar)?[0]:dnb?(part%2===0?[0]:[]):ambient?part%2===0?[0]:[]:a.beatless?[0]:dub?thin?[6]:[2,10]:part%2?[2,10]:[2];
    chordSteps.forEach((step,i)=>{
      const at=gridTime(settings,bar,step),normal=dnb?1.65:ambient?1.72:a.beatless?.78:dub?.13:i?.20:.32;
      // Leave room for the instrument's release before an actual harmonic change.
      const release=.60;
      const budget=nextHarmonyBoundary(settings,at)-at-release*settings.bpm/240;
      if(budget<.025)return; // A late stab must not ring across the new chord at fast tempos.
      const length=Math.round(Math.min(normal,budget)*1e8)/1e8;
      add(ambient||a.beatless||dnb?'pad':'keys','harmony',bar,step,length,chord.notes,i?.075:ambient?.105:.12);
    });

    if(energy<.08) continue;
    // A, A′, development, cadence share the same pulse signature and contour.
    let count=ambient?[2,0,1+(energy>.55?1:0),0][part]
      :Math.max(1,Math.min(5,[3,2,4,2][part]+Math.floor(energy*2)-1+(hash(`${settings.seed}:density`)%2)));
    if(thin&&part===1) count=Math.max(0,count-1);
    if(a.arpeggio) count=ambient?2+Math.floor(energy*2):3+Math.floor(energy*3);
    let steps:number[];
    if(dnb){
      const calls=[[[0,8],[],[2,10],[8]],[[2,10],[8],[2,10],[]],[[0],[6,12],[0],[8]]];
      steps=[...calls[hash(`${settings.seed}:dnb-call`)%calls.length][part]];
      if(a.arpeggio&&open)steps=part%2===0?[0,4,8,12]:[];
      if(thin||energy<.3)steps=steps.slice(0,1);
    }else if(a.arpeggio){
      steps=evenPulses(count,16,(rotation+part%2*2)%4).filter(step=>step<=14);
    }else{
      const candidate=Array.from({length:15},(_,i)=>i).filter(step=>part!==3||step<=10);
      const active=events.filter(e=>Math.floor(e.at)===bar);
      steps=chooseSteps(candidate,count,step=>{
        const collisions=active.filter(e=>Math.abs(e.at-gridTime(settings,bar,step))<.015);
        return (pulse.includes((step+(part%2?2:0))%16)?2.6:0)+meter(step)*.8
          -collisions.reduce((sum,e)=>sum+(e.voice==='snare'?2.2:e.layer==='bass'?.9:e.layer==='harmony'?1.2:0),0)
          +r(`melody:${part%2}:${step}`)*1.3;
      },part===0&&count>0?[0]:[]);
    }
    steps.forEach((step,i)=>{
      const shape=contour[(i+part%2)%contour.length]*(part===3?-.5:1);
      const arp=a.arpeggio&&(!dnb||open);
      const arpNotes=pitchesOf(chord,center-5,center+7).slice(0,4);
      const order=part%2?[3,2,1,0,1,2]:[0,1,2,3,2,1];
      slots.push({at:gridTime(settings,bar,step),bar,step,chord,arp,target:arp?arpNotes[order[i]%arpNotes.length]:center+shape});
    });
  }

  // A shortest path through chord-tone candidates balances contour, register,
  // voice movement, repeated pitches and dissonance against the sounding bass.
  const candidates=slots.map((slot,i)=>pitchesOf(slot.chord,62,81).filter(n=>Math.abs(n-center)<=((i===0||i===slots.length-1)?3:7)));
  const localCost=(slot:MelodySlot,note:number,i:number)=>{
    const available=Math.min(slots[i+1]?.at??slot.bar+1,slot.bar+1)-slot.at;
    const end=slot.at+Math.min(dnb?.6:.3,available*.68);
    const overlap=events.filter(e=>e.layer==='bass'&&e.at<end&&e.at+e.length>slot.at);
    const clash=overlap.reduce((cost,bass)=>{
      const interval=(note-bass.notes[0]+24)%12;
      const weight=[1,6,11].includes(interval)?(dnb?16:3):[2,10].includes(interval)?.5:0;
      return cost+weight*Math.min(1,(Math.min(end,bass.at+bass.length)-Math.max(slot.at,bass.at))/.15);
    },0);
    return Math.abs(note-slot.target)*(dnb?1:.6)+Math.abs(note-center)*.10+clash+random(settings.seed,`pitch:${signature}:${i}:${note}`)*.5;
  };
  let states=candidates[0]?.map(note=>({cost:localCost(slots[0],note,0),path:[note]}))??[];
  for(let i=1;i<slots.length;i++) {
    // Last two notes form the state, so the triple-repeat penalty remains Markovian.
    const best = new Map<string, typeof states[number]>();
    for(const note of candidates[i]) for(const state of states) {
      const before=state.path.at(-1)!, leap=Math.abs(note-before);
      if(leap>7) continue;
      const thirdRepeat=state.path.length>1&&state.path.at(-2)===note&&before===note;
      const cost=state.cost+localCost(slots[i],note,i)+leap*.24+(leap>4?(leap-4)*.8:0)+(before===note?(dnb?.25:.9):0)+(thirdRepeat?(dnb?1:3):0);
      const key=`${before}:${note}`;
      if(!best.has(key)||cost<best.get(key)!.cost) best.set(key,{cost,path:[...state.path,note]});
    }
    states=[...best.values()];
  }
  const path=states.sort((a,b)=>a.cost-b.cost)[0]?.path??[];
  const scale=diatonicPitches(settings,62,81);
  for(let i=0;i<slots.length;i++){
    const slot=slots[i];let note=path[i];
    if(note===undefined) throw new Error('No valid melodic voice-leading path');
    let role:MusicEvent['role']=slot.arp?'arpeggio':'anchor', resolvesTo:number|undefined;
    const next=slots[i+1], prev=slots[i-1];
    // A weak passing tone must resolve at the next onset, before the next strong half-bar.
    if(!slot.arp&&i%2===1&&prev&&next&&next.bar===slot.bar&&slot.step%4!==0&&next.at<=Math.ceil((slot.at+.001)*2)/2+.02){
      const passing=scale.filter(n=>Math.abs(n-path[i-1])<=2&&Math.abs(n-path[i+1])<=2&&n>Math.min(path[i-1],path[i+1])&&n<Math.max(path[i-1],path[i+1]));
      if(passing.length){note=nearest(passing,note);role='passing';resolvesTo=path[i+1];}
    }
    const available=Math.min(next?.at??slot.bar+1,slot.bar+1)-slot.at;
    const length=Math.round(Math.max(.025,Math.min(slot.arp?.18:ambient?.5:dnb?.6:.3,available*(slot.arp?.5:.68),available-.14*settings.bpm/240))*1e8)/1e8;
    events.push({voice:slot.arp?'arp':'pluck',layer:'motif',at:slot.at,length,notes:[note],
      gain:(ambient?.050:slot.arp?.050:dnb?.062:.070)*(role==='passing'?.76:1),pan:i%2?.15:-.15,
      cutoff:3400-settings.warmth*20,role,resolvesTo});
  }
  // Shared density budget: remove an optional hat when two salient layers already attack.
  const result=events.filter(e=>dnb||e.voice!=='hat'||e.fill!==undefined||events.filter(other=>other!==e&&other.voice!=='hat'&&Math.abs(other.at-e.at)<.025).length<2);
  return result.sort((a,b)=>a.at-b.at);
}

export function ensembleEvents(settings: Settings, bar: number): MusicEvent[] {
  const start=bar-bar%4;
  // Excluding layers, volume and instrument IDs preserves every other part when they change.
  const key=[settings.generatorVersion,settings.harmonyEngine??'',settings.seed,settings.profile,settings.groove,settings.bpm,settings.energy,settings.warmth,settings.evolution,start].join(':');
  let phrase=cache.get(key);
  if(!phrase){
    phrase=compilePhrase(settings,start);
    if(cache.size>=96) cache.delete(cache.keys().next().value!);
    cache.set(key,phrase);
  }
  return phrase.filter(e=>Math.floor(e.at)===bar);
}
