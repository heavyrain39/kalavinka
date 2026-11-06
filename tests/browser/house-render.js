async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?house-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const bpm=108,res={};
  // Music bus only (drums out, bass dry muted): intro bars 0–2 against groove bars 10–12.
  for(const v of [22,23])for(const start of [0,10]){
   const s={...selectProfile(DEFAULTS,'dub'),seed:'ZK9Q',generatorVersion:v,volume:100};
   const ctx=new OfflineAudioContext(1,Math.ceil(48000*(2*240/bpm+1)),48000);
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:ctx.destination,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   if(!!scene.sweep!==(v>=23))throw Error('sweep stage '+v);
   scene.drums.output.disconnect();scene.layers.bass.gain.value=0;
   for(const e of musicScore(s).onsets(start,start+2))engine.voice(scene,e,.15+(e.at-start)*240/bpm,e.length*240/bpm,bpm,s);
   const d=(await ctx.startRendering()).getChannelData(0);if(scene.sources.size)throw Error('leak');
   let all=0;for(const x of d){if(!Number.isFinite(x))throw Error('nonfinite');all+=x*x;}
   res[`v${v}@${start}`]=+(10*Math.log10(all/d.length)).toFixed(2);
  }
  if(res['v22@0']-res['v23@0']<6)throw Error('intro not filtered '+JSON.stringify(res));
  if(Math.abs(res['v22@10']-res['v23@10'])>.3)throw Error('groove changed '+JSON.stringify(res));
  return res;
 });
}
