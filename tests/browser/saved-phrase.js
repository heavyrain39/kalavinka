async(page)=>{
 const context=await page.context().browser().newContext({locale:'ko-KR',viewport:{width:1440,height:900}}),errors=[];
 try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
  await p.evaluate(()=>{
   const s=window.__worksong.diagnostics().settings;
   localStorage.setItem('worksong.favorites.v2',JSON.stringify({items:[{id:'500',number:17,settings:{...s,generatorVersion:6}}],counters:{lofi:17,ambient:0,dub:0}}));
   localStorage.setItem('worksong.favorites.v3',JSON.stringify({items:{invalid:true}}));
  });
  await p.reload();
  const legacy=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3')).items[0]);
  if(legacy.number!==17||legacy.settings.generatorVersion!==6||legacy.phrase)throw Error('legacy migration');
  await p.locator('[data-profile="dub"]').click();await p.locator('#groove').selectOption('dnb');
  await p.evaluate(()=>{const b=document.getElementById('bpm');b.value='180';b.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().bar>1&&!document.getElementById('play').disabled);
  await p.locator('#favorite').click();
  if(await p.locator('#favorite').getAttribute('aria-pressed')!=='true')throw Error('initial heart');
  await p.waitForFunction(()=>window.__worksong.diagnostics().bar>8.15);
  await p.waitForFunction(()=>document.getElementById('favorite').getAttribute('aria-pressed')==='false');
  // An edit partway through the phrase must not rewrite the already-heard opening bars.
  const beforeEdit=await p.evaluate(()=>window.__worksong.savedPhrase());
  await p.evaluate(()=>{const e=document.getElementById('energy');e.value='80';e.dispatchEvent(new Event('input',{bubbles:true}));});
  const pendingSave=await p.evaluate(()=>window.__worksong.savedPhrase());
  if(pendingSave.settings.energy!==80)throw Error('pending continuation settings');
  await p.locator('#favorite').click();
  await p.waitForFunction(()=>window.__worksong.diagnostics().bar>9.25&&!window.__worksong.diagnostics().pending);
  const heard=await p.evaluate(()=>window.__worksong.savedPhrase());
  const rows=events=>events.map(e=>[e.at,e.length,e.voice,e.notes,e.instrument]);
  if(JSON.stringify(rows(beforeEdit.phrase.events.filter(e=>e.at<1)))!==JSON.stringify(rows(heard.phrase.events.filter(e=>e.at<1))))throw Error('past notes rewritten');
  if(JSON.stringify(rows(pendingSave.phrase.events))!==JSON.stringify(rows(heard.phrase.events)))throw Error('pending save changed at activation');
  await p.locator('#favorite').click();await p.locator('#favorite').click();
  const store=await p.evaluate(()=>JSON.parse(localStorage.getItem('worksong.favorites.v3'))),saved=store.items[0];
  if(store.items.length!==3||saved.number!==2||saved.phrase.sourceBar!==8)throw Error('phrase save/duplicate/number');
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  if((await p.evaluate(()=>window.__worksong.savedPhrase())).phrase.sourceBar!==8)throw Error('stopped save lost phrase');
  await p.reload();await p.locator(`[data-load="${saved.id}"]`).click();
  const recalled=await p.evaluate(()=>window.__worksong.savedPhrase());
  const chords=items=>items.map(c=>[c.label,c.root,c.notes]);
  if(JSON.stringify(rows(recalled.phrase.events))!==JSON.stringify(rows(heard.phrase.events))||JSON.stringify(chords(recalled.phrase.chords))!==JSON.stringify(chords(heard.phrase.chords)))throw Error('recalled notes/chords changed');
  if(await p.locator('#favorite').getAttribute('aria-pressed')!=='true')throw Error('recall heart');
  await p.reload();
  if(JSON.stringify(rows((await p.evaluate(()=>window.__worksong.savedPhrase())).phrase.events))!==JSON.stringify(rows(heard.phrase.events)))throw Error('recalled selection lost on reload');
  await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().bar>1&&!document.getElementById('play').disabled);
  const playing=await p.evaluate(()=>window.__worksong.diagnostics());
  if(!playing.savedOpening||playing.sourceBar<9||playing.lastError||playing.late)throw Error('replay origin');
  await p.waitForFunction(()=>window.__worksong.diagnostics().bar>8.1);
  const continued=await p.evaluate(()=>window.__worksong.diagnostics());
  if(continued.savedOpening||continued.sourceBar<16||continued.lastError||continued.late)throw Error('continuation');
  await p.locator('#play').click();await p.waitForFunction(()=>!document.getElementById('play').disabled);
  await p.locator(`[data-load="${saved.id}"]`).click();
  await p.screenshot({path:'output/playwright/phrase-save-desktop.png',fullPage:true});
  const layouts=[];for(const [width,height] of [[1440,900],[390,844],[320,740]]){
   await p.setViewportSize({width,height});
   const layout=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,chords:[...document.querySelectorAll('.chord-name')].map(e=>e.textContent)}));
   if(layout.overflow)throw Error('horizontal overflow '+width);layouts.push(layout);
  }
  await p.screenshot({path:'output/playwright/phrase-save-mobile.png',fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  return {savedSourceBar:saved.phrase.sourceBar,events:saved.phrase.events.length,number:saved.number,legacyNumber:legacy.number,continuedSourceBar:continued.sourceBar,late:continued.late,layouts,errors};
 }finally{await context.close();}
}
