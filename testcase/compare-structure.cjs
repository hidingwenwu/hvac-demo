/* 结构比对:提取现网HTML与原型HTML的 筛选项/表头/按钮,输出差异报告 */
const fs = require('fs');
const path = require('path');

const LIVE = path.join(__dirname, 'live-full', 'pages-u2');
const NB = path.join(__dirname, 'live-full', 'pages-nb');
const PROTO = path.join(__dirname, '..', 'pages');

/* 现网名 → 原型文件名 映射 */
const MAP = {
  '空调控制': 'ctrl-ac', '环境感知监测': 'ctrl-env', '群组控制': 'ctrl-group', '日程管理': 'ctrl-schedule',
  '故障记录': 'ctrl-fault', '开关机记录': 'ctrl-onoff',
  '环境感知联动': 'strategy-env', '风水联动': 'strategy-wind', '负荷调控': 'strategy-load',
  '项目管理': 'device-project', '子账号列表': 'device-sub', '空调与房间关系': 'device-ac-room',
  '控制器管理': 'device-controller', '节点管理': 'device-node', '电表管理': 'device-meter', '环境感知设备管理': 'device-env',
  '电费查询': 'elec-query', '当量记录': 'elec-eq', '抄表记录': 'elec-meter-rec', '运行时间记录': 'elec-runtime',
  '日使用情况': 'elec-daily', '租户管理': 'elec-tenant', '电价设定': 'elec-price', '公区空调分摊': 'elec-common-area',
  '异常预警信息': 'elec-alert', '异常预警': 'elec-warn', '异常预警小时': 'elec-warn-hour', '异常每日盘点': 'elec-warn-daily',
  '空调参数': 'ops-ac', 'R7参数': 'ops-r7',
  '组织管理': 'sys-org', '日志入口': 'sys-log', '对接平台管理': 'sys-platform',
  '第三方设备注册': 'sys-3rd', '计费网关列表': 'sys-bill-gw', '物联网卡片': 'sys-iot-card',
};
const NB_MAP = {
  'nb2-租户管理': 'elec-nb-tenant', 'nb2-电费查询': 'elec-nb-query', 'nb-用电量统计': 'elec-nb-stat',
  'nb-分摊异常处理': 'elec-nb-abnormal', 'nb-异常处理操作记录': 'elec-nb-abnormal-log',
  'nb-异常查询': 'elec-nb-abnormal-query', 'nb-当量数据查询': 'elec-nb-eq',
};

function extract(html) {
  const placeholders = [...html.matchAll(/placeholder="([^"]{2,20})"/g)].map(m => m[1]);
  const ths = [...html.matchAll(/<th[^>]*>([\s\S]{0,40}?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '')).filter(t => t && t.length <= 12);
  // element-ui 表格列
  const elCols = [...html.matchAll(/label="([^"]{1,12})"/g)].map(m => m[1]);
  // 按钮
  const btns = [...html.matchAll(/<button[^>]*>([\s\S]{0,30}?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '')).filter(t => t && t.length <= 10);
  const uniq = a => [...new Set(a)];
  return { placeholders: uniq(placeholders), ths: uniq(ths), elCols: uniq(elCols), btns: uniq(btns) };
}

function diffSet(a, b) { return { onlyA: a.filter(x => !b.includes(x)), onlyB: b.filter(x => !a.includes(x)) }; }

const report = [];
for (const [liveName, protoName] of Object.entries(MAP)) {
  const lf = path.join(LIVE, liveName + '.html');
  const pf = path.join(PROTO, protoName + '.html');
  if (!fs.existsSync(lf)) { report.push({ page: liveName, proto: protoName, error: 'no live html' }); continue; }
  if (!fs.existsSync(pf)) { report.push({ page: liveName, proto: protoName, error: 'NO PROTO PAGE' }); continue; }
  const L = extract(fs.readFileSync(lf, 'utf8'));
  const P = extract(fs.readFileSync(pf, 'utf8'));
  const ph = diffSet(L.placeholders, P.placeholders);
  const th = diffSet(L.ths.length ? L.ths : L.elCols, P.ths.length ? P.ths : P.elCols);
  const bt = diffSet(L.btns, P.btns);
  report.push({
    page: liveName, proto: protoName,
    filterLiveOnly: ph.onlyA.filter(x => !/请输入|请选择/.test(x)),
    filterProtoOnly: ph.onlyB.filter(x => !/请输入|请选择/.test(x)),
    colLiveOnly: th.onlyA.slice(0, 25), colProtoOnly: th.onlyB.slice(0, 25),
    btnLiveOnly: bt.onlyA.filter(x => !/确 定|取 消/.test(x)).slice(0, 12),
    btnProtoOnly: bt.onlyB.filter(x => !/确 定|取 消/.test(x)).slice(0, 12),
  });
}
for (const [liveName, protoName] of Object.entries(NB_MAP)) {
  const lf = path.join(NB, liveName + '.html');
  const pf = path.join(PROTO, protoName + '.html');
  if (!fs.existsSync(lf)) { report.push({ page: 'NB/' + liveName, proto: protoName, error: 'no live html' }); continue; }
  if (!fs.existsSync(pf)) { report.push({ page: 'NB/' + liveName, proto: protoName, error: 'NO PROTO PAGE' }); continue; }
  const L = extract(fs.readFileSync(lf, 'utf8'));
  const P = extract(fs.readFileSync(pf, 'utf8'));
  const th = diffSet(L.ths.length ? L.ths : L.elCols, P.ths.length ? P.ths : P.elCols);
  report.push({ page: 'NB/' + liveName, proto: protoName, colLiveOnly: th.onlyA.slice(0, 25), colProtoOnly: th.onlyB.slice(0, 25) });
}

fs.writeFileSync(path.join(__dirname, 'live-full', 'diff-report.json'), JSON.stringify(report, null, 1));
/* 打印摘要:只列有差异的 */
for (const r of report) {
  if (r.error) { console.log(`✗ ${r.page} (${r.proto}): ${r.error}`); continue; }
  const parts = [];
  if (r.filterLiveOnly && r.filterLiveOnly.length) parts.push(`筛选缺:${r.filterLiveOnly.join(',')}`);
  if (r.colLiveOnly && r.colLiveOnly.length) parts.push(`列缺:${r.colLiveOnly.join(',')}`);
  if (r.btnLiveOnly && r.btnLiveOnly.length) parts.push(`按钮缺:${r.btnLiveOnly.join(',')}`);
  if (parts.length) console.log(`△ ${r.page} (${r.proto}): ${parts.join(' | ')}`);
  else console.log(`✓ ${r.page} (${r.proto})`);
}
