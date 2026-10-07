import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,regenerateSettings,type Settings,type MusicEvent} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {chordScale,keyPcs,tonicPc} from '../src/harmony-v17';
import {recipeV18,companionV18,bankV18} from '../src/harmony-v18';
import {PROGRESSIONS_V18,QUALITIES_V18,MODES_V18} from '../src/harmony-catalog-v18';
import {compingFilterV18} from '../src/comping-v18';
import {chapterBarsV17} from '../src/melody-v17';
import {fillPlan} from '../src/fills';
import {arrangementAt} from '../src/arrangement';
import {gridTime} from '../src/timing';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
const settings=(mode:Mode,extra:Partial<Settings>={}):Settings=>({...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:selectProfile(DEFAULTS,mode==='dnb'?'dub':mode).bpm,...extra});
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const pc=(n:number)=>((n%12)+12)%12;
const LETTER:Record<string,number>={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const labelRoot=(label:string)=>pc(LETTER[label[0]]+(label[1]==='♯'?1:label[1]==='♭'?-1:0));

test('v17 and v18 favorites keep exact scores while new music, upgrades and new flows use the current generator',()=>{
 // Recorded from v17 before v18 existed: 96 bars × four modes × repetition off/normal.
 const hashes:Record<string,string>={
  'lofi:0':'cec2bdfdb021fc18cdd8d3c56820b6bf863b31d6cdf32c5d8042adfa5d149fa8','lofi:2':'724b9d08d1c7169879f020261d0edd1d52c54307bc074696ca1cef558d65f509',
  'ambient:0':'70efcf253e33795f04292b356aeb2db10392013adde428f1952957f4cea6986a','ambient:2':'91db590f36dbd36ee6bb02eafe495165f2c85fa97a6ab9103c8db87871f9a373',
  'dub:0':'dae2b5a645df1da7b7e52cea72f2ce3c2ec76777f86be036e6ab52cea23b6b92','dub:2':'973f547d94218a7afea193b862059ab61947ff932547cea8d78f96a7ae806842',
  'dnb:0':'6883f32d4047b22c076d870fb369144dfb3648697c1793a54ced10e2749744e6','dnb:2':'969e6a093684a6cb46421a1ae1340eef984b803302511785b1e041d9960c2f2a'};
 for(const mode of modes)for(const rep of [0,2] as const){
  const old=settings(mode,{generatorVersion:17,melodyRepetition:rep,bpm:mode==='dnb'?170:78});
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(old,b)))).digest('hex'),hashes[`${mode}:${rep}`]);
  assert.equal(normalizeSettings(old).generatorVersion,17);
  assert.equal(upgradeSettings(old).generatorVersion,19);
  assert.equal(upgradeSettings(old).melodyRepetition,rep);
 }
 // Recorded from v18 before v19 added catalogue entries: older v18 songs never pick them.
 const v18:Record<string,string>={'lofi:0':'81500bf36c16ec3e92725ebc57c8d570f9f4a1a7fdb840ace2e7540b8c2d1648','lofi:2':'298d1d310ca6ebe4d4838893d991550887fb333a84aaaf1a418d993e8b213746','ambient:0':'d837c0156648b973a9e7d7d1da4643b8faf16b72a0b6f5e01144975be9f23b2f','ambient:2':'4cf8d42e1c2097f8bb947bffc14d88eb7a84435e0e504df89be5f805c3c85bed','dub:0':'31ef23881515cdbbb4eb271b3be0390db9b2609179ddadaf1b6dd17876fc9484','dub:2':'e7255a959d4725ec0ecaad23026db59e2ec3f2bbaaeeb8e1ea30a057d6d942ce','dnb:0':'a23414c7bf1047cd2f2f53ab0026ef6a8094ee695adeab1390fbc25f789a4487','dnb:2':'7c402bde114ccde949271ac56a594bf8b1eadb42f0d5da95473ff4eaf0341c55'};
 for(const mode of modes)for(const rep of [0,2] as const){
  const old=settings(mode,{generatorVersion:18,melodyRepetition:rep,bpm:mode==='dnb'?170:78});
  assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(old,b)))).digest('hex'),v18[`${mode}:${rep}`]);
  assert.equal(normalizeSettings(old).generatorVersion,18);
 }
 assert.equal(DEFAULTS.generatorVersion,19);
 assert.equal(regenerateSettings(settings('lofi',{generatorVersion:17})).generatorVersion,19);
 assert.equal('harmonyEngine' in normalizeSettings({...DEFAULTS,harmonyEngine:18}),false);
});

