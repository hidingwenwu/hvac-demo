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
  const filterLabels = await page.locator('.filter-shell .fl').allTextContents();
  assert.ok(filterLabels.includes('租户名称'));
  assert.ok(filterLabels.includes('联系人名称'));
  assert.equal(filterLabels.includes('账户租户名称'), false);
  assert.equal(filterLabels.includes('联系人真实名称'), false);
  const headers = await page.locator('#thead th').allTextContents();
  assert.ok(headers.includes('租户名称'));
  assert.ok(headers.includes('联系人名称'));
  assert.ok(headers.includes('欠费锁定'));
  assert.equal(await page.locator('.filter-shell .btn:has-text("导出变动记录")').count(), 1);
  assert.equal(await page.locator('.filter-shell .btn:has-text("导出充值记录")').count(), 0);
  assert.equal(await page.locator('.filter-shell .btn:has-text("导出消费记录")').count(), 0);

  await page.locator('#tbody a:has-text("查看")').first().click();
  const detailText = await page.locator('#viewGrid').innerText();
  assert.match(detailText, /租户ID:/);
  assert.equal(detailText.includes('项目默认'), false);
  assert.equal(detailText.includes('锁定已停用'), false);
  assert.equal(await page.locator('#viewRecTitle').textContent(), '变动记录');
  assert.deepEqual(await page.locator('#viewRecTable th').allTextContents(), ['变动类型','变动方式','变动金额','变动后余额','备注','时间']);
  assert.equal(await page.locator('#viewRecWrap .tabs').count(), 0);
  const changeTypes = await page.locator('#viewRecTable tbody td:first-child').allTextContents();
  const changeWays = await page.locator('#viewRecTable tbody td:nth-child(2)').allTextContents();
  assert.ok(changeTypes.includes('充值')&&changeTypes.includes('消费'));
  assert.ok(changeWays.includes('线上'));
  assert.ok(changeWays.some(value=>value==='线下充值'||value==='自助充值'));
  assert.equal(await page.locator('#changeFilterAll').getAttribute('aria-pressed'), 'true');
  await page.locator('#changeFilterPay').click();
  assert.ok((await page.locator('#viewRecTable tbody td:first-child').allTextContents()).every(value=>value==='充值'));
  await page.locator('#changeFilterUse').click();
  assert.ok((await page.locator('#viewRecTable tbody td:first-child').allTextContents()).every(value=>value==='消费'));
  await page.locator('#btnExportTenantChanges').click();
  assert.match(await page.locator('.msg').last().innerText(), /已导出租户“801会议室”的全部变动记录/);
  await page.locator('.msg').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.locator('#dlgView .dialog').screenshot({ path: 'D:/workspace/hvac-demo/testcase/租户详情变动记录.png' });
  await page.locator('#dlgView .dx').click();

  await page.fill('#fName', '物业办公室');
  await query(page);
  let rowCells = await page.locator('#tbody tr').first().locator('td').allTextContents();
  assert.equal(rowCells[headers.indexOf('余额')], '-36.20', '余额列只显示数值');
  let lockStateCell = page.locator('#tbody tr').first().locator('td').nth(headers.indexOf('欠费锁定'));
  assert.equal(await lockStateCell.locator('.threshold-value-wrap > span').first().textContent(), '关闭');
  assert.equal(await lockStateCell.locator('.threshold-custom-tag').textContent(), '自定义');
  await reset(page);
  await page.fill('#fName', '812会议室');
  await query(page);
  rowCells = await page.locator('#tbody tr').first().locator('td').allTextContents();
  assert.equal(rowCells[headers.indexOf('余额')], '-5.37', '锁定租户的余额后不显示已锁定备注');
  lockStateCell = page.locator('#tbody tr').first().locator('td').nth(headers.indexOf('欠费锁定'));
  assert.equal(await lockStateCell.locator('.threshold-value-wrap > span').first().textContent(), '开启');
  assert.equal(await lockStateCell.locator('.threshold-custom-tag').textContent(), '自定义');
  await reset(page);

  await page.fill('#fBalanceMin', '0');
  await page.fill('#fBalanceMax', '0');
  await query(page);
  assert.equal(await totalCount(page), 4);

  await reset(page);
  await page.selectOption('#fRecharge', 'never');
  await query(page);
  assert.equal(await totalCount(page), 3);

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
  await page.locator('.filter-shell .btn:has-text("新增")').click();
  await page.fill('#eName', '测试初始充值租户');
  await page.fill('#eContact', '测试联系人');
  await page.fill('#eBalance', '123.45');
  await page.locator('#dlgEdit .btnp').click();
  await page.fill('#fName', '测试初始充值租户');
  await query(page);
  await page.locator('#tbody a:has-text("查看")').first().click();
  const createdDetail = await page.locator('#viewGrid').innerText();
  assert.match(createdDetail, /租户ID:\s*T\d{6}/);
  const firstChange = await page.locator('#viewRecTable tbody tr').first().locator('td').allTextContents();
  assert.deepEqual(firstChange, ['充值','线下充值','+123.45','123.45','新建租户初始余额',firstChange[5]]);
  await page.locator('#dlgView .dx').click();

  await page.locator('#tbody a:has-text("房间信息")').first().click();
  assert.ok(await page.locator('#tenantRoomTree .room-tree-building').count() > 0);
  assert.ok(await page.locator('#tenantRoomTree .room-tree-floor').count() > 0);
  assert.ok(await page.locator('#tenantRoomTree input[data-room]').count() > 0);
  await page.locator('.msg').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.locator('#dlgRoom .dialog').screenshot({ path: 'D:/workspace/hvac-demo/testcase/租户房间绑定.png' });
  const roomCheckbox = page.locator('#tenantRoomTree input[data-room]:not(:checked)').first();
  const roomName = await roomCheckbox.getAttribute('data-room');
  await page.locator(`#tenantRoomTree input[data-room="${roomName}"]`).check();
  await page.locator('#dlgRoom .dx').click();
  await page.locator('#tbody a:has-text("房间信息")').first().click();
  assert.equal(await page.locator(`#tenantRoomTree input[data-room="${roomName}"]`).isChecked(), true, '勾选后应立即保存房间绑定');
  await page.locator('#dlgRoom .dx').click();

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
