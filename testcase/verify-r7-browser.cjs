const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:8802';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${BASE_URL}/pages/ops-r7-list.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    assert.equal(await page.locator('#summaryTotal').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#trafficFilter option[value=""]').innerText(), '流量状态');
    assert.equal(await page.locator('#trafficFilter option[value="normal"]').innerText(), '正常');
    const filterLabels = await page.locator('.filter-grid select option[value=""]').allTextContents();
    assert.ok(filterLabels.every((label) => !label.includes('全部')));
    const filterWidths = await page.locator('#trafficFilter, #projectFilter').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
    assert.ok(filterWidths[0] < filterWidths[1]);
    const filterButtonPosition = await page.locator('.filter-actions').evaluate((node) => ({ top: Math.round(node.getBoundingClientRect().top), bottom: Math.round(node.getBoundingClientRect().bottom) }));
    const lastFilterPosition = await page.locator('#faultFilter').evaluate((node) => ({ top: Math.round(node.getBoundingClientRect().top), bottom: Math.round(node.getBoundingClientRect().bottom) }));
    assert.equal(filterButtonPosition.top, lastFilterPosition.top);
    await page.locator('#summaryOnline').click();
    assert.equal(await page.locator('#summaryOnline').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#summaryTotal').getAttribute('aria-pressed'), 'false');
    const onlineStates = await page.locator('#deviceBody .status').allTextContents();
    assert.ok(onlineStates.length > 0 && onlineStates.every((value) => value.trim() === '在线'));
    await page.locator('#summaryTotal').click();

    await page.locator('#snFilter').fill('240612');
    await page.getByRole('button', { name: '查询' }).click();
    assert.equal(await page.locator('#deviceBody tr').count(), 1);
    assert.match(await page.locator('#deviceBody').innerText(), /R7-110108-240612-0007/);

    await page.getByRole('button', { name: '重置' }).click();
    await page.locator('#summaryTotal').click();
    assert.ok(await page.locator('#deviceBody tr').count() > 1);

    let unboundRow = page.locator('#deviceBody tr', { hasText: 'R7-510107-240318-0036' });
    if (!await unboundRow.count()) {
      await page.locator('#devicePager .pg-size').selectOption('20');
      unboundRow = page.locator('#deviceBody tr', { hasText: 'R7-510107-240318-0036' });
    }
    await unboundRow.getByRole('button', { name: '绑定项目' }).click();
    await page.locator('#bindProjectSelect').selectOption({ label: '凤凰台测试' });
    await page.locator('#bindProjectDialog').getByRole('button', { name: '确定' }).click();
    assert.match(await page.locator('#deviceBody').innerText(), /凤凰台测试/);
    await page.reload();
    await page.waitForLoadState('networkidle');
    let reboundRow = page.locator('#deviceBody tr', { hasText: 'R7-510107-240318-0036' });
    if (!await reboundRow.count()) {
      await page.locator('#devicePager .pg-size').selectOption('20');
      reboundRow = page.locator('#deviceBody tr', { hasText: 'R7-510107-240318-0036' });
    }
    assert.match(await reboundRow.innerText(), /凤凰台测试/);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-list-verified.png'), fullPage: true });

    await page.locator('#snFilter').fill('240612');
    await page.getByRole('button', { name: '查询' }).click();
    await page.getByRole('button', { name: '详情' }).click();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('hvac:r7:selectedSn')), 'R7-110108-240612-0007');

    await page.goto(`${BASE_URL}/pages/ops-r7.html`);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#detailContent').isVisible(), false);
    assert.equal(await page.locator('#detailEmptyState').isVisible(), true);
    assert.equal(await page.locator('#pullSettingsButton').isVisible(), false);
    assert.equal(await page.locator('#snInput').inputValue(), '');
    await page.getByRole('button', { name: '筛选' }).click();
    assert.equal(await page.locator('#gatewayFilterDialog').isVisible(), true);
    await page.locator('#gatewayFilterDialog').getByRole('button', { name: '查询' }).click();
    assert.match(await page.locator('.msg-wrap').innerText(), /请选择项目/);
    await page.locator('#gatewayProjectSelect').selectOption({ label: '中关村软件园' });
    await page.locator('#gatewayFilterDialog').getByRole('button', { name: '查询' }).click();
    assert.match(await page.locator('#gatewayDeviceBody').innerText(), /R7-110108-240612-0007/);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-detail-selector-verified.png'), fullPage: true });
    await page.setViewportSize({ width: 480, height: 900 });
    const selectorDialogBox = await page.locator('#gatewayFilterDialog .dialog').boundingBox();
    assert.ok(selectorDialogBox && selectorDialogBox.width <= 456);
    assert.equal(await page.locator('#gatewayFilterDialog .df').isVisible(), true);
    assert.equal(await page.locator('.gateway-select-table').evaluate((node) => node.scrollWidth > node.clientWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-detail-selector-mobile-verified.png'), fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#gatewayDeviceBody input[type="radio"]').check();
    await page.locator('#gatewayFilterDialog').getByRole('button', { name: '确定' }).click();
    assert.equal(await page.locator('#snInput').inputValue(), 'R7-110108-240612-0007');
    assert.equal(await page.locator('#detailContent').isVisible(), false);
    await page.getByRole('button', { name: '读取' }).click();
    assert.equal(await page.locator('#detailContent').isVisible(), true);
    assert.match(await page.locator('#basicGrid').innerText(), /R7-110108-240612-0007/);

    await page.goto(`${BASE_URL}/pages/ops-r7.html?sn=R7-110108-240612-0007`);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#detailContent').isVisible(), true);
    assert.match(await page.locator('#basicGrid').innerText(), /R7-110108-240612-0007/);
    await page.getByRole('button', { name: /刷新/ }).click();
    assert.match(await page.locator('.msg-wrap').innerText(), /设备信息刷新成功/);

    await page.getByRole('button', { name: '拉取设定' }).click();
    assert.equal(await page.locator('#pullSettingsDialog').isVisible(), true);
    await page.locator('#settingInterval').fill('0');
    await page.locator('#pullSettingsDialog').getByRole('button', { name: '确定' }).click();
    assert.match(await page.locator('.msg-wrap').innerText(), /更新间隔必须为大于0的整数/);
    await page.locator('#settingInterval').fill('3');
    await page.locator('#pullSettingsDialog').getByRole('button', { name: '确定' }).click();
    assert.match(await page.locator('.msg-wrap').innerText(), /参数设置保存成功/);
    await page.getByRole('button', { name: '拉取设定' }).click();
    assert.equal(await page.locator('#settingInterval').inputValue(), '3');
    await page.locator('#pullSettingsDialog').getByRole('button', { name: '取消' }).click();

    await page.locator('#historyLocator').fill('2026-07-22T14:38:40');
    await page.locator('#historyLocator').dispatchEvent('change');
    assert.equal(await page.locator('#historyTime').innerText(), '2026-07-22 14:39:00');
    await page.getByRole('button', { name: '‹ 前1包' }).click();
    assert.equal(await page.locator('#historyTime').innerText(), '2026-07-22 14:38:00');
    await page.getByRole('button', { name: '后1包 ›' }).click();
    assert.equal(await page.locator('#historyLocator').inputValue(), '2026-07-22T14:39');
    await page.locator('#historyLocator').fill('2026-07-22T14:36');
    await page.locator('#historyLocator').dispatchEvent('change');
    await page.getByRole('button', { name: '‹ 前1包' }).click();
    assert.equal(await page.locator('#historyTime').innerText(), '2026-07-22 14:36:00');
    await page.locator('#historyLocator').fill('2026-07-22T14:40');
    await page.locator('#historyLocator').dispatchEvent('change');
    await page.getByRole('button', { name: '后1包 ›' }).click();
    assert.equal(await page.locator('#historyTime').innerText(), '2026-07-22 14:40:00');

    await page.getByText('参数曲线', { exact: true }).click();
    await page.locator('#curveUnit').selectOption({ index: 1 });
    await page.locator('#curveParam').selectOption({ index: 1 });
    await page.locator('#pane-curve').getByRole('button', { name: '查询' }).click();
    assert.equal(await page.locator('#curveCanvas').count(), 1);

    await page.getByText('参数筛选', { exact: true }).first().click();
    await page.locator('#pane-filter').getByRole('button', { name: '参数筛选' }).click();
    assert.equal(await page.locator('#paramFilterDialog').isVisible(), true);
    await page.locator('#paramFilterDialog').getByRole('button', { name: '确定' }).click();
    await page.locator('#filterStart').fill('2026-07-07T23:55');
    await page.locator('#filterEnd').fill('2026-07-07T23:57');
    await page.locator('#pane-filter').getByRole('button', { name: '查询' }).click();
    const filteredTimes = await page.locator('#filterBody tr td:first-child').allTextContents();
    assert.deepEqual(filteredTimes, ['2026-07-07 23:57:00', '2026-07-07 23:56:00', '2026-07-07 23:55:00']);

    await page.getByText('预警列表', { exact: true }).click();
    assert.equal(await page.locator('#warningBody tr').count(), 10);
    await page.getByRole('button', { name: '2', exact: true }).click();
    assert.equal(await page.locator('#warningBody tr').count(), 2);
    await page.locator('#warningParam').selectOption({ index: 1 });
    await page.locator('#pane-warning').getByRole('button', { name: '查询' }).click();
    assert.match(await page.locator('#warningPager').innerText(), /共\s*3\s*条/);
    assert.equal(await page.locator('#warningBody tr').count(), 3);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-detail-verified.png'), fullPage: true });

    await page.goto(`${BASE_URL}/pages/ops-r7-dashboard.html`);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#metricTotal').innerText(), '12');
    assert.equal(await page.locator('#totalMetricCard').count(), 1);
    assert.equal(await page.locator('#metricQuartet .metric-mini').count(), 4);
    assert.ok((await page.locator('#versionPie').getAttribute('style')).includes('conic-gradient'));
    assert.ok(await page.locator('#versionBars .version-row').count() > 0);
    assert.ok((await page.locator('#combinationPie').getAttribute('style')).includes('conic-gradient'));
    assert.ok(await page.locator('#combinationBars .combo-row').count() > 0);
    assert.ok(await page.locator('#combinationBars .combo-row').count() <= 20);
    assert.equal(await page.locator('.card-head > span').count(), 0);
    assert.equal(await page.locator('.distribution-layout').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length), 3);
    await page.locator('#onlineDonut').hover({ position: { x: 18, y: 63 } });
    assert.match(await page.locator('#pieTooltip').getAttribute('class'), /is-visible/);
    assert.match(await page.locator('#pieTooltip').innerText(), /\d+ 台 · \d+%/);
    await page.locator('#versionPie').hover({ position: { x: 18, y: 58 } });
    assert.match(await page.locator('#pieTooltip').getAttribute('class'), /is-visible/);
    assert.match(await page.locator('#pieTooltip').innerText(), /R7\.2\./);
    await page.locator('body').hover({ position: { x: 5, y: 5 } });
    assert.doesNotMatch(await page.locator('#pieTooltip').getAttribute('class'), /is-visible/);
    assert.match(await page.locator('#combinationBars').innerText(), /大金 \+ 三菱电机/);
    assert.doesNotMatch(await page.locator('#combinationBars').innerText(), /大金外机 \+ 三菱电机内机/);
    assert.equal(await page.locator('.combination-card h2').innerText(), '内外机组合分布（外机+内机）');
    assert.ok(await page.locator('#outdoorBrands .brand-row').count() > 0);
    assert.ok(await page.locator('#indoorBrands .brand-row').count() > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);

    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-dashboard-verified.png'), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-dashboard-1366-verified.png'), fullPage: true });
    await page.setViewportSize({ width: 480, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-dashboard-mobile-verified.png'), fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(`${BASE_URL}/hvac-demo.html`);
    await page.waitForLoadState('networkidle');
    await page.getByText('智慧运维', { exact: true }).click();
    await page.getByText('R7设备列表', { exact: true }).click();
    await page.locator('#fr').waitFor();
    assert.match(await page.locator('#fr').getAttribute('src'), /pages\/ops-r7-list\.html/);
    assert.match(await page.locator('#bc').innerText(), /智慧运维[\s\S]*R7设备列表/);
    const r7ListFrame = page.frameLocator('#fr');
    await r7ListFrame.locator('#snFilter').fill('240612');
    await r7ListFrame.getByRole('button', { name: '查询' }).click();
    await r7ListFrame.getByRole('button', { name: '详情' }).click();
    await page.waitForFunction(() => document.querySelector('#fr').getAttribute('src').includes('?sn='));
    assert.match(await page.locator('#fr').getAttribute('src'), /pages\/ops-r7\.html\?sn=R7-110108-240612-0007/);
    assert.match(await page.locator('#bc').innerText(), /智慧运维[\s\S]*R7设备详情/);
    await page.locator('#nav').getByText('R7设备详情', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#fr').getAttribute('src') === 'pages/ops-r7.html');
    const r7DetailFrame = page.frameLocator('#fr');
    assert.equal(await r7DetailFrame.locator('#detailEmptyState').isVisible(), true);
    assert.equal(await r7DetailFrame.locator('#detailContent').isVisible(), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'r7-shell-verified.png'), fullPage: true });

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log('R7 browser interaction passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
