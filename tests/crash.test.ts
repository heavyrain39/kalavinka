import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,type Settings} from '../src/music';
import {crashEvent} from '../src/crash';
import {arrangementAt} from '../src/arrangement';
import {fillPlan} from '../src/fills';
import {renderDrum,DRUM_KITS,DRUM_SOUNDS} from '../src/drum-bank';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';

test('crashes are occasional, reproducible transition accents with a full boundary of space',()=>{
 let count=0,possible=0,afterFill=0;
 for(const mode of ['lofi','dub','dnb'] as const)for(let seed=0;seed<32;seed++){
  const s:Settings={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:`CRASH${seed}`,energy:65,groove:mode==='dnb'?'dnb':'straight'};
  let last=-100;
  for(let bar=0;bar<256;bar++){
   const event=crashEvent(s,bar);
   assert.equal(crashEvent({...s,generatorVersion:15},bar),undefined);
   assert.equal(crashEvent({...s,profile:'ambient'},bar),undefined);
   assert.equal(crashEvent({...s,energy:24},bar),undefined);
   if(bar>0&&bar%8===0&&!arrangementAt(s,bar).beatless&&arrangementAt(s,bar).section!=='open')possible++;
   if(!event)continue;
   count++;if(fillPlan(s,bar-1))afterFill++;
   assert.equal(event.voice,'crash');assert.equal(event.at,bar);assert.equal(bar%8,0);
   assert.ok(bar-last>=16);last=bar;
   assert.deepEqual(crashEvent(structuredClone(s),bar),event);
  }
 }
 assert.ok(count/possible>.12&&count/possible<.6,'many transitions must remain unaccented');
 assert.ok(afterFill>50,'existing fills can resolve into a cymbal');
});

test('v16 adds only cymbals; saved accents survive reload, mute and arbitrary score queries',()=>{
 for(const mode of ['lofi','ambient','dub','dnb'] as const){
  const s:Settings={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:'CRASHDEMO',energy:65,melodyRepetition:1,groove:mode==='dnb'?'dnb':'straight'};
  for(let bar=0;bar<128;bar++)assert.deepEqual(eventsForBar(s,bar).filter(e=>e.voice!=='crash'),eventsForBar({...s,generatorVersion:15},bar));
  if(mode==='ambient')continue;
  const start=Array.from({length:32},(_,i)=>i*8).find(b=>crashEvent(s,b))!;
  assert.ok(Number.isFinite(start));
  const clip=capturePhrase({settings:s,opening:true},start),saved=normalizePhrase(JSON.parse(JSON.stringify(clip)))!;
  assert.ok(saved.events.some(e=>e.voice==='crash'&&e.at===0));
  assert.deepEqual(saved,clip);
  assert.deepEqual(playbackScore({settings:s,opening:true,phrase:saved}).onsets(0,8),clip.events);
  assert.deepEqual(eventsForBar({...s,layers:{...s.layers,rhythm:false}},start),eventsForBar(s,start).filter(e=>e.layer!=='rhythm'));
  for(const bar of [start+64,start+32,start+16,start])eventsForBar(s,bar);
  assert.deepEqual(capturePhrase({settings:s,opening:true},start),clip);
 }
});

test('existing drum samples stay byte-exact and cymbals have an independent long decay',()=>{
 const digest=createHash('sha256');
 for(const kit of DRUM_KITS)for(const mode of ['house','dnb'] as const)for(const sound of DRUM_SOUNDS.filter(s=>s!=='crash'))
  digest.update(new Uint8Array(renderDrum(48000,kit,mode,sound,.65,0).buffer));
 assert.equal(digest.digest('hex'),'a6fed502809dc907e0280288816aaf4b80cf47efe47595a49624bb54ebbdbeaa');
 const rms=(data:Float32Array,from:number,to:number)=>Math.sqrt(data.slice(from*48000,to*48000).reduce((a,x)=>a+x*x,0)/((to-from)*48000));
 for(const kit of DRUM_KITS){
  const cymbal=renderDrum(48000,kit,'house','crash',1,0);
  assert.ok(cymbal.length>=48000*2);
  assert.ok(rms(cymbal,0,.03)<rms(cymbal,.06,.16)*.3,'soft cymbal must bloom rather than start with a hard strike');
  assert.ok(rms(cymbal,.7,.9)>.005,'wash must outlast an open hat');
  assert.ok(rms(cymbal,1.5,1.7)<rms(cymbal,.3,.5)*.3,'tail must decay');
 }
});
