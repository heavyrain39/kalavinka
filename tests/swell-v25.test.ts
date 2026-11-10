import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {fillPlanV17} from '../src/fills-v17';
import {capturePhrase,normalizePhrase} from '../src/saved-phrase';
import {swellV25,SWELL} from '../src/swell-v25';
const modes=['lofi','ambient','dub','dnb'] as const;
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  // Pinned to v25: later generators (the v32 lead) have their own suites.
  return {...base,generatorVersion:25,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=96)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));

test('v25 only adds to deep house; lo-fi, ambient and D&B keep the v24 score',()=>{
  assert.ok(DEFAULTS.generatorVersion>=25);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:25}).generatorVersion,25);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:24}).generatorVersion,24);
  assert.equal(upgradeSettings(make('dub',{generatorVersion:24})).generatorVersion,DEFAULTS.generatorVersion);
  for(const mode of ['lofi','ambient','dnb'] as const)for(const rep of [0,2] as const)
    assert.equal(sha(score(make(mode,{generatorVersion:25,melodyRepetition:rep}))),sha(score(make(mode,{generatorVersion:24,melodyRepetition:rep}))),`${mode}:${rep}`);
  assert.equal(swellV25(make('dub')),true);
  for(const s of [make('dub',{generatorVersion:24}),make('dnb'),make('lofi'),make('ambient')])assert.equal(swellV25(s),false);
});

test('a swell ends on the crash that follows a build-up, and nothing else changes',()=>{
  let swells=0,forms=0;
  for(const seed of SEEDS){
    const now={...make('dub'),seed},old={...now,generatorVersion:24 as const};
    const swelled=new Set<number>();
    for(let bar=0;bar<320;bar++){
      const a=eventsForBar(now,bar),b=eventsForBar(old,bar),extra=a.filter(e=>e.reverse);
      assert.deepEqual(a.filter(e=>!e.reverse),b,`${seed}:${bar}`);
      if(!extra.length)continue;
      assert.equal(extra.length,1);const e=extra[0];
      assert.equal(e.voice,'crash');assert.equal(e.at,bar+1-SWELL);assert.equal(e.length,SWELL);
      assert.equal(arrangementAt(now,bar).section,'open');assert.equal(arrangementAt(now,bar+1).section,'return');
      assert.equal(fillPlanV17(now,bar)?.kind,'build');
      const crash=eventsForBar(now,bar+1).find(x=>x.voice==='crash'&&x.at===bar+1&&!x.reverse);
      assert.ok(crash,'lands on a crash');assert.ok(e.gain<crash!.gain);
      swelled.add(Math.floor(bar/32));swells++;
    }
    for(const f of swelled)assert.ok(!swelled.has(f+1),`${seed}: two forms running at ${f}`);
    forms+=10;
  }
  assert.ok(swells/forms>.2&&swells/forms<.5,String(swells/forms));
});

test('saved phrases keep the swell and reject a reversed non-cymbal',()=>{
  const s=make('dub');
  const phrase=capturePhrase({settings:s,opening:false},16);
  const swell=phrase.events.find(e=>e.reverse);
  assert.ok(swell);assert.equal(swell!.at,8-SWELL);
  const back=normalizePhrase(JSON.parse(JSON.stringify(phrase)));
  assert.ok(back);assert.deepEqual(back!.events.filter(e=>e.reverse),[swell]);
  const bad=JSON.parse(JSON.stringify(phrase));bad.events.find((e:{reverse?:boolean})=>e.reverse).voice='snare';
  assert.equal(normalizePhrase(bad),undefined);
});
