async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=melody');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const prepared=new MusicEngine();await prepared.init();await prepared.context.close();const results=[];
  for(const mode of ['lofi','ambient','dub','dnb'])for(const instrument of ['m-bell','m-marimba','m-flute','m-pluck']){
   const s={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:'MELODY7',bpm:180,energy:100,evolution:100,reverb:100,volume:100,groove:mode==='dnb'?'dnb':'straight'};s.instruments={...s.instruments,motif:instrument};
   const score=musicScore(s),start=[8,16,24,32,40,48,56,64].find(b=>score.onsets(b,b+8).some(e=>e.role==='neighbor'));
   if(start===undefined)throw Error('missing tension '+mode);
   const ctx=new OfflineAudioContext(2,48000*13,48000),master=createMastering(ctx);master.volume.gain.value=1;
   const engine=new MusicEngine();engine.context=ctx;engine.destination=master.input;engine.noise=prepared.noise;engine.impulse=prepared.impulse;engine.drumBank=prepared.drumBank;
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
   const events=score.onsets(start,start+8);
   for(const event of events)engine.voice(scene,event,.15+(event.at-start)*240/s.bpm,event.length*240/s.bpm,s.bpm,s);
   const buffer=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(peak>.95||energy<1e-6||scene.sources.size||scene.cleanups.size)throw Error('render '+JSON.stringify({mode,instrument,peak,energy,sources:scene.sources.size,cleanups:scene.cleanups.size}));
   results.push({mode,instrument,start,tensions:events.filter(e=>e.role==='neighbor').length,peak});
  }
  return {cases:results.length,maxPeak:Math.max(...results.map(r=>r.peak)),results};
 });
}
