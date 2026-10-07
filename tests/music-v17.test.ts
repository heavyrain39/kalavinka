import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,regenerateSettings,type Settings} from '../src/music';
import {nextHarmonyBoundary,hasEnding} from '../src/harmony-v5';
import {chordScale,toneClass,tonicPc,keyPcs} from '../src/harmony-v17';
import {fillPlan} from '../src/fills';
import {fillBreak,type FillPlanV17} from '../src/fills-v17';
import {arrangementAt} from '../src/arrangement';
import {gridTime} from '../src/timing';
import {chapterBarsV17,melodyRestsV17} from '../src/melody-v17';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
// Pinned to v17: v18 has its own suite (music-v18.test.ts).
const settings=(mode:Mode,extra:Partial<Settings>={}):Settings=>({...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),generatorVersion:17,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:selectProfile(DEFAULTS,mode==='dnb'?'dub':mode).bpm,...extra});
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const pc=(n:number)=>((n%12)+12)%12;

test('v16 favorites keep exact scores while new music, upgrades and new flows use the current generator',()=>{
 // Recorded from v16 before v17 existed: 96 bars × four modes × repetition off/normal.
 const hashes:Record<string,string>={
  'lofi:0':'0b6b2e7c979c3c4a6c3a86c1d947ffadb4d92b15d1f21a1970a3cb9fe016244c','lofi:2':'0f7673d819b26b7c5526b9946829c4bf72736d4fc02c4f2961d8d64f59532a9a',
  'ambient:0':'ed8ebdaadd4f6d8ef476a54810d7ef3ad20d2035c8e23a32c233db9993e474df','ambient:2':'9d5b52831dba7c63a8e98654555e97466574b21005c1095bab20e74258683e82',
  'dub:0':'2392a21c9b7f1af775b9d56d54d0d9aa9af26b3adf5a38cf8b14e152f9ec19be','dub:2':'1f69129b7d28f825af4ef5a48c696ec30d3eb5f35501e8d1d51fbab3665f6bd6',
  'dnb:0':'001cf08151ce34997a5c481a0cda8462d79867e6f129dfa5f5ec060bfdb91d02','dnb:2':'25ba17f713b71291312c3e59304ddc804e7deedf9f05f515dfa066c1addada2d'};
 for(const mode of modes)for(const rep of [0,2] as const){
  const old=settings(mode,{generatorVersion:16,melodyRepetition:rep,bpm:mode==='dnb'?170:78});
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[`${mode}:${rep}`]);
  assert.equal(normalizeSettings(old).generatorVersion,16);
  assert.equal(upgradeSettings(old).generatorVersion,18);
  assert.equal(upgradeSettings(old).melodyRepetition,rep);
 }
 assert.equal(DEFAULTS.generatorVersion,18);
 assert.equal(regenerateSettings(settings('lofi',{generatorVersion:16})).generatorVersion,18);
 // The internal backing marker never survives storage or sharing.
 assert.equal('harmonyEngine' in normalizeSettings({...DEFAULTS,harmonyEngine:17}),false);
});

test('harmony varies by section yet repeats at zero evolution, with comping below the lead',()=>{
 let richer=0;
 for(const mode of modes)for(let seed=0;seed<12;seed++){
  const s=settings(mode,{seed:`HARM${seed}`,evolution:0}),form=mode==='ambient'?64:32;
  for(let bar=0;bar<form*3;bar++){
   const chord=chordAt(s,bar);
   assert.deepEqual(chord,chordAt(s,bar%form),'evolution 0 repeats the whole harmonic form');
   assert.ok(chord.notes.length===4&&chord.notes[0]>=50&&chord.notes[3]<=72,`${mode} voicing ${chord.notes}`);
   const scale=chordScale(s,chord);
   assert.ok(chord.notes.every(n=>scale.includes(pc(n))),'chord tones belong to the chord-scale');
   assert.equal(scale.length,7);
   // Harmony may change only at a bar the boundary function reports.
   if(bar&&chord.label!==chordAt(s,bar-1).label)assert.equal(nextHarmonyBoundary(s,bar-1+.5),bar);
  }
  const lively={...s,evolution:80},labels=(x:Settings)=>new Set(Array.from({length:form*4},(_,b)=>chordAt(x,b).label)).size;
  if(labels(lively)>labels({...lively,generatorVersion:16}))richer++;
 }
 assert.ok(richer>=40,`v17 should use a wider chord vocabulary than v16 (${richer}/48)`);
});

