import { expect, test } from '@playwright/test';
import type { HomeAssistant } from '../../src/types';
for(const width of [320,390,820])for(const theme of ['light','dark'] as const){
  test(`energy today bars fit ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.clock.setFixedTime(new Date('2026-06-15T12:37:30Z'));
    await page.goto('/');await page.evaluate(theme=>window.demo.setTheme(theme),theme);
    const card=page.locator('omnibattery-energy-today-card');
    await expect(card.getByRole('heading',{name:'Energy today'})).toBeVisible();
    await expect(card.getByRole('meter')).toHaveCount(8);
    const meters=await card.getByRole('meter').evaluateAll(els=>els.map(el=>({max:el.getAttribute('aria-valuemax'),value:Number(el.getAttribute('aria-valuenow')),width:el.firstElementChild!.getBoundingClientRect().width,track:el.getBoundingClientRect().width})));
    expect(new Set(meters.map(m=>m.max)).size).toBe(1);
    for(const m of meters)expect(m.width/m.track).toBeCloseTo(m.value/Number(m.max),2);
    expect(await card.evaluate(el=>{
      const box=el.getBoundingClientRect();return [...el.shadowRoot!.querySelectorAll('*')].filter(n=>{const b=n.getBoundingClientRect();return b.width>0&&(b.left<box.left-1||b.right>box.right+1);}).map(n=>n.tagName);
    })).toEqual([]);
  });
}
test('energy today opens details and editor toggles forecasts without control calls',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-06-15T12:30:00Z'));
  await page.goto('/');
  await page.evaluate(()=>document.addEventListener('hass-more-info',event=>{document.body.dataset.entity=(event as CustomEvent).detail.entityId;}));
  const card=page.locator('omnibattery-energy-today-card');
  await card.getByRole('button',{name:/Solar: .*Show details/}).click();
  await expect(page.locator('body')).toHaveAttribute('data-entity','sensor.demo_daily_solar');
  await page.evaluate(()=>window.demo.showEditor('energy-today'));
  const editor=page.locator('omnibattery-card-editor');
  await editor.getByLabel('Show remaining forecasts').uncheck();
  await expect(card.getByRole('meter')).toHaveCount(6);
  await editor.getByText('Entity overrides',{exact:true}).click();
  await expect(editor.getByLabel('Charged today',{exact:true})).toBeVisible();
  await expect(editor.getByLabel('Daily operation timeline',{exact:true})).toBeVisible();
  await editor.getByLabel('Show remaining forecasts').check();
  await page.evaluate(()=>window.demo.setScenario('stale'));
  await expect(card.getByRole('meter')).toHaveCount(6);
  await expect(card.getByRole('img',{name:'Solar remaining: unavailable'})).toBeVisible();
  await page.evaluate(()=>window.demo.setScenario('missing'));
  await expect(card.getByRole('meter')).toHaveCount(0);
});
test('zero energy has an empty known bar and invalid energy is unavailable',async({page})=>{
  await page.goto('/');
  const card=page.locator('omnibattery-energy-today-card');
  await card.evaluate(el=>{
    const c=el as HTMLElement & {hass:HomeAssistant};const old=c.hass.states;
    c.hass={...c.hass,states:{...old,'sensor.demo_daily_charge':{...old['sensor.demo_daily_charge'],state:'0'},'sensor.demo_daily_solar':{...old['sensor.demo_daily_solar'],state:'-1'}}};
  });
  await expect(card.getByRole('meter',{name:'Charged',exact:true})).toHaveAttribute('aria-valuenow','0');
  await expect(card.getByRole('img',{name:'Solar: unavailable'})).toBeVisible();
});
