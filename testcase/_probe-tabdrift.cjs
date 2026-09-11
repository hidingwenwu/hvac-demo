/* 临时探针 v4:完全复刻 verify 的前置步骤(铃铛开合)+700ms 等待+frameLocator 读取 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const PORT = 8809;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/hvac-demo.html';
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${PORT}/hvac-demo.html`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  /* 复刻铃铛开合 */
  await page.click('#alarmBell');
  await page.waitForSelector('#alarmPanel.show');
  await page.click('.hd-left');
  await page.waitForTimeout(150);
  /* 复刻 nav() */
  await page.evaluate(() => window.nav('alarm-detail', 'level=1&status=new'));
  await page.waitForFunction(() => document.getElementById('fr').src.includes('alarm-detail.html'));
  await page.waitForTimeout(700);
  try {
    const t = await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText({ timeout: 5000 });
    console.log('pg-total:', t);
  } catch (e) {
    console.log('pg-total 读取失败:', e.message.split('\n')[0]);
    const fr = page.frames().find(f => f.url.includes('alarm-detail'));
    console.log('frames:', page.frames().map(f => f.url()).join(' | '));
    if (fr) {
      const html = await fr.evaluate(() => ({
        hasPager: !!document.getElementById('opsPager'),
        pagerHtml: document.getElementById('opsPager')?.innerHTML?.slice(0, 200),
        readyState: document.readyState,
        tabOpsDisplay: document.getElementById('tabOps')?.style.display,
      }));
      console.log(JSON.stringify(html, null, 2));
    }
  }
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
