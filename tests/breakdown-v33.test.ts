import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {breakdownV33,breakdownPlan,breakdownAt,changeChance,type Breakdown} from '../src/breakdown-v33';
import {halftimeOn,silenceBar,SILENCE_AT} from '../src/drop-v29';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const, drummed=['lofi','dub','dnb'] as const;
type Mode=typeof modes[number];
const SEEDS=['SLOWFLOW','AB12CD','PULSE2','ZK9Q','MOON77','RAIN3','DESK01','NIGHT8','Q1W2E3','TT55','LOFI99','XYZW'];
// Pinned to v33: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:33,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const old=(s:Settings):Settings=>({...s,generatorVersion:32});
const drums=(s:Settings,bar:number)=>eventsForBar(s,bar).filter(e=>e.layer==='rhythm');
const played=(s:Settings,bar:number,voice:MusicEvent['voice'])=>drums(s,bar).filter(e=>e.voice===voice&&e.fill===undefined&&!e.ghost);
const step=(e:MusicEvent,bar:number)=>Math.floor((e.at-bar)*16+.2);
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
const FORMS=6;
/** Every breakdown of the first forms: its eight bars and its plan. */
const breakdowns=(s:Settings)=>Array.from({length:FORMS},(_,form)=>({form,start:form*32+16,plan:breakdownPlan(s,form)}));

test('v32 favorites keep exact scores; v33 changes the drums of some breakdowns and nothing else',()=>{
  // Recorded from v32 before v33 existed: 96 bars × four moods × repetition off/normal.
  const hashes:Record<string,string>={
    'lofi:0':'c7341d8454b256621be82a8a30c7356f05dedde4f892737a8ec83cfb556a6a09','lofi:2':'c6fd39bd1ceb83711bebcac06a316bf11dd69d5f0bd80c07ada70beedf02dbc9',
    'ambient:0':'4bcb9b26b327b376648847581a8113f59e746ff10086a4917ecc2911393c1667','ambient:2':'40d85c6f1dfdb09ea49c131c6cdcf5a55b0a3f5240362a322bac4bf064f1fe0c',
    'dub:0':'0dbc195d58882979d6ce752c61e430f3ed1d152cfeb6b225c30bf9db70c61e26','dub:2':'8ffae2855fc2c0a30d9ec8883449e522d0ed3c5cd7ef0d8db334962be7b6cf86',
    'dnb:0':'e9a543c71f08b4d2e49efeee81566c88548100248190ef71e07aded96f5ffb09','dnb:2':'12a32760dcb2c59373c85ee5e4acb6a02f6aa1be98ff11129ec6b9aa4acc1abc'};
  for(const mode of modes)for(const rep of [0,2] as const){
    const before=make(mode,{generatorVersion:32,melodyRepetition:rep});
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(before,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(normalizeSettings(before).generatorVersion,32);
    assert.equal(upgradeSettings(before).generatorVersion,DEFAULTS.generatorVersion);
    assert.equal(breakdownV33(before),false);assert.equal(breakdownAt(before,18),null);
  }
  assert.ok(DEFAULTS.generatorVersion>=33);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:33}).generatorVersion,33);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:999 as never}).generatorVersion,DEFAULTS.generatorVersion);
  // Ambient has no drums: its score is the v32 score.
  assert.equal(breakdownV33(make('ambient')),false);
  assert.equal(sha(Array.from({length:128},(_,b)=>eventsForBar(make('ambient'),b))),sha(Array.from({length:128},(_,b)=>eventsForBar(old(make('ambient')),b))));
  for(const mode of drummed)for(const seed of SEEDS){
    const s=make(mode,{seed});
    for(let bar=0;bar<FORMS*32;bar++){
      const now=eventsForBar(s,bar),was=eventsForBar(old(s),bar),plan=breakdownAt(s,bar),at=`${mode} ${seed}:${bar}`;
      assert.equal(plan!==null,arrangementAt(s,bar).section==='open',at);
      // Outside a breakdown, and in an empty one, the bar is the v32 bar.
      if(!plan||plan.kind==='empty'){assert.deepEqual(now,was,at);continue;}
      // Inside one only the drums differ, and of those never a fill, a crash or a ghost note.
      const keep=(e:MusicEvent)=>e.layer!=='rhythm'||e.fill!==undefined||e.ghost||!['hat','kick','snare'].includes(e.voice);
      assert.deepEqual(now.filter(keep),was.filter(keep),at);
    }
  }
});

