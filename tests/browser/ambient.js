async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR',viewport:{width:390,height:844}}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  if(!(await p.locator('#about-dialog').textContent()).includes('v0.23.2'))throw Error('stale release');
  await p.locator('[data-profile="ambient"]').click();
  const initial=await p.evaluate(()=>window.__worksong.diagnostics().settings);
  if(initial.reverb!==76||initial.generatorVersion!==16)throw Error('ambient preset');
  await p.evaluate(()=>{const e=document.getElementById('bpm');e.value='180';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&window.__worksong.diagnostics().bar>3.2);
  const first=await p.evaluate(()=>window.__worksong.savedPhrase());
  if(!first.phrase.events.some(e=>e.layer==='harmony'&&e.release===.95)||!first.phrase.events.some(e=>e.layer==='arpeggio'&&e.release>.04))throw Error('new articulation absent');
  await p.locator('#favorite').click();const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  await p.waitForFunction(()=>window.__worksong.diagnostics().bar>8.1);
  const after=await p.evaluate(()=>window.__worksong.diagnostics());
  if(after.late||after.lastError||after.activeSources>180)throw Error('live audio '+JSON.stringify(after));
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.reload();await p.locator(`[data-load="${saved.id}"]`).click();await p.reload();
  const serial=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  const recalled=await p.evaluate(()=>window.__worksong.savedPhrase());
  if(serial(recalled.phrase)!==serial(saved.phrase))throw Error('saved articulation mismatch');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&!document.getElementById('play').disabled);
  await p.locator('#regenerate').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.locator('[data-profile="dub"]').click();await p.waitForFunction(()=>window.__worksong.diagnostics().settings.profile==='dub'&&!document.getElementById('play').disabled);
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  const stopped=await p.evaluate(()=>window.__worksong.diagnostics());
  if(stopped.activeSources||errors.length)throw Error(JSON.stringify({stopped,errors}));
  return {initial,events:saved.phrase.events.length,exactReplay:true,late:after.late,liveSources:after.activeSources,cleanup:stopped.activeSources,errors};
 }finally{await context.close();}
}
