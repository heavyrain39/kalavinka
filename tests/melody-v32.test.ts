import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,regenerateSettings,type Settings,type MusicEvent} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {chordScale,toneClass,tonicPc} from '../src/harmony-v17';
import {arrangementAt} from '../src/arrangement';
import {gridTime} from '../src/timing';
import {melodyRestsV17} from '../src/melody-v17';
import {melodyV32,SLUR_V32} from '../src/melody-v32';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
const SEEDS=['SLOWFLOW','AB12CD','PULSE2','ZK9Q','MOON77','RAIN3','DESK01','NIGHT8','Q1W2E3','TT55','LOFI99','XYZW'];
// Pinned to v32: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:32,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const leadOf=(s:Settings,start:number)=>score(s,start).filter(e=>e.layer==='motif'&&e.role!=='neighbor');
const pc=(n:number)=>((n%12)+12)%12;
/** The sixteenth a note belongs to, whether or not it lies back behind the grid. */
const stepOf=(e:MusicEvent,from:number)=>Math.floor((e.at-from)*16+.2);

test('v31 favorites keep exact scores while new music and upgrades use the v32 lead',()=>{
  // Recorded from v31 before v32 existed: 96 bars × four moods × repetition off/normal.
  const hashes:Record<string,string>={
    'lofi:0':'7d1742b7d4ff6481b56a6704b39e11bdc91da441b19d3113bbf989707ba4cfee','lofi:2':'accdec14ad0120e84dee1acb431910c008c9a50e85c7029fb585e70128128da7',
    'ambient:0':'11532b5fa647390e345bc515531be895c32b7952b74a480abef05154b6fcb48f','ambient:2':'fd13ae76d3dd4b22a7f1766be05eef8d3a6471d96630502fefbb6554940975a3',
    'dub:0':'7f7ebd8075ed4404e8f09cca72c995f6900db6cb50c011061b7713b82b9bbb0b','dub:2':'cdd595f303f3c83c8a69c3dab45ed7705cde73ef4feb7b74e9ccd06e706a9681',
    'dnb:0':'ea29ad111cb696fb5885d35040866efa8855c5ec65f1aedfde6359bb254b48eb','dnb:2':'1ea0eda2f80e54b2a08703ab39ad0f4edc7968f0138a94805eb300ec50d1518c'};
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:31,melodyRepetition:rep});
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(old,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(normalizeSettings(old).generatorVersion,31);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
    assert.equal(melodyV32(old),false);
  }
  assert.ok(DEFAULTS.generatorVersion>=32);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:32}).generatorVersion,32);
  assert.equal(normalizeSettings({seed:'OLDLINK'}).generatorVersion,1);
  assert.deepEqual(normalizeSettings({...DEFAULTS,generatorVersion:2.5}),DEFAULTS);
  assert.equal(regenerateSettings(make('lofi',{generatorVersion:31})).generatorVersion,DEFAULTS.generatorVersion);
  // Only the lead changes: every other part of a v32 song is the v31 part.
  for(const mode of modes)for(const seed of SEEDS.slice(0,4)){
    const now=make(mode,{seed}),old=make(mode,{seed,generatorVersion:31});
    const drums=(s:Settings)=>score(s,0,64).filter(e=>e.layer==='rhythm');
    assert.deepEqual(drums(now),drums(old),`${mode}:${seed} drums`);
    for(let bar=0;bar<64;bar++)assert.deepEqual(chordAt(now,bar),chordAt(old,bar));
  }
});

