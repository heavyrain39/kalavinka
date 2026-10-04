import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,type Settings} from '../src/music';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
const phrase=(s:Settings,start=0)=>Array.from({length:8},(_,b)=>eventsForBar(s,start+b)).flat();
test('v12 scores and non-ambient v13 scores retain exact fingerprints',()=>{
 const hashes=['67f8f6f676817c45d748498e2d4e59b35965eb5a2a5e8273bdf576ea5914a5a9','e78325b3297b290f9f9d05a57b7173d5322d5994c857482508edfa526403d973','00ee39de3ac70bc6400175243139afe2b9bf23822afee9e4ca93d6e539635cde','5c61f31ea4d18803df69bae04dc322ce08b99260906f3864542783b60b4bad2e'];
 modes.forEach((mode,i)=>{
  const s:Settings={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:78};
  const score=(settings:Settings)=>Array.from({length:64},(_,b)=>eventsForBar(settings,b));
  const old=score({...s,generatorVersion:12});
  assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),hashes[i]);
  if(mode!=='ambient')assert.deepEqual(score(s),old);
 });
});
test('ambient shared tones crossfade while incompatible notes finish at the harmonic boundary',()=>{
 for(let seed=0;seed<16;seed++)for(const bpm of [50,64,180]){
  const s={...selectProfile(DEFAULTS,'ambient'),seed:`AMBIENT${seed}`,bpm};
  s.instruments={...s.instruments,harmony:'h-pad'};
  for(let start=0;start<64;start+=8){
   const events=phrase(s,start),harmony=events.filter(e=>e.layer==='harmony');
   for(const e of harmony){
    assert.equal(e.notes.length,1);assert.ok(e.length>0&&e.length<=2);
    const boundary=Math.ceil(e.at+e.length-1e-7),next=chordAt(s,boundary),common=next.notes.includes(e.notes[0]);
    assert.ok(chordAt(s,e.at).notes.includes(e.notes[0]));
    if(common){assert.equal(e.at+e.length,boundary);assert.equal(e.release,.95);}
    else assert.ok(e.at+e.length+e.release!*bpm/240<=boundary+.05*bpm/240);
   }
   const saved=capturePhrase({settings:s,opening:true},start),normalized=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
   assert.ok(normalized);assert.deepEqual(playbackScore({settings:s,phrase:normalized,opening:true}).onsets(0,8),saved.events);
  }
 }
});
test('ambient articulation lengthens bell decay without changing arpeggio entrances or clock',()=>{
 const s=selectProfile(DEFAULTS,'ambient');
 const current=phrase(s).filter(e=>e.layer==='arpeggio'),old=phrase({...s,generatorVersion:12}).filter(e=>e.layer==='arpeggio');
 assert.deepEqual(current.map(e=>[e.at,e.length,e.notes]),old.map(e=>[e.at,e.length,e.notes]));
 assert.ok(current.every(e=>e.release!>.04));
 assert.equal(s.reverb,76);
 assert.equal(selectProfile({...DEFAULTS,reverb:41},'ambient').reverb,41);
 assert.equal(selectProfile(s,'lofi').reverb,28);
});
