import { describe, expect, it } from 'vitest';
import { buildSnapshot, discover, metric, parsePrices, parseTimeline } from '../../src/data';
import type { CardConfig, HassEntity, HomeAssistant, RegistryData } from '../../src/types';

const config: CardConfig = { type: 'custom:omnibattery-overview-card' };
const NOW = new Date('2026-10-09T10:07:30Z');
function entity(id: string, state: string | number, attributes: Record<string, unknown> = {}): HassEntity {
  return { entity_id: id, state: String(state), attributes };
}
function fleet() {
  const registry: RegistryData = { entities: [], devices: [{ id: 'system', name: 'Omnibattery System' }] };
  const hass: HomeAssistant = { states: {}, config: { time_zone: 'Europe/Amsterdam', currency: 'EUR' } };
  const add = (key: string, state: string | number, unit?: string, device = 'system', attributes: Record<string, unknown> = {}) => {
    const id = `sensor.renamed_${registry.entities.length}`;
    registry.entities.push({ entity_id: id, platform: 'omnibattery', config_entry_id: 'entry-a', device_id: device,
      translation_key: key, unique_id: device === 'system' ? `marstek_venus_system_${key}` : `synthetic_${device}_${key}` });
    hass.states[id] = entity(id, state, { ...attributes, ...(unit ? { unit_of_measurement: unit } : {}) });
    return id;
  };
  for (let i = 0; i < 3; i++) {
    const id = `battery-${i}`;
    registry.devices.push({ id, name: `Battery ${i + 1}`, model: 'SolarFlow 800 Plus' });
    add('battery_soc', 60 + i * 10, '%', id);
    add('battery_power', 100 * (i + 1), 'W', id);
    add('battery_total_energy', 1920, 'Wh', id);
    add('battery_stored_energy', 1.3, 'kWh', id);
    add('internal_temperature', 24, '°C', id);
    add('total_daily_charging_energy', 0.7, 'kWh', id);
    add('total_daily_discharging_energy', 0.4, 'kWh', id);
  }
  add('system_soc', 70, '%');
  add('system_battery_cell_power', 600, 'W');
  add('system_charge_power', 100, 'W');
  add('system_discharge_power', 300, 'W');
  add('system_solar_power', 2400, 'W');
  add('home_consumption', 800, 'W');
  add('integration_status', 'balanced', undefined, 'system', { discharge_blocked: true, discharge_blockers: { price_discharge: 'Price is below the discharge threshold' } });
  return { hass, registry, add };
}
function timeline(overrides: Record<string, unknown> = {}): HassEntity {
  return entity('sensor.synthetic_timeline', '2026-10-09', {
    schema_version: 1, timeline_available: true, local_date: '2026-10-09', timezone: 'Europe/Amsterdam',
    interval_count: 96, interval_minutes: 15, current_index: 48, current_progress: 0.5, generated_at: NOW.toISOString(),
    series: { solar_actual_kwh: Array(96).fill(null), solar_forecast_kwh: Array(96).fill(0.25),
      consumption_actual_kwh: Array(96).fill(null), consumption_forecast_kwh: Array(96).fill(0.1), actual_coverage_s: Array(96).fill(null) },
    operations: { actual_action_mask: Array(96).fill(0), planned_action_mask: Array(96).fill(0), actual_soc_pct: Array(96).fill(null), planned_soc_pct: Array(96).fill(70) },
    ...overrides,
  });
}