test('the line is sound: chord-scale notes, resolved passing tones, no wide leaps, nothing rings into the next chord',()=>{
  let notes=0,steps=0,repeats=0,passing=0,slurs=0;
  for(const mode of modes)for(const seed of SEEDS.slice(0,8))for(const [bpm,energy] of [[50,80],[180,42],[108,100]]){
    const s=make(mode,{seed,bpm:mode==='dnb'?Math.max(150,bpm):bpm,energy,evolution:60}),seconds=s.bpm/240;
    for(let start=0;start<96;start+=8){
      const events=score(s,start).filter(e=>e.layer==='motif'),lead=events.filter(e=>e.role!=='neighbor');
      if(!lead.length){assert.ok(melodyRestsV17(s,start),`${mode} ${seed}: only the breakdown rest is silent`);continue;}
      for(let i=0;i<events.length;i++){
        const e=events[i],next=events[i+1],tail=e.at+e.length+e.release!*seconds,chord=chordAt(s,Math.floor(e.at));
        assert.ok(e.length>0&&e.gain>0&&e.gain<.09&&e.notes[0]>=60&&e.notes[0]<=81);
        assert.ok(e.velocity!>=.3&&e.velocity!<=1);
        assert.ok(chordScale(s,chord).includes(pc(e.notes[0])),'every lead note belongs to its chord-scale');
        // Ambient (v13+) deliberately lets common tones ring through the change.
        if(mode!=='ambient')assert.ok(tail<=nextHarmonyBoundary(s,e.at)+1e-7,`${mode} ${seed}: the release fits before the harmony changes`);
        if(next&&mode!=='ambient'&&tail>next.at+1e-7){
          // The only overlap is a slur: a step held just past the next note's start.
          slurs++;
          const move=Math.abs(next.notes[0]-e.notes[0]);
          assert.ok(move>=1&&move<=2,'only steps are slurred');
          assert.equal(e.release,.06);
          assert.ok(e.at+e.length-next.at<=SLUR_V32*seconds+1e-7,'a slur overlaps by 30 ms at most');
        }
        if(e.role==='passing'){passing++;assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);}
        if(e.role==='neighbor')assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);
        if(e.role==='anchor'&&stepOf(e,Math.floor(e.at))%8===0&&e.length>=.2)assert.notEqual(toneClass(chord,chordScale(s,chord),e.notes[0]),'avoid');
      }
      for(let i=1;i<lead.length;i++){
        const d=Math.abs(lead[i].notes[0]-lead[i-1].notes[0]);notes++;
        assert.ok(d<=9,'no leap beyond a sixth');
        if(!d)repeats++;else if(d<=2)steps++;
      }
      // The closing note may arrive an eighth before bar eight, on its downbeat or on its third beat.
      assert.ok(lead.at(-1)!.at>=start+6.75,`${mode} ${seed} ${start}: a closing note in the last two bars`);
    }
  }
  assert.ok(steps/notes>.45,`stepwise motion ${(steps/notes).toFixed(2)}`);
  assert.ok(repeats/notes<.25,`repeated notes ${(repeats/notes).toFixed(2)}`);
  assert.ok(passing>300,`passing tones ${passing}`);
  assert.ok(slurs>300,`slurred steps ${slurs}`);
});

test('contour: the line travels instead of rocking between two notes, and each two-bar idea goes somewhere',()=>{
  const measure=(version:31|32)=>{
    let windows=0,rocking=0,units=0,home=0,runs=0,runLength=0;
    for(const mode of ['lofi','dub'] as const)for(const seed of SEEDS)for(let start=0;start<128;start+=8){
      const lead=leadOf(make(mode,{seed,generatorVersion:version}),start),p=lead.map(e=>e.notes[0]);
      for(let i=2;i<p.length;i++){windows++;if(p[i]===p[i-2]&&p[i]!==p[i-1])rocking++;}
      let run=0,dir=0;
      for(let i=1;i<p.length;i++){const d=Math.sign(p[i]-p[i-1]);if(d&&d===dir)run++;else{if(run){runs++;runLength+=run;}run=d?1:0;dir=d;}}
      if(run){runs++;runLength+=run;}
      if(mode==='lofi')for(let k=0;k<2;k++){
        const unit=lead.filter(e=>Math.floor((e.at-start)/2)===k);
        if(unit.length>1){units++;if(Math.abs(unit.at(-1)!.notes[0]-unit[0].notes[0])<=2)home++;}
      }
    }
    return {rocking:rocking/windows,home:home/units,run:runLength/runs};
  };
  const now=measure(32),old=measure(31);
  assert.ok(now.rocking<.12&&old.rocking>.25,`A–B–A turns ${now.rocking.toFixed(2)} (v31 ${old.rocking.toFixed(2)})`);
  assert.ok(now.run>old.run+.1,`same-direction runs ${now.run.toFixed(2)} (v31 ${old.run.toFixed(2)})`);
  assert.ok(now.home<.45&&old.home>.55,`ideas that end where they began ${now.home.toFixed(2)} (v31 ${old.home.toFixed(2)})`);
});

