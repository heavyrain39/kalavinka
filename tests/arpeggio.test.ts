import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,regenerateSettings,type Settings} from '../src/music';
import {INSTRUMENTS,defaultArpeggioInstrument,chooseInstruments} from '../src/instruments';
import {ARP_PATTERNS,arpeggioPlan} from '../src/arpeggio';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {capturePhrase,normalizePhrase,playbackScore,favoriteIdentity} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
const settings=(p:typeof modes[number]):Settings=>({...selectProfile(DEFAULTS,p==='dnb'?'dub':p),groove:p==='dnb'?'dnb':'straight',bpm:p==='dnb'?170:78});
const phrase=(s:Settings,start:number,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat();
test('v9 saved scores preserve their original sparse notes',()=>{
 const hashes=['ed1789d739bc97de2c442cf2679a5125b111046dcc6d3028c102351076adc07d','64dde926b3cfbe494c1e521e2143fa2c0e822063ef99b9a296f1fe36d52688d5','a23495b1778a715c954b7a263ebd4f040ae047b6f669b435d67bc4221b3862b7','9f6fd0a1a002dc70d9a12ffd1796d647a04cd5996e7aaea312607d37ab9ba2e0'];
 modes.forEach((mode,i)=>{
  const old={...settings(mode),generatorVersion:9 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
 });
});
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
test('v7 saved scores remain exact and new arpeggio/cadence leave accompaniment intact',()=>{
 const hashes=['7591817d17b69b3d963de25ee664c13c7e0bc164861ed1a3316cd968bf59cc1d','0a2fed0e7f078f4f44b54f5658d162b261f2e2cfd9368684eaab43d49a37d447','301ddb5e751f9d7941dd055ca2bec1a79aba5113f3403e964a9bc3fb575d817a','d832955dd7544c92ac39d468c81ff7b3c6530085c6a6033c7c0ddd8227cf0f01'];
 modes.forEach((p,i)=>{
  const s=settings(p),old={...s,generatorVersion:7 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  assert.equal(normalizeSettings(old).arpeggio,undefined);
  assert.deepEqual(phrase(s,0,64).filter(e=>e.layer!=='arpeggio'&&e.layer!=='motif'),phrase(old,0,64).filter(e=>e.layer!=='motif'));
  assert.deepEqual(phrase({...s,arpeggio:false},0,64),phrase(s,0,64).filter(e=>e.layer!=='arpeggio'));
 });
});
test('twelve distinct patterns rotate between sparse episodes and remain chord-bound at both tempo limits',()=>{
 assert.equal(new Set(ARP_PATTERNS.map(p=>p.join(','))).size,12);
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s={...settings(mode),seed:`ARPS${seed}`,bpm,energy:100};
  let lastEnd=0,lastPattern=-1;const seen=new Set<number>();
  const span=mode==='ambient'||mode==='dnb'?16:8;
  for(let ep=0;ep<13;ep++){
   const plan=arpeggioPlan(s,ep*span),notes=phrase(s,ep*span,span).filter(e=>e.layer==='arpeggio');
   assert.notEqual(plan.pattern,lastPattern);if(ep<12)seen.add(plan.pattern);
   assert.ok(plan.start-lastEnd>=(ep===0?2:span/2));lastEnd=plan.end;lastPattern=plan.pattern;
   assert.equal(notes.length,(plan.end-plan.start)*(mode==='dnb'?4:8));
   const step=mode==='dnb'?.25:.125;
   for(let n=1;n<notes.length;n++)assert.equal(notes[n].at-notes[n-1].at,step,'steady arpeggio clock');
   const period=ARP_PATTERNS[plan.pattern].length;
   for(let n=period;n<notes.length;n++)if(chordAt(s,Math.floor(notes[n].at)).label===chordAt(s,Math.floor(notes[n-period].at)).label)assert.deepEqual(notes[n].notes,notes[n-period].notes,'the same ordered pattern repeats under the same chord');
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


test('v10 scores retain the original longer rests',()=>{
 const hashes=['5b2577d613be3c8dff7cf5a2a76d49103764d7796b386d6532a36a4c3bc61049','5cd6800442d5a35849f06b8b1af67ecb13ccbbdc2dd27e9a91efaed5532ac257','0c0ced5c059ec40c5dc65698fc93f0e3f9e426ccd69c85ffc719a7407b66b318','ebf2c4a120c3de40106ae385a974d76bf04680ca0c143b36b0c3dfa17ad3b27f'];
 modes.forEach((mode,i)=>{
  const old={...settings(mode),generatorVersion:10 as const};
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[i]);
  assert.equal(normalizeSettings(old).generatorVersion,10);
  const current=settings(mode),active=Array.from({length:128},(_,b)=>eventsForBar(current,b).some(e=>e.layer==='arpeggio'));
  assert.equal(active.filter(Boolean).length,64);
 });
});
test('automatic melody/arpeggio choices differ; manual matches survive normalization and sharing',()=>{
 for(const mode of ['lofi','ambient','dub'] as const)for(let seed=0;seed<256;seed++){
  const mix=chooseInstruments(mode,`TIMBRE${seed}`),s={...selectProfile(DEFAULTS,mode),instruments:mix};
  assert.notEqual(mix.motif,mix.arpeggio);
  const next=regenerateSettings(s,`NEXT${seed}`);
  assert.notEqual(next.instruments.motif,next.instruments.arpeggio);
  assert.notEqual(next.instruments.arpeggio,mix.arpeggio);
  const manual={...s,instruments:{...mix,arpeggio:mix.motif}};
  assert.equal(normalizeSettings(JSON.parse(JSON.stringify(manual))).instruments.arpeggio,mix.motif);
 }
});
