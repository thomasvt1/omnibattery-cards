import type { HassEntity, PriceSeries } from '../types';
import { list, number, record, text } from './values';

/** Nord Pool timestamps define the price periods (including DST and sub-hourly data). */
export function parsePrices(entity?: HassEntity, fallbackCurrency = ''): PriceSeries | undefined {
  if (!entity) return undefined;
  const seen = new Set<string>();
  const points: PriceSeries['points'] = [];
  for (const raw of [...list(entity.attributes.raw_today), ...list(entity.attributes.raw_tomorrow)]) {
    const item = record(raw), start = text(item.start), end = text(item.end), value = number(item.value);
    if (!start || !end || value === null || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) continue;
    const key = `${Date.parse(start)}/${Date.parse(end)}`;
    if (seen.has(key)) continue;
    seen.add(key); points.push({ start, end, value });
  }
  if (!points.length) return undefined;
  points.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const currency = text(entity.attributes.currency) ?? fallbackCurrency;
  return { entityId: entity.entity_id, currency, unit: text(entity.attributes.unit_of_measurement) ?? (currency ? `${currency}/kWh` : 'per kWh'), points };
}
