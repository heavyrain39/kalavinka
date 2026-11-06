import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {tapeEnabled,tapeAmount,tapeCutoff,tapeCurve,wowDepth,createTapeNoise,SAT_DRIVE} from '../src/tape';
const modes=['lofi','ambient','dub','dnb'] as const;
const make=(mode:typeof modes[number],extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:78,...extra};
};
const sha=(s:Settings)=>createHash('sha256').update(JSON.stringify(Array.from({length:96},(_,b)=>eventsForBar(s,b)))).digest('hex');

test('v21 changes the lo-fi sound only: scores equal v20, older versions and other moods have no tape',()=>{
  assert.equal(DEFAULTS.generatorVersion,21);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:21}).generatorVersion,21);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:20}).generatorVersion,20);
  assert.equal(upgradeSettings(make('lofi',{generatorVersion:20})).generatorVersion,21);
  for(const mode of modes)for(const rep of [0,2] as const)
    assert.equal(sha(make(mode,{melodyRepetition:rep})),sha(make(mode,{generatorVersion:20,melodyRepetition:rep})),`${mode}:${rep}`);
  assert.equal(tapeEnabled(make('lofi')),true);
  for(const v of [13,18,19,20] as const)assert.equal(tapeEnabled(make('lofi',{generatorVersion:v})),false);
  for(const mode of ['ambient','dub','dnb'] as const)assert.equal(tapeEnabled(make(mode)),false);
});

test('warmth sets the tape amount: none at low warmth, darker and noisier as it rises',()=>{
  assert.equal(tapeAmount(0),0);assert.equal(tapeAmount(20),0);assert.equal(tapeAmount(100),1);
  assert.ok(Math.abs(tapeAmount(DEFAULTS.warmth)-.65)<1e-9);
  for(let w=0;w<100;w+=5){assert.ok(tapeAmount(w+5)>=tapeAmount(w));assert.ok(tapeCutoff(w+5)<=tapeCutoff(w));}
  assert.ok(tapeCutoff(100)>=8000&&tapeCutoff(0)<=15000);
  // Pitch wow stays a few cents: a 1.56 ms sweep at most for the default warmth.
  const cents=(depth:number,rate:number)=>1200*Math.log2(1+depth*2*Math.PI*rate);
  assert.ok(Math.abs(cents(wowDepth(4,.47),.47)-4)<1e-9);
});

test('saturation is gentle, monotonic and unity at low level',()=>{
  const gain=(raw:number)=>tapeCurve(raw*SAT_DRIVE)/SAT_DRIVE/raw;
  assert.equal(tapeCurve(0),0);
  assert.ok(Math.abs(gain(.001)-1)<.002);
  assert.ok(20*Math.log10(gain(.1))>-.5);           // typical level: under half a dB
  const peak=20*Math.log10(gain(.26));               // the scene's measured peak
  assert.ok(peak<-.8&&peak>-2,String(peak));
  let last=-Infinity;for(let x=-1;x<=1;x+=1/512){const y=tapeCurve(x);assert.ok(y>last);last=y;}
});

test('the noise bed is deterministic, quiet, seamless and stereo',()=>{
  const context={sampleRate:48000,createBuffer:(channels:number,length:number,sampleRate:number)=>{
    const data=Array.from({length:channels},()=>new Float32Array(length));
    return {sampleRate,length,numberOfChannels:channels,getChannelData:(c:number)=>data[c]};
  }} as unknown as BaseAudioContext;
  const a=createTapeNoise(context),b=createTapeNoise(context);
  const L=a.getChannelData(0),R=a.getChannelData(1);
  assert.deepEqual(L,b.getChannelData(0));
  let peak=0,sum=0,diff=0;for(let i=0;i<L.length;i++){peak=Math.max(peak,Math.abs(L[i]));sum+=L[i]*L[i];diff+=Math.abs(L[i]-R[i]);}
  const rms=Math.sqrt(sum/L.length);
  assert.ok(peak<.03&&peak>.003,String(peak));
  assert.ok(rms<.002&&rms>.0002,String(rms));
  assert.ok(diff>0);
  assert.ok(L[0]===0&&L[L.length-1]===0);
});
