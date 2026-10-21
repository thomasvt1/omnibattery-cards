import {test,expect} from '@playwright/test';
const names=['daily-operation','plan','overview','battery','system-battery','status','energy-today','solar-independence','price-windows','forecast-accuracy'];
for(const theme of ['light','dark'] as const)test(`all cards follow appearance and reset in ${theme}`,async({page})=>{
  await page.setViewportSize({width:390,height:900});await page.goto('/');
  await page.evaluate(({theme,names})=>{
    window.demo.setTheme(theme);
    for(const name of names)window.demo.setConfig(name,{appearance:{background:'#20303c',text_color:'#ffffff',secondary_text_color:'#b0bec5',border_color:'#405565',border_width:2,border_radius:20,padding:12,title_size:19,value_size:18,shadow:'0 2px 8px #0003'}});
  },{theme,names});
  for(const name of names){
    const card=page.locator(`omnibattery-${name}-card`);
    await expect(card.locator('ha-card')).toHaveCSS('background-color','rgb(32, 48, 60)');
    await expect(card.locator('ha-card')).toHaveCSS('color','rgb(255, 255, 255)');
    await expect(card.locator('ha-card')).toHaveCSS('padding-left','12px');
    await expect(card.locator('ha-card')).toHaveCSS('border-radius','20px');
    await expect(card.locator('h2')).toHaveCSS('font-size','19px');
  }
  await expect(page.locator('omnibattery-overview-card .reading').first()).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(page.locator('omnibattery-battery-card .metric-value').first()).toHaveCSS('font-size','18px');
  await expect(page.locator('omnibattery-system-battery-card .system-soc')).toHaveCSS('font-size','18px');
  await expect(page.locator('omnibattery-solar-independence-card .hero')).toHaveCSS('font-size','18px');
  await page.evaluate(()=>window.demo.setConfig('battery',{appearance:{background:'transparent',padding:0,border_width:0}}));
  await expect(page.locator('omnibattery-battery-card ha-card')).toHaveCSS('padding-left','0px');
  await expect(page.locator('omnibattery-battery-card ha-card')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.evaluate(names=>names.forEach(name=>window.demo.setConfig(name,{appearance:undefined})),names);
  for(const name of names){
    await expect(page.locator(`omnibattery-${name}-card ha-card`)).toHaveCSS('background-color',theme==='dark'?'rgb(27, 35, 39)':'rgb(255, 255, 255)');
    await expect(page.locator(`omnibattery-${name}-card h2`)).toHaveCSS('font-size','17px');
  }
});

test('editor validates, changes semantic colors, and resets without losing sources',async({page})=>{
  await page.goto('/');await page.evaluate(()=>{window.demo.setConfig('daily-operation',{show_extension:true,entities:{timeline:'sensor.demo_timeline'}});window.demo.showEditor('daily-operation');});
  const editor=page.locator('omnibattery-card-editor');await editor.getByText('Appearance',{exact:true}).click();
  const background=editor.getByLabel('Background color',{exact:true});await background.fill('#20303c');await background.blur();
  await expect(page.locator('omnibattery-daily-operation-card ha-card')).toHaveCSS('background-color','rgb(32, 48, 60)');
  await background.fill('invalid');await background.blur();expect(await background.evaluate(e=>(e as HTMLInputElement).checkValidity())).toBe(false);
  await background.fill('var(--primary-color)');await background.blur();
  await editor.getByText('Advanced colors',{exact:true}).click();
  await editor.getByLabel('Solar color',{exact:true}).fill('#ff00ff');await editor.getByLabel('Solar color',{exact:true}).blur();
  await expect(page.locator('omnibattery-daily-operation-card td.solar').first()).toHaveCSS('color','rgb(255, 0, 255)');
  await editor.getByRole('button',{name:'Reset appearance to theme'}).click();
  expect(await page.evaluate(()=>window.demo.getConfig('daily-operation'))).toMatchObject({show_extension:true,entities:{timeline:'sensor.demo_timeline'},import_price_entity:'sensor.demo_import_price'});
  expect(await page.evaluate(()=>window.demo.getConfig('daily-operation')?.appearance)).toBeUndefined();
});

test('invalid YAML appearance is rejected before mutating styles',async({page})=>{
  await page.goto('/');expect(await page.evaluate(()=>{
    const card=document.querySelector('omnibattery-battery-card') as HTMLElement&{setConfig(c:unknown):void};
    return [null,[],{unknown:'red'},{padding:-1},{padding:NaN},{background:3},{background:'invalid'},{shadow:'red'}].every(appearance=>{
      try{card.setConfig({type:'custom:omnibattery-battery-card',appearance});return false;}catch{return true;}
    });
  })).toBe(true);
});

for(const name of ['plan','daily-operation'])test(`${name} selected range has hover, pressed and contained keyboard focus`,async({page})=>{
  await page.goto('/');await page.evaluate(name=>window.demo.setConfig(name,{appearance:{padding:0,hover_color:'#123456',pressed_color:'#345678',focus_color:'#abcdef'}}),name);
  const button=page.locator(`omnibattery-${name}-card`).getByRole('button',{pressed:true});
  await button.hover();await expect(button).toHaveCSS('background-color','rgb(18, 52, 86)');
  await page.mouse.down();await expect(button).toHaveCSS('background-color','rgb(52, 86, 120)');await page.mouse.up();
  await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  await expect(button).toHaveCSS('outline-color','rgb(171, 205, 239)');await expect(button).toHaveCSS('outline-offset','-2px');
});

test('chart labels inherit Home Assistant theme typography',async({page})=>{
  await page.goto('/');await page.evaluate(()=>document.documentElement.style.setProperty('--ha-font-family-body','Georgia'));
  await expect(page.locator('omnibattery-price-windows-card svg text').first()).toHaveCSS('font-family','Georgia');
  await expect(page.locator('omnibattery-plan-card svg text').first()).toHaveCSS('font-family','Georgia');
});

test('plan SVG follows actual content width after padding, border and theme changes',async({page})=>{
  await page.setViewportSize({width:390,height:1200});await page.goto('/');
  const card=page.locator('omnibattery-plan-card');await card.evaluate(e=>(e as HTMLElement).style.width='320px');
  async function fits(){
    await expect.poll(()=>card.locator('.chart').evaluate(e=>Math.abs(e.getBoundingClientRect().width-e.querySelector('svg')!.viewBox.baseVal.width))).toBeLessThan(1);
    expect(await card.locator('ha-card').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.evaluate(()=>window.demo.setConfig('plan',{appearance:{padding:48,border_width:8}}));
  await fits();await expect(card.locator('.chart')).toHaveCSS('width','208px');
  await page.evaluate(()=>window.demo.setConfig('plan',{appearance:{padding:0,border_width:0}}));
  await fits();await expect(card.locator('.chart')).toHaveCSS('width','320px');
  await page.evaluate(()=>window.demo.setConfig('plan',{appearance:undefined}));
  await card.evaluate(e=>(e as HTMLElement).style.setProperty('--ha-card-border-width','6px'));
  await fits();await expect(card.locator('.chart')).toHaveCSS('width','276px');
  await page.evaluate(()=>window.demo.setScenario('missing'));await expect(card.locator('.chart')).toHaveCount(0);
  await page.evaluate(()=>window.demo.setScenario('solar'));await expect(card.locator('.chart')).toBeVisible();await fits();
});
