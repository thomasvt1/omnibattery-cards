import type { HassEntity, PriceSeries, TimelineModel } from '../types';
import { available, list, number, record, text } from './values';

/** Ratios are unavailable when counters cannot describe a physical share. */
export function retainedShare(total: number | null, outgoing: number | null): number | null {
  return total !== null && outgoing !== null && total > 0 && outgoing >= 0 && outgoing <= total
    ? 100 * (total - outgoing) / total : null;
}

export interface PriceWindow { start: number; end: number; value: number; }
/** Exact duration-weighted extrema, including optima ending on tariff boundaries. */
export function priceWindows(series: PriceSeries | undefined, now: number, duration = 7_200_000) {
  const points = (series?.points ?? []).map(p => ({ start: Date.parse(p.start), end: Date.parse(p.end), value: p.value }));
  const candidates = new Set([now, ...points.flatMap(p => [p.start, p.end - duration])]);
  const windows: PriceWindow[] = [];
  for (const start of candidates) {
    if (start < now) continue;
    const end = start + duration;
    let cursor = start, weighted = 0, valid = true;
    for (const p of points.filter(p => p.end > start && p.start < end)) {
      const left = Math.max(p.start, start), right = Math.min(p.end, end);
      if (left !== cursor) { valid = false; break; }
      weighted += (right - left) * p.value; cursor = right;
    }
    if (valid && cursor === end) windows.push({ start, end, value: weighted / duration });
  }
  windows.sort((a, b) => a.value - b.value || a.start - b.start);
  const current = points.filter(p => p.start <= now && now < p.end);
  return { low: windows[0], high: windows.length ? windows.reduce((a, b) => b.value > a.value ? b : a) : undefined,
    current: current.length === 1 ? current[0].value : null };
}
export interface AccuracyPoint { start: number; end: number; measured: number; forecast: number; }
export interface Accuracy { points: AccuracyPoint[]; savedAt?: number; error?: string; measured: number; forecast: number; }
/** A saved snapshot must predate each fully measured interval. Never use a revised live forecast. */
export function forecastAccuracy(entity: HassEntity | undefined, timeline: TimelineModel, metric: 'solar' | 'home', now: number): Accuracy {
  const result: Accuracy = { points: [], measured: 0, forecast: 0 };
  if (!available(entity)) return { ...result, error: 'Select an available saved forecast entity.' };
  const data = entity.attributes, savedAt = Date.parse(text(data.saved_at) ?? '');
  if (data.schema_version !== 1 || !Number.isFinite(savedAt) || savedAt > now)
    return { ...result, error: 'Saved forecast requires schema 1 and a valid saved_at timestamp.' };
  if (!timeline.available) return { ...result, error: timeline.error ?? 'Timeline unavailable.' };
  let today: string;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timeline.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).map(part => [part.type, part.value]));
    today = `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return { ...result, error: 'The timeline time zone is invalid.' }; }
  if (timeline.localDate !== today) return { ...result, error: 'Today’s timeline is not available yet.' };
  result.savedAt = savedAt;
  const forecasts = list(data.intervals).map(raw => {
    const p = record(raw);
    return { start: Date.parse(text(p.start) ?? ''), end: Date.parse(text(p.end) ?? ''),
      savedAt: p.saved_at === undefined ? savedAt : Date.parse(text(p.saved_at) ?? ''),
      energy: number(p[metric === 'solar' ? 'solar_kwh' : 'consumption_kwh']) };
  });
  for (const slot of timeline.slots) {
    const start = Date.parse(slot.start ?? ''), end = Date.parse(slot.end ?? '');
    const actual = metric === 'solar' ? slot.solarActualKw : slot.homeActualKw;
    const coverage = metric === 'solar' ? slot.solarCoverageSeconds : slot.homeCoverageSeconds;
    // Fall-back wall cells aggregate separate occurrences; don't imply a contiguous comparison.
    if (!Number.isFinite(start) || !Number.isFinite(end) || end > now || start < savedAt || slot.repeated || slot.skipped ||
      actual === null || slot.durationSeconds <= 0 || coverage !== slot.durationSeconds ||
      end - start !== slot.durationSeconds * 1000) continue;
    const matches = forecasts.filter(p => p.start < end && p.end > start);
    if (matches.length !== 1) continue;
    const p = matches[0];
    if (p.start !== start || p.end !== end || !Number.isFinite(p.savedAt) || p.savedAt < savedAt || p.savedAt > start || p.energy === null || p.energy < 0) continue;
    result.points.push({ start, end, measured: actual, forecast: p.energy * 3600 / slot.durationSeconds });
    result.measured += actual * slot.durationSeconds / 3600; result.forecast += p.energy;
  }
  if (!result.points.length) result.error = 'No complete matching intervals yet.';
  return result;
}
