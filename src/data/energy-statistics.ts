import type { HomeAssistant } from '../types';

export interface EnergySource {
  type: string; stat_energy_from?: string | null; stat_energy_to?: string | null;
  flow_from?: {stat_energy_from: string}[]; flow_to?: {stat_energy_to: string}[];
}
export interface Statistic { start: number; end: number; change: number | null; }
export interface EnergyReadings {
  home: number; solar: number; gridImport: number; gridExport: number;
  gridToHome: number; solarToGrid: number; start: number; end: number; missing: number;
}
export function localDay(now: number, zone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** Find local midnight by day boundary, including 23/25-hour days and non-hour offsets. */
export function dayStart(now: number, zone: string): number {
  const day = localDay(now, zone);
  let low = now - 30 * 3600000, high = now;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDay(middle, zone) === day) high = middle;
    else low = middle;
  }
  return high;
}
export function energyIds(sources: EnergySource[]) {
  const groups = {gridImport: new Set<string>(), gridExport: new Set<string>(), solar: new Set<string>(), charge: new Set<string>(), discharge: new Set<string>()};
  for (const s of sources) {
    if (s.type === 'grid') {
      if (s.stat_energy_from) groups.gridImport.add(s.stat_energy_from);
      if (s.stat_energy_to) groups.gridExport.add(s.stat_energy_to);
      for (const f of s.flow_from ?? []) groups.gridImport.add(f.stat_energy_from);
      for (const f of s.flow_to ?? []) groups.gridExport.add(f.stat_energy_to);
    } else if (s.type === 'solar' && s.stat_energy_from) groups.solar.add(s.stat_energy_from);
    else if (s.type === 'battery') {
      if (!s.stat_energy_from || !s.stat_energy_to) throw new Error('Configure both battery charging and discharging statistics in Energy settings.');
      groups.discharge.add(s.stat_energy_from); groups.charge.add(s.stat_energy_to);
    }
  }
  if (!groups.gridImport.size || !groups.solar.size) throw new Error('Configure grid import and solar production in Energy settings.');
  const ids = Object.values(groups).flatMap(g => [...g]);
  if (new Set(ids).size !== ids.length) throw new Error('An Energy statistic is assigned to conflicting flow directions.');
  return groups;
}
/** Adapted from Home Assistant frontend (Apache-2.0); see THIRD_PARTY_NOTICES.txt.
 * Modified for validated kWh inputs and the card's three derived metrics.
 * Apply HA Energy's allocation order to each recorded interval, not to daily totals.
 * See home-assistant/frontend src/data/energy.ts computeConsumptionSingle.
 * Source attribution is a calculation; battery discharge is not proof of solar origin.
 */
export function allocate(imported: number, exported: number, solar: number, charge: number, discharge: number) {
  const home = imported + solar + discharge - exported - charge;
  let remaining = Math.max(home, 0);
  const forcedGridCharge = Math.max(0, Math.min(charge, imported - remaining));
  imported -= forcedGridCharge; charge -= forcedGridCharge;
  const solarCharge = Math.min(solar, charge);
  solar -= solarCharge; charge -= solarCharge;
  const solarToGrid = Math.min(solar, exported);
  solar -= solarToGrid; exported -= solarToGrid;
  discharge -= Math.min(discharge, exported);
  imported -= Math.min(imported, charge);
  remaining -= Math.min(remaining, solar);
  remaining -= Math.min(remaining, discharge);
  return {home, gridToHome: Math.min(remaining, imported), solarToGrid};
}
export function calculateEnergy(sources: EnergySource[], stats: Record<string, Statistic[]>, start: number, now: number): EnergyReadings {
  const groups = energyIds(sources);
  const ids = Object.values(groups).flatMap(g => [...g]);
  if (ids.some(id => !Array.isArray(stats[id]) || !stats[id].length)) throw new Error('Waiting for recorded statistics for every configured Energy source.');
  const indexed = Object.fromEntries(ids.map(id => [id, new Map(stats[id].map(row => [row.start, row]))]));
  const times = [...new Set(ids.flatMap(id => stats[id].map(row => row.start)))].sort((a, b) => a - b);
  const total: EnergyReadings = {home: 0, solar: 0, gridImport: 0, gridExport: 0, gridToHome: 0, solarToGrid: 0, start, end: start, missing: 0};
  let count = 0;
  let previousEnd = start;
  for (const t of times) {
    if (t < start || t >= now) continue;
    if (t > previousEnd) total.missing += Math.ceil((t - previousEnd) / 3600000);
    previousEnd = t + 3600000;
    const rows = ids.map(id => indexed[id].get(t));
    if (rows.some(row => !row || row.change === null || !Number.isFinite(row.change) || row.change < -0.000001 || !Number.isFinite(row.end)) ||
      new Set(rows.map(r => r?.end)).size !== 1) { total.missing++; continue; }
    const sum = (key: keyof typeof groups) => [...groups[key]].reduce((v, id) => v + Math.max(0, indexed[id].get(t)!.change!), 0);
    const gridImport = sum('gridImport'), gridExport = sum('gridExport'), solar = sum('solar');
    const flow = allocate(gridImport, gridExport, solar, sum('charge'), sum('discharge'));
    if (flow.home < -0.001) { total.missing++; continue; }
    total.home += Math.max(0, flow.home); total.gridToHome += flow.gridToHome; total.solarToGrid += flow.solarToGrid;
    total.gridImport += gridImport; total.gridExport += gridExport; total.solar += solar;
    total.end = Math.min(now, rows[0]!.end); count++;
  }
  if (!count) throw new Error('No matching Energy statistics are available for today yet.');
  return total;
}
export async function loadEnergy(hass: HomeAssistant, now = Date.now()): Promise<EnergyReadings> {
  if (!hass.callWS) throw new Error('Energy statistics connection is unavailable.');
  const prefs = await hass.callWS<{energy_sources: EnergySource[]}>({type: 'energy/get_prefs'});
  const sources = prefs.energy_sources ?? [];
  const ids = Object.values(energyIds(sources)).flatMap(g => [...g]);
  const start = dayStart(now, hass.config?.time_zone ?? 'UTC');
  const stats = await hass.callWS<Record<string, Statistic[]>>({type: 'recorder/statistics_during_period',
    start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(),
    statistic_ids: ids, period: 'hour', types: ['change'], units: {energy: 'kWh'}});
  return calculateEnergy(sources, stats, start, now);
}
