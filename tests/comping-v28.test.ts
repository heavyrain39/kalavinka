import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,chordAt,type Settings,type MusicEvent} from '../src/music';
import {arrangementAt} from '../src/arrangement';
import {dnbCompV28,rhythmSection,DNB_LONG,DNB_TAIL} from '../src/comping-v28';
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:'lofi'|'ambient'|'dub'|'dnb',extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:28,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=96)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));
const step=(e:MusicEvent,bar:number)=>Math.round((e.at-bar)*16);
const sorted=(n:readonly number[])=>JSON.stringify([...new Set(n)].sort());

test('v28 rewrites D&B comping in the groove and return only; everything else keeps the v27 score',()=>{
  assert.equal(DEFAULTS.generatorVersion,28);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:28}).generatorVersion,28);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:27}).generatorVersion,27);
  assert.equal(upgradeSettings(make('dnb',{generatorVersion:27})).generatorVersion,28);
  for(const mode of ['lofi','ambient','dub'] as const)for(const rep of [0,2] as const)
    assert.equal(sha(score(make(mode,{melodyRepetition:rep}))),sha(score(make(mode,{generatorVersion:27,melodyRepetition:rep}))),`${mode}:${rep}`);
  for(const seed of SEEDS){
    const now={...make('dnb'),seed},old={...now,generatorVersion:27 as const};
    for(let bar=0;bar<96;bar++){
      const a=eventsForBar(now,bar),b=eventsForBar(old,bar);
      assert.equal(sha(a.filter(e=>e.layer!=='harmony')),sha(b.filter(e=>e.layer!=='harmony')),`${seed}:${bar}`);
      // The intro and the breakdown keep the long liquid pad.
      if(!rhythmSection(arrangementAt(now,bar).section))assert.equal(sha(a.filter(e=>e.layer==='harmony')),sha(b.filter(e=>e.layer==='harmony')),`${seed}:${bar} pad`);
    }
  }
  assert.equal(dnbCompV28(make('dnb')),true);
  for(const s of [make('dnb',{generatorVersion:27}),make('lofi'),make('ambient'),make('dub')])assert.equal(dnbCompV28(s),false);
});

test('D&B keys play around the break: never on the snare, answering the lead, with the bass pickups',()=>{
  const stats={27:{bars:0,hits:0,long:0,rests:0,answered:0,pickups:0,shared:0},28:{bars:0,hits:0,long:0,rests:0,answered:0,pickups:0,shared:0}};
  for(const v of [27,28] as const)for(const seed of SEEDS){
    const s={...make('dnb'),seed,generatorVersion:v};
    for(let bar=0;bar<96;bar++){
      if(!rhythmSection(arrangementAt(s,bar).section))continue;
      const ev=eventsForBar(s,bar),st=stats[v],lead=ev.filter(e=>e.layer==='motif'),chords=ev.filter(e=>e.layer==='harmony');st.bars++;
      const snares=new Set(ev.filter(e=>e.voice==='snare'&&!e.ghost&&e.fill===undefined).map(e=>step(e,bar)));
      for(const e of chords){st.hits++;if(e.length>=.5-1e-9)st.long++;
        if(v===28){
          assert.ok(!snares.has(step(e,bar)),`${seed}:${bar} chord on the snare`);
          assert.ok(e.length<=DNB_LONG+1e-9&&e.release!==undefined&&e.release<=DNB_TAIL.l,`${seed}:${bar} length`);
          assert.ok([chordAt(s,bar).notes,chordAt(s,bar+1).notes].some(n=>sorted(n)===sorted(e.notes)),`${seed}:${bar} chord tones`);
        }
      }
      const hits=new Set(chords.map(e=>step(e,bar)));
      const sounding=Array.from({length:16},(_,k)=>lead.some(e=>{const f=(e.at-bar)*16;return f<k+.5&&f+e.length*16>k+.25;}));
      let run=0,has=false;for(let k=0;k<=16;k++){if(k<16&&!sounding[k]){run++;if(hits.has(k))has=true;}else{if(run>=4){st.rests++;if(has)st.answered++;}run=0;has=false;}}
      const pickup=ev.find(e=>e.layer==='bass'&&step(e,bar)>=13&&step(e,bar)<=15);if(pickup){st.pickups++;if(hits.has(step(pickup,bar)))st.shared++;}
    }
  }
  const [o,n]=[stats[27],stats[28]],msg=JSON.stringify(stats);
  assert.ok(o.hits/o.bars<1&&n.hits/n.bars>1.8&&n.hits/n.bars<3,msg);
  assert.ok(n.long/n.hits>.1,`long liquid chords remain: ${msg}`);
  assert.ok(n.answered/n.rests>.8&&n.answered/n.rests>o.answered/o.rests+.3,msg);
  assert.ok(n.shared/n.pickups>.4&&o.shared===0,msg);
});
