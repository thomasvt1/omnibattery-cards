import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { allocate, calculateEnergy, dayStart, energyIds, loadEnergy, type EnergySource, type Statistic } from '../../src/data/energy-statistics';
const sources: EnergySource[] = [
  {type: 'grid', stat_energy_from: 'import1', stat_energy_to: 'export'},
  {type: 'grid', stat_energy_from: 'import2'},
  {type: 'solar', stat_energy_from: 'roof'}, {type: 'solar', stat_energy_from: 'shed'},
  {type: 'battery', stat_energy_from: 'discharge', stat_energy_to: 'charge'},
];
const start = Date.parse('2026-10-21T22:00:00Z');
function statistics(): Record<string, Statistic[]> {
  return Object.fromEntries(Object.entries({import1: 3, import2: 0, export: 0, roof: 0, shed: 0, discharge: 0, charge: 2})
    .map(([id, change]) => [id, [{start, end: start + 3600000, change}]]));
}
it('loads both tariffs and solar meters using reset-aware kWh changes from local midnight', async () => {
  const callWS = vi.fn().mockResolvedValueOnce({energy_sources: sources}).mockResolvedValueOnce(statistics());
  const data = await loadEnergy({states: {}, callWS, config: {time_zone: 'Europe/Amsterdam'}}, start + 3600000);
  expect(data.home).toBe(1); expect(data.gridToHome).toBe(1);
  expect(callWS.mock.calls[1][0]).toMatchObject({start_time: '2026-10-21T22:00:00.000Z', period: 'hour', types: ['change'], units: {energy: 'kWh'}});
  expect(callWS.mock.calls[1][0].statistic_ids).toHaveLength(7);
});
it('uses HA allocation per interval, accounting for grid charge and battery export', () => {
  expect(allocate(3, 0, 0, 2, 0)).toEqual({home: 1, gridToHome: 1, solarToGrid: 0});
  expect(allocate(0, 1, 0, 0, 2)).toEqual({home: 1, gridToHome: 0, solarToGrid: 0});
  expect(allocate(1, 0, 2, 2, 0)).toEqual({home: 1, gridToHome: 1, solarToGrid: 0});
  const stats = statistics();
  for (const [id, rows] of Object.entries(stats)) rows.push({start: start + 3600000, end: start + 7200000, change: id === 'discharge' ? 2 : id === 'export' ? 1 : 0});
  const data = calculateEnergy(sources, stats, start, start + 7200000);
  expect(data.home).toBe(2); expect(data.gridToHome).toBe(1); expect(data.solarToGrid).toBe(0);
});
it('does not treat absent statistics as known zero', () => {
  const stats = statistics(); delete stats.shed;
  expect(() => calculateEnergy(sources, stats, start, start + 3600000)).toThrow(/every configured/);
  expect(() => calculateEnergy(sources, {...statistics(), shed: [{start, end: start + 3600000, change: null}]}, start, start + 3600000)).toThrow(/No matching/);
});
it('deduplicates tariff references and supports legacy Energy grid preferences', () => {
  expect([...energyIds([...sources, sources[0]]).gridImport]).toEqual(['import1', 'import2']);
  expect([...energyIds([{type: 'grid', flow_from: [{stat_energy_from: 'old'}]}, sources[2]]).gridImport]).toEqual(['old']);
});
it('uses HA timezone midnight across DST and fractional offsets', () => {
  expect(new Date(dayStart(Date.parse('2026-10-25T23:00:00Z') - 1, 'Europe/Amsterdam')).toISOString()).toBe('2026-10-24T22:00:00.000Z');
  expect(new Date(dayStart(Date.parse('2026-03-29T20:00:00Z'), 'Europe/Amsterdam')).toISOString()).toBe('2026-03-28T23:00:00.000Z');
  expect(new Date(dayStart(Date.parse('2026-10-22T12:00:00Z'), 'Asia/Kathmandu')).toISOString()).toBe('2026-10-21T18:15:00.000Z');
});
describe.skipIf(!process.env.ENERGY_LIVE_FIXTURE)('private MCP replay', () => {
  it('renders actual configured meter statistics without helpers', () => {
    const fixture = JSON.parse(readFileSync(process.env.ENERGY_LIVE_FIXTURE!, 'utf8'));
    const now = Date.parse(fixture.now);
    const result = calculateEnergy(fixture.sources, fixture.statistics, dayStart(now, 'Europe/Amsterdam'), now);
    expect(result.missing).toBe(0);
    expect(result.home).toBeGreaterThan(40);
    expect(result.solar).toBeGreaterThan(7);
    expect(result.solar).toBeLessThan(9);
    expect(result.gridToHome).toBeLessThan(result.gridImport);
    console.info('Private Energy statistics replay:', result);
  });
});
