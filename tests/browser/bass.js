async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR'}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  if(!(await p.locator('#about-dialog').textContent()).includes('v0.23.1'))throw Error('stale release');
  const results=[];
  for(const mode of ['lofi','ambient','dub','dnb']){
   await p.locator(`[data-profile="${mode==='dnb'?'dub':mode}"]`).click();
   if(mode==='dnb')await p.locator('#groove').selectOption('dnb');
   await p.locator('#melodyRepetition').focus();await p.locator('#melodyRepetition').press('Home');await p.locator('#melodyRepetition').press('ArrowRight');
   await p.evaluate(()=>{const e=document.getElementById('bpm');e.value='180';e.dispatchEvent(new Event('input',{bubbles:true}));});
   await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().bar>8.1);
   const d=await p.evaluate(()=>window.__worksong.diagnostics());
   if(d.settings.generatorVersion!==16||d.settings.melodyRepetition!==1||d.late||d.lastError)throw Error('live '+JSON.stringify(d));
   await p.locator('#favorite').click();
   await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
   if((await p.evaluate(()=>window.__worksong.diagnostics())).activeSources)throw Error('cleanup');
   results.push({mode,late:d.late,active:d.activeSources,bar:d.bar});
  }
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  await p.reload();await p.locator(`[data-load="${saved.id}"]`).click();await p.reload();
  const serial=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  if(serial((await p.evaluate(()=>window.__worksong.savedPhrase())).phrase)!==serial(saved.phrase))throw Error('clip changed');
  if(await p.locator('#melodyRepetition').inputValue()!=='1')throw Error('weak repetition lost');
  if(errors.length)throw Error(JSON.stringify(errors));
  return {results,exactReplay:true,weakPreserved:true,errors};
 }finally{await context.close();}
}