test('the three breakdowns are shared out: empty, hats only, and a light halftime',()=>{
  for(const mode of drummed){
    const count:Record<Breakdown,number>={empty:0,hats:0,light:0},first:Record<Breakdown,number>={empty:0,hats:0,light:0};
    for(let n=0;n<240;n++){
      const s=make(mode,{seed:`SHARE${n}`});
      first[breakdownPlan(s,0).kind]++;
      for(let form=0;form<8;form++)count[breakdownPlan(s,form).kind]++;
    }
    const total=240*8;
    for(const kind of ['empty','hats','light'] as const){
      assert.ok(count[kind]/total>.15&&count[kind]/total<.5,`${mode} ${kind}: ${count[kind]}/${total}`);
      assert.ok(first[kind]/240>.1,`${mode} first ${kind}: ${first[kind]}`);
    }
    // A light breakdown is the rarest: it is the furthest from the silence the form asks for.
    assert.ok(count.light<count.empty&&count.light<count.hats,`${mode}: ${JSON.stringify(count)}`);
  }
});

test('hats only: offbeat hats tick through the breakdown, soft and rising, with no kick or snare',()=>{
  for(const mode of drummed){
    let seen=0,entries=new Set<number>();
    for(const seed of SEEDS){
      const s=make(mode,{seed});
      for(const {start,plan} of breakdowns(s)){
        if(plan.kind!=='hats')continue;seen++;
        const entry=Array.from({length:8},(_,i)=>i).find(i=>sha(drums(s,start+i))!==sha(drums(old(s),start+i)))!;
        assert.ok(entry<=2,`${mode} ${seed}:${start} enters in bar ${entry+1}`);entries.add(entry);
        const groove=mean(played(s,start+10,'hat').concat(played(s,start+11,'hat')).map(e=>e.velocity!)),levels:number[]=[];
        for(let i=0;i<8;i++){
          const bar=start+i,at=`${mode} ${seed}:${bar}`,hats=played(s,bar,'hat');
          // The halftime beat of the D&B build belongs to v29 and is left as it was.
          for(const voice of ['kick','snare'] as const)assert.deepEqual(played(s,bar,voice),played(old(s),bar,voice),`${at} ${voice}`);
          if(i<entry){assert.deepEqual(drums(s,bar),drums(old(s),bar),at);continue;}
          const fill=drums(s,bar).some(e=>e.fill!==undefined);
          // A pre-drop silence (v29) takes the last beat of its bar.
          if(!fill&&!silenceBar(s,bar))assert.equal(hats.length,mode==='dnb'?8:4,`${at}: ${hats.map(e=>step(e,bar))}`);
          else assert.ok(hats.length>=1,at);
          if(mode==='dnb')assert.ok(hats.every(e=>step(e,bar)%2===0),`${at}: eighths`);
          else assert.ok(hats.every(e=>step(e,bar)%4===2),`${at}: offbeats ${hats.map(e=>step(e,bar))}`);
          if(i<4)assert.ok(hats.every(e=>e.articulation==='closed'),`${at}: closed before the build`);
          assert.ok(hats.every(e=>e.gain>0&&e.velocity!>=.2&&e.velocity!<=1&&e.notes.length===0),at);
          if(!fill)levels.push(mean(hats.map(e=>e.velocity!)));
        }
        for(let k=1;k<levels.length;k++)assert.ok(levels[k]>levels[k-1]-.03,`${mode} ${seed}:${start} rises: ${levels.map(v=>v.toFixed(2))}`);
        assert.ok(levels[0]<levels.at(-1)!-.1,`${mode} ${seed}:${start}: ${levels.map(v=>v.toFixed(2))}`);
        if(mode==='dnb')assert.ok(levels[0]<groove*1.05,`${mode} ${seed}:${start} starts no louder than the groove's hats`);
      }
    }
    assert.ok(seen>=8,`${mode}: ${seen} hats breakdowns`);
    assert.ok(entries.size>=2,`${mode}: entries ${[...entries]}`);
  }
});

