import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectProfile,eventsForBar,type Settings} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';

const phrase=(s:Settings,start:number)=>Array.from({length:8},(_,i)=>eventsForBar(s,start+i)).flat().filter(e=>e.layer==='motif').sort((a,b)=>a.at-b.at);
test('v10 retains a late closing note in every eight-bar melody, including the intro and sparse modes',()=>{
 for(const mode of ['lofi','ambient','dub','dnb'] as const)for(let seed=0;seed<8;seed++)for(const bpm of [50,180])for(const energy of [25,80]){
  const s:Settings={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),generatorVersion:10,seed:`CADENCE${seed}`,bpm,energy,groove:mode==='dnb'?'dnb':'straight'};
  for(let start=0;start<64;start+=8){
   const notes=phrase(s,start),closing=notes.at(-1)!;
   assert.ok(closing.at>=start+7.5&&closing.at<start+8,'closing note must survive in the latter half of bar eight');
   const end=closing.at+closing.length+closing.release!*bpm/240;
   assert.ok(end>=start+7.9&&end<=start+8+1e-7,'cadence should sustain toward the phrase boundary');
   for(let i=0;i<notes.length;i++){
    const e=notes[i],tail=e.at+e.length+e.release!*bpm/240;
    assert.ok(e.length>0&&tail<=nextHarmonyBoundary(s,e.at)+1e-7);
    if(notes[i+1])assert.ok(tail<=notes[i+1].at+1e-7,'no overlapping dry melody notes');
   }
  }
 }
});
test('mixed-version cache queries cannot rewrite old favorites or the new cadence',()=>{
 const current={...DEFAULTS,arpeggio:false},old={...current,generatorVersion:9 as const};
 const original=phrase(old,0),updated=phrase(current,0);
 assert.ok(original.at(-1)!.at<7.5&&updated.at(-1)!.at>=7.5);
 assert.deepEqual(phrase(old,0),original);
 assert.deepEqual(phrase(current,0),updated);
});
