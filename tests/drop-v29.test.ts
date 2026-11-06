import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {dropV29,silenceBar,halftimeOn,SILENCE_AT} from '../src/drop-v29';
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:'lofi'|'ambient'|'dub'|'dnb',extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:29,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=96)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));
const drops=(s:Settings,bars:number)=>Array.from({length:bars},(_,b)=>b).filter(b=>arrangementAt(s,b).section==='open'&&arrangementAt(s,b+1).section==='return');
const key=(e:MusicEvent)=>JSON.stringify(e);

test('v29 touches D&B around the drop only; every other mood and bar keeps the v28 score',()=>{
  assert.ok(DEFAULTS.generatorVersion>=29);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:29}).generatorVersion,29);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:28}).generatorVersion,28);
  assert.equal(upgradeSettings(make('dnb',{generatorVersion:28})).generatorVersion,DEFAULTS.generatorVersion);
  for(const mode of ['lofi','ambient','dub'] as const)assert.equal(sha(score(make(mode))),sha(score(make(mode,{generatorVersion:28}))),mode);
  for(const seed of SEEDS){
    const now={...make('dnb'),seed},old={...now,generatorVersion:28 as const};
    for(let bar=0;bar<160;bar++){
      if(halftimeOn(now,bar)||silenceBar(now,bar)||silenceBar(now,bar+1))continue;
      assert.equal(sha(eventsForBar(now,bar)),sha(eventsForBar(old,bar)),`${seed}:${bar}`);
    }
  }
  assert.equal(dropV29(make('dnb')),true);
  for(const s of [make('dnb',{generatorVersion:28}),make('lofi'),make('ambient'),make('dub')])assert.equal(dropV29(s),false);
});

test('the halftime build adds a kick on one and a snare on three, rising into the drop',()=>{
  let bars=0;
  for(const seed of SEEDS){
    const now={...make('dnb'),seed},old={...now,generatorVersion:28 as const};
    for(let bar=0;bar<160;bar++){
      if(!halftimeOn(now,bar))continue;bars++;
      const a=arrangementAt(now,bar);assert.ok(a.section==='open'&&!a.beatless,`${seed}:${bar}`);
      // In a silence bar the fill moved up to beat three is not part of the halftime beat.
      const before=eventsForBar(old,bar),moved=(e:MusicEvent)=>silenceBar(now,bar)&&e.at>bar+.5+1e-9&&(e.voice==='snare'||e.voice==='tom');
      const after=eventsForBar(now,bar).filter(e=>!moved(e));
      const added=after.filter(e=>!before.some(b=>key(b)===key(e)));
      assert.deepEqual(added.map(e=>[e.voice,+(e.at-bar).toFixed(6)]).sort(),[['kick',0],['snare',.5]],`${seed}:${bar}`);
      const groove=eventsForBar(now,bar-bar%8+10),kick=groove.find(e=>e.voice==='kick')!;
      assert.ok(added.every(e=>e.layer==='rhythm')&&added.find(e=>e.voice==='kick')!.gain<kick.gain,'softer than the drop');
      if(halftimeOn(now,bar+1))assert.ok(eventsForBar(now,bar+1).find(e=>e.voice==='kick'&&e.at===bar+1)!.gain>added.find(e=>e.voice==='kick')!.gain,'rising');
    }
  }
  assert.ok(bars>40,`${bars}`);
});

test('the pre-drop silence: the fill moves up a beat, nothing sounds on the last beat, the drop comes in',()=>{
  let n=0;
  for(const seed of SEEDS){
    const now={...make('dnb'),seed},old={...now,generatorVersion:28 as const};
    for(const bar of drops(now,160)){
      if(!silenceBar(now,bar))continue;n++;
      const edge=bar+SILENCE_AT,ev=[...eventsForBar(now,bar-1),...eventsForBar(now,bar)];
      for(const e of ev){
        assert.ok(e.at<edge-1e-9,`${seed}:${bar} starts in the silence`);
        if(e.layer!=='rhythm')assert.ok(e.at+e.length<=edge+1e-9,`${seed}:${bar} ${e.layer} rings into the silence`);
      }
      const fill=eventsForBar(old,bar).filter(e=>(e.voice==='snare'||e.voice==='tom')&&e.at>=edge-1e-9);
      const moved=eventsForBar(now,bar).filter(e=>(e.voice==='snare'||e.voice==='tom')&&e.at>=edge-.25-1e-9);
      // A halftime bar has no fill (fills end the halftime run); its snare on three stays.
      if(halftimeOn(now,bar))assert.equal(fill.length,0);
      assert.deepEqual(moved.map(e=>+(e.at+.25).toFixed(6)),halftimeOn(now,bar)?[bar+.75]:fill.map(e=>+e.at.toFixed(6)),`${seed}:${bar} fill on beat three`);
      assert.equal(sha(eventsForBar(now,bar+1)),sha(eventsForBar(old,bar+1)),'the drop itself is unchanged');
    }
  }
  assert.ok(n>12,`${n}`);
});

test('both gestures stay occasional and follow the energy',()=>{
  let forms=0,silent=0,half=0;
  for(const seed of SEEDS){
    const s={...make('dnb'),seed},ds=drops(s,640);
    ds.forEach((bar,i)=>{forms++;const sil=silenceBar(s,bar);if(sil)silent++;if(halftimeOn(s,bar-1))half++;
      if(i&&sil)assert.ok(!silenceBar(s,ds[i-1]),`${seed}: silence in two forms running`);});
    for(const bar of ds){
      assert.equal(silenceBar({...s,energy:20},bar),false);
      for(let b=bar-7;b<=bar;b++)assert.equal(halftimeOn({...s,energy:30},b),false);
    }
  }
  assert.ok(silent/forms>.25&&silent/forms<.6,`silence ${silent}/${forms}`);
  assert.ok(half/forms>.3&&half/forms<.6,`halftime ${half}/${forms}`);
});
