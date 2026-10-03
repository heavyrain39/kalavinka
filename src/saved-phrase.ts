// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {chordAt,eventsForBar,type Settings,type MusicEvent,type Chord} from './music';
import {INSTRUMENTS} from './instruments';
import {Score} from './score';

export interface SavedPhrase {version:1; sourceBar:number; events:MusicEvent[]; chords:Chord[]}
export interface Playback {settings:Settings; phrase?:SavedPhrase; opening:boolean}
export const relativeEvent=(e:MusicEvent,start:number):MusicEvent=>({...structuredClone(e),at:Math.round((e.at-start)*1e8)/1e8});

export function playbackScore(p:Playback):Score{
  const {settings:s,phrase}=p;
  return new Score(bar=>{
    if(phrase&&p.opening&&bar<8)return phrase.events.filter(e=>Math.floor(e.at)===bar).map(e=>structuredClone(e));
    const origin=phrase?.sourceBar??0;
    return eventsForBar(s,bar+origin).map(e=>relativeEvent(e,origin));
  });
}
export function playbackChord(p:Playback,bar:number):Chord{
  return p.phrase&&p.opening&&bar<8?p.phrase.chords[Math.max(0,Math.floor(bar))]:chordAt(p.settings,bar+(p.phrase?.sourceBar??0));
}
export function capturePhrase(p:Playback,start=0):SavedPhrase{
  return {version:1,sourceBar:(p.phrase?.sourceBar??0)+start,
    events:playbackScore(p).onsets(start,start+8).map(e=>relativeEvent(e,start)).sort((a,b)=>a.at-b.at),
    chords:Array.from({length:8},(_,i)=>structuredClone(playbackChord(p,start+i)))};
}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
  ?Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,canonical(value)])):v;
export const favoriteIdentity=(settings:Settings,phrase:SavedPhrase)=>JSON.stringify(canonical([settings,phrase]));
// Explicit edits can recompose the opening at the next scheduled bar; volume/reverb do not.
export const compositionIdentity=(s:Settings)=>JSON.stringify({...s,volume:0,reverb:0});

/** Bounded, whitelisted local-storage data. Invalid clips retain the legacy settings-only favorite. */
export function normalizePhrase(value:unknown):SavedPhrase|undefined{
  if(!value||typeof value!=='object')return;
  const p=value as SavedPhrase;
  if(p.version!==1||!Number.isSafeInteger(p.sourceBar)||p.sourceBar<0||p.sourceBar>1e8||p.sourceBar%8!==0
    ||!Array.isArray(p.events)||p.events.length>512||!Array.isArray(p.chords)||p.chords.length!==8)return;
  const finite=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  const pitches=(v:unknown):v is number[]=>Array.isArray(v)&&v.length<=8&&v.every(n=>Number.isInteger(n)&&finite(n,0,127));
  const events:MusicEvent[]=[],chords:Chord[]=[];
  const voices={harmony:['keys','pad'],bass:['bass'],rhythm:['kick','snare','hat','rim','tom'],motif:['pluck','arp']};
  for(const e of p.events){
    if(!e||typeof e!=='object'||!Object.hasOwn(voices,e.layer)||!voices[e.layer].includes(e.voice)
      ||!finite(e.at,0,8)||e.at===8||!finite(e.length,.0001,8)||!pitches(e.notes)
      ||e.layer!=='rhythm'&&!e.notes.length||!finite(e.gain,0,1)||!finite(e.pan,-1,1)||!finite(e.cutoff,20,24000))return;
    const event:MusicEvent={at:e.at,length:e.length,voice:e.voice,layer:e.layer,notes:[...e.notes],gain:e.gain,pan:e.pan,cutoff:e.cutoff};
    if(e.instrument!==undefined){if(e.instrument!=='legacy'&&!INSTRUMENTS[e.layer].some(i=>i.id===e.instrument))return;event.instrument=e.instrument;}
    for(const [key,hi] of [['duck',1],['velocity',1],['release',4],['variation',1],['fill',100],['resolvesTo',127]] as const){
      if(e[key]!==undefined){if(!finite(e[key],0,hi)||(['variation','fill','resolvesTo'].includes(key)&&!Number.isInteger(e[key])))return;event[key]=e[key];}
    }
    if(e.role!==undefined){if(!['anchor','passing','anticipation','arpeggio','neighbor'].includes(e.role))return;event.role=e.role;}
    if(e.articulation!==undefined){if(!['closed','half','open'].includes(e.articulation))return;event.articulation=e.articulation;}
    if(e.ghost!==undefined){if(typeof e.ghost!=='boolean')return;event.ghost=e.ghost;}
    events.push(event);
  }
  for(const c of p.chords){
    if(!c||typeof c.label!=='string'||c.label.length>40||!pitches(c.notes)||!c.notes.length||!Number.isInteger(c.root)||!finite(c.root,0,127))return;
    chords.push({label:c.label,root:c.root,notes:[...c.notes]});
  }
  return {version:1,sourceBar:p.sourceBar,events:events.sort((a,b)=>a.at-b.at),chords};
}
