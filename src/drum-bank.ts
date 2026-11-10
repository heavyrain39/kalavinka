// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {hash} from './seed';
import {renderCymbal} from './cymbal';
export type DrumSound = 'kick'|'snare'|'closed'|'half'|'open'|'rim'|'tom'|'crash';
export type DrumMode = 'house'|'dnb';
export const DRUM_KITS = ['r-brush','r-tape','r-electro','r-click'] as const;
export const DRUM_SOUNDS: DrumSound[] = ['kick','snare','closed','half','open','rim','tom','crash'];
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
// Two-pole filters for the snare wires and the hats (the one-pole high-pass above leaks too much).
function highpass2(rate:number,frequency:number,q=.707) {
  const w=2*Math.PI*Math.min(rate*.45,frequency)/rate,c=Math.cos(w),a=Math.sin(w)/(2*q);
  const b0=(1+c)/2/(1+a),b1=-(1+c)/(1+a),a1=-2*c/(1+a),a2=(1-a)/(1+a);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b0*x+b1*x1+b0*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
function bandpass(rate:number,frequency:number,q:number) {
  const w=2*Math.PI*Math.min(rate*.45,frequency)/rate,a=Math.sin(w)/(2*q);
  const b=a/(1+a),a1=-2*Math.cos(w)/(1+a),a2=(1-a)/(1+a);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
// A band-limited square (polyBLEP) from a phase in [0,1) that advances by `step` per sample.
const blep=(p:number,step:number)=>p<step?(p/=step,p+p-p*p-1):p>1-step?(p=(p-1)/step,p*p+p+p+1):0;
const square=(p:number,step:number)=>(p<.5?1:-1)+blep(p,step)-blep((p+.5)%1,step);
const attack=(t:number,seconds:number)=>1-Math.exp(-t/seconds);
// A hat is noise ringing through inharmonic resonances: it hisses with a metallic colour and
// holds no pitch. The square oscillators only speak in the first milliseconds, as the stick.
const HAT_RESONANCES=[3300,4600,5900,7400,9200,11400,14000],HAT_OSCILLATORS=[211,293,379,509,547,811];

/** Original drum design: 2x synthesis, saturation, anti-alias filtering, then decimation. */
export function renderDrum(rate:number,kit:string,mode:DrumMode,sound:DrumSound,velocity:number,variant:number): Float32Array<ArrayBuffer> {
  if(sound==='crash')return renderCymbal(rate,kit,variant)[0];
  const brush=kit==='r-brush',tape=kit==='r-tape',electro=kit==='r-electro',minimal=kit==='r-click',dnb=mode==='dnb';
  const duration=sound==='kick'?(dnb?.22:minimal?.23:.38):sound==='snare'?(dnb?.28:brush?.34:.32)
    :sound==='open'?(dnb?.30:.44):sound==='half'?.18:sound==='closed'?.09:sound==='tom'?.38:.13;
  const count=Math.ceil(rate*duration),output=new Float32Array(count),sr=rate*2;
  const aa1=lowpass(sr,rate*.40),aa2=lowpass(sr,rate*.40),dc=highpass(sr,20);
  const color=lowpass(sr,brush?(sound==='kick'?9000:6500):tape?(sound==='kick'?10500:8000):12000);
  const crackHP=highpass(sr,2200);
  // Snare: the wires are noise above the body, with a presence band where real wires speak.
  // A soft stroke is darker, not only quieter.
  const wireHP=highpass2(sr,brush?650:tape?850:electro?1300:1700),wireBand=bandpass(sr,brush?2400:tape?2100:electro?3800:4800,.8);
  const strokeTone=lowpass(sr,sound==='snare'?2600+velocity*9000:(brush?8500:tape?9500:17000)*(.5+.5*velocity));
  const snarePitch=(brush?172:electro?186:minimal?206:190)*(variant?1.004:.996);
  let snarePhase=0,snareOver=0;
  // Hats: tuned per kit, coloured by seven resonances, then cut below the kit's own floor.
  const hatTune=(electro?1:minimal?1.1:tape?.92:1.05)*(variant?1.004:.996);
  const hatSteps=HAT_OSCILLATORS.map(f=>f*hatTune/sr),hatPhases=HAT_OSCILLATORS.map((_,k)=>k*.37%1);
  // Equal-Q bands grow wider and louder upwards; the tilt keeps each kit's top end in proportion.
  const hatTilt=brush?1:tape?1.3:electro?1.15:1.45,hatWeights=HAT_RESONANCES.map(f=>(5900/f)**hatTilt);
  const hatBands=HAT_RESONANCES.map(f=>bandpass(sr,f*hatTune,9)),hatStick=highpass2(sr,5200);
  const hatHP=highpass2(sr,brush?4200:tape?4800:electro?6000:7400),hatTrim=brush?.68:tape?.2:electro?.165:.165;
  let rng=hash(`${kit}:${mode}:${sound}:${variant}`)||1;
  const noise=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/2147483648-1;};
  const fundamental=electro?48:tape?52:brush?55:60;
  const rr=1+(variant?1:-1)*.004;
  let phase=0;
  for(let i=0;i<count*2;i++) {
    const t=i/sr,white=noise(),n=color(white),fade=.5-.5*Math.cos(Math.PI*Math.min(1,(duration-t)/.02)),v=velocity;
    let x=0;
    if(sound==='kick') {
      // Stable low fundamental; a fast punch and a slower body pitch fall.
      const frequency=fundamental+90*Math.exp(-t/.006)+42*Math.exp(-t/.027);
      phase+=2*Math.PI*frequency/sr;
      const bodyDecay=brush?(dnb?.034:.047):tape?(dnb?.036:.052):dnb?.042:minimal?.045:.067;
      const body=Math.sin(phase)*attack(t,brush?.0009:tape?.001:.0015)*Math.exp(-t/bodyDecay);
      const punch=Math.sin(phase*2)*attack(t,.0008)*Math.exp(-t/.016)*(.12+v*.12);
      const click=crackHP(n)*attack(t,.0005)*Math.exp(-t/.004)*(.06+v*.12)*(brush?.85:tape?1.2:1);
      // Let the beater speak above the low body without flattening its attack.
      const beater=(brush||tape)?Math.sin(2*Math.PI*(brush?1700:2400)*t)*attack(t,.0003)*Math.exp(-t/.002)*(.025+v*.035):0;
      x=Math.tanh((body+punch)*1.25)/1.2*(brush?.96:tape?.94:1)+click+beater;
    } else if(sound==='snare') {
      // The head: two modes that start sharp and settle within a few milliseconds, like a
      // struck membrane; a steady sine reads as a beep.
      const bend=1+(electro?.14:.24)*Math.exp(-t/.011);
      snarePhase+=2*Math.PI*snarePitch*bend/sr;snareOver+=2*Math.PI*snarePitch*1.76*bend/sr;
      const ring=brush?.032:tape?.030:electro?.040:.022;
      const body=(Math.sin(snarePhase)*.52*Math.exp(-t/(ring*(dnb?.85:1)))+Math.sin(snareOver)*.24*Math.exp(-t/(ring*.68)))*attack(t,.0009)
        *(brush?1.25:tape?1.4:electro?1.35:1.05);
      const air=strokeTone(n),wireNoise=wireHP(air)*.55+wireBand(air)*1.15;
      const wireDecay=brush?(dnb?.052:.062):tape?(dnb?.040:.050):electro?(dnb?.038:.045):dnb?.024:.027;
      const wire=wireNoise*attack(t,brush?.004:.0012)*Math.exp(-t/wireDecay)*(.62+v*.38)*(brush?.62:tape?.82:electro?.9:.92);
      const crack=crackHP(n)*attack(t,.0004)*Math.exp(-t/.006)*(.10+v*.55)*(brush?.4:1);
      // A small staggered noise component gives tape kits a restrained clap texture.
      const clap=tape?wireNoise*Math.max(0,Math.sin(Math.min(1,t/.023)*Math.PI*3))*Math.exp(-t/.014)*.12:0;
      x=Math.tanh((body*(.42+v*.22)+wire+crack+clap)*(electro?1.35:1.1))*(brush?.85:electro?.7:.78);
    } else if(sound==='closed'||sound==='half'||sound==='open') {
      const decay=sound==='closed'?(brush?.014:.010):sound==='half'?.030:dnb?.052:.075;
      let squares=0;
      for(let k=0;k<hatSteps.length;k++){let p=hatPhases[k]+hatSteps[k];p-=Math.floor(p);hatPhases[k]=p;squares+=square(p,hatSteps[k]);}
      let metal=0;for(let k=0;k<hatBands.length;k++)metal+=hatBands[k](white)*hatWeights[k];
      // Metal and air in the kit's own proportion: a brush is mostly air, a minimal kit mostly metal.
      const mix=metal*(brush?.9:tape?2.2:electro?3:3.2)+n*(brush?.8:tape?.4:electro?.22:.14);
      const stick=hatStick(squares)*Math.exp(-t/.004)*(brush?.03:.1)*(.4+v*.6);
      x=(strokeTone(hatHP(mix))*Math.exp(-t/decay)+stick)*attack(t,brush?.0015:.0006)*(.55+v*.35)*hatTrim;
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
    // Long cymbals share one buffer per kit/variation; velocity stays continuous at playback.
    const crashes=new Map<string,AudioBuffer>();
    for(const kit of DRUM_KITS)for(const mode of ['house','dnb'] as DrumMode[])for(const sound of DRUM_SOUNDS) {
      for(let v=0;v<VELOCITIES.length;v++)for(let rr=0;rr<2;rr++) {
        const key=`${kit}:${rr}`;
        let buffer=sound==='crash'?crashes.get(key):undefined;
        if(!buffer){
          const channels=sound==='crash'?renderCymbal(this.context.sampleRate,kit,rr):[renderDrum(this.context.sampleRate,kit,mode,sound,VELOCITIES[v],rr)];
          buffer=this.context.createBuffer(channels.length,channels[0].length,this.context.sampleRate);
          channels.forEach((data,ch)=>{buffer!.copyToChannel(data,ch);this.bytes+=data.byteLength;});
          if(sound==='crash'){
            crashes.set(key,buffer);
            await new Promise<void>(resolve=>setTimeout(resolve,0));
          }
        }
        this.sounds.set(`${kit}:${mode}:${sound}:${v}:${rr}`,buffer);
      }
      // Preparation happens before playback; yield so Stop and the UI remain responsive.
      await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    return this;
  }
  get(kit:string,mode:DrumMode,sound:DrumSound,velocity:number,rr:number) {
    const v=Math.max(.3,Math.min(1,velocity)),lo=v<.65?0:1,weight=(v-VELOCITIES[lo])/(VELOCITIES[lo+1]-VELOCITIES[lo]);
    const selected=DRUM_KITS.includes(kit as typeof DRUM_KITS[number])?kit:'r-tape';
    if(sound==='crash')return [{buffer:this.sounds.get(`${selected}:house:crash:2:${rr%2}`)!,weight:1}];
    return [lo,lo+1].map((index,i)=>({buffer:this.sounds.get(`${selected}:${mode}:${sound}:${index}:${rr%2}`)!,weight:i?weight:1-weight}));
  }
  get size(){return this.sounds.size;}
}
export function prepareDrums(context:BaseAudioContext):Promise<DrumBank> {
  let pending=banks.get(context);
  if(!pending){pending=new DrumBank(context).prepare();banks.set(context,pending);pending.catch(()=>banks.delete(context));}
  return pending;
}
