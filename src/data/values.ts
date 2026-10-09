import type { HassEntity, Metric } from '../types';

export const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const number = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export const available = (entity?: HassEntity): entity is HassEntity => !!entity && !['unavailable', 'unknown', 'none', ''].includes(entity.state.toLowerCase());
export const missing = (): Metric => ({ value: null });

/** Normalize live powers to W and energies to kWh, never coerce unavailable to zero. */
export function metric(entity: HassEntity | undefined, kind: 'power' | 'energy' | 'number' | 'temperature' = 'number', sign = 1): Metric {
  const result: Metric = { value: null, ...(entity ? { entityId: entity.entity_id } : {}) };
  if (!available(entity)) return result;
  let value = number(entity.state);
  if (value === null) return result;
  const unit = text(entity.attributes.unit_of_measurement)?.replace(/\s/g, '').toLowerCase();
  if (kind === 'power') {
    if (unit === 'kw') value *= 1000;
    else if (unit === 'mw') value *= 1000000;
    else if (unit !== 'w') return result;
  }
  if (kind === 'energy') {
    if (unit === 'wh') value /= 1000;
    else if (unit === 'mwh') value *= 1000;
    else if (unit !== 'kwh') return result;
  }
  if (kind === 'temperature') {
    if (unit === '°f' || unit === 'f') value = (value - 32) * 5 / 9;
    else if (unit !== '°c' && unit !== 'c') return result;
  }
  result.value = value * sign;
  return result;
}

/** A partial fleet is not a fleet total. */
export function sumMetrics(values: Metric[]): Metric {
  return { value: values.length && values.every(item => item.value !== null) ? values.reduce((sum, item) => sum + item.value!, 0) : null };
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}