test('light: the hats plus a soft kick on one and a soft snare on three, under the groove and rising',()=>{
  for(const mode of drummed){
    let seen=0;
    for(const seed of SEEDS){
      const s=make(mode,{seed});
      for(const {start,plan} of breakdowns(s)){
        if(plan.kind!=='light')continue;seen++;
        const kicks:number[]=[],snares:number[]=[];
        for(let i=0;i<8;i++){
          // The groove bar this one is voiced from: two bars into the return, same half of the pattern.
          const kick=played(s,start+10+i%2,'kick')[0],snare=played(s,start+10+i%2,'snare')[0];
          const bar=start+i,at=`${mode} ${seed}:${bar}`,fill=drums(s,bar).some(e=>e.fill!==undefined);
          const k=played(s,bar,'kick'),sn=played(s,bar,'snare');
          assert.ok(played(s,bar,'hat').length>=(fill?1:4),`${at}: hats from the first bar`);
          if(halftimeOn(s,bar)){assert.deepEqual(k,played(old(s),bar,'kick'),at);assert.deepEqual(sn,played(old(s),bar,'snare'),at);continue;}
          assert.deepEqual(k.map(e=>+(e.at-bar).toFixed(6)),i>=1?[0]:[],`${at} kick`);
          assert.deepEqual(sn.map(e=>+(e.at-bar).toFixed(6)),i>=2&&!fill?[.5]:[],`${at} snare`);
          for(const e of k){assert.ok(e.gain<kick.gain*.85&&e.velocity!<kick.velocity!,`${at}: softer than the groove's kick`);assert.ok((e.duck??0)<=(kick.duck??0)*.81,`${at}: a lighter duck`);kicks.push(e.gain);}
          for(const e of sn){assert.ok(e.gain<snare.gain*.85,`${at}: softer than the groove's snare`);snares.push(e.gain);}
        }
        // Rising within a tenth (the groove's own kicks differ a little from bar to bar).
        for(const line of [kicks,snares])for(let n=1;n<line.length;n++)assert.ok(line[n]>line[n-1]*.9,`${mode} ${seed}:${start}: ${line.map(v=>v.toFixed(3))}`);
        if(kicks.length>3)assert.ok(kicks.at(-1)!>kicks[0]*1.15,`${mode} ${seed}:${start}`);
      }
    }
    assert.ok(seen>=5,`${mode}: ${seen} light breakdowns`);
  }
});

test('the fill, the pre-drop silence and the drop stay as they were',()=>{
  let fills=0,silences=0;
  for(const mode of drummed)for(const seed of SEEDS){
    const s=make(mode,{seed});
    for(const {start,plan} of breakdowns(s)){
      if(plan.kind==='empty')continue;
      for(let i=0;i<8;i++){
        const bar=start+i,now=drums(s,bar),fill=now.filter(e=>e.fill!==undefined);
        assert.deepEqual(fill,drums(old(s),bar).filter(e=>e.fill!==undefined),`${mode} ${seed}:${bar}`);
        if(fill.length){fills++;assert.ok(now.every(e=>e.fill!==undefined||e.voice==='crash'||e.at<fill[0].at-.005),`${mode} ${seed}:${bar}: nothing plays under the fill`);}
        if(silenceBar(s,bar)){silences++;assert.ok(eventsForBar(s,bar).every(e=>e.at<bar+SILENCE_AT-1e-9),`${mode} ${seed}:${bar}: silence`);}
      }
      assert.deepEqual(eventsForBar(s,start+8),eventsForBar(old(s),start+8),`${mode} ${seed}: the drop`);
    }
  }
  assert.ok(fills>40&&silences>3,`${fills} fills, ${silences} silences`);
});