test('the catalogue: four banks of jazz/soul progressions with whole-cycle lengths',()=>{
 const banks=new Map<string,number>();
 for(const r of PROGRESSIONS_V18){
  banks.set(r.bank,(banks.get(r.bank)??0)+1);
  const units=r.chords.reduce((sum,[,,u])=>sum+u,0);
  assert.ok(units===8||units===16,`${r.id} lasts ${units} units`);
  assert.ok(r.chords.every(([d,q,u])=>Object.hasOwn(QUALITIES_V18,q)&&Number.isInteger(d)&&u>=1),r.id);
  assert.ok(Object.hasOwn(MODES_V18,r.mode)&&r.weight>=1);
  // Ambient never uses a strong (unsuspended) dominant.
  if(r.bank==='ambient')assert.ok(r.chords.every(([,q])=>!['7','9','13','7b9','7#9','9#11'].includes(q)),r.id);
  for(let i=0;i<r.chords.length;i++){
   const next=r.chords[(i+1)%r.chords.length];
   assert.ok(r.chords.length===1||r.chords[i][0]!==next[0]||r.chords[i][1]!==next[1],`${r.id}: repeated chord should be one longer chord`);
  }
 }
 assert.equal(new Set(PROGRESSIONS_V18.map(r=>r.id)).size,PROGRESSIONS_V18.length);
 assert.ok(PROGRESSIONS_V18.length>=70,`${PROGRESSIONS_V18.length} progressions`);
 assert.ok(banks.get('lofi')!>=24&&banks.get('ambient')!>=16&&banks.get('house')!>=14&&banks.get('dnb')!>=12,JSON.stringify([...banks]));
 for(const bank of ['lofi','ambient','house','dnb'])assert.ok(PROGRESSIONS_V18.some(r=>r.bank===bank&&['minor','dorian'].includes(r.mode))&&PROGRESSIONS_V18.some(r=>r.bank===bank&&['major','lydian'].includes(r.mode)),bank);
 // D&B has its own liquid bank; the companion progression shares the song's mode family.
 const ids=new Set<string>();
 for(let seed=0;seed<200;seed++)for(const mode of modes){
  const s=settings(mode,{seed:`BANK${seed}`}),a=recipeV18(s),b=companionV18(s);
  assert.equal(a.bank,bankV18(s));assert.equal(b.bank,a.bank);assert.notEqual(a.id,b.id);
  assert.equal(['major','lydian'].includes(a.mode),['major','lydian'].includes(b.mode));
  // Entries added later are gated by version, so v18 songs keep their progression.
  assert.ok((recipeV18({...s,generatorVersion:18}).since??18)<=18);
  ids.add(a.id);
 }
 assert.ok(ids.size>=PROGRESSIONS_V18.length*.9,`seeds reach ${ids.size} progressions`);
 assert.ok(ids.has('l27'),'v19 seeds reach the added progression');
});

