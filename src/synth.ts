// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import type { MusicEvent } from './music';

// Small oscillator/FM/noise palettes; no samples, downloads or per-note worklets.
export function instrumentVoice(context: BaseAudioContext, event: MusicEvent, time: number, duration: number,
  noiseBuffer: AudioBuffer, destination: AudioNode, active: Set<AudioScheduledSourceNode>) {
  const id=event.instrument!, percussion=event.layer==='rhythm', bass=event.layer==='bass';
  const gain=context.createGain(), filter=context.createBiquadFilter(), pan=context.createStereoPanner();
  filter.type='lowpass';filter.frequency.value=event.cutoff;filter.Q.value=.55;pan.pan.value=event.pan;
  gain.connect(filter).connect(pan).connect(destination);
  const nodes:AudioNode[]=[gain,filter,pan], sources:AudioScheduledSourceNode[]=[];
  let attack=.006, release=.10, sustain=.24, level=1, hold=duration;
  if(id==='h-felt'){attack=.009;release=.16;sustain=.18;level=.94;filter.frequency.value*=.85;}
  if(id==='h-electric'){attack=.006;release=.20;sustain=.24;level=.92;}
  if(id==='h-organ'){attack=.022;release=.09;sustain=.62;level=.64;}
  if(id==='h-pad'){attack=Math.min(.24,duration*.32);release=.24;sustain=.75;level=.85;filter.frequency.value*=.86;}
  if(id==='m-bell'){attack=.003;release=.12;sustain=.16;level=.80;filter.frequency.value*=1.25;}
  if(id==='m-marimba'){attack=.004;release=.055;sustain=.11;level=1.12;filter.frequency.value*=.85;}
  if(id==='m-flute'){attack=Math.min(.04,duration*.25);release=.12;sustain=.65;level=.64;filter.frequency.value*=.9;}
  if(id==='m-pluck'){attack=.005;release=.09;sustain=.19;level=.88;}
  if(bass){attack=.007;release=.065;sustain=id==='b-pluck'?.27:.65;level=id==='b-analog'?.74:id==='b-sub'?1.12:1;filter.frequency.value=id==='b-analog'?650:id==='b-pluck'?850:440;}
  if(percussion){
    attack=.003;release=.015;sustain=.035;
    hold=event.voice==='kick'?(id==='r-click'?.13:id==='r-brush'?.18:.24):event.voice==='snare'?(id==='r-brush'?.18:id==='r-click'?.055:.115):id==='r-brush'?.07:.035;
    level=id==='r-brush'?.78:id==='r-click'?.80:1;
  }
  hold=Math.max(hold,attack+.012);
  const end=time+hold+release, amplitude=event.gain*level/Math.max(1,event.notes.length);
  gain.gain.setValueAtTime(0,time);
  gain.gain.linearRampToValueAtTime(amplitude,time+attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(.00001,amplitude*sustain),time+Math.min(hold,attack+(bass?.13:.22)));
  gain.gain.setValueAtTime(Math.max(.00001,amplitude*sustain),time+hold);
  gain.gain.exponentialRampToValueAtTime(.00001,end);gain.gain.setValueAtTime(0,end+.005);
  const osc=(frequency:number,type:OscillatorType='sine',amount=1,detune=0)=>{
    const source=context.createOscillator(),mix=context.createGain();source.type=type;source.frequency.value=frequency;source.detune.value=detune;mix.gain.value=amount;
    source.connect(mix).connect(gain);nodes.push(mix);sources.push(source);return source;
  };
  const fm=(frequency:number,ratio:number,index:number,decay:number,amount=1)=>{
    const carrier=osc(frequency,'sine',amount),mod=context.createOscillator(),depth=context.createGain();
    mod.frequency.value=frequency*ratio;depth.gain.setValueAtTime(frequency*index,time);depth.gain.exponentialRampToValueAtTime(.001,time+decay);
    mod.connect(depth).connect(carrier.frequency);sources.push(mod);nodes.push(depth);
  };
  const noise=(highpass:number,amount:number)=>{
    const source=context.createBufferSource(),hp=context.createBiquadFilter(),mix=context.createGain();source.buffer=noiseBuffer;
    hp.type='highpass';hp.frequency.value=highpass;mix.gain.value=amount;source.connect(hp).connect(mix).connect(gain);sources.push(source);nodes.push(hp,mix);
  };
  if(percussion){
    if(event.voice==='kick'){
      const start=id==='r-electro'?135:id==='r-click'?165:id==='r-brush'?85:110;
      const bottom=id==='r-electro'?42:id==='r-click'?65:48;
      const source=osc(start);source.frequency.setValueAtTime(start,time);source.frequency.exponentialRampToValueAtTime(bottom,time+(id==='r-click'?.035:.085));
      filter.frequency.value=id==='r-click'?950:500;
      if(id==='r-electro')osc(bottom,'triangle',.13);
    }else if(event.voice==='snare'){
      noise(id==='r-brush'?650:id==='r-click'?2100:1200,id==='r-brush'?.85:.7);
      if(id!=='r-brush')osc(id==='r-electro'?195:id==='r-click'?400:175,'sine',.32);
      filter.frequency.value=id==='r-tape'?3400:id==='r-brush'?4200:6500;
    }else{
      if(id==='r-electro'){osc(7100,'square',.12);osc(9300,'square',.09);noise(5800,.45);}
      else noise(id==='r-brush'?3700:id==='r-click'?7200:5000,id==='r-click'?.75:1);
      filter.frequency.value=id==='r-brush'?6400:9200;
    }
  }else for(const note of event.notes){
    const f=440*2**((note-69)/12);
    switch(id){
      case 'h-felt': fm(f,1,.35,.12,.82);osc(f,'triangle',.18);break;
      case 'h-electric': fm(f,2,.85,.42,.85);osc(f*2,'sine',.12);break;
      case 'h-organ': osc(f,'sine',.64);osc(f*2,'sine',.23);osc(f*3,'sine',.10);break;
      case 'h-pad': osc(f,'triangle',.48,-5);osc(f,'sine',.48,5);break;
      case 'b-sub': osc(f,'sine');break;
      case 'b-round': osc(f,'sine',.78);osc(f,'triangle',.22);break;
      case 'b-pluck': fm(f,1,.75,.11,.8);osc(f,'triangle',.2);break;
      case 'b-analog': osc(f,'sawtooth',.26,-3);osc(f,'triangle',.3,3);osc(f,'sine',.44);break;
      case 'm-bell': fm(f,2.01,1.7,.30,.9);osc(f*3,'sine',.05);break;
      case 'm-marimba': fm(f,3.99,.7,.055,.82);osc(f,'sine',.18);break;
      case 'm-flute': osc(f,'sine',.82);osc(f*2,'sine',.13);osc(f*3,'sine',.04);break;
      case 'm-pluck': fm(f,2,1.1,.13,.8);osc(f,'triangle',.2);break;
      default: osc(f);
    }
  }
  let alive=sources.length;
  for(const source of sources){
    active.add(source);source.onended=()=>{active.delete(source);source.disconnect();if(--alive===0)for(const node of nodes)node.disconnect();};
    source.start(time);source.stop(end+.015);
  }
}
