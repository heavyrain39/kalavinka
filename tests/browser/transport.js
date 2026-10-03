async(page)=>{
 await page.goto('http://127.0.0.1:5173/favicon.svg?qa=independent');
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const result=await page.evaluate(async()=>{
  const {MusicEngine}=await import('/src/audio.ts'),{DEFAULTS,normalizeSettings}=await import('/src/music.ts');
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const s=normalizeSettings({...DEFAULTS,profile:'dub',groove:'dnb',bpm:170,energy:80,seed:'CLOCKQA1'});
  const engine=new MusicEngine(),scenes=[],trace=[];
  const make=engine.makeScene.bind(engine);engine.makeScene=(...args)=>{const scene=make(...args);scenes.push(scene);return scene;};
  const voice=engine.voice.bind(engine);engine.voice=(scene,e,time,duration,bpm,render)=>{trace.push({at:e.at,time,duration,bpm,v:render?.generatorVersion,profile:render?.profile,clock:engine.context.currentTime});return voice(scene,e,time,duration,bpm,render);};
  const start=engine.start(s);const stop=engine.stop();await Promise.all([start,stop]);
  if(engine.playing||engine.scene)throw Error('start-stop race');
  await engine.start(s);const section=engine.scene.transport.sections[0];
  await delay(230);engine.update({...s,bpm:90});engine.update({...s,bpm:180});engine.setReverb(80);
  const boundary={...engine.scene.transport.sections[1]};await delay(1600);
  if(engine.pending||engine.audibleSettings.bpm!==180||engine.audibleSettings.reverb!==80)throw Error('pending commit');
  for(const e of trace){const time=e.at<boundary.bar?section.time+e.at*240/170:boundary.time+(e.at-boundary.bar)*240/180;if(Math.abs(e.time-time)>.004)throw Error('phase '+JSON.stringify(e));}
  const running=engine.diagnostics();if(running.lastError||running.late||!running.triggered)throw Error('runtime '+JSON.stringify(running));
  const a=engine.regenerate({...s,seed:'RACEONE'}),b=engine.regenerate({...s,seed:'RACETWO'});await Promise.all([a,b]);
  if(engine.scene.settings.seed!=='RACETWO'||engine.retired.size!==2)throw Error('regenerate race');
  const c=engine.regenerate(s);await engine.stop();await c;await delay(950);
  if(engine.scene||engine.retired.size||scenes.some(s=>s.transport.running||s.sources.size))throw Error('orphan scene '+JSON.stringify({current:!!engine.scene,retired:engine.retired.size,scenes:scenes.map(s=>({running:s.transport.running,sources:s.sources.size}))}));
  await engine.start(s);engine.setTimer(.005);await delay(750);
  const stopped=engine.diagnostics();if(stopped.playing||stopped.activeSources||stopped.state!=='suspended')throw Error('timer cleanup');
  await engine.context.close();return {running,stopped,scenes:scenes.length,traceEvents:trace.length};
 });
 if(errors.length)throw Error(errors.join('\n'));return {...result,errors};
}
