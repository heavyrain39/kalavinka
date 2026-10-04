import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderNylon} from '../src/nylon';
import {DEFAULTS,selectProfile,eventsForBar,regenerateSettings,normalizeSettings,type Settings} from '../src/music';
import {capturePhrase,normalizePhrase} from '../src/saved-phrase';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {arpeggioPlan} from '../src/arpeggio';

const rms=(x:Float32Array,rate:number,a:number,b:number)=>{
 let energy=0;for(let i=Math.ceil(a*rate);i<b*rate;i++)energy+=x[i]**2;
 return Math.sqrt(energy/((b-a)*rate));
};
function pitch(data:Float32Array,rate:number,expected:number) {
 const from=Math.round(rate*.12),length=Math.round(rate*.2),low=Math.floor(rate/expected*.95),high=Math.ceil(rate/expected*1.05);
 const scores:number[]=[];
 for(let lag=low;lag<=high;lag++){
  let dot=0,aa=0,bb=0;for(let i=from;i<from+length;i++){const a=data[i],b=data[i+lag];dot+=a*b;aa+=a*a;bb+=b*b;}
  scores[lag]=dot/Math.sqrt(aa*bb);
 }
 let best=low+1;for(let lag=low+2;lag<high;lag++)if(scores[lag]>scores[best])best=lag;
 const offset=.5*(scores[best-1]-scores[best+1])/(scores[best-1]-2*scores[best]+scores[best+1]);
 return rate/(best+offset);
}

test('nylon strings stay in tune, decay smoothly and remain deterministic at device sample rates',()=>{
 for(const rate of [44100,48000,96000])for(const note of [40,48,60,69,76,84]){
  const x=renderNylon(rate,note,.55,0),expected=440*2**((note-69)/12);
  assert.equal(x[0],0);assert.equal(x.at(-1),0);
  assert.ok(x.every(v=>Number.isFinite(v)&&Math.abs(v)<=.881));
  assert.ok(Math.abs(x.reduce((a,v)=>a+v,0)/x.length)<.001);
  assert.ok(Math.abs(1200*Math.log2(pitch(x,rate,expected)/expected))<3,`tuning ${rate}/${note}`);
  assert.ok(rms(x,rate,.7,.9)<rms(x,rate,.025,.16)*.65,'strings decay naturally');
  assert.ok(rms(x,rate,0,.001)<rms(x,rate,.01,.02)*.2,'finger attack has no impulse');
 }
 assert.deepEqual(renderNylon(48000,57,.55,1),renderNylon(48000,57,.55,1));
 assert.notDeepEqual(renderNylon(48000,57,.55,0),renderNylon(48000,57,.55,1));
});

test('nylon fingering keeps the sequencer clock and damps before chord changes and rests',()=>{
 for(const profile of ['lofi','ambient','dub'] as const)for(const groove of ['straight','dnb'] as const)for(const bpm of [50,180]){
  const s:Settings={...selectProfile(DEFAULTS,profile),groove,bpm,instruments:{...DEFAULTS.instruments,arpeggio:'m-nylon'}};
  const all=Array.from({length:64},(_,bar)=>eventsForBar(s,bar)).flat().filter(e=>e.layer==='arpeggio');
  assert.ok(all.length);
  for(const e of all){
   assert.ok(e.notes[0]>=48&&e.notes[0]<=66);
   assert.ok(e.length>0&&e.velocity!>=.52&&e.velocity!<.62);
   assert.ok([0,1].includes(e.variation!));
   const end=e.at+e.length+e.release!*bpm/240;
   assert.ok(end<=nextHarmonyBoundary(s,e.at)+1e-7);
   assert.ok(end<=arpeggioPlan(s,Math.floor(e.at)).end+1e-7);
  }
  assert.ok(all.some((e,i)=>all[i+1]&&e.at+e.length>all[i+1].at),'neighboring strings can ring together');
  const clip=capturePhrase({settings:s,opening:true},0);
  assert.deepEqual(normalizePhrase(JSON.parse(JSON.stringify(clip))),clip);
  assert.equal(normalizeSettings(s).instruments.arpeggio,'m-nylon');
  const wrongLayer=structuredClone(clip),event=wrongLayer.events.find(e=>e.instrument==='m-nylon')!;
  event.layer='motif';assert.equal(normalizePhrase(wrongLayer),undefined,'guitar is an arpeggio choice, not an arbitrary layer instrument');
 }
});

test('Keep sounds preserves the full instrument mix and mute states while New flow changes the composition',()=>{
 const s:Settings={...DEFAULTS,arpeggio:false,groove:'dnb',profile:'dub',layers:{...DEFAULTS.layers,motif:false,rhythm:false},instruments:{...DEFAULTS.instruments,arpeggio:'m-nylon'}};
 const snapshot=structuredClone(s),next=regenerateSettings(s,'NYLONNEW',true);
 assert.equal(next.seed,'NYLONNEW');assert.deepEqual(next.instruments,s.instruments);
 assert.deepEqual(next.layers,s.layers);assert.equal(next.arpeggio,false);assert.equal(next.groove,'dnb');
 assert.notEqual(next.instruments,s.instruments);assert.deepEqual(s,snapshot);
 assert.notEqual(regenerateSettings(s,'NYLONNEW',false).instruments.arpeggio,'m-nylon');
 assert.deepEqual(normalizeSettings(next).instruments,s.instruments);
 const legacy=normalizeSettings({...DEFAULTS,generatorVersion:1}),kept=normalizeSettings(regenerateSettings(legacy,'OLDNYLON',true));
 assert.deepEqual(kept.instruments,legacy.instruments);assert.equal(kept.generatorVersion,1);
});