test('rhythm and breath: a repeated cell, a long note, then at least a beat of rest',()=>{
  let units=0,breath=0,celled=0,ideas=0,longEnd=0;
  for(const seed of SEEDS)for(const energy of [42,70])for(let start=0;start<128;start+=8){
    const s=make('lofi',{seed,energy}),lead=leadOf(s,start);
    if(!lead.length)continue;
    for(let k=0;k<2;k++){
      const from=start+k*2,unit=lead.filter(e=>e.at>=from&&e.at<from+2);
      if(unit.length<2)continue;
      units++;
      const last=unit.at(-1)!,next=lead.find(e=>e.at>=from+2);
      if(((next?next.at:start+8)-last.at-last.length)*4>=.95)breath++;
      // The unit's longest note is its last one.
      if(unit.every(e=>e.length<=last.length+1e-9))longEnd++;
      if(k)continue;
      // The opening cell's rhythm comes back inside the idea (at the half bar, the bar or the bar and a half).
      ideas++;
      const steps=unit.map(e=>stepOf(e,from)),cell=steps.filter(x=>x<8);
      if([8,16].some(shift=>cell.length>0&&cell.every(x=>steps.includes(x+shift))))celled++;
    }
  }
  assert.ok(breath>=units*.85,`ideas followed by a beat of rest ${breath}/${units}`);
  assert.ok(longEnd>=units*.75,`ideas that end on their longest note ${longEnd}/${units}`);
  assert.ok(celled>=ideas*.7,`ideas that repeat their cell ${celled}/${ideas}`);
});

test('the answer keeps the hook: same rhythm and head, only the tail changes',()=>{
  let pairs=0,rhythm=0,contour=0,exact=0,tails=0,oldRhythm=0,oldPairs=0;
  for(const seed of SEEDS)for(let start=0;start<128;start+=8)for(const version of [31,32] as const){
    const s=make('lofi',{seed,generatorVersion:version}),lead=leadOf(s,start);
    const a=lead.filter(e=>e.at<start+2),b=lead.filter(e=>e.at>=start+2&&e.at<start+4);
    if(a.length<3||b.length<3)continue;
    const steps=(u:MusicEvent[],from:number)=>u.map(e=>stepOf(e,from)).join(),same=steps(a,start)===steps(b,start+2);
    if(version===31){oldPairs++;if(same)oldRhythm++;continue;}
    pairs++;if(same)rhythm++;
    const shape=(u:MusicEvent[])=>[Math.sign(u[1].notes[0]-u[0].notes[0]),Math.sign(u[2].notes[0]-u[1].notes[0])].join();
    if(shape(a)===shape(b))contour++;
    if(a.slice(0,2).every((e,i)=>e.notes[0]===b[i].notes[0]))exact++;
    if(a.at(-1)!.notes[0]!==b.at(-1)!.notes[0])tails++;
  }
  assert.ok(rhythm>=pairs*.9&&oldRhythm<oldPairs*.6,`answers in the statement's rhythm ${rhythm}/${pairs} (v31 ${oldRhythm}/${oldPairs})`);
  assert.ok(contour>=pairs*.65,`answers with the statement's opening contour ${contour}/${pairs}`);
  assert.ok(exact>=pairs*.4,`answers that open on the statement's notes ${exact}/${pairs}`);
  assert.ok(tails>=pairs*.7,`answers with a new last note ${tails}/${pairs}`);
});

