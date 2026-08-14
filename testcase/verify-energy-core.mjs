import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8814;
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, pathname === '/' ? '/hvac-demo.html' : pathname);
  fs.readFile(file, (error, body) => {
    if (error) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
    res.end(body);
  });
});

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.route('https://cdn.jsdelivr.net/**', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/ERR_FAILED/.test(message.text())) errors.push(message.text()); });

  await page.goto(`http://127.0.0.1:${port}/pages/energy-overview.html`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('.energy-kpi').count(), 6, '总览必须有六张 KPI 卡');
  assert.ok((await page.locator('#kpiDaily').textContent()).includes('本月日均能耗'), '总览应以本月日均能耗替代费用指标');
  assert.ok((await page.locator('#kpiDaily').textContent()).includes('kWh'));
  for (const id of ['trendChart', 'structureChart', 'rankList', 'anomalyList']) assert.equal(await page.locator(`#${id}`).count(), 1, `总览缺少 ${id}`);
  assert.equal(await page.locator('#rankList .energy-rank-item').count(), 10, '总览显示 TOP10');
  assert.ok((await page.locator('#kpiToday').textContent()).includes('kWh'));
  assert.ok((await page.locator('#chartFallbacks').textContent()).includes('图表资源未加载'), 'CDN 失败时要显示图表空态');

  const navPromise = page.evaluate(() => new Promise(resolve => window.addEventListener('message', event => event.data && event.data.nav && resolve(event.data), { once: true })));
  await page.locator('[data-nav="energy-trend"]').first().click();
  const nav = await navPromise;
  assert.equal(nav.nav, 'energy-trend');
  assert.match(nav.q, /gran=hour/);

  await page.goto(`http://127.0.0.1:${port}/pages/energy-trend.html?gran=day&from=2026-08-01&to=2026-08-03&obj=project&metric=energy`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#granularity').inputValue(), 'day');
  assert.equal(await page.locator('#dateFrom').inputValue(), '2026-08-01');
  assert.equal(await page.locator('#trendRows tr').count(), 3);
  assert.equal(await page.locator('.energy-summary-item').count(), 6);
  assert.deepEqual(await page.locator('#metric option').allTextContents(), ['能耗', '运行时长'], '趋势指标仅保留能耗和运行时长');
  assert.deepEqual(await page.locator('.tw table thead th').allTextContents(), ['时间', '能耗(kWh)', '环比', '同比', '运行时长(h)'], '趋势明细不得包含费用列');
  assert.deepEqual(await page.locator('#quickRange option').allTextContents(), ['自定义', '今日', '昨日', '本周', '本月', '上月', '本年']);
  await page.locator('#quickRange').selectOption('yesterday');
  assert.equal(await page.locator('#dateFrom').inputValue(), '2026-08-12');
  assert.equal(await page.locator('#dateTo').inputValue(), '2026-08-12');
  await page.locator('#quickRange').selectOption('lastMonth');
  assert.equal(await page.locator('#dateFrom').inputValue(), '2026-07-01');
  assert.equal(await page.locator('#dateTo').inputValue(), '2026-07-31');
  await page.locator('#quickRange').selectOption('custom');
  await page.locator('#dateFrom').fill('2026-08-01');
  await page.locator('#dateTo').fill('2026-08-03');
  const total = Number(await page.locator('#sumTotal').getAttribute('data-value'));
  const rowValues = await page.locator('#trendRows tr td[data-energy]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.energy)));
  assert.equal(total, Number(rowValues.reduce((sum, value) => sum + value, 0).toFixed(2)), '趋势明细合计必须等于汇总');

  await page.goto(`http://127.0.0.1:${port}/pages/energy-trend.html?gran=day&from=2026-08-01&to=2026-08-03&obj=room%3A1%E5%8F%B7%E6%A5%BC%7C3%E5%B1%82%7C301&metric=energy`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.evaluate(() => selectedObj), 'room:1号楼|3层|301', '房间下钻参数必须保留选定房间');

  await page.locator('#granularity').selectOption('hour');
  await page.locator('#queryBtn').click();
  assert.equal(await page.evaluate(() => result.points.length), 24, '按时粒度必须返回 24 点');
  assert.equal(await page.locator('#trendRows tr').count(), 10, '明细表默认按 10 条分页');
  assert.equal(await page.locator('#runtimeHead').isVisible(), false, '按时粒度隐藏运行时长列');

  await page.locator('#granularity').selectOption('month');
  assert.equal(await page.locator('#dateFrom').getAttribute('type'), 'month', '按月粒度必须切换月份控件');
  assert.equal(await page.locator('#overlayTemp').isDisabled(), true, '按月粒度不可叠加室外温度');
  await page.locator('#granularity').selectOption('year');
  assert.equal(await page.locator('#dateFrom').getAttribute('type'), 'number', '按年粒度必须切换年份控件');
  await page.locator('#quickRange').selectOption('month');
  assert.equal(await page.locator('#dateFrom').inputValue(), '2026', '本月快捷项在按年粒度应回填当前年份');
  await page.locator('#granularity').selectOption('month');
  assert.match(await page.locator('#dateFrom').inputValue(), /^\d{4}-\d{2}$/, '从按年切回按月时必须保留有效月份');
  assert.match(await page.locator('#dateTo').inputValue(), /^\d{4}-\d{2}$/, '从按年切回按月时结束月份必须有效');
  await page.locator('#granularity').selectOption('year');
  await page.locator('#granularity').selectOption('day');
  assert.match(await page.locator('#dateFrom').inputValue(), /^\d{4}-\d{2}-\d{2}$/, '从按年切回按日时必须保留有效日期');
  assert.match(await page.locator('#dateTo').inputValue(), /^\d{4}-\d{2}-\d{2}$/, '从按年切回按日时结束日期必须有效');

  await page.locator('#objectType').selectOption('tenant');
  assert.equal(await page.locator('#objectSelect').isVisible(), true);
  assert.equal(await page.locator('#buildingTree').isVisible(), false);
  assert.ok(await page.locator('#objectSelect option').count() >= 2);
  await page.locator('#objectType').selectOption('room');
  await page.locator('#queryBtn').click();
  assert.equal(await page.evaluate(() => selectedObj), 'project', '切回空间树但未选择节点时应查询项目整体，不能残留租户对象');

  await page.locator('#objectType').selectOption('meter');
  assert.equal(await page.locator('#objectSelect').getAttribute('multiple'), '', '电表对象必须支持多选合计');
  await page.locator('#objectSelect').selectOption(['meter:0', 'meter:1']);
  await page.locator('#queryBtn').click();
  assert.equal(await page.evaluate(() => selectedObj), 'meter:0,1');
  await page.locator('#overlayTemp').check();
  assert.equal(await page.evaluate(() => lastChartOption.yAxis.length), 2, '室外温度叠加必须使用右轴');

  await page.goto(`http://127.0.0.1:${port}/pages/energy-trend.html?obj=missing:object&gran=day&from=2026-08-01&to=2026-08-03`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.evaluate(() => selectedObj), 'project', '失效下钻对象必须回退项目整体');
  assert.equal(await page.locator('.msg.warning').count(), 1, '失效下钻对象必须提示用户');

  assert.deepEqual(errors, []);
  console.log('energy overview and trend contract passed');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
