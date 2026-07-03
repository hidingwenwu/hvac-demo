// step6: 切换项目后补抓 4 个被重定向的页面
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TARGETS = [['/loadControl/geomancyLinkage/index','strategy-wind']];
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, storageState: path.join(OUT, '_auth.json') });
const page = await ctx.newPage();
await page.goto('https://m.achelp.cn', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
// 切换项目
const projInput = page.locator('.el-select .el-input__inner').first();
await projInput.click(); await page.waitForTimeout(600);
await projInput.fill('平台产品测试'); await page.waitForTimeout(1500);
try { await page.locator('.el-select-dropdown__item:visible', { hasText: '平台产品测试' }).first().click({ timeout: 6000 }); }
catch { await projInput.fill('平台产品测试'); await page.waitForTimeout(1500); await page.locator('.el-select-dropdown__item:visible', { hasText: '平台产品测试' }).first().click({ timeout: 6000 }); }
await page.waitForTimeout(4000);
console.log('项目已切换');

for (const [route, slug] of TARGETS) {
  try {
    await page.goto('https://m.achelp.cn' + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(4500);
    const fin = page.url().replace('https://m.achelp.cn', '');
    const ok = !fin.includes('largeScreen');
    await page.screenshot({ path: path.join(OUT, 'pages', slug + '.live2.png') });
    const dom = await page.evaluate(() => (document.querySelector('.app-main') || document.body).outerHTML);
    fs.writeFileSync(path.join(OUT, 'pages', slug + '.live2.html'), dom);
    const ex = await page.evaluate(() => {
      const $ = (s, r = document) => [...r.querySelectorAll(s)];
      const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ');
      return {
        tables: $('.el-table').map(t => ({
          headers: $('.el-table__header th', t).map(txt).filter(Boolean),
          rows: $('.el-table__body tr', t).slice(0, 3).map(tr => $('td', tr).map(td => txt(td).slice(0, 60)))
        })),
        buttons: $('.el-button').map(txt).filter(Boolean).slice(0, 40),
        labels: $('.el-form-item__label, label').map(txt).filter(Boolean).slice(0, 40),
        inputs: $('.el-input__inner').map(i => ({ ph: i.placeholder || '', val: (i.value || '').slice(0, 40) })).slice(0, 30),
        tabs: $('.el-tabs__item, .el-radio-button__inner').map(txt).filter(Boolean),
        pagination: $('.el-pagination').map(txt),
      };
    });
    fs.writeFileSync(path.join(OUT, 'pages', slug + '.live2.json'), JSON.stringify(ex, null, 2));
    console.log(ok ? 'OK  ' : 'STILL-REDIRECT', slug, fin);
  } catch (e) { console.log('FAIL', slug, String(e).slice(0, 100)); }
}
await browser.close();
