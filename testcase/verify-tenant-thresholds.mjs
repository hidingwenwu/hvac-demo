import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/dingd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const pageUrl = 'file:///D:/workspace/hvac-demo/pages/elec-tenant.html';
const prepaid = { name: '平台产品测试-预付费', pay: 'pre', unit: 'hour' };
const browser = await chromium.launch({ headless: true });

function tenantRow(page, name) {
  return page.locator('#tbody tr').filter({
    has: page.locator(`input.row-chk[data-n="${name}"]`)
  }).first();
}

async function openThreshold(page, name) {
  const checkbox = tenantRow(page, name).locator('input.row-chk');
  if (!await checkbox.isChecked()) await checkbox.check();
  await page.locator('#btnBatchTh').click();
}

try {
  const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(meta => localStorage.setItem('fyProj', JSON.stringify(meta)), prepaid);
  await page.goto(pageUrl, { waitUntil: 'load' });

  const defaultRow = tenantRow(page, '801会议室');
  const customRow = tenantRow(page, '812会议室');
  assert.equal(await customRow.locator('a:has-text("阈值设置")').count(), 0, '行内操作不显示单独阈值设置');
  assert.equal(await page.locator('#btnBatchTh').textContent(), '阈值设置', '顶部统一阈值设置按钮存在');
  assert.equal(await defaultRow.locator('.threshold-custom-value').count(), 0, '跟随项目默认值的租户不显示自定义颜色');
  assert.equal(await customRow.locator('td').nth(2).locator('.threshold-custom-value').count(), 0, '租户名称后不显示自定义颜色');
  assert.equal(await customRow.locator('.threshold-custom-value').count(), 3, '三个阈值相关字段使用自定义颜色');
  for (const cellIndex of [5, 6, 7]) {
    const value = customRow.locator('td').nth(cellIndex).locator('.threshold-custom-value');
    assert.equal(await value.textContent(), cellIndex === 7 ? '开启' : cellIndex === 5 ? '100.00' : '10.00');
    assert.equal(
      await value.getAttribute('data-tooltip'),
      '该租户使用单独设置的阈值，不随项目默认阈值变化。'
    );
    await value.hover();
    const tooltip = page.locator('#thresholdTooltip');
    assert.equal(await tooltip.isVisible(), true, '悬停自定义数值时显示提示');
    assert.equal(await tooltip.textContent(), '该租户使用单独设置的阈值，不随项目默认阈值变化。');
    const valueBox = await value.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    assert.ok(
      tooltipBox.x >= valueBox.x && tooltipBox.y + tooltipBox.height <= valueBox.y + valueBox.height + 4,
      '提示位于数值右上方'
    );
    await page.mouse.move(0, 0);
  }

  await openThreshold(page, '812会议室');
  assert.equal(await page.locator('#thResetDefault').isVisible(), true, '自定义租户可恢复项目默认值');
  await page.locator('#dlgTh .dx').click();
  await defaultRow.locator('input.row-chk').check();
  await page.locator('#btnBatchTh').click();
  assert.equal(await page.locator('#thResetDefault').isVisible(), false, '混合选择时不显示恢复项目默认值');
  await page.locator('#dlgTh .dx').click();
  await defaultRow.locator('input.row-chk').uncheck();

  await page.locator('button:has-text("默认阈值设置")').click();
  assert.equal(
    await page.locator('#thDefHint').innerText(),
    '项目全局默认阈值：未单独配置阈值的租户默认使用此设置'
  );
  await page.fill('#thRemind', '120');
  await page.locator('#dlgTh .btnp').click();
  assert.equal(await page.locator('#dlgThConfirm').isVisible(), true, '修改项目默认阈值需要二次确认');
  assert.equal(await page.locator('#dlgTh').isVisible(), false, '二次确认期间应暂时收起阈值编辑弹窗');
  assert.equal(
    await page.locator('#thConfirmText').innerText(),
    '本次修改将同步应用于当前项目中34 个未单独配置阈值的租户，并会按修改后的阈值对相关租户执行锁定或提醒动作。确认修改？'
  );
  await page.locator('#dlgThConfirm .btn:not(.btnp)').click();
  assert.equal(await page.locator('#dlgTh').isVisible(), true, '取消二次确认后保留编辑弹窗');
  assert.equal(await defaultRow.locator('td').nth(5).textContent(), '100.00', '取消后默认阈值不变');

  await page.locator('#dlgTh .btnp').click();
  await page.locator('#dlgThConfirm .btnp').click();
  assert.equal(await defaultRow.locator('td').nth(5).textContent(), '120.00', '跟随项目默认值的租户同步更新');
  assert.equal(
    await customRow.locator('td').nth(5).locator('.threshold-value-wrap > span').first().textContent(),
    '100.00',
    '自定义租户不受项目默认值修改影响'
  );

  await page.locator('button:has-text("默认阈值设置")').click();
  await page.locator('#dlgTh .btnp').click();
  assert.equal(await page.locator('#dlgThConfirm').isVisible(), false, '阈值未变化时不触发二次确认');
  assert.match(await page.locator('.msg').last().innerText(), /阈值未发生变化/);
  await page.locator('#dlgTh .dx').click();

  await openThreshold(page, '812会议室');
  await page.locator('#thResetDefault').click();
  assert.match(await page.locator('#thConfirmText').innerText(), /恢复后将跟随项目默认阈值变化/);
  await page.locator('#dlgThConfirm .btnp').click();
  assert.equal(await customRow.locator('.threshold-custom-value').count(), 0, '恢复默认后移除自定义颜色');
  assert.equal(await customRow.locator('td').nth(5).textContent(), '120.00', '恢复后立即使用当前项目默认阈值');

  assert.deepEqual(consoleErrors, [], '页面不应产生控制台错误');
  await context.close();
  console.log('tenant threshold governance verification passed');
} finally {
  await browser.close();
}
