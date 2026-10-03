async(page)=>{
 const errors=[];const context=await page.context().browser().newContext({locale:'ko-KR'});
 try {
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  await p.evaluate(()=>{const s=window.__worksong.diagnostics().settings;localStorage.setItem('worksong.favorites.v2',JSON.stringify({items:[{id:'700',number:23,settings:{...s,generatorVersion:6,seed:'SAVEDOLD'}}],counters:{lofi:23,ambient:0,dub:0}}));});
  await p.reload();await p.locator('[data-load="700"]').click();
  const old=await p.evaluate(()=>({s:window.__worksong.diagnostics().settings,favorites:localStorage.getItem('worksong.favorites.v2')}));
  if(old.s.generatorVersion!==6)throw Error('saved version');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&window.__worksong.diagnostics().triggered>8&&!document.getElementById('play').disabled);
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.locator('[data-profile="dub"]').click();await p.locator('#groove').selectOption('dnb');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&window.__worksong.diagnostics().triggered>12&&!document.getElementById('play').disabled);
  await p.evaluate(()=>{const e=document.getElementById('evolution');e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForFunction(()=>window.__worksong.diagnostics().triggered>45);
  const current=await p.evaluate(()=>window.__worksong.diagnostics());
  if(current.settings.generatorVersion!==7||current.lastError||current.late)throw Error('current playback '+JSON.stringify(current));
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  if(old.favorites!==await p.evaluate(()=>localStorage.getItem('worksong.favorites.v2')))throw Error('saved mutation');
  if(errors.length)throw Error(errors.join('\n'));
  return {version:current.settings.generatorVersion,triggered:current.triggered,late:current.late,savedVersion:old.s.generatorVersion,errors};
 }finally{await context.close();}
}
