// step4: 从标准表格页(故障记录)补抓完整组件 tokens
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-http2'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true, storageState: path.join(OUT, '_auth.json') });
const page = await ctx.newPage();
await page.goto('https://m.achelp.cn/indoorUnit/indoorUnit/faulty', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(4000);

const t = await page.evaluate(() => {
  const pick = (sel, props) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
  };
  const P = ['background-color', 'color', 'border-color', 'border-radius', 'font-size', 'height', 'padding', 'border', 'box-shadow', 'margin'];
  // 找出内容区容器层次的背景色
  const layers = [];
  let el = document.querySelector('.el-table');
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') layers.push({ cls: el.className.toString().slice(0, 60), bg: cs.backgroundColor, radius: cs.borderRadius, pad: cs.padding });
    el = el.parentElement;
  }
  return {
    contentLayers: layers,
    appMainBg: pick('.app-main', P),
    wrapper: pick('.app-container, .fy-custom-content, .content-wrapper', P),
    tableTd: pick('.el-table td', P),
    tableRow: pick('.el-table__body tr', P),
    tableStripeRow: pick('.el-table__body tr.el-table__row--striped td', P),
    pagBtn: pick('.el-pagination .number', P),
    pagActive: pick('.el-pagination .number.active', P),
    pagTotal: pick('.el-pagination__total', P),
    tag: pick('.el-tag', P),
    selectInput: pick('.el-select .el-input__inner', P),
    datePicker: pick('.el-date-editor', P),
    formLabel: pick('.el-form-item__label', P),
    btnAll: [...document.querySelectorAll('.el-button')].slice(0, 8).map(b => ({
      text: b.textContent.trim(), cls: b.className,
      bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color,
      border: getComputedStyle(b).border, radius: getComputedStyle(b).borderRadius,
      fontSize: getComputedStyle(b).fontSize, padding: getComputedStyle(b).padding
    })),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    appWrapperBg: pick('.app-wrapper', P),
    htmlCls: document.documentElement.className, bodyCls: document.body.className,
    dataTheme: document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') || ''
  };
});
fs.writeFileSync(path.join(OUT, 'tokens2.json'), JSON.stringify(t, null, 2));
console.log(JSON.stringify(t, null, 1).slice(0, 4000));
await browser.close();
