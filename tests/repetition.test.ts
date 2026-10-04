import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,regenerateSettings,type Settings} from '../src/music';
import {resetSliders} from '../src/controls';
import {capturePhrase,normalizePhrase,playbackScore,compositionIdentity} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
const settings=(mode:typeof modes[number]):Settings=>({...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),generatorVersion:14,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:78});
const phrase=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat();

test('Normal preserves v13 scores and historical versions ignore the new control',()=>{
 for(const mode of modes){
  const s=settings(mode);
  for(const start of [0,56,64,120,128,256])assert.deepEqual(phrase(s,start),phrase({...s,generatorVersion:13},start));
  for(const version of [7,10,12,13] as const){
   const old={...s,generatorVersion:version};
   assert.deepEqual(phrase({...old,melodyRepetition:0}),phrase({...old,melodyRepetition:3}));
  }
 }
});

test('all repetition levels keep melody playing, cadence and accompaniment intact, and save exact phrases',()=>{
 for(const mode of modes)for(const melodyRepetition of [0,1,2,3] as const)for(const bpm of [50,180]){
  const s={...settings(mode),melodyRepetition,bpm,energy:70};
  for(const start of [0,8,56,128]){
   const events=phrase(s,start),normal=phrase({...s,melodyRepetition:2},start);
   const backing=(es:typeof events)=>es.filter(e=>e.layer!=='motif'&&e.layer!=='arpeggio');
   assert.deepEqual(backing(events),backing(normal));
   const arp=(es:typeof events)=>es.filter(e=>e.layer==='arpeggio').map(({gain,...e})=>e);
   assert.deepEqual(arp(events),arp(normal)); // existing collision ducking can change gain only
   const melody=events.filter(e=>e.layer==='motif');
   assert.ok(melody.length>0);assert.ok(melody.at(-1)!.at>=start+7.5);
   assert.ok(melody.every(e=>e.length>0&&e.notes.every(Number.isFinite)));
   const saved=capturePhrase({settings:s,opening:true},start),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
   assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
   // Query another level between identical requests to exercise shared score-cache keys.
   phrase({...s,melodyRepetition:((melodyRepetition+1)%4) as 0|1|2|3},start);
   assert.deepEqual(phrase(s,start),events);
  }
 }
});

test('higher repetition retains the opening rhythm across more consecutive phrases',()=>{
 const matches=[0,0,0,0];
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const melodyRepetition of [0,1,2,3] as const){
  const s={...settings(mode),seed:`REPEAT${seed}`,melodyRepetition};let previous='';
  for(let start=0;start<256;start+=8){
   const signature=JSON.stringify(phrase(s,start,2).filter(e=>e.layer==='motif'&&e.role!=='neighbor').map(e=>+(e.at-start).toFixed(5)));
   if(signature===previous)matches[melodyRepetition]++;previous=signature;
  }
 }
 for(let i=1;i<4;i++)assert.ok(matches[i]>matches[i-1],JSON.stringify(matches));
});

test('repetition survives settings/share roundtrips and new flows; reset restores Normal',()=>{
 for(const melodyRepetition of [0,1,2,3] as const){
  const s={...DEFAULTS,melodyRepetition};
  assert.deepEqual(normalizeSettings(JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(s))))),s);
  assert.equal(regenerateSettings(s,'REPEAT99').melodyRepetition,melodyRepetition);
  assert.equal(selectProfile(s,'ambient').melodyRepetition,melodyRepetition);
  assert.equal(resetSliders(s).melodyRepetition,2);
  if(melodyRepetition!==2)assert.notEqual(compositionIdentity(s),compositionIdentity(DEFAULTS));
 }
 assert.equal(normalizeSettings({...DEFAULTS,melodyRepetition:Infinity}).melodyRepetition,2);
 assert.equal(normalizeSettings({...DEFAULTS,melodyRepetition:99}).melodyRepetition,3);
 assert.equal(normalizeSettings({...DEFAULTS,melodyRepetition:-1}).melodyRepetition,0);
 assert.equal(upgradeSettings({...DEFAULTS,generatorVersion:13,melodyRepetition:0}).melodyRepetition,2);
 assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:13}).melodyRepetition,undefined);
});
