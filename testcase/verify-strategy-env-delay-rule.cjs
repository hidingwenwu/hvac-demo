/* 环境感知联动·动作链序列新规回归:
   ① 控制类动作(空调控制/锁定控制)后不是延时时,保存提示“空调控制或锁定控制后必须紧跟一个延时动作”
   ② 相邻同类型动作仍优先提示“相邻两个执行动作不允许相同”
   ③ 上一动作为锁定控制时,“＋ 添加动作”默认新增延时
   ④ 末位为控制类动作(无延时)允许保存 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(req.url.split('?')[0])] || 'application/octet-stream' });
    res.end(data);
  });
});

const lastToast = async (page) => page.locator('.msg-wrap .msg').last().textContent();
const rowType = (page, i) => page.locator('#actionList .action-row').nth(i).locator('select').first().inputValue();

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/pages/strategy-env.html`);

    await page.locator('button', { hasText: '新建任务' }).click();
    await page.locator('#tName').fill('测试控制后须延时');
    /* 默认动作1=空调控制,设置开关机=开机(满足至少一个控制参数) */
    await page.locator('#actionList .action-row').nth(0).locator('.action-body select').first().selectOption('开机');

    /* ③:控制后添加动作默认延时;改为锁定控制后再添加,仍应默认延时 */
    await page.locator('#addActionBtn').click();
    assert.equal(await rowType(page, 1), 'delay', '空调控制后添加动作应默认延时');
    await page.locator('#actionList .action-row').nth(1).locator('select').first().selectOption('lock');
    await page.locator('#addActionBtn').click();
    assert.equal(await rowType(page, 2), 'delay', '锁定控制后添加动作应默认延时');
    await page.locator('#actionList .action-row').nth(2).locator('.action-del').click();

    /* ①:空调控制→锁定控制(中间无延时),保存拦截 */
    await page.locator('#dlgTask .df .btnp').click();
    await page.waitForSelector('.msg-wrap .msg');
    assert.ok((await lastToast(page)).includes('空调控制或锁定控制后必须紧跟一个延时动作'), '控制后无延时应提示新规文案');
    assert.equal(await page.locator('#dlgTask').evaluate((el) => el.classList.contains('show')), true, '校验失败时弹窗不关闭');

    /* ②:相邻同类型仍提示相邻文案(锁定→锁定) */
    /* 当前为 控制→锁定;把动作1也改为锁定 → 锁定→锁定 */
    await page.locator('#actionList .action-row').nth(0).locator('select').first().selectOption('lock');
    await page.locator('#dlgTask .df .btnp').click();
    await page.waitForTimeout(200);
    assert.ok((await lastToast(page)).includes('相邻两个执行动作不允许相同'), '相邻同类型应优先提示相邻文案');

    /* ④:延时→锁定(末位)允许保存:动作1改为延时、动作2保持锁定 */
    await page.locator('#actionList .action-row').nth(0).locator('select').first().selectOption('delay');
    await page.locator('#dlgTask .df .btnp').click();
    await page.waitForTimeout(300);
    assert.ok((await lastToast(page)).includes('新建任务成功'), '末位为控制类动作应允许保存');
    assert.equal(await page.locator('#dlgTask').evaluate((el) => el.classList.contains('show')), false, '保存成功后弹窗关闭');
    assert.equal(await page.locator('#tbody tr').nth(0).locator('td').nth(0).textContent(), '测试控制后须延时', '新任务插入列表首行');

    assert.deepEqual(errors, [], '页面不应有 JS 错误');
    console.log('环境感知联动·动作链序列新规 ✓ 控制后须延时/相邻优先/锁定后默认延时/末位免延时');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('验证失败:', e.message); process.exit(1); });