describe('registry discovery and live telemetry', () => {
  it('discovers three renamed batteries through registry keys, and never mixes AC with cell power', () => {
    const { hass, registry } = fleet();
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.batteries).toHaveLength(3);
    expect(result.batteries[0].name).toBe('Battery 1');
    expect(result.batteries[0].capacity.value).toBe(1.92);
    expect(result.batteries[0].cellPower.value).toBe(100);
    expect(result.batteries[0].acPower.value).toBeNull();
    expect(result.cellPower.value).toBe(600);
    expect(result.acPower.value).toBe(-200);
    expect(result.home.value).toBe(800);
  });

  it('supports legacy platform and unique IDs without guessing from entity names', () => {
    const { hass, registry } = fleet();
    for (const row of registry.entities) { row.platform = 'marstek_venus'; delete row.translation_key; }
    registry.entities.push({ entity_id: 'sensor.omnibattery_system_soc', platform: 'unrelated', unique_id: 'system_soc' });
    hass.states['sensor.omnibattery_system_soc'] = entity('sensor.omnibattery_system_soc', 4, { unit_of_measurement: '%' });
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.soc.value).toBe(70);
    expect(result.batteries).toHaveLength(3);
  });

  it('requires an explicit config entry when two integrations exist', () => {
    const { hass, registry } = fleet();
    registry.entities.push({ entity_id: 'sensor.other', platform: 'omnibattery', config_entry_id: 'entry-b', unique_id: 'marstek_venus_system_system_soc', translation_key: 'system_soc' });
    hass.states['sensor.other'] = entity('sensor.other', 10, { unit_of_measurement: '%' });
    expect(buildSnapshot(hass, registry, config, NOW).error).toMatch(/Choose/);
    expect(buildSnapshot(hass, registry, { ...config, integration_id: 'entry-b' }, NOW).soc.value).toBe(10);
    expect(buildSnapshot(hass, registry, { ...config, integration_id: 'entry-b' }, NOW).batteries).toHaveLength(0);
  });

  it('uses complete panel solar without double-counting battery PV, and explicit overrides win', () => {
    const { hass, registry, add } = fleet();
    add('solar_power', 1000, 'W', 'battery-0');
    hass.states['sensor.complete_solar'] = entity('sensor.complete_solar', 3.4, { unit_of_measurement: 'kW' });
    hass.states['sensor.meter'] = entity('sensor.meter', -450, { unit_of_measurement: 'W' });
    hass.panels = { omni: { config: { domain: 'omnibattery', solar_entity: 'sensor.complete_solar', grid_entity: 'sensor.meter', grid_inverted: true } } };
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.solar.value).toBe(3400);
    expect(result.grid.value).toBe(450);
    const custom = buildSnapshot(hass, registry, { ...config, grid_inverted: false, entities: { solar: 'sensor.meter' } }, NOW);
    expect(custom.solar.value).toBe(-450);
    expect(custom.grid.value).toBe(-450);
  });

  it('normalizes AC output-positive sensors while leaving delivered AC charge-positive', () => {
    const { hass, registry, add } = fleet();
    add('ac_power', 400, 'W', 'battery-0');
    add('delivered_ac_power', -0.3, 'kW', 'battery-1');
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.batteries[0].acPower.value).toBe(-400);
    expect(result.batteries[1].acPower.value).toBe(-300);
  });

  it('applies battery overrides to only the selected battery', () => {
    const { hass, registry } = fleet();
    hass.states['sensor.custom_soc'] = entity('sensor.custom_soc', 90, { unit_of_measurement: '%' });
    const result = buildSnapshot(hass, registry, { ...config, battery: 'battery-1', entities: { batterySoc: 'sensor.custom_soc' } }, NOW);
    expect(result.batteries.map(battery => battery.soc.value)).toEqual([60, 90, 80]);
  });

  it('normalizes other batteries when one battery has a signed AC override', () => {
    const { hass, registry, add } = fleet();
    add('ac_power', 400, 'W', 'battery-0');
    add('ac_power', 400, 'W', 'battery-1');
    add('ac_power', 0, 'W', 'battery-2');
    registry.entities = registry.entities.filter(row => !['system_charge_power', 'system_discharge_power'].includes(row.translation_key ?? ''));
    hass.states['sensor.custom_ac'] = entity('sensor.custom_ac', 100, { unit_of_measurement: 'W' });
    const result = buildSnapshot(hass, registry, { ...config, battery: 'battery-0', entities: { batteryAcPower: 'sensor.custom_ac' } }, NOW);
    expect(result.batteries.map(battery => battery.acPower.value)).toEqual([100, -400, -0]);
    expect(result.acPower.value).toBe(-300);
  });

  it('keeps missing optional health out, and incomplete fleet totals unknown', () => {
    const { hass, registry, add } = fleet();
    add('battery_soh', 'unknown', '%', 'battery-0');
    const stored = registry.entities.find(row => row.device_id === 'battery-1' && row.translation_key === 'battery_stored_energy')!;
    hass.states[stored.entity_id].state = 'unavailable';
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.batteries[0].health).toEqual([]);
    expect(result.stored.value).toBeNull();
  });

  it('converts only supported units and never coerces missing, invalid or boolean states into zero', () => {
    expect(metric(entity('sensor.x', 1.25, { unit_of_measurement: 'kW' }), 'power').value).toBe(1250);
    expect(metric(entity('sensor.x', 1500, { unit_of_measurement: 'Wh' }), 'energy').value).toBe(1.5);
    expect(metric(entity('sensor.x', 77, { unit_of_measurement: '°F' }), 'temperature').value).toBe(25);
    for (const state of ['unknown', 'unavailable', '', 'NaN', 'true']) expect(metric(entity('sensor.x', state), 'number').value).toBeNull();
    expect(metric(entity('sensor.x', 1, { unit_of_measurement: 'A' }), 'power').value).toBeNull();
  });
});

