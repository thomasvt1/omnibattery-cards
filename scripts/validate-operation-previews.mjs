import { readFile, mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

// Render the release bundle, using only the public synthetic demo for telemetry.
const server=await createServer({server:{host:'127.0.0.1',port:0}});
let browser;
try {
  await server.listen();browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1050,height:1100},locale:'en-GB',timezoneId:'UTC',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const bundle=await readFile('dist/omnibattery-cards.js','utf8');
  await page.route('**/src/index.ts',route=>route.fulfill({contentType:'application/javascript',body:bundle}));
  await page.clock.setFixedTime(new Date('2026-06-15T12:37:30Z'));
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>Boolean(window.demo));
  await page.addStyleTag({content:'.demo-header,.system-demo-controls,footer{display:none}.card-grid{display:block}.card-grid>*{display:none!important}.card-grid>[data-preview]{display:block!important}'});
  const card=page.locator('omnibattery-daily-operation-card');
  await card.evaluate(e=>e.setAttribute('data-preview',''));
  await expect(card.getByRole('heading',{name:'Daily operation'})).toBeVisible();
  await expect(card.locator('[aria-current=time]')).toContainText('12:30');
  await expect(card.locator('tbody tr')).toHaveCount(26);
  await mkdir('examples',{recursive:true});
  for(const width of [1050,390,320])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:1100});await page.evaluate(theme=>window.demo.setTheme(theme),theme);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Document overflow');
    await card.screenshot({path:`examples/daily-operation-${width}-${theme}.png`});
    if(width===390){
      await card.locator('.table-scroll').evaluate(e=>e.scrollLeft=e.scrollWidth);
      await card.screenshot({path:`examples/daily-operation-mobile-details-${theme}.png`});
      await card.locator('.table-scroll').evaluate(e=>e.scrollLeft=0);
    }
  }
  await page.setViewportSize({width:1050,height:1100});
  await page.evaluate(()=>window.demo.setConfig('daily-operation',{appearance:{background:'#20303c',text_color:'#ffffff',secondary_text_color:'#b0bec5',border_color:'#405565',border_width:2,border_radius:20,padding:12,title_size:19,solar_color:'#ffd166',charge_color:'#7de0ae',soc_color:'#ad97f5',price_color:'#b4a4ff'}}));
  await card.screenshot({path:'examples/daily-operation-custom-theme.png'});
  // Same mounted card: loaded -> reconnect/loading -> loaded, no real household data.
  await page.evaluate(()=>{
    const card=document.querySelector('omnibattery-daily-operation-card');const original=card.hass;window.previewHass=original;
    card.hass={...original,connection:{},callWS:()=>new Promise(()=>{})};
  });
  await expect(card.getByRole('status',{name:'Loading Omnibattery data'})).toBeVisible();
  await expect(card.locator('.skeleton-content')).toHaveCSS('animation-name','none');
  await card.screenshot({path:'examples/daily-operation-loading.png'});
  await page.evaluate(()=>{document.querySelector('omnibattery-daily-operation-card').hass=window.previewHass;});
  await expect(card.locator('tbody tr')).toHaveCount(26);
  // Compare all cards with a shared custom appearance at mobile width.
  await page.setViewportSize({width:390,height:1000});
  await page.evaluate(()=>{
    for(const card of document.querySelectorAll('.card-grid > *')){
      card.setAttribute('data-preview','');const name=card.localName;
      window.demo.setConfig(`custom:${name}`,{appearance:{background:'#20303c',text_color:'#fff',secondary_text_color:'#b0bec5',border_color:'#405565',border_radius:20,padding:12,title_size:19}});
    }
  });
  await page.addStyleTag({content:'.card-grid>[data-preview]{margin-bottom:16px}'});
  await page.locator('.card-grid').screenshot({path:'examples/appearance-all-cards.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Production operation, appearance and loading previews verified.');
}finally{await browser?.close();await server.close();}
