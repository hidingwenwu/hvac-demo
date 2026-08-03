/* 采集测试环境「平台测试_分体机」项目控制器管理页的真实交互
   安全约束:只打开「下发配置」弹窗做记录,一律取消/关闭,绝不点击确认下发 */
const { newSession, login, dismissModals, getMenu, switchProject } = require('./live-lib.cjs');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'live-controller');
fs.mkdirSync(OUT, { recursive: true });
const report = { steps: [] };
const log = (m, extra) => { console.log('•', m); report.steps.push({ m, ...(extra ? { extra } : {}) }); };

/* 登录凭据经环境变量传入,脚本文件内不保存明文 */
const CRED = { user: process.env.FY_USER || 'dingwenwu', pass: process.env.FY_PASS || '' };
if (!CRED.pass) { console.error('缺少 FY_PASS 环境变量'); process.exit(1); }

async function fuzzyClickMenu(page, kw) {
  await page.evaluate(() => {
    document.querySelectorAll('.el-submenu__title').forEach(t => { if (!t.parentElement.classList.contains('is-opened')) t.click(); });
  });
  await page.waitForTimeout(600);
  const ok = await page.evaluate((k) => {
    const el = [...document.querySelectorAll('.el-menu-item')].find(m => m.innerText.trim().includes(k));
    if (el) { el.click(); return true; }
    return false;
  }, kw);
  await page.waitForTimeout(2800);
  await dismissModals(page);
  return ok;
}

/* 页面卡片结构转储:每张卡片的整体文本 + 是否有勾选框 */
async function dumpCards(page) {
  return await page.evaluate(() => {
    // 卡片容器启发式:含勾选框且文本含「型号」的最小重复块
    const boxes = [...document.querySelectorAll('input[type=checkbox]')];
    const cards = [];
    const seen = new Set();
    boxes.forEach(b => {
      let el = b;
      for (let d = 0; d < 8 && el; d++) {
        el = el.parentElement;
        if (!el) break;
        const t = el.innerText || '';
        if (/型号/.test(t) && t.length < 900) {
          if (!seen.has(el)) { seen.add(el); cards.push(t.replace(/\n+/g, ' | ').slice(0, 600)); }
          break;
        }
      }
    });
    return cards;
  });
}

async function toolbarButtons(page) {
  return await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(t => t && t.length <= 12)
  );
}

/* 勾选第一张文本含 kw 的卡片;返回是否成功 */
async function checkCardByModel(page, kw) {
  return await page.evaluate((k) => {
    const boxes = [...document.querySelectorAll('input[type=checkbox]')];
    for (const b of boxes) {
      let el = b;
      for (let d = 0; d < 8 && el; d++) {
        el = el.parentElement;
        if (!el) break;
        const t = el.innerText || '';
        if (/型号/.test(t) && t.length < 900) {
          if (t.includes(k) && !b.checked) { b.click(); return true; }
          break;
        }
      }
    }
    return false;
  }, kw);
}

async function uncheckAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('input[type=checkbox]').forEach(b => { if (b.checked) b.click(); });
  });
  await page.waitForTimeout(400);
}

/* 点击「下发配置」,记录弹窗或提示,然后关闭(绝不确认) */
async function probeDispatch(page, tag) {
  const btn = page.locator('button', { hasText: '下发配置' }).first();
  if (!(await btn.count())) { log(`[${tag}] 页面无「下发配置」按钮`); return; }
  const disabled = await btn.evaluate(b => b.disabled || b.classList.contains('is-disabled'));
  log(`[${tag}] 下发配置按钮 disabled=${disabled}`);
  await btn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1600);
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog__wrapper')].find(w => w.style.display !== 'none' && w.offsetParent !== null);
    if (!d) return null;
    const body = d.querySelector('.el-dialog');
    const inputs = [...body.querySelectorAll('input,select,textarea')].map(i => ({
      tag: i.tagName, type: i.type || '', placeholder: i.placeholder || '', value: i.value || '',
      cls: (i.className || '').slice(0, 60)
    }));
    return { text: body.innerText.replace(/\n+/g, ' | ').slice(0, 1500), inputs };
  });
  const toast = await page.evaluate(() => {
    const t = document.querySelector('.el-message');
    return t ? t.innerText.trim() : null;
  });
  if (dlg) log(`[${tag}] 弹窗内容`, dlg);
  if (toast) log(`[${tag}] 提示消息: ${toast}`);
  await page.screenshot({ path: path.join(OUT, `dlg-${tag}.png`), fullPage: false });
  // 关闭弹窗:优先「取消/关闭」按钮,再点 X,再 Escape —— 不点确认
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog__wrapper')].find(w => w.offsetParent !== null);
    if (!d) return;
    const cancel = [...d.querySelectorAll('button')].find(b => /取\s*消|关\s*闭/.test(b.innerText));
    if (cancel) { cancel.click(); return; }
    const x = d.querySelector('.el-dialog__headerbtn,.el-dialog__close');
    if (x) x.click();
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}

(async () => {
  const { browser, page } = await newSession();
  try {
    await login(page, CRED.user, CRED.pass);
    log('登录成功');

    // 顶栏「当前查看项目为」右侧的 el-select
    async function pickProject(kw) {
      const inp = page.locator('.el-select input.el-input__inner').first();
      if (!(await inp.count())) return 'no-input';
      await inp.click({ force: true });
      await page.waitForTimeout(900);
      try { await inp.fill(kw); await page.waitForTimeout(900); } catch (e) {}
      const opts = await page.$$eval('.el-select-dropdown__item', es =>
        es.filter(e => e.offsetParent !== null).map(e => e.innerText.trim()));
      log('下拉候选项目', opts.slice(0, 30));
      const opt = page.locator('.el-select-dropdown__item:visible', { hasText: kw }).first();
      if (!(await opt.count())) { await page.keyboard.press('Escape'); return 'no-option'; }
      await opt.click({ force: true });
      await page.waitForTimeout(3500);
      await dismissModals(page);
      return 'ok';
    }
    const sw = await pickProject('平台测试_分体机');
    log(`切换项目 平台测试_分体机: ${sw}`);

    const m = await fuzzyClickMenu(page, '控制器管理');
    log(`进入控制器管理菜单: ${m}`);
    if (!m) { const menu = await getMenu(page); log('未找到菜单,全部菜单', menu); }

    await page.screenshot({ path: path.join(OUT, '01-page.png'), fullPage: true });
    const btns = await toolbarButtons(page);
    log('页面按钮清单', btns);
    const cards = await dumpCards(page);
    log(`卡片数量 ${cards.length}`, cards.slice(0, 12));
    fs.writeFileSync(path.join(OUT, 'cards.json'), JSON.stringify(cards, null, 2), 'utf8');

    // 依次探测各型号的下发配置弹窗
    for (const kw of ['oc', 'dbx', 'hrjn', 'FD01G']) {
      await uncheckAll(page);
      const hit = await checkCardByModel(page, kw);
      log(`勾选 ${kw} 卡片: ${hit}`);
      if (!hit) continue;
      await page.waitForTimeout(400);
      await probeDispatch(page, kw);
    }

    // 混选两种第三方型号,看平台如何约束
    await uncheckAll(page);
    const a = await checkCardByModel(page, 'oc');
    const b = await checkCardByModel(page, 'dbx');
    log(`混选 oc+dbx: ${a} ${b}`);
    if (a && b) await probeDispatch(page, 'mixed-oc-dbx');

    await uncheckAll(page);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    log('完成');
  } catch (e) {
    console.error('ERROR:', e.message);
    await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
