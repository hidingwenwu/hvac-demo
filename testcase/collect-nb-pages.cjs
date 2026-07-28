/* 采集5:关键项目下的新计费功能页 + 计费数据页 */
const { newSession, login, clickMenu, dismissModals } = require('./live-lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'live-full', 'pages-nb');
fs.mkdirSync(OUT, { recursive: true });

async function switchProject(page, name) {
  await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span,div,label')].filter(e => /当前查看项目/.test(e.textContent || '') && (e.textContent || '').length < 20);
    const host = spans[0].closest('div');
    const sel = host.querySelector('.el-select') || host.parentElement.querySelector('.el-select');
    sel.click();
  });
  await page.waitForTimeout(1200);
  const filterInp = page.locator('.el-select-dropdown:visible input.el-input__inner').first();
  if (await filterInp.count()) { await filterInp.fill(name); await page.waitForTimeout(900); }
  const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: name }).first();
  if (!(await opt.count())) { await page.keyboard.press('Escape'); return false; }
  await opt.click({ force: true });
  await page.waitForTimeout(4000);
  await dismissModals(page);
  return true;
}

(async () => {
  const { browser, page } = await newSession();
  const NB = ['租户管理', '电费查询', '用电量统计', '分摊异常处理', '异常处理操作记录', '异常查询', '当量数据查询'];
  const urls = {};
  try {
    await login(page, 'dingwenwu', process.env.HVAC_LIVE_PASS||'');
    /* 第一轮:平台测试_新计费 → 新计费7页 */
    await switchProject(page, '平台测试_新计费');
    for (const label of NB) {
      const ok = await clickMenu(page, label);
      const url = page.url();
      console.log(`[新计费] ${label} ok=${ok} -> ${url}`);
      if (ok) {
        urls[label] = url;
        await page.waitForTimeout(1800);
        await page.screenshot({ path: path.join(OUT, `nb-${label}.png`) });
        fs.writeFileSync(path.join(OUT, `nb-${label}.html`), await page.content());
      }
    }
    /* 第二轮:数据项目 → 关键计费页(电费查询/租户管理/日使用情况/异常每日盘点) */
    const DATA_PAGES = ['电费查询', '日使用情况', '异常每日盘点'];
    for (const proj of ['二次分摊-H', '分摊计费-ly', '平台测试_后付费', '产品部测试-按小时预付费']) {
      const ok = await switchProject(page, proj);
      if (!ok) { console.log('switch fail:', proj); continue; }
      for (const label of DATA_PAGES) {
        const url = urls[label];
        if (url) { await page.goto(url, { waitUntil: 'domcontentloaded' }); }
        else { await clickMenu(page, label); }
        await page.waitForTimeout(2500);
        await dismissModals(page);
        const slug = `${proj}-${label}`.replace(/[\\/:*?"<>|]/g, '_');
        await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
        console.log(`[${proj}] ${label} -> ${page.url()}`);
      }
    }
    console.log('DONE');
  } catch (e) {
    console.error('FAIL:', e.message);
    await page.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => { });
  } finally {
    await browser.close();
  }
})();
