// step1: 登录 m.achelp.cn,保存会话与登录后首屏信息
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

console.log('打开登录页...');
await page.goto('https://m.achelp.cn', { waitUntil: 'networkidle', timeout: 60000 });
await page.screenshot({ path: OUT + '_login-page.png' });

// 打印登录页可见的输入框与按钮,便于判断选择器
const inputs = await page.$$eval('input', els => els.map(e => ({
  type: e.type, placeholder: e.placeholder, name: e.name, id: e.id, cls: e.className.slice(0, 80)
})));
const buttons = await page.$$eval('button, .el-button', els => els.map(e => ({
  text: e.textContent.trim().slice(0, 30), cls: e.className.slice(0, 80)
})));
console.log('INPUTS:', JSON.stringify(inputs, null, 1));
console.log('BUTTONS:', JSON.stringify(buttons, null, 1));

// 尝试通用登录:第一个文本框填账号,密码框填密码
const user = page.locator('input[type="text"], input:not([type])').first();
const pass = page.locator('input[type="password"]').first();
await user.fill('dingwenwu');
await pass.fill('ding2026');
await page.screenshot({ path: OUT + '_login-filled.png' });

// 找登录按钮
const loginBtn = page.locator('button:has-text("登录"), button:has-text("登 录"), .el-button:has-text("登")').first();
await loginBtn.click();
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(5000);
await page.screenshot({ path: OUT + '_after-login.png', fullPage: false });
console.log('URL after login:', page.url());

await ctx.storageState({ path: OUT + '_auth.json' });
fs.writeFileSync(OUT + '_after-login.html', await page.content());
await browser.close();
console.log('DONE');
