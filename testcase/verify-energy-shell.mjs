import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const port = 8813;
const server = http.createServer((req, res) => {
  let requestPath = decodeURIComponent(req.url.split('?')[0]);
  if (requestPath === '/') requestPath = '/hvac-demo.html';
  const file = path.join(root, requestPath);
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${port}/hvac-demo.html`);
  await page.waitForLoadState('domcontentloaded');

  const topLabels = await page.locator('#nav > div > .mi > .lb, #nav > .mi > .lb').allTextContents();
  const strategyIndex = topLabels.indexOf('节能策略');
  const energyIndex = topLabels.indexOf('能耗分析');
  const deviceIndex = topLabels.indexOf('项目及设备管理');
  assert.ok(strategyIndex >= 0 && energyIndex === strategyIndex + 1 && deviceIndex === energyIndex + 1, `能耗分析菜单顺序不正确: ${topLabels.join('/')}`);

  await page.getByText('能耗分析', { exact: true }).click();
  const energyItems = await page.locator('#nav .mg-body .mi.sub .lb').allTextContents();
  ['能耗总览', '趋势分析', '对比分析', '排行与结构', '负荷分析', '能耗报表', '群组管理'].forEach(label => assert.ok(energyItems.includes(label), `缺少能耗子菜单: ${label}`));

  await page.getByText('能耗总览', { exact: true }).click();
  assert.match(await page.locator('#fr').getAttribute('src'), /pages\/energy-overview\.html/);

  await page.locator('#projSel').selectOption({ label: '001' });
  await page.waitForTimeout(100);
  const labelsAfterSwitch = await page.locator('#nav .lb').allTextContents();
  assert.ok(!labelsAfterSwitch.includes('能耗分析'), '001 项目必须隐藏能耗分析菜单');
  assert.match(await page.locator('#fr').getAttribute('src'), /pages\/overview-big\.html/, '无电表项目必须回退项目总览');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fyProj')).meters), 0);

  await page.goto(`http://127.0.0.1:${port}/pages/energy-overview.html`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#noMeterState').isVisible(), true, '无电表项目直达能耗页必须显示无数据说明');

  console.log('energy shell contract passed');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
