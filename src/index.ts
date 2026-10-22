import { OmnibatteryDailyOperationCard } from './cards/daily-operation-card';
import { OmnibatteryEnergyTodayCard } from './cards/energy-today-card';
import { OmnibatterySolarIndependenceCard } from './cards/solar-independence-card';
import { OmnibatteryPriceWindowsCard } from './cards/price-windows-card';
import { OmnibatteryForecastAccuracyCard } from './cards/forecast-accuracy-card';
import { OmnibatteryPlanCard } from './cards/plan-card';
import { OmnibatteryOverviewCard } from './cards/overview-card';
import { OmnibatteryBatteryCard } from './cards/battery-card';
import { OmnibatteryStatusCard } from './cards/status-card';
import { OmnibatterySystemBatteryCard } from './cards/system-battery-card';
import { OmnibatteryCardEditor } from './editor';
import { version } from '../custom_components/omnibattery_cards/manifest.json';

const cards = [
  ['omnibattery-daily-operation-card', OmnibatteryDailyOperationCard, 'Omnibattery Daily Operation', 'Quarter-hour operation, charge level, battery energy, consumption, and tariffs.'],
  ['omnibattery-energy-today-card', OmnibatteryEnergyTodayCard, 'Omnibattery Energy Today', 'Daily energy totals and remaining forecasts as horizontal bars.'],
  ['omnibattery-solar-independence-card', OmnibatterySolarIndependenceCard, 'Omnibattery Solar Independence', 'Daily self-sufficiency, grid reliance, and solar retention.'],
  ['omnibattery-price-windows-card', OmnibatteryPriceWindowsCard, 'Omnibattery Price Windows', 'Current import price and upcoming two-hour price windows.'],
  ['omnibattery-forecast-accuracy-card', OmnibatteryForecastAccuracyCard, 'Omnibattery Forecast Accuracy', 'Measured energy compared with a saved forecast.'],
  ['omnibattery-plan-card', OmnibatteryPlanCard, 'Omnibattery Energy Plan', 'Measured and projected energy, charge level, prices, and activity.'],
  ['omnibattery-overview-card', OmnibatteryOverviewCard, 'Omnibattery Overview', 'Live power flow and daily energy totals.'],
  ['omnibattery-battery-card', OmnibatteryBatteryCard, 'Omnibattery Battery', 'Charge level, power, energy, and health of one battery.'],
  ['omnibattery-system-battery-card', OmnibatterySystemBatteryCard, 'Omnibattery System Battery', 'System charge level and a compact charge bar for every battery.'],
  ['omnibattery-status-card', OmnibatteryStatusCard, 'Omnibattery Status', 'Understand operating modes, limits, and data freshness.'],
] as const;
declare global { interface Window { customCards?: {type:string;name:string;description:string;preview:boolean}[]; } }
for (const [type, element, name, description] of cards) {
  if(!customElements.get(type)) customElements.define(type,element);
  window.customCards ||= [];
  if(!window.customCards.some(card=>card.type===type)) window.customCards.push({type,name,description,preview:true});
}
if(!customElements.get('omnibattery-card-editor')) customElements.define('omnibattery-card-editor',OmnibatteryCardEditor);
console.info(`OMNIBATTERY CARDS ${version} · Read-only energy insights`);
