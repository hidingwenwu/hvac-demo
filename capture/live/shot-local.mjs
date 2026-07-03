// 本地原型截图工具: node shot-local.mjs <path或页面id> [输出名] [--click 选择器]
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] || 'hvac-demo.html';
const name = process.argv[3] || '_local';
const url = arg.startsWith('http') ? arg : 'http://localhost:8801/' + arg;
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
const ci = process.argv.indexOf('--click');
if (ci > -1) { await page.click(process.argv[ci + 1]).catch(e => console.log('click fail', e.message)); await page.waitForTimeout(1200); }
await page.screenshot({ path: path.join(OUT, name + '.png') });
console.log('saved', name + '.png');
await browser.close();
