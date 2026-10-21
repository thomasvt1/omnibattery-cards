import {test,expect} from '@playwright/test';
import type {HomeAssistant} from '../../src/types';

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-06-15T12:37:30Z'));await page.goto('/');});
for(const width of [320,390,820,1440])for(const theme of ['light','dark'] as const)test(`daily operation ${width}px ${theme} scrolls within its card`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>window.demo.setTheme(theme),theme);
  const card=page.locator('omnibattery-daily-operation-card');
  await expect(card.locator('tbody tr')).toHaveCount(26);await expect(card.locator('[aria-current=time]')).toContainText('12:30');
  await expect(card.locator('[aria-current=time]')).toContainText('Planned');
  await expect(card.locator('tbody tr').first()).toContainText('Recorded');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await card.getByRole('region').focus();await page.keyboard.press('ArrowRight');
  await card.getByRole('button',{name:'Full day',exact:true}).click();await expect(card.locator('tbody tr')).toHaveCount(96);
  await page.evaluate(()=>window.demo.setConfig('daily-operation',{show_extension:true}));await expect(card.locator('tbody tr')).toHaveCount(144);
  await expect(card.locator('tbody tr').last()).toContainText('+1d 11:45');
});
test('missing tariffs and stale forecast stay explicit',async({page})=>{
  const card=page.locator('omnibattery-daily-operation-card');
  await page.evaluate(()=>window.demo.setConfig('daily-operation',{import_price_entity:'sensor.missing'}));
  await expect(card.getByText('Configure an import price sensor to show published tariffs.')).toBeVisible();
  await expect(card.locator('td.price').first()).toHaveText('—');
  await page.evaluate(()=>window.demo.setScenario('stale'));
  await expect(card.getByRole('status')).toContainText('Forecast is out of date');
  await expect(card.locator('[aria-current=time]')).toHaveCount(0);
  await expect(card.locator('tbody tr').last()).toContainText('Unknown');
});
test('live updates retain table scroll and use configured sources',async({page})=>{
  const card=page.locator('omnibattery-daily-operation-card');await card.getByRole('button',{name:'Full day',exact:true}).click();
  await card.locator('.table-scroll').evaluate(e=>e.scrollTop=400);
  await card.evaluate(element=>{
    const c=element as HTMLElement&{hass:HomeAssistant};const timeline=c.hass.states['sensor.demo_timeline'];
    c.hass={...c.hass,states:{...c.hass.states,'sensor.demo_timeline':{...timeline,attributes:{...timeline.attributes,revision:123}}}};
  });
  expect(await card.locator('.table-scroll').evaluate(e=>e.scrollTop)).toBe(400);
});
