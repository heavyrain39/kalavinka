import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,type Settings} from '../src/music';
import {renderDrum,DRUM_KITS,DRUM_SOUNDS} from '../src/drum-bank';

test('v6 preserves harmony, bass, kick placements and main backbeats while adding bounded drum expression',()=>{
 let ghosts=0,opens=0,halves=0;
 for(const profile of ['lofi','ambient','dub'] as const)for(const groove of ['straight','dnb'] as const)for(let seed=0;seed<8;seed++) {
  const s:Settings={...selectProfile(DEFAULTS,profile),groove,seed:`DRUM${seed}`,energy:80,generatorVersion:6,bpm:groove==='dnb'?170:108};
  for(let bar=0;bar<64;bar++) {
   const before=eventsForBar({...s,generatorVersion:5},bar),after=eventsForBar(s,bar);
   assert.deepEqual(after.filter(e=>e.layer!=='rhythm'),before.filter(e=>e.layer!=='rhythm'));
   for(const voice of ['kick','snare'])assert.deepEqual(after.filter(e=>e.voice===voice&&!e.ghost).map(e=>[e.at,e.gain,e.duck]),before.filter(e=>e.voice===voice).map(e=>[e.at,e.gain,e.duck]));
   assert.ok(after.every((e,i)=>e.at>=bar&&e.at<bar+1&&(!i||e.at>=after[i-1].at)));
   for(const e of after.filter(e=>e.layer==='rhythm')){
    assert.ok(e.velocity!>=.2&&e.velocity!<=1);assert.ok(e.variation===0||e.variation===1);
    if(e.ghost){ghosts++;assert.ok(e.gain<.02);assert.ok(profile!=='ambient');}
    if(e.articulation==='open')opens++;if(e.articulation==='half')halves++;
    if(e.voice==='hat') {const nearest=before.find(b=>b.voice==='hat'&&Math.abs(b.at-e.at)<.01)!;assert.ok(nearest);assert.ok((e.at-nearest.at)*240/s.bpm<=.0041);}
   }
  }
  assert.equal(normalizeSettings(s).generatorVersion,6);
 }
 assert.ok(ghosts>100&&opens>100&&halves>100);
});

test('original drum renders are finite, DC controlled, bounded, repeatable and have quiet endings',()=>{
 for(const rate of [44100,48000])for(const kit of DRUM_KITS)for(const mode of ['house','dnb'] as const)for(const sound of DRUM_SOUNDS)for(const velocity of [.3,1]) {
  const data=renderDrum(rate,kit,mode,sound,velocity,0);let peak=0,sum=0,tail=0;
  for(let i=0;i<data.length;i++){const x=data[i];assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));sum+=x;if(i>data.length-rate*.005)tail=Math.max(tail,Math.abs(x));}
  assert.ok(peak>.01&&peak<1,`${kit}/${mode}/${sound}: ${peak}`);
  assert.ok(Math.abs(sum/data.length)<.0003,`DC ${kit}/${sound}: ${sum/data.length}`);
  assert.ok(tail<.002,`tail ${kit}/${sound}: ${tail}`);assert.equal(data[0],0);assert.equal(data.at(-1),0);
 }
 const args=[48000,'r-electro','dnb','snare',.65,0] as const;
 assert.deepEqual(renderDrum(...args),renderDrum(...args));
 assert.notDeepEqual(renderDrum(...args),renderDrum(48000,'r-electro','dnb','snare',.65,1));
});
