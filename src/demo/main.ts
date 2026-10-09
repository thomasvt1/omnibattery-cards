import '../index';
import './style.css';
import { createDemo } from './fixtures';
import type { CardConfig, CardType, HomeAssistant } from '../types';

type DemoCard = HTMLElement & { hass:HomeAssistant; setConfig(config:CardConfig):void; updateComplete:Promise<boolean> };
const systemType:CardType='custom:omnibattery-system-battery-card';
const types:CardType[]=['custom:omnibattery-plan-card','custom:omnibattery-overview-card','custom:omnibattery-battery-card','custom:omnibattery-status-card',systemType];
const configs=new Map<CardType,CardConfig>();
let demo=createDemo();
document.body.innerHTML=`<main><header class="demo-header"><div class="brand"><h1>Omnibattery</h1><span class="demo-label">Demo data</span></div><div class="demo-controls"><label>Scenario <select id="scenario"><option value="solar">Solar charging</option><option value="charging">Grid charging</option><option value="discharging">Discharging</option><option value="offline">Battery offline</option><option value="partial">Partial data</option><option value="stale">Stale forecast</option><option value="missing">Integration missing</option></select></label><button id="theme">Dark theme</button><button id="edit">Card editor</button></div></header><section class="card-grid" aria-label="Omnibattery cards"></section><section class="system-demo-controls"><label>System battery layout <select id="system-layout"><option value="columns">C — Three columns</option><option value="stacked">A — Familiar stack</option><option value="compact">B — Compact rows</option></select></label><button id="edit-system">System card editor</button></section><section class="editor-panel" hidden><div class="editor-heading"><h2>Card editor</h2><button id="close-editor">Close editor</button></div><div id="editor-mount"></div></section><footer>Five independent Home Assistant cards · Illustrative values · Display only</footer></main>`;
const grid=document.querySelector('.card-grid')!;
const cardElements=new Map<CardType,DemoCard>();
for(const type of types) {
  const card=document.createElement(type.slice(7)) as DemoCard;
  card.id=type.slice(7);
  const config:CardConfig={type,...(type.includes('plan')?{import_price_entity:'sensor.demo_import_price'}:{})};
  configs.set(type,config); card.setConfig(config); card.hass=demo.hass; cardElements.set(type,card); grid.append(card);
}
function setScenario(scenario:Parameters<typeof createDemo>[0]) {
  demo=createDemo(scenario);
  cardElements.forEach(card=>{card.hass=demo.hass;});
  (document.querySelector('#scenario') as HTMLSelectElement).value=scenario||'solar';
}
function setTheme(theme:'light'|'dark') {
  document.documentElement.dataset.theme=theme;
  document.querySelector('#theme')!.textContent=theme==='dark'?'Light theme':'Dark theme';
}
const resolveType=(type:CardType|string):CardType => (type.startsWith('custom:')?type:`custom:omnibattery-${type}-card`) as CardType;
function setConfig(input:CardType|string,patch:Partial<CardConfig>) {
  const type=resolveType(input);
  const config={...configs.get(type)!,...patch,type};configs.set(type,config);cardElements.get(type)!.setConfig(config);
  if(type===systemType)(document.querySelector('#system-layout') as HTMLSelectElement).value=config.layout||'columns';
}
function showEditor(input:CardType|string=types[0]) {
  const type=resolveType(input);
  const element=document.createElement('omnibattery-card-editor') as DemoCard;
  element.hass=demo.hass;element.setConfig(configs.get(type)!);
  element.addEventListener('config-changed',(event)=>{
    const config=(event as CustomEvent<{config:CardConfig}>).detail.config;
    configs.set(type,config);cardElements.get(type)!.setConfig(config);element.setConfig(config);
    if(type===systemType)(document.querySelector('#system-layout') as HTMLSelectElement).value=config.layout||'columns';
  });
  document.querySelector('#editor-mount')!.replaceChildren(element);
  (document.querySelector('.editor-panel') as HTMLElement).hidden=false;
}
document.querySelector('#scenario')!.addEventListener('change',event=>setScenario((event.target as HTMLSelectElement).value as Parameters<typeof createDemo>[0]));
document.querySelector('#theme')!.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
document.querySelector('#edit')!.addEventListener('click',()=>showEditor());
document.querySelector('#edit-system')!.addEventListener('click',()=>showEditor(systemType));
document.querySelector('#system-layout')!.addEventListener('change',event=>setConfig(systemType,{layout:(event.target as HTMLSelectElement).value as CardConfig['layout']}));
document.querySelector('#close-editor')!.addEventListener('click',()=>{document.querySelector('#editor-mount')!.replaceChildren();(document.querySelector('.editor-panel') as HTMLElement).hidden=true;});
const theme=new URLSearchParams(location.search).get('theme');setTheme(theme==='dark'?'dark':'light');
const scenario=new URLSearchParams(location.search).get('scenario');if(scenario)setScenario(scenario as Parameters<typeof createDemo>[0]);
declare global { interface Window { demo:{ setScenario:typeof setScenario;setTheme:typeof setTheme;showEditor:typeof showEditor;setConfig:typeof setConfig;getConfig:(type:CardType|string)=>CardConfig|undefined; }; } }
window.demo={setScenario,setTheme,showEditor,setConfig,getConfig:type=>configs.get(resolveType(type))};
