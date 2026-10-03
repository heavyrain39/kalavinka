async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=saved-drums');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,normalizeSettings,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts'),{resolveDrumKit}=await import('/src/instruments.ts');
  const prepared=new MusicEngine();await prepared.init();await prepared.context.close();
  const results=[];
  for(const version of [1,2,3,4,5])for(const profile of ['lofi','ambient','dub']) {
   const s=normalizeSettings({...DEFAULTS,generatorVersion:version,profile,seed:'OLDMUSIC',bpm:version<3?130:180,energy:100,evolution:100,reverb:100,volume:100,groove:profile==='dub'?'dnb':'straight'});
   const ctx=new OfflineAudioContext(2,48000*10,48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine();engine.context=ctx;engine.destination=master.input;engine.noise=prepared.noise;engine.impulse=prepared.impulse;engine.drumBank=prepared.drumBank;
   const scene=engine.makeScene(s,0);scene.transport.stop();
   if(!scene.drums)throw Error('missing modern bus');
   const score=musicScore(s),bar=Array.from({length:64},(_,i)=>i+8).find(b=>score.onsets(b,b+1).some(e=>e.layer==='rhythm'))??8;
   const events=score.onsets(bar,bar+1),before=JSON.stringify(events);
   for(const event of events)engine.voice(scene,event,.1+(event.at-bar)*240/s.bpm,event.length*240/s.bpm,s.bpm,s);
   // Every drum uses a prepared AudioBufferSource; other instruments retain their paths.
   const bufferSources=[...scene.sources].filter(source=>source instanceof AudioBufferSourceNode&&source.buffer.duration<.5).length;
   if(events.some(e=>e.layer==='rhythm')&&!bufferSources)throw Error('legacy drum path still active');
   const buffer=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('invalid');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||peak<1e-5||energy<1e-8||scene.sources.size||scene.cleanups.size)throw Error('output/cleanup '+JSON.stringify({version,profile,bar,peak,energy,sources:scene.sources.size,cleanups:scene.cleanups.size}));
   if(before!==JSON.stringify(events)||scene.settings.generatorVersion!==version)throw Error('score changed');
   results.push({version,profile,kit:resolveDrumKit(s.instruments.rhythm,profile),peak,bufferSources});
  }
  return results;
 });
}
