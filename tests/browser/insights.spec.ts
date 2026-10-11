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
