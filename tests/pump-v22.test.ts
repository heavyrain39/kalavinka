import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {pumpEnabled,pumpDepth} from '../src/duck';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(s:Settings)=>createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(s,b)))).digest('hex');

test('v22 changes the deep-house sound only: scores equal v21; the pump is house-only',()=>{
  assert.equal(DEFAULTS.generatorVersion,22);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:22}).generatorVersion,22);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:21}).generatorVersion,21);
  assert.equal(upgradeSettings(make('dub',{generatorVersion:21})).generatorVersion,22);
  for(const mode of modes)for(const rep of [0,2] as const)
    assert.equal(sha(make(mode,{melodyRepetition:rep})),sha(make(mode,{generatorVersion:21,melodyRepetition:rep})),`${mode}:${rep}`);
  assert.equal(pumpEnabled(make('dub')),true);
  assert.equal(pumpEnabled(make('dub',{generatorVersion:21})),false);
  for(const mode of ['lofi','ambient','dnb'] as const)assert.equal(pumpEnabled(make(mode)),false);
});

test('the pump follows the written kick duck and stays moderate',()=>{
  const s=make('dub'),ducks=new Set<number>();
  for(let bar=0;bar<32;bar++)for(const e of eventsForBar(s,bar))if(e.voice==='kick'&&e.duck)ducks.add(e.duck);
  assert.deepEqual([...ducks].sort(),[.25,.48]);
  // Groove kicks: about -3.9 dB; intro kicks lighter (-1.8 dB); never deeper than -4.2 dB.
  assert.ok(Math.abs(20*Math.log10(1-pumpDepth(.48))+3.88)<.02);
  assert.ok(pumpDepth(.25)<pumpDepth(.48));
  assert.equal(pumpDepth(0),0);assert.ok(pumpDepth(1)<=.38);
});
