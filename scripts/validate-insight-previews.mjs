import { readFile, mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

// Exercise the built HACS module, with the existing demo supplying synthetic telemetry only.
const server=await createServer({server:{host:'127.0.0.1',port:0}});
let browser;
try {
  await server.listen();browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1536,height:1100},locale:'en-GB',timezoneId:'UTC',deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const bundle=await readFile('dist/omnibattery-cards.js','utf8');
  await page.route('**/src/index.ts',route=>route.fulfill({contentType:'application/javascript',body:bundle}));
  await page.clock.setFixedTime(new Date('2026-06-15T14:00:00Z'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>Boolean(window.demo));
  await page.evaluate(async()=>{
    const names=['solar-independence','price-windows','forecast-accuracy'];
    const source=document.querySelector('omnibattery-plan-card').hass;
    const states=structuredClone(source.states);
    for(const [id,value] of Object.entries({daily_home:18,daily_grid_import:4,daily_solar:24,daily_grid_export:6,grid_to_home:4}))states[`sensor.demo_${id}`].state=String(value);
    const timeline=states['sensor.demo_timeline'];
    const series=timeline.attributes.series;
    const weights=Array.from({length:32},(_,i)=>Math.sin((i+.5)/32*Math.PI));
    const total=weights.reduce((a,b)=>a+b,0);
    const intervals=weights.map((w,i)=>({start:new Date(Date.parse('2026-06-15T06:00:00Z')+i*900000).toISOString(),end:new Date(Date.parse('2026-06-15T06:00:00Z')+(i+1)*900000).toISOString(),solar_kwh:w/total*14}));
    states['sensor.preview_saved_forecast']={...states['sensor.demo_saved_forecast'], entity_id:'sensor.preview_saved_forecast'};
    states['sensor.preview_saved_forecast'].attributes={schema_version:1,saved_at:'2026-06-15T06:00:00Z',intervals};
    for(let i=0;i<96;i++) {
      series.solar_actual_kwh[i]=i>=24&&i<56?weights[i-24]/total*12.8:null;
      series.solar_actual_coverage_s[i]=i>=24&&i<56?900:0;
    }
    const tariffs=[.20,.18,.16,.15,.14,.16,.19,.22,.20,.17,.14,.12,.16,.17,.18,.08,.08,.22,.32,.32,.27,.23,.20,.18];
    states['sensor.demo_import_price'].attributes.raw_today.forEach((p,i)=>p.value=tariffs[i]);
    states['sensor.demo_import_price'].attributes.raw_tomorrow=[];
    const main=document.querySelector('main');main.innerHTML='<header class="preview-heading"><h1>Omnibattery · New cards</h1><p>Production build · Illustrative data</p></header>';
    for(const theme of ['light','dark']) {
      const section=document.createElement('section');section.className=`preview-row ${theme}`;
      for(const name of names) {
        const wrapper=document.createElement('div');
        const card=document.createElement(`omnibattery-${name}-card`);
        card.setConfig({...window.demo.getConfig(name), ...(name === 'forecast-accuracy' ? {saved_forecast_entity:'sensor.preview_saved_forecast'} : {})});card.hass={...source,states};
        const label=document.createElement('p');label.className='preview-label';label.textContent=`${String(names.indexOf(name)+1).padStart(2,'0')}  ${name.replaceAll('-',' ')}`;
        wrapper.append(label,card);section.append(wrapper);
      }
      main.append(section);
    }
    await Promise.all([...main.querySelectorAll('section > div > *')].map(e=>e.updateComplete));
  });
  await page.addStyleTag({content:`main{max-width:none;padding:0}.preview-heading{text-align:center;padding:20px}.preview-heading h1{font-size:23px}.preview-heading p{margin:8px 0 0;color:#687080}.preview-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px;padding:0 35px 24px}.preview-label{text-transform:capitalize;font-size:16px;margin:12px 0 8px}.preview-row.dark{padding-top:8px;background:#10171a;color:#e8ecf1;--primary-text-color:#e8ecf1;--secondary-text-color:#a5b0bf;--card-background-color:#1b2327;--ha-card-background:#1b2327;--secondary-background-color:#252f35;--divider-color:#354047;--ha-card-border-color:#3a454d;--energy-solar-color:#ffb300;--energy-grid-consumption-color:#47b7ff;--energy-battery-out-color:#33c6b5}@media(max-width:650px){.preview-row{grid-template-columns:1fr;padding:12px}.preview-heading h1{font-size:20px}}`});
  await mkdir('examples',{recursive:true});
  for(const name of ['solar-independence','price-windows','forecast-accuracy']) {
    await expect(page.locator(`.light omnibattery-${name}-card`).getByRole('heading')).toBeVisible();
  }
  await expect(page.locator('.light omnibattery-forecast-accuracy-card .hero')).toHaveText('−1.2 kWh');
  await page.locator('main').screenshot({path:'examples/new-cards-preview.png'});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>390);
  if(overflow)throw new Error('Mobile document overflows');
  await page.locator('main').screenshot({path:'examples/new-cards-mobile.png'});
  // The additional horizontal-bar card is also captured from the production bundle.
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>Boolean(window.demo));
  await page.addStyleTag({content:'.demo-header,.system-demo-controls,footer{display:none}.card-grid{display:block}.card-grid>*{display:none!important}.card-grid>omnibattery-energy-today-card{display:block!important}'});
  const daily=page.locator('omnibattery-energy-today-card');
  await expect(daily.getByRole('meter')).toHaveCount(8);
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.demo.setTheme(theme),theme);
    await daily.screenshot({path:`examples/energy-today-${theme}.png`});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Production previews verified: examples/new-cards-preview.png and examples/new-cards-mobile.png');
} finally {await browser?.close();await server.close();}