test('rootless voicings below the lead, chord-scales that hold every chord tone, key-aware names',()=>{
 const qualities=new Set<string>();let richer=0;
 for(const mode of modes)for(let seed=0;seed<12;seed++){
  const s=settings(mode,{seed:`HARM${seed}`,evolution:0}),form=mode==='ambient'?64:32;
  const sharps=[7,2,9,4,11].includes(pc(tonicPc(s)+({major:0,lydian:7,minor:3,dorian:10} as Record<string,number>)[recipeV18(s).mode]));
  for(let bar=0;bar<form*2;bar++){
   const chord=chordAt(s,bar);
   assert.deepEqual(chord,chordAt(s,bar%form),'evolution 0 repeats the whole harmonic form');
   assert.ok(chord.notes.length===4&&chord.notes[0]>=50&&chord.notes[3]<=72,`${mode} voicing ${chord.notes}`);
   assert.ok(chord.tones!.includes(pc(chord.root)),'chord tones include the root');
   assert.ok(chord.notes.every(n=>chord.tones!.includes(pc(n))),'the voicing uses chord tones');
   // Comping leaves the root to the bass on rich chords (ambient keeps it for its sparse bass).
   if(mode!=='ambient'&&chord.tones!.length>=5)assert.ok(!chord.notes.some(n=>pc(n)===pc(chord.root)),`${chord.label} rootless`);
   if(mode==='ambient')assert.ok(chord.notes.some(n=>pc(n)===pc(chord.root)),`${chord.label} keeps its root in ambient`);
   const scale=chordScale(s,chord);
   assert.ok(chord.tones!.every(t=>scale.includes(t)),`${chord.label} scale ${scale}`);
   assert.ok(scale.length===7||scale.length===8);
   assert.equal(labelRoot(chord.label),pc(chord.root),chord.label);
   if(keyPcs(s).includes(pc(chord.root)))assert.ok(!chord.label.slice(1,2).includes(sharps?'♭':'♯'),`${chord.label} in a ${sharps?'sharp':'flat'} key`);
   if(bar&&chord.label!==chordAt(s,bar-1).label)assert.equal(nextHarmonyBoundary(s,bar-1+.5),bar);
   qualities.add(chord.quality!);
  }
  const lively={...s,evolution:80},labels=(x:Settings)=>new Set(Array.from({length:form*4},(_,b)=>chordAt(x,b).label)).size;
  if(labels(lively)>labels({...lively,generatorVersion:16}))richer++;
 }
 for(const q of ['maj9','m9','m11','13','7b9','9#11','6/9','9sus4','m7b5','maj7#11'])assert.ok(qualities.has(q),`uses ${q}`);
 assert.ok(richer>=44,`v18 uses a wider chord vocabulary than v16 (${richer}/48)`);
});

test('approach chords and turnarounds: secondary, tritone and backdoor dominants, never in the intro',()=>{
 let tritone=0,secondary=0,backdoor=0,ambientDominant=0;
 for(const mode of modes)for(let seed=0;seed<24;seed++){
  const s=settings(mode,{seed:`TURN${seed}`,evolution:70});
  for(let bar=1;bar<192;bar++){
   const chord=chordAt(s,bar),next=chordAt(s,bar+1),a=arrangementAt(s,bar);
   if(chord.label===next.label||!['7','9','13','7b9','9#11'].includes(chord.quality!))continue;
   if(mode==='ambient')ambientDominant++;
   const d=pc(chord.root-next.root);
   if(d===7)secondary++;if(d===1)tritone++;if(pc(chord.root-tonicPc(s))===10&&pc(next.root-tonicPc(s))===0)backdoor++;
   if(a.section==='intro')assert.ok(arrangementAt(s,bar-1).section==='intro','authored chords only in the intro');
  }
 }
 assert.ok(secondary>300&&tritone>40&&backdoor>20,`secondary ${secondary}, tritone ${tritone}, backdoor ${backdoor}`);
 assert.equal(ambientDominant,0,'ambient avoids strong dominants');
});

