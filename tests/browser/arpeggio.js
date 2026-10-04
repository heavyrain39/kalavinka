async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR',viewport:{width:1440,height:900}}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  if(await p.locator('.layer-grid .part').count()!==5||await p.locator('.layer-grid #arpeggio').count()!==1)throw Error('arpeggio part placement');
  await p.locator('[data-instrument="arpeggio"]').selectOption('m-flute');
  await p.evaluate(()=>{const b=document.getElementById('bpm');b.value='180';b.dispatchEvent(new Event('input',{bubbles:true}));});
  if(await p.locator('#arpeggio').getAttribute('aria-pressed')!=='true')throw Error('default toggle');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&window.__worksong.diagnostics().bar>8.2);
  const captured=await p.evaluate(()=>window.__worksong.savedPhrase());
  const serial=events=>JSON.stringify(events.map(e=>Object.fromEntries(Object.entries(e).sort(([a],[b])=>a.localeCompare(b)))));
  const arp=captured.phrase.events.filter(e=>e.layer==='arpeggio');if(!arp.length||!arp.every(e=>e.instrument==='m-flute'))throw Error('selected arp sound');
  await p.locator('#favorite').click();
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.reload();await p.locator(`[data-load="${saved.id}"]`).click();await p.reload();
  const recalled=await p.evaluate(()=>window.__worksong.savedPhrase());
  if(serial(recalled.phrase.events.filter(e=>e.layer==='arpeggio'))!==serial(arp))throw Error('arp recall mismatch');
  if(await p.locator('#arpeggio').getAttribute('aria-pressed')!=='true')throw Error('recall toggle');
  if(await p.locator('[data-instrument="arpeggio"]').inputValue()!=='m-flute')throw Error('recall sound');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing&&window.__worksong.diagnostics().bar>.3&&!document.getElementById('play').disabled);
  const replay=await p.evaluate(()=>window.__worksong.savedPhrase());
  if(serial(replay.phrase.events.filter(e=>e.layer==='arpeggio'))!==serial(arp))throw Error('arp playback mismatch');
  await p.locator('#arpeggio').click();await p.waitForFunction(()=>!window.__worksong.diagnostics().pending);
  if((await p.evaluate(()=>window.__worksong.diagnostics())).settings.arpeggio!==false)throw Error('toggle off');
  await p.locator('[data-layer="motif"]').click();await p.locator('#arpeggio').click();await p.waitForFunction(()=>!window.__worksong.diagnostics().pending);
  const independent=await p.evaluate(()=>window.__worksong.diagnostics());
  if(independent.settings.layers.motif||!independent.settings.arpeggio||independent.late||independent.lastError)throw Error('independent '+JSON.stringify(independent));
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.locator('[data-profile="dub"]').click();await p.locator('#groove').selectOption('dnb');
  const layouts=[];
  for(const language of ['ko','en']){await p.locator(`[data-language="${language}"]`).click();for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,740]]){
   await p.setViewportSize({width,height});
   const layout=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,arp:document.querySelector('#arpeggio').getBoundingClientRect().toJSON(),focus:document.querySelector('#focus').getBoundingClientRect().toJSON()}));
   if(layout.overflow)throw Error('overflow '+width);layouts.push({language,...layout});
   if(language==='ko'&&[1440,390].includes(width))await p.screenshot({path:`output/playwright/arp-${width}.png`,fullPage:true});
  }}
  if(errors.length)throw Error(errors.join('\n'));
  return {arpEvents:arp.length,sourceBar:saved.phrase.sourceBar,exactReplay:true,independentToggle:true,late:independent.late,layouts,errors};
 }finally{await context.close();}
}
