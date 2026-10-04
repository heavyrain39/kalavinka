async(page)=>{
 const results=[],errors=[];
 for(const locale of ['ko-KR','en-US','ja-JP']){
  const context=await page.context().browser().newContext({locale,viewport:{width:1440,height:900}});
  try {
   const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
   await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>!!window.__worksong);
   const expected=locale==='ko-KR'?'ko':'en';
   if(await p.locator('html').getAttribute('lang')!==expected)throw Error('initial locale '+locale);
   await p.locator('#favorite').click();await p.locator('[data-timer="25"]').click();
   await p.locator('#play').click();await p.waitForFunction(()=>window.__worksong.diagnostics().playing);
   const before=await p.evaluate(()=>window.__worksong.diagnostics());
   for(const lang of ['ko','en']){
    await p.locator(`[data-language="${lang}"]`).click();
    const state=await p.evaluate(()=>window.__worksong.diagnostics());
    if(!state.playing||JSON.stringify(state.settings)!==JSON.stringify(before.settings))throw Error('language changed playback/settings');
    if(lang==='en'){
     const untranslated=await p.evaluate(()=>{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),found=[];let node;
      while(node=walker.nextNode())if(/[가-힣]/.test(node.textContent)&&!node.parentElement.closest('[aria-hidden="true"],script'))found.push(node.textContent);
      for(const el of document.querySelectorAll('[aria-label]'))if(/[가-힣]/.test(el.getAttribute('aria-label')))found.push(el.getAttribute('aria-label'));
      return found;
     });if(untranslated.length)throw Error('untranslated '+JSON.stringify(untranslated));
    }
   }
   await p.locator('#play').click();await p.waitForFunction(()=>!window.__worksong.diagnostics().playing&&!document.getElementById('play').disabled);
   await p.locator('[data-profile="dub"]').click();await p.locator('[data-groove="dnb"]').click();
   await p.locator('[data-layer="bass"]').click();await p.locator('[data-instrument="motif"]').selectOption('m-flute');
   await p.evaluate(()=>{for(const id of ['bpm','energy','warmth','evolution','reverb','volume']){const el=document.getElementById(id);el.value=id==='bpm'?'95':'90';el.dispatchEvent(new Event('input',{bubbles:true}));}});
   const composition=await p.evaluate(()=>window.__worksong.diagnostics().settings);
   await p.locator('#reset-controls').click();
   const reset=await p.evaluate(()=>window.__worksong.diagnostics().settings);
   if(JSON.stringify([reset.bpm,reset.energy,reset.warmth,reset.evolution,reset.reverb,reset.volume])!==JSON.stringify([170,48,62,40,28,55]))throw Error('D&B reset');
   if(reset.seed!==composition.seed||reset.instruments.motif!=='m-flute'||reset.layers.bass!==false||await p.locator('[data-timer="25"]').getAttribute('aria-pressed')!=='true')throw Error('reset changed unrelated state');
   const layouts=[];
   for(const lang of ['ko','en']){
    await p.locator(`[data-language="${lang}"]`).click();
    for(const size of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844},{width:320,height:740}]){
     await p.setViewportSize(size);
     const bounds=await p.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,header:document.querySelector('.site-header').scrollWidth}));
     if(bounds.width>size.width||bounds.header>size.width||(size.width>900&&bounds.height>size.height))throw Error('overflow '+JSON.stringify({lang,size,bounds}));
     await p.locator('#about').click();
     const dialog=await p.locator('#about-dialog').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
     if(dialog.scroll>dialog.width)throw Error('dialog overflow');
     if(locale==='en-US'&&lang==='en'&&size.width===390)await p.screenshot({path:'output/playwright/v010-en-mobile-about.png',fullPage:true});
     await p.locator('#close-about').click();
     if(locale==='en-US'&&((lang==='en'&&size.width===1440)||(lang==='ko'&&size.width===390)))await p.screenshot({path:`output/playwright/v010-${lang}-${size.width}.png`,fullPage:true});
     layouts.push({lang,...size,...bounds});
    }
   }
   // A manual choice is page-local; reload always returns to the browser language.
   await p.locator('[data-language="ko"]').click();await p.reload();await p.waitForFunction(()=>!!window.__worksong);
   if(await p.locator('html').getAttribute('lang')!==expected)throw Error('reload locale');
   results.push({locale,initial:expected,layouts,reset});
  } finally {await context.close();}
 }
 if(errors.length)throw Error(errors.join('\n'));return {results,errors};
}
