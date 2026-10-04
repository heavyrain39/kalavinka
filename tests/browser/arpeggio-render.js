async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=arp-audio');
 return page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,selectProfile,musicScore}=await import('/src/music.ts'),{createMastering}=await import('/src/mastering.ts');
  const prepared=new MusicEngine();await prepared.init();await prepared.context.close();const results=[];
  for(const mode of ['lofi','ambient','dub','dnb']){
   const s={...selectProfile(DEFAULTS,mode==='dnb'?'dub':mode),seed:'ARPRENDER',bpm:180,energy:100,evolution:100,reverb:100,volume:100,groove:mode==='dnb'?'dnb':'straight'};
   s.instruments={...s.instruments,arpeggio:'m-flute'};
   const score=musicScore(s),start=mode==='ambient'||mode==='dnb'?16:8,events=score.onsets(start,start+8),metrics={};
   for(const part of ['full','arp','muted','melody']){
    const ctx=new OfflineAudioContext(2,48000*13,48000),master=createMastering(ctx);master.volume.gain.value=1;
    const engine=new MusicEngine();engine.context=ctx;engine.destination=master.input;engine.noise=prepared.noise;engine.impulse=prepared.impulse;engine.drumBank=prepared.drumBank;
    const scene=engine.makeScene({...s,arpeggio:part!=='muted'},0);scene.transport.stop();for(const source of scene.sources)source.stop(0);
    const selected=events.filter(e=>part==='full'||e.layer===(part==='melody'?'motif':'arpeggio'));
    if(!selected.length)throw Error('empty '+mode+'/'+part);
    for(const event of selected)engine.voice(scene,event,.15+(event.at-start)*240/s.bpm,event.length*240/s.bpm,s.bpm,s);
    const buffer=await ctx.startRendering();let peak=0,energy=0;
    for(let ch=0;ch<2;ch++)for(const x of buffer.getChannelData(ch)){if(!Number.isFinite(x))throw Error('nonfinite');peak=Math.max(peak,Math.abs(x));energy+=x*x;}
    if(peak>.95||scene.sources.size||scene.cleanups.size)throw Error('render bounds '+JSON.stringify({mode,part,peak,sources:scene.sources.size,cleanups:scene.cleanups.size}));
    metrics[part]={peak,rms:Math.sqrt(energy/(buffer.length*2))};
   }
   if(metrics.muted.peak>1e-7||metrics.arp.rms<=1e-6||metrics.arp.rms>=metrics.melody.rms)throw Error('level/mute '+JSON.stringify({mode,metrics}));
   results.push({mode,metrics});
  }
  return {cases:results.length*4,results};
 });
}
