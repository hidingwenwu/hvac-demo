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

async function rows(page) {
  return page.locator('#dlgLog .log-row').evaluateAll((els) =>
    els.map((el) => ({
      time: el.children[0].textContent,
      text: el.children[1].textContent,
      tag: el.children[2].textContent,
      cls: el.children[2].className,
    })));
}
async function openTaskLog(page, i) {
  await page.locator('#tbody tr').nth(i).locator('a', { hasText: '日志' }).click();
  await page.waitForTimeout(150);
}
const texts = (rs) => rs.map((r) => r.text);
const modalVisible = (page) => page.locator('#dlgLog').evaluate((el) => getComputedStyle(el).display !== 'none');

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    /* ───── 极致节能 ───── */
    await page.goto(`${BASE}/pages/strategy-ultimate.html`);
    // 任务1:午休时段定时节能(开机/制冷/26/高,12:00起,间隔15)
    await openTaskLog(page, 0);
    assert.equal(await modalVisible(page), true, 'ULT 日志弹窗应打开');
    assert.equal(await page.locator('#dlgLog #logTitle').textContent(), '空调控制指令记录 - 午休时段定时节能');
    let rs = await rows(page);
    assert.equal(rs.length, 6, 'ULT 应显示 6 条示例');
    assert.deepEqual(rs.map((r) => [r.time, r.tag]), [
      ['2026-07-02 12:30:03', '异常'], ['2026-07-02 12:15:02', '成功'], ['2026-07-02 12:00:01', '成功'],
      ['2026-07-01 12:30:03', '异常'], ['2026-07-01 12:15:02', '成功'], ['2026-07-01 12:00:01', '异常'],
    ]);
    const U = '执行空调控制：开机 / 制冷 / 26℃ / 高风';
    assert.deepEqual(texts(rs), [
      `${U}，部分空调（1-2-1-2、1-2-1-3）由于【设备离线】未执行成功。`,
      `${U}。`, `${U}。`,
      `${U}，部分空调（1-2-1-5）由于【状态锁定】未执行成功。`,
      `${U}。`,
      `${U}，全部空调由于【设备离线】未执行成功。`,
    ]);
    assert.ok(rs[0].cls.includes('ter') && rs[3].cls.includes('ter') && rs[5].cls.includes('ter'), '异常应为红色标签');
    assert.ok(!rs.some((r) => /下发控制指令|会议室|产品部|研发部|办公区/.test(r.text)), 'ULT 日志不应含"下发控制指令"或房间信息');
    await page.screenshot({ path: path.join(__dirname, 'log-ultimate-task1.png') });
    await page.locator('#dlgLog .dx').click();
    // 任务2:深夜恒温控制(不设置/制冷/27/低,22:00起,间隔30)
    await openTaskLog(page, 1);
    rs = await rows(page);
    assert.equal(await page.locator('#dlgLog #logTitle').textContent(), '空调控制指令记录 - 深夜恒温控制');
    assert.equal(rs[0].time, '2026-07-02 23:00:03');
    assert.equal(rs[0].text, '执行空调控制：制冷 / 27℃ / 低风，部分空调（1-2-1-2、1-2-1-3）由于【设备离线】未执行成功。');
    assert.equal(rs[2].time, '2026-07-02 22:00:01');
    assert.equal(rs[2].text, '执行空调控制：制冷 / 27℃ / 低风。');
    console.log('极致节能 ✓ 6 条示例(成功/部分失败×2种原因/全部失败),文案与时间正确');

    /* ───── 环境感知联动 ───── */
    await page.goto(`${BASE}/pages/strategy-env.html`);
    // 任务列表示例 10 条
    assert.equal(await page.locator('#tbody tr').count(), 10, 'ENV 默认任务应为 10 条');
    assert.equal(await page.locator('#tbody tr').nth(0).locator('td').nth(0).textContent(), '会议室有人联动舒适控制');
    assert.equal(await page.locator('#tbody tr').nth(9).locator('td').nth(0).textContent(), '夜间低温保温');

    // 任务0:无持续条件,动作=控制+锁定(窗口 08:30-20:00,中点 14:15)
    await openTaskLog(page, 0);
    assert.equal(await page.locator('#dlgLog #logTitle').textContent(), '任务执行日志 - 会议室有人联动舒适控制');
    rs = await rows(page);
    assert.deepEqual(texts(rs), [
      '满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风。',
      '执行空调锁定：锁定开机 / 模式锁定制冷 / 温度锁定16-30℃。',
      '满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风，部分空调（1-2-1-2）由于【设备离线】未执行成功。',
      '满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风，部分空调（1-2-1-3）由于【状态锁定】未执行成功。',
    ]);
    assert.deepEqual(rs.map((r) => r.time), ['2026-07-02 14:15:05', '2026-07-02 14:15:05', '2026-07-02 08:50:41', '2026-07-01 08:40:05']);
    assert.deepEqual(rs.map((r) => r.tag), ['成功', '成功', '异常', '异常']);
    assert.ok(!rs.some((r) => /下发控制指令|人在状态|有人|门窗|温度>/.test(r.text)), 'ENV 日志不应含"下发控制指令"或组合条件内容');
    await page.screenshot({ path: path.join(__dirname, 'log-env-task1.png') });
    await page.locator('#dlgLog .dx').click();

    // 任务2:门窗开启延时关机(无持续条件,08:00-20:00,中点 14:00;延时15分钟→14:15 关机)
    await openTaskLog(page, 2);
    rs = await rows(page);
    assert.deepEqual(texts(rs), [
      '满足组合条件，执行延时：15 分钟。',
      '执行空调控制：关机。',
      '满足组合条件，执行空调控制：关机，部分空调（1-2-1-2）由于【设备离线】未执行成功。',
      '满足组合条件，执行空调控制：关机，部分空调（1-2-1-3）由于【状态锁定】未执行成功。',
    ]);
    assert.deepEqual(rs.map((r) => r.time), ['2026-07-02 14:00:05', '2026-07-02 14:15:05', '2026-07-02 08:20:41', '2026-07-01 08:10:05']);
    assert.deepEqual(rs.map((r) => r.tag), ['成功', '成功', '异常', '异常']);
    await page.locator('#dlgLog .dx').click();

    // 任务4:人走关机锁定(持续20分钟,18:00-23:00,中点 20:30;延时→关机→锁定)
    await openTaskLog(page, 4);
    rs = await rows(page);
    assert.deepEqual(texts(rs), [
      '持续满足组合条件，执行延时：15 分钟。',
      '执行空调控制：关机。',
      '执行空调锁定：锁定关机。',
      '持续满足组合条件，执行空调控制：关机，部分空调（1-2-1-2）由于【设备离线】未执行成功。',
      '未持续满足组合条件，本次不执行动作。',
      '持续满足组合条件，执行空调控制：关机，部分空调（1-2-1-3）由于【状态锁定】未执行成功。',
    ]);
    assert.deepEqual(rs.map((r) => r.time), ['2026-07-02 20:30:05', '2026-07-02 20:45:05', '2026-07-02 20:45:05', '2026-07-02 18:20:41', '2026-07-01 18:15:18', '2026-07-01 18:10:05']);
    assert.deepEqual(rs.map((r) => r.tag), ['成功', '成功', '成功', '异常', '跳过', '异常']);
    assert.ok(rs[4].cls.includes('twn') && rs[3].cls.includes('ter'));
    await page.screenshot({ path: path.join(__dirname, 'log-env-task2.png') });
    await page.locator('#dlgLog .dx').click();

    // 任务7:高温分段降温策略(持续5分钟,09:00-18:00,中点 13:30;控制→延时10分钟→27℃)
    await openTaskLog(page, 7);
    rs = await rows(page);
    assert.deepEqual(texts(rs), [
      '持续满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风。',
      '执行延时：10 分钟。',
      '执行空调控制：27℃。',
      '持续满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风，部分空调（1-2-1-2）由于【设备离线】未执行成功。',
      '未持续满足组合条件，本次不执行动作。',
      '持续满足组合条件，执行空调控制：开机 / 制冷 / 26℃ / 中风，部分空调（1-2-1-3）由于【状态锁定】未执行成功。',
    ]);
    assert.deepEqual(rs.map((r) => r.time), ['2026-07-02 13:30:05', '2026-07-02 13:30:05', '2026-07-02 13:40:05', '2026-07-02 09:20:41', '2026-07-01 09:15:18', '2026-07-01 09:10:05']);
    await page.screenshot({ path: path.join(__dirname, 'log-env-task3.png') });
    console.log('环境感知联动 ✓ 10 条任务示例;延时/锁定/控制三类动作、三种条件状态、成功/异常/跳过均符合模板');

    assert.deepEqual(errors, [], '页面不应有 JS 错误');
    console.log('全部断言通过,无 JS 报错');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('验证失败:', e.message); process.exit(1); });
