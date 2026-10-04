// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings,MusicEvent} from './music';
import {ensembleEvents} from './ensemble';
import {melodySentence} from './melody';
import {repetitionLevel} from './music';
import {responsiveBass} from './bass-v15';
const cache=new Map<string,MusicEvent[]>();
export function narrativeEvents(s:Settings,bar:number):MusicEvent[]{
  const start=bar-bar%8;
  const key=[s.generatorVersion>=15?15:s.generatorVersion>=10?10:7,repetitionLevel(s),s.seed,s.profile,s.groove,s.bpm,s.energy,s.warmth,s.evolution,start].join(':');
  let events=cache.get(key);
  if(!events){
    const backing=Array.from({length:8},(_,i)=>ensembleEvents({...s,generatorVersion:6},start+i)).flat().filter(e=>e.layer!=='motif');
    const melody=melodySentence(s,start,backing);
    // Preserve the established lead exactly; the new bass listens to that written melody.
    const accompaniment=s.generatorVersion>=15?[...backing.filter(e=>e.layer!=='bass'),...responsiveBass(s,start,backing,melody)]:backing;
    events=[...accompaniment,...melody].sort((a,b)=>a.at-b.at);
    if(cache.size>=64)cache.delete(cache.keys().next().value!);
    cache.set(key,events);
  }
  return events.filter(e=>Math.floor(e.at)===bar);
}
