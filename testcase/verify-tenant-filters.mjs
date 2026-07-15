import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/dingd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const pageUrl = 'file:///D:/workspace/hvac-demo/pages/elec-tenant.html';
const prepaid = { name: '平台产品测试-预付费', pay: 'pre', unit: 'hour' };
const postpaid = { name: '平台产品测试-后付费', pay: 'post', unit: 'day' };
const browser = await chromium.launch({ headless: true });

async function open(project) {
  const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(meta => localStorage.setItem('fyProj', JSON.stringify(meta)), project);
  await page.goto(pageUrl, { waitUntil: 'load' });
  return { context, page };
}

async function totalCount(page) {
  const text = await page.locator('.pg-total').textContent();
  return Number(text.match(/\d+/)?.[0] || 0);
}

async function reset(page) { await page.locator('#btnReset').click(); }
async function query(page) { await page.locator('#btnQuery').click(); }

try {
  const { context, page } = await open(prepaid);
  await page.locator('#fRecharge').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#fThresholdState').count(), 0, '不应显示阈值设置状态筛选');
  assert.equal(await page.evaluate(() =>
    document.getElementById('btnQuery').parentElement===document.getElementById('fRoom').closest('.fb')
  ), true, '查询按钮应紧随筛选框放在同一容器');

  await page.fill('#fBalanceMin', '0');
  await page.fill('#fBalanceMax', '0');
  await query(page);
  assert.equal(await totalCount(page), 4);

  await reset(page);
  await page.selectOption('#fRecharge', 'never');
  await query(page);
  assert.equal(await totalCount(page), 12);

  await reset(page);
  await page.fill('#fRemindMin', '50');
  await page.fill('#fRemindMax', '50');
  await query(page);
  assert.equal(await totalCount(page), 1);

  await reset(page);
  await page.fill('#fLockMin', '10');
  await page.fill('#fLockMax', '10');
  await query(page);
  assert.equal(await totalCount(page), 1);

  await reset(page);
  await page.selectOption('#fLockOn', 'off');
  await query(page);
  assert.equal(await totalCount(page), 1);

  await reset(page);
  await page.selectOption('#fLockState', 'locked');
  await query(page);
  assert.equal(await totalCount(page), 2);

  await reset(page);
  assert.equal(await page.locator('#fRoom').evaluate(element => element.tagName), 'SELECT');
  assert.equal(await page.locator('#fRoom option').first().textContent(), '全部房间');
  await page.selectOption('#fRoom', '801会议室');
  await query(page);
  assert.ok(await totalCount(page) > 0, '房间下拉选项应能筛选到关联租户');

  await reset(page);
  await page.locator('#quickDebt').click();
  assert.equal(await page.inputValue('#fBalanceMin'), '');
  assert.equal(await page.inputValue('#fBalanceMax'), '0');
  assert.equal(await totalCount(page), 8);
  assert.equal(await page.locator('#debtCnt').textContent(), '8');

  await page.locator('#quickLow').click();
  assert.equal(await page.inputValue('#fBalanceMax'), '');
  assert.equal(await totalCount(page), Number(await page.locator('#lowCnt').textContent()));
  assert.equal(await page.locator('#quickLow').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#quickDebt').getAttribute('aria-pressed'), 'false');

  await reset(page);
  await page.locator('.msg').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.screenshot({ path: 'D:/workspace/hvac-demo/testcase/预付费租户筛选.png', fullPage: true });
  await context.close();

  const post = await open(postpaid);
  assert.equal(await post.page.locator('#fRecharge').isVisible(), false);
  await post.context.close();

  console.log('tenant filter verification passed');
} finally {
  await browser.close();
}
