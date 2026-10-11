import { expect, test } from '@playwright/test';
import type { HomeAssistant } from '../../src/types';
const names=['solar-independence','price-windows','forecast-accuracy'];
for(const width of [320,390,820,1440]) for(const theme of ['light','dark'] as const) {
  test(`new cards fit ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.clock.setFixedTime(new Date('2026-06-15T14:00:00Z'));
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await page.evaluate(theme=>window.demo.setTheme(theme),theme);
    for(const name of names) {
      const card=page.locator(`omnibattery-${name}-card`);
      await expect(card.getByRole('heading')).toBeVisible();
      expect(await card.evaluate(el=>{
        const host=el.getBoundingClientRect();
        return [...el.shadowRoot!.querySelectorAll('*')].filter(node=>{
          const box=node.getBoundingClientRect();return box.width>0 && (box.right>host.right+1 || box.left<host.left-1);
        }).map(n=>n.tagName);
      })).toEqual([]);
      await page.evaluate(name=>window.demo.showEditor(name),name);
      await expect(page.locator('omnibattery-card-editor').getByLabel('Title',{exact:true})).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
test('insight editors update data sources and unavailable values stay honest',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-06-15T14:00:00Z'));
  await page.goto('/');
  await page.evaluate(()=>window.demo.showEditor('forecast-accuracy'));
  const editor=page.locator('omnibattery-card-editor');
  await editor.getByLabel('Forecast metric',{exact:true}).selectOption('home');
  await expect(page.locator('omnibattery-forecast-accuracy-card .caption')).toHaveText('Consumption vs saved forecast');
  await editor.getByLabel('Saved forecast entity',{exact:true}).fill('sensor.absent');
  await editor.getByLabel('Saved forecast entity',{exact:true}).press('Tab');
  await expect(page.locator('omnibattery-forecast-accuracy-card').getByRole('status')).toContainText('Select an available saved forecast');
  await page.evaluate(()=>window.demo.setConfig('solar-independence',{entities:{},assume_no_grid_charging:false}));
  await expect(page.locator('omnibattery-solar-independence-card .hero')).toHaveText('—');
  await page.evaluate(()=>window.demo.showEditor('solar-independence'));
  await editor.getByLabel('Assume no grid charging',{exact:true}).check();
  await expect(page.locator('omnibattery-solar-independence-card .hero')).not.toHaveText('—');
  await page.evaluate(()=>window.demo.showEditor('price-windows'));
  await editor.getByLabel('Import price entity',{exact:true}).fill('sensor.absent');
  await editor.getByLabel('Import price entity',{exact:true}).press('Tab');
  await expect(page.locator('omnibattery-price-windows-card .hero')).toHaveText('—');
});
test('saved forecast updates invalidate the card and missing installations do not invent results',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-06-15T14:00:00Z'));
  await page.goto('/');
  const card=page.locator('omnibattery-forecast-accuracy-card');
  await expect(card.locator('.stats')).toBeVisible();
  await card.evaluate(el=>{
    const c=el as HTMLElement & {hass:HomeAssistant};const old=c.hass.states['sensor.demo_saved_forecast'];
    c.hass={...c.hass,states:{...c.hass.states,[old.entity_id]:{...old,state:'unavailable'}}};
  });
  await expect(card.getByRole('status')).toContainText('Select an available');
  await page.evaluate(()=>window.demo.setScenario('missing'));
  for(const name of names)await expect(page.locator(`omnibattery-${name}-card .hero`)).toHaveText('—');
});

for(const state of ['unavailable','unknown'])test(`retained tariffs disappear when the source becomes ${state} and recover`,async({page})=>{
  await page.clock.setFixedTime(new Date('2026-06-15T14:00:00Z'));
  await page.goto('/');
  const price=page.locator('omnibattery-price-windows-card');
  const plan=page.locator('omnibattery-plan-card');
  await page.evaluate(()=>window.demo.setConfig('plan',{export_price_entity:'sensor.demo_import_price'}));
  await expect(price.locator('.chart')).toBeVisible();
  await expect(price.locator('.window-values strong')).toHaveCount(2);
  for(const nextState of [state,'0.19']){
    await page.evaluate(nextState=>{
      for(const selector of ['omnibattery-price-windows-card','omnibattery-plan-card']){
        const card=document.querySelector(selector) as HTMLElement & {hass:HomeAssistant};
        const old=card.hass.states['sensor.demo_import_price'];
        card.hass={...card.hass,states:{...card.hass.states,[old.entity_id]:{...old,state:nextState}}};
      }
    },nextState);
    if(nextState===state){
      await expect(price.locator('.hero')).toHaveText('—');
      await expect(price.locator('.chart')).toHaveCount(0);
      await expect(price.locator('.window-values strong')).toHaveCount(0);
      await expect(plan.locator('.legend').getByText('Import price',{exact:true})).toHaveCount(0);
      await expect(plan.locator('.legend').getByText('Export price',{exact:true})).toHaveCount(0);
    }else{
      await expect(price.locator('.hero')).not.toHaveText('—');
      await expect(price.locator('.chart')).toBeVisible();
      await expect(price.locator('.window-values strong')).toHaveCount(2);
      await expect(plan.locator('.legend').getByText('Import price',{exact:true})).toBeVisible();
      await expect(plan.locator('.legend').getByText('Export price',{exact:true})).toBeVisible();
    }
  }
});

test('accuracy stops labeling retained yesterday data as today at midnight and recovers',async({page})=>{
  await page.clock.install({time:new Date('2026-06-15T23:59:30Z')});
  await page.goto('/');
  const card=page.locator('omnibattery-forecast-accuracy-card');
  await expect(card.locator('.stats')).toBeVisible();
  // No entity update: the card's periodic refresh must catch midnight itself.
  await page.clock.fastForward(60000);
  await expect(card.getByRole('status')).toHaveText('Today’s timeline is not available yet.');
  await expect(card.locator('.hero')).toHaveText('—');
  await expect(card.locator('.stats')).toHaveCount(0);
  await expect(card.locator('.chart')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-06-16T14:00:00Z'));
  await page.evaluate(()=>window.demo.setScenario('solar'));
  await expect(card.locator('.stats')).toBeVisible();
  await expect(card.getByRole('status')).toHaveCount(0);
});
