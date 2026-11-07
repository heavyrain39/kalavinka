import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {houseV23,sweepHz,OPEN} from '../src/house-v23';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const score=(s:Settings)=>Array.from({length:96},(_,b)=>eventsForBar(s,b));
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('v23 changes no score in any mood; only deep house gets the bus filter',()=>{
  assert.ok(DEFAULTS.generatorVersion>=23);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:23}).generatorVersion,23);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:22}).generatorVersion,22);
  assert.equal(upgradeSettings(make('dub',{generatorVersion:22})).generatorVersion,DEFAULTS.generatorVersion);
  for(const mode of modes)for(const rep of [0,2] as const)for(const seed of ['SLOWFLOW','ZK9Q'])
    assert.equal(sha(score(make(mode,{seed,generatorVersion:23,melodyRepetition:rep}))),sha(score(make(mode,{seed,generatorVersion:22,melodyRepetition:rep}))),`${mode}:${rep}:${seed}`);
  assert.equal(houseV23(make('dub')),true);assert.equal(houseV23(make('dub',{generatorVersion:23})),true);
  for(const s of [make('dub',{generatorVersion:22}),make('dnb'),make('lofi'),make('ambient')])assert.equal(houseV23(s),false);
});

test('the filter arc works where the warm house voices live (below ~600 Hz)',()=>{
  const s=make('dub',{generatorVersion:30}),arc=Array.from({length:32},(_,b)=>sweepHz(s,b));
  assert.deepEqual(Array.from({length:32},(_,b)=>sweepHz(s,b+32)),arc);
  for(let b=0;b<7;b++)assert.ok(arc[b+1]>arc[b],`intro ${b}`);
  assert.ok(arc[0]<=200&&arc[6]<=600,'the intro stays muffled until its last bars');
  for(let b=8;b<16;b++)assert.equal(arc[b],OPEN);
  for(let b=16;b<20;b++)assert.ok(arc[b]<=300);
  for(let b=19;b<23;b++)assert.ok(arc[b+1]>arc[b],`build ${b}`);
  for(let b=24;b<30;b++)assert.equal(arc[b],OPEN);
  assert.ok(arc[30]<OPEN&&arc[31]<arc[30]&&arc[31]>arc[0]);
  assert.ok(Math.min(...arc)>=150,'never so low that the chords vanish into the bass');
});
