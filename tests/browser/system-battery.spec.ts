import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { CardConfig, HomeAssistant, RegistryData } from '../../src/types';
import type { DemoDiagnostics } from '../../src/demo/fixtures';

const systemType = 'custom:omnibattery-system-battery-card' as const;
const systemTag = 'omnibattery-system-battery-card';
type Layout = 'columns' | 'stacked' | 'compact';
type CardElement = HTMLElement & {
  hass: HomeAssistant & { __demoDiagnostics: DemoDiagnostics };
  setConfig(config: CardConfig): void;
};
interface FleetOptions {
  count: number;
  layout?: Layout;
  theme?: 'light' | 'dark';
  longNames?: boolean;
  offlineLast?: boolean;
  individualSoc?: number;
}

/** Give each fixture its own real registry response and subscription lifecycle. */
async function mountFleet(page: Page, options: FleetOptions) {
  await page.goto('/');
  await expect(page.locator('omnibattery-overview-card').getByRole('heading', { name: 'Overview' })).toBeVisible();
  const fixture = await page.evaluate(({ options, type, tag }) => {
    const source = document.querySelector('omnibattery-overview-card') as CardElement;
    const original = source.hass;
    const entities = Object.values(original.entities ?? {});
    const devices = Object.values(original.devices ?? {});
    const template = entities.filter(entity => entity.device_id === 'demo-battery-1');
    const templateDevice = devices.find(device => device.id === 'demo-battery-1')!;
    const registry: RegistryData = {
      entities: entities.filter(entity => !entity.device_id?.startsWith('demo-battery-')),
      devices: devices.filter(device => !device.id.startsWith('demo-battery-')),
    };
    const states = structuredClone(original.states);
    const socIds: string[] = [], names: string[] = [];
    for (let index = 1; index <= options.count; index++) {
      const id = `synthetic-battery-${index}`;
      const name = options.longNames
        ? `Battery ${index} · Upstairs utility cupboard beside the photovoltaic inverter · ${'UninterruptedDeviceName'.repeat(3)}`
        : `Battery ${index}`;
      names.push(name);
      registry.devices.push({ ...templateDevice, id, name, name_by_user: name });
      for (const entity of template) {
        const entityId = `sensor.synthetic_battery_${index}_${entity.translation_key}`;
        registry.entities.push({ ...entity, entity_id: entityId, device_id: id, unique_id: `synthetic_pack_${index}_${entity.translation_key}` });
        states[entityId] = { ...structuredClone(original.states[entity.entity_id]), entity_id: entityId };
        if (entity.translation_key === 'battery_soc') {
          socIds.push(entityId);
          states[entityId].state = String(options.individualSoc ?? 70 + index);
        }
        if (options.offlineLast && index === options.count) states[entityId].state = 'unavailable';
      }
    }
    const diagnostics: DemoDiagnostics = { requests: [], services: [], activeSubscriptions: 0 };
    const hass: CardElement['hass'] & { callService: (domain: string, service: string) => void } = {
      ...original, states,
      entities: Object.fromEntries(registry.entities.map(entity => [entity.entity_id, entity])),
      devices: Object.fromEntries(registry.devices.map(device => [device.id, device])),
      __demoDiagnostics: diagnostics,
      callWS: async <T>(message: Record<string, unknown>): Promise<T> => {
        const request = String(message.type);
        diagnostics.requests.push(request);
        if (request.includes('service')) diagnostics.services.push(request);
        if (request === 'config/entity_registry/list') return registry.entities as T;
        if (request === 'config/device_registry/list') return registry.devices as T;
        throw new Error(`Unexpected request: ${request}`);
      },
      callService: (domain, service) => { diagnostics.services.push(`${domain}.${service}`); },
      connection: { subscribeEvents: async () => {
        diagnostics.activeSubscriptions++;
        let active = true;
        return () => { if (active) { active = false; diagnostics.activeSubscriptions--; } };
      } },
    };
    window.demo.setTheme(options.theme ?? 'light');
    const card = document.createElement(tag) as CardElement;
    card.setConfig({ type, ...(options.layout ? { layout: options.layout } : {}) });
    card.hass = hass;
    const mount = document.createElement('main');
    mount.style.cssText = 'width:calc(100% - 24px);max-width:900px;margin:12px auto;padding:0;';
    mount.append(card);
    document.body.replaceChildren(mount);
    return { socIds, names };
  }, { options, type: systemType, tag: systemTag });
  const card = page.locator(systemTag);
  await expect(card.locator('.battery-item')).toHaveCount(options.count);
  return { card, ...fixture };
}