test('one breath over the last four bars: a peak in the second half, and a closing note that moves',()=>{
  for(const mode of modes){
    let phrases=0,late=0,can=0,closed=0,open=0,openTonic=0,rested=0;
    const landings=new Map<number,number>();
    for(const seed of SEEDS)for(let start=0;start<256;start+=8){
      const s=make(mode,{seed}),lead=leadOf(s,start);
      if(lead.length<2)continue;
      phrases++;
      const top=Math.max(...lead.map(e=>e.notes[0]));
      if(lead.find(e=>e.notes[0]===top)!.at>=start+4)late++;
      const close=lead.at(-1)!,step=stepOf(close,start+6);
      landings.set(step,(landings.get(step)??0)+1);
      const tonic=pc(close.notes[0]-tonicPc(s))===0;
      // The closing note is always a chord tone, so the form can only close where the last chord holds the tonic.
      const chord=chordAt(s,Math.floor(close.at)),offered=(chord.tones??chord.notes).some(t=>pc(t-tonicPc(s))===0);
      if(arrangementAt(s,start+8).localBar!==0){open++;if(tonic)openTonic++;}else if(offered){can++;if(tonic)closed++;}
      if((start+8-close.at-close.length)*4>=.95)rested++;
      assert.ok(lead.every(e=>e.length<=close.length+1e-9)||close.length>=.3,'the closing note is long');
    }
    assert.ok(late>=phrases*.7,`${mode}: peak in bars five to eight ${late}/${phrases}`);
    // v31 always landed on the third beat of bar eight (step 24).
    for(const step of [14,16,24])assert.ok((landings.get(step)??0)>=phrases*.08,`${mode}: closing notes on step ${step}: ${landings.get(step)??0}/${phrases}`);
    assert.ok([...landings.keys()].every(step=>[14,16,24].includes(step)),`${mode}: landings ${[...landings.keys()]}`);
    assert.ok((landings.get(24)??0)<phrases*.5);
    assert.ok(rested>=phrases*.5,`${mode}: a rest after the closing note ${rested}/${phrases}`);
    // Only the sentence that ends the form may settle on the tonic; the others stay open.
    // (Not always: when the tonic sits at the height of the peak, the line closes on the fifth below instead.)
    assert.ok(closed>=can*.6,`${mode}: form endings on the tonic ${closed}/${can}`);
    assert.ok(openTonic<=open*.15,`${mode}: open endings on the tonic ${openTonic}/${open}`);
  }
});

test('performance: dynamics that follow the bar and the phrase, lo-fi lying back, slurred steps',()=>{
  for(const mode of modes){
    let phrases=0,shaped=0,peakLoud=0,levels=0;
    for(const seed of SEEDS)for(let start=8;start<72;start+=8){
      const s=make(mode,{seed}),seconds=240/s.bpm,lead=leadOf(s,start);
      if(lead.length<4)continue;
      phrases++;
      const velocities=lead.map(e=>e.velocity!);
      levels+=new Set(velocities).size;
      const top=Math.max(...lead.filter(e=>e.at>=start+4).map(e=>e.notes[0])),peak=lead.find(e=>e.at>=start+4&&e.notes[0]===top)!,close=lead.at(-1)!;
      if(peak.velocity!>close.velocity!)peakLoud++;
      if(peak.gain>=Math.max(...lead.map(e=>e.gain))*.85&&close.gain<peak.gain)shaped++;
      for(const e of score(s,start).filter(e=>e.layer==='motif')){
        const bar=Math.floor(e.at),late=(e.at-gridTime(s,bar,stepOf(e,bar)))*seconds*1000;
        if(mode==='lofi')assert.ok(late>=9.9&&late<=25.1,`the lo-fi lead lies ${late.toFixed(1)} ms behind the grid`);
        else assert.ok(Math.abs(late)<1e-6,`${mode} stays on the grid`);
      }
    }
    assert.ok(levels/phrases>=(mode==='lofi'||mode==='dub'?6:3),`${mode}: ${(levels/phrases).toFixed(1)} velocity levels per sentence`);
    assert.ok(peakLoud>=phrases*.8,`${mode}: the peak is louder than the close ${peakLoud}/${phrases}`);
    if(mode!=='dub')assert.ok(shaped>=phrases*.7,`${mode}: the sentence grows into its peak ${shaped}/${phrases}`);
  }
  // v31 leads carried no velocity; the instrument guessed it from the gain.
  assert.ok(leadOf(make('lofi',{generatorVersion:31}),8).every(e=>e.velocity===undefined));
});

