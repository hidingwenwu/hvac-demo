// step2: 展开侧栏所有分组,导出真实菜单树(名称/层级/路由)
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
console.log('URL:', page.url());

// 反复点击所有未展开的 submenu 标题,直到没有新增
for (let round = 0; round < 5; round++) {
  const titles = page.locator('.el-submenu__title, .el-sub-menu__title');
  const n = await titles.count();
  let clicked = 0;
  for (let i = 0; i < n; i++) {
    const t = titles.nth(i);
    const parentCls = await t.evaluate(el => el.parentElement.className);
    if (!/is-opened/.test(parentCls)) {
      await t.click().catch(() => {});
      await page.waitForTimeout(400);
      clicked++;
    }
  }
  console.log(`round ${round}: clicked ${clicked}`);
  if (!clicked) break;
}
await page.waitForTimeout(1000);

// 导出菜单 DOM 结构
const menu = await page.evaluate(() => {
  function walk(el) {
    const out = [];
    for (const li of el.querySelectorAll(':scope > li')) {
      if (li.classList.contains('el-submenu') || li.classList.contains('el-sub-menu')) {
        const title = li.querySelector(':scope > .el-submenu__title, :scope > .el-sub-menu__title');
        const childUl = li.querySelector(':scope > .el-menu, :scope > div > .el-menu, :scope > ul');
        out.push({
          type: 'group',
          label: title ? title.textContent.trim() : '?',
          children: childUl ? walk(childUl) : []
        });
      } else if (li.classList.contains('el-menu-item')) {
        out.push({ type: 'item', label: li.textContent.trim(), index: li.getAttribute('data-index') || li.getAttribute('index') || '' });
      }
    }
    return out;
  }
  const root = document.querySelector('.el-menu');
  return root ? walk(root) : null;
});
fs.writeFileSync(path.join(OUT, 'menu.json'), JSON.stringify(menu, null, 2));
console.log(JSON.stringify(menu, null, 1));

// 保存展开后的侧栏截图和整个 sidebar HTML
await page.screenshot({ path: path.join(OUT, '_menu-expanded.png') });
const sidebarHtml = await page.evaluate(() => {
  const sb = document.querySelector('.sidebar-container, .el-aside, aside') || document.querySelector('.el-menu')?.closest('div');
  return sb ? sb.outerHTML : 'NOT FOUND';
});
fs.writeFileSync(path.join(OUT, '_sidebar.html'), sidebarHtml);

// 点击每个叶子菜单项,记录跳转后的 URL(即路由映射)
const items = page.locator('.el-menu-item');
const count = await items.count();
const routes = [];
for (let i = 0; i < count; i++) {
  const label = (await items.nth(i).textContent()).trim();
  try {
    await items.nth(i).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    routes.push({ label, url: page.url() });
    console.log(label, '->', page.url());
  } catch (e) {
    routes.push({ label, url: 'CLICK_FAIL' });
    console.log(label, '-> CLICK_FAIL');
  }
}
fs.writeFileSync(path.join(OUT, 'routes.json'), JSON.stringify(routes, null, 2));
await browser.close();
console.log('DONE');
