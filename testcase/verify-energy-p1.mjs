import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8816;
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
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/pages/energy-compare.html`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('.tabs .tab').count(), 2);
  assert.equal(await page.locator('#compareRows tr').count(), 10, '时间对比明细默认分页');
  const currentTotal = Number(await page.locator('#currentTotal').getAttribute('data-value'));
  const compareTotal = Number(await page.locator('#comparisonTotal').getAttribute('data-value'));
  assert.ok(currentTotal > 0 && compareTotal > 0);
  await page.locator('#compareWay').selectOption('custom');
  assert.equal(await page.locator('#customRange').isVisible(), true, '自定义两期必须显示第二时间段输入');
  await page.locator('#timeFrom').fill('2026-08-01');
  await page.locator('#timeTo').fill('2026-08-05');
  await page.locator('#customFrom').fill('2026-07-01');
  await page.locator('#customTo').fill('2026-07-03');
  await page.locator('#queryTime').click();
  assert.equal(await page.evaluate(() => alignedTimeCount), 3, '自定义两期长度不等时必须按较短一期对齐');
  assert.equal(await page.locator('#compareRows tr').count(), 3);
  assert.equal(Number(await page.locator('#currentTotal').getAttribute('data-value')), await page.evaluate(() => Number(currentResult.points.slice(0, alignedTimeCount).reduce((sum, point) => sum + point.energy, 0).toFixed(2))), '时间对比汇总必须使用对齐后的点位');
  assert.equal(await page.evaluate(() => timeChart.getOption().series[0].data.length), 3, '时间对比图表也必须使用对齐后的点位');
  assert.equal(await page.locator('#alignmentNote').isVisible(), true, '两期长度不等时必须显示对齐说明');
  assert.ok((await page.locator('#alignmentNote').textContent()).includes('多余 2 个点位未参与比较'));
  await page.locator('[data-tab="object"]').click();
  assert.equal(await page.locator('#objectMode').isVisible(), true);
  assert.equal(await page.locator('#objectGran').count(), 1, '对象对比必须提供时间粒度');
  assert.equal(await page.locator('#objectFrom').count(), 1, '对象对比必须提供开始日期');
  assert.equal(await page.locator('#objectTo').count(), 1, '对象对比必须提供结束日期');
  await page.locator('#compareLevel').selectOption('room');
  const options = page.locator('#availableObjects option');
  assert.ok(await options.count() > 6);
  await page.evaluate(() => {
    const select = document.getElementById('availableObjects');
    [...select.options].slice(0, 7).forEach(option => { option.selected = true; });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(await page.locator('#selectedObjects .tag').count(), 6, '对象对比最多保留 6 项');
  assert.equal(await page.locator('.msg.warning').count(), 1, '超过 6 项必须给出警告');
  await page.locator('#objectFrom').fill('2026-08-01');
  await page.locator('#objectTo').fill('2026-08-03');
  await page.locator('#queryObjects').click();
  assert.equal(await page.evaluate(() => objectResults[0].points.length), 3, '对象对比图表必须使用所选范围的共享趋势序列');
  assert.deepEqual(
    await page.evaluate(() => objectChartOption.series[0].data),
    await page.evaluate(() => objectResults[0].points.map(point => point.energy)),
    '对象对比图表数据必须来自共享趋势查询'
  );

  await page.goto(`http://127.0.0.1:${port}/pages/energy-report.html`); await page.waitForLoadState('domcontentloaded');
  assert.ok((await page.locator('.energy-note').textContent()).includes('仅统计能耗、运行时长及单位时长能耗'));
  assert.deepEqual(await page.locator('.energy-panel table thead th').allTextContents(), ['对象', '总能耗(kWh)', '运行时长(h)', '单位时长能耗(kWh/h)', '环比', '同比'], '能耗报表不得包含费用列');
  const reportTotal = Number(await page.locator('#reportTotalEnergy').getAttribute('data-value'));
  assert.equal(await page.locator('#reportRows tr').count(), 10, '报表默认按 10 条分页');
  assert.equal(await page.evaluate(() => Number(report.rows.reduce((sum, row) => sum + row.energy, 0).toFixed(2))), reportTotal, '报表全部行合计必须等于项目汇总');
  assert.equal(await page.evaluate(() => report.rows.every(row => !Object.hasOwn(row, 'fee'))), true, '报表数据不得包含费用字段');
  assert.ok((await page.locator('#reportPager').textContent()).includes('共 140 条'));
  await page.locator('#reportType').selectOption('week');
  assert.equal(await page.locator('#periodWeek').isVisible(), true);
  await page.locator('#periodWeek input').fill('2026-08-03');
  await page.locator('#queryReport').click();
  assert.ok((await page.locator('#reportPeriod').textContent()).startsWith('2026-08-03 至 2026-08-09'), '周报必须按用户选择的周一查询');
  await page.locator('#exportReport').click();
  assert.equal(await page.locator('.msg.success').count(), 1);
  await page.goto(`http://127.0.0.1:${port}/pages/energy-report.html?type=year&period=2025`); await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#reportType').inputValue(), 'year', '报表下钻必须回填报表类型');
  assert.equal(await page.locator('#periodYear select').inputValue(), '2025', '报表下钻必须回填报告期');

  await page.goto(`http://127.0.0.1:${port}/pages/energy-group.html`); await page.waitForLoadState('domcontentloaded');
  const seeded = await page.locator('#groupRows tr').count();
  assert.ok(seeded >= 3, '群组页应提供 3 个确定性初始样本');
  await page.locator('#addGroup').click();
  assert.equal(await page.locator('#groupDialog.show').count(), 1);
  await page.locator('#groupName').fill('测试跨页区域');
  await page.locator('#groupRemark').fill('自动化验证');
  await page.locator('#roomSearch').fill('301');
  await page.locator('#roomTree input[type="checkbox"]').first().check();
  await page.locator('#saveGroup').click();
  assert.ok((await page.locator('#groupRows').textContent()).includes('测试跨页区域'));

  await page.locator('#addGroup').click();
  await page.locator('#groupName').fill('测试跨页区域');
  await page.locator('#roomTree input[type="checkbox"]').first().check();
  await page.locator('#saveGroup').click();
  assert.equal(await page.locator('.msg.error').count(), 1, '重名必须阻止保存');
  await page.locator('#groupDialog .dx').click();

  await page.goto(`http://127.0.0.1:${port}/pages/energy-trend.html?obj=group:test&gran=day&from=2026-08-01&to=2026-08-03`); await page.waitForLoadState('domcontentloaded');
  await page.locator('#objectType').selectOption('group');
  assert.ok((await page.locator('#objectSelect').textContent()).includes('测试跨页区域'), '新增群组必须出现在趋势选择器');
  assert.deepEqual(errors, []);
  console.log('energy compare report and group contract passed');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
