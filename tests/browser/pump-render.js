async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?pump-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const bpm=108,beat=60/bpm,res={};
  for(const only of ['bass','music'])for(const v of [21,22]){
   const s={...selectProfile(DEFAULTS,'dub'),seed:'SLOWFLOW',generatorVersion:v,volume:100};
   const ctx=new OfflineAudioContext(1,Math.ceil(48000*(8*240/bpm+2)),48000);
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:ctx.destination,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   if(!!scene.pump!==(v>=22))throw Error('pump stage '+v);
   scene.drums.output.disconnect();
   for(const l of ['harmony','motif','arpeggio','bass'])if((only==='bass')!==(l==='bass'))scene.layers[l].gain.value=0;
   for(const e of musicScore(s).onsets(8,16))engine.voice(scene,e,.15+(e.at-8)*240/bpm,e.length*240/bpm,bpm,s);
   const d=(await ctx.startRendering()).getChannelData(0),sr=48000;
   if(scene.sources.size)throw Error('leak');
   const rms=(a,b)=>{let x=0;const i0=Math.floor(a*sr),i1=Math.floor(b*sr);for(let i=i0;i<i1;i++)x+=d[i]*d[i];return Math.sqrt(x/(i1-i0));};
   let dip=0,rest=0;for(let k=0;k<32;k++){const t=.15+k*beat;dip+=rms(t+.015,t+.045);rest+=rms(t+.38,t+.48);}
   res[only+v]=20*Math.log10(dip/rest);
  }
  // The music bus dips at least 3 dB more right after each kick; the bass duck is unchanged.
  if(res.music22-res.music21>-3||Math.abs(res.bass22-res.bass21)>.5)throw Error('pump '+JSON.stringify(res));
  return res;
 });
}
