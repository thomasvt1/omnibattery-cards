import {test,expect} from '@playwright/test';

test('all Omnibattery cards show a skeleton until initial registry discovery finishes',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const path='/src/demo/fixtures.ts';
  const {createDemo}=await import(/* @vite-ignore */ path) as typeof import('../../src/demo/fixtures');
  const {hass}=createDemo();
  let finish!:()=>void;const pending=new Promise<void>(resolve=>{finish=resolve;});
  const delayed={...hass,connection:{},callWS:async(message:Record<string,unknown>)=>{await pending;return hass.callWS!(message);}};
  const host=document.createElement('section');host.id='loading-cards';document.body.append(host);
  for(const name of ['overview','plan','battery','system-battery','status','solar-independence','price-windows','forecast-accuracy','energy-today','daily-operation']){
   const card=document.createElement(`omnibattery-${name}-card`) as HTMLElement&{setConfig(config:unknown):void;hass:unknown};
   card.setConfig({type:`custom:omnibattery-${name}-card`});card.hass=delayed;host.append(card);
  }
  (window as any).finishDiscovery=finish;
 });
 const cards=page.locator('#loading-cards');
 await expect(cards.getByRole('status',{name:'Loading Omnibattery data'})).toHaveCount(10);
 await expect(cards.getByText(/No supported Omnibattery entities found|No battery found/)).toHaveCount(0);
 await expect(cards.getByRole('button')).toHaveCount(0);
 await page.evaluate(()=>(window as any).finishDiscovery());
 await expect(cards.getByRole('status',{name:'Loading Omnibattery data'})).toHaveCount(0);
 await expect(cards.locator('omnibattery-battery-card').getByRole('meter')).toHaveAttribute('aria-valuenow','74');
});

test('configured cards show a skeleton before Home Assistant is assigned',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(config:unknown):void};
  card.id='before-hass';card.setConfig({type:'custom:omnibattery-battery-card',layout:'compact'});document.body.append(card);
 });
 await expect(page.locator('#before-hass').getByRole('status',{name:'Loading Omnibattery data'})).toBeVisible();
});

for(const result of ['empty','failed'])test(`finished ${result} discovery shows a real notice`,async({page})=>{
 await page.goto('/');
 await page.evaluate(result=>{
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(config:unknown):void;hass:unknown};
  card.id='finished-discovery';card.setConfig({type:'custom:omnibattery-battery-card'});
  card.hass={states:{},connection:{},callWS:async()=>{if(result==='failed')throw new Error('Disconnected');return [];}};document.body.append(card);
 },result);
 const card=page.locator('#finished-discovery');
 await expect(card.getByText(result==='empty'?'No Omnibattery entities found. Check the integration or select entity overrides.':'Could not read the entity registry. Reload the dashboard to retry.')).toBeVisible();
 await expect(card.getByRole('status',{name:'Loading Omnibattery data'})).toHaveCount(0);
});

for(const timing of ['before','after'])test(`new connection stays loading when old discovery fails ${timing} switching`,async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(config:unknown):void;hass:unknown};
  card.id='reconnect';card.setConfig({type:'custom:omnibattery-battery-card'});
  let fail!:()=>void;const pending=new Promise<never>((_,reject)=>{fail=()=>reject(new Error('Old connection failed'));});
  card.hass={states:{},connection:{},callWS:()=>pending};document.body.append(card);
  (window as any).failOld=fail;
  (window as any).switchConnection=()=>{card.hass={states:{},connection:{},callWS:()=>new Promise(()=>{})};};
 });
 const card=page.locator('#reconnect');
 await expect(card.getByRole('status',{name:'Loading Omnibattery data'})).toBeVisible();
 if(timing==='before'){
  await page.evaluate(()=>(window as any).failOld());
  await expect(card.getByText('Could not read the entity registry. Reload the dashboard to retry.')).toBeVisible();
 }
 await page.evaluate(()=>(window as any).switchConnection());
 if(timing==='after')await page.evaluate(()=>(window as any).failOld());
 await expect(card.getByRole('status',{name:'Loading Omnibattery data'})).toBeVisible();
 await expect(card.getByText(/Could not read|No supported/)).toHaveCount(0);
});

test('background discovery keeps loaded readings visible',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const path='/src/demo/fixtures.ts';
  const {createDemo}=await import(/* @vite-ignore */ path) as typeof import('../../src/demo/fixtures');
  const {hass}=createDemo();let refresh=false;const listeners:Record<string,()=>void>={};
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(config:unknown):void;hass:unknown};
  card.id='refresh';card.setConfig({type:'custom:omnibattery-battery-card'});
  card.hass={...hass,connection:{subscribeEvents:async(callback:()=>void,type:string)=>{listeners[type]=callback;return ()=>{};}},callWS:(message:Record<string,unknown>)=>refresh?new Promise(()=>{}):hass.callWS!(message)};
  document.body.append(card);(window as any).refreshDiscovery=()=>{refresh=true;listeners.entity_registry_updated();};
 });
 const card=page.locator('#refresh');
 await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow','74');
 await page.evaluate(()=>(window as any).refreshDiscovery());
 await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow','74');
 await expect(card.getByRole('status',{name:'Loading Omnibattery data'})).toHaveCount(0);
});

test('compact skeleton respects appearance and reduced motion on mobile',async({page})=>{
 await page.setViewportSize({width:320,height:700});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await page.evaluate(()=>{
  const host=document.createElement('section');host.style.width='288px';document.body.append(host);
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(config:unknown):void};
  card.id='compact-loading';card.setConfig({type:'custom:omnibattery-battery-card',layout:'compact',appearance:{background:'#e9e5ef'}});host.append(card);
 });
 const card=page.locator('#compact-loading'),loader=card.getByRole('status',{name:'Loading Omnibattery data'});
 await expect(loader).toBeVisible();await expect(loader).toHaveCSS('background-color','rgb(233, 229, 239)');
 await expect(card.locator('.skeleton-content')).toHaveCSS('animation-name','none');
 const box=await loader.boundingBox();expect(box!.height).toBeLessThan(120);expect(box!.width).toBeLessThanOrEqual(288);
});


test('a stalled old connection cannot block discovery on its replacement',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  const card=document.createElement('omnibattery-battery-card') as HTMLElement&{setConfig(c:unknown):void;hass:unknown};
  card.id='stalled';card.setConfig({type:'custom:omnibattery-battery-card'});
  card.hass={states:{},connection:{},callWS:()=>new Promise(()=>{})};document.body.append(card);
 });
 await expect(page.locator('#stalled [aria-busy=true]')).toBeVisible();
 await page.evaluate(()=>{
  const source=document.querySelector('omnibattery-battery-card') as HTMLElement&{hass:unknown};
  (document.getElementById('stalled') as HTMLElement&{hass:unknown}).hass=source.hass;
 });
 await expect(page.locator('#stalled').getByRole('meter')).toHaveAttribute('aria-valuenow','74');
});