test('comping: genre cells with dynamics, pushes that anticipate the next chord, breakdown filter',()=>{
 let pushes=0,dynamics=0,phrases=0;
 for(const mode of ['lofi','dub','dnb'] as const)for(let seed=0;seed<12;seed++)for(const bpm of [60,180]){
  const s=settings(mode,{seed:`COMP${seed}`,bpm,energy:70,evolution:60});
  for(let start=0;start<64;start+=8){
   const events=score(s,start),comp=events.filter(e=>e.layer==='harmony'),lead=events.filter(e=>e.layer==='motif');
   for(const e of comp){
    assert.equal(e.voice,mode==='dnb'?'pad':'keys');
    assert.ok(e.velocity!>=.2&&e.velocity!<=1);
    const push=e.role==='anticipation',chord=chordAt(s,push?Math.floor(e.at)+1:e.at);
    assert.ok(e.notes.every(n=>chord.notes.includes(n)),'comping plays its chord (a push plays the next one)');
    const limit=nextHarmonyBoundary(s,push?Math.floor(e.at)+1:e.at);
    assert.ok(e.at+e.length+.6*bpm/240<=limit+1e-7,`${mode} comping rings across a change at ${e.at}`);
    if(push){
     pushes++;
     assert.ok(!lead.some(m=>m.at<Math.floor(e.at)+1.06&&m.at+m.length+(m.release??.1)*bpm/240>e.at&&e.notes.some(n=>[1,11].includes(pc(m.notes[0]-n)))),'a push never clashes with the lead');
    }
   }
   const groove=comp.filter(e=>arrangementAt(s,e.at).section==='groove');
   if(groove.length){phrases++;if(new Set(groove.map(e=>e.velocity)).size>=3)dynamics++;}
   if(mode!=='dnb')for(const e of comp)assert.ok(arrangementAt(s,e.at).section!=='groove'||e.cutoff>=Math.round((3200-s.warmth*23)*.8)-1);
  }
  // Breakdown is darker than the return, and opens through the build-up.
  if(mode==='lofi')assert.ok(compingFilterV18(s,16)<compingFilterV18(s,20)&&compingFilterV18(s,20)<compingFilterV18(s,23)&&compingFilterV18(s,23)<compingFilterV18(s,24));
 }
 assert.ok(pushes>150,`pushes ${pushes}`);
 assert.ok(dynamics>=phrases*.9,`velocity variety ${dynamics}/${phrases}`);
 // House stabs sit off the beat more often than on it.
 const house=score(settings('dub',{seed:'HOUSE1',energy:70}),8,8).filter(e=>e.layer==='harmony');
 assert.ok(house.filter(e=>Math.round((e.at%1)*16)%4!==0).length>house.length*.6);
});

test('lo-fi timing: a laid-back backbeat and drifting hats within a few milliseconds',()=>{
 for(let seed=0;seed<12;seed++)for(const bpm of [60,120]){
  const s=settings('lofi',{seed:`FEEL${seed}`,bpm,energy:60}),seconds=240/bpm;
  for(let bar=8;bar<16;bar++){
   const events=eventsForBar(s,bar);
   for(const e of events.filter(e=>e.layer==='rhythm'&&e.fill===undefined&&!e.ghost)){
    const step=Math.round((e.at-bar)*16),offset=(e.at-gridTime(s,bar,step))*seconds*1000;
    if(e.voice==='kick')assert.ok(Math.abs(offset)<1e-6,'kicks stay on the grid');
    if(e.voice==='snare')assert.ok(offset>=4.9&&offset<=5.1,`backbeat ${offset}ms`);
    if(e.voice==='hat')assert.ok(offset>=-2.1&&offset<=6.1,`hat ${offset}ms`);
   }
   for(const e of events.filter(e=>e.layer==='harmony')){
    const step=Math.round((e.at-bar)*16),offset=(e.at-gridTime(s,bar,step))*seconds*1000;
    assert.ok(offset>=5.9&&offset<=18.1,`keys sit just behind the beat (${offset}ms)`);
   }
  }
 }
 // Other moods keep v17 timing.
 const dub=settings('dub',{energy:60});
 for(const e of eventsForBar(dub,9).filter(e=>e.voice==='snare'&&!e.ghost))assert.equal(e.at,gridTime(dub,9,Math.round((e.at-9)*16)));
});

test('D&B hats: dense, dynamic sixteenths that respect fills and stops',()=>{
 let dense=0,bars=0;
 for(let seed=0;seed<16;seed++){
  const high=settings('dnb',{seed:`HATS${seed}`,energy:80}),low={...high,energy:30};
  for(let bar=8;bar<48;bar++){
   const a=arrangementAt(high,bar);if(a.beatless||a.section==='open')continue;
   const hats=eventsForBar(high,bar).filter(e=>e.voice==='hat'&&e.fill===undefined),fills=eventsForBar(high,bar).filter(e=>e.fill!==undefined);
   bars++;if(hats.length>=12&&new Set(hats.map(e=>e.velocity)).size>=3)dense++;
   if(fills.length)assert.ok(hats.every(h=>h.at<Math.min(...fills.map(f=>f.at))),'no hats inside a fill');
   const plan=fillPlan(high,bar);
   if(plan&&'kind' in plan&&plan.kind==='drop')assert.ok(hats.every(h=>h.at<gridTime(high,bar,12)),'a stop is silent');
   assert.ok(eventsForBar(low,bar).filter(e=>e.voice==='hat').length<=9,'low energy keeps a lighter two-step');
  }
 }
 assert.ok(dense>=bars*.6,`dense hat bars ${dense}/${bars}`);
});

