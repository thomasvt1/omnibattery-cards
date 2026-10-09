import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'examples');
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0, open: false },
});
let browser;

try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Freeze Date, but leave timers and rendering running normally.
  await page.clock.setFixedTime(new Date('2026-06-15T12:30:00Z'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => Boolean(window.demo && window.customCards?.length));

  // Read the actual card registry so new card types cannot silently be skipped.
  const types = await page.evaluate(() => window.customCards.map(card => card.type));
  for (const type of types) {
    await expect(page.locator(type), `${type} must be present in the demo`).toHaveCount(1);
    await expect(page.locator(type).getByRole('heading', { level: 2 })).toBeVisible();
  }
  await expect(page.locator('omnibattery-battery-card').getByRole('heading', { name: 'Battery 1' })).toBeVisible();
  await expect(page.locator('omnibattery-system-battery-card').getByRole('meter')).toHaveCount(4);
  await expect(page.locator('omnibattery-plan-card').getByRole('slider')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await mkdir(output, { recursive: true });

  async function capture(locator, filename) {
    await page.evaluate(async () => {
      await Promise.all([...document.querySelector('.card-grid').children].map(card => card.updateComplete));
      await document.fonts.ready;
    });
    await expect(page.locator('.notice.error')).toHaveCount(0);
    await locator.screenshot({ path: resolve(output, filename), animations: 'disabled' });
    console.log(`examples/${filename}`);
  }

  for (const [name, theme, width] of [['desktop', 'light', 1440], ['mobile', 'dark', 390]]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(theme => window.demo.setTheme(theme), theme);
    await capture(page.locator('.card-grid'), `${name}-${theme}.png`);
  }

  // Isolate one card at a time without demo controls or neighboring cards.
  await page.addStyleTag({ content: '.demo-header,.system-demo-controls,footer{display:none} .card-grid{display:block} .card-grid>*{display:none!important} .card-grid>[data-example]{display:block!important;width:100%}' });
  for (const type of types) {
    const name = type.replace(/^omnibattery-/, '').replace(/-card$/, '');
    const layouts = name === 'system-battery' ? ['columns', 'stacked', 'compact'] : [undefined];
    await page.setViewportSize({ width: name === 'plan' ? 1440 : 390, height: 1100 });
    await page.evaluate(type => {
      document.querySelector('[data-example]')?.removeAttribute('data-example');
      document.querySelector(type).setAttribute('data-example', '');
    }, type);
    for (const layout of layouts) {
      if (layout) await page.evaluate(layout => window.demo.setConfig('system-battery', { layout }), layout);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.demo.setTheme(theme), theme);
        await capture(page.locator(type), `${name}${layout ? `-${layout}` : ''}-${theme}.png`);
      }
    }
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
} finally {
  try { await browser?.close(); }
  finally { await server.close(); }
}
