async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?crash-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const {crashEvent}=await import('/src/crash.ts'),{drumVoice,createDrumBus}=await import('/src/drums.ts');
  const ready=new MusicEngine();const t=performance.now();await ready.init();const prepareMs=performance.now()-t;await ready.context.close();
  const results=[],isolated=[];
  for(const kit of ['r-brush','r-tape','r-electro','r-click']){
   const renders=[];
   for(const choke of [false,true]){
    const ctx=new OfflineAudioContext(2,48000*4,48000),s={...selectProfile(DEFAULTS,'dub'),reverb:0},bus=createDrumBus(ctx,s),active=new Set(),cleanups=new Set(),hats=[];
    bus.output.connect(ctx.destination);
    const e={at:0,length:.125,voice:'crash',layer:'rhythm',notes:[],gain:.1,pan:.12,cutoff:9000,instrument:kit,velocity:.75,variation:0};
    drumVoice(ctx,ready.drumBank,bus,hats,e,.1,s,active,cleanups);
    if(choke)drumVoice(ctx,ready.drumBank,bus,hats,{...e,voice:'hat',gain:0,articulation:'closed'},.2,s,active,cleanups);
    const b=await ctx.startRendering();if(active.size||cleanups.size)throw Error('isolated source leak');renders.push(b.getChannelData(0));
   }
   let difference=0,tail=0;for(let i=0;i<renders[0].length;i++){difference=Math.max(difference,Math.abs(renders[0][i]-renders[1][i]));if(i>48000*.8&&i<48000*1.2)tail+=renders[1][i]**2;}
   tail=Math.sqrt(tail/(48000*.4));if(difference>1e-7||tail<.0001)throw Error('cymbal choked/short');isolated.push({kit,chokeDifference:difference,tailRms:tail});
  }
  for(const mode of ['lofi','dub','dnb'])for(const rhythm of ['r-brush','r-tape','r-electro','r-click']){
   const s={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:'CRASHDEMO',bpm:180,groove:mode==='dnb'?'dnb':'straight',melodyRepetition:1,energy:100,evolution:100,reverb:100,volume:100};
   s.instruments={...s.instruments,rhythm};
   const boundary=Array.from({length:32},(_,i)=>i*8).find(b=>crashEvent(s,b)),start=boundary-2;
   if(!Number.isFinite(boundary))throw Error('no cymbal in corpus');
   const ctx=new OfflineAudioContext(2,Math.ceil(48000*(8*240/s.bpm+5)),48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:master.input,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
   for(const e of musicScore(s).onsets(start,start+8))engine.voice(scene,e,.15+(e.at-start)*240/s.bpm,e.length*240/s.bpm,s.bpm,s);
   const b=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of b.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error('full mix/cleanup');
   results.push({mode,rhythm,boundary,peak,rms:Math.sqrt(energy/(b.length*2))});
  }
  return {prepareMs,bytes:ready.drumBank.bytes,sounds:ready.drumBank.size,isolated,fullMixes:results};
 });
}