test('comping never rings across a chord change, including one-bar approach chords',()=>{
 let approaches=0;
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s=settings(mode,{seed:`COMP${seed}`,bpm,evolution:100});
  for(let start=0;start<96;start+=8){
   for(const e of score(s,start).filter(e=>e.layer==='harmony')){
    const boundary=nextHarmonyBoundary(s,e.at);
    // Ambient pads may hold a common tone through the change; every other tone stops first.
    if(e.at+e.length>boundary+1e-7)assert.ok(mode==='ambient'&&e.notes.every(n=>chordAt(s,boundary).notes.some(c=>pc(c)===pc(n))),`${mode} harmony tail`);
   }
   // Relative chords with identical voicings (an authored v5 ending such as E♭m7 → G♭6) need no new onset.
   for(let b=start;b<start+8;b++)if(hasEnding(s,b)&&chordAt(s,b).notes.join()!==chordAt(s,b-1).notes.join()){
    approaches++;
    assert.ok(score(s,b,1).some(e=>e.layer==='harmony'&&Math.abs(e.at-b)<1e-6),'an approach chord is sounded on its bar');
   }
  }
 }
 assert.ok(approaches>200,`approach/cadence chords should be common (${approaches})`);
});

test('melody: wider stepwise lines, resolved non-chord tones, a mid-phrase climax and a closing note',()=>{
 let notes=0,repeats=0,steps=0,climax=0,phrases=0,tensions=0,ranges=0;
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s=settings(mode,{seed:`LEAD${seed}`,bpm,energy:80,evolution:60});
  for(let start=8;start<104;start+=8){
   const events=score(s,start).filter(e=>e.layer==='motif'),lead=events.filter(e=>e.role!=='neighbor');
   for(let i=0;i<events.length;i++){
    const e=events[i],next=events[i+1],tail=e.at+e.length+e.release!*bpm/240,chord=chordAt(s,Math.floor(e.at));
    assert.ok(e.length>0&&e.gain<.09&&e.notes[0]>=60&&e.notes[0]<=81);
    // Ambient (v13+) deliberately lets common tones ring through the change.
    if(mode!=='ambient')assert.ok(tail<=nextHarmonyBoundary(s,e.at)+1e-7,'release fits before the harmony changes');
    if(next)assert.ok((mode==='ambient'?e.at+e.length:tail)<=next.at+1e-7,'no overlapping dry melody notes');
    assert.ok(chordScale(s,chord).includes(pc(e.notes[0])),'every lead note belongs to its chord-scale');
    if(e.role==='passing'){tensions++;assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);}
    if(e.role==='neighbor')assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);
    if(e.role==='anchor'&&(Math.round((e.at%1)*16)%8===0)&&e.length>=.2)assert.notEqual(toneClass(chord,chordScale(s,chord),e.notes[0]),'avoid');
   }
   for(let i=1;i<lead.length;i++){
    const d=Math.abs(lead[i].notes[0]-lead[i-1].notes[0]);notes++;
    assert.ok(d<=9,'no leap beyond a sixth');
    if(!d)repeats++;else if(d<=2)steps++;
   }
   if(!lead.length){assert.ok(melodyRestsV17(s,start),'only the breakdown rest is silent');continue;}
   const closing=lead.at(-1)!;
   assert.ok(closing.at>=start+7.5,'a closing note in the latter half of bar eight');
   const pitches=lead.map(e=>e.notes[0]),top=Math.max(...pitches);
   if(lead.find(e=>e.notes[0]===top)!.at>=start+3.5)climax++;
   ranges+=top-Math.min(...pitches);phrases++;
  }
 }
 assert.ok(repeats/notes<.25&&repeats/notes>.04,`repeated notes ${(repeats/notes).toFixed(2)}`);
 assert.ok(steps/notes>.45,`stepwise motion ${(steps/notes).toFixed(2)}`);
 assert.ok(climax/phrases>.7,`climax after the opening ${(climax/phrases).toFixed(2)}`);
 assert.ok(ranges/phrases>=5.5,`phrase range ${(ranges/phrases).toFixed(1)}`);
 assert.ok(tensions>300,`passing tones ${tensions}`);
});

