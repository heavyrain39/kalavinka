// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {MusicEvent, Settings} from './music';
import {DrumBank, type DrumSound} from './drum-bank';
import {ownVoice} from './source-lifecycle';

export function createDrumBus(context:BaseAudioContext,settings:Settings) {
  const input=context.createGain(),kick=context.createBiquadFilter(),snare=context.createBiquadFilter(),hat=context.createBiquadFilter(),perc=context.createBiquadFilter();
  kick.type='highpass';kick.frequency.value=26;snare.type='highpass';snare.frequency.value=125;
  hat.type='highpass';hat.frequency.value=3600;perc.type='highpass';perc.frequency.value=95;
  const dnb=settings.profile==='dub'&&settings.groove==='dnb';
  for(const node of [kick,snare,hat,perc]){node.Q.value=.707;node.connect(input);}
  const body=context.createBiquadFilter();body.type='peaking';body.frequency.value=320;body.Q.value=.8;body.gain.value=-1.2;
  const color=context.createWaveShaper();color.oversample='2x';
  color.curve=Float32Array.from({length:4097},(_,i)=>{const x=i/2048-1,m=Math.abs(x);return m<=.18?x:Math.sign(x)*(.18+.62*Math.tanh((m-.18)/.62));});
  const glue=context.createDynamicsCompressor();glue.threshold.value=-18;glue.knee.value=10;glue.ratio.value=1.5;
  glue.attack.value=dnb?.015:.022;glue.release.value=dnb?.085:.13;
  // Serial mild compression avoids misaligned dry/processed attacks from lookahead.
  const output=context.createGain();output.gain.value=.83;
  input.connect(body).connect(color).connect(glue).connect(output);
  const room=context.createConvolver(),buffer=context.createBuffer(2,Math.ceil(context.sampleRate*.19),context.sampleRate);
  let rng=84721;for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const t=i/context.sampleRate;data[i]=((rng>>>0)/2147483648-1)*Math.exp(-t/.028)*(1-Math.exp(-t/.003));}}
  room.buffer=buffer;
  const send=context.createGain(),snareSend=context.createGain(),hatSend=context.createGain(),percSend=context.createGain();
  snareSend.gain.value=.7;hatSend.gain.value=.13;percSend.gain.value=.35;
  snare.connect(snareSend).connect(send);hat.connect(hatSend).connect(send);perc.connect(percSend).connect(send);
  const hp=context.createBiquadFilter(),lp=context.createBiquadFilter(),wet=context.createGain();
  hp.type='highpass';hp.frequency.value=600;lp.type='lowpass';lp.frequency.value=6000;
  wet.gain.value=drumRoomGain(settings.reverb);
  send.connect(hp).connect(room).connect(lp).connect(wet).connect(input);
  return {kick,snare,hat,perc,output,glue,wet,nodes:[input,kick,snare,hat,perc,body,color,glue,output,send,snareSend,hatSend,percSend,hp,room,lp,wet]};
}
export const drumRoomGain=(amount:number)=>Math.min(100,Math.max(0,amount))*.0024;
export type DrumBus=ReturnType<typeof createDrumBus>;
export interface HatVoice {gain:GainNode; sources:AudioBufferSourceNode[]; end:number}

export function drumVoice(context:BaseAudioContext,bank:DrumBank,bus:DrumBus,hats:HatVoice[],event:MusicEvent,time:number,settings:Settings,
  active:Set<AudioScheduledSourceNode>,cleanups:Set<()=>void>) {
  const hat=event.voice==='hat',kick=event.voice==='kick',snare=event.voice==='snare';
  const sound:DrumSound=hat?(event.articulation??'closed'):kick?'kick':snare?'snare':event.voice==='tom'?'tom':'rim';
  const mode=settings.profile==='dub'&&settings.groove==='dnb'?'dnb':'house';
  const gain=context.createGain(),pan=context.createStereoPanner();
  // Performance gain remains continuous; velocity layers change the timbre, not just volume.
  gain.gain.setValueAtTime(event.gain*(kick?1.2:snare?1.8:hat?1.15:1.2),time);
  pan.pan.value=kick||snare?0:Math.max(-.22,Math.min(.22,event.pan));
  gain.connect(pan).connect(kick?bus.kick:snare?bus.snare:hat?bus.hat:bus.perc);
  if(hat) {
    for(const previous of hats)if(previous.end>time) {
      previous.gain.gain.cancelAndHoldAtTime(time);
      previous.gain.gain.linearRampToValueAtTime(0,time+.008);
      for(const source of previous.sources)source.stop(time+.009);
    }
    hats.length=0;
  }
  const sources:AudioBufferSourceNode[]=[],nodes:AudioNode[]=[gain,pan];let end=time;
  for(const layer of bank.get(event.instrument??'r-tape',mode,sound,event.velocity??.7,event.variation??0)) {
    if(layer.weight<=0)continue;
    if(!layer.buffer)throw Error('Drum bank not prepared');
    const source=context.createBufferSource(),weight=context.createGain();source.buffer=layer.buffer;weight.gain.value=layer.weight;
    const rate=event.voice==='tom'?2**(((event.notes[0]??45)-45)/12):1;source.playbackRate.value=rate;
    source.connect(weight).connect(gain);sources.push(source);nodes.push(weight);end=Math.max(end,time+layer.buffer.duration/rate);
  }
  ownVoice(sources,nodes,active,cleanups);
  for(const source of sources){source.start(time);source.stop(end+.001);}
  if(hat)hats.push({gain,sources,end});
}