test('moods keep their character: house riffs repeat, liquid lines sustain, sparse moods stay sparse',()=>{
  let riffs=0,checked=0,longLiquid=0;
  const rhythm=(events:MusicEvent[],from:number)=>events.filter(e=>e.at>=from&&e.at<from+2).map(e=>stepOf(e,from)).join();
  const perBar=(mode:Mode,version:31|32)=>{
    let notes=0,bars=0;
    for(const seed of SEEDS)for(let start=0;start<128;start+=8){const lead=leadOf(make(mode,{seed,generatorVersion:version}),start);if(lead.length){notes+=lead.length;bars+=8;}}
    return notes/bars;
  };
  for(const seed of SEEDS){
    const house=make('dub',{seed,energy:60});
    for(const start of [8,40]){
      const lead=leadOf(house,start),first=rhythm(lead,start),second=rhythm(lead,start+2);
      if(first){checked++;if(first===second&&rhythm(lead,start).split(',').length>=4)riffs++;}
    }
    if(score(make('dnb',{seed,energy:60}),8,24).some(e=>e.layer==='motif'&&e.length>.7))longLiquid++;
  }
  assert.ok(riffs>=checked*.9,`house riffs repeat (${riffs}/${checked})`);
  assert.ok(longLiquid>=SEEDS.length*.75,`liquid lines sustain (${longLiquid}/${SEEDS.length})`);
  // The new grammar is no busier than the old lead.
  for(const mode of modes){
    const now=perBar(mode,32),old=perBar(mode,31);
    assert.ok(now<=old*1.2&&now>=old*.8,`${mode}: ${now.toFixed(2)} notes per bar (v31 ${old.toFixed(2)})`);
  }
});

test('the repetition control still orders how often a hook returns',()=>{
  for(const mode of modes){
    const s=make(mode,{seed:'BREATH'});
    const hooks=(x:Settings)=>{
      const set=new Set<string>();
      for(let start=8;start<512;start+=8){const hook=leadOf(x,start).filter(e=>e.at<start+2);if(hook.length)set.add(hook.map(e=>stepOf(e,start)+':'+(e.notes[0]-hook[0].notes[0])).join());}
      return set.size;
    };
    const [off,low,normal,high]=([0,1,2,3] as const).map(level=>hooks({...s,melodyRepetition:level}));
    assert.ok(Math.min(off,low)>normal&&normal>high,`${mode} ${off}/${low}/${normal}/${high}`);
    assert.ok(score(s,0,4).some(e=>e.layer==='motif'),'the lead starts with the intro');
    const open=mode==='ambient'?32:16;
    assert.equal(score(s,open,8).filter(e=>e.layer==='motif').length,0,'the breakdown rests for eight bars');
  }
});

test('random access, cache eviction, saved clips and mutes reproduce the v32 score',()=>{
  for(const mode of modes){
    const s=make(mode,{seed:'REPLAY32',evolution:70}),original=score(s,56);
    for(let bar=512;bar>=0;bar-=8)eventsForBar({...s,seed:`EVICT${bar}`},bar);
    const shuffled=[63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at);
    assert.deepEqual(shuffled,original);
    assert.ok(score({...s,generatorVersion:31},56).length>0); // interleaved old queries share no cache
    assert.deepEqual(score(s,56),original);
    const saved=capturePhrase({settings:s,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
    assert.deepEqual(loaded,saved);
    assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
    assert.ok(saved.events.filter(e=>e.layer==='motif').every(e=>e.velocity!==undefined),'saved clips keep the lead dynamics');
    for(const layer of ['bass','motif','harmony'] as const)
      assert.deepEqual(score({...s,layers:{...s.layers,[layer]:false}},56),original.filter(e=>e.layer!==layer));
  }
});
