import {MusicEngine} from '../../src/audio';
import {DEFAULTS,selectProfile,musicScore,type MusicEvent} from '../../src/music';
import {createMastering} from '../../src/mastering';
import {nylonBuffer,nylonCacheStats,prepareNylon,nylonVoice} from '../../src/nylon';

// Run from a local browser harness after a user gesture. No dependency on a UI driver.
export async function runNylonAudio(progress:(text:string)=>void=()=>{}) {
 const ready=new MusicEngine();await ready.init();await ready.context!.close();
 const prepared=ready as any,results:unknown[]=[],buffers:Record<string,AudioBuffer>={};
 for(const mode of ['lofi','ambient','dub','dnb'] as const)for(const bpm of [50,180]){
  const s={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:'NYLONDEMO',bpm,groove:mode==='dnb'?'dnb' as const:'straight' as const,energy:100,evolution:100,reverb:100,volume:100};
  s.instruments={...s.instruments,arpeggio:'m-nylon'};
  const events=musicScore(s).onsets(0,8),metrics:Record<string,{peak:number;rms:number}>={};
  for(const part of ['full','arp','muted']){
   progress(`${mode} ${bpm} ${part}`);
   const ctx=new OfflineAudioContext(2,Math.ceil(48000*(8*240/bpm+4)),48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine() as any;
   Object.assign(engine,{context:ctx,destination:master.input,noise:prepared.noise,impulse:prepared.impulse,drumBank:prepared.drumBank});
   const scene=engine.makeScene({...s,arpeggio:part!=='muted'},0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
   const selected=events.filter(e=>part==='full'||e.layer==='arpeggio');
   for(const e of selected)engine.voice(scene,e,.15+e.at*240/bpm,e.length*240/bpm,bpm,s);
   const b=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of b.getChannelData(ch)){if(!Number.isFinite(x))throw Error('Nonfinite output');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error(`Output/cleanup: ${mode} ${bpm} ${part}`);
   metrics[part]={peak,rms:Math.sqrt(energy/(b.length*2))};
   if(part==='arp'&&metrics[part].rms<.0001)throw Error('Silent guitar');
   if(part==='muted'&&peak>1e-7)throw Error('Muted guitar audible');
  }
  results.push({mode,bpm,metrics});
 }
 // Prewarming covers all written guitar pitches, on any output device rate.
 for(const rate of [44100,96000]){
  const ctx=new OfflineAudioContext(2,rate*2,rate),t=performance.now();await prepareNylon(ctx);
  const before=nylonCacheStats(ctx);
  for(let note=48;note<=66;note++)for(const variation of [0,1]){
   const b=nylonBuffer(ctx,note,.57,variation);if(b.sampleRate!==48000)throw Error('Device-dependent guitar timbre');
  }
  const after=nylonCacheStats(ctx);
  if(before.renders!==after.renders||after.bytes>24*1024*1024)throw Error('Guitar prewarm/cache');
  const active=new Set<AudioScheduledSourceNode>(),cleanups=new Set<()=>void>();
  const e:MusicEvent={at:0,length:.25,voice:'arp',layer:'arpeggio',notes:[60],gain:.05,pan:0,cutoff:3000,instrument:'m-nylon',release:.09};
  nylonVoice(ctx,e,.1,.7,ctx.destination,active,cleanups);
  const b=await ctx.startRendering();let peak=0;for(const x of b.getChannelData(0)){if(!Number.isFinite(x))throw Error('Rate render');peak=Math.max(peak,Math.abs(x));}
  if(active.size||cleanups.size||peak<.001)throw Error('Rate cleanup');
  results.push({rate,prewarmMs:performance.now()-t,cache:after,peak});
 }
 // Friendly preview: one normal listening mix and the same guitar stem.
 const demo={...selectProfile(DEFAULTS,'lofi'),seed:'NYLONDEMO',bpm:88,energy:48,reverb:20};
 demo.instruments={...demo.instruments,arpeggio:'m-nylon'};
 for(const part of ['mix','guitar']){
  progress(`preview ${part}`);
  const ctx=new OfflineAudioContext(2,Math.ceil(48000*20),48000),master=createMastering(ctx);master.volume.gain.value=1;
  const engine=new MusicEngine() as any;Object.assign(engine,{context:ctx,destination:master.input,noise:prepared.noise,impulse:prepared.impulse,drumBank:prepared.drumBank});
  const scene=engine.makeScene(demo,0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
  for(const e of musicScore(demo).onsets(2,8).filter(e=>part==='mix'||e.layer==='arpeggio'))engine.voice(scene,e,.2+(e.at-2)*240/demo.bpm,e.length*240/demo.bpm,demo.bpm,demo);
  buffers[part]=await ctx.startRendering();
  if(scene.sources.size||scene.cleanups.size)throw Error('Preview cleanup');
 }
 return {results,buffers};
}
