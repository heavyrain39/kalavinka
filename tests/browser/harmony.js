async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg');return await page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore,eventsForBar}=await import('/src/music.ts'),{recipeFor,hasEnding}=await import('/src/harmony-v5.ts'),{instrumentVoice}=await import('/src/synth.ts'),{createMastering}=await import('/src/mastering.ts');
  const prepared=new MusicEngine();await prepared.init();const noise=prepared.noise,impulse=prepared.impulse;await prepared.context.close();
  const analyze=b=>{let peak=0,sum=0,invalid=0;for(let ch=0;ch<2;ch++)for(const x of b.getChannelData(ch)){if(!Number.isFinite(x))invalid++;peak=Math.max(peak,Math.abs(x));sum+=x*x;}return {peak,rms:Math.sqrt(sum/(b.length*2)),invalid};};
  const drums=[];for(const instrument of ['r-brush','r-tape','r-electro','r-click'])for(const voice of ['rim','tom']){
   const ctx=new OfflineAudioContext(2,48000,48000),chain=createMastering(ctx);chain.volume.gain.value=1;const active=new Set();instrumentVoice(ctx,{voice,instrument,layer:'rhythm',notes:voice==='tom'?[45]:[],gain:.04,at:0,length:.04,pan:0,cutoff:5000},.1,.1,noise,chain.input,active);const signal=analyze(await ctx.startRendering());if(signal.invalid||signal.rms<.001||signal.peak>.9||active.size)throw Error('drum '+JSON.stringify({instrument,voice,signal,active:active.size}));drums.push({instrument,voice,...signal});
  }
  const corpus=new Map();for(const profile of ['lofi','ambient','dub'])for(let i=0;i<200;i++){const s={...selectProfile(DEFAULTS,profile),seed:'RENDER'+i,bpm:180,energy:100,evolution:100,reverb:100,volume:100,groove:profile==='dub'?'dnb':'straight',layers:{...DEFAULTS.layers}};if(hasEnding(s,profile==='ambient'?31:15))corpus.set(recipeFor(s).id,s);}
  if(corpus.size!==30)throw Error('coverage');const mixes=[];
  for(const [id,s] of corpus){const start=s.profile==='ambient'?28:12;const ctx=new OfflineAudioContext(2,48000*9,48000),chain=createMastering(ctx);chain.volume.gain.value=1;const engine=new MusicEngine();engine.context=ctx;engine.destination=chain.input;engine.drumBank=prepared.drumBank;engine.noise=noise;engine.impulse=impulse;const scene=await engine.makeScene(s,0);scene.transport.stop();for(const source of scene.sources)source.stop(0);scene.sources.clear();
   for(const event of musicScore(s).onsets(start,start+4))engine.voice(scene,event,(event.at-start)*240/s.bpm+.15,event.length*240/s.bpm);
   const signal=analyze(await ctx.startRendering());if(signal.invalid||signal.rms<.001||signal.peak>.95||scene.sources.size)throw Error('mix '+JSON.stringify({id,signal,active:scene.sources.size}));mixes.push({id,...signal});
  }
  return {drums,mixes};
 });
}
