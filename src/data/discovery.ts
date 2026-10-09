import type { CardConfig, HassEntity, HomeAssistant, RegistryData, RegistryEntity } from '../types';
import { record, text } from './values';

export const SYSTEM_ALIASES: Record<string, string[]> = {
  solar: ['system_solar_power', 'solar_power'], home: ['home_consumption', 'system_home_consumption'],
  soc: ['system_soc'], stored: ['system_stored_energy'], capacity: ['system_total_energy'],
  cellPower: ['system_battery_cell_power'], acPower: ['system_delivered_ac_power'],
  chargePower: ['system_charge_power'], dischargePower: ['system_discharge_power'],
  dailySolar: ['system_daily_solar_energy', 'daily_solar_energy'], dailyHome: ['system_daily_home_energy', 'daily_home_energy'],
  dailyGridImport: ['system_daily_grid_import_energy', 'daily_grid_import_energy'],
  dailyGridExport: ['system_daily_grid_export_energy', 'daily_grid_export_energy'],
  dailyCharge: ['system_daily_charging_energy'], dailyDischarge: ['system_daily_discharging_energy'],
  timeline: ['daily_operation_timeline'], status: ['integration_status'],
  phaseProtection: ['three_phase_protection_status'], alarms: ['system_alarm', 'system_alarm_status'],
  connectivity: ['non_responsive_batteries'], predictive: ['predictive_charging', 'predictive_charging_enabled', 'enable_predictive_charging'],
  reserve: ['discharge_reserve_status'], surplusHold: ['surplus_price_hold_status'],
  curtailment: ['curtailment_status'], chargeDelay: ['charge_delay_status'], capacityProtection: ['capacity_protection_active'],
};
export const BATTERY_ALIASES: Record<string, string[]> = {
  batterySoc: ['battery_soc'], batteryStored: ['battery_stored_energy', 'stored_energy'],
  batteryCapacity: ['battery_total_energy'], batteryCellPower: ['battery_cell_power', 'battery_power'],
  batteryAcPower: ['delivered_ac_power', 'ac_power'], batteryTemperature: ['internal_temperature', 'battery_temperature'],
  batteryDailyCharge: ['total_daily_charging_energy', 'daily_charging_energy'],
  batteryDailyDischarge: ['total_daily_discharging_energy', 'daily_discharging_energy'],
};

export function isOmnibattery(entity: RegistryEntity): boolean {
  return entity.platform === 'omnibattery' || entity.platform === 'marstek_venus';
}

export function matchesKey(entity: RegistryEntity, key: string): boolean {
  if (entity.translation_key === key) return true;
  // Unique IDs survive user renaming; entity IDs and friendly names do not.
  return !!entity.unique_id && (entity.unique_id === key || entity.unique_id.endsWith(`_${key}`));
}

export function isSystem(entity: RegistryEntity): boolean {
  return /^(?:marstek_venus_|omnibattery_)?system_/.test(entity.unique_id ?? '') ||
    (entity.translation_key?.startsWith('system_') ?? false) ||
    ['home_consumption', 'daily_operation_timeline', 'integration_status', 'three_phase_protection_status', 'non_responsive_batteries',
      'predictive_charging', 'discharge_reserve_status', 'surplus_price_hold_status', 'curtailment_status', 'charge_delay_status', 'capacity_protection_active'].includes(entity.translation_key ?? '');
}

export interface Discovery {
  integrationId?: string; entities: RegistryEntity[]; system: RegistryEntity[];
  batteryIds: string[]; panel: Record<string, unknown>; error?: string;
  get(role: string, deviceId?: string): HassEntity | undefined;
  find(keys: string[], deviceId?: string): HassEntity | undefined;
}

export function discover(hass: HomeAssistant, registry: RegistryData, config: CardConfig): Discovery {
  const all = registry.entities.filter(entity => isOmnibattery(entity) && !entity.disabled_by);
  const entryIds = [...new Set(all.map(entity => entity.config_entry_id).filter((id): id is string => !!id))];
  const integrationId = config.integration_id || (entryIds.length === 1 ? entryIds[0] : undefined);
  const ambiguous = !config.integration_id && entryIds.length > 1;
  const entities = ambiguous ? [] : all.filter(entity => !integrationId || entity.config_entry_id === integrationId);
  const system = entities.filter(isSystem);
  const systemDevices = new Set(system.map(entity => entity.device_id).filter(Boolean));
  const batteryIds = [...new Set(entities.filter(entity => entity.device_id && !systemDevices.has(entity.device_id) &&
    ['battery_soc', 'battery_cell_power', 'battery_power'].some(key => matchesKey(entity, key)))
    .map(entity => entity.device_id!))];
  const panels = Object.values(hass.panels ?? {}).map(panel => record(panel.config)).filter(panel =>
    ['omnibattery', 'marstek_venus'].includes(String(panel.domain)));
  // A legacy panel has no entry ID; only use it when there is one integration.
  const panel = panels.find(value => value.config_entry_id === integrationId && !!integrationId) ??
    (!ambiguous && entryIds.length <= 1 && panels.length === 1 ? panels[0] : {});
  const find = (keys: string[], deviceId?: string): HassEntity | undefined => {
    const candidates = deviceId ? entities.filter(entity => entity.device_id === deviceId && !isSystem(entity)) : system;
    for (const key of keys) {
      const match = candidates.find(entity => matchesKey(entity, key));
      if (match) return hass.states[match.entity_id];
    }
    return undefined;
  };
  const panelRoles: Record<string, string> = { grid: 'grid_entity', solar: 'solar_entity', home: 'home_entity', timeline: 'daily_operation_timeline_entity' };
  const get = (role: string, deviceId?: string): HassEntity | undefined => {
    const override = !deviceId || deviceId === (config.battery || batteryIds[0]) ? config.entities?.[role] : undefined;
    if (override) return hass.states[override];
    const panelId = !deviceId && text(panel[panelRoles[role]]);
    if (panelId && hass.states[panelId]) return hass.states[panelId];
    return find((deviceId ? BATTERY_ALIASES : SYSTEM_ALIASES)[role] ?? [], deviceId);
  };
  return { integrationId, entities, system, batteryIds, panel, get, find,
    error: ambiguous ? 'Choose an Omnibattery integration in the card editor.' :
      config.integration_id && !entities.length ? 'The selected Omnibattery integration is unavailable.' : undefined };
}
