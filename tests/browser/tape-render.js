async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?tape-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const render=async(version,warmth,mute=false)=>{
   const bpm=78,s={...selectProfile(DEFAULTS,'lofi'),seed:'SLOWFLOW',generatorVersion:version,warmth,volume:100};
   if(mute){s.layers={harmony:false,bass:false,rhythm:false,motif:false};s.arpeggio=false;}
   const ctx=new OfflineAudioContext(2,Math.ceil(48000*(8*240/bpm+2)),48000),m=createMastering(ctx);m.volume.gain.value=1;
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:m.input,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   if(!!scene.tape!==(version>=21))throw Error('tape stage '+version);
   for(const e of musicScore(s).onsets(8,16))engine.voice(scene,e,.15+(e.at-8)*240/bpm,e.length*240/bpm,bpm,s);
   const buffer=await ctx.startRendering();let peak=0,energy=0;
   for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
   if(scene.sources.size)throw Error('leak');
   return {version,warmth,mute,peak,rms:Math.sqrt(energy/(buffer.length*2))};
  };
  const before=await render(20,72),after=await render(21,72),noise=await render(21,72,true),dry=await render(21,0,true);
  // Same level as v20 within 1 dB; the noise bed sits far below the music and vanishes at warmth 0.
  if(Math.abs(20*Math.log10(after.rms/before.rms))>1||after.peak>.95)throw Error('level '+JSON.stringify({before,after}));
  if(20*Math.log10(noise.rms/after.rms)>-35||dry.rms>1e-6)throw Error('noise '+JSON.stringify({noise,dry}));
  return {before,after,noise,dry};
 });
}
