import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {houseV23,houseChordCutoff,houseLeadCutoff,houseArpCutoff,sweepHz,OPEN,HOUSE_CHORD_GAIN} from '../src/house-v23';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const score=(s:Settings)=>Array.from({length:96},(_,b)=>eventsForBar(s,b));
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('v23 touches deep house only; other moods keep the v22 score exactly',()=>{
  assert.equal(DEFAULTS.generatorVersion,23);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:23}).generatorVersion,23);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:22}).generatorVersion,22);
  assert.equal(upgradeSettings(make('dub',{generatorVersion:22})).generatorVersion,23);
  for(const mode of ['lofi','ambient','dnb'] as const)for(const rep of [0,2] as const)
    assert.equal(sha(score(make(mode,{melodyRepetition:rep}))),sha(score(make(mode,{generatorVersion:22,melodyRepetition:rep}))),`${mode}:${rep}`);
  assert.equal(houseV23(make('dub')),true);
  for(const s of [make('dub',{generatorVersion:22}),make('dnb'),make('lofi'),make('ambient')])assert.equal(houseV23(s),false);
});

test('house notes and timing are unchanged; only chord level and part cut-offs move',()=>{
  for(const seed of ['SLOWFLOW','ZK9Q','MOON77']){
    const now=score({...make('dub'),seed}).flat(),old=score({...make('dub',{generatorVersion:22}),seed}).flat();
    const strip=(e:MusicEvent)=>{const {cutoff,gain,...rest}=e;return rest;};
    assert.equal(sha(now.map(strip)),sha(old.map(strip)),seed);
    now.forEach((e,i)=>{
      const o=old[i];
      if(e.layer==='harmony'){assert.ok(Math.abs(e.gain/o.gain-HOUSE_CHORD_GAIN)<1e-9);assert.ok(e.cutoff>o.cutoff);}
      else if(e.layer==='motif'||e.layer==='arpeggio'){assert.equal(e.gain,o.gain);assert.ok(e.cutoff>o.cutoff);}
      else assert.deepEqual(e,o);
    });
  }
  // Warmth still darkens, over a range that reaches a bright stab.
  for(const f of [houseChordCutoff,houseLeadCutoff,houseArpCutoff]){assert.ok(f(0)>f(50)&&f(50)>f(100));assert.ok(f(0)>=5000&&f(100)>=1800);}
  assert.ok(houseChordCutoff(62)>3200+1000);
});

test('the music-bus filter arc: filtered intro, open groove, closed breakdown, build-up, closing tail',()=>{
  const s=make('dub'),arc=Array.from({length:32},(_,b)=>sweepHz(s,b));
  assert.deepEqual(Array.from({length:32},(_,b)=>sweepHz(s,b+32)),arc);
  for(let b=0;b<7;b++)assert.ok(arc[b+1]>arc[b],`intro ${b}`);
  for(let b=8;b<16;b++)assert.equal(arc[b],OPEN);
  for(let b=16;b<20;b++)assert.ok(arc[b]<arc[0]);
  for(let b=19;b<23;b++)assert.ok(arc[b+1]>arc[b],`build ${b}`);
  for(let b=24;b<30;b++)assert.equal(arc[b],OPEN);
  assert.ok(arc[30]<OPEN&&arc[31]<arc[30]&&arc[31]>arc[0]);
  assert.ok(Math.min(...arc)>=800);
});
