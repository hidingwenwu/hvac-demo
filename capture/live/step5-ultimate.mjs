// step5: 切换项目到「青岛飞奕科技」,抓取 极致节能 页面
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

// 打开右上角项目选择器,搜索并选择目标项目
const projInput = page.locator('.el-select .el-input__inner').first();
await projInput.click();
await page.waitForTimeout(800);
// Element select 可输入过滤
await projInput.fill('青岛飞奕');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '_proj-dropdown.png') });
const opt = page.locator('.el-select-dropdown__item:visible', { hasText: '青岛飞奕' }).first();
try {
  await opt.click({ timeout: 8000 });
} catch {
  // 尝试第二个项目
  await projInput.fill('平台产品测试');
  await page.waitForTimeout(1500);
  await page.locator('.el-select-dropdown__item:visible', { hasText: '平台产品测试' }).first().click({ timeout: 8000 });
}
await page.waitForTimeout(4000);
console.log('切换后 URL:', page.url());

// 展开 节能策略 分组,寻找 极致节能
for (let round = 0; round < 3; round++) {
  const titles = page.locator('.el-submenu__title', { hasText: '节能策略' });
  if (await titles.count()) {
    const cls = await titles.first().evaluate(el => el.parentElement.className);
    if (!/is-opened/.test(cls)) { await titles.first().click().catch(() => {}); await page.waitForTimeout(600); }
    break;
  }
}
await page.screenshot({ path: path.join(OUT, '_after-switch.png') });

const item = page.locator('.el-menu-item', { hasText: '极致节能' });
if (await item.count()) {
  await item.first().click();
  await page.waitForTimeout(5000);
  console.log('极致节能 URL:', page.url());
  await page.screenshot({ path: path.join(OUT, 'pages', 'strategy-ultimate.png') });
  const dom = await page.evaluate(() => (document.querySelector('.app-main') || document.body).outerHTML);
  fs.writeFileSync(path.join(OUT, 'pages', 'strategy-ultimate.html'), dom);
  const ex = await page.evaluate(() => {
    const $ = (s, r = document) => [...r.querySelectorAll(s)];
    const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ');
    return {
      tables: $('.el-table').map(t => ({
        headers: $('.el-table__header th', t).map(txt).filter(Boolean),
        rows: $('.el-table__body tr', t).slice(0, 3).map(tr => $('td', tr).map(td => txt(td).slice(0, 60)))
      })),
      buttons: $('.el-button').map(b => txt(b)).filter(Boolean),
      labels: $('.el-form-item__label, label').map(txt).filter(Boolean),
      inputs: $('.el-input__inner').map(i => ({ ph: i.placeholder || '', val: (i.value || '').slice(0, 40) })),
      tabs: $('.el-tabs__item, .el-radio-button__inner').map(txt).filter(Boolean),
      pagination: $('.el-pagination').map(txt),
    };
  });
  fs.writeFileSync(path.join(OUT, 'pages', 'strategy-ultimate.json'), JSON.stringify(ex, null, 2));
  console.log('已保存 strategy-ultimate 三件套');
} else {
  console.log('未找到 极致节能 菜单项');
  const menuText = await page.evaluate(() => document.querySelector('.el-menu')?.textContent || 'NO MENU');
  console.log('当前菜单:', menuText.replace(/\s+/g, ' ').slice(0, 500));
}
await browser.close();
