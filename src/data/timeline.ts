import type { HassEntity, TimelineModel, TimelineSlot } from '../types';
import { available, list, number, record, text } from './values';

const QUARTER_SECONDS = 900;
const getNumber = (data: Record<string, unknown>, key: string, index: number) => number(list(data[key])[index]);
const getText = (data: Record<string, unknown>, key: string, index: number) => text(list(data[key])[index]);
const flag = (data: Record<string, unknown>, key: string, index: number) => list(data[key])[index] === true;
const energyPower = (energy: number | null, seconds: number): number | null => energy !== null && energy >= 0 && seconds > 0 ? energy * 3600 / seconds : null;
const socValue = (value: number | null): number | null => value !== null && value >= 0 && value <= 100 ? value : null;
const netEnergy = (charge: number | null, discharge: number | null): number | null =>
  charge === null && discharge === null ? null : (charge ?? 0) - (discharge ?? 0);
const mask = (value: number | null): number | null => value !== null && Number.isInteger(value) && value >= 0 && value <= 7 ? value : null;

/** Delay context alone can mean the feature is enabled, not that charging is held. */
function delayHold(action: number | null, delay: Record<string, unknown>, until: unknown, after: number,
  current = false, explicitlyActive = false): boolean | null {
  if (action !== 0 || delay.enabled === false || delay.weekly_full_charge_bypasses_delay === true) return null;
  const state = (text(delay.state) ?? text(delay.status) ?? '').trim().toLowerCase();
  if (state === 'skipped - full charge day') return null;
  const boundary = typeof until === 'string' ? Date.parse(until) : NaN;
  const currentDelay = current && (state.startsWith('delayed') ||
    ['waiting for solar', 'waiting for forecast', 'waiting_for_solar', 'waiting', 'blocked'].includes(state));
  // A known release time that has passed cannot support a projected hold.
  if (Number.isFinite(boundary)) return boundary > after ? true : null;
  return explicitlyActive || currentDelay ? true : null;
}

interface WallCell { start?: string; end?: string; duration: number; occurrences: number[]; }
const gridCache = new Map<string, WallCell[]>();

/** Map physical quarter hours onto 96 local cells. Fall-back cells own two occurrences. */
function wallGrid(date: string, timeZone: string): WallCell[] {
  const key = `${date}/${timeZone}`;
  const cached = gridCache.get(key);
  if (cached) return cached;
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const grid: WallCell[] = Array.from({ length: 96 }, () => ({ duration: 0, occurrences: [] }));
  const midnight = Date.parse(`${date}T00:00:00Z`);
  for (let stamp = midnight - 15 * 3600000; stamp < midnight + 40 * 3600000; stamp += QUARTER_SECONDS * 1000) {
    const p = Object.fromEntries(format.formatToParts(stamp).map(part => [part.type, part.value]));
    if (`${p.year}-${p.month}-${p.day}` !== date) continue;
    const index = Number(p.hour) * 4 + Math.floor(Number(p.minute) / 15);
    const cell = grid[index];
    if (!cell) continue;
    cell.occurrences.push(stamp);
    cell.duration += QUARTER_SECONDS;
    cell.start ??= new Date(stamp).toISOString();
    cell.end = new Date(stamp + QUARTER_SECONDS * 1000).toISOString();
  }
  if (gridCache.size > 8) gridCache.delete(gridCache.keys().next().value!);
  gridCache.set(key, grid);
  return grid;
}

function localDate(now: Date, timeZone: string): string {
  const pieces = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map(part => [part.type, part.value]));
  return `${pieces.year}-${pieces.month}-${pieces.day}`;
}

function blankSlot(index: number, durationSeconds = QUARTER_SECONDS): TimelineSlot {
  return { index, label: `${String(Math.floor((index % 96) / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`,
    durationSeconds, repeated: false, skipped: false,
    solarActualKw: null, solarForecastKw: null, homeActualKw: null, homeForecastKw: null,
    socActual: null, socForecast: null, batteryActualKw: null, batteryForecastKw: null,
    actionActual: null, actionForecast: null, holdActual: null, holdForecast: null, actualCoverageSeconds: null };
}

