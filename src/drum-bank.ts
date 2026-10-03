// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {hash} from './seed';
export type DrumSound = 'kick'|'snare'|'closed'|'half'|'open'|'rim'|'tom';
export type DrumMode = 'house'|'dnb';
export const DRUM_KITS = ['r-brush','r-tape','r-electro','r-click'] as const;
export const DRUM_SOUNDS: DrumSound[] = ['kick','snare','closed','half','open','rim','tom'];
export const VELOCITIES = [.3,.65,1];
const banks = new WeakMap<BaseAudioContext,Promise<DrumBank>>();

// A small, deterministic two-pole filter used only while baking our own sounds.
function lowpass(rate:number,frequency:number,q=.707) {
  const w=2*Math.PI*Math.min(rate*.45,frequency)/rate,c=Math.cos(w),a=Math.sin(w)/(2*q);
  const b0=(1-c)/2/(1+a),b1=(1-c)/(1+a),a1=-2*c/(1+a),a2=(1-a)/(1+a);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b0*x+b1*x1+b0*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
function highpass(rate:number,frequency:number) {
  const a=Math.exp(-2*Math.PI*frequency/rate);let last=0,lp=0;
  return (x:number)=>{lp=(1-a)*x+a*lp;last=x-lp;return last;};
}
const attack=(t:number,seconds:number)=>1-Math.exp(-t/seconds);

/** Original drum design: 2x synthesis, saturation, anti-alias filtering, then decimation. */
export function renderDrum(rate:number,kit:string,mode:DrumMode,sound:DrumSound,velocity:number,variant:number): Float32Array<ArrayBuffer> {
  const brush=kit==='r-brush',tape=kit==='r-tape',electro=kit==='r-electro',minimal=kit==='r-click',dnb=mode==='dnb';
  const duration=sound==='kick'?(dnb?.22:minimal?.23:.38):sound==='snare'?(dnb?.28:brush?.34:.32)
    :sound==='open'?(dnb?.30:.44):sound==='half'?.18:sound==='closed'?.09:sound==='tom'?.38:.13;
  const count=Math.ceil(rate*duration),output=new Float32Array(count),sr=rate*2;
  const aa1=lowpass(sr,rate*.40),aa2=lowpass(sr,rate*.40),dc=highpass(sr,20);
  const color=lowpass(sr,brush?6500:tape?8000:12000);
  const wireHP=highpass(sr,brush?900:1400),crackHP=highpass(sr,2200),hatHP=highpass(sr,brush?4500:6200);
  let rng=hash(`${kit}:${mode}:${sound}:${variant}`)||1;
  const noise=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/2147483648-1;};
  const fundamental=electro?48:tape?52:brush?55:60;
  const rr=1+(variant?1:-1)*.004;
  let phase=0;
  const metalFreq=[413,617,883,1327,1789,2411].map(f=>f*rr*(electro?1.12:1));
  for(let i=0;i<count*2;i++) {
    const t=i/sr,n=color(noise()),fade=.5-.5*Math.cos(Math.PI*Math.min(1,(duration-t)/.02)),v=velocity;
    let x=0;
    if(sound==='kick') {
      // Stable low fundamental; a fast punch and a slower body pitch fall.
      const frequency=fundamental+90*Math.exp(-t/.006)+42*Math.exp(-t/.027);
      phase+=2*Math.PI*frequency/sr;
      const body=Math.sin(phase)*attack(t,.0015)*Math.exp(-t/(dnb?.042:minimal?.045:.067));
      const punch=Math.sin(phase*2)*attack(t,.0008)*Math.exp(-t/.016)*(.12+v*.12);
      const click=crackHP(n)*attack(t,.0005)*Math.exp(-t/.004)*(.06+v*.12)*(brush?.45:1);
      x=Math.tanh((body+punch)*(tape?1.65:1.25))/(tape?1.45:1.2)+click;
    } else if(sound==='snare') {
      const body=(Math.sin(2*Math.PI*(brush?172:electro?194:184)*rr*t)*.52*Math.exp(-t/.040)
        +Math.sin(2*Math.PI*327*rr*t)*.24*Math.exp(-t/.027))*attack(t,.0009);
      const wireNoise=wireHP(n);
      const wire=wireNoise*attack(t,.0014)*Math.exp(-t/(brush?.052:dnb?.029:.039))*(.48+v*.28);
      const crack=crackHP(n)*attack(t,.0004)*Math.exp(-t/.006)*(.12+v*.50);
      // A small staggered noise component gives tape kits a restrained clap texture.
      const clap=tape?wireNoise*Math.max(0,Math.sin(Math.min(1,t/.023)*Math.PI*3))*Math.exp(-t/.014)*.12:0;
      x=Math.tanh((body*(.55+v*.30)+wire+crack+clap)*(electro?1.35:1.1))*.78;
    } else if(sound==='closed'||sound==='half'||sound==='open') {
      const decay=sound==='closed'?(brush?.014:.010):sound==='half'?.030:dnb?.052:.075;
      // Inharmonic oscillators, ring interaction and air give a metallic body.
      let metal=0;for(const f of metalFreq)metal+=Math.sin(2*Math.PI*f*t)+.24*Math.sin(2*Math.PI*f*5*t);
      metal=metal/6+.16*Math.sin(2*Math.PI*metalFreq[1]*t)*Math.sin(2*Math.PI*metalFreq[5]*t);
      x=hatHP(metal*(brush?.25:.72)+n*(brush?.8:.38))*attack(t,.0006)*Math.exp(-t/decay)*(.55+v*.35);
      x+=crackHP(n)*attack(t,.0003)*Math.exp(-t/.0025)*.1*v;
    } else if(sound==='tom') {
      phase+=2*Math.PI*(110+45*Math.exp(-t/.013))/sr;
      x=(Math.sin(phase)*Math.exp(-t/.062)+Math.sin(phase*1.57)*.17*Math.exp(-t/.022)+n*.06*Math.exp(-t/.01))*attack(t,.001);
    } else {
      x=(Math.sin(2*Math.PI*780*rr*t)*.5+Math.sin(2*Math.PI*1260*rr*t)*.28+n*.15)*attack(t,.0006)*Math.exp(-t/.010);
    }
    const sample=aa2(aa1(dc(x)*Math.max(0,fade)));
    if(i%2===1)output[i>>1]=sample;
  }
  // Smooth both ends, including the anti-alias filter's residual state.
  const fadeFrames=Math.round(rate*.003);
  for(let i=0;i<fadeFrames;i++)output[count-1-i]*=i/fadeFrames;
  output[0]=0;output[count-1]=0;return output;
}

