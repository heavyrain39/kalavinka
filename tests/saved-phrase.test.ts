import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectProfile,musicScore,type Settings,type MusicEvent} from '../src/music';
import {capturePhrase,playbackScore,normalizePhrase,favoriteIdentity,relativeEvent} from '../src/saved-phrase';
import {Transport} from '../src/transport';
import {Score} from '../src/score';

test('eight-bar saves freeze explicit notes/chords and continue at the original following bar',()=>{
 for(const generatorVersion of [1,2,3,4,5,6,7,8,9,10] as const)for(const profile of ['lofi','ambient','dub'] as const){
  const s:Settings={...selectProfile(DEFAULTS,profile),generatorVersion};
  const clip=capturePhrase({settings:s,opening:true},24),copy=normalizePhrase(JSON.parse(JSON.stringify(clip)));
  assert.ok(copy,`${generatorVersion}/${profile}`);
  assert.equal(favoriteIdentity(s,clip),favoriteIdentity(s,copy));
  const playback=playbackScore({settings:s,phrase:copy,opening:true});
  assert.deepEqual(playback.onsets(0,8),JSON.parse(JSON.stringify(clip.events)));
  assert.deepEqual(playback.onsets(8,16),musicScore(s).onsets(32,40).map(e=>relativeEvent(e,24)));
  assert.equal(copy.chords.length,8);
  const changed=structuredClone(copy),note=changed.events.find(e=>e.layer==='motif');
  if(note){note.notes[0]++;assert.equal(playbackScore({settings:s,phrase:changed,opening:true}).onsets(0,8).find(e=>e.layer==='motif')!.notes[0],note.notes[0]);}
  assert.deepEqual(playback.onsets(0,8),JSON.parse(JSON.stringify(clip.events)),'a modified save must not mutate another score');
 }
});

test('saved phrase decoder rejects malformed or oversized data without interpreting extra fields',()=>{
 const clip=capturePhrase({settings:DEFAULTS,opening:true});
 for(const input of [null,{}, {...clip,sourceBar:-8},{...clip,sourceBar:3},{...clip,chords:[]},{...clip,events:Array(513).fill(clip.events[0])},
  {...clip,events:[{...clip.events[0],at:8}]},{...clip,events:[{...clip.events[0],notes:[NaN]}]},
  {...clip,events:[{...clip.events[0],layer:'__proto__'}]},{...clip,events:[{...clip.events[0],gain:Infinity}]}])assert.equal(normalizePhrase(input),undefined);
 const clean=normalizePhrase({...clip,unused:'discard',events:clip.events.map(e=>({...e,callback:'discard'}))})!;
 assert.ok(clean);assert.ok(!('unused' in clean)&&!('callback' in clean.events[0]));
});

test('muting a recalled layer preserves its written notes and favorite identity',()=>{
 const phrase=capturePhrase({settings:DEFAULTS,opening:true},16);
 const muted={...DEFAULTS,layers:{...DEFAULTS.layers,motif:false}};
 const again=capturePhrase({settings:muted,phrase,opening:true});
 assert.equal(favoriteIdentity(muted,again),favoriteIdentity(muted,phrase));
 assert.ok(again.events.some(e=>e.layer==='motif'));
});

test('transport phrase capture retains past edits and pending notes but remains bounded',()=>{
 let now=0;
 const score=(n:number)=>new Score(bar=>[{at:bar,length:.1,voice:'pluck',layer:'motif',notes:[n],gain:.05,pan:0,cutoff:2000} as MusicEvent]);
 const t=new Transport<number>({clock:()=>now,trigger:()=>{},onError:e=>{throw e;}});
 const advance=(to:number)=>{while(now<to){now=Math.min(now+.03,to);t.tick();}};
 t.start(score(60),120,60);advance(2.5);
 const boundary=t.queue(score(64),120,()=>{},64);assert.equal(boundary,2);
 advance(7);
 const parts=t.window(0,8),notes=parts.flatMap(p=>p.score.onsets(p.from,p.to));
 assert.deepEqual(notes.map(e=>e.notes[0]),[60,60,64,64,64,64,64,64]);
 assert.deepEqual(parts.map(p=>p.render),[60,64]);
 for(let i=4;i<100;i++){
  advance(i*2+.3);t.queue(score(60+i%5),120,()=>{},60+i%5);
  assert.ok((t as unknown as {sections:unknown[]}).sections.length<=10);
 }
 const begin=Math.floor(t.position/8)*8;
 assert.equal(t.window(begin,begin+8)[0].from,begin);
 assert.ok(t.window(0,begin).every(p=>p.to===begin),'old phrases must not grow with playback');
});
