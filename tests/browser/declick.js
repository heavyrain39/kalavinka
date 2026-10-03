async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=declick');
 return await page.evaluate(async()=>{
  const {scheduleEnvelope}=await import('/src/envelope.ts'),{scheduleDuck}=await import('/src/duck.ts');
  const sr=48000;
  const render=async(schedule)=>{const ctx=new OfflineAudioContext(1,sr,sr),source=ctx.createConstantSource(),gain=ctx.createGain();gain.gain.value=0;source.connect(gain).connect(ctx.destination);schedule(gain.gain);source.start();return (await ctx.startRendering()).getChannelData(0);};
  const delta=(x,t)=>{let peak=0;for(let i=Math.floor((t-.001)*sr);i<=Math.ceil((t+.001)*sr);i++)peak=Math.max(peak,Math.abs(x[i]-x[i-1]));return peak;};
  const opts={time:.1,amplitude:.5,attack:.025,hold:.08,decay:1,sustain:.72,release:.16,bass:false};
  const short=await render(p=>scheduleEnvelope(p,opts));
  if(delta(short,.18)>.001||Math.abs(short[Math.round(.346*sr)])>1e-8)throw Error('short sustain boundary');
  const bass=await render(p=>scheduleEnvelope(p,{...opts,amplitude:.15,attack:.007,hold:.1,sustain:.78,release:.055,bass:true}));
  const retained=bass[Math.round(.22*sr)]/bass[Math.round(.20*sr)];
  if(retained<.05||retained>.1||Math.abs(bass[Math.round(.261*sr)])>1e-8)throw Error('bass tail / gap');
  const duck=await render(p=>{p.setValueAtTime(1,0);scheduleDuck(p,.1,.5,120,0);scheduleDuck(p,.225,.5,120,0);});
  if(delta(duck,.221)>.003)throw Error('overlapping duck discontinuity');
  const {MusicEngine}=await import('/src/audio.ts'),{instrumentVoice}=await import('/src/synth.ts');
  const prepared=new MusicEngine();await prepared.init();const noise=prepared.noise;await prepared.context.close();
  const instruments=[];
  for(const id of ['h-organ','h-pad','m-flute','b-sub','b-round','b-pluck','b-analog']){
   const ctx=new OfflineAudioContext(2,sr,sr),active=new Set(),bass=id.startsWith('b'),hold=.08;
   instrumentVoice(ctx,{at:0,length:hold,instrument:id,layer:bass?'bass':id.startsWith('h')?'harmony':'motif',voice:bass?'bass':'keys',gain:.15,notes:[bass?36:60],cutoff:5000,pan:0},.1,hold,noise,ctx.destination,active);
   const x=(await ctx.startRendering()).getChannelData(0);let peak=0,tail=0;
   for(const sample of x){if(!Number.isFinite(sample))throw Error('invalid '+id);peak=Math.max(peak,Math.abs(sample));}
   for(let i=Math.floor((bass?.25:.80)*sr);i<x.length;i++)tail=Math.max(tail,Math.abs(x[i]));
   if(peak<.001||tail>1e-6||active.size)throw Error('voice tail / cleanup '+id);
   instruments.push({id,peak,tail});
  }
  return {shortBoundaryDelta:delta(short,.18),bassAt20ms:retained,duckBoundaryDelta:delta(duck,.221),instruments};
 });
}
