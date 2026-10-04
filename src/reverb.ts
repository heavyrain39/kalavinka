// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
export const reverbGain = (amount: number) => .46 * Math.min(100, Math.max(0, Number.isFinite(amount) ? amount : 0)) / 100;

/** Locally made hall: reflected onset, diffuse stereo tail, faster high/low decay. */
export function createAmbientImpulse(context:BaseAudioContext):AudioBuffer{
  const rate=context.sampleRate,buffer=context.createBuffer(2,Math.ceil(rate*5.8),rate);
  let state=0x4c414e47;
  const noise=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296*2-1;};
  const lowStep=1-Math.exp(-2*Math.PI*260/rate),midStep=1-Math.exp(-2*Math.PI*3200/rate);
  for(let ch=0;ch<2;ch++){
    const data=buffer.getChannelData(ch);let low=0,mid=0;
    for(let i=0;i<data.length;i++){
      const t=i/rate,n=noise();low+=lowStep*(n-low);mid+=midStep*(n-mid);
      const bloom=1-Math.exp(-t/.075),fade=Math.min(1,(5.8-t)/.15);
      data[i]=bloom*fade*(low*Math.exp(-6.9078*t/2.5)+(mid-low)*Math.exp(-6.9078*t/4.2)+(n-mid)*.32*Math.exp(-6.9078*t/1.9));
    }
    for(const [index,delay] of [.021,.037,.061,.093,.137].entries()){
      const at=Math.floor((delay+ch*(index%2?.004:-.003))*rate);
      for(let i=0;i<rate*.008;i++)data[at+i]+=noise()*.24/(1+index*.35)*Math.exp(-i/(rate*.0016));
    }
  }
  return buffer;
}

export function createRoom(context: BaseAudioContext, impulse: AudioBuffer, amount: number, ambient=false) {
  const input = context.createBiquadFilter(); input.type = 'highpass'; input.frequency.value = 220;
  const preDelay = context.createDelay(.1); preDelay.delayTime.value = ambient?.012:.018;
  const room = context.createConvolver(); room.buffer = impulse;
  const damping = context.createBiquadFilter(); damping.type = 'lowpass'; damping.frequency.value = ambient?4800:3400;
  const wet = context.createGain(); wet.gain.value = reverbGain(amount);
  input.connect(preDelay).connect(room).connect(damping).connect(wet);
  return { input, wet, nodes: [input, preDelay, room, damping, wet] };
}
