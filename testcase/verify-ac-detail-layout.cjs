const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE_URL = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE_URL}/pages/ctrl-ac.html`);
    await page.evaluate(() => localStorage.setItem('acVisualPromoSeen', '1'));

    const panel = page.locator('#detailPanel');

    // 1. 初始未选择:详情隐藏
    assert.equal(await panel.isVisible(), false, '初始应隐藏详情');

    // 2. 单选:详情显示,名称行居首、位置卡次之、主机编号居末,内容与被点卡片一致
    const firstCard = page.locator('.ac-card').first();
    const cardLoc = (await firstCard.locator('.ac-card-name').innerText()).trim();
    await firstCard.click();
    assert.equal(await panel.isVisible(), true, '单选应显示详情');
    const order = await page.$$eval('#infoGrid > div', (ds) => ds.map((d) => d.className || d.querySelector('.ig-k').textContent));
    assert.equal(order[0], 'info-location-card', '名称+位置合并卡应为第一项');
    assert.deepEqual(await page.$$eval('.info-location-card > div', (ds) => ds.map((d) => d.className)), ['info-name-row', 'info-loc-row'], '合并卡内名称行在前、位置行在后');
    assert.equal(order[order.length - 1], 'info-host', '主机编号应为最后一项');
    assert.deepEqual(order.slice(1, 5), ['空调品牌', '空调容量', '空调地址', '故障代码'], '中部字段顺序');
    assert.equal((await page.locator('.info-loc-row .ig-v').innerText()).trim().replace(/\s/g, ''), ('1号楼·3层·' + cardLoc.split('-')[0] + '室').replace(/\s/g, ''), '详情位置应与卡片一致');
    const nameInTitle = cardLoc.includes('-') ? cardLoc.split('-').slice(1).join('-') : '';
    if (nameInTitle) assert.equal((await page.locator('.info-name-row .ig-v').innerText()).trim(), nameInTitle, '详情名称应与卡片一致');
    assert.match(await page.locator('.info-host .ig-v').innerText(), /^B\d+$/, '主机编号应为完整序列号');
    await page.locator('.rpanel').screenshot({ path: path.join(__dirname, 'ac-detail-normal.png') });

    // 2b. 主机编号一键复制
    const host = (await page.locator('.info-host .ig-v').innerText()).trim();
    await page.locator('.ih-copy').click();
    assert.match(await page.locator('.msg').last().innerText(), /主机编号已复制/, '复制应有成功提示');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), host, '剪贴板内容应为主机编号');

    // 3. 多选/取消全部:详情自动隐藏
    await page.locator('.ac-card').nth(1).click();
    assert.equal(await panel.isVisible(), false, '多选应隐藏详情');
    await firstCard.click();
    await page.locator('.ac-card').nth(1).click();
    assert.equal(await panel.isVisible(), false, '取消全部应隐藏详情');

    // 4. 故障空调:故障代码呈红色标签
    await page.evaluate(() => { document.getElementById('fFault').value = '故障'; applyFilter(); });
    await page.locator('.ac-card.m-fault').first().click();
    assert.equal(await panel.isVisible(), true);
    assert.equal((await page.locator('.ig-fault').innerText()).trim(), 'LOST', '故障应显示红色标签');
    await page.locator('.rpanel').screenshot({ path: path.join(__dirname, 'ac-detail-lost.png') });
    await page.locator('.ac-card.m-fault').first().click(); // 取消勾选,避免遗留选择影响后续计数
    await page.evaluate(() => resetFilter());

    // 5. 生效后:提示台数正确且选择释放、详情隐藏
    await page.locator('.ac-card').nth(0).click();
    await page.locator('.ac-card').nth(1).click();
    await page.evaluate(() => applyCtrl());
    assert.match(await page.locator('.msg').last().innerText(), /已下发至 2 台空调/, '生效提示应为实际台数');
    assert.equal(await page.locator('.ac-card.sel').count(), 0, '生效后选择应释放');
    assert.equal(await panel.isVisible(), false, '生效后详情应隐藏');

    // 5b. 锁定控制生效:同样计数并释放选择
    await page.locator('.ac-card').nth(0).click();
    await page.locator('.ac-card').nth(1).click();
    await page.evaluate(() => applyLock());
    assert.match(await page.locator('.msg').last().innerText(), /锁定设置已下发至 2 台空调/, '锁定生效提示应为实际台数');
    assert.equal(await page.locator('.ac-card.sel').count(), 0, '锁定生效后选择应释放');
    assert.equal(await panel.isVisible(), false, '锁定生效后详情应隐藏');

    // 5c. 筛选变化修剪选择:结果外自动取消,恰余1台时详情自动显示
    await page.locator('.ac-card').nth(0).click();
    await page.locator('.ac-card.m-fault').first().click();
    assert.equal(await panel.isVisible(), false, '两台选中时详情应隐藏');
    await page.evaluate(() => { document.getElementById('fFault').value = '故障'; applyFilter(); });
    assert.equal(await page.locator('.ac-card.sel').count(), 1, '筛选后应仅保留结果内的选择');
    assert.match(await page.locator('#pager .pg-total').innerText(), /已选择 1 条/, '分页栏计数应同步');
    assert.equal(await panel.isVisible(), true, '恰余1台时详情应自动显示');
    assert.match(await page.locator('.info-loc-row .ig-v').innerText(), /306室/, '详情应为保留的故障空调');
    await page.evaluate(() => { document.getElementById('fFault').value = '正常'; applyFilter(); });
    assert.equal(await page.locator('.ac-card.sel').count(), 0, '再次筛选应修剪至0台');
    assert.equal(await panel.isVisible(), false, '选择清空后详情应隐藏');
    await page.evaluate(() => resetFilter());

    // 6. 可视化布局:进入时详情隐藏,点风机显示详情,切回卡片视图恢复按勾选判定
    await page.locator('#vtPlan').click();
    assert.equal(await panel.isVisible(), false, '进入可视化时详情应隐藏');
    await page.locator('.fan').first().click();
    assert.equal(await panel.isVisible(), true, '点击风机应显示详情');
    assert.match(await page.locator('.info-loc-row .ig-v').innerText(), /1号楼 · \d+层 · \d+室/);
    await page.locator('#vtCard').click();
    assert.equal(await panel.isVisible(), false, '切回卡片视图且无勾选应隐藏');

    assert.deepEqual(errors, [], `页面不应有报错: ${errors.join('; ')}`);
    console.log('ac detail layout verification passed');
  } finally {
    await browser.close();
    server.close();
  }
})();
