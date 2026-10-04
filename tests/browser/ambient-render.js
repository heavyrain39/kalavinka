async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?ambient-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();const results=[];
  for(const bpm of [50,180])for(const harmony of ['h-pad','h-organ','h-felt','h-electric']){
   const s={...selectProfile(DEFAULTS,'ambient'),seed:'AMBIENTQA',bpm,energy:100,evolution:100,reverb:100,volume:100};
   s.instruments={...s.instruments,harmony};
   const ctx=new OfflineAudioContext(2,Math.ceil(48000*(8*240/bpm+7)),48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:master.input,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
   for(const e of musicScore(s).onsets(0,8))engine.voice(scene,e,.15+e.at*240/bpm,e.length*240/bpm,bpm,s);
   const buffer=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error('render '+JSON.stringify({bpm,harmony,peak,active:scene.sources.size}));
   results.push({bpm,harmony,peak,rms:Math.sqrt(energy/(buffer.length*2))});
  }
  return {renders:results.length,results};
 });
}
