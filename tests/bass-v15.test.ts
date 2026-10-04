import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,upgradeSettings,type Settings} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
const settings=(mode:typeof modes[number]):Settings=>({...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),generatorVersion:15,melodyRepetition:1,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:78});
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const bass=(s:Settings,start=0,n=8)=>score(s,start,n).filter(e=>e.layer==='bass');

test('v14 snapshots stay exact and v15 preserves every non-bass part at every repetition level',()=>{
 const hashes=['9a48e2b9d0cb457af992a591db8418745b88e51e346eb9b8826f35b894f5b13b','bb436fa2e5aa48cf813d399fc516184297696ec5187a5a3f61a92140b24fb43f','d352f9050a20eaa8aada89807bf13c46d979cde352467152cc1038fafd54fef1','060743ab836240ab97d1a172cee8a842d198ff971d244d8eaa32c5dd6b1882e3'];
 modes.forEach((mode,i)=>{
  const s=settings(mode),old={...s,generatorVersion:14 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  for(const melodyRepetition of [0,1,2,3] as const)for(const start of [0,56,120]){
   const withoutBass=(s:Settings)=>score(s,start).filter(e=>e.layer!=='bass');
   assert.deepEqual(withoutBass({...s,melodyRepetition}),withoutBass({...old,melodyRepetition}));
  }
  assert.equal(upgradeSettings(old).melodyRepetition,1);
 });
});

test('bass follows the melody, supports kicks, and preserves monophonic harmonic gates',()=>{
 let responsive=0,cohits=0,weakChanges=0;
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s={...settings(mode),seed:`BASSPLAN${seed}`,bpm,energy:80};
  const events=score(s,0,32),notes=events.filter(e=>e.layer==='bass'),kicks=events.filter(e=>e.voice==='kick');
  if(JSON.stringify(bass(s,8))!==JSON.stringify(bass({...s,melodyRepetition:3},8)))responsive++;
  for(let i=0;i<notes.length;i++){
   const e=notes[i],end=e.at+e.length+.065*bpm/240;
   assert.ok(Number.isFinite(e.notes[0])&&e.length>0&&e.length<=2);
   assert.ok(chordAt(s,e.at).notes.some(n=>n%12===e.notes[0]%12));
   assert.ok(end<=nextHarmonyBoundary(s,e.at)+1e-7);
   if(notes[i+1])assert.ok(end<=notes[i+1].at+1e-7);
   if(kicks.some(k=>Math.abs(k.at-e.at)*240/bpm<.015))cohits++;
  }
  const old=bass({...s,generatorVersion:14},0,32);
  const leaps=(es:typeof notes)=>es.slice(1).filter((e,i)=>Math.abs(e.notes[0]-es[i].notes[0])>7).length;
  weakChanges+=leaps(old)-leaps(notes);
 }
 assert.ok(responsive>=24,'bass must respond to different written melodies; compatible root loops may stay stable');
 assert.ok(cohits>200,'kick coincidence should be an available, frequent support choice');
 assert.ok(weakChanges>100,'reduce large leaps across this corpus');
});

test('random access, cache eviction and saved clips reproduce the planned bass',()=>{
 for(const mode of modes){
  const s=settings(mode),original=score(s,56);
  for(let bar=512;bar>=0;bar-=8)eventsForBar({...s,seed:`EVICT${bar}`},bar);
  const shuffled=[63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
  assert.deepEqual(shuffled,original);
  const saved=capturePhrase({settings:s,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
  assert.ok(loaded);assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
  assert.deepEqual(score({...s,layers:{...s.layers,bass:false}},56),original.filter(e=>e.layer!=='bass'));
 }
});

test('post-kick low-root loops coexist with responsive phrases and cross the ducked kick',()=>{
 let pulses=0,responses=0,crossed=0;
 for(const mode of ['lofi','dub'] as const)for(let seed=0;seed<24;seed++)for(const start of [8,40,72]){
  const s={...settings(mode),seed:`PULSE${seed}`,energy:65},events=score(s,start);
  const notes=events.filter(e=>e.layer==='bass'),kicks=events.filter(e=>e.voice==='kick');
  const pulse=notes.length>=8&&notes.every(e=>e.notes[0]>=34&&e.notes[0]<=45&&
   (e.notes[0]-chordAt(s,e.at).root+120)%12===0&&kicks.some(k=>Math.abs(e.at-k.at-.125)<1e-8));
  if(pulse){
   pulses++;
   crossed+=notes.filter(e=>kicks.some(k=>!!k.duck&&k.at>e.at&&k.at<e.at+e.length)).length;
  }else responses++;
 }
 assert.ok(pulses>16&&responses>60,'both bass identities must occur');
 assert.ok(crossed>100,'held roots should pass through actual kick ducking');
});