async function expectContained(card: Locator) {
  const dimensions = await card.evaluate(element => {
    const root = element.shadowRoot!;
    const host = element.getBoundingClientRect();
    const selectors = ['ha-card', '.battery-list', '.battery-item', '.system-soc', '.system-meter', '.battery-meter'];
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hostOverflow: element.scrollWidth - element.clientWidth,
      rowOverflows: [...root.querySelectorAll<HTMLElement>('.battery-item')]
        .map(child => child.scrollWidth - child.clientWidth).filter(overflow => overflow > 1),
      outside: selectors.flatMap(selector => [...root.querySelectorAll<HTMLElement>(selector)].filter(child => {
        const rect = child.getBoundingClientRect();
        return rect.width > 0 && (rect.left < host.left - 1 || rect.right > host.right + 1);
      }).map(() => selector)),
    };
  });
  expect(dimensions).toEqual({ documentOverflow: 0, hostOverflow: 0, rowOverflows: [], outside: [] });
}

test('system SOC uses the reported aggregate and stays unknown when that sensor is unavailable', async ({ page }) => {
  const { card } = await mountFleet(page, { count: 3, individualSoc: 1 });
  await expect(card.locator('.system-soc')).toContainText(/76\s*%/);
  await expect(card.locator('.system-meter')).toHaveAttribute('aria-valuenow', '76');
  await expect(card.locator('.battery-meter')).toHaveCount(3);
  for (const meter of await card.locator('.battery-meter').all()) await expect(meter).toHaveAttribute('aria-valuenow', '1');
  await card.evaluate(element => {
    const card = element as CardElement;
    const previous = card.hass;
    card.hass = { ...previous, states: { ...previous.states,
      'sensor.demo_soc': { ...previous.states['sensor.demo_soc'], state: 'unavailable' },
    } };
  });
  await expect(card.locator('.system-soc')).toContainText('—');
  await expect(card.locator('.system-meter[aria-valuenow]')).toHaveCount(0);
  await expect(card.locator('.system-soc')).not.toContainText(/1\s*%|0\s*%/);
  for (const meter of await card.locator('.battery-meter').all()) await expect(meter).toHaveAttribute('aria-valuenow', '1');
});

test('unavailable batteries remain present with an unknown charge level', async ({ page }) => {
  const { card } = await mountFleet(page, { count: 3, offlineLast: true });
  const unavailable = card.locator('.battery-item').nth(2);
  await expect(unavailable).toContainText('Battery 3');
  await expect(unavailable).toContainText(/unavailable/i);
  await expect(unavailable).toContainText('—');
  await expect(unavailable).not.toContainText(/0\s*%/);
  await expect(unavailable.locator('[aria-valuenow]')).toHaveCount(0);
  await expect(card.locator('.system-soc')).toContainText(/76\s*%/);
});

test('a battery discovered beyond the original demo fleet updates when new telemetry arrives', async ({ page }) => {
  const { card, socIds } = await mountFleet(page, { count: 7 });
  const seventh = card.locator('.battery-item').nth(6);
  await expect(seventh.locator('.battery-meter')).toHaveAttribute('aria-valuenow', '77');
  await card.evaluate((element, entityId) => {
    const card = element as CardElement;
    const previous = card.hass;
    card.hass = { ...previous, states: { ...previous.states,
      [entityId]: { ...previous.states[entityId], state: '23' },
    } };
  }, socIds[6]);
  await expect(seventh.locator('.battery-meter')).toHaveAttribute('aria-valuenow', '23');
  await expect(seventh).toContainText(/23\s*%/);
  await expect(card.locator('.system-soc')).toContainText(/76\s*%/);
});

test('visual editor roundtrips all layouts without losing other settings', async ({ page }) => {
  await page.goto('/');
  const card = page.locator(systemTag);
  await expect(card.locator('.battery-item')).toHaveCount(3);
  await expect(card.locator('ha-card')).toHaveAttribute('data-layout', 'columns');
  await page.evaluate(type => {
    window.demo.showEditor(type);
    document.addEventListener('config-changed', event => {
      document.body.dataset.systemConfigComposed = String(event.composed);
    });
  }, systemType);
  const editor = page.locator('omnibattery-card-editor');
  await expect(editor.getByLabel('Layout', { exact: true })).toHaveValue('columns');
  await editor.getByLabel('Title', { exact: true }).fill('Battery fleet');
  await editor.getByLabel('Title', { exact: true }).press('Tab');
  await editor.getByLabel('Omnibattery installation', { exact: true }).selectOption('demo-omnibattery');
  for (const layout of ['stacked', 'compact', 'columns'] as const) {
    await editor.getByLabel('Layout', { exact: true }).selectOption(layout);
    await expect(card.locator('ha-card')).toHaveAttribute('data-layout', layout);
    await expect(card.getByRole('heading', { name: 'Battery fleet', exact: true })).toBeVisible();
    expect(await page.evaluate(type => window.demo.getConfig(type), systemType)).toMatchObject({
      type: systemType, title: 'Battery fleet', integration_id: 'demo-omnibattery', layout,
    });
    await page.evaluate(type => window.demo.showEditor(type), systemType);
    await expect(editor.getByLabel('Layout', { exact: true })).toHaveValue(layout);
    await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('Battery fleet');
  }
  await expect(page.locator('body')).toHaveAttribute('data-system-config-composed', 'true');
});

