// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {hash} from './seed';
import type {MusicEvent} from './music';
import {ownVoice} from './source-lifecycle';

function noise(seed:string) {
  let state=hash(seed)||1;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1;};
}
function bodyMode(rate:number,frequency:number,q:number) {
  const w=2*Math.PI*frequency/rate,a=Math.sin(w)/(2*q),b=a/(1+a),a1=-2*Math.cos(w)/(1+a),a2=(1-a)/(1+a);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}

// Fractional-delay string loop. The averaging loss filter contributes half a sample
// of delay; subtract it so fretted notes remain in tune across device sample rates.
function stringLoop(rate:number,frequency:number,position:number,decay:number,seed:string) {
  const delay=rate/frequency-.5,whole=Math.floor(delay),fraction=delay-whole;
  const line=new Float64Array(whole+2),random=noise(seed);
  for(let i=0;i<line.length;i++) {
    const phase=(i/(rate/frequency))%1;
    const displacement=phase<position?phase/position:(1-phase)/(1-position);
    line[i]=(2*displacement-1)*.992+random()*.008;
  }
  const mean=line.reduce((a,x)=>a+x,0)/line.length;
  for(let i=0;i<line.length;i++)line[i]-=mean;
  const loss=Math.exp(-1/(frequency*decay));let write=0,last=0;
  return ()=>{
    let a=write+2;if(a>=line.length)a-=line.length;
    const b=a===0?line.length-1:a-1;
    const value=line[a]*(1-fraction)+line[b]*fraction;
    line[write]=(value+last)*.5*loss;last=value;if(++write===line.length)write=0;
    return value;
  };
}

/** Original plucked nylon-string synthesis; no recordings or downloaded impulse responses. */
export function renderNylon(rate:number,note:number,velocity:number,variant:number):Float32Array<ArrayBuffer> {
  if(!Number.isFinite(rate)||rate<22050||!Number.isFinite(note)||note<0||note>127||!Number.isFinite(velocity))throw Error('Invalid nylon render parameters');
  const frequency=440*2**((note-69)/12),v=Math.max(0,Math.min(1,velocity));
  if(frequency>=rate*.40)throw Error('Nylon note exceeds synthesis bandwidth');
  const duration=3,output=new Float32Array(Math.ceil(rate*duration)),position=variant%2?.23:.185;
  const decay=(.66+v*.24)*(220/frequency)**.16;
  const main=stringLoop(rate,frequency,position,decay,`nylon:${note}:${variant}`);
  const secondary=stringLoop(rate,frequency*2**(1.4/1200),position+.035,decay*1.35,`nylon:${note}:${variant}:second`);
  const air=bodyMode(rate,190,2.5),wood=bodyMode(rate,420,2.1),presence=bodyMode(rate,920,1.7);
  const brightness=Math.exp(-2*Math.PI*(2400+v*2600)/rate),dcCoefficient=Math.exp(-2*Math.PI*35/rate);
  const finger=noise(`nylon:finger:${note}:${variant}`),fingerTone=bodyMode(rate,1900,1),attack=.0035+(1-v)*.002;
  let previous=0,low=0,dc=0,energy=0,frames=0,peak=0;
  for(let i=0;i<output.length;i++) {
    const t=i/rate,string=.94*main()+.06*secondary();
    // A little bridge-velocity radiation adds the upper partials of a plucked string.
    const touch=t<.016?fingerTone(finger())*Math.sin(Math.PI*t/.016)**2*(.018+v*.018):0;
    const bridge=.70*string+.30*(string-previous)*rate/(2*Math.PI*frequency)+touch;previous=string;
    low=(1-brightness)*bridge+brightness*low;
    const body=low+.32*air(low)+.22*wood(low)+.10*presence(low);
    dc=(1-dcCoefficient)*body+dcCoefficient*dc;
    const rise=t<attack?Math.sin(Math.PI*.5*t/attack)**2:1;
    const fade=t>duration-.035?Math.sin(Math.PI*.5*(duration-t)/.035)**2:1;
    const x=(body-dc)*rise*fade;output[i]=x;peak=Math.max(peak,Math.abs(x));
    if(t>=.025&&t<.16){energy+=x*x;frames++;}
  }
  const scale=Math.min(.27/Math.max(1e-9,Math.sqrt(energy/frames)),.88/Math.max(1e-9,peak));
  for(let i=0;i<output.length;i++)output[i]*=scale;
  output[0]=0;output[output.length-1]=0;return output;
}

