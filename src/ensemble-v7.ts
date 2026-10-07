// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings,MusicEvent} from './music';
import {ensembleEvents} from './ensemble';
import {melodySentence} from './melody';
import {repetitionLevel} from './music';
import {responsiveBass} from './bass-v15';
import {melodySentenceV17} from './melody-v17';
import {bassV17} from './bass-v17';
import {fillBreak} from './fills-v17';
import {compingV18} from './comping-v18';
import {dnbHatsV18} from './hats-v18';
const cache=new Map<string,MusicEvent[]>();
export function narrativeEvents(s:Settings,bar:number):MusicEvent[]{
  const start=bar-bar%8;
  const key=[s.generatorVersion>=18?18:s.generatorVersion>=17?17:s.generatorVersion>=15?15:s.generatorVersion>=10?10:7,repetitionLevel(s),s.seed,s.profile,s.groove,s.bpm,s.energy,s.warmth,s.evolution,start].join(':');
  let events=cache.get(key);
  if(!events){
    const v17=s.generatorVersion>=17,v18=s.generatorVersion>=18;
    // v17 keeps the v6 drums and comping rhythm, voiced with v17 chords.
    let backing=Array.from({length:8},(_,i)=>ensembleEvents({...s,generatorVersion:6,...(v18?{harmonyEngine:18 as const}:v17?{harmonyEngine:17 as const}:{})},start+i)).flat().filter(e=>e.layer!=='motif');
    // v18 writes its own comping (after the melody) and D&B hat line; ambient keeps the v13 bed.
    if(v18)backing=dnbHatsV18(s,start,backing.filter(e=>e.layer!=='harmony'||s.profile==='ambient'));
    if(v17){
      // The lead is written first; the bass then plays against it as a second voice.
      const melody=melodySentenceV17(s,start,backing);
      events=[...backing.filter(e=>e.layer!=='bass'),...bassV17(s,start,backing,melody),...melody,...(v18?compingV18(s,start,melody):[])];
      // Ensemble break: bass and comping rest (with their release) while a big fill plays.
      const cut=fillBreak(s,start+7);
      if(cut!==undefined)events=events.flatMap(e=>{
        if(e.layer!=='bass'&&e.layer!=='harmony')return [e];
        const room=cut-e.at-(e.layer==='bass'?.07:.6)*s.bpm/240;
        return e.length<=room?[e]:room>=.025?[{...e,length:+room.toFixed(8)}]:[];
      });
    }else{
      const melody=melodySentence(s,start,backing);
      // Preserve the established lead exactly; the new bass listens to that written melody.
      const accompaniment=s.generatorVersion>=15?[...backing.filter(e=>e.layer!=='bass'),...responsiveBass(s,start,backing,melody)]:backing;
      events=[...accompaniment,...melody];
    }
    events.sort((a,b)=>a.at-b.at);
    if(cache.size>=64)cache.delete(cache.keys().next().value!);
    cache.set(key,events);
  }
  return events.filter(e=>Math.floor(e.at)===bar);
}
