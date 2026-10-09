import type { BatteryModel, CardConfig, HomeAssistant, RegistryData, Snapshot } from '../types';
import { discover, matchesKey } from './discovery';
import { available, metric, sumMetrics, text } from './values';
import { parseTimeline } from './timeline';
import { parsePrices } from './prices';
import { buildStatus } from './status';

export { discover, isOmnibattery, isSystem, matchesKey } from './discovery';
export { metric } from './values';
export { parseTimeline } from './timeline';
export { parsePrices } from './prices';

/** Stable read-only view model. Live W, kWh, Celsius; battery positive = into battery. */
export function buildSnapshot(hass: HomeAssistant, registry: RegistryData, config: CardConfig, now = new Date()): Snapshot {
  const discovery = discover(hass, registry, config);
  const batteries: BatteryModel[] = discovery.batteryIds.map(id => {
    const device = registry.devices.find(item => item.id === id);
    const get = (role: string) => discovery.get(role, id);
    const socEntity = get('batterySoc');
    const acEntity = get('batteryAcPower');
    const acRegistry = registry.entities.find(entity => entity.entity_id === acEntity?.entity_id);
    const hasAcOverride = !!config.entities?.batteryAcPower && id === (config.battery || discovery.batteryIds[0]);
    const acSign = !hasAcOverride && acRegistry && matchesKey(acRegistry, 'ac_power') && !matchesKey(acRegistry, 'delivered_ac_power') ? -1 : 1;
    const health: BatteryModel['health'] = [];
    for (const [keys, label, unit] of [
      [['battery_soh', 'state_of_health'], 'Health', '%'], [['battery_cycle_count_calc', 'battery_cycle_count'], 'Cycles', ''],
      [['battery_voltage'], 'Voltage', 'V'], [['max_cell_voltage'], 'Highest cell', 'V'], [['min_cell_voltage'], 'Lowest cell', 'V'],
    ] as [string[], string, string][]) {
      const value = metric(discovery.find(keys, id));
      if (value.value !== null) health.push({ label, value: value.value, unit, entityId: value.entityId });
    }
    return { id, name: device?.name_by_user || device?.name || `Battery ${discovery.batteryIds.indexOf(id) + 1}`,
      model: text(socEntity?.attributes.model) ?? device?.model,
      available: available(socEntity) || available(get('batteryCellPower')),
      soc: metric(socEntity), stored: metric(get('batteryStored'), 'energy'), capacity: metric(get('batteryCapacity'), 'energy'),
      cellPower: metric(get('batteryCellPower'), 'power'), acPower: metric(acEntity, 'power', acSign),
      temperature: metric(get('batteryTemperature'), 'temperature'), dailyCharge: metric(get('batteryDailyCharge'), 'energy'),
      dailyDischarge: metric(get('batteryDailyDischarge'), 'energy'), health };
  });
  const system = (role: string, kind: 'power' | 'energy' | 'number' = 'number') => metric(discovery.get(role), kind);
  const aggregate = (role: string, key: 'stored' | 'capacity' | 'cellPower' | 'dailyCharge' | 'dailyDischarge', kind: 'power' | 'energy') => {
    const entity = discovery.get(role);
    return entity ? metric(entity, kind) : sumMetrics(batteries.map(battery => battery[key]));
  };
  const charge = system('chargePower', 'power'), discharge = system('dischargePower', 'power');
  const ac = discovery.get('acPower');
  const acPower = ac ? metric(ac, 'power') : charge.value !== null && discharge.value !== null ?
    { value: charge.value - discharge.value, entityId: charge.value > 0 ? charge.entityId : discharge.entityId } : sumMetrics(batteries.map(battery => battery.acPower));
  const timeline = parseTimeline(discovery.get('timeline'), now, hass.config?.time_zone);
  const snapshot: Snapshot = {
    error: discovery.error, integrationId: discovery.integrationId, warnings: [...timeline.warnings],
    grid: metric(discovery.get('grid'), 'power', (config.grid_inverted ?? discovery.panel.grid_inverted === true) ? -1 : 1),
    solar: system('solar', 'power'), home: system('home', 'power'),
    cellPower: aggregate('cellPower', 'cellPower', 'power'), acPower, soc: system('soc'),
    stored: aggregate('stored', 'stored', 'energy'), capacity: aggregate('capacity', 'capacity', 'energy'),
    daily: { solar: system('dailySolar', 'energy'), home: system('dailyHome', 'energy'), gridImport: system('dailyGridImport', 'energy'),
      gridExport: system('dailyGridExport', 'energy'), charge: aggregate('dailyCharge', 'dailyCharge', 'energy'), discharge: aggregate('dailyDischarge', 'dailyDischarge', 'energy') },
    batteries, status: buildStatus(discovery, batteries, timeline), timeline,
    importPrices: parsePrices(config.import_price_entity ? hass.states[config.import_price_entity] : undefined, hass.config?.currency),
    exportPrices: parsePrices(config.export_price_entity ? hass.states[config.export_price_entity] : undefined, hass.config?.currency),
  };
  if (!discovery.entities.length && !discovery.error && !Object.keys(config.entities ?? {}).length)
    snapshot.error = 'No Omnibattery entities found. Check the integration or select entity overrides.';
  if (batteries.some(battery => !battery.available)) snapshot.warnings.push('Some batteries are unavailable. Incomplete totals are not estimated.');
  return snapshot;
}
