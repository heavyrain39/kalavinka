import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {houseV31,sweepHz,resonanceFor,OPEN,OPEN_Q,CLOSED_Q} from '../src/house-v23';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:31,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const score=(s:Settings)=>Array.from({length:64},(_,b)=>eventsForBar(s,b));
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const arc=(s:Settings)=>Array.from({length:32},(_,b)=>sweepHz(s,b));

test('v31 changes no score; only the deep-house filter arc and its resonance',()=>{
  assert.ok(DEFAULTS.generatorVersion>=31);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:31}).generatorVersion,31);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:30}).generatorVersion,30);
  assert.equal(upgradeSettings(make('dub',{generatorVersion:30})).generatorVersion,DEFAULTS.generatorVersion);
  for(const mode of modes)for(const seed of ['SLOWFLOW','ZK9Q'])
    assert.equal(sha(score(make(mode,{seed}))),sha(score(make(mode,{seed,generatorVersion:30}))),`${mode}:${seed}`);
  assert.equal(houseV31(make('dub')),true);
  for(const s of [make('dub',{generatorVersion:30}),make('dnb'),make('lofi'),make('ambient')])assert.equal(houseV31(s),false);
  // v30 songs keep the old arc and the flat filter.
  const old=make('dub',{generatorVersion:30});
  assert.equal(sweepHz(old,16),280);assert.equal(sweepHz(old,0),180);
  for(const hz of [180,280,600,OPEN])assert.equal(resonanceFor(old,hz),OPEN_Q);
});

test('the closed filter keeps the body of the chords and adds resonance as it closes',()=>{
  const s=make('dub'),a=arc(s),old=arc(make('dub',{generatorVersion:30}));
  // Same shape: open and closed in the same bars, rising through the intro and the build-up.
  for(let b=0;b<32;b++)assert.equal(a[b]===OPEN,old[b]===OPEN,`bar ${b}`);
  for(let b=0;b<7;b++)assert.ok(a[b+1]>a[b],`intro ${b}`);
  for(let b=19;b<23;b++)assert.ok(a[b+1]>a[b],`build ${b}`);
  assert.ok(a[30]<OPEN&&a[31]<a[30]);
  // Higher floor: never below the chord body; every closed bar is above its v30 value.
  assert.ok(Math.min(...a)>=350);
  for(let b=16;b<20;b++)assert.ok(a[b]>=500&&a[b]<=650,`breakdown ${b}`);
  for(let b=0;b<32;b++)if(a[b]!==OPEN)assert.ok(a[b]>old[b],`bar ${b}`);
  // Resonance: full when closed, flat when open, never rising as the filter opens.
  assert.equal(resonanceFor(s,OPEN),OPEN_Q);
  assert.equal(resonanceFor(s,550),CLOSED_Q);
  assert.ok(CLOSED_Q<=6,'a gentle peak, not a whistle');
  let last=Infinity;for(const hz of [350,550,700,1000,1600,2400,5000,OPEN]){const q=resonanceFor(s,hz);assert.ok(q<=last&&q>=OPEN_Q&&q<=CLOSED_Q,`${hz}`);last=q;}
});
