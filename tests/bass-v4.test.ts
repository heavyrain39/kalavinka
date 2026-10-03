import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,chordHold,upgradeSettings,type Settings,type ProfileId} from '../src/music.ts';
const profiles=['lofi','ambient','dub','dnb'] as const;
const settings=(profile:typeof profiles[number],seed='SLOWFLOW'):Settings=>({...selectProfile(DEFAULTS,profile==='dnb'?'dub':profile),seed,groove:profile==='dnb'?'dnb':'straight',bpm:profile==='dnb'?170:DEFAULTS.bpm});
const phrase=(s:Settings,start:number)=>Array.from({length:4},(_,i)=>eventsForBar(s,start+i)).flat();
const signature=(s:Settings,start:number)=>JSON.stringify(phrase(s,start).filter(e=>e.layer==='bass').map(e=>[+(e.at-start).toFixed(6),e.length,(e.notes[0]-chordAt(s,Math.floor(e.at)).root+24)%12]));

test('v3 scores remain byte-identical including D&B; upgrades retain selected palettes',()=>{
 const hashes=['0d2631779aacb62894cc258bdea2175df999d136f60782ccc606896416ed976a','b27f8d58891814ef791787622d5ee5050ece451c0f22edc9d6ac5d5b0dc349a8','b323eb5cb0ab6ae856eeb1c50b143ef303ad40ad5a6f2be685f2b5ca6fa1696d','67c8aa9ce43376c06e723a14878e1acfdb49beb9d4dcbd3e0ef637089c8bc9d1'];
 profiles.forEach((p,i)=>{const s={...settings(p),generatorVersion:3 as const};assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(s,b)))).digest('hex'),hashes[i]);assert.deepEqual(upgradeSettings(s).instruments,s.instruments);});
});
test('all genres have distinct bass rhythms, contours and articulation across a seed corpus',()=>{
 for(const p of profiles){
  const rhythms=new Set(),contours=new Set(),gates=new Set(),counts=new Set();
  for(let i=0;i<64;i++){
   const s=settings(p,`BASS${i}`),bass=phrase(s,8).filter(e=>e.layer==='bass');
   rhythms.add(JSON.stringify(bass.map(e=>+(e.at-8).toFixed(3))));
   contours.add(JSON.stringify(bass.map(e=>(e.notes[0]-chordAt(s,Math.floor(e.at)).root+24)%12)));
   gates.add(JSON.stringify(bass.map(e=>e.length)));counts.add(bass.length);
   assert.notEqual(signature(s,p==='ambient'?32:16),signature(s,p==='ambient'?48:24),`${p}: breakdown/return must differ`);
  }
  assert.ok(rhythms.size>=8,`${p}: rhythm families ${rhythms.size}`);assert.ok(contours.size>=6,`${p}: contour families ${contours.size}`);assert.ok(gates.size>=8);assert.ok(counts.size>=3);
 }
});
test('v6 D&B holds harmony, repeats a two-bar drum pulse and leaves melody breathing room',()=>{
 for(let i=0;i<32;i++)for(const energy of [30,60,100]){
  const s={...settings('dnb',`CALM${i}`),generatorVersion:6 as const,energy};assert.equal(chordHold(s),4);
  for(let b=8;b<12;b++)assert.deepEqual(chordAt(s,b),chordAt(s,8));
  const bars=Array.from({length:4},(_,i)=>eventsForBar(s,8+i));
  const kicks=(bar:number)=>bars[bar].filter(e=>e.voice==='kick').map(e=>[e.at%1,e.length,e.gain]);assert.deepEqual(kicks(0),kicks(2));assert.deepEqual(kicks(1),kicks(3));
  for(const bar of bars)assert.deepEqual(bar.filter(e=>e.voice==='hat').map(e=>Math.round((e.at%1)*16)/16),[0,.125,.25,.375,.5,.625,.75,.875]);
  assert.equal(bars.flat().filter(e=>e.layer==='harmony').length,2);
  assert.ok(bars.flat().filter(e=>e.layer==='motif').length<=5);
  const old={...s,generatorVersion:3 as const};assert.ok(bars.flat().filter(e=>e.layer==='motif').length<phrase(old,8).filter(e=>e.layer==='motif').length);
 }
});
test('bass releases are monophonic across bars and chord changes at all tempo bounds',()=>{
 for(const p of profiles)for(let seed=0;seed<32;seed++)for(const bpm of [50,170,180]){
  const s={...settings(p,`GATE${seed}`),bpm,energy:100};
  const bass=Array.from({length:64},(_,b)=>eventsForBar(s,b)).flat().filter(e=>e.layer==='bass');
  for(let i=0;i<bass.length;i++){
   const e=bass[i],end=e.at+e.length+.065*bpm/240,boundary=(Math.floor(e.at/chordHold(s))+1)*chordHold(s);
   assert.ok(end<=boundary+1e-7,`${p}: harmonic spill`);
   if(bass[i+1])assert.ok(end<=bass[i+1].at+1e-7,`${p}: bass overlap`);
  }
 }
});
