async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR'}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  const mix={generatorVersion:16,profile:'dub',seed:'CRASHDEMO',bpm:180,energy:65,melodyRepetition:1};
  await p.goto('http://127.0.0.1:5173/#mix='+encodeURIComponent(JSON.stringify(mix)));
  await p.waitForFunction(()=>!!window.__worksong);
  if(!(await p.locator('#about-dialog').textContent()).includes('v0.24.1'))throw Error('stale release');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().bar>8.15);
  const live=await p.evaluate(()=>window.__worksong.diagnostics());
  if(live.late||live.lastError||live.settings.generatorVersion!==16||live.settings.melodyRepetition!==1)throw Error('live '+JSON.stringify(live));
  await p.locator('#favorite').click();
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  if(!saved.phrase.events.some(e=>e.voice==='crash'&&e.at===0))throw Error('crash missing from saved phrase');
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  if((await p.evaluate(()=>window.__worksong.diagnostics())).activeSources)throw Error('tail leaked on stop');
  await p.reload();await p.locator(`[data-load="${saved.id}"]`).click();await p.reload();
  const canonical=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  if(canonical((await p.evaluate(()=>window.__worksong.savedPhrase())).phrase)!==canonical(saved.phrase))throw Error('recalled score changed');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().bar>.25);
  const replay=await p.evaluate(()=>window.__worksong.diagnostics());
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  if((await p.evaluate(()=>window.__worksong.diagnostics())).activeSources||replay.late||errors.length)throw Error('replay cleanup/errors');
  return {live:{bar:live.bar,late:live.late,bank:live.drumBank},crashSaved:true,exactReplay:true,stoppedDuringTail:true,errors};
 }finally{await context.close();}
}
