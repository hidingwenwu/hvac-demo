/* 采集1:两账号 菜单树 + 项目列表 */
const { newSession, login, getMenu, getProjects, dismissModals } = require('./live-lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'live-full');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  for (const [user, label] of [['chanpintest1', 'u1-chanpin'], ['dingwenwu', 'u2-dingwenwu']]) {
    const { browser, page } = await newSession();
    try {
      await login(page, user, process.env.HVAC_LIVE_PASS||'');
      await dismissModals(page);
      console.log(`[${label}] logged in:`, page.url(), '|', await page.title());
      await page.screenshot({ path: path.join(OUT, `${label}-home.png`) });
      const menu = await getMenu(page);
      fs.writeFileSync(path.join(OUT, `${label}-menu.json`), JSON.stringify(menu, null, 1));
      console.log(`[${label}] menu groups:`, menu.map(g => (g.group || '*') + '(' + g.items.length + ')').join(' '));
      const projects = await getProjects(page);
      fs.writeFileSync(path.join(OUT, `${label}-projects.json`), JSON.stringify(projects, null, 1));
      console.log(`[${label}] projects(${projects.length}):`, projects.slice(0, 20).join(' | '));
    } catch (e) {
      console.error(`[${label}] FAIL:`, e.message);
      await page.screenshot({ path: path.join(OUT, `${label}-error.png`) }).catch(() => { });
    } finally {
      await browser.close();
    }
  }
})();
