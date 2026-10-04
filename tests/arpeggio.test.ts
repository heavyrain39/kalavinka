import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,regenerateSettings,type Settings} from '../src/music';
import {INSTRUMENTS,defaultArpeggioInstrument} from '../src/instruments';
import {ARP_PATTERNS,arpeggioPlan} from '../src/arpeggio';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {capturePhrase,normalizePhrase,playbackScore,favoriteIdentity} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
const settings=(p:typeof modes[number]):Settings=>({...selectProfile(DEFAULTS,p==='dnb'?'dub':p),groove:p==='dnb'?'dnb':'straight',bpm:p==='dnb'?170:78});
const phrase=(s:Settings,start:number,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat();
test('v9 introduces arpeggio in the third bar while v8 saved scores retain their original entries',()=>{
 const hashes=['1244da253f03f792961e6f0ef413d84c9b2331f275ebf74ab5129940b7f18a72','3763c0638612397c4e17301b4ce05928e8bcec23702cc67223ee0ea890805c3b','ebd0bef67b3b8944d72c86d54413386790ffef10e2863d8eea51cfed9e6e4acf','5d04e69360810adefb6b92e4060a0ba5036c8ce23380cb8537a1a16fc0791b4b'];
 modes.forEach((mode,i)=>{
  const s=settings(mode),old={...s,generatorVersion:8 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  assert.equal(normalizeSettings(old).generatorVersion,8);
  for(let seed=0;seed<24;seed++){
   const next={...s,seed:`EARLY${seed}`},arp=phrase(next,0).filter(e=>e.layer==='arpeggio');
   assert.ok(arp[0].at>=2&&arp[0].at<3,mode+' first entry');
  }
 });
});
test('all arpeggio timbres preserve the written pattern, save exactly, and change on regeneration',()=>{
 for(const mode of modes){
  const s=settings(mode),original=phrase(s,0,32);
  for(const {id} of INSTRUMENTS.arpeggio){
   const selected=normalizeSettings({...s,instruments:{...s.instruments,arpeggio:id}});
   const events=phrase(selected,0,32),arp=events.filter(e=>e.layer==='arpeggio');
   assert.ok(arp.length&&arp.every(e=>e.instrument===id));
   assert.deepEqual(events.map(e=>e.layer==='arpeggio'?{...e,instrument:defaultArpeggioInstrument(s.profile)}:e),original);
   const start=Math.floor(arp[0].at/8)*8,clip=capturePhrase({settings:selected,opening:true},start);
   assert.equal(favoriteIdentity(selected,clip),favoriteIdentity(normalizeSettings(JSON.parse(JSON.stringify(selected))),normalizePhrase(JSON.parse(JSON.stringify(clip)))!));
   assert.notEqual(regenerateSettings(selected,'NEWARP').instruments.arpeggio,id);
  }
  assert.equal(normalizeSettings({...s,instruments:{...s.instruments,arpeggio:'b-sub'}}).instruments.arpeggio,undefined);
 }
});
test('v7 saved scores remain exact and v8 only adds the independent arpeggio',()=>{
 const hashes=['7591817d17b69b3d963de25ee664c13c7e0bc164861ed1a3316cd968bf59cc1d','0a2fed0e7f078f4f44b54f5658d162b261f2e2cfd9368684eaab43d49a37d447','301ddb5e751f9d7941dd055ca2bec1a79aba5113f3403e964a9bc3fb575d817a','d832955dd7544c92ac39d468c81ff7b3c6530085c6a6033c7c0ddd8227cf0f01'];
 modes.forEach((p,i)=>{
  const s=settings(p),old={...s,generatorVersion:7 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  assert.equal(normalizeSettings(old).arpeggio,undefined);
  assert.deepEqual(phrase(s,0,64).filter(e=>e.layer!=='arpeggio'),phrase(old,0,64));
  assert.deepEqual(phrase({...s,arpeggio:false},0,64),phrase(old,0,64));
 });
});
test('twelve distinct patterns rotate between sparse episodes and remain chord-bound at both tempo limits',()=>{
 assert.equal(new Set(ARP_PATTERNS.map(p=>p.join(','))).size,12);
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s={...settings(mode),seed:`ARPS${seed}`,bpm,energy:100};
  let lastEnd=0,lastPattern=-1;const seen=new Set<number>();
  const span=mode==='ambient'||mode==='dnb'?32:16;
  for(let ep=0;ep<13;ep++){
   const plan=arpeggioPlan(s,ep*span),notes=phrase(s,ep*span,span).filter(e=>e.layer==='arpeggio');
   assert.notEqual(plan.pattern,lastPattern);if(ep<12)seen.add(plan.pattern);
   assert.ok(plan.start-lastEnd>=(ep===0?2:6));lastEnd=plan.end;lastPattern=plan.pattern;
   assert.ok(notes.length>=8&&notes.length<=12);
   for(let i=0;i<notes.length;i++){
    const e=notes[i];assert.ok(e.at>=plan.start&&e.at<plan.end);
    assert.ok(e.notes[0]>=60&&e.notes[0]<=78&&e.gain<=.019);
    assert.ok(chordAt(s,Math.floor(e.at)).notes.some(n=>n%12===e.notes[0]%12));
    const end=e.at+e.length+e.release!*bpm/240;
    assert.ok(end<=nextHarmonyBoundary(s,e.at)+1e-7);if(notes[i+1])assert.ok(end<notes[i+1].at);
   }
  }
  assert.equal(seen.size,12);
 }
});
test('arpeggio saves retain exact events, switch state, and future pattern sequence after serialization',()=>{
 for(const mode of modes){
  const s=settings(mode),plan=arpeggioPlan(s,0),start=Math.floor(plan.start/8)*8;
  const clip=capturePhrase({settings:s,opening:true},start),copy=normalizePhrase(JSON.parse(JSON.stringify(clip)))!;
  assert.ok(copy.events.some(e=>e.layer==='arpeggio'));
  assert.equal(favoriteIdentity(s,clip),favoriteIdentity(s,copy));
  assert.deepEqual(playbackScore({settings:s,phrase:copy,opening:true}).onsets(0,8),copy.events);
  assert.equal(normalizeSettings({...s,arpeggio:false}).arpeggio,false);
  const arp=(x:Settings)=>phrase(x,start).filter(e=>e.layer==='arpeggio');
  assert.deepEqual(arp({...s,layers:{...s.layers,motif:false}}),arp(s));
  const before=phrase(s,512).sort((a,b)=>a.at-b.at);
  const sought=[519,513,516,512,515,514,518,517].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
  assert.deepEqual(sought,before);
 }
});
