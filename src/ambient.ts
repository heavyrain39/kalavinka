// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {chordAt,type Settings,type MusicEvent} from './music';
import {nextHarmonyBoundary} from './harmony-v5';

/** Overlapping shared tones keep the bed continuous without unbounded held voices. */
export function ambientEvents(s:Settings,bar:number,events:MusicEvent[]):MusicEvent[]{
  if(s.generatorVersion<13||s.profile!=='ambient')return events;
  const start=bar-bar%2,seconds=240/s.bpm;
  const harmony:MusicEvent[]=[];
  const chords=Array.from({length:3},(_,i)=>chordAt(s,start+i));
  const pitches=[...new Set(chords.slice(0,2).flatMap(c=>c.notes))];
  for(const pitch of pitches){
    for(let i=0;i<2;){
      if(!chords[i].notes.includes(pitch)){i++;continue;}
      const from=i;while(i<2&&chords[i].notes.includes(pitch))i++;
      if(start+from!==bar)continue;
      const continues=chords[i].notes.includes(pitch);
      // Common notes crossfade into the next voicing; changing notes finish at its edge.
      const release=continues?.95:.32;
      harmony.push({at:start+from,length:i-from-(continues?0:.28)/seconds,
        notes:[pitch],voice:'pad',layer:'harmony',gain:.102/chords[from].notes.length,velocity:.85,
        pan:(pitch%3-1)*.12,cutoff:3200-s.warmth*23,release});
    }
  }
  if(!['h-pad','h-organ'].includes(s.instruments.harmony)){
    harmony.splice(0,harmony.length,...events.filter(e=>e.layer==='harmony').map(e=>({...e,release:.7})));
  }
  return [...events.filter(e=>e.layer!=='harmony').map(e=>{
    if(e.layer!=='motif'&&e.layer!=='arpeggio')return e;
    const arp=e.layer==='arpeggio',id=e.instrument??s.instruments[e.layer];
    if(id==='m-nylon')return {...e,gain:e.gain*.82}; // Keep the guitar's written chord/rest damping.
    let release=id==='m-bell'?(arp?.85:1.25):id==='m-marimba'?.42:id==='m-flute'?.38:.55;
    if(e.role==='neighbor')release=.07;
    const boundary=nextHarmonyBoundary(s,e.at),next=chordAt(s,boundary);
    if(!e.notes.every(n=>next.notes.some(c=>c%12===n%12)))
      release=Math.max(.04,Math.min(release,(boundary-e.at-e.length)*seconds+.06));
    return {...e,release,gain:e.gain*(arp?.82:1)};
  }),...harmony];
}
