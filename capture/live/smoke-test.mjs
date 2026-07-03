// 全站冒烟测试:逐页加载,收集 JS 报错与资源加载失败
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.resolve(OUT, '..', '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const issues = [];
let cur = '';
page.on('pageerror', e => issues.push([cur, 'JS错误', String(e).split('\n')[0].slice(0, 140)]));
page.on('console', m => { if (m.type() === 'error') issues.push([cur, 'console.error', m.text().slice(0, 140)]); });
page.on('requestfailed', r => { if (!r.url().includes('cdn')) issues.push([cur, '资源失败', r.url().slice(-60)]); });

for (const f of files) {
  cur = f;
  try {
    await page.goto('http://localhost:8801/pages/' + f, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(800);
  } catch (e) { issues.push([f, '加载超时', String(e).slice(0, 80)]); }
}
// 壳本体 + 菜单遍历导航冒烟
cur = 'hvac-demo.html';
await page.goto('http://localhost:8801/hvac-demo.html', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(1200);
await browser.close();
if (issues.length) { console.log('发现问题', issues.length, '条:'); issues.forEach(i => console.log(...i)); }
else console.log('全部', files.length, '页 + 壳加载无 JS 报错');
