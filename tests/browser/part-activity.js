async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR',viewport:{width:1440,height:900}}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  if(!(await p.locator('#about-dialog').textContent()).includes('v0.22.1'))throw Error('stale release');
  const distinct=async()=>{
   const s=await p.evaluate(()=>window.__worksong.diagnostics().settings);
   if(s.instruments.motif===s.instruments.arpeggio)throw Error('automatic timbre collision');
  };
  await distinct();
  for(const profile of ['ambient','lofi','dub']){await p.locator(`[data-profile="${profile}"]`).click();await distinct();}
  for(let i=0;i<4;i++){await p.locator('#regenerate').click();await distinct();}
  const melody=await p.locator('[data-instrument="motif"]').inputValue();
  await p.locator('[data-instrument="arpeggio"]').selectOption(melody);
  if(await p.locator('[data-instrument="arpeggio"]').inputValue()!==melody)throw Error('manual match denied');
  // Keep a reproducible instrument/seed for signal assertions.
  await p.evaluate(()=>{localStorage.removeItem('worksong.selection.v1');localStorage.removeItem('worksong.v1');});
  await p.reload();await p.locator('[data-profile="dub"]').click();
  await p.evaluate(()=>{const e=document.getElementById('bpm');e.value='180';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing);
  const signal=await p.evaluate(async()=>{
   const maxima={harmony:0,bass:0,rhythm:0,motif:0,arpeggio:0};let restingMax=0,secondEntry=0,initialMax=0,phraseEnd=0;
   while(window.__worksong.diagnostics().bar<13.2){
    const d=window.__worksong.diagnostics();for(const key in maxima)maxima[key]=Math.max(maxima[key],d.activity[key]);
    if(d.bar<1.5)initialMax=Math.max(initialMax,d.activity.arpeggio);
    if(d.bar>8.8&&d.bar<11.5)restingMax=Math.max(restingMax,d.activity.arpeggio);
    if(d.bar>6.5&&d.bar<7.9)phraseEnd=Math.max(phraseEnd,d.activity.arpeggio);
    if(d.bar>12)secondEntry=Math.max(secondEntry,d.activity.arpeggio);
    await new Promise(r=>setTimeout(r,35));
   }
   return {maxima,initialMax,restingMax,secondEntry,phraseEnd};
  });
  if(Object.values(signal.maxima).some(n=>n<.08)||signal.initialMax>.001||signal.restingMax>.01||signal.secondEntry<.08||signal.phraseEnd<.08)throw Error('signal '+JSON.stringify(signal));
  for(const layer of Object.keys(signal.maxima)){
   await p.locator(`[data-layer="${layer}"]`).click();
   await p.waitForFunction(layer=>window.__worksong.diagnostics().activity[layer]===0,layer);
   if(await p.locator(`[data-layer="${layer}"]`).getAttribute('aria-pressed')!=='false')throw Error('mute state');
  }
  for(const layer of Object.keys(signal.maxima))await p.locator(`[data-layer="${layer}"]`).click();
  await p.waitForFunction(()=>!window.__worksong.diagnostics().pending);
  await p.evaluate(()=>{const e=document.getElementById('volume');e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForFunction(()=>Object.values(window.__worksong.diagnostics().activity).every(n=>n===0));
  await p.evaluate(()=>{const e=document.getElementById('volume');e.value='80';e.dispatchEvent(new Event('input',{bubbles:true}));});
  const layouts=[];
  for(const theme of ['light','dark']){
   await p.locator(`[data-theme="${theme}"]`).click();
   for(const [width,height] of [[1440,900],[390,844],[320,740]]){
    await p.setViewportSize({width,height});
    await p.waitForFunction(()=>window.__worksong.diagnostics().activity.arpeggio>.15);
    const layout=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,activity:window.__worksong.diagnostics().activity,opacity:getComputedStyle(document.getElementById('arpeggio'),'::before').opacity}));
    if(layout.overflow||Number(layout.opacity)<=0)throw Error('layout '+JSON.stringify(layout));layouts.push({theme,...layout});
    if(width!==320)await p.screenshot({path:`output/playwright/activity-${theme}-${width}.png`,fullPage:true});
   }
  }
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>window.__worksong.diagnostics().activity.arpeggio>.1);
  await p.locator('#play').click();await p.waitForFunction(()=>Object.values(window.__worksong.diagnostics().activity).every(n=>n===0));
  const last=await p.evaluate(()=>window.__worksong.diagnostics());
  if(last.late||last.lastError||last.activeSources||errors.length)throw Error(JSON.stringify({last,errors}));
  return {signal,muteAndVolumeZero:true,stoppedZero:true,automaticTimbresDistinct:true,manualMatch:true,reducedMotion:true,layouts,late:last.late,errors};
 }finally{await context.close();}
}
