import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {tapeStopV24,tapeStopBar,STOP_AT,stopSpeed,stopDelay,stopLevel} from '../src/tapestop-v24';
const modes=['lofi','ambient','dub','dnb'] as const;
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('v24 only touches lo-fi; other moods keep the v23 score',()=>{
  assert.ok(DEFAULTS.generatorVersion>=24);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:24}).generatorVersion,24);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:23}).generatorVersion,23);
  assert.equal(upgradeSettings(make('lofi',{generatorVersion:23})).generatorVersion,DEFAULTS.generatorVersion);
  for(const mode of ['ambient','dub','dnb'] as const)for(const rep of [0,2] as const)
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(make(mode,{generatorVersion:24,melodyRepetition:rep}),b))),
      sha(Array.from({length:96},(_,b)=>eventsForBar(make(mode,{generatorVersion:23,melodyRepetition:rep}),b))),`${mode}:${rep}`);
  assert.equal(tapeStopV24(make('lofi')),true);
  for(const s of [make('lofi',{generatorVersion:23}),make('ambient'),make('dub'),make('dnb')])assert.equal(tapeStopV24(s),false);
});

test('a stop bar keeps every note before beat four and starts nothing inside the stop',()=>{
  for(const seed of SEEDS){
    const now={...make('lofi'),seed},old={...now,generatorVersion:23 as const};
    for(let bar=0;bar<192;bar++){
      const a=eventsForBar(now,bar),b=eventsForBar(old,bar);
      if(!tapeStopBar(now,bar)){assert.deepEqual(a,b,`${seed}:${bar}`);continue;}
      assert.deepEqual(a,b.filter(e=>e.at<bar+STOP_AT-1e-9),`${seed}:${bar}`);
      assert.ok(b.some(e=>e.at>=bar+STOP_AT),'the stop removes something');
    }
  }
});

test('stops come only before the breakdown, rarely, never in two forms running',()=>{
  let stops=0,forms=0;
  for(const seed of SEEDS){
    const s={...make('lofi'),seed};let last=-99;
    for(let bar=0;bar<640;bar++)if(tapeStopBar(s,bar)){
      assert.equal(arrangementAt(s,bar).section,'groove');assert.equal(arrangementAt(s,bar+1).section,'open');
      const form=Math.floor(bar/32);assert.ok(form-last>1,`${seed}:${bar}`);last=form;stops++;
    }
    forms+=20;
    assert.equal(Array.from({length:640},(_,b)=>tapeStopBar({...s,energy:20},b)).some(Boolean),false,'quiet songs never stop');
  }
  assert.ok(stops/forms>.15&&stops/forms<.35,String(stops/forms));
});

test('the stop curve: speed sags to zero, delay is its integral, volume fades out',()=>{
  const n=1000,T=.77;
  for(let i=1;i<=n;i++){
    const u=i/n,p=(i-1)/n;
    assert.ok(stopSpeed(u)<stopSpeed(p));assert.ok(stopLevel(u)<=stopLevel(p));
    const slope=(stopDelay(u,T)-stopDelay(p,T))/(T/n);
    assert.ok(Math.abs(slope-(1-stopSpeed((u+p)/2)))<.01);
  }
  assert.equal(stopSpeed(0),1);assert.ok(Math.abs(stopSpeed(1))<1e-12);
  assert.equal(stopLevel(0),1);assert.equal(stopLevel(.5),1);assert.ok(stopLevel(1)<1e-12);
  // Longest stop (a quarter bar at 60 BPM) still fits the 1 s delay line.
  assert.ok(stopDelay(1,1)+.012<.5);
});