test('melody per mood: house riffs repeat, liquid lines sustain, phrase-end throws stay rare',()=>{
 assert.equal(chapterBarsV17(settings('dub')),64);assert.equal(chapterBarsV17(settings('lofi')),32);
 assert.equal(chapterBarsV17(settings('dub',{generatorVersion:17})),32);
 let riffs=0,checked=0,longLiquid=0,throws=0,phrases=0;
 const rhythm=(events:MusicEvent[],from:number)=>events.filter(e=>e.layer==='motif'&&e.role!=='neighbor'&&e.at>=from&&e.at<from+2).map(e=>Math.round((e.at-from)*16)).join();
 for(let seed=0;seed<16;seed++){
  const house=settings('dub',{seed:`RIFF${seed}`,energy:60});
  for(const start of [8,40]){
   const events=score(house,start),first=rhythm(events,start),second=rhythm(events,start+2);
   if(first){checked++;if(first===second)riffs++;}
  }
  const liquid=score(settings('dnb',{seed:`RIFF${seed}`,energy:60}),8,24);
  if(liquid.some(e=>e.layer==='motif'&&e.length>.7))longLiquid++;
  for(const mode of modes){
   const s=settings(mode,{seed:`RIFF${seed}`});
   for(let start=0;start<64;start+=8){
    const sent=score(s,start).filter(e=>e.send!==undefined);phrases++;throws+=sent.length;
    assert.ok(sent.length<=1,'at most one throw per sentence');
    for(const e of sent){
     assert.equal(e.layer,'motif');assert.equal(e.send,.45);assert.notEqual(mode,'ambient');
     assert.ok(['groove','return'].includes(arrangementAt(s,e.at).section));
     assert.ok(e.at>=start+6,'only the cadence note');
    }
   }
  }
 }
 assert.ok(riffs>=checked*.8,`house riffs repeat (${riffs}/${checked})`);
 assert.ok(longLiquid>=12,`liquid lines sustain (${longLiquid}/16)`);
 assert.ok(throws>0&&throws<phrases*.35,`throws ${throws}/${phrases}`);
});

test('bass carries the roots of rootless chords and stays monophonic',()=>{
 let anchors=0,roots=0;
 for(const mode of ['lofi','dub','dnb'] as const)for(let seed=0;seed<12;seed++){
  const s=settings(mode,{seed:`ROOT${seed}`,energy:60}),bpm=s.bpm;
  const bass=score(s,0,64).filter(e=>e.layer==='bass');
  bass.forEach((e,i)=>{
   if(bass[i+1])assert.ok(e.at+e.length+.065*bpm/240<=bass[i+1].at+1e-7,'monophonic');
   const bar=Math.floor(e.at);
   if(Math.abs(e.at-bar)<.02&&chordAt(s,bar).label!==chordAt(s,bar-1).label){anchors++;if(pc(e.notes[0]-chordAt(s,bar).root)===0)roots++;}
  });
 }
 assert.ok(roots>=anchors*.85,`roots on chord changes ${roots}/${anchors}`);
});

test('random access, cache eviction, saved clips and mutes reproduce the v18 score',()=>{
 for(const mode of modes){
  const s=settings(mode,{seed:'REPLAY18',evolution:70}),original=score(s,56);
  for(let bar=512;bar>=0;bar-=8)eventsForBar({...s,seed:`EVICT${bar}`},bar);
  const shuffled=[63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
  assert.deepEqual(shuffled,original);
  assert.ok(score({...s,generatorVersion:17},56).length>0); // interleaved old queries share no cache
  assert.deepEqual(score(s,56),original);
  const saved=capturePhrase({settings:s,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
  assert.deepEqual(loaded,saved);
  assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
  assert.ok(saved.events.length<=512);
  for(const layer of ['bass','motif','harmony'] as const)
   assert.deepEqual(score({...s,layers:{...s.layers,[layer]:false}},56),original.filter(e=>e.layer!==layer));
 }
});
