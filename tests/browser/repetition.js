async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR',viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  if(!(await p.locator('#about-dialog').textContent()).includes('v0.25.0'))throw Error('stale release');
  const slider=p.locator('#melodyRepetition');
  if(await slider.inputValue()!=='2'||await slider.getAttribute('step')!=='1')throw Error('default/detents');
  const labels=['끔','약','보통','강'];
  await slider.focus();await slider.press('Home');
  for(let level=0;level<4;level++){
   if(level)await slider.press('ArrowRight');
   if(await slider.inputValue()!==String(level)||await slider.getAttribute('aria-valuetext')!==labels[level]||await p.locator('#melodyRepetition-value').textContent()!==labels[level])throw Error('keyboard/label');
   const state=await p.evaluate(()=>window.__worksong.diagnostics().settings);
   if(state.melodyRepetition!==level||!state.layers.motif||!state.arpeggio)throw Error('wrong part changed');
  }
  await p.locator('#favorite').click();const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  if(saved.settings.melodyRepetition!==3)throw Error('save level');
  await p.reload();if(await slider.inputValue()!=='3')throw Error('reload level');
  await p.locator('#share').click();const link=await p.evaluate(()=>navigator.clipboard.readText());
  const shared=JSON.parse(decodeURIComponent(new URL(link).hash.slice(5)));if(shared.melodyRepetition!==3)throw Error('share level');
  await p.goto(link);if(await slider.inputValue()!=='3')throw Error('load share');
  await p.locator('#reset-controls').click();if(await slider.inputValue()!=='2')throw Error('reset');
  await p.locator(`[data-load="${saved.id}"]`).click();if(await slider.inputValue()!=='3')throw Error('load favorite');
  const serial=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  if(serial((await p.evaluate(()=>window.__worksong.savedPhrase())).phrase)!==serial(saved.phrase))throw Error('saved notes changed');
  await p.evaluate(()=>{const e=document.getElementById('bpm');e.value='180';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&!document.getElementById('play').disabled);
  const live=[];
  for(const level of [0,1,2,3]){
   await slider.focus();await slider.press('Home');for(let i=0;i<level;i++)await slider.press('ArrowRight');
   await p.waitForFunction(()=>!window.__worksong.diagnostics().pending);
   const state=await p.evaluate(()=>window.__worksong.diagnostics());live.push({level,bar:state.bar,late:state.late});
   if(state.lastError||state.late||!state.playing)throw Error('live update');
  }
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  if((await p.evaluate(()=>window.__worksong.diagnostics())).activeSources)throw Error('source cleanup');
  const layouts=[];
  for(const language of ['ko','en']){
   await p.locator(`[data-language="${language}"]`).click();
   if(await slider.getAttribute('aria-valuetext')!==(language==='ko'?'강':'High'))throw Error('translated value');
   for(const [width,height] of [[1440,900],[1280,720],[1024,768],[900,900],[390,844],[320,720]]){
    await p.setViewportSize({width,height});
    const bounds=await p.evaluate(()=>{const f=document.querySelector('.repetition-fader').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,left:f.left,right:f.right,width:f.width};});
    if(bounds.overflow||bounds.left<0||bounds.right>width)throw Error('layout '+JSON.stringify({language,width,bounds}));
    layouts.push({language,viewportWidth:width,...bounds});
    if(width===1440||width===390){await p.screenshot({path:`output/playwright/repetition-${language}-${width}.png`,fullPage:true});}
   }
  }
  if(errors.length)throw Error(JSON.stringify(errors));
  return {keyboard:true,saveReloadShare:true,exactSavedPhrase:true,live,layouts,errors};
 }finally{await context.close();}
}
