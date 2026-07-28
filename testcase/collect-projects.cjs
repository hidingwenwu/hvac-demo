/* 采集2:dingwenwu 项目列表 + 各项目下菜单差异 */
const { newSession, login, getMenu, dismissModals } = require('./live-lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'live-full');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page } = await newSession();
  try {
    await login(page, 'dingwenwu', process.env.HVAC_LIVE_PASS||'');
    // 探测项目选择器 DOM
    const selInfo = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span,div,label')].filter(e => /当前查看项目/.test(e.textContent || '') && (e.textContent || '').length < 20);
      if (!spans.length) return null;
      const host = spans[0].parentElement;
      return { html: host.outerHTML.slice(0, 800) };
    });
    console.log('selector DOM:', selInfo ? selInfo.html : 'not found');

    // 点击项目选择器(找其后的 el-select)
    const opened = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span,div,label')].filter(e => /当前查看项目/.test(e.textContent || '') && (e.textContent || '').length < 20);
      if (!spans.length) return false;
      const host = spans[0].closest('div');
      const sel = host.querySelector('.el-select') || host.parentElement.querySelector('.el-select');
      if (!sel) return false;
      sel.click();
      return true;
    });
    await page.waitForTimeout(1200);
    const opts = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item', es => es.map(e => e.innerText.trim()));
    console.log('projects(' + opts.length + '):');
    opts.forEach(o => console.log('  -', o));
    fs.writeFileSync(path.join(OUT, 'u2-projects.json'), JSON.stringify(opts, null, 1));
    await page.keyboard.press('Escape');
  } catch (e) {
    console.error('FAIL:', e.message);
    await page.screenshot({ path: path.join(OUT, 'proj-error.png') }).catch(() => { });
  } finally {
    await browser.close();
  }
})();
