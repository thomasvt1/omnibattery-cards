import type { HassEntity, HomeAssistant, RegistryData, RegistryEntity } from '../types';

export type DemoScenario = 'solar' | 'charging' | 'discharging' | 'offline' | 'partial' | 'stale' | 'missing';
export interface DemoDiagnostics {
  requests: string[];
  services: string[];
  activeSubscriptions: number;
}
export interface DemoHomeAssistant extends HomeAssistant { __demoDiagnostics: DemoDiagnostics; }

/** Entirely synthetic telemetry. This module is imported by the demo harness only. */
export function createDemo(scenario: DemoScenario = 'solar', now = new Date()): { hass: DemoHomeAssistant; registry: RegistryData } {
  const date = now.toISOString().slice(0, 10);
  const today = Date.parse(`${date}T00:00:00Z`);
  const currentIndex = Math.min(95, Math.floor((now.getTime() - today) / 900_000));
  const progress = Math.max(0, Math.min(1, ((now.getTime() - today) % 900_000) / 900_000));
  const integrationId = 'demo-omnibattery';
  const states: Record<string, HassEntity> = {};
  const registry: RegistryData = { entities: [], devices: [] };
  const diagnostics: DemoDiagnostics = { requests: [], services: [], activeSubscriptions: 0 };
  const publication = scenario === 'stale' ? new Date(now.getTime() - 45 * 60_000).toISOString() : now.toISOString();

  const add = (entityId: string, value: number | string, unit: string | undefined, attributes: Record<string, unknown> = {}, entity?: Partial<RegistryEntity>) => {
    states[entityId] = { entity_id: entityId, state: String(value), last_updated: publication,
      attributes: { friendly_name: entityId.replace('sensor.demo_', '').replaceAll('_', ' '), ...(unit ? { unit_of_measurement: unit } : {}), ...attributes } };
    if (entity) registry.entities.push({ entity_id: entityId, platform: 'omnibattery', config_entry_id: integrationId, ...entity });
  };
  const system = (id: string, key: string, value: number | string, unit?: string, attributes: Record<string, unknown> = {}) =>
    add(`sensor.demo_${id}`, value, unit, attributes, { device_id: 'demo-system', translation_key: key, unique_id: `marstek_venus_system_${key}` });

  if (scenario !== 'missing') {
    registry.devices.push({ id: 'demo-system', name: 'Omnibattery demo', manufacturer: 'Omnibattery', config_entries: [integrationId] });
    const charging = scenario === 'charging';
    const discharging = scenario === 'discharging';
    const cellPower = charging ? 2100 : discharging ? -1500 : 1950;
    const acPower = charging ? 2300 : discharging ? -1380 : 1200;
    const solar = charging ? 120 : discharging ? 0 : 3800;
    const home = charging ? 740 : discharging ? 1640 : 820;
    const grid = charging ? 2920 : discharging ? 260 : -1030;
    const soc = charging ? 42 : discharging ? 67 : 76;
    add('sensor.demo_grid', grid, 'W');
    add('sensor.demo_solar', solar, 'W');
    add('sensor.demo_home', home, 'W');
    system('soc', 'system_soc', soc, '%');
    system('stored', 'system_stored_energy', 5.76 * soc / 100, 'kWh');
    system('capacity', 'system_total_energy', 5.76, 'kWh');
    system('cell_power', 'system_battery_cell_power', cellPower, 'W');
    system('ac_power', 'system_delivered_ac_power', acPower, 'W');
    system('daily_solar', 'system_daily_solar_energy', 12.6, 'kWh');
    system('daily_home', 'system_daily_home_energy', 8.4, 'kWh');
    system('daily_grid_import', 'system_daily_grid_import_energy', 2.3, 'kWh');
    system('daily_grid_export', 'system_daily_grid_export_energy', 4.8, 'kWh');
    system('daily_charge', 'system_daily_charging_energy', 3.8, 'kWh');
    system('daily_discharge', 'system_daily_discharging_energy', 2.4, 'kWh');
    system('status', 'integration_status', charging ? 'grid_charging' : discharging ? 'discharging' : 'balanced', undefined, {
      predictive_charging_enabled: true,
      predictive_charging_mode: 'Solar forecast',
      charge_blocked: false,
      discharge_blocked: !charging && !discharging,
      discharge_blockers: charging || discharging ? {} : { price_reserve_hold: true },
    });
    system('phase', 'three_phase_protection_status', 'active', undefined, { limited_batteries: [], unassigned_batteries: [], degraded_phases: [] });
    system('alarm', 'system_alarm_status', scenario === 'offline' ? 'Warning' : 'OK');
    system('connectivity', 'non_responsive_batteries', scenario === 'offline' ? 'Battery 3' : 'None');

    for (let index = 1; index <= 3; index++) {
      const deviceId = `demo-battery-${index}`;
      const offline = scenario === 'offline' && index === 3;
      registry.devices.push({ id: deviceId, name: `Battery ${index}`, manufacturer: 'Zendure', model: 'SolarFlow 800 Plus', config_entries: [integrationId] });
      const battery = (suffix: string, key: string, value: number | string, unit?: string) =>
        add(`sensor.demo_battery${index}_${suffix}`, offline ? 'unavailable' : value, unit, {}, { device_id: deviceId, translation_key: key, unique_id: `synthetic_pack_${index}_${key}` });
      const charge = soc + (index - 2) * 2;
      battery('soc', 'battery_soc', charge, '%');
      battery('stored', 'battery_stored_energy', 1920 * charge / 100, 'Wh');
      battery('capacity', 'battery_total_energy', 1920, 'Wh');
      battery('power', 'battery_power', cellPower / 3, 'W');
      battery('ac', 'delivered_ac_power', acPower / 3, 'W');
      battery('temperature', 'internal_temperature', scenario === 'partial' && index === 1 ? 'unknown' : 27.3 + index * 0.6, '°C');
      battery('daily_charge', 'total_daily_charging_energy', 1.1 + index * 0.1, 'kWh');
      battery('daily_discharge', 'total_daily_discharging_energy', 0.6 + index * 0.1, 'kWh');
      battery('health', 'battery_soh', scenario === 'partial' && index === 1 ? 'unknown' : 100 - index * 0.1, '%');
      battery('cycles', 'battery_cycle_count', scenario === 'partial' && index === 1 ? 'unknown' : 34 + index);
      battery('voltage', 'battery_voltage', scenario === 'partial' && index === 1 ? 'unknown' : 51.7 + index * 0.1, 'V');
    }

    const round = (value: number) => Math.round(value * 10_000) / 10_000;
    const solarAt = (index: number) => Math.max(0, 4.4 * Math.sin((index / 4 - 6.5) / 12 * Math.PI));
    const homeAt = (index: number) => 0.5 + 0.75 * Math.exp(-((index / 4 - 7.5) ** 2) / 2) + 1.1 * Math.exp(-((index / 4 - 18.5) ** 2) / 4);
    const cellAt = (index: number) => index >= 32 && index < 62 ? Math.min(1.95, Math.max(0, solarAt(index) - homeAt(index))) : index >= 68 && index < 88 ? -1.1 : 0;
    const socAt = (index: number) => round(index < 32 ? 48 - index * 0.35 : index < 62 ? 36.8 + (index - 32) * 1.75 : index < 68 ? 89.3 : Math.max(44, 89.3 - (index - 68) * 1.6));
    const actionAt = (index: number) => cellAt(index) > 0 ? 1 : cellAt(index) < 0 ? 4 : 0;
    const series: Record<string, (number | null)[]> = {};
    const operations: Record<string, unknown[]> = {};
    const actualSeconds = (index: number) => index < currentIndex ? 900 : index === currentIndex ? progress * 900 : 0;
    const remainingSeconds = (index: number) => index > currentIndex ? 900 : index === currentIndex ? (1 - progress) * 900 : 0;
    const isGap = (index: number) => scenario === 'partial' && index >= Math.max(0, currentIndex - 8) && index < currentIndex - 4;
    const array = (fn: (index: number) => number | null) => Array.from({ length: 96 }, (_, index) => fn(index));
    series.actual_coverage_s = array(index => isGap(index) ? 0 : actualSeconds(index));
    series.solar_actual_coverage_s = [...series.actual_coverage_s];
    series.consumption_actual_coverage_s = [...series.actual_coverage_s];
    for (const [prefix, valueAt] of [['solar', solarAt], ['consumption', homeAt]] as const) {
      series[`${prefix}_actual_kwh`] = array(index => actualSeconds(index) && !isGap(index) ? round(valueAt(index) * actualSeconds(index) / 3600) : null);
      series[`${prefix}_forecast_kwh`] = array(index => remainingSeconds(index) ? round(valueAt(index) * remainingSeconds(index) / 3600) : null);
    }
    for (const [prefix, seconds] of [['actual', actualSeconds], ['planned', remainingSeconds]] as const) {
      operations[`${prefix}_soc_pct`] = array(index => seconds(index) && !isGap(index) ? socAt(index) : null);
      operations[`${prefix}_action_mask`] = array(index => seconds(index) && !isGap(index) ? actionAt(index) : null);
      operations[`${prefix}_context_mask`] = array(index => seconds(index) ? index >= 8 && index < 24 ? 2 : 0 : null);
      operations[`${prefix}_charge_to_battery_kwh`] = array(index => seconds(index) && !isGap(index) ? round(Math.max(0, cellAt(index)) * seconds(index) / 3600) : null);
      operations[`${prefix}_discharge_from_battery_kwh`] = array(index => seconds(index) && !isGap(index) ? round(Math.max(0, -cellAt(index)) * seconds(index) / 3600) : null);
    }
    operations.observed_seconds_by_action_by_interval = Array.from({length:96}, (_,index) =>
      actualSeconds(index) && !isGap(index) ? { hold: index >= 8 && index < 24 ? actualSeconds(index) : 0 } : null);
    operations.planned_delay_until = Array.from({length:96}, (_,index) =>
      remainingSeconds(index) && index >= 8 && index < 24 ? new Date(today + 6 * 3_600_000).toISOString() : null);
    const extension = Array.from({ length: 48 }, (_, index) => ({
      extension_index: index,
      start: new Date(today + 86_400_000 + index * 900_000).toISOString(),
      end: new Date(today + 86_400_000 + (index + 1) * 900_000).toISOString(),
      solar_kwh: round(solarAt(index) / 4), consumption_kwh: round(homeAt(index) / 4),
      soc_end_pct: socAt(index), planned_action_mask: actionAt(index),
      charge_to_battery_kwh: round(Math.max(0, cellAt(index)) / 4),
      discharge_from_battery_kwh: round(Math.max(0, -cellAt(index)) / 4),
      planned_context_mask: index >= 8 && index < 24 ? 2 : 0,
      delay_active: index >= 8 && index < 24,
    }));
    system('timeline', 'daily_operation_timeline', date, undefined, {
      schema_version: 1, timeline_available: true, local_date: date, timezone: 'UTC',
      interval_count: 96, interval_minutes: 15, current_index: currentIndex, current_progress: progress,
      generated_at: publication, series, operations, extended_projection: extension,
      extended_horizon: { duration_s: Array(48).fill(900) },
    });

    const prices = (day: number) => Array.from({ length: 24 }, (_, hour) => ({
      start: new Date(today + day * 86_400_000 + hour * 3_600_000).toISOString(),
      end: new Date(today + day * 86_400_000 + (hour + 1) * 3_600_000).toISOString(),
      value: round(hour >= 11 && hour <= 14 ? -0.025 + (hour - 11) * 0.006 : 0.19 + 0.09 * Math.exp(-((hour - 18) ** 2) / 4)),
    }));
    add('sensor.demo_import_price', 0.194, 'EUR/kWh', { currency: 'EUR', raw_today: prices(0), raw_tomorrow: scenario === 'partial' ? [] : prices(1) });
  }

  const hass: DemoHomeAssistant = {
    states, entities: Object.fromEntries(registry.entities.map(entity => [entity.entity_id, entity])),
    devices: Object.fromEntries(registry.devices.map(device => [device.id, device])),
    language: 'en', locale: { language: 'en-GB', number_format: 'comma_decimal', time_format: '24' },
    config: { time_zone: 'UTC', currency: 'EUR' }, themes: { darkMode: false },
    panels: scenario === 'missing' ? {} : { omnibattery: { config: { domain: 'omnibattery', config_entry_id: integrationId,
      grid_entity: 'sensor.demo_grid', solar_entity: 'sensor.demo_solar', home_entity: 'sensor.demo_home',
      daily_operation_timeline_entity: 'sensor.demo_timeline', grid_inverted: false } } },
    __demoDiagnostics: diagnostics,
    callWS: async <T>(message: Record<string, unknown>): Promise<T> => {
      const type = String(message.type);
      diagnostics.requests.push(type);
      if (type.includes('service')) diagnostics.services.push(type);
      if (type === 'config/entity_registry/list') return registry.entities as T;
      if (type === 'config/device_registry/list') return registry.devices as T;
      throw new Error(`Unsupported demo request: ${type}`);
    },
    connection: { subscribeEvents: async () => {
      diagnostics.activeSubscriptions += 1;
      let active = true;
      return () => { if (active) { diagnostics.activeSubscriptions -= 1; active = false; } };
    } },
  };
  return { hass, registry };
}
