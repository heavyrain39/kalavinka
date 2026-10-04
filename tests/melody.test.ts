import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,chordAt,type Settings} from '../src/music';
import {chapterBars} from '../src/melody';
import {nextHarmonyBoundary} from '../src/harmony-v5';
const modes=['lofi','ambient','dub','dnb'] as const;
const settings=(p:typeof modes[number]):Settings=>({...selectProfile(DEFAULTS,p==='dnb'?'dub':p),generatorVersion:7,groove:p==='dnb'?'dnb':'straight',bpm:p==='dnb'?170:78});
const phrase=(s:Settings,start:number,n=8)=>Array.from({length:n},(_,b)=>eventsForBar(s,start+b)).flat();
const melody=(s:Settings,start:number,n=8)=>phrase(s,start,n).filter(e=>e.layer==='motif');

test('v6 saved scores remain byte-identical and v7 leaves accompaniment unchanged',()=>{
 const hashes=['7b9b31795684b59c3719d9c978543a39e4dfeb505070f5d3203dc558cebb2b35','c5d4e1c9b6e25727ed8fb53e706d42a8811d24ca04575c58f14a0f72c9c75827','d62fc64f8a9512ef6261d2fa19b1b8c073584be424e858e7381deb851cfbf54f','441f775efead3f6ad10b831241ba77cc7823b4a3f5210199c8fff8d04b9d5aee'];
 modes.forEach((p,i)=>{
  const s=settings(p),old={...s,generatorVersion:6 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  assert.equal(normalizeSettings(old).generatorVersion,6);assert.equal(normalizeSettings(s).generatorVersion,7);
  for(let b=0;b<96;b++)assert.deepEqual(eventsForBar(s,b).filter(e=>e.layer!=='motif'),eventsForBar(old,b).filter(e=>e.layer!=='motif'));
 });
});

test('long sessions develop even at zero evolution; seeking and cache eviction preserve the score',()=>{
 for(const mode of modes)for(const evolution of [0,50,100]){
  const s={...settings(mode),evolution},size=chapterBars(s),signatures=new Set<string>();
  const original=phrase(s,0);
  for(let chapter=0;chapter<12;chapter++){
   const start=chapter*size;
   const events=melody(s,start,size);
   // Compare compositional identity, excluding gains, panning and floating-point timing noise.
   signatures.add(JSON.stringify(events.map(e=>[+(e.at-start).toFixed(5),e.notes[0],+e.length.toFixed(5)])));
  }
  assert.equal(signatures.size,12,mode+' repeated a whole chapter');
  assert.deepEqual(phrase(s,0),original);
  const chronological=phrase(s,320),shuffled=[327,321,325,320,326,323,322,324].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
  assert.deepEqual(shuffled,chronological);
 }
});

test('tension resolves by step, tails respect harmony, hooks repeat, and D&B stays sparse',()=>{
 let tensions=0,repeated=0,hooks=0;
 for(const mode of modes)for(let seed=0;seed<16;seed++)for(const bpm of [50,180]){
  const s={...settings(mode),seed:`MELODY${seed}`,bpm,energy:80,evolution:60};
  for(let start=0;start<96;start+=8){
   const events=melody(s,start);
   for(let i=0;i<events.length;i++){
    const e=events[i],next=events[i+1];
    assert.ok(e.length>0&&e.gain<.09);
    assert.ok(e.at+e.length+e.release!*bpm/240<=nextHarmonyBoundary(s,e.at)+1e-7);
    if(next)assert.ok(e.at+e.length+e.release!*bpm/240<=next.at+1e-7,'dry melodic voices must leave room for the next note');
    if(i&&events[i-1].notes[0]===e.notes[0])repeated++;
    if(e.role==='neighbor'){
     tensions++;assert.ok(next&&next.notes[0]===e.resolvesTo&&next.role!=='neighbor');
     assert.ok(Math.abs(e.notes[0]-next.notes[0])<=2);
     assert.ok(e.at+e.length+e.release!*bpm/240<=next.at);
     assert.ok(!chordAt(s,Math.floor(e.at)).notes.some(n=>n%12===e.notes[0]%12));
    }
   }
   if(mode==='dnb'||mode==='ambient')assert.ok(events.length<=17,mode+' density');
   const a=events.filter(e=>e.at<start+2&&e.role!=='neighbor').slice(0,2);
   const answer=events.filter(e=>e.at>=start+2&&e.at<start+4&&e.role!=='neighbor').slice(0,2);
   if(a.length===2&&answer.length===2&&a.every((e,i)=>Math.abs(e.at+2-answer[i].at)<1e-6))hooks++;
  }
 }
 assert.ok(tensions>100,`only ${tensions} tension/resolution pairs`);
 assert.ok(repeated>100,'same-pitch repetition should be permitted');
 assert.ok(hooks>300,`only ${hooks} recognizable rhythmic replies`);
});
