/* 将《故障预警功能说明文档.md》渲染为 PDF 输出到 docs/ 目录。
   流程:pandoc(md→html) → playwright(Chrome 打印 A4 PDF,中文字体/表格/删除线保留)。
   运行:cd testcase && node gen-alarm-doc-pdf.cjs */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const SRC = 'D:/workspace/丁文武/00-projects/故障预警/故障预警功能说明文档.md';
const OUT = path.join(__dirname, '..', 'docs', '故障预警功能说明文档.pdf');

const CSS = `
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;max-width:840px;margin:0 auto;padding:28px 36px;color:#24292f;line-height:1.65;font-size:13.5px}
h1{font-size:21px;border-bottom:1px solid #d0d7de;padding-bottom:8px;margin:26px 0 12px;page-break-after:avoid}
h1:first-child{margin-top:0}
h2{font-size:16.5px;margin:20px 0 8px;page-break-after:avoid}
p,ul{margin:6px 0}
li{margin:3px 0}
blockquote{color:#57606a;border-left:4px solid #d0d7de;margin:8px 0;padding:2px 0 2px 14px}
table{border-collapse:collapse;margin:10px 0;page-break-inside:avoid;font-size:12.5px}
th,td{border:1px solid #d0d7de;padding:5px 10px;text-align:left}
th{background:#f6f8fa}
code{background:#eff1f3;padding:1px 5px;border-radius:4px;font-size:12.5px}
pre{background:#f6f8fa;padding:12px 14px;border-radius:6px;page-break-inside:avoid;white-space:pre-wrap;word-break:break-all}
pre code{background:none;padding:0}
del{color:#cf222e}
strong{color:#1f2328}`;

(async () => {
  const body = execFileSync('pandoc', [SRC, '-f', 'gfm', '-t', 'html5'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>${CSS}</style></head><body>${body}</body></html>`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: OUT, format: 'A4', printBackground: true,
      margin: { top: '16mm', bottom: '15mm', left: '13mm', right: '13mm' },
    });
  } finally {
    await browser.close();
  }
  console.log('OK 已生成', OUT, fs.statSync(OUT).size, 'bytes');
})();
