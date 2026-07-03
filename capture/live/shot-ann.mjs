// 验证壳跑马灯新位置:注入 announcement_config 后截图
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  localStorage.setItem('announcement_config', JSON.stringify({
    enabled: true, type: 'feature', title: '新计费功能上线公告',
    body: '新计费功能模块已上线,支持租户余额、用电量统计与分摊异常处理,欢迎体验。',
    startDate: '2026-07-01', endDate: '2026-12-31'
  }));
});
await page.goto('http://localhost:8801/hvac-demo.html', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '_shell-ann.png'), clip: { x: 0, y: 0, width: 1920, height: 220 } });
console.log('saved _shell-ann.png');
await browser.close();
