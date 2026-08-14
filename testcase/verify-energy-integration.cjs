const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const PORT = 8817;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOT = path.join(__dirname, 'live-energy');
fs.mkdirSync(SHOT, { recursive: true });
const PAGES = [
  ['energy-overview', '能耗总览'], ['energy-trend', '趋势分析'], ['energy-compare', '对比分析'],
  ['energy-rank', '排行与结构'], ['energy-load', '负荷分析'], ['energy-report', '能耗报表'], ['energy-group', '群组管理']
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  if (pathname === '/') pathname = '/hvac-demo.html';
  fs.readFile(path.join(ROOT, pathname), (error, body) => {
    if (error) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(pathname)] || 'application/octet-stream' }); res.end(body);
  });
});

(async () => {
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location();
      const source = location && location.url || '';
      if (/favicon\.ico/i.test(source) || /ERR_FAILED/.test(message.text())) return;
      errors.push(`${message.text()}${source ? ` @ ${source}` : ''}`);
    });
    page.on('dialog', dialog => dialog.dismiss());
    await page.goto(`${BASE}/hvac-demo.html`); await page.waitForLoadState('domcontentloaded');
    await page.getByText('能耗分析', { exact: true }).click();

    for (const [id, label] of PAGES) {
      await page.getByText(label, { exact: true }).click();
      const frame = page.frameLocator('#fr');
      await frame.locator('body').waitFor();
      assert.match(await page.locator('#fr').getAttribute('src'), new RegExp(`${id}\\.html`), `${label} 路由错误`);
      assert.ok((await page.locator('#bc').textContent()).includes(label), `${label} 面包屑错误`);
      assert.equal(await frame.locator('#noMeterState').count(), 0, `${label} 默认项目不应显示无电表空态`);
      const overflow = await frame.locator('body').evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 2, `${label} 在 1920 宽度横向溢出 ${overflow}px`);
      if (['energy-overview', 'energy-trend', 'energy-group'].includes(id)) {
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(SHOT, `1920-${id}.png`), fullPage: true });
      }
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [id, label] of PAGES) {
      await page.getByText(label, { exact: true }).click();
      const frame = page.frameLocator('#fr'); await frame.locator('body').waitFor();
      const overflow = await frame.locator('body').evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 2, `${label} 在 1366 宽度横向溢出 ${overflow}px`);
      assert.ok(await frame.locator('body').evaluate(() => document.body.scrollHeight > 0), `${label} 页面为空`);
      if (id === 'energy-overview') { await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOT, '1366-energy-overview.png'), fullPage: true }); }
    }

    await page.getByText('集中控制', { exact: true }).click();
    await page.getByText('空调控制', { exact: true }).click();
    await page.frameLocator('#fr').locator('#grid').waitFor();
    assert.ok(await page.frameLocator('#fr').locator('.ac-card').count() > 0, '既有空调控制页面应正常加载');

    await page.locator('#projSel').selectOption({ label: '001' });
    assert.ok(!(await page.locator('#nav .lb').allTextContents()).includes('能耗分析'));
    await page.locator('#projSel').selectOption({ label: '产品部测试-按小时预付费' });
    assert.ok((await page.locator('#nav .lb').allTextContents()).includes('能耗分析'));

    assert.deepEqual(errors, [], `控制台错误: ${errors.join(' | ')}`);
    console.log('energy integrated browser verification passed');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
