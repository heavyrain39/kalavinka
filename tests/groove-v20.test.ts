import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {gridTime,gridShift,onGrid} from '../src/timing';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:78,...extra};
};
const sha=(s:Settings)=>createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(s,b)))).digest('hex');

test('v19 favorites keep exact scores; new music and upgrades use the current generator',()=>{
  // Recorded from v19 before v20 changed the lo-fi grid.
  const v19:Record<string,string>={'lofi:0':'7a4411b27b4d976498e777087980baeb292e2db3d47928be6dc35ced9a61f954','lofi:2':'2016a3fc3c240c203956960375f796ff8b277659bfabc065bbaa788542f3d291','ambient:0':'d837c0156648b973a9e7d7d1da4643b8faf16b72a0b6f5e01144975be9f23b2f','ambient:2':'4cf8d42e1c2097f8bb947bffc14d88eb7a84435e0e504df89be5f805c3c85bed','dub:0':'31ef23881515cdbbb4eb271b3be0390db9b2609179ddadaf1b6dd17876fc9484','dub:2':'e7255a959d4725ec0ecaad23026db59e2ec3f2bbaaeeb8e1ea30a057d6d942ce','dnb:0':'a23414c7bf1047cd2f2f53ab0026ef6a8094ee695adeab1390fbc25f789a4487','dnb:2':'7c402bde114ccde949271ac56a594bf8b1eadb42f0d5da95473ff4eaf0341c55'};
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:19,melodyRepetition:rep});
    assert.equal(sha(old),v19[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(normalizeSettings(old).generatorVersion,19);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
  }
  assert.ok(DEFAULTS.generatorVersion>=20);
  assert.equal(normalizeSettings(null).generatorVersion,DEFAULTS.generatorVersion);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:20}).generatorVersion,20);
});

test('v20 lo-fi: one swung grid, the off-sixteenths at half the offbeat delay, no added randomness',()=>{
  for(const seed of ['SLOWFLOW','AB12CD','DESK01','LOFI99','MOON77']){
    const s={...make('lofi'),seed};
    const swing=gridTime(s,0,2)-2/16;
    assert.ok(swing>=.010-1e-9&&swing<=.018+1e-9);
    assert.ok(Math.abs(gridTime(s,0,1)-1/16-swing/2)<1e-12&&Math.abs(gridTime(s,0,3)-3/16-swing/2)<1e-12);
    assert.equal(gridTime(s,0,4),4/16);
    // Every sixteenth gap stays within one swing of the straight gap (no crowding before beats).
    const gaps=Array.from({length:16},(_,i)=>gridTime(s,0,i+1)-gridTime(s,0,i));
    assert.ok(Math.max(...gaps)-Math.min(...gaps)<=swing+1e-12);
    // Bass, melody, arpeggio and kick land exactly on that grid; drums keep their small fixed lean.
    for(let bar=8;bar<72;bar++)for(const e of eventsForBar(s,bar)){
      if(!(e.layer==='bass'||e.layer==='motif'||e.layer==='arpeggio'||e.voice==='kick'))continue;
      const b=Math.floor(e.at),step=Math.round((e.at-b)*16);
      assert.ok(Math.abs(e.at-gridTime(s,b,step))<1e-9,`${seed} ${e.layer} at ${e.at}`);
    }
  }
});

test('grid helpers keep pre-v20 offsets and move across bar lines on the swung grid',()=>{
  const old=make('lofi',{generatorVersion:19}),now=make('lofi');
  assert.equal(gridShift(old,gridTime(old,0,2),2),gridTime(old,0,2)+.125);
  assert.equal(onGrid(old,.125),.125);
  assert.equal(onGrid(now,.125),gridTime(now,0,2));
  assert.equal(gridShift(now,gridTime(now,0,14),2),1);
  assert.equal(gridShift(now,1,-2),gridTime(now,0,14));
  assert.equal(onGrid(now,1/3),1/3);
});
