import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { HomeAssistant } from '../../src/types';
import type { DemoDiagnostics } from '../../src/demo/fixtures';

const planType = 'custom:omnibattery-plan-card' as const;
const overviewType = 'custom:omnibattery-overview-card' as const;
const batteryType = 'custom:omnibattery-battery-card' as const;
const statusType = 'custom:omnibattery-status-card' as const;
type CardElement = HTMLElement & { hass: HomeAssistant & { __demoDiagnostics: DemoDiagnostics } };

async function openDemo(page: Page) {
  await page.goto('/');
  await expect(page.locator('omnibattery-plan-card').getByRole('slider')).toBeVisible();
  await expect(page.locator('omnibattery-battery-card').getByRole('heading', { name: 'Battery 1' })).toBeVisible();
}

test('native Home Assistant card styles do not add a second header inset', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(() => {
    // Home Assistant 2026.10 styles this slotted class inside ha-card itself.
    // Model the native host so standalone demo tests catch integration collisions.
    customElements.define('ha-card', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({mode:'open'}).innerHTML = '<style>:host{display:block}:host ::slotted(.card-header){padding:20px 16px 24px;margin-block:0;display:block;font-size:24px}</style><slot></slot>';
      }
    });
  });
  for (const type of ['plan', 'overview', 'battery', 'status']) {
    const inset = await page.locator(`omnibattery-${type}-card`).getByRole('heading', {level:2}).evaluate(heading => {
      const header = heading.parentElement!;
      return { padding: getComputedStyle(header).padding, display: getComputedStyle(header).display };
    });
    expect(inset).toEqual({padding:'0px',display:'flex'});
  }
});

