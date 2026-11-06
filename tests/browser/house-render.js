async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?house-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const bpm=108,res={};
  for(const harmony of ['h-organ','h-electric','h-pad','h-felt'])for(const v of [22,23]){
   const base=selectProfile(DEFAULTS,'dub'),s={...base,seed:'ZK9Q',generatorVersion:v,volume:100,instruments:{...base.instruments,harmony}};
   const ctx=new OfflineAudioContext(1,Math.ceil(48000*(8*240/bpm+2)),48000);
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:ctx.destination,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   if(!!scene.sweep!==(v>=23))throw Error('sweep stage '+v);
   scene.drums.output.disconnect();for(const l of ['bass','motif','arpeggio'])scene.layers[l].gain.value=0;
   for(const e of musicScore(s).onsets(8,16))engine.voice(scene,e,.15+(e.at-8)*240/bpm,e.length*240/bpm,bpm,s);
   const d=(await ctx.startRendering()).getChannelData(0);if(scene.sources.size)throw Error('leak');
   // Energy above ~3 kHz (8-pole one-pole cascade) against the whole chord signal.
   const k=Math.exp(-2*Math.PI*3000/48000),lp=new Array(8).fill(0);let hi=0,all=0;
   for(const x0 of d){if(!Number.isFinite(x0))throw Error('nonfinite');let x=x0;for(let j=0;j<8;j++){lp[j]=(1-k)*x+k*lp[j];x-=lp[j];}hi+=x*x;all+=x0*x0;}
   res[harmony+v]={top:10*Math.log10(hi/all),level:10*Math.log10(all)};
  }
  for(const h of ['h-organ','h-electric','h-pad','h-felt']){
   const a=res[h+22],b=res[h+23];
   if(b.top-a.top<6)throw Error('not brighter '+h+JSON.stringify({a,b}));
   if(b.level-a.level>4)throw Error('too loud '+h+JSON.stringify({a,b}));
  }
  return res;
 });
}
