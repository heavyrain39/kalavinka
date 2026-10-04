async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?bass-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();const results=[];
  for(const seed of ['BASSRENDER','PULSE2'])for(const mode of ['lofi','ambient','dub','dnb'])for(const bass of ['b-round','b-sub','b-pluck','b-analog']){
   const s={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed,bpm:180,groove:mode==='dnb'?'dnb':'straight',melodyRepetition:1,energy:100,evolution:100,reverb:100,volume:100};
   s.instruments={...s.instruments,bass};
   const ctx=new OfflineAudioContext(2,Math.ceil(48000*(8*240/s.bpm+7)),48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:master.input,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const t=performance.now(),scene=engine.makeScene(s,0),sceneMs=performance.now()-t;scene.transport.stop();for(const source of scene.sources)source.stop(0);
   const start=seed==='PULSE2'?8:0;
   for(const e of musicScore(s).onsets(start,start+8))engine.voice(scene,e,.15+(e.at-start)*240/s.bpm,e.length*240/s.bpm,s.bpm,s);
   const buffer=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error('render '+JSON.stringify({mode,bass,peak,active:scene.sources.size}));
   results.push({seed,mode,bass,peak,rms:Math.sqrt(energy/(buffer.length*2)),sceneMs});
  }
  return {renders:results.length,results};
 });
}