describe('schema 1 timeline', () => {
  it('separates measured-to-date and remaining-interval forecasts, with independent coverage', () => {
    const source = timeline();
    const series = source.attributes.series as Record<string, unknown[]>;
    series.solar_actual_kwh[48] = 0.05;
    series.consumption_actual_kwh[48] = 0.1;
    series.solar_actual_coverage_s = Array(96).fill(null); series.solar_actual_coverage_s[48] = 300;
    series.consumption_actual_coverage_s = Array(96).fill(null); series.consumption_actual_coverage_s[48] = 450;
    series.actual_coverage_s[48] = 450;
    series.solar_forecast_kwh[48] = 0.05;
    const result = parseTimeline(source, NOW);
    expect(result.slots[48].solarActualKw).toBeCloseTo(0.6);
    expect(result.slots[48].homeActualKw).toBeCloseTo(0.8);
    expect(result.slots[48].solarForecastKw).toBeCloseTo(0.4);
    expect(result.slots[47].solarForecastKw).toBeNull();
    expect(result.slots[49].solarActualKw).toBeNull();
  });

  it('preserves unknown coverage gaps and never calls zero action a hold', () => {
    const source = timeline();
    (source.attributes.series as Record<string, unknown[]>).solar_actual_kwh[48] = 0.05;
    const result = parseTimeline(source, NOW);
    expect(result.slots[48].solarActualKw).toBeNull();
    expect(result.slots[49].holdForecast).toBeNull();
    const operations = source.attributes.operations as Record<string, unknown[]>;
    operations.planned_context_mask = Array(96).fill(0); operations.planned_context_mask[49] = 2;
    operations.actual_context_mask = Array(96).fill(2);
    operations.planned_grid_charge_decision = Array(96).fill('not_needed');
    const contextOnly = parseTimeline(source, NOW);
    expect(contextOnly.slots[47].holdActual).toBeNull();
    expect(contextOnly.slots[49].holdForecast).toBeNull();
  });

  it('requires a release boundary or explicit current delay state to infer hold', () => {
    const source = timeline({ delay: { enabled: true, state: 'Delayed' } });
    const operations = source.attributes.operations as Record<string, unknown[]>;
    operations.actual_context_mask = Array(96).fill(2);
    operations.planned_context_mask = Array(96).fill(2);
    operations.delay_until = Array(96).fill(null);
    operations.delay_until[47] = '2026-10-09T10:15:00Z';
    operations.delay_until[49] = '2026-10-09T10:30:00Z';
    let slots = parseTimeline(source, NOW).slots;
    expect(slots[47].holdActual).toBe(true);
    expect(slots[48].holdActual).toBe(true);
    expect(slots[48].holdForecast).toBe(true);
    expect(slots[49].holdForecast).toBe(true);
    expect(slots[50].holdForecast).toBeNull(); // current status cannot fill future cells

    operations.delay_until[48] = '2026-10-09T10:05:00Z';
    slots = parseTimeline(source, NOW).slots;
    expect(slots[48].holdActual).toBe(true); // delay occurred in the observed part
    expect(slots[48].holdForecast).toBeNull(); // release already passed

    operations.actual_action_mask[48] = 1;
    operations.planned_action_mask[49] = 4;
    slots = parseTimeline(source, NOW).slots;
    expect(slots[48].holdActual).toBeNull();
    expect(slots[49].holdForecast).toBeNull();
  });

  it('suppresses disabled or bypassed delay inference while retaining explicit observed hold', () => {
    const source = timeline();
    const operations = source.attributes.operations as Record<string, unknown[]>;
    operations.actual_context_mask = Array(96).fill(2);
    operations.planned_context_mask = Array(96).fill(2);
    operations.delay_until = Array(96).fill('2026-10-09T12:00:00Z');
    operations.observed_seconds_by_action_by_interval = Array.from({ length: 96 }, () => ({}));
    operations.observed_seconds_by_action_by_interval[46] = { hold: 120 };
    operations.observed_seconds_by_action_by_interval[45] = { hold: 0 };
    for (const delay of [{ enabled: false, state: 'Delayed' }, { enabled: true, weekly_full_charge_bypasses_delay: true }, { state: 'Skipped - Full Charge Day' }]) {
      source.attributes.delay = delay;
      const slots = parseTimeline(source, NOW).slots;
      expect(slots[45].holdActual).toBe(false);
      expect(slots[46].holdActual).toBe(true);
      expect(slots[47].holdActual).toBeNull();
      expect(slots[49].holdForecast).toBeNull();
    }
  });

  it('requires explicit extension delay evidence and never treats a charging interval as hold', () => {
    const projected = (index: number, extra: Record<string, unknown>) => ({ extension_index: index,
      start: `2026-10-10T00:${String(index * 15).padStart(2, '0')}:00+02:00`,
      end: index === 3 ? '2026-10-10T01:00:00+02:00' : `2026-10-10T00:${String((index + 1) * 15).padStart(2, '0')}:00+02:00`,
      action_mask: 0, context_mask: 2, ...extra });
    const source = timeline({ extended_projection: [projected(0, {}), projected(1, { delay_active: true }),
      projected(2, { delay_active: true, action_mask: 1 }), projected(3, { delay_until: '2026-10-10T01:00:00+02:00' })] });
    const slots = parseTimeline(source, NOW).slots;
    expect(slots[96].holdForecast).toBeNull();
    expect(slots[97].holdForecast).toBe(true);
    expect(slots[98].holdForecast).toBeNull();
    expect(slots[99].holdForecast).toBe(true);
  });

  it('rejects malformed and unsupported payloads without throwing', () => {
    for (const overrides of [{ schema_version: 2 }, { interval_count: 95 }, { local_date: '2026-02-31' }, { timezone: 'invalid/zone' }, { series: null }]) {
      const result = parseTimeline(timeline(overrides), NOW);
      expect(result.available).toBe(false);
      expect(result.error).toBeTruthy();
    }
    expect(parseTimeline(undefined, NOW).available).toBe(false);
  });

  it('uses fresh publication time, preserving history when forecasts age or midnight rolls over', () => {
    const source = timeline({ freshness: { updated_at: '2026-10-08T22:00:00Z' } });
    (source.attributes.series as Record<string, unknown[]>).solar_actual_kwh[47] = 0.25;
    expect(parseTimeline(source, NOW).stale).toBe(false);
    const stale = parseTimeline(source, new Date('2026-10-09T10:30:00Z'));
    expect(stale.stale).toBe(true);
    expect(stale.slots[47].solarActualKw).toBe(1);
    expect(stale.slots[49].solarForecastKw).toBeNull();
    source.last_updated = '2026-10-09T22:00:01Z';
    expect(parseTimeline(source, new Date('2026-10-09T22:00:01Z')).stale).toBe(true);
  });

  it('keeps profile forecasts when predictive charging is off', () => {
    const result = parseTimeline(timeline({ mode: 'disabled' }), NOW);
    expect(result.slots[50].solarForecastKw).toBe(1);
    expect(result.slots[50].homeForecastKw).toBe(0.4);
  });

  it('maps spring daylight-saving gaps onto the fixed local grid', () => {
    const date = '2026-03-29';
    const result = parseTimeline(timeline({ local_date: date, generated_at: '2026-03-29T00:30:00Z', current_index: 6, current_progress: 0 }), new Date('2026-03-29T00:30:00Z'));
    expect(result.slots).toHaveLength(96);
    expect(result.slots.slice(8, 12).every(slot => slot.skipped && slot.durationSeconds === 0 && slot.solarForecastKw === null)).toBe(true);
    expect(result.slots[7].durationSeconds).toBe(900);
    expect(result.slots[12].label).toBe('03:00');
  });

  it('averages both repeated quarters and preserves remaining second-fold forecasts', () => {
    const source = timeline({ local_date: '2026-10-25', generated_at: '2026-10-25T00:22:30Z', current_index: 9, current_progress: 0.5 });
    const series = source.attributes.series as Record<string, unknown[]>;
    series.solar_actual_kwh[8] = 0.25; series.actual_coverage_s[8] = 900;
    const result = parseTimeline(source, new Date('2026-10-25T00:22:30Z'));
    expect(result.slots[8].repeated).toBe(true);
    expect(result.slots[8].durationSeconds).toBe(1800);
    expect(result.slots[8].solarActualKw).toBe(1);
    expect(result.slots[8].solarForecastKw).toBe(1); // second occurrence remains
    expect(result.slots[9].solarForecastKw).toBeCloseTo(2 / 3); // 450s + 900s remain
    source.attributes.generated_at = '2026-10-25T02:00:00Z'; source.attributes.current_index = 12;
    series.solar_actual_kwh[8] = 0.5; series.actual_coverage_s[8] = 1800;
    expect(parseTimeline(source, new Date('2026-10-25T02:00:00Z')).slots[8].solarActualKw).toBe(1);
  });

  it('keeps sparse next-day positions and explicit timestamp durations', () => {
    const source = timeline({ extended_projection: [
      { extension_index: 2, start: '2026-10-10T00:30:00+02:00', end: '2026-10-10T00:45:00+02:00', solar_kwh: 0.125, consumption_kwh: 0.1, soc_end_pct: 55, action_mask: 4 },
      { index: 100, start: '2026-10-10T01:00:00+02:00', end: '2026-10-10T01:15:00+02:00', solar_kwh: 0.2 },
    ] });
    const result = parseTimeline(source, NOW);
    expect(result.slots).toHaveLength(101);
    expect(result.slots[96].solarForecastKw).toBeNull();
    expect(result.slots[98].solarForecastKw).toBe(0.5);
    expect(result.slots[98].socForecast).toBe(55);
    expect(result.slots[100].label).toBe('01:00');
  });
});

