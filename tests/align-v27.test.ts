import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {alignV27,chordLead,MAX_LEAD_MS} from '../src/align-v27';
const SEEDS=['SLOWFLOW','AB12CD','RAIN3','DESK01','MOON77','ZK9Q','NIGHT8','PULSE2'];
const make=(mode:'lofi'|'ambient'|'dub'|'dnb',extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:27,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,bars=96)=>Array.from({length:bars},(_,b)=>eventsForBar(s,b));
const step=(e:MusicEvent,bar:number)=>Math.round((e.at-bar)*16);

test('v27 moves lo-fi chords only; every other part and mood keeps the v26 score',()=>{
  assert.equal(DEFAULTS.generatorVersion,27);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:27}).generatorVersion,27);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:26}).generatorVersion,26);
  assert.equal(upgradeSettings(make('lofi',{generatorVersion:26})).generatorVersion,27);
  for(const mode of ['ambient','dub','dnb'] as const)
    assert.equal(sha(score(make(mode))),sha(score(make(mode,{generatorVersion:26}))),mode);
  for(const seed of SEEDS){
    const now=score({...make('lofi'),seed}).flat(),old=score({...make('lofi',{generatorVersion:26}),seed}).flat();
    assert.equal(sha(now.filter(e=>e.layer!=='harmony')),sha(old.filter(e=>e.layer!=='harmony')),seed);
    const key=(e:MusicEvent)=>JSON.stringify({...e,at:0,length:0});
    assert.deepEqual(now.filter(e=>e.layer==='harmony').map(key).sort(),old.filter(e=>e.layer==='harmony').map(key).sort(),`${seed}: same chords, only moved`);
  }
  assert.equal(alignV27(make('lofi')),true);
  for(const s of [make('lofi',{generatorVersion:26}),make('ambient'),make('dub'),make('dnb')])assert.equal(alignV27(s),false);
});

test('a chord on an arpeggio sixteenth starts with it, unrolled; other chords keep their lazy feel',()=>{
  let aligned=0,alone=0;
  for(const seed of SEEDS){
    const now={...make('lofi'),seed},old={...now,generatorVersion:26},seconds=240/now.bpm;
    for(let bar=0;bar<96;bar++){
      const a=eventsForBar(now,bar),b=eventsForBar(old,bar),arps=b.filter(e=>e.layer==='arpeggio');
      const chords=(ev:MusicEvent[])=>{const m=new Map<number,MusicEvent[]>();for(const e of ev.filter(e=>e.layer==='harmony')){const k=step(e,bar);m.set(k,[...(m.get(k)??[]),e]);}return m;};
      const [na,ob]=[chords(a),chords(b)];
      assert.deepEqual([...na.keys()].sort(),[...ob.keys()].sort(),`${seed}:${bar}`);
      for(const [k,group] of ob){
        const arp=arps.find(x=>step(x,bar)===k),moved=na.get(k)!;
        if(!arp){alone++;assert.deepEqual(moved,group);continue;}
        aligned++;
        const lead=chordLead(now.instruments.harmony,arp.instrument??''),at=Math.max(bar,arp.at-lead/seconds),end=Math.max(...group.map(e=>e.at+e.length));
        for(const e of moved){assert.ok(Math.abs(e.at-at)<1e-9,`${seed}:${bar}:${k} start`);assert.ok(Math.abs(e.at+e.length-end)<1e-7,`${seed}:${bar}:${k} end`);}
        assert.ok((arp.at-moved[0].at)*seconds*1000<=MAX_LEAD_MS+1e-6&&moved[0].at<=arp.at+1e-9);
      }
    }
  }
  assert.ok(aligned>200&&alone>50,JSON.stringify({aligned,alone}));
});

test('the lead follows the difference in speaking time, within 0–20 ms',()=>{
  assert.equal(chordLead('h-electric','m-marimba'),.012);
  assert.equal(chordLead('h-pad','m-marimba'),MAX_LEAD_MS/1000);
  assert.equal(chordLead('h-electric','m-flute'),0);
});