test('system and battery details work by keyboard without service calls and release subscriptions', async ({ page }) => {
  const { card, socIds } = await mountFleet(page, { count: 3 });
  await page.evaluate(() => {
    document.addEventListener('hass-more-info', event => {
      document.body.dataset.moreInfo = (event as CustomEvent<{ entityId: string }>).detail.entityId;
      document.body.dataset.moreInfoComposed = String(event.composed);
    });
  });
  const system = card.getByRole('button', { name: /^System charge level: .*Show details$/ });
  await system.focus();
  await expect(system).toBeFocused();
  await system.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-more-info', 'sensor.demo_soc');
  const battery = card.getByRole('button', { name: /^Battery 1 charge level: .*Show details$/ });
  await battery.focus();
  await expect(battery).toBeFocused();
  await battery.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-more-info', socIds[0]);
  await expect(page.locator('body')).toHaveAttribute('data-more-info-composed', 'true');
  const before = await card.evaluate(element => (element as CardElement).hass.__demoDiagnostics);
  expect(before.services).toEqual([]);
  expect(before.requests.sort()).toEqual(['config/device_registry/list', 'config/entity_registry/list']);
  expect(before.activeSubscriptions).toBe(2);
  const remaining = await card.evaluate(async element => {
    const diagnostics = (element as CardElement).hass.__demoDiagnostics;
    element.remove();
    await new Promise(resolve => setTimeout(resolve, 0));
    return diagnostics.activeSubscriptions;
  });
  expect(remaining).toBe(0);
});

test('system card visual references use the ordinary three-battery demo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/');
  const card = page.locator(systemTag);
  await expect(card.locator('.battery-item')).toHaveCount(3);
  await mkdir('.impeccable/review', { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    for (const layout of ['columns', 'stacked', 'compact'] as const) {
      await page.evaluate(({ type, theme, layout }) => {
        window.demo.setConfig(type, { layout });
        window.demo.setTheme(theme);
      }, { type: systemType, theme, layout });
      await expect(card.locator('ha-card')).toHaveAttribute('data-layout', layout);
      await expect(card.getByRole('heading', { name: 'System battery', exact: true })).toBeVisible();
      await expect(card.locator('.system-soc')).toContainText(/76\s*%/);
      await expect(card.locator('.battery-meter')).toHaveCount(3);
      await expect(card.getByRole('meter')).toHaveCount(layout === 'compact' ? 3 : 4);
      for (const [index, soc] of [74, 76, 78].entries()) {
        await expect(card.locator('.battery-item').nth(index)).toContainText(`Battery ${index + 1}`);
        await expect(card.locator('.battery-meter').nth(index)).toHaveAttribute('aria-valuenow', String(soc));
      }
      await card.screenshot({ path: `.impeccable/review/system-reference-${layout}-${theme}.png` });
    }
  }
});

for (const count of [1, 2, 3, 4, 7]) {
  test(`system card lays out ${count} batteries with at most three columns`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1100 });
    const { card } = await mountFleet(page, { count });
    await expect(card.locator('ha-card')).toHaveAttribute('data-layout', 'columns');
    const items = await card.locator('.battery-item').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top), left: Math.round(rect.left), width: rect.width };
    }));
    const rows = [...new Set(items.map(item => item.top))];
    expect(rows).toHaveLength(Math.ceil(count / 3));
    for (const top of rows) expect(items.filter(item => item.top === top)).toHaveLength(Math.min(3, count - rows.indexOf(top) * 3));
    expect(items.every(item => item.width > 100)).toBe(true);
    if (count >= 4) {
      expect(items[3].top).toBeGreaterThan(items[0].top);
      expect(items[3].left).toBe(items[0].left);
    }
    if (count === 7) {
      expect(items[6].top).toBeGreaterThan(items[3].top);
      expect(items[6].left).toBe(items[0].left);
    }
    await expectContained(card);
    if (count === 4 || count === 7) {
      await mkdir('.impeccable/review', { recursive: true });
      await card.screenshot({ path: `.impeccable/review/system-wrap-${count}.png` });
    }
  });
}

for (const layout of ['columns', 'stacked', 'compact'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 390, 1200]) {
      test(`system ${layout} ${theme} at ${width}px fits long battery names`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1100 });
        const failures: string[] = [];
        page.on('pageerror', error => failures.push(error.message));
        const { card, names } = await mountFleet(page, { count: 3, layout, theme, longNames: true });
        await expect(card.locator('ha-card')).toHaveAttribute('data-layout', layout);
        for (const name of names) await expect(card.getByText(name, { exact: true })).toBeVisible();
        await expect(card.locator('.system-soc')).toContainText(/76\s*%/);
        await expectContained(card);
        expect(failures).toEqual([]);
        await mkdir('.impeccable/review', { recursive: true });
        await card.screenshot({ path: `.impeccable/review/system-${layout}-${theme}-${width}.png` });
      });
    }
  }
}
