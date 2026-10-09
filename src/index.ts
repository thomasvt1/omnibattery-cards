import { OmnibatteryPlanCard } from './cards/plan-card';
import { OmnibatteryOverviewCard } from './cards/overview-card';
import { OmnibatteryBatteryCard } from './cards/battery-card';
import { OmnibatteryStatusCard } from './cards/status-card';
import { OmnibatteryCardEditor } from './editor';

const cards = [
  ['omnibattery-plan-card', OmnibatteryPlanCard, 'Omnibattery Energy Plan', 'Measured and projected energy, charge level, prices, and activity.'],
  ['omnibattery-overview-card', OmnibatteryOverviewCard, 'Omnibattery Overview', 'Live power flow and daily energy totals.'],
  ['omnibattery-battery-card', OmnibatteryBatteryCard, 'Omnibattery Battery', 'Charge level, power, energy, and health of one battery.'],
  ['omnibattery-status-card', OmnibatteryStatusCard, 'Omnibattery Status', 'Understand operating modes, limits, and data freshness.'],
] as const;
declare global { interface Window { customCards?: {type:string;name:string;description:string;preview:boolean}[]; } }
for (const [type, element, name, description] of cards) {
  if(!customElements.get(type)) customElements.define(type,element);
  window.customCards ||= [];
  if(!window.customCards.some(card=>card.type===type)) window.customCards.push({type,name,description,preview:true});
}
if(!customElements.get('omnibattery-card-editor')) customElements.define('omnibattery-card-editor',OmnibatteryCardEditor);
console.info('OMNIBATTERY CARDS 0.1.1 · Read-only energy insights');
