/* 采集4:大屏页 + 关键项目切换后的菜单/计费页(新计费/分摊/预付费/后付费) */
const { newSession, login, getMenu, clickMenu, dismissModals } = require('./live-lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'live-full');
fs.mkdirSync(OUT, { recursive: true });

async function switchProject(page, name) {
  await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span,div,label')].filter(e => /当前查看项目/.test(e.textContent || '') && (e.textContent || '').length < 20);
    const host = spans[0].closest('div');
    const sel = host.querySelector('.el-select') || host.parentElement.querySelector('.el-select');
    sel.click();
  });
  await page.waitForTimeout(1200);
  // 项目多,先过滤输入
  const filterInp = page.locator('.el-select-dropdown:visible input.el-input__inner').first();
  if (await filterInp.count()) { await filterInp.fill(name); await page.waitForTimeout(900); }
  const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: name }).first();
  if (!(await opt.count())) { console.log('  project not found:', name); await page.keyboard.press('Escape'); return false; }
  await opt.click({ force: true });
  await page.waitForTimeout(4000);
  await dismissModals(page);
  return true;
}

(async () => {
  const { browser, page } = await newSession();
  try {
    await login(page, 'dingwenwu', process.env.HVAC_LIVE_PASS||'');
    // 1) 两个大屏:菜单里点文本
    for (const name of ['项目总览大屏', '综合监控大屏']) {
      const ok = await page.evaluate((lb) => {
        const el = [...document.querySelectorAll('.el-menu *, .el-menu-item, li, span')].find(m => (m.innerText || '').trim() === lb);
        if (el) { el.click(); return true; } return false;
      }, name);
      await page.waitForTimeout(3500);
      console.log(`大屏 ${name}: ok=${ok} url=${page.url()}`);
      await page.screenshot({ path: path.join(OUT, `pages-u2/${name}.png`) });
      fs.writeFileSync(path.join(OUT, `pages-u2/${name}.html`), await page.content());
    }
    // 2) 关键项目:切项目后记录菜单(尤其新计费),并抓计费页
    const projects = ['平台测试_新计费', '二次分摊-H', '分摊计费-ly', '产品部测试-按小时预付费', '平台测试_后付费'];
    for (const proj of projects) {
      const ok = await switchProject(page, proj);
      console.log(`\n== ${proj}: switched=${ok}`);
      if (!ok) continue;
      const menu = await getMenu(page);
      const flat = menu.map(g => (g.group || '*') + ':' + g.items.join(',')).join('  ');
      console.log('  menu:', flat.slice(0, 400));
      fs.writeFileSync(path.join(OUT, `menu-${proj}.json`), JSON.stringify(menu, null, 1));
      await page.screenshot({ path: path.join(OUT, `home-${proj}.png`) });
    }
    console.log('DONE');
  } catch (e) {
    console.error('FAIL:', e.message);
    await page.screenshot({ path: path.join(OUT, 'collect4-error.png') }).catch(() => { });
  } finally {
    await browser.close();
  }
})();
