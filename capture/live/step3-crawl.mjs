// step3: 遍历全部菜单路由,每页保存 截图/DOM/结构化提取;首页额外抓样式 tokens
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(OUT, 'pages');
fs.mkdirSync(PAGES, { recursive: true });

const menu = JSON.parse(fs.readFileSync(path.join(OUT, 'menu.json'), 'utf8'));
const flat = [];
(function walk(nodes) {
  for (const n of nodes) {
    if (n.type === 'item') flat.push(n);
    if (n.children) walk(n.children);
  }
})(menu);

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, storageState: path.join(OUT, '_auth.json') });
const page = await ctx.newPage();

async function extract() {
  return page.evaluate(() => {
    const $ = (s, r = document) => [...r.querySelectorAll(s)];
    const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ');
    // 所有表格的列头与前3行
    const tables = $('.el-table').map(t => ({
      headers: $('.el-table__header th', t).map(th => txt(th)).filter(Boolean),
      rows: $('.el-table__body tr', t).slice(0, 3).map(tr => $('td', tr).map(td => txt(td).slice(0, 60)))
    }));
    // 按钮
    const buttons = $('button.el-button, .el-button').map(b => ({ text: txt(b).slice(0, 30), cls: (b.className.match(/el-button--\w+/) || [''])[0] })).filter(b => b.text);
    // 表单控件
    const inputs = $('.el-input__inner, .el-textarea__inner').map(i => ({ ph: i.placeholder || '', val: (i.value || '').slice(0, 40) }));
    // 表单 label
    const labels = $('.el-form-item__label, .search-label, label').map(txt).filter(Boolean);
    // 标签页
    const tabs = $('.el-tabs__item, .el-radio-button__inner').map(txt).filter(Boolean);
    // 分页
    const pagination = $('.el-pagination').map(txt);
    // 面包屑
    const breadcrumb = $('.el-breadcrumb__item, .el-breadcrumb__inner').map(txt).filter(Boolean);
    // 统计卡/信息卡标题
    const cardTitles = $('.card-title, .title, h3, h4, .el-card__header').map(txt).filter(t => t && t.length < 30).slice(0, 40);
    return { breadcrumb, tabs, labels, inputs, buttons, tables, pagination, cardTitles };
  });
}

// 全局样式 tokens(只跑一次)
async function tokens() {
  return page.evaluate(() => {
    const pick = (el, props) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
    };
    const P = ['background-color', 'color', 'border-color', 'border-radius', 'font-size', 'font-family', 'height', 'padding', 'border', 'box-shadow'];
    return {
      body: pick(document.body, P),
      sidebar: pick(document.querySelector('.sidebar-container'), P),
      sidebarItem: pick(document.querySelector('.el-menu-item'), P),
      sidebarItemActive: pick(document.querySelector('.el-menu-item.is-active'), P),
      submenuTitle: pick(document.querySelector('.el-submenu__title'), P),
      navbar: pick(document.querySelector('.navbar, .fixed-header, header'), P),
      breadcrumb: pick(document.querySelector('.el-breadcrumb'), P),
      mainContainer: pick(document.querySelector('.main-container'), P),
      appMain: pick(document.querySelector('.app-main'), P),
      btnPrimary: pick(document.querySelector('.el-button--primary'), P),
      btnDefault: pick(document.querySelector('.el-button--default, .el-button'), P),
      input: pick(document.querySelector('.el-input__inner'), P),
      table: pick(document.querySelector('.el-table'), P),
      tableTh: pick(document.querySelector('.el-table th'), P),
      tableTd: pick(document.querySelector('.el-table td'), P),
      pagination: pick(document.querySelector('.el-pagination'), P),
      tag: pick(document.querySelector('.el-tag'), P),
      card: pick(document.querySelector('.el-card, .box-card'), P),
      dialog: pick(document.querySelector('.el-dialog'), P),
      tabsItem: pick(document.querySelector('.el-tabs__item'), P),
      logoContainer: pick(document.querySelector('.logo-container'), P),
    };
  });
}

let tokensDone = fs.existsSync(path.join(OUT, 'tokens.json'));
const report = [];
for (const item of flat) {
  const url = 'https://m.achelp.cn' + item.route;
  const slug = item.page;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const finalUrl = page.url();
    await page.screenshot({ path: path.join(PAGES, slug + '.png'), fullPage: false });
    // 主内容区 DOM(减小体积);大屏页存整页
    const dom = await page.evaluate(() => {
      const main = document.querySelector('.app-main') || document.querySelector('.main-container') || document.body;
      return main.outerHTML;
    });
    fs.writeFileSync(path.join(PAGES, slug + '.html'), dom);
    const ex = await extract();
    ex._route = item.route; ex._label = item.label; ex._finalUrl = finalUrl;
    fs.writeFileSync(path.join(PAGES, slug + '.json'), JSON.stringify(ex, null, 2));
    if (!tokensDone && ex.tables.length) {
      fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify(await tokens(), null, 2));
      tokensDone = true;
    }
    report.push({ slug, label: item.label, ok: true, url: finalUrl, tables: ex.tables.length, buttons: ex.buttons.length });
    console.log('OK ', slug, item.label, '| tables:', ex.tables.length, '| btns:', ex.buttons.length);
  } catch (e) {
    report.push({ slug, label: item.label, ok: false, err: String(e).slice(0, 120) });
    console.log('FAIL', slug, item.label, String(e).slice(0, 120));
  }
}
fs.writeFileSync(path.join(OUT, 'crawl-report.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log('DONE', report.filter(r => r.ok).length + '/' + report.length);
