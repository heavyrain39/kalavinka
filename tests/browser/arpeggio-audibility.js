async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=arp-audibility');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const prepared=new MusicEngine();await prepared.init();await prepared.context.close();const results=[];
  for(const mode of ['dub','dnb'])for(const sound of ['m-bell','m-marimba','m-flute','m-pluck']){
   const s={...selectProfile(DEFAULTS,'dub'),seed:'SLOWFLOW',bpm:mode==='dnb'?170:108,groove:mode==='dnb'?'dnb':'straight',volume:100};
   s.instruments={...s.instruments,arpeggio:sound};
   const events=musicScore(s).onsets(0,8),metrics={},duration=8*240/s.bpm+3;
   for(const part of ['full','arp','previous-level','muted','melody']){
    const ctx=new OfflineAudioContext(2,Math.ceil(48000*duration),48000),master=createMastering(ctx);master.volume.gain.value=1;
    const engine=new MusicEngine();engine.context=ctx;engine.destination=master.input;engine.noise=prepared.noise;engine.impulse=prepared.impulse;engine.drumBank=prepared.drumBank;
    const scene=engine.makeScene({...s,arpeggio:part!=='muted'},0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
    if(part==='previous-level')scene.layers.arpeggio.gain.value=1;
    const selected=events.filter(e=>part==='full'||e.layer===(part==='melody'?'motif':'arpeggio'));
    if(!selected.length)throw Error('empty '+mode+'/'+part);
    for(const event of selected)engine.voice(scene,event,.15+event.at*240/s.bpm,event.length*240/s.bpm,s.bpm,s);
    const buffer=await ctx.startRendering();let peak=0,energy=0;
    for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
    if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error('render bounds '+JSON.stringify({mode,part,peak}));
    metrics[part]={peak,rms:Math.sqrt(energy/(buffer.length*2))};
   }
   const improvement=20*Math.log10(metrics.arp.rms/metrics['previous-level'].rms),relativeMelody=20*Math.log10(metrics.arp.rms/metrics.melody.rms);
   if(metrics.muted.peak>1e-7||improvement<6.5||relativeMelody< -20||relativeMelody>0)throw Error('level/mute '+JSON.stringify({mode,sound,improvement,relativeMelody,metrics}));
   const first=events.find(e=>e.layer==='arpeggio');if(first.at<2||first.at>=3)throw Error('late entrance');
   results.push({mode,sound,firstSeconds:first.at*240/s.bpm,improvementDb:improvement,relativeMelodyDb:relativeMelody,fullPeak:metrics.full.peak});
  }
  return {renders:results.length*5,results};
 });
}
