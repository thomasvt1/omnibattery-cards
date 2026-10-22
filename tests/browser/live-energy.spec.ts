import {readFileSync} from 'node:fs';
import {expect, test} from '@playwright/test';
import type {HomeAssistant} from '../../src/types';

test('private MCP Energy capture renders without helper entities', async ({page}) => {
  test.skip(!process.env.ENERGY_LIVE_FIXTURE, 'No private MCP capture supplied');
  const fixture = JSON.parse(readFileSync(process.env.ENERGY_LIVE_FIXTURE!, 'utf8'));
  await page.clock.install({time: new Date(fixture.now)});
  await page.goto('/');
  const card = page.locator('omnibattery-solar-independence-card');
  await card.evaluate((el, fixture) => {
    const c = el as HTMLElement & {hass: HomeAssistant};
    c.hass = {states: {}, config: {time_zone: 'Europe/Amsterdam'}, locale: {language: 'en'},
      callWS: async <T,>(message: Record<string, unknown>): Promise<T> => {
        if (message.type === 'energy/get_prefs') return {energy_sources: fixture.sources} as T;
        if (message.type === 'recorder/statistics_during_period') return fixture.statistics as T;
        if (String(message.type).startsWith('config/')) return [] as T;
        throw new Error('Unexpected request');
      }};
  }, fixture);
  const sum = (id: string) => fixture.statistics[id].reduce((a: number, row: {change: number}) => a + row.change, 0);
  const solar = fixture.sources.filter((s: {type: string}) => s.type === 'solar')
    .reduce((a: number, s: {stat_energy_from: string}) => a + sum(s.stat_energy_from), 0);
  await expect(card.locator('.hero')).not.toHaveText('—');
  await expect(card.locator('.row').filter({hasText: 'Solar generated'})).toContainText(`${solar.toFixed(1)} kWh`);
  await expect(card.getByRole('status')).not.toContainText('incomplete');
  await card.screenshot({path: '.local/verification/energy-statistics-card.png'});
});
