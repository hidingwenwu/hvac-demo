// step7b: 天长政务中心项目下,通过菜单点击进入风水联动(避开直连路由守卫时序)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, storageState: path.join(OUT, '_auth.json') });
const page = await ctx.newPage();
await page.goto('https://m.achelp.cn', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
// 切项目
const projInput = page.locator('.el-select .el-input__inner').first();
await projInput.click(); await page.waitForTimeout(600);
await projInput.fill('天长政务'); await page.waitForTimeout(1500);
await page.locator('.el-select-dropdown__item:visible', { hasText: '政务中心' }).first().click({ timeout: 8000 });
await page.waitForTimeout(5000);
// 展开 节能策略
const grp = page.locator('.el-submenu__title', { hasText: '节能策略' }).first();
const cls = await grp.evaluate(el => el.parentElement.className).catch(() => '');
if (!/is-opened/.test(cls)) { await grp.click().catch(() => {}); await page.waitForTimeout(800); }
await page.screenshot({ path: path.join(OUT, '_tianchang-menu.png') });
// 点 风水联动
const item = page.locator('.el-menu-item', { hasText: '风水联动' });
console.log('菜单中风水联动项数量:', await item.count());
if (await item.count()) {
  await item.first().click();
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());
  await page.screenshot({ path: path.join(OUT, 'pages', 'strategy-wind.live3.png'), fullPage: true });
  const dom = await page.evaluate(() => (document.querySelector('.app-main') || document.body).outerHTML);
  fs.writeFileSync(path.join(OUT, 'pages', 'strategy-wind.live3.html'), dom);
  const ex = await page.evaluate(() => {
    const $ = (s, r = document) => [...r.querySelectorAll(s)];
    const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ');
    return {
      tables: $('.el-table').map(t => ({
        headers: $('.el-table__header th', t).map(txt).filter(Boolean),
        rows: $('.el-table__body tr', t).slice(0, 5).map(tr => $('td', tr).map(td => txt(td).slice(0, 60)))
      })),
      buttons: $('.el-button').map(txt).filter(Boolean).slice(0, 40),
      labels: $('.el-form-item__label, label').map(txt).filter(Boolean).slice(0, 40),
      inputs: $('.el-input__inner').map(i => ({ ph: i.placeholder || '', val: (i.value || '').slice(0, 40) })).slice(0, 30),
      tabs: $('.el-tabs__item, .el-radio-button__inner').map(txt).filter(Boolean),
      pagination: $('.el-pagination').map(txt),
    };
  });
  fs.writeFileSync(path.join(OUT, 'pages', 'strategy-wind.live3.json'), JSON.stringify(ex, null, 2));
  console.log('SAVED');
}
await browser.close();
