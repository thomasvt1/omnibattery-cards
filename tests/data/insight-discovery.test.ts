import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../../src/data';
import { createDemo } from '../../src/demo/fixtures';
import type { CardConfig } from '../../src/types';

const now = new Date('2026-06-15T12:30:00Z');
const config: CardConfig = { type: 'custom:omnibattery-price-windows-card' };
const setup = () => createDemo('solar', now);

describe('insight source discovery', () => {
  it('discovers companion outputs by contract and scopes them to the selected timeline', () => {
    const { hass, registry } = setup();
    delete hass.states['sensor.demo_saved_forecast'];
    for (const source of ['sensor.demo_timeline', 'sensor.other_timeline']) {
      for (const kind of ['grid_to_home', 'saved_forecast']) {
        const entity_id = `${source}_${kind}`;
        hass.states[entity_id] = {entity_id, state: 'unavailable', attributes: {
          companion_schema: 1, companion_kind: kind, source_timeline: source,
        }};
      }
    }
    const result = buildSnapshot(hass, registry, config, now).insightSources;
    expect(result.companionInstalled).toBe(true);
    expect(result.savedForecast?.entity_id).toBe('sensor.demo_timeline_saved_forecast');
    expect(result.gridToHome?.entity_id).toBe('sensor.demo_timeline_grid_to_home');
    expect(result.entityIds).toContain('sensor.demo_timeline_saved_forecast');
    expect(result.savedForecastError).toBeUndefined();
  });

  it('keeps import tariffs opt-in for other cards, including export-only plans', () => {
    const { hass, registry } = setup();
    for (const type of ['custom:omnibattery-plan-card', 'custom:omnibattery-daily-operation-card'] as const) {
      expect(buildSnapshot(hass, registry, { type, export_price_entity: 'sensor.export' }, now).importPrices).toBeUndefined();
      expect(buildSnapshot(hass, registry, { type, import_price_entity: 'sensor.demo_import_price' }, now).importPrices?.entityId).toBe('sensor.demo_import_price');
    }
  });

  it('finds a unique timestamped price source and saved forecast without manual configuration', () => {
    const { hass, registry } = setup();
    const snapshot = buildSnapshot(hass, registry, config, now);
    expect(snapshot.importPrices?.entityId).toBe('sensor.demo_import_price');
    expect(snapshot.insightSources.savedForecast?.entity_id).toBe('sensor.demo_saved_forecast');
  });

  it('uses stable registry keys for renamed grid-to-home counters', () => {
    const { hass, registry } = setup();
    registry.entities.push({ entity_id: 'sensor.demo_grid_to_home', platform: 'omnibattery',
      config_entry_id: 'demo-omnibattery', translation_key: 'daily_grid_to_home_energy' });
    expect(buildSnapshot(hass, registry, config, now).insightSources.gridToHome?.state).toBe('1.85');
  });

  it('reports ambiguity instead of picking an arbitrary tariff or snapshot', () => {
    const { hass, registry } = setup();
    for (const key of ['import_price', 'saved_forecast']) {
      const original = hass.states[`sensor.demo_${key}`];
      hass.states[`sensor.second_${key}`] = { ...original, entity_id: `sensor.second_${key}` };
    }
    const snapshot = buildSnapshot(hass, registry, config, now);
    expect(snapshot.importPrices).toBeUndefined();
    expect(snapshot.insightSources.importPriceError).toContain('Multiple');
    expect(snapshot.insightSources.savedForecast).toBeUndefined();
    expect(snapshot.insightSources.savedForecastError).toContain('Multiple');
  });

  it('honors explicit missing and unavailable sources without silently replacing them', () => {
    const { hass, registry } = setup();
    const explicit = { ...config, import_price_entity: 'sensor.absent', saved_forecast_entity: 'sensor.absent',
      entities: { dailyGridToHome: 'sensor.absent' } };
    const snapshot = buildSnapshot(hass, registry, explicit, now);
    expect(snapshot.importPrices).toBeUndefined();
    expect(snapshot.insightSources.savedForecast).toBeUndefined();
    expect(snapshot.insightSources.gridToHome).toBeUndefined();
    hass.states['sensor.demo_import_price'].state = 'unavailable';
    const unavailable = buildSnapshot(hass, registry, config, now);
    expect(unavailable.importPrices).toBeUndefined();
    expect(unavailable.insightSources.entityIds).toContain('sensor.demo_import_price');
  });

  it('does not treat a live forecast or grid import as the missing specialized sources', () => {
    const { hass, registry } = setup();
    delete hass.states['sensor.demo_saved_forecast'];
    const snapshot = buildSnapshot(hass, registry, config, now);
    expect(snapshot.insightSources.savedForecast).toBeUndefined();
    expect(snapshot.insightSources.gridToHome).toBeUndefined();
  });

  it('keeps competing unavailable tariffs ambiguous and allows an explicit choice', () => {
    const { hass, registry } = setup();
    hass.states['sensor.export'] = { ...hass.states['sensor.demo_import_price'], entity_id: 'sensor.export', state: 'unavailable' };
    expect(buildSnapshot(hass, registry, config, now).insightSources.importPriceError).toContain('Multiple');
    expect(buildSnapshot(hass, registry, { ...config, import_price_entity: 'sensor.demo_import_price' }, now).importPrices?.entityId).toBe('sensor.demo_import_price');
    expect(buildSnapshot(hass, registry, { ...config, export_price_entity: 'sensor.export' }, now).importPrices?.entityId).toBe('sensor.demo_import_price');
  });

  it('excludes disabled sources and grid-to-home counters belonging to another integration', () => {
    const { hass, registry } = setup();
    registry.entities.push({ entity_id: 'sensor.demo_grid_to_home', platform: 'omnibattery', config_entry_id: 'other', translation_key: 'daily_grid_to_home_energy' });
    registry.entities.push({ entity_id: 'sensor.demo_import_price', disabled_by: 'user' });
    const snapshot = buildSnapshot(hass, registry, { ...config, integration_id: 'demo-omnibattery' }, now);
    expect(snapshot.insightSources.gridToHome).toBeUndefined();
    expect(snapshot.importPrices).toBeUndefined();
  });

  it('uses selected panel references before generic capability discovery', () => {
    const { hass, registry } = setup();
    hass.states['sensor.second'] = { ...hass.states['sensor.demo_import_price'], entity_id: 'sensor.second' };
    hass.panels = { omni: { config: { domain: 'omnibattery', config_entry_id: 'demo-omnibattery', import_price_entity: 'sensor.second' } } };
    expect(buildSnapshot(hass, registry, config, now).importPrices?.entityId).toBe('sensor.second');
    expect(buildSnapshot(hass, registry, { ...config, import_price_entity: 'sensor.demo_import_price' }, now).importPrices?.entityId).toBe('sensor.demo_import_price');
  });
});