/** Pure parser for Omnibattery schema 1. No history requests or control services. */
export function parseTimeline(entity?: HassEntity, now = new Date(), fallbackZone = 'UTC', showExtension = true): TimelineModel {
  const result: TimelineModel = { available: false, warnings: [], localDate: '', timeZone: fallbackZone,
    currentIndex: 0, currentProgress: 0, stale: false, slots: [], ...(entity ? { entityId: entity.entity_id } : {}) };
  if (!available(entity) || entity.attributes.timeline_available === false) {
    result.error = 'The daily operation timeline is unavailable.'; return result;
  }
  const data = entity.attributes;
  if (number(data.schema_version) !== 1) {
    result.error = 'This timeline version is not supported. Schema 1 is required.'; return result;
  }
  const date = text(data.local_date) ?? entity.state;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
    number(data.interval_count) !== 96 || number(data.interval_minutes) !== 15) {
    result.error = 'The timeline has invalid date or interval metadata.'; return result;
  }
  const series = record(data.series), operations = record(data.operations);
  const delay = record(data.delay);
  if (!Object.values(series).some(Array.isArray) || !Object.keys(operations).length) {
    result.error = 'The timeline is missing its energy or operation series.'; return result;
  }
  result.localDate = date;
  result.timeZone = text(data.timezone) ?? fallbackZone;
  let grid: WallCell[];
  try { grid = wallGrid(date, result.timeZone); }
  catch { result.error = 'The timeline time zone is invalid.'; return result; }
  result.available = true;
  const fresh = record(data.freshness);
  // freshness.updated_at can legitimately remain at midnight. Use publication time instead.
  const publicationTimes = [data.generated_at, entity.last_updated].map(value => typeof value === 'string' ? Date.parse(value) : NaN).filter(Number.isFinite);
  const publishedAt = publicationTimes.length ? Math.max(...publicationTimes) : NaN;
  result.generatedAt = Number.isFinite(publishedAt) ? new Date(publishedAt).toISOString() : undefined;
  result.stale = data.stale === true || fresh.stale === true || fresh.state === 'stale' ||
    (Number.isFinite(publishedAt) && now.getTime() - publishedAt > 15 * 60 * 1000) || localDate(now, result.timeZone) !== date;
  if (result.stale) result.warnings.push('Forecast is out of date. Recorded history is still shown.');
  if (!publicationTimes.length) result.warnings.push('Timeline update time is unavailable.');
  result.currentIndex = Math.min(95, Math.max(0, Math.floor(number(data.current_index) ?? 0)));
  result.currentProgress = Math.min(1, Math.max(0, number(data.current_progress) ?? 0));
  const generatedTime = typeof data.generated_at === 'string' ? Date.parse(data.generated_at) : NaN;
  const referenceTime = Number.isFinite(generatedTime) ? generatedTime : now.getTime();
  const metadata = record(data.interval_grid);
  for (let index = 0; index < 96; index++) {
    const wall = grid[index];
    const slot = blankSlot(index, getNumber(metadata, 'duration_s', index) ?? wall.duration);
    slot.start = getText(metadata, 'starts', index) ?? wall.start;
    slot.end = getText(metadata, 'ends', index) ?? wall.end;
    slot.skipped = flag(data, 'dst_skipped', index) || flag(metadata, 'dst_skipped', index) || wall.duration === 0;
    slot.repeated = flag(data, 'dst_repeated', index) || flag(metadata, 'dst_repeated', index) || wall.occurrences.length > 1;
    // The sensor DTO omits interval_grid; explicit DST flags remain authoritative.
    if (slot.skipped) slot.durationSeconds = 0;
    else if (slot.repeated) slot.durationSeconds = Math.max(1800, slot.durationSeconds);
    result.slots.push(slot);
    if (slot.skipped) continue;
    const current = index === result.currentIndex;
    const past = slot.repeated && wall.occurrences.length > 1 ? referenceTime >= wall.occurrences.at(-1)! + QUARTER_SECONDS * 1000 : index < result.currentIndex;
    const reportedCoverage = getNumber(series, 'actual_coverage_s', index);
    const solarCoverage = getNumber(series, 'solar_actual_coverage_s', index) ?? reportedCoverage;
    const homeCoverage = getNumber(series, 'consumption_actual_coverage_s', index) ?? reportedCoverage;
    const hasActual = past || current || slot.repeated && (
      (reportedCoverage ?? 0) > 0 || getNumber(series, 'solar_actual_kwh', index) !== null || getNumber(series, 'consumption_actual_kwh', index) !== null);
    // A past cell without coverage metadata represents the full physical interval.
    // For the current cell, missing coverage means unknown, never a full quarter.
    const coveredSeconds = (coverage: number | null) => Math.min(slot.durationSeconds, Math.max(0, coverage ?? (past ? slot.durationSeconds : 0)));
    slot.actualCoverageSeconds = reportedCoverage === null ? null : coveredSeconds(reportedCoverage);
    if (hasActual) {
      slot.solarActualKw = energyPower(getNumber(series, 'solar_actual_kwh', index), coveredSeconds(solarCoverage));
      slot.homeActualKw = energyPower(getNumber(series, 'consumption_actual_kwh', index), coveredSeconds(homeCoverage));
      slot.socActual = socValue(getNumber(operations, 'actual_soc_pct', index));
      // Mixed SOC is safe only on a strictly past cell; current may include a projection.
      if (slot.socActual === null && past) slot.socActual = socValue(getNumber(operations, 'soc_pct', index));
      slot.actionActual = mask(getNumber(operations, 'actual_action_mask', index));
      const actualEnergy = netEnergy(getNumber(operations, 'actual_charge_to_battery_kwh', index), getNumber(operations, 'actual_discharge_from_battery_kwh', index));
      const coverage = coveredSeconds(reportedCoverage);
      slot.batteryActualKw = actualEnergy !== null && coverage > 0 ? actualEnergy * 3600 / coverage : null;
      const observed = record(list(operations.observed_seconds_by_action_by_interval)[index]);
      const explicitHold = number(observed.hold);
      // delay_until is a mixed actual/planned field. Historical cells and a
      // currently observed delay context can use it without inventing a hold
      // from a forecast that has not happened yet.
      const actualDelay = (getNumber(operations, 'actual_context_mask', index) ?? 0) & 2;
      slot.holdActual = explicitHold !== null ? explicitHold > 0 : delayHold(slot.actionActual, delay,
        actualDelay ? getText(operations, 'delay_until', index) : null, Date.parse(slot.start ?? ''), current);
    }
    if (!past && !result.stale) {
      const remaining = slot.repeated && wall.occurrences.length > 1 ? wall.occurrences.reduce((sum, start) =>
        sum + Math.max(0, Math.min(QUARTER_SECONDS, (start + QUARTER_SECONDS * 1000 - referenceTime) / 1000)), 0) :
        slot.durationSeconds * (current ? 1 - result.currentProgress : 1);
      slot.solarForecastKw = energyPower(getNumber(series, 'solar_forecast_kwh', index), remaining);
      slot.homeForecastKw = energyPower(getNumber(series, 'consumption_forecast_kwh', index), remaining);
      slot.socForecast = socValue(getNumber(operations, 'planned_soc_pct', index) ?? getNumber(operations, 'soc_end_pct', index));
      if (slot.socForecast === null && !current) slot.socForecast = socValue(getNumber(operations, 'soc_pct', index));
      slot.actionForecast = mask(getNumber(operations, 'planned_action_mask', index));
      const forecastEnergy = netEnergy(getNumber(operations, 'planned_charge_to_battery_kwh', index), getNumber(operations, 'planned_discharge_from_battery_kwh', index));
      slot.batteryForecastKw = forecastEnergy !== null && remaining > 0 ? forecastEnergy * 3600 / remaining : null;
      const plannedDelayContext = (getNumber(operations, 'planned_context_mask', index) ?? 0) & 2;
      const plannedDelay = getText(operations, 'planned_delay_until', index) ??
        (plannedDelayContext ? getText(operations, 'delay_until', index) : null);
      slot.holdForecast = delayHold(slot.actionForecast, delay, plannedDelay,
        Math.max(Date.parse(slot.start ?? ''), referenceTime), current);
    }
  }
  if (result.slots.some(slot => slot.repeated)) result.warnings.push('Repeated daylight-saving quarters include both occurrences.');
  if (result.slots.some(slot => slot.skipped)) result.warnings.push('Skipped daylight-saving quarters are shown as gaps.');
  if (showExtension && !result.stale) appendExtension(result, data);
  return result;
}