describe('status and prices', () => {
  it('explains blockers even while the primary state is balanced', () => {
    const { hass, registry, add } = fleet();
    add('three_phase_protection_status', 'active', undefined, 'system', { limited_batteries: [], unassigned_batteries: [], degraded_phases: [] });
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.status.find(row => row.key === 'operation')?.title).toBe('Matching household demand');
    expect(result.status.find(row => row.key === 'discharge-blocked')).toMatchObject({ title: 'Discharging blocked', tone: 'warning' });
    expect(result.status.find(row => row.key === 'phase-protection')).toMatchObject({ title: 'Phase protection enabled', tone: 'neutral' });
    expect(result.status.find(row => row.key === 'discharge-blocked')?.detail).toMatch(/price|Price/);
  });

  it('reports an offline battery without inventing an alarm for unsupported metrics', () => {
    const { hass, registry, add } = fleet();
    for (const row of registry.entities.filter(row => row.device_id === 'battery-0')) hass.states[row.entity_id].state = 'unavailable';
    add('fault_level', 'unknown', undefined, 'battery-0');
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.batteries[0].available).toBe(false);
    expect(result.status.find(row => row.key === 'connectivity')?.tone).toBe('error');
    expect(result.status.some(row => row.key === 'fault-battery-0')).toBe(false);
  });

  it('explains active reserves, delayed charging and protection from diagnostic entities', () => {
    const { hass, registry, add } = fleet();
    add('discharge_reserve_status', 'on', undefined, 'system', { reserve_soc_pct: 35 });
    add('surplus_price_hold_status', 'on', undefined, 'system');
    add('charge_delay_status', 'delayed', undefined, 'system', { estimated_unlock_time: '15:30' });
    add('curtailment_status', 'on', undefined, 'system', { status: 'protected_window', inverter_curtailment_required: true });
    add('capacity_protection_active', 'on', undefined, 'system', { action: 'shaving' });
    const result = buildSnapshot(hass, registry, config, NOW);
    expect(result.status.find(row => row.key === 'reserve')?.detail).toMatch(/35%/);
    expect(result.status.find(row => row.key === 'charge-delay')?.detail).toContain('15:30');
    expect(result.status.find(row => row.key === 'curtailment')?.detail).toMatch(/curtailment is required/);
    expect(result.status.filter(row => row.key === 'capacity_protection')).toHaveLength(1);
    expect(result.status.some(row => row.key === 'surplus-hold')).toBe(true);
  });

  it('trusts a named non-responsive battery even if its last telemetry is available', () => {
    const { hass, registry, add } = fleet();
    add('non_responsive_batteries', 'Battery 2');
    const row = buildSnapshot(hass, registry, config, NOW).status.find(item => item.key === 'connectivity');
    expect(row?.tone).toBe('error');
    expect(row?.detail).toBe('Battery 2');
  });

  it('retains negative and repeated-hour timestamped Nord Pool prices without inventing tomorrow', () => {
    const price = entity('sensor.synthetic_price', '-0.02', { currency: 'EUR', unit_of_measurement: 'EUR/kWh', raw_today: [
      { start: '2026-10-25T02:00:00+02:00', end: '2026-10-25T03:00:00+02:00', value: -0.02 },
      { start: '2026-10-25T02:00:00+01:00', end: '2026-10-25T03:00:00+01:00', value: 0.12 },
      { start: 'bad', end: 'bad', value: 1 },
      { start: '2026-10-25T03:00:00+01:00', end: 'bad', value: 1 },
    ], raw_tomorrow: [] });
    expect(parsePrices(price)?.points.map(point => point.value)).toEqual([-0.02, 0.12]);
    expect(parsePrices(price)?.unit).toBe('EUR/kWh');
    expect(parsePrices(entity('sensor.empty', 'unavailable'))).toBeUndefined();
  });

  it('does not consult the panel of another selected integration', () => {
    const { hass, registry } = fleet();
    registry.entities.push({ entity_id: 'sensor.other', platform: 'omnibattery', config_entry_id: 'entry-b', translation_key: 'system_soc' });
    hass.panels = { omni: { config: { domain: 'omnibattery', solar_entity: 'sensor.solar_from_other_entry' } } };
    expect(discover(hass, registry, { ...config, integration_id: 'entry-b' }).panel).toEqual({});
  });
});
