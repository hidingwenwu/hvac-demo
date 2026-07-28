/* 采集3:dingwenwu 全页面截图+HTML+URL manifest */
const { newSession, login, getMenu, clickMenu, dismissModals } = require('./live-lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'live-full', 'pages-u2');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page } = await newSession();
  const manifest = [];
  try {
    await login(page, 'dingwenwu', process.env.HVAC_LIVE_PASS||'');
    const menu = await getMenu(page);
    // 顶部直链(大屏等)先单独抓
    const topItems = await page.evaluate(() =>
      [...document.querySelectorAll('.el-menu > .el-menu-item, .el-menu > li:not(.el-submenu) .el-menu-item, .el-menu > li.el-menu-item')]
        .map(m => m.innerText.trim()).filter(Boolean));
    console.log('top items:', JSON.stringify(topItems));
    const all = [];
    topItems.forEach(t => all.push({ group: null, label: t }));
    menu.forEach(g => g.items.forEach(i => all.push({ group: g.group, label: i })));
    // 去重(记录查询/分摊规则设置为嵌套子组,其项与电费相关平铺项重复)
    const seen = new Set();
    const list = all.filter(x => { const k = x.label; if (seen.has(k)) return false; seen.add(k); return true; });
    console.log('pages to capture:', list.length);

    for (const it of list) {
      const ok = await clickMenu(page, it.label);
      const url = page.url();
      const slug = it.label.replace(/[\\/:*?"<>|]/g, '_');
      manifest.push({ group: it.group, label: it.label, ok, url });
      console.log(`${ok ? 'OK ' : 'MISS'} ${(it.group || '-')}/${it.label} -> ${url}`);
      if (ok) {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
        fs.writeFileSync(path.join(OUT, `${slug}.html`), await page.content());
      }
    }
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
    console.log('DONE');
  } catch (e) {
    console.error('FAIL:', e.message);
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  } finally {
    await browser.close();
  }
})();
