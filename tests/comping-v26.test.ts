import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,chordAt,type Settings,type MusicEvent} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {interlockV26,LONG,TAIL} from '../src/comping-v26';
const modes=['lofi','ambient','dub','dnb'] as const;
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=96)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));
const step=(e:MusicEvent,bar:number)=>Math.round((e.at-bar)*16);

test('v26 rewrites lo-fi comping only; every other part and mood keeps the v25 score',()=>{
  assert.equal(DEFAULTS.generatorVersion,26);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:26}).generatorVersion,26);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:25}).generatorVersion,25);
  assert.equal(upgradeSettings(make('lofi',{generatorVersion:25})).generatorVersion,26);
  for(const mode of ['ambient','dub','dnb'] as const)for(const rep of [0,2] as const)
    assert.equal(sha(score(make(mode,{melodyRepetition:rep}))),sha(score(make(mode,{generatorVersion:25,melodyRepetition:rep}))),`${mode}:${rep}`);
  for(const seed of SEEDS){
    const now=score({...make('lofi'),seed}).flat(),old=score({...make('lofi',{generatorVersion:25}),seed}).flat();
    assert.equal(sha(now.filter(e=>e.layer!=='harmony')),sha(old.filter(e=>e.layer!=='harmony')),seed);
  }
  assert.equal(interlockV26(make('lofi')),true);
  for(const s of [make('lofi',{generatorVersion:25}),make('ambient'),make('dub'),make('dnb')])assert.equal(interlockV26(s),false);
  // Chords before v26 never carry a release, so older songs keep their key tails.
  for(const mode of modes)assert.ok(score(make(mode,{generatorVersion:25}),32).flat().every(e=>e.layer!=='harmony'||mode==='ambient'||e.release===undefined));
});

test('lo-fi chords are shorter, answer the lead\'s rests and join the bass pickups',()=>{
  const stats={25:{hits:0,long:0,rests:0,answered:0,pickups:0,shared:0},26:{hits:0,long:0,rests:0,answered:0,pickups:0,shared:0}};
  for(const v of [25,26] as const)for(const seed of SEEDS){
    const s={...make('lofi'),seed,generatorVersion:v};
    for(let bar=0;bar<64;bar++){
      const a=arrangementAt(s,bar);if(a.section!=='groove'&&a.section!=='return')continue;
      const ev=eventsForBar(s,bar),st=stats[v],lead=ev.filter(e=>e.layer==='motif');
      const hits=new Map<number,MusicEvent>();for(const e of ev.filter(e=>e.layer==='harmony'))if(!hits.has(step(e,bar)))hits.set(step(e,bar),e);
      const sounding=Array.from({length:16},(_,k)=>lead.some(e=>{const f=(e.at-bar)*16;return f<k+.5&&f+e.length*16>k+.25;}));
      for(const [,e] of hits){st.hits++;if(e.length>=.25)st.long++;
        if(v===26){assert.ok(e.release!==undefined&&e.release<=TAIL.l);assert.ok(e.length<=LONG+1e-9);
          const chord=chordAt(s,bar).notes,next=chordAt(s,bar+1).notes;
          assert.ok([chord,next].some(n=>JSON.stringify([...n].sort())===JSON.stringify([...new Set([...e.notes,...ev.filter(x=>x.layer==='harmony'&&step(x,bar)===step(e,bar)).flatMap(x=>x.notes)])].sort())),`${seed}:${bar} chord tones`);}
      }
      let run=0,has=false;for(let k=0;k<=16;k++){if(k<16&&!sounding[k]){run++;if(hits.has(k))has=true;}else{if(run>=4){st.rests++;if(has)st.answered++;}run=0;has=false;}}
      const pickup=ev.find(e=>e.layer==='bass'&&step(e,bar)>=13&&step(e,bar)<=15);if(pickup){st.pickups++;if(hits.has(step(pickup,bar)))st.shared++;}
    }
  }
  const [o,n]=[stats[25],stats[26]];
  assert.ok(n.long/n.hits<.2&&o.long/o.hits>.4,JSON.stringify(stats));
  assert.ok(n.answered/n.rests>.9&&n.answered/n.rests>o.answered/o.rests+.1,JSON.stringify(stats));
  assert.ok(n.shared/n.pickups>o.shared/o.pickups+.1,JSON.stringify(stats));
  assert.ok(n.hits/o.hits<1.25,'not a wall of stabs');
});

test('the calm intro and quiet songs get no answering stabs',()=>{
  for(const seed of SEEDS){
    const now={...make('lofi'),seed};
    for(let bar=0;bar<8;bar++){
      const a=eventsForBar(now,bar).filter(e=>e.layer==='harmony').map(e=>step(e,bar));
      const b=eventsForBar({...now,generatorVersion:25},bar).filter(e=>e.layer==='harmony').map(e=>step(e,bar));
      assert.ok(a.every(k=>b.includes(k)||k>=13),`${seed}:${bar}`);
    }
  }
});
