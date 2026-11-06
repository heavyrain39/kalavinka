async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?tapestop-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{tapeStopBar,STOP_AT}=await import('/src/tapestop-v24.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const bpm=78,bar=240/bpm,from=46,stopBar=47,out={};
  // Two bars into the stop and one bar after it (SLOWFLOW stops at the end of bar 47).
  for(const v of [23,24]){
   const s={...selectProfile(DEFAULTS,'lofi'),seed:'SLOWFLOW',generatorVersion:v,volume:100};
   if(v===24&&!tapeStopBar(s,stopBar))throw Error('no stop planned');
   const ctx=new OfflineAudioContext(1,Math.ceil(48000*(3*bar+1)),48000);
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:ctx.destination,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   for(const e of musicScore(s).onsets(from,from+3))engine.voice(scene,e,.15+(e.at-from)*bar,e.length*bar,bpm,s);
   if(engine.diagnostics().tapeStops!==(v===24?1:0))throw Error('stop count '+v);
   const d=(await ctx.startRendering()).getChannelData(0);if(scene.sources.size)throw Error('leak');
   const db=(t0,t1)=>{let a=0;const i0=Math.floor(t0*48000),i1=Math.floor(t1*48000);for(let i=i0;i<i1;i++){if(!Number.isFinite(d[i]))throw Error('nonfinite');a+=d[i]*d[i];}return 10*Math.log10(a/(i1-i0)+1e-12);};
   const start=.15+(stopBar-from+STOP_AT)*bar,end=.15+(stopBar-from+1)*bar;
   out[v]={before:db(start-bar,start),tail:db(end-.1,end),after:db(end+.05,end+bar*.75)};
  }
  const a=out[23],b=out[24];
  if(Math.abs(a.before-b.before)>.1)throw Error('changed before the stop '+JSON.stringify(out));
  if(b.tail>b.before-20)throw Error('stop does not fade '+JSON.stringify(out));
  if(Math.abs(a.after-b.after)>1)throw Error('breakdown changed '+JSON.stringify(out));
  return out;
 });
}