export class DrumBank {
  private sounds=new Map<string,AudioBuffer>();
  bytes=0;
  constructor(private context:BaseAudioContext) {}
  async prepare() {
    for(const kit of DRUM_KITS)for(const mode of ['house','dnb'] as DrumMode[])for(const sound of DRUM_SOUNDS) {
      for(let v=0;v<VELOCITIES.length;v++)for(let rr=0;rr<2;rr++) {
        const data=renderDrum(this.context.sampleRate,kit,mode,sound,VELOCITIES[v],rr);
        const buffer=this.context.createBuffer(1,data.length,this.context.sampleRate);buffer.copyToChannel(data,0);
        this.sounds.set(`${kit}:${mode}:${sound}:${v}:${rr}`,buffer);this.bytes+=data.byteLength;
      }
      // Preparation happens before playback; yield so Stop and the UI remain responsive.
      await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    return this;
  }
  get(kit:string,mode:DrumMode,sound:DrumSound,velocity:number,rr:number) {
    const v=Math.max(.3,Math.min(1,velocity)),lo=v<.65?0:1,weight=(v-VELOCITIES[lo])/(VELOCITIES[lo+1]-VELOCITIES[lo]);
    const selected=DRUM_KITS.includes(kit as typeof DRUM_KITS[number])?kit:'r-tape';
    return [lo,lo+1].map((index,i)=>({buffer:this.sounds.get(`${selected}:${mode}:${sound}:${index}:${rr%2}`)!,weight:i?weight:1-weight}));
  }
  get size(){return this.sounds.size;}
}
export function prepareDrums(context:BaseAudioContext):Promise<DrumBank> {
  let pending=banks.get(context);
  if(!pending){pending=new DrumBank(context).prepare();banks.set(context,pending);pending.catch(()=>banks.delete(context));}
  return pending;
}