test('the lead breathes in the intro and the open answer, and repetition levels stay ordered',()=>{
 for(const mode of modes){
  const s=settings(mode,{seed:'BREATH'});
  assert.ok(score(s,0,4).some(e=>e.layer==='motif'),'the lead starts with the intro');
  // A whole eight-bar sentence of the breakdown rests; the arpeggio carries it from bar three.
  const open=mode==='ambient'?32:16;
  assert.equal(score(s,open,8).filter(e=>e.layer==='motif').length,0,'the breakdown rests for eight bars');
  assert.ok(score(s,open+8,8).some(e=>e.layer==='motif'),'the lead returns after the rest');
  assert.ok(score(s,open+2,6).some(e=>e.layer==='arpeggio'),'the arpeggio carries the breakdown');
  assert.ok(!score(s,open,2).some(e=>e.layer==='arpeggio'),'the arpeggio leaves the first two breakdown bars clear');
  // Entrances vary between bar 3 and bar 5 instead of always bar 3.
  const entries=new Set<number>();
  for(let seed=0;seed<12;seed++)for(let start=0;start<256;start+=8){
   const x={...s,seed:`ARPIN${seed}`},first=score(x,start).find(e=>e.layer==='arpeggio');
   if(first&&(start===0||!score(x,start-1,1).some(e=>e.layer==='arpeggio')))entries.add(Math.floor(first.at-start));
  }
  assert.ok(entries.has(2)&&entries.has(4),`varied arpeggio entrances ${[...entries]}`);
  // Distinct two-bar opening hooks (rhythm and contour): what the repetition control actually holds or releases.
  const hooks=(x:Settings)=>{
   const set=new Set<string>();
   for(let start=8;start<512;start+=8){const hook=score(x,start,2).filter(e=>e.layer==='motif'&&e.role!=='neighbor');set.add(hook.map(e=>Math.round((e.at-start)*16)+':'+(e.notes[0]-hook[0].notes[0])).join());}
   return set.size;
  };
  const rhythms=(level:0|1|2|3)=>hooks({...s,melodyRepetition:level});
  const [off,low,normal,high]=[0,1,2,3].map(l=>rhythms(l as 0|1|2|3));
  assert.ok(Math.min(off,low)>normal&&normal>high,`${mode} ${off}/${low}/${normal}/${high}`);
  const old=hooks({...s,generatorVersion:16 as const});
  assert.ok(normal>old,`${mode}: Normal must repeat less than v16 Normal (${normal} vs ${old})`);
  assert.equal(chapterBarsV17({...s,melodyRepetition:2}),mode==='ambient'||mode==='dnb'?64:32);
 }
});

test('bass: monophonic gates, approach notes that resolve, and counterpoint with the lead',()=>{
 let approaches=0,parallel=0,parallelOld=0,octaves=0;
 const parallels=(s:Settings,start:number)=>{
  const ev=score(s,start),bass=ev.filter(e=>e.layer==='bass'),lead=ev.filter(e=>e.layer==='motif'&&e.role!=='neighbor');
  const at=(t:number)=>lead.filter(e=>e.at<=t+1e-6&&e.at+e.length>t).at(-1)?.notes[0];
  let count=0;
  for(let i=1;i<bass.length;i++){
   const m1=at(bass[i-1].at),m2=at(bass[i].at),b1=bass[i-1].notes[0],b2=bass[i].notes[0];
   if(m1===undefined||m2===undefined||m1===m2||b1===b2)continue;
   const i1=pc(m1-b1),i2=pc(m2-b2);
   if((i1===0||i1===7)&&i1===i2&&Math.sign(b2-b1)===Math.sign(m2-m1))count++;
  }
  return count;
 };
 for(const mode of modes)for(let seed=0;seed<8;seed++)for(const bpm of [50,180]){
  const s=settings(mode,{seed:`LOW${seed}`,bpm,energy:80,evolution:60});
  for(let start=0;start<64;start+=8){
   const notes=score(s,start).filter(e=>e.layer==='bass');
   for(let i=0;i<notes.length;i++){
    const e=notes[i],next=notes[i+1],end=e.at+e.length+.065*bpm/240,chord=chordAt(s,e.at);
    assert.ok(e.notes[0]>=34&&e.notes[0]<=55&&e.length>0&&e.length<=2);
    assert.ok(end<=nextHarmonyBoundary(s,e.at)+1e-7||e.role==='anticipation'&&end<=Math.ceil(e.at)+1e-7);
    if(next){assert.ok(end<=next.at+1e-7,'monophonic');if(Math.abs(next.notes[0]-e.notes[0])===12)octaves++;}
    if(!chord.notes.some(n=>pc(n)===pc(e.notes[0]))&&pc(e.notes[0])!==tonicPc(s))assert.equal(e.role,'anticipation','non-chord bass notes are approaches or a tonic pedal');
    if(e.role==='anticipation'){
     approaches++;
     const target=notes.find(n=>n.at>=Math.ceil(e.at-1e-9)-1e-9);
     if(target&&target.role!=='anticipation'){
      const d=pc(target.notes[0]-e.notes[0]);
      assert.ok([1,2,5,7,10,11].includes(d),'approach leads by step or fifth into its target');
      assert.equal(pc(target.notes[0]),pc(chordAt(s,target.at).root),'an approached change lands on its root');
     }
    }
   }
   parallel+=parallels(s,start);parallelOld+=parallels({...s,generatorVersion:16},start);
  }
 }
 assert.ok(approaches>400,`approach notes ${approaches}`);
 assert.ok(octaves>20,`octave moves ${octaves}`);
 assert.ok(parallel<parallelOld,`parallel perfect intervals ${parallel} vs v16 ${parallelOld}`);
});

