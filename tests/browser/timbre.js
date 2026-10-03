async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg');
 return await page.evaluate(async()=>{
  const {instrumentVoice}=await import('/src/synth.ts'),{createRoom}=await import('/src/reverb.ts'),{MusicEngine}=await import('/src/audio.ts');
  const setup=new MusicEngine();await setup.init();const noise=setup.noise,impulse=setup.impulse;await setup.context.close();
  const rms=(data,from,to)=>{let sum=0;const a=Math.floor(from*48000),b=Math.floor(to*48000);for(let i=a;i<b;i++)sum+=data[i]*data[i];return Math.sqrt(sum/(b-a));};
  const render=async(id,duration=.5,at=0)=>{
   const ctx=new OfflineAudioContext(2,48000*3,48000),active=new Set();
   instrumentVoice(ctx,{instrument:id,layer:id[0]==='b'?'bass':'motif',voice:'pluck',notes:[69],at,length:1,gain:.07,cutoff:6000,pan:0},.1,duration,noise,ctx.destination,active);
   const buffer=await ctx.startRendering();if(active.size)throw Error('leak '+id);return buffer.getChannelData(0);
  };
  const envelopes=[];
  for(const id of ['h-felt','h-electric','m-bell','m-marimba','m-pluck','m-flute','h-pad','b-round']){
   const data=await render(id);const early=rms(data,.17,.22),held=rms(data,.50,.55),tail=rms(data,.61,.64),ended=rms(data,1.3,1.5);
   if(!early||!tail||ended>1e-6)throw Error('envelope '+id+JSON.stringify({early,held,tail,ended}));
   if(!['m-flute','h-pad'].includes(id)&&held>=early*.95)throw Error('flat envelope '+id);
   if(id==='b-round'&&rms(data,.68,.72)>1e-6)throw Error('bass tail exceeds existing gap');envelopes.push({id,early,held,tail,ended});
  }
  const first=await render('h-felt'),repeat=await render('h-felt'),different=await render('h-felt',.5,1);let repeatError=0,variation=0;
  for(let i=0;i<first.length;i++){repeatError=Math.max(repeatError,Math.abs(first[i]-repeat[i]));variation+=Math.abs(first[i]-different[i]);}
  if(repeatError>1e-7||variation<.01)throw Error('determinism');
  const band=(data,at,f)=>{let a=0,b=0;const start=Math.floor(at*48000),n=4800;for(let i=0;i<n;i++){const w=.5-.5*Math.cos(2*Math.PI*i/(n-1)),phase=2*Math.PI*f*i/48000;a+=data[start+i]*w*Math.cos(phase);b+=data[start+i]*w*Math.sin(phase);}return a*a+b*b;};
  const brightness=[.13,.40].map(t=>(band(first,t,880)+band(first,t,1320))/(band(first,t,440)+1e-20));if(brightness[1]>=brightness[0]*.8)throw Error('static spectrum');
  const rooms=[];for(const amount of [0,100]){
   const ctx=new OfflineAudioContext(2,48000*3,48000),room=createRoom(ctx,impulse,amount),src=ctx.createBufferSource(),buffer=ctx.createBuffer(1,1,48000);buffer.getChannelData(0)[0]=1;src.buffer=buffer;src.connect(ctx.destination);src.connect(room.input);room.wet.connect(ctx.destination);src.start(.1);const data=(await ctx.startRendering()).getChannelData(0);rooms.push({amount,onset:data[4800],tail:rms(data,.15,1.5)});
  }
  if(rooms[0].tail>1e-10||rooms[1].tail<1e-5||rooms[0].onset!==rooms[1].onset)throw Error('room dry/tail');
  return {envelopes,repeatError,variation,brightness,rooms};
 });
}
