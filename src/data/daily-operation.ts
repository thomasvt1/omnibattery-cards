import type { PriceSeries, TimelineSlot } from '../types';
import { activityKinds } from './activity';

/** No advice is inferred from power: action masks are the integration's authority. */
export function operationAdvice(slot: TimelineSlot, projected: boolean): { label: string; tone: string } {
  if (slot.skipped) return {label:'Skipped (DST)', tone:'neutral'};
  const mask = projected ? slot.actionForecast : slot.actionActual;
  const hold = projected ? slot.holdForecast : slot.holdActual;
  const kinds = activityKinds(mask, hold);
  const labels = {solar:'Charge (solar)', grid:'Charge (grid)', discharge:'Discharge', hold:'Hold'};
  return {label:kinds.length ? kinds.map(kind=>labels[kind]).join(' + ') : mask === 0 ? 'Idle' : 'Unknown',
    tone:kinds.length === 1 ? kinds[0] : 'neutral'};
}

/** Weighted tariff only when published periods cover the full physical interval once. */
export function operationPrice(slot: TimelineSlot, prices?: PriceSeries): number | null {
  if (!prices || slot.skipped || slot.repeated || !slot.start || !slot.end) return null;
  const start = Date.parse(slot.start), end = Date.parse(slot.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  let cursor = start, total = 0;
  for (const point of prices.points) {
    const a = Math.max(start, Date.parse(point.start)), b = Math.min(end, Date.parse(point.end));
    if (b <= a) continue;
    if (a !== cursor) return null; // gap or overlapping tariff
    total += point.value * (b-a); cursor = b;
  }
  return cursor === end ? total / (end-start) : null;
}

export function operationHomeEnergy(slot: TimelineSlot, projected: boolean): number | null {
  if (projected) return slot.homeForecastKwh ?? null;
  const seconds = slot.homeCoverageSeconds ?? (slot.homeActualKw !== null ? slot.durationSeconds : 0);
  return slot.homeActualKw !== null && seconds > 0 ? slot.homeActualKw * seconds / 3600 : null;
}
