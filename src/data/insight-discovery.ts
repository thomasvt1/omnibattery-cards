import type { CardConfig, HassEntity, HomeAssistant, InsightSources, RegistryData } from '../types';
import type { Discovery } from './discovery';
import { matchesKey } from './discovery';
import { list, record, text } from './values';

/** Resolve capabilities, never names or the current availability of competing sources. */
export function discoverInsightSources(hass: HomeAssistant, registry: RegistryData, config: CardConfig, discovery: Discovery): InsightSources {
  const entityIds = new Set<string>();
  const rows = new Map(registry.entities.map(row => [row.entity_id, row]));
  const candidates = Object.values(hass.states).filter(entity => {
    const row = rows.get(entity.entity_id);
    return entity.entity_id.startsWith('sensor.') && !row?.disabled_by &&
      (!row || !['omnibattery', 'marstek_venus'].includes(row.platform ?? '') || discovery.entities.includes(row));
  });
  const resolve = (id: string | undefined, matches: HassEntity[], label: string) => {
    if (id) {
      entityIds.add(id);
      return { entity: hass.states[id] };
    }
    matches.forEach(entity => entityIds.add(entity.entity_id));
    if (discovery.error) return { error: discovery.error };
    if (matches.length === 1) return { entity: matches[0] };
    return { error: matches.length > 1 ? `Multiple ${label} sources found. Select one in the editor.` : undefined };
  };
  const price = resolve(config.import_price_entity || text(discovery.panel.import_price_entity), candidates.filter(entity =>
    entity.entity_id !== config.export_price_entity &&
    (Array.isArray(entity.attributes.raw_today) || Array.isArray(entity.attributes.raw_tomorrow))), 'timestamped price');
  const metric = config.forecast_metric === 'home' ? 'consumption_kwh' : 'solar_kwh';
  const saved = resolve(config.saved_forecast_entity || text(discovery.panel.saved_forecast_entity), candidates.filter(entity =>
    entity.attributes.schema_version === 1 && Number.isFinite(Date.parse(text(entity.attributes.saved_at) ?? '')) &&
    list(entity.attributes.intervals).some(interval => metric in record(interval))), 'saved forecast');
  const grid = resolve(config.entities?.dailyGridToHome || text(discovery.panel.daily_grid_to_home_entity), candidates.filter(entity => {
    const row = rows.get(entity.entity_id);
    return row && discovery.entities.includes(row) &&
      ['daily_grid_to_home_energy', 'system_daily_grid_to_home_energy'].some(key => matchesKey(row, key));
  }), 'grid-to-home energy');
  return { importPrice: price.entity, savedForecast: saved.entity, gridToHome: grid.entity,
    importPriceError: price.error, savedForecastError: saved.error, gridToHomeError: grid.error, entityIds: [...entityIds] };
}
