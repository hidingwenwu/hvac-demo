// step7: 切换项目「天长政务中心」抓取风水联动;抓取 /guide 操作指引页
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, storageState: path.join(OUT, '_auth.json') });
const page = await ctx.newPage();

async function extract() {
  return page.evaluate(() => {
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
      headings: $('h1,h2,h3,h4,.title').map(txt).filter(Boolean).slice(0, 30),
    };
  });
}
async function save(slug) {
  await page.screenshot({ path: path.join(OUT, 'pages', slug + '.png'), fullPage: true });
  const dom = await page.evaluate(() => (document.querySelector('.app-main') || document.body).outerHTML);
  fs.writeFileSync(path.join(OUT, 'pages', slug + '.html'), dom);
  fs.writeFileSync(path.join(OUT, 'pages', slug + '.json'), JSON.stringify(await extract(), null, 2));
}

// 1) /guide 操作指引(独立路由,新标签页形态)
await page.goto('https://m.achelp.cn/guide', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);
console.log('guide URL:', page.url());
await save('guide-live');

// 2) 切换项目到 天长政务中心
await page.goto('https://m.achelp.cn', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const projInput = page.locator('.el-select .el-input__inner').first();
await projInput.click(); await page.waitForTimeout(600);
await projInput.fill('天长'); await page.waitForTimeout(1500);
await page.locator('.el-select-dropdown__item:visible', { hasText: '天长' }).first().click({ timeout: 8000 });
await page.waitForTimeout(4000);
console.log('已切换项目 天长政务中心');

// 3) 风水联动
await page.goto('https://m.achelp.cn/loadControl/geomancyLinkage/index', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(5000);
const fin = page.url().replace('https://m.achelp.cn', '');
console.log('strategy-wind:', fin.includes('largeScreen') ? 'STILL-REDIRECT' : 'OK', fin);
await save('strategy-wind.live3');

await browser.close();
console.log('DONE');
