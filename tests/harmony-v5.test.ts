import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HARMONIES,QUALITIES} from '../src/harmony-catalog';
import {recipeFor,hasEnding,nextHarmonyBoundary} from '../src/harmony-v5';
import {DEFAULTS,selectProfile as currentProfile,normalizeSettings,eventsForBar,chordAt,chordHold,progression,type Settings} from '../src/music';
import {fillPlan,FILL_RECIPES} from '../src/fills';
import {arrangementAt} from '../src/arrangement';
import {kickSteps} from '../src/groove';
import {gridTime} from '../src/timing';
const selectProfile=(s:Settings,p:Settings['profile']):Settings=>({...currentProfile(s,p),generatorVersion:5});

test('v4 saved scores remain byte-identical for all profiles including D&B',()=>{
 const hashes=['0ecc6daa0ca2a7c7ef90a9c7049338ced4704bea4b66bf88d6fbbf91ddc6b73f','9e86d1c9a3146394eac96b288cf1f00d8ee14fa7ee650b969573c90ef8d39940','411bcf6caf658348a5eeed67505c47418c7890df21df00905a6d177138c19ac2','2528803a274fed2601eda0d4e71bb4002f148bc2a3a9ebba6c95a51f02e5e218'];
 ['lofi','ambient','dub','dnb'].forEach((p,i)=>{const s={...selectProfile(DEFAULTS,p==='dnb'?'dub':p as Settings['profile']),generatorVersion:4 as const,bpm:p==='dnb'?170:78,groove:p==='dnb'?'dnb' as const:'straight' as const};assert.equal(normalizeSettings(s).generatorVersion,4);assert.equal(createHash('sha256').update(JSON.stringify(Array.from({length:64},(_,b)=>eventsForBar(s,b)))).digest('hex'),hashes[i]);});
});

test('30 authored progressions have distinct cyclic root paths, legal tones and ten per profile',()=>{
 assert.equal(HARMONIES.length,30);const seen=new Set();
 for(const p of ['lofi','ambient','dub'])assert.equal(HARMONIES.filter(r=>r.profile===p).length,10);
 for(const r of HARMONIES){
  const roots=r.chords.map(c=>c[0]);const canonical=roots.map((_,i)=>[...roots.slice(i),...roots.slice(0,i)].join(',')).sort()[0];
  const key=r.mode+canonical;assert.ok(!seen.has(key),r.id+' repeats a root cycle');seen.add(key);
  const scale=r.mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
  for(const [degree,quality] of [...r.chords,r.ending])for(const n of QUALITIES[quality])assert.ok(scale.includes((degree+n)%12),r.id+' foreign tone');
  assert.notDeepEqual(r.ending,r.chords[3]);
 }
});

const corpus=()=>{
 const found=new Map<string,Settings>();
 for(const profile of ['lofi','ambient','dub'] as const)for(let i=0;i<200;i++){const s={...selectProfile(DEFAULTS,profile),seed:`CURATE${i}`,energy:80,evolution:100};found.set(recipeFor(s).id,s);}
 assert.equal(found.size,30);return [...found.values()];
};
test('all 30 progressions render coherent endings without old chord or bass spill',()=>{
 let endings=0;
 for(const original of corpus())for(const bpm of [50,180])for(const groove of (original.profile==='dub'?['straight','dnb']:['straight']) as Settings['groove'][]){
  const s={...original,groove,bpm},hold=chordHold(s),base=progression(s);
  for(let bar=0;bar<64;bar++){
   const ending=hasEnding(s,bar),chord=chordAt(s,bar);if(ending){endings++;assert.equal(bar%(hold*4),hold*4-1);assert.notEqual(chord.label,base[3].label);}
   const events=eventsForBar(s,bar);
   for(const e of events){
    assert.ok(e.length>0&&Number.isFinite(e.length));
    if(e.layer==='harmony'){
     assert.deepEqual(e.notes,chord.notes);
     assert.ok(e.at+e.length+.58*s.bpm/240<=nextHarmonyBoundary(s,e.at)+1e-7,'pad crosses harmonic boundary');
    }
    if(e.layer==='bass')assert.ok(e.at+e.length+.065*s.bpm/240<=nextHarmonyBoundary(s,e.at)+1e-7,'bass crosses ending');
    if(e.layer==='motif'&&e.role!=='passing')assert.ok(chord.notes.some(n=>n%12===e.notes[0]%12));
   }
   if(ending)assert.ok(events.some(e=>e.layer==='harmony'&&e.at===bar),'new chord must be rearticulated');
  }
 }
 assert.ok(endings>30);
});

test('fills are sparse, diverse, bounded and preserve kick plans and primary backbeats',()=>{
 const variants=new Set<number>();let count=0,opportunities=0;
 for(const profile of ['lofi','dub'] as const)for(const groove of (profile==='dub'?['straight','dnb']:['straight']) as Settings['groove'][])for(let i=0;i<80;i++){
  const s={...selectProfile(DEFAULTS,profile),seed:`FILL${i}`,energy:80,groove,bpm:groove==='dnb'?170:78};
  for(let bar=0;bar<32;bar++){
   const plan=fillPlan(s,bar),a=arrangementAt(s,bar);
   if(bar%8===7&&a.section!=='intro'&&a.section!=='open')opportunities++;
   if(!plan)continue;count++;variants.add(plan.index);assert.equal(bar%8,7);assert.ok(!fillPlan(s,bar-8));
   const events=eventsForBar(s,bar),fill=events.filter(e=>e.fill!==undefined);
   assert.ok(fill.length>=2&&fill.length<=4);assert.ok(fill.every(e=>e.at>=bar+.5&&e.at<bar+1));
   assert.deepEqual(events.filter(e=>e.voice==='kick').map(e=>e.at),kickSteps(s,bar).map(step=>gridTime(s,bar,step)));
   assert.deepEqual(events.filter(e=>e.voice==='snare'&&e.fill===undefined).map(e=>e.at),[4,12].map(step=>gridTime(s,bar,step)));
   const unique=new Set(events.filter(e=>e.layer==='rhythm').map(e=>`${e.voice}:${e.at}`));assert.equal(unique.size,events.filter(e=>e.layer==='rhythm').length);
  }
 }
 assert.equal(variants.size,FILL_RECIPES.length);assert.ok(count/opportunities>.2&&count/opportunities<.7);
 for(let b=0;b<128;b++)assert.equal(fillPlan({...selectProfile(DEFAULTS,'ambient'),energy:100},b),null);
});
