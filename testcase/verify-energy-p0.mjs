import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8815;
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, pathname === '/' ? '/hvac-demo.html' : pathname);
  fs.readFile(file, (error, body) => {
    if (error) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(file); res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' }); res.end(body);
  });
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/pages/energy-rank.html`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#rankRows tr').count(), 10);
  assert.deepEqual(await page.locator('#rankMetric option').allTextContents(), ['能耗', '运行时长'], '排行指标仅保留能耗和运行时长');
  const descending = await page.locator('#rankRows td[data-value]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.value)));
  assert.ok(descending.every((value, index) => index === 0 || descending[index - 1] >= value), '默认排行必须倒序');
  const structureValues = await page.locator('#structureRows td[data-energy]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.energy)));
  const structureTotal = Number(await page.locator('#structureTotal').getAttribute('data-value'));
  assert.equal(Number(structureValues.reduce((sum, value) => sum + value, 0).toFixed(2)), structureTotal);
  const navPromise = page.evaluate(() => new Promise(resolve => window.addEventListener('message', event => event.data && event.data.nav && resolve(event.data), { once: true })));
  await page.locator('#rankRows .energy-link').first().click();
  const nav = await navPromise; assert.equal(nav.nav, 'energy-trend'); assert.match(nav.q, /obj=/);
  await page.goto(`http://127.0.0.1:${port}/pages/energy-rank.html`); await page.waitForLoadState('domcontentloaded');
  await page.locator('#rankMetric').selectOption('runtime'); await page.locator('#queryRank').click();
  const runtimeNavPromise = page.evaluate(() => new Promise(resolve => window.addEventListener('message', event => event.data && event.data.nav && resolve(event.data), { once: true })));
  await page.locator('#rankRows .energy-link').first().click();
  const runtimeNav = await runtimeNavPromise;
  await page.goto(`http://127.0.0.1:${port}/pages/energy-trend.html?${runtimeNav.q}`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#metric').inputValue(), 'runtime', '运行时长排行下钻必须保留运行时长指标');
  assert.equal(Number(await page.locator('#sumTotal').getAttribute('data-value')), await page.evaluate(() => result.summary.runtime), '运行时长趋势汇总必须使用运行时长');
  assert.ok((await page.locator('#sumTotal').textContent()).includes('h'));

  await page.goto(`http://127.0.0.1:${port}/pages/energy-rank.html`); await page.waitForLoadState('domcontentloaded');
  await page.locator('#rankOrder').selectOption('asc'); await page.locator('#queryRank').click();
  const ascending = await page.locator('#rankRows td[data-value]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.value)));
  assert.ok(ascending.every((value, index) => index === 0 || ascending[index - 1] <= value));
  await page.locator('#rankPeriod').selectOption('custom');
  assert.equal(await page.locator('#rankCustomRange').isVisible(), true, '排行自定义时段必须显示日期区间');
  await page.locator('#rankFrom').fill('2026-08-01');
  await page.locator('#rankTo').fill('2026-08-03');
  await page.locator('#queryRank').click();
  assert.equal(await page.evaluate(() => range().from), '2026-08-01');

  await page.goto(`http://127.0.0.1:${port}/pages/energy-rank.html?dimension=tenant&period=year&structure=tenant`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#rankDimension').inputValue(), 'tenant', '排行下钻必须回填排行维度');
  assert.equal(await page.locator('#rankPeriod').inputValue(), 'year', '排行下钻必须回填统计时段');
  assert.equal(await page.locator('[data-structure="tenant"]').getAttribute('class'), 'active', '排行下钻必须回填结构维度');

  await page.goto(`http://127.0.0.1:${port}/pages/energy-load.html?date=2026-08-13`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('.energy-kpi').count(), 4);
  assert.equal(await page.evaluate(() => loadResult.points.length), 96);
  const maxLoad = Number(await page.locator('#maxLoad').getAttribute('data-value'));
  assert.ok(maxLoad > 0 && maxLoad <= 80, `最大负荷应在 0~80 kW，实际 ${maxLoad}`);
  assert.equal(await page.locator('#loadRows tr').count(), 10);
  await page.locator('#showSetTemp').check();
  assert.equal(await page.evaluate(() => document.getElementById('showSetTemp').checked), true);
  assert.deepEqual(errors, []);
  console.log('energy rank and load contract passed');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
