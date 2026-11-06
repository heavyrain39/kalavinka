import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {capturePhrase,normalizePhrase} from '../src/saved-phrase';
import {breathV30,breathCurves,breathPeriod,driftPeriod,BREATH_DEPTH,DRIFT_DEPTH,DARKEST} from '../src/ambient-v30';
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:'lofi'|'ambient'|'dub'|'dnb',extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:30,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=64)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));
const strip=(e:MusicEvent)=>{const {breath,...rest}=e;return rest;};

test('v30 only marks the ambient pad voices; every note and every other mood keeps the v29 score',()=>{
  assert.equal(DEFAULTS.generatorVersion,30);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:30}).generatorVersion,30);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:29}).generatorVersion,29);
  assert.equal(upgradeSettings(make('ambient',{generatorVersion:29})).generatorVersion,30);
  for(const mode of ['lofi','dub','dnb'] as const)assert.equal(sha(score(make(mode))),sha(score(make(mode,{generatorVersion:29}))),mode);
  let pads=0;
  for(const seed of SEEDS)for(const harmony of ['h-pad','h-organ','h-felt'] as const){
    const now={...make('ambient'),seed,instruments:{...make('ambient').instruments,harmony}},old={...now,generatorVersion:29 as const},seconds=240/now.bpm;
    const a=score(now).flat(),b=score(old).flat();
    assert.equal(sha(a.map(strip)),sha(b),`${seed}:${harmony}`);
    for(const e of a){
      if(e.breath===undefined)continue;pads++;
      assert.ok(harmony!=='h-felt'&&e.layer==='harmony'&&e.notes.length===1,`${seed}:${harmony}`);
      assert.ok(Math.abs(e.breath-e.at*seconds)<1e-3,'song time at the note');
    }
    if(harmony!=='h-felt')assert.ok(a.filter(e=>e.layer==='harmony').every(e=>e.breath!==undefined),`${seed}:${harmony} every pad voice breathes`);
  }
  assert.ok(pads>1000,`${pads}`);
  assert.equal(breathV30(make('ambient')),true);
  for(const s of [make('ambient',{generatorVersion:29}),make('lofi'),make('dub'),make('dnb')])assert.equal(breathV30(s),false);
});

test('each voice swells, darkens and drifts within bounds, on its own slow cycle',()=>{
  for(let note=36;note<=96;note++){
    assert.ok(breathPeriod(note)>=11&&breathPeriod(note)<=21&&driftPeriod(note)>=17&&driftPeriod(note)<=31);
    const base=((note%3)-1)*.12,c=breathCurves(note,123.4,40,base);
    for(let i=0;i<c.gain.length;i++){
      assert.ok(c.gain[i]>=1-BREATH_DEPTH-1e-6&&c.gain[i]<=1+BREATH_DEPTH+1e-6);
      assert.ok(c.bright[i]>=DARKEST-1e-6&&c.bright[i]<=1+1e-6);
      assert.ok(Math.abs(c.pan[i]-base)<=DRIFT_DEPTH+1e-6);
      // Louder is brighter: the low-pass follows the swell.
      assert.ok(Math.abs((c.gain[i]-1)/BREATH_DEPTH-((c.bright[i]-DARKEST)/(1-DARKEST)*2-1))<1e-5);
    }
    // A whole 40 s spans a real swell and a real drift.
    assert.ok(Math.max(...c.gain)-Math.min(...c.gain)>1.5*BREATH_DEPTH&&Math.max(...c.pan)-Math.min(...c.pan)>DRIFT_DEPTH);
  }
  // Voices of one chord move on different cycles.
  assert.equal(new Set([58,60,61,68].map(n=>breathPeriod(n).toFixed(2))).size,4);
});

test('the cycle runs on song time, so a re-struck note carries on where it was',()=>{
  const first=breathCurves(61,30,10,0),again=breathCurves(61,37.5,2.5,0);
  // 8 points per second: 37.5 s is point 60 of the first curve.
  for(let i=0;i<again.gain.length;i+=4){
    const t=37.5+2.5*i/(again.gain.length-1),j=Math.round((t-30)*(first.gain.length-1)/10);
    assert.ok(Math.abs(first.gain[j]-again.gain[i])<.02&&Math.abs(first.pan[j]-again.pan[i])<.02,`${t}`);
  }
});

test('saved phrases keep the pad breath and reject it elsewhere',()=>{
  const s=make('ambient',{instruments:{...make('ambient').instruments,harmony:'h-pad'}});
  const phrase=capturePhrase({settings:s,opening:false},16);
  const pads=phrase.events.filter(e=>e.breath!==undefined);
  assert.ok(pads.length);
  const back=normalizePhrase(JSON.parse(JSON.stringify(phrase)));
  assert.ok(back);assert.deepEqual(back!.events.filter(e=>e.breath!==undefined),pads);
  const bad=JSON.parse(JSON.stringify(phrase));bad.events.find((e:MusicEvent)=>e.breath!==undefined).breath=-1;
  assert.equal(normalizePhrase(bad),undefined);
  const wrong=JSON.parse(JSON.stringify(phrase));wrong.events.find((e:MusicEvent)=>e.layer!=='harmony').breath=1;
  assert.equal(normalizePhrase(wrong),undefined);
});