test('Variation sets how often the breakdown changes; a run of the same breakdown repeats exactly',()=>{
  const rate=(evolution:number)=>{
    let changes=0,total=0;
    for(let n=0;n<200;n++){
      const s=make('lofi',{seed:`TURN${n}`,evolution});
      for(let form=1;form<8;form++){total++;if(breakdownPlan(s,form).kind!==breakdownPlan(s,form-1).kind)changes++;}
    }
    return changes/total;
  };
  assert.equal(rate(0),0);
  assert.equal(changeChance(make('lofi',{evolution:0})),0);
  assert.ok(rate(20)>.2&&rate(20)<.45,`${rate(20)}`);
  assert.ok(rate(35)>.45&&rate(35)<.68,`${rate(35)}`);
  assert.ok(rate(100)>rate(35)&&rate(100)<=.95,`${rate(100)}`);
  for(const mode of drummed)for(const seed of SEEDS){
    const s=make(mode,{seed});
    for(let form=1;form<8;form++){
      const now=breakdownPlan(s,form),before=breakdownPlan(s,form-1);
      // A new draw always lands on another breakdown; an unchanged one is the same plan.
      if(now.since===form)assert.notEqual(now.kind,before.kind,`${mode} ${seed}:${form}`);else assert.deepEqual(now,before);
    }
    // With Variation at 0 every form plays the song's one breakdown, drum for drum.
    // The fill and D&B's halftime build and pre-drop silence are v17's and v29's own draws per
    // form: bars with a fill are left out, and in D&B the hats of the first seven bars are compared.
    const still={...s,evolution:0},mine=(e:MusicEvent)=>!e.ghost&&(mode==='dnb'?e.voice==='hat':['hat','kick','snare'].includes(e.voice));
    const filled=(bar:number)=>drums(still,bar).some(e=>e.fill!==undefined);
    const line=(form:number,i:number)=>drums(still,form*32+16+i).filter(mine),shape=(list:MusicEvent[])=>list.map(e=>[e.voice,+e.gain.toFixed(6),e.velocity,e.articulation]);
    for(let form=1;form<4;form++)for(let i=0;i<(mode==='dnb'?7:8);i++){
      if(filled(16+i)||filled(form*32+16+i))continue;
      const first=line(0,i),again=line(form,i),at=`${mode} ${seed}: form ${form}, bar ${i}`;
      assert.deepEqual(shape(again),shape(first),at);
      assert.ok(again.every((e,k)=>Math.abs(e.at-form*32-first[k].at)<1e-6),at);
    }
  }
});

test('low energy stays quiet: two hats a bar under 35, nothing new under 15',()=>{
  for(const mode of ['lofi','dub'] as const)for(const seed of SEEDS){
    const hush=make(mode,{seed,energy:10});
    for(let bar=0;bar<96;bar++)assert.deepEqual(eventsForBar(hush,bar),eventsForBar(old(hush),bar),`${mode} ${seed}:${bar}`);
    const low=make(mode,{seed,energy:25});
    for(const {start,plan} of breakdowns(low)){
      if(plan.kind==='empty')continue;
      for(let i=3;i<7;i++)assert.deepEqual(played(low,start+i,'hat').map(e=>step(e,start+i)),[6,14],`${mode} ${seed}:${start+i}`);
    }
  }
});

test('random access, saved clips and the rhythm mute reproduce the v33 breakdown',()=>{
  for(const mode of drummed){
    const seed=SEEDS.find(x=>breakdownPlan(make(mode,{seed:x}),0).kind==='light')!,s=make(mode,{seed});
    const bars=(from:number)=>Array.from({length:8},(_,i)=>eventsForBar(s,from+i)).flat().sort((a,b)=>a.at-b.at),original=bars(16);
    for(let bar=512;bar>=0;bar-=8)eventsForBar({...s,seed:`EVICT${bar}`},bar);
    assert.deepEqual([23,17,21,16,22,19,18,20].flatMap(b=>eventsForBar(s,b)).sort((a,b)=>a.at-b.at),original);
    assert.ok(eventsForBar(old(s),18).length>0); // interleaved old queries share no cache
    assert.deepEqual(bars(16),original);
    const saved=capturePhrase({settings:s,opening:true},16),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
    assert.deepEqual(loaded,saved);
    assert.deepEqual(playbackScore({settings:s,phrase:loaded,opening:true}).onsets(0,8),saved.events);
    assert.ok(saved.events.some(e=>e.voice==='kick'),'the saved clip keeps the light breakdown');
    const muted={...s,layers:{...s.layers,rhythm:false}};
    assert.deepEqual(Array.from({length:8},(_,i)=>eventsForBar(muted,16+i)).flat().sort((a,b)=>a.at-b.at),original.filter(e=>e.layer!=='rhythm'));
  }
});