function appendExtension(result: TimelineModel, data: Record<string, unknown>): void {
  const horizon = record(data.extended_horizon);
  const extension = list(data.extended_projection).slice(0, 48).map(record);
  const slots = new Map<number, TimelineSlot>();
  for (const item of extension) {
    const rawIndex = number(item.extension_index) ?? number(item.index);
    const index = rawIndex !== null && rawIndex >= 96 ? rawIndex - 96 : rawIndex;
    if (index === null || !Number.isInteger(index) || index < 0 || index >= 48) continue;
    const start = text(item.start), end = text(item.end);
    if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) continue;
    const duration = getNumber(horizon, 'duration_s', index) ?? (Date.parse(end) - Date.parse(start)) / 1000;
    if (duration < 0) continue;
    const slot = blankSlot(96 + index, duration);
    slot.start = start; slot.end = end;
    slot.repeated = flag(horizon, 'dst_repeated', index);
    slot.skipped = flag(horizon, 'dst_skipped', index) || duration === 0;
    if (slot.skipped) slot.durationSeconds = 0;
    else {
      slot.solarForecastKw = energyPower(number(item.solar_kwh), duration);
      slot.homeForecastKw = energyPower(number(item.consumption_kwh), duration);
      slot.socForecast = socValue(number(item.soc_end_pct));
      slot.actionForecast = mask(number(item.planned_action_mask) ?? number(item.action_mask));
      const solarCharge = number(item.solar_to_battery_kwh), gridCharge = number(item.grid_to_battery_kwh);
      const charging = number(item.charge_to_battery_kwh) ?? (solarCharge === null && gridCharge === null ? null : (solarCharge ?? 0) + (gridCharge ?? 0));
      const energy = netEnergy(charging, number(item.discharge_from_battery_kwh) ?? number(item.battery_to_home_kwh));
      slot.batteryForecastKw = energy !== null && duration > 0 ? energy * 3600 / duration : null;
      slot.holdForecast = delayHold(slot.actionForecast, record(data.delay), item.delay_until,
        Date.parse(start), false, item.delay_active === true);
    }
    slots.set(index, slot);
  }
  if (!slots.size) return;
  // Keep holes in the sparse extension; never compress their wall-clock positions.
  for (let index = 0; index <= Math.max(...slots.keys()); index++) result.slots.push(slots.get(index) ?? blankSlot(96 + index));
}
