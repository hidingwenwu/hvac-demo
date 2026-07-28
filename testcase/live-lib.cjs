/* 现网采集库:登录/导航/截图 共用 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = 'http://test-m.achelp.cn';

async function newSession() {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(18000);
  return { browser, ctx, page };
}

async function login(page, user, pass) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await page.fill('input[name=userName]', user);
  await page.fill('input[name=password]', pass);
  await page.click('button:has-text("登"), .login-btn, [type=submit]');
  await page.waitForTimeout(5500);
  if (/login/.test(page.url())) throw new Error('login failed: ' + user);
  await dismissModals(page);
}

async function dismissModals(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('button,span')].filter(e => /已知晓|知道了/.test(e.textContent || '') && (e.textContent || '').length <= 6).forEach(b => b.click());
    document.querySelectorAll('.el-dialog__close,.el-message-box__close').forEach(x => x.click());
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/* 抓左侧菜单树:返回 [{group, items:[label]}] 以及每个可点项的 label 列表 */
async function getMenu(page) {
  // 展开所有分组
  await page.evaluate(() => {
    document.querySelectorAll('.el-submenu__title').forEach(t => { if (!t.parentElement.classList.contains('is-opened')) t.click(); });
  });
  await page.waitForTimeout(800);
  return await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.el-menu > li, .el-menu > div > li').forEach(li => {
      const title = li.querySelector('.el-submenu__title');
      if (title) {
        const items = [...li.querySelectorAll('.el-menu-item')].map(m => m.innerText.trim());
        out.push({ group: title.innerText.trim(), items });
      } else {
        const it = li.querySelector('.el-menu-item');
        if (it) out.push({ group: null, items: [it.innerText.trim()] });
      }
    });
    return out;
  });
}

/* 点击菜单项(自动展开父组) */
async function clickMenu(page, label) {
  await page.evaluate(() => {
    document.querySelectorAll('.el-submenu__title').forEach(t => { if (!t.parentElement.classList.contains('is-opened')) t.click(); });
  });
  await page.waitForTimeout(500);
  const ok = await page.evaluate((lb) => {
    const el = [...document.querySelectorAll('.el-menu-item')].find(m => m.innerText.trim() === lb);
    if (el) { el.click(); return true; }
    return false;
  }, label);
  await page.waitForTimeout(2500);
  await dismissModals(page);
  return ok;
}

/* 项目切换器:返回项目列表;切换指定项目 */
async function getProjects(page) {
  // 顶栏项目选择通常是 el-select
  const inp = page.locator('.fy-header input.el-input__inner, header input.el-input__inner, .header input.el-input__inner').first();
  if (!(await inp.count())) return [];
  await inp.click({ force: true });
  await page.waitForTimeout(900);
  const opts = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item', es => es.map(e => e.innerText.trim()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return opts;
}
async function switchProject(page, name) {
  const inp = page.locator('.fy-header input.el-input__inner, header input.el-input__inner, .header input.el-input__inner').first();
  if (!(await inp.count())) return false;
  await inp.click({ force: true });
  await page.waitForTimeout(900);
  const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: name }).first();
  if (!(await opt.count())) { await page.keyboard.press('Escape'); return false; }
  await opt.click({ force: true });
  await page.waitForTimeout(3000);
  await dismissModals(page);
  return true;
}

module.exports = { newSession, login, dismissModals, getMenu, clickMenu, getProjects, switchProject, BASE };
