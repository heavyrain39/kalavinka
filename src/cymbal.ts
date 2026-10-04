// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {hash} from './seed';

// Constant-peak bandpass; all excitation is our own seeded noise.
function bandpass(rate:number,frequency:number,q:number) {
  const w=2*Math.PI*Math.min(rate*.40,frequency)/rate,a=Math.sin(w)/(2*q);
  const b=a/(1+a),a1=-2*Math.cos(w)/(1+a),a2=(1-a)/(1+a);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
function random(seed:string) {
  let state=hash(seed)||1;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1;};
}

/** Original stereo cymbal: overlapping noise resonances bloom, then darken as they decay.
 * No recordings, sampled spectra, phase data or third-party waveforms are embedded. */
export function renderCymbal(rate:number,kit:string,variant:number):[Float32Array<ArrayBuffer>,Float32Array<ArrayBuffer>] {
  const brush=kit==='r-brush',tape=kit==='r-tape',electro=kit==='r-electro';
  const duration=brush?3.4:tape?3.8:electro?3.2:2.7,decay=brush?.61:tape?.66:electro?.55:.48;
  const color=brush?.95:electro?1.06:1,rr=variant%2?1.008:.992;
  const bands=[
    {f:2900,q:1.6,weight:.20,decay:decay*1.15},
    {f:4700,q:1.35,weight:1,decay},
    {f:7200,q:1.5,weight:brush?.40:.53,decay:decay*.66},
    {f:10500,q:1.3,weight:brush?.08:.14,decay:decay*.45},
  ];
  const count=Math.ceil(rate*duration),left=new Float32Array(count),right=new Float32Array(count);
  const shared=random(`${kit}:cymbal:${variant}:shared`),randoms=[random(`${kit}:cymbal:${variant}:left`),random(`${kit}:cymbal:${variant}:right`)];
  const filters=[0,1].map(()=>bands.map(b=>[bandpass(rate,b.f*color*rr,b.q),bandpass(rate,b.f*color*rr,b.q)]));
  const envelopes=bands.map(b=>b.weight),decays=bands.map(b=>Math.exp(-1/(rate*b.decay)));
  const outputs=[left,right];let energy=0,frames=0;
  for(let i=0;i<count;i++) {
    const t=i/rate,rise=Math.sin(Math.PI*.5*Math.min(1,t/(brush?.12:.10)))**2;
    const fade=Math.sin(Math.PI*.5*Math.min(1,(duration-t)/.08))**2,n=shared();
    for(let ch=0;ch<2;ch++) {
      // Mostly diffuse stereo, with a quiet coherent center that survives mono playback.
      const excitation=.35*n+.93675*randoms[ch]();let x=0;
      for(let k=0;k<bands.length;k++) {
        const f=filters[ch][k];
        x+=f[1](f[0](excitation))*envelopes[k];
      }
      outputs[ch][i]=x*rise*fade;
      if(t>=.1&&t<.6){energy+=outputs[ch][i]**2;frames++;}
    }
    for(let k=0;k<bands.length;k++)envelopes[k]*=decays[k];
  }
  // Keep the kit/variation body levels consistent without boosting the separate preview.
  const gain=.045/Math.max(1e-9,Math.sqrt(energy/frames));
  for(const data of outputs){for(let i=0;i<count;i++)data[i]*=gain;data[0]=0;data[count-1]=0;}
  return [left,right];
}