test('random access, cache eviction, saved clips and mutes reproduce the v17 score',()=>{
 for(const mode of modes){
  const s=settings(mode,{seed:'REPLAY17',evolution:70}),original=score(s,56);
  for(let bar=512;bar>=0;bar-=8)eventsForBar({...s,seed:`EVICT${bar}`},bar);
  const shuffled=[63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
  assert.deepEqual(shuffled,original);
  assert.deepEqual(score({...s,generatorVersion:16},56).length>0,true); // interleaved old queries share no cache
  assert.deepEqual(score(s,56),original);
  const saved=capturePhrase({settings:s,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
  assert.ok(loaded);assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
  for(const layer of ['bass','motif','harmony'] as const)
   assert.deepEqual(score({...s,layers:{...s.layers,[layer]:false}},56),original.filter(e=>e.layer!==layer));
 }
});

test('fills follow the section direction, the band breaks for big fills, and toms are tuned to the key',()=>{
 const seen=new Map<string,number>();let builds=0,buildChances=0,crashes=0,breaks=0;
 for(const mode of ['lofi','dub','dnb'] as const)for(let seed=0;seed<16;seed++)for(const bpm of [50,180]){
  const s=settings(mode,{seed:`FILLS${seed}`,bpm,energy:65});
  const key=keyPcs(s);
  for(let bar=0;bar<128;bar++){
   const plan=fillPlan(s,bar) as FillPlanV17|null,a=arrangementAt(s,bar),next=arrangementAt(s,bar+1);
   if(bar%8===7&&a.section==='open')buildChances++;
   assert.deepEqual(fillPlan({...s,evolution:0},bar),fillPlan({...s,evolution:0},bar+32),'evolution 0 repeats fills per form');
   if(!plan)continue;
   seen.set(plan.kind,(seen.get(plan.kind)??0)+1);
   const events=eventsForBar(s,bar),strokes=events.filter(e=>e.fill!==undefined);
   if(plan.kind==='pickup'){assert.equal(bar%8,3);assert.ok(['groove','return'].includes(a.section));continue;}
   assert.equal(bar%8,7);
   if(plan.kind==='build')assert.ok(a.section==='open'&&next.section==='return');
   if(plan.kind==='lift')assert.ok(a.section==='intro'&&next.section==='groove');
   if(plan.kind==='turn'||plan.kind==='drop')assert.ok(next.section==='open'||next.section==='intro');
   if(plan.kind==='drop'){assert.ok(!events.some(e=>e.layer==='rhythm'&&e.at>=gridTime(s,bar,12)));continue;}
   const begin=Math.min(...strokes.map(e=>e.at));
   for(const e of strokes)if(e.voice==='tom')assert.ok(key.includes(e.notes[0]%12),'toms tuned to the key');
   if(plan.kind==='build'||plan.kind==='lift'){
    assert.ok(!events.some(e=>e.voice==='kick'&&e.at>=begin),'big fills take over the kick');
    const main=strokes.filter(e=>!strokes.some(o=>o!==e&&o.voice===e.voice&&o.at>e.at&&o.at-e.at<.02));
    if(plan.kind==='build'){builds++;assert.ok(main.at(-1)!.velocity!>=main[0].velocity!+.15,'build-ups crescendo');}
    if(eventsForBar(s,bar+1).some(e=>e.voice==='crash'))crashes+=plan.kind==='build'?1:0;
   }
   const cut=fillBreak(s,bar);
   if(cut!==undefined){
    breaks++;
    assert.ok(!events.some(e=>(e.layer==='bass'||e.layer==='harmony')&&e.at+e.length>cut+1e-7),'bass and comping rest during the break');
    const landing=eventsForBar(s,bar+1).filter(e=>e.layer==='bass'&&Math.abs(e.at-bar-1)<1e-6);
    for(const e of landing)assert.equal(pc(e.notes[0]),pc(chordAt(s,bar+1).root),'the band lands on the root');
   }
  }
 }
 for(const kind of ['lift','build','turn','drop','pickup'])assert.ok((seen.get(kind)??0)>20,`${kind} fills occur (${seen.get(kind)})`);
 assert.ok(builds/buildChances>.5,`build-ups into the return are common (${builds}/${buildChances})`);
 assert.ok(crashes/builds>.7,`build-ups usually land on a cymbal (${crashes}/${builds})`);
 assert.ok(breaks>50,`ensemble breaks ${breaks}`);
 for(let b=0;b<128;b++){
  assert.equal(fillPlan(settings('ambient',{energy:100}),b),null);
  assert.equal(fillPlan(settings('lofi',{energy:19}),b),null);
 }
});
