import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DEFAULTS, LAYERS, eventsForBar, normalizeSettings, regenerateSettings, selectProfile, chordAt, type Settings, type ProfileId } from '../src/music.ts';
import { INSTRUMENTS } from '../src/instruments.ts';
import { diatonicPitches } from '../src/harmony.ts';
import { evenPulses } from '../src/ensemble.ts';
import { arrangementAt } from '../src/arrangement.ts';
const profiles: ProfileId[] = ['lofi', 'ambient', 'dub'];
const form = (s: Settings, offset = 0) => Array.from({ length: arrangementAt(s,0).formLength }, (_,b)=>eventsForBar(s,b+offset).map(e=>({...e,at:+(e.at-offset).toFixed(8)}))).flat();

test('frozen v2 scores keep their exact original fingerprints', () => {
  const expected = ['3a6807fc9451fa516162bbce72af8ae3fe4c5529fc140feb645966e6bff3b953','e35eca09bc7fee63e786b1a720c17a534902dbf18ddba0a392bd0a274ceaacf3','a6f7ad59100c4261dcccb94cac2bb83fd34bc2ed3514186000bf63dd41a29fa6'];
  profiles.forEach((profile,i)=>{
    const s = {...selectProfile(DEFAULTS,profile), generatorVersion:2 as const};
    assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(s,b)))).digest('hex'),expected[i]);
  });
});
test('regeneration changes all four instruments and shares preserve explicit choices', () => {
  for(const profile of profiles){
    let s=selectProfile(DEFAULTS,profile);
    const seen=Object.fromEntries(LAYERS.map(l=>[l,new Set<string>()]));
    for(let i=0;i<48;i++){
      const next=regenerateSettings(s,`SEED${i}`);
      for(const l of LAYERS){assert.notEqual(next.instruments[l],s.instruments[l]);seen[l].add(next.instruments[l]);}
      assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(next))),next);s=next;
    }
    for(const l of LAYERS)assert.equal(seen[l].size,4);
  }
  const bad=normalizeSettings({...DEFAULTS,instruments:{bass:'m-bell',motif:'<script>'}});
  assert.ok(INSTRUMENTS.bass.some(i=>i.id===bad.instruments.bass));
});
test('even pulses have only floor/ceiling gaps and rotate without changing hit count',()=>{
  for(let k=1;k<=16;k++)for(let r=0;r<16;r++){
    const p=evenPulses(k,16,r);assert.equal(new Set(p).size,k);
    for(let i=0;i<k;i++){const gap=(p[(i+1)%k]-p[i]+16)%16||16;assert.ok(gap===Math.floor(16/k)||gap===Math.ceil(16/k));}
  }
});
test('current shared harmony, melodic motion and bass release remain valid across seeds and tempos',()=>{
  for(let seed=0;seed<24;seed++)for(const profile of profiles)for(const groove of (profile==='dub'?['straight','dnb']:['straight']) as Settings['groove'][]){
    const s={...selectProfile(DEFAULTS,profile),seed:`ENSEMBLE${seed}`,groove,bpm:groove==='dnb'?180:seed%2?50:130,energy:seed%3?100:30,evolution:100,layers:{...DEFAULTS.layers}};
    let previous: number|undefined;
    for(let bar=0;bar<64;bar++){
      const events=eventsForBar(s,bar),scale=diatonicPitches(s,34,81),chord=chordAt(s,bar);
      assert.ok(events.length<=30,`density ${events.length}`);
      const melody=events.filter(e=>e.layer==='motif'),bass=events.filter(e=>e.layer==='bass'),kick=events.filter(e=>e.voice==='kick');
      for(const e of [...melody,...bass]){
        assert.ok(e.notes.every(n=>scale.includes(n)),`${profile} ${seed} diatonic`);
        if(e.role==='anchor'||e.role==='arpeggio')assert.ok(chord.notes.some(n=>n%12===e.notes[0]%12));
        if(e.role==='passing'){const next=melody[melody.indexOf(e)+1];assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);}
      }
      for(const e of melody){if(previous!==undefined)assert.ok(Math.abs(e.notes[0]-previous)<=7,`leap ${profile} ${seed} ${bar}`);previous=e.notes[0];}
      if(profile!=='ambient')for(let i=1;i<bass.length;i++)assert.ok(bass[i-1].at+bass[i-1].length+.065*s.bpm/240<=bass[i].at+1e-7);
      if(profile==='dub')for(const b of bass)for(const k of kick)assert.ok(Math.abs(b.at-k.at)*240/s.bpm>=.085-1e-7,`kick/bass ${groove}`);
    }
  }
});
test('current form development and manual timbre/mute changes retain deterministic unaffected parts',()=>{
  for(const profile of profiles){
    const s={...selectProfile(DEFAULTS,profile),evolution:0},n=arrangementAt(s,0).formLength;
    assert.notDeepEqual(form(s),form(s,n));assert.notDeepEqual(form({...s,evolution:100}),form({...s,evolution:100},n));
    for(const l of LAYERS){
      const edited={...s,instruments:{...s.instruments,[l]:INSTRUMENTS[l].find(i=>i.id!==s.instruments[l])!.id}};
      assert.deepEqual(form(s).map(({instrument,...e})=>e),form(edited).map(({instrument,...e})=>e));
      const muted={...s,layers:{...s.layers,[l]:false}};
      assert.deepEqual(form(muted),form(s).filter(e=>e.layer!==l));
    }
  }
});
test('D&B has a distinct syncopated kick pattern, backbeat, variation, breakdown and returning drums',()=>{
  const s={...selectProfile(DEFAULTS,'dub'),groove:'dnb' as const,bpm:170,energy:80};
  const bars=Array.from({length:32},(_,b)=>eventsForBar(s,b));
  assert.notDeepEqual(form(s),form({...s,groove:'straight'}));
  for(let b=4;b<12;b++){
    const kicks=bars[b].filter(e=>e.voice==='kick');assert.ok(kicks.length<4);assert.ok(kicks.some(e=>Math.abs(e.at*4-Math.round(e.at*4))>.1));
    assert.deepEqual(bars[b].filter(e=>e.voice==='snare'&&e.gain>.03).map(e=>+(e.at%1).toFixed(2)),[.25,.75]);
  }
  for(let b=16;b<20;b++)assert.ok(bars[b].every(e=>e.layer!=='rhythm'));
  assert.ok(bars[24].some(e=>e.voice==='kick'));
  assert.equal(normalizeSettings(s).bpm,170);
  assert.equal(normalizeSettings({...s,profile:'ambient'}).groove,'straight');
});
