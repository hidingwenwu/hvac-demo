/* 补采:hrjn 下发配置弹窗中「空调类型」下拉的候选项(只展开记录,不下发) */
const { newSession, login, dismissModals } = require('./live-lib.cjs');
const CRED = { user: process.env.FY_USER || 'dingwenwu', pass: process.env.FY_PASS || '' };
if (!CRED.pass) { console.error('缺少 FY_PASS'); process.exit(1); }

(async () => {
  const { browser, page } = await newSession();
  try {
    await login(page, CRED.user, CRED.pass);
    const inp = page.locator('.el-select input.el-input__inner').first();
    await inp.click({ force: true }); await page.waitForTimeout(800);
    await page.locator('.el-select-dropdown__item:visible', { hasText: '平台测试_分体机' }).first().click({ force: true });
    await page.waitForTimeout(3000); await dismissModals(page);
    await page.evaluate(() => { document.querySelectorAll('.el-submenu__title').forEach(t => { if (!t.parentElement.classList.contains('is-opened')) t.click(); }); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const el = [...document.querySelectorAll('.el-menu-item')].find(m => m.innerText.includes('控制器管理')); el && el.click(); });
    await page.waitForTimeout(2800); await dismissModals(page);
    // 勾选 hrjn 卡片
    await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('input[type=checkbox]')];
      for (const b of boxes) {
        let el = b;
        for (let d = 0; d < 8 && el; d++) { el = el.parentElement; if (!el) break;
          const t = el.innerText || '';
          if (/型号/.test(t) && t.length < 900) { if (t.includes('hrjn') && !b.checked) { b.click(); return; } break; } }
      }
    });
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: '下发配置' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    // 展开弹窗内「空调类型」下拉
    await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null);
      const sel = d && d.querySelector('.el-select input.el-input__inner');
      sel && sel.click();
    });
    await page.waitForTimeout(1000);
    const opts = await page.$$eval('.el-select-dropdown__item', es =>
      es.filter(e => e.offsetParent !== null).map(e => e.innerText.trim()));
    console.log('空调类型选项:', JSON.stringify(opts));
    await page.screenshot({ path: require('path').join(__dirname, 'live-controller', 'dlg-hrjn-type.png') });
    await page.keyboard.press('Escape');
    // 关闭弹窗(取消)
    await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')].find(w => w.offsetParent !== null);
      const c = d && [...d.querySelectorAll('button')].find(b => /取\s*消/.test(b.innerText));
      c && c.click();
    });
    await page.waitForTimeout(500);
  } catch (e) { console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await browser.close(); }
})();
