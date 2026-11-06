async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?swell-render');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts');
  const ready=new MusicEngine();await ready.init();await ready.context.close();
  const bpm=108,bar=240/bpm,from=22,out={};
  // SLOWFLOW deep house: a build-up in bar 23 lands on the return crash at bar 24.
  for(const v of [24,25]){
   const s={...selectProfile(DEFAULTS,'dub'),seed:'SLOWFLOW',generatorVersion:v,volume:100};
   const ctx=new OfflineAudioContext(1,Math.ceil(48000*(3*bar+4.5)),48000);
   const engine=new MusicEngine();Object.assign(engine,{context:ctx,destination:ctx.destination,noise:ready.noise,impulse:ready.impulse,drumBank:ready.drumBank});
   const scene=engine.makeScene(s,0);scene.transport.stop();for(const src of scene.sources)src.stop(0);
   const onsets=musicScore(s).onsets(from,from+3);
   if(onsets.some(e=>e.reverse)!==(v===25))throw Error('swell in score '+v);
   for(const e of onsets)engine.voice(scene,e,.15+(e.at-from)*bar,e.length*bar,bpm,s);
   const d=(await ctx.startRendering()).getChannelData(0);if(scene.sources.size)throw Error('leak');
   // Energy above ~4 kHz (two one-pole high-passes), per window.
   const k=Math.exp(-2*Math.PI*4000/48000);let l1=0,l2=0;const hi=new Float32Array(d.length);
   for(let i=0;i<d.length;i++){if(!Number.isFinite(d[i]))throw Error('nonfinite');l1=(1-k)*d[i]+k*l1;let x=d[i]-l1;l2=(1-k)*x+k*l2;hi[i]=x-l2;}
   const db=(a,t0,t1)=>{let e=0;const i0=Math.floor(t0*48000),i1=Math.floor(t1*48000);for(let i=i0;i<i1;i++)e+=a[i]*a[i];return 10*Math.log10(e/(i1-i0)+1e-15);};
   const down=.15+2*bar;
   out[v]={early:db(hi,down-bar*.5-.3,down-bar*.5-.05),late:db(hi,down-.25,down-.01),crash:db(d,down+.02,down+.32),body:db(d,.15,down-bar*.5-.05)};
  }
  const a=out[24],b=out[25];
  if(Math.abs(a.body-b.body)>.1||Math.abs(a.early-b.early)>.5)throw Error('changed before the swell '+JSON.stringify(out));
  if(b.late-a.late<6)throw Error('no audible swell '+JSON.stringify(out));
  if(Math.abs(a.crash-b.crash)>1)throw Error('crash changed '+JSON.stringify(out));
  return out;
 });
}