interface Cache {buffers:Map<string,AudioBuffer>;bytes:number;renders:number}
const caches=new WeakMap<BaseAudioContext,Cache>();
const CACHE_BYTES=24*1024*1024;
export function nylonBuffer(context:BaseAudioContext,note:number,velocity:number,variant:number) {
  if(!Number.isInteger(note)||note<0||note>127||!Number.isFinite(velocity)||!Number.isFinite(variant))throw Error('Invalid nylon voice parameters');
  let cache=caches.get(context);if(!cache){cache={buffers:new Map(),bytes:0,renders:0};caches.set(context,cache);}
  const layer=Math.max(0,Math.min(3,Math.round((velocity-.35)/.2))),hand=Math.abs(Math.round(variant))%2,key=`${note}:${layer}:${hand}`;
  let buffer=cache.buffers.get(key);
  if(buffer){cache.buffers.delete(key);cache.buffers.set(key,buffer);return buffer;}
  // A fixed synthesis rate keeps string damping and the cache budget identical on
  // 44.1/48/96 kHz devices. Web Audio resamples the buffer during playback.
  const data=renderNylon(48000,note,.35+layer*.2,hand);cache.renders++;
  buffer=context.createBuffer(1,data.length,48000);buffer.copyToChannel(data,0);
  while(cache.bytes+data.byteLength>CACHE_BYTES&&cache.buffers.size){
    const oldest=cache.buffers.keys().next().value!;
    cache.bytes-=cache.buffers.get(oldest)!.length*4;cache.buffers.delete(oldest);
  }
  cache.buffers.set(key,buffer);cache.bytes+=data.byteLength;return buffer;
}
export const nylonCacheStats=(context:BaseAudioContext)=>({buffers:caches.get(context)?.buffers.size??0,bytes:caches.get(context)?.bytes??0,renders:caches.get(context)?.renders??0});
const preparing=new WeakMap<BaseAudioContext,Promise<void>>();
export function prepareNylon(context:BaseAudioContext) {
  let pending=preparing.get(context);
  if(!pending){
    pending=(async()=>{
      for(let note=48;note<=66;note++)for(const hand of [0,1]){
        if(context.state==='closed')return;
        nylonBuffer(context,note,.55,hand);
        await new Promise<void>(resolve=>setTimeout(resolve,0));
      }
    })();
    preparing.set(context,pending);pending.finally(()=>preparing.delete(context)).catch(()=>{});
  }
  return pending;
}

export function nylonVoice(context:BaseAudioContext,event:MusicEvent,time:number,duration:number,destination:AudioNode,
  active:Set<AudioScheduledSourceNode>,cleanups?:Set<()=>void>) {
  if(!event.notes.length||!Number.isFinite(event.gain)||event.gain<=0||!Number.isFinite(duration)||duration<=0)return;
  const velocity=Math.max(0,Math.min(1,event.velocity??.57)),variant=event.variation??hash(`nylon:${event.at}:${event.notes.join(',')}`)%2;
  // Resolve buffers before allocating the voice graph so bad pitches cannot leak nodes.
  const buffers=event.notes.map(note=>nylonBuffer(context,note,velocity,variant));
  const gain=context.createGain(),filter=context.createBiquadFilter(),pan=context.createStereoPanner();
  filter.type='lowpass';filter.Q.value=.55;filter.frequency.value=Math.min(context.sampleRate*.40,Math.max(2000,event.cutoff*1.65));
  pan.pan.value=event.pan;gain.connect(filter).connect(pan).connect(destination);
  const release=Math.max(.025,Math.min(.3,event.release??.09)),hold=Math.min(duration,3-release-.01);
  const amplitude=event.gain*1.15*(.78+velocity*.4)/Math.max(1,event.notes.length);
  gain.gain.setValueAtTime(amplitude,time);
  const tail=Float32Array.from({length:65},(_,i)=>amplitude*Math.cos(i/64*Math.PI/2)**2);
  gain.gain.setValueCurveAtTime(tail,time+hold,release);gain.gain.setValueAtTime(0,time+hold+release);
  const sources=buffers.map(buffer=>{const source=context.createBufferSource();source.buffer=buffer;source.connect(gain);return source;});
  ownVoice(sources,[gain,filter,pan],active,cleanups);
  for(const source of sources){source.start(time);source.stop(time+hold+release+.005);}
}