test('hero reproduction captures the first viewport at 1586 by 992', async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await openDemo(page);
  await page.evaluate(() => { window.demo.setTheme('light'); window.scrollTo(0, 0); });
  for (const name of ['plan', 'overview', 'battery', 'status']) {
    await expect(page.locator(`omnibattery-${name}-card`).getByRole('heading', { level: 2 })).toBeVisible();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await mkdir('.impeccable/review', { recursive: true });
  await page.screenshot({ path: '.impeccable/review/hero-repro.png', fullPage: false });
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'tablet', width: 820, height: 1100 }, { name: 'phone', width: 390, height: 844 }]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${viewport.name} ${theme}: all four cards fit and render`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const failures: string[] = [];
      page.on('pageerror', error => failures.push(error.message));
      await openDemo(page);
      await page.evaluate(theme => window.demo.setTheme(theme), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('omnibattery-overview-card').getByRole('heading', { name: 'Overview' })).toBeVisible();
      await expect(page.locator('omnibattery-status-card').getByRole('heading', { name: 'Status', exact: true })).toBeVisible();
      await expect(page.locator('omnibattery-status-card').getByText('Batteries connected', { exact: true })).toBeVisible();
      await expect(page.locator('omnibattery-plan-card').getByText('Measured', { exact: true })).toBeVisible();
      await expect(page.locator('omnibattery-plan-card').getByText('Projected', { exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cards: [...document.querySelectorAll<HTMLElement>('omnibattery-plan-card, omnibattery-overview-card, omnibattery-battery-card, omnibattery-status-card')]
          .map(card => ({ name: card.tagName, overflow: card.scrollWidth - card.clientWidth })),
      }));
      expect(overflow.document).toBeLessThanOrEqual(1);
      expect(overflow.cards.filter(card => card.overflow > 1)).toEqual([]);
      await mkdir('.impeccable/review', { recursive: true });
      await page.screenshot({ path: `.impeccable/review/${viewport.name}-${theme}.png`, fullPage: true });
      for (const type of [planType, overviewType, batteryType, statusType]) {
        await page.evaluate(type => window.demo.showEditor(type), type);
        const editor = page.locator('omnibattery-card-editor');
        await expect(editor.getByLabel('Title', { exact: true })).toBeVisible();
        await editor.getByText('Entity overrides', { exact: true }).click();
        const editorOverflow = await editor.evaluate(element => ({
          host: element.scrollWidth - element.clientWidth,
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(editorOverflow.host).toBeLessThanOrEqual(1);
        expect(editorOverflow.document).toBeLessThanOrEqual(1);
      }
      expect(failures).toEqual([]);
    });
  }
}

test('timeline keyboard inspection survives live readings and range changes', async ({ page }) => {
  await openDemo(page);
  const plan = page.locator('omnibattery-plan-card');
  const chart = plan.getByRole('slider');
  await chart.focus();
  await chart.press('Home');
  await expect(chart).toHaveAttribute('aria-valuenow', '0');
  await chart.press('ArrowRight');
  await expect(chart).toHaveAttribute('aria-valuenow', '1');
  await expect(chart).toHaveAttribute('aria-valuetext', /00:15/);
  await page.evaluate(() => window.demo.setScenario('charging'));
  await expect(chart).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('omnibattery-status-card').getByText('Charging from the grid', { exact: true })).toBeVisible();
  await plan.getByRole('button', { name: '+ Tomorrow', exact: true }).click();
  await expect(chart).toHaveAttribute('aria-valuemax', '143');
  await chart.focus();
  await chart.press('End');
  await expect(chart).toHaveAttribute('aria-valuenow', '143');
  await chart.press('ArrowRight');
  await expect(chart).toHaveAttribute('aria-valuenow', '143');
  await plan.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(chart).toHaveAttribute('aria-valuemax', '95');
  await chart.focus();
  await chart.press('Home');
  await chart.press('ArrowLeft');
  await expect(chart).toHaveAttribute('aria-valuenow', '0');
});

test('timeline supports touch inspection', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  const chart = page.locator('omnibattery-plan-card').getByRole('slider');
  await expect(chart).toBeVisible();
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await chart.scrollIntoViewIfNeeded();
  const target = await chart.boundingBox();
  await page.touchscreen.tap(target!.x + target!.width * 0.35, target!.y + 60);
  await expect(chart).toHaveAttribute('aria-valuenow', /\d+/);
  const selected = Number(await chart.getAttribute('aria-valuenow'));
  expect(selected).toBeGreaterThan(10);
  expect(selected).toBeLessThan(60);
  await context.close();
});

test('sparse extension ends at its real horizon without overflowing chart ticks', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(type => {
    const card = document.querySelector('omnibattery-plan-card') as CardElement;
    const timeline = card.hass.states['sensor.demo_timeline'];
    const projection = timeline.attributes.extended_projection as { extension_index: number }[];
    card.hass = { ...card.hass, states: { ...card.hass.states,
      [timeline.entity_id]: { ...timeline, attributes: { ...timeline.attributes,
        extended_projection: projection.filter(slot => [0, 5, 12].includes(slot.extension_index)) } },
    } };
    window.demo.setConfig(type, { show_extension: true });
  }, planType);
  const chart = page.locator('omnibattery-plan-card').getByRole('slider');
  await expect(chart).toHaveAttribute('aria-valuemax', '108');
  await chart.focus();
  await chart.press('End');
  await expect(chart).toHaveAttribute('aria-valuenow', '108');
  await expect(chart).toHaveAttribute('aria-valuetext', /^03:00 \+1,/);
  const ticks = await chart.locator('svg').evaluate(svg => {
    const width = (svg as SVGSVGElement).viewBox.baseVal.width;
    return [...svg.querySelectorAll<SVGTextElement>('text')]
      .filter(text => /^\d{2}:\d{2}( \+1)?$/.test(text.textContent || ''))
      .map(text => ({ label: text.textContent, x: Number(text.getAttribute('x')), right: text.getBBox().x + text.getBBox().width, left: text.getBBox().x, width }));
  });
  expect(ticks.at(-1)?.label).toBe('03:15 +1');
  expect(ticks.length).toBeGreaterThanOrEqual(3);
  for (const tick of ticks) {
    expect(tick.x).toBeGreaterThanOrEqual(0);
    expect(tick.x).toBeLessThanOrEqual(tick.width);
    expect(tick.left).toBeGreaterThanOrEqual(0);
    expect(tick.right).toBeLessThanOrEqual(tick.width);
  }
});

test('export-only prices and both tariffs stay distinct in the inspector', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(type => {
    const card = document.querySelector('omnibattery-plan-card') as CardElement;
    const source = card.hass.states['sensor.demo_import_price'];
    const priced = (points: unknown) => (points as Record<string, unknown>[]).map((point, index) => ({ ...point, value: index % 2 ? -0.015 : 0.067 }));
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'sensor.demo_export_price': { ...source, entity_id: 'sensor.demo_export_price', attributes: { ...source.attributes,
        raw_today: priced(source.attributes.raw_today), raw_tomorrow: priced(source.attributes.raw_tomorrow) } },
    } };
    window.demo.setConfig(type, { import_price_entity: undefined, export_price_entity: 'sensor.demo_export_price' });
  }, planType);
  const plan = page.locator('omnibattery-plan-card');
  const chart = plan.getByRole('slider');
  const inspector = plan.locator('.inspector');
  await chart.focus();
  await chart.press('Home');
  await expect(inspector.getByText('Export 0.067 EUR/kWh', { exact: true })).toBeVisible();
  await expect(inspector.getByText(/^Import /)).toHaveCount(0);
  await expect(plan.locator('.legend').getByText('Export price', { exact: true })).toBeVisible();
  await expect(plan.locator('.legend').getByText('Import price', { exact: true })).toHaveCount(0);
  const path = await chart.locator('path[stroke="var(--ob-grid)"]').getAttribute('d');
  const points = [...(path || '').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  expect(points.length).toBeGreaterThan(100);
  expect(points.some((point, index) => index > 0 && point[1] !== points[index - 1][1])).toBe(true);
  for (let index = 1; index < points.length; index++) {
    expect(points[index][0] === points[index - 1][0] || points[index][1] === points[index - 1][1]).toBe(true);
  }
  await page.evaluate(type => window.demo.setConfig(type, { import_price_entity: 'sensor.demo_import_price' }), planType);
  await expect(inspector.getByText('Import 0.19 EUR/kWh', { exact: true })).toBeVisible();
  await expect(inspector.getByText('Export 0.067 EUR/kWh', { exact: true })).toBeVisible();
  await expect(plan.locator('.legend').getByText('Import price', { exact: true })).toBeVisible();
});

test('each scenario reports availability honestly', async ({ page }) => {
  await openDemo(page);
  const status = page.locator('omnibattery-status-card');
  const battery = page.locator('omnibattery-battery-card');
  await page.evaluate(() => window.demo.setScenario('discharging'));
  await expect(status.getByText('Powering the home from batteries', { exact: true })).toBeVisible();
  await expect(battery.getByText('Cell discharging', { exact: true })).toBeVisible();
  await page.evaluate(() => window.demo.setScenario('offline'));
  await expect(status.getByText('1 battery needs attention', { exact: true })).toBeVisible();
  await page.evaluate(type => window.demo.setConfig(type, { battery: 'demo-battery-3' }), batteryType);
  await expect(battery.getByText('Battery unavailable. Live readings may be missing.', { exact: true })).toBeVisible();
  await page.evaluate(type => window.demo.setConfig(type, { battery: 'demo-battery-1' }), batteryType);
  await page.evaluate(() => window.demo.setScenario('partial'));
  await expect(battery.getByText('Temperature', { exact: true })).toHaveCount(0);
  await expect(battery.getByText('Battery health', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.demo.setScenario('stale'));
  await expect(status.getByText('Forecast needs an update', { exact: true })).toBeVisible();
  await expect(page.locator('omnibattery-plan-card').getByRole('slider')).toBeVisible();
  await page.evaluate(() => window.demo.setScenario('missing'));
  await expect(page.locator('omnibattery-plan-card').getByText('Timeline unavailable', { exact: true })).toBeVisible();
  await expect(battery.getByText('The selected battery is unavailable. Choose a battery in the card configuration.', { exact: true })).toBeVisible();
});

test('plan editor emits complete changes for title, tariff and timeline options', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(type => {
    window.demo.showEditor(type);
    document.addEventListener('config-changed', event => {
      document.body.dataset.configEvents = String(Number(document.body.dataset.configEvents || 0) + 1);
      document.body.dataset.configComposed = String(event.composed);
    });
  }, planType);
  const editor = page.locator('omnibattery-card-editor');
  await editor.getByLabel('Title', { exact: true }).fill('My energy plan');
  await editor.getByLabel('Title', { exact: true }).press('Tab');
  await expect(page.locator('omnibattery-plan-card').getByRole('heading', { name: 'My energy plan' })).toBeVisible();
  await editor.getByLabel('Export price entity', { exact: true }).fill('sensor.demo_import_price');
  await editor.getByLabel('Export price entity', { exact: true }).press('Tab');
  await editor.getByLabel('Show next-day timeline when available').check();
  await editor.getByLabel('Show next-day timeline when available').uncheck();
  expect(await page.evaluate(type => window.demo.getConfig(type), planType)).toMatchObject({ title: 'My energy plan', export_price_entity: 'sensor.demo_import_price', show_extension: false });
  await editor.getByLabel('Show next-day timeline when available').check();
  await expect(page.locator('omnibattery-plan-card').getByRole('slider')).toHaveAttribute('aria-valuemax', '143');
  await editor.getByLabel('Import price entity', { exact: true }).fill('');
  await editor.getByLabel('Import price entity', { exact: true }).press('Tab');
  expect(await page.evaluate(type => window.demo.getConfig(type)?.import_price_entity, planType)).toBeUndefined();
  await expect(page.locator('body')).toHaveAttribute('data-config-composed', 'true');
  expect(Number(await page.locator('body').getAttribute('data-config-events'))).toBeGreaterThanOrEqual(5);
});

test('battery and source editors preserve selections and clear overrides', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(type => window.demo.showEditor(type), batteryType);
  let editor = page.locator('omnibattery-card-editor');
  await editor.getByLabel('Omnibattery installation', { exact: true }).selectOption('demo-omnibattery');
  await editor.getByLabel('Battery device', { exact: true }).selectOption('demo-battery-2');
  await expect(page.locator('omnibattery-battery-card').getByRole('heading', { name: 'Battery 2' })).toBeVisible();
  await page.evaluate(type => window.demo.showEditor(type), batteryType);
  editor = page.locator('omnibattery-card-editor');
  await expect(editor.getByLabel('Battery device', { exact: true })).toHaveValue('demo-battery-2');
  await expect(editor.getByLabel('Omnibattery installation', { exact: true })).toHaveValue('demo-omnibattery');
  await page.evaluate(type => window.demo.showEditor(type), overviewType);
  editor = page.locator('omnibattery-card-editor');
  await editor.getByText('Entity overrides', { exact: true }).click();
  await editor.getByLabel('Home consumption', { exact: true }).fill('sensor.demo_solar');
  await editor.getByLabel('Home consumption', { exact: true }).press('Tab');
  await editor.getByLabel('Grid source is positive when exporting', { exact: true }).check();
  expect(await page.evaluate(type => window.demo.getConfig(type), overviewType)).toMatchObject({ entities: { home: 'sensor.demo_solar' }, grid_inverted: true });
  await editor.getByLabel('Home consumption', { exact: true }).fill('');
  await editor.getByLabel('Home consumption', { exact: true }).press('Tab');
  expect(await page.evaluate(type => window.demo.getConfig(type)?.entities?.home, overviewType)).toBeUndefined();
  await page.evaluate(type => window.demo.showEditor(type), statusType);
  await expect(page.locator('omnibattery-card-editor').getByLabel('Title', { exact: true })).toBeVisible();
});

test('entity details stay read-only and registry subscriptions are released', async ({ page }) => {
  await openDemo(page);
  await page.evaluate(() => document.addEventListener('hass-more-info', event => {
    document.body.dataset.moreInfo = (event as CustomEvent<{ entityId: string }>).detail.entityId;
  }));
  await page.locator('omnibattery-overview-card').getByRole('button', { name: /^Solar: .*Show details$/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-more-info', 'sensor.demo_solar');
  await page.evaluate(type => window.demo.showEditor(type), overviewType);
  await expect(page.locator('omnibattery-card-editor').getByLabel('Omnibattery installation')).toBeVisible();
  const before = await page.evaluate(() => (document.querySelector('omnibattery-plan-card') as CardElement).hass.__demoDiagnostics);
  expect(before.services).toEqual([]);
  expect([...new Set(before.requests)].sort()).toEqual(['config/device_registry/list', 'config/entity_registry/list']);
  expect(before.requests).toHaveLength(2);
  expect(before.activeSubscriptions).toBe(2);
  const remaining = await page.evaluate(async () => {
    const diagnostics = (document.querySelector('omnibattery-plan-card') as CardElement).hass.__demoDiagnostics;
    document.querySelector('.card-grid')!.replaceChildren();
    document.querySelector('#editor-mount')!.replaceChildren();
    await new Promise(resolve => setTimeout(resolve, 0));
    return diagnostics.activeSubscriptions;
  });
  expect(remaining).toBe(0);
});
