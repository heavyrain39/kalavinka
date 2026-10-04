async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=drums');
 return page.evaluate(async()=>{
  const {prepareDrums}=await import('/src/drum-bank.ts'),{drumVoice,createDrumBus}=await import('/src/drums.ts'),{DEFAULTS,selectProfile}=await import('/src/music.ts');
  const prepared=new OfflineAudioContext(2,48000,48000),start=performance.now();
  const [bank,same]=await Promise.all([prepareDrums(prepared),prepareDrums(prepared)]);
  if(bank!==same||bank.size!==384||bank.bytes>20*1024*1024)throw Error('bank cache/size');
  const prepareMs=performance.now()-start;
  const settings={...selectProfile(DEFAULTS,'dub'),volume:100,reverb:0};
  const rms=(x,a,b)=>{let sum=0;for(let i=a*48000;i<b*48000;i++)sum+=x[i]*x[i];return Math.sqrt(sum/((b-a)*48000));};
  const render=async(choke,reverb=0)=>{
   const ctx=new OfflineAudioContext(2,48000,48000),bus=createDrumBus(ctx,{...settings,reverb}),active=new Set(),cleanups=new Set(),hats=[];
   bus.output.connect(ctx.destination);
   const e={at:0,length:.1,voice:'hat',layer:'rhythm',notes:[],gain:.1,pan:0,cutoff:6000,instrument:'r-electro',articulation:'open',velocity:.9,variation:0};
   drumVoice(ctx,bank,bus,hats,e,.1,settings,active,cleanups);
   if(choke)drumVoice(ctx,bank,bus,hats,{...e,articulation:'closed',gain:0},.16,settings,active,cleanups);
   const x=(await ctx.startRendering()).getChannelData(0);
   if(active.size||cleanups.size)throw Error('source leak');
   return {tail:rms(x,.20,.30),x};
  };
  const open=await render(false),choked=await render(true),wet=await render(true,100);
  if(choked.tail>open.tail*.001)throw Error('hat choke incomplete');
  // Closed-hat choking ends the dry source; the very short room may finish naturally.
  if(!Number.isFinite(wet.tail)||wet.tail>open.tail)throw Error('room overwhelms choke');
  const voices=[];
  for(const kit of ['r-brush','r-tape','r-electro','r-click'])for(const groove of ['straight','dnb']) {
   const ctx=new OfflineAudioContext(2,48000*5,48000),s={...settings,groove},bus=createDrumBus(ctx,s),active=new Set(),cleanups=new Set(),hats=[];bus.output.connect(ctx.destination);
   for(const [i,voice] of ['kick','snare','hat','tom','rim','crash'].entries())drumVoice(ctx,bank,bus,hats,{at:i,length:.1,voice,layer:'rhythm',notes:voice==='tom'?[45]:[],gain:voice==='kick'?.27:voice==='hat'?.025:voice==='crash'?.10:.05,pan:0,cutoff:5000,instrument:kit,velocity:.85,variation:1},.1+i*.25,s,active,cleanups);
   const b=await ctx.startRendering();let peak=0;for(const x of b.getChannelData(0)){if(!Number.isFinite(x))throw Error('invalid');peak=Math.max(peak,Math.abs(x));}
   if(peak>.5||peak<.02||active.size||cleanups.size)throw Error('bus gain/cleanup');voices.push({kit,groove,peak});
  }
  return {prepareMs,sounds:bank.size,bytes:bank.bytes,choke:{open:open.tail,choked:choked.tail,wet:wet.tail},voices};
 });
}
