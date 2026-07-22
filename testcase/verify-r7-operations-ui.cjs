const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('R7 共享数据暴露页面所需接口', () => {
  const source = read('pages/_r7-data.js');
  for (const name of [
    'devices',
    'getDevice',
    'selectDevice',
    'selectedDevice',
    'bindProject',
    'projects',
    'traffic',
    'productVersion',
    'hasFault',
    'stats',
    'brandDistribution',
    'combinationDistribution',
  ]) {
    assert.match(source, new RegExp(`${name}\\s*:`));
  }
  assert.match(source, /hvac:r7:selectedSn/);
  assert.match(source, /hvac:r7:projectBindings/);
});

test('智慧运维注册三个 R7 页面', () => {
  const shell = read('hvac-demo.html');
  assert.match(shell, /\{id:'ops-r7-dashboard',lb:'R7仪表盘'\}/);
  assert.match(shell, /\{id:'ops-r7-list',lb:'R7设备列表'\}/);
  assert.match(shell, /\{id:'ops-r7',lb:'R7设备详情'\}/);
});

test('R7 仪表盘覆盖状态版本与品牌统计', () => {
  const html = read('pages/ops-r7-dashboard.html');
  for (const text of [
    '设备总数',
    '在线设备',
    '运行系统',
    '故障系统',
    '流量预警',
    '设备在线率',
    '产品版本',
    '软件版本分布',
    '外机品牌分布',
    '内机品牌分布',
  ]) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /内外机组合分布（外机\+内机）/);
  assert.match(html, /R7Store\.stats/);
  assert.match(html, /R7Store\.brandDistribution/);
  assert.match(html, /R7Store\.combinationDistribution/);
  assert.match(html, /id="totalMetricCard"/);
  assert.match(html, /id="metricQuartet"/);
  assert.match(html, /id="versionPie"/);
  assert.match(html, /id="combinationPie"/);
  assert.match(html, /id="combinationBars"/);
  assert.doesNotMatch(html, /实时|饼图 \/ 柱图|设备数 \/ 占比|默认前 20 名/);
  assert.match(html, /\.distribution-layout\{display:grid;grid-template-columns:minmax\(160px,190px\)/);
  assert.match(html, /\.combo-summary\{display:contents/);
  assert.match(html, /id="pieTooltip"/);
  assert.match(html, /function updatePieTooltip\(/);
  assert.match(html, /pointermove/);
  assert.match(html, /\.health-card \.compact-legend/);
  assert.match(html, /\.edition-list\{display:grid;grid-template-columns:1fr/);
  assert.doesNotMatch(html, /可升级设备|upgradeableCount|edition-track/);
});

test('R7 组合分布按品牌组合统计并默认限制前20名', () => {
  const source = read('pages/_r7-data.js');
  assert.match(source, /outdoorBrand\+' \+ '\+device\.indoorBrand/);
  assert.doesNotMatch(source, /outdoorBrand\+'外机 \+ '\+device\.indoorBrand\+'内机'/);
  assert.match(source, /slice\(0,limit\|\|20\)/);
});

test('R7 列表使用 SN 模糊输入和下拉筛选', () => {
  const html = read('pages/ops-r7-list.html');
  assert.match(html, /<input[^>]*id="snFilter"[^>]*type="text"/);
  for (const id of [
    'projectFilter',
    'trafficFilter',
    'versionFilter',
    'productFilter',
    'outdoorBrandFilter',
    'indoorBrandFilter',
    'onlineFilter',
    'systemFilter',
    'upgradeFilter',
    'faultFilter',
  ]) {
    assert.match(html, new RegExp(`<select[^>]*id="${id}"`));
  }
  assert.match(html, /includes\(snQuery\)/);
  assert.doesNotMatch(html, /添加设备/);
});

test('R7 列表筛选文案精简并按选项长度固定宽度', () => {
  const html = read('pages/ops-r7-list.html');
  const filterPanel = html.slice(html.indexOf('<section class="filter-panel">'), html.indexOf('</section>', html.indexOf('<section class="filter-panel">')));
  assert.doesNotMatch(filterPanel, /全部/);
  for (const label of ['所属项目', '流量状态', '软件版本', '产品版本', '外机品牌', '内机品牌', '在线状态', '系统状态', '升级状态', '故障状态']) {
    assert.match(filterPanel, new RegExp(`<option value="">${label}</option>`));
  }
  assert.match(filterPanel, /流量状态<\/option>[\s\S]*>正常<\/option>[\s\S]*>预警<\/option>/);
  assert.match(html, /\.filter-panel\{display:flex;flex-wrap:wrap/);
  assert.match(html, /\.filter-grid>\.sn-field\{flex:1 1 230px/);
  assert.match(html, /\.filter-grid>select\{flex:1 1 120px/);
  assert.doesNotMatch(html, /grid-template-columns:230px 180px 120px/);
  assert.match(html, /\.filter-panel\{display:flex;flex-wrap:wrap/);
  assert.match(html, /\.filter-grid\{display:contents\}/);
  assert.match(html, /\.filter-actions\{display:flex;gap:10px;margin:0/);
});

test('R7 列表支持绑定项目和详情跳转', () => {
  const html = read('pages/ops-r7-list.html');
  assert.match(html, /id="bindProjectDialog"/);
  assert.match(html, /R7Store\.bindProject/);
  assert.match(html, /R7Store\.selectDevice/);
  assert.match(html, /postMessage\(\{nav:'ops-r7',sn:sn\}/);
});

test('R7 详情区分菜单直入和列表携带 SN', () => {
  const shell = read('hvac-demo.html');
  const detail = read('pages/ops-r7.html');
  assert.match(shell, /function nav\(id,query\)/);
  assert.match(shell, /encodeURIComponent\(e\.data\.sn\)/);
  assert.match(detail, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(detail, /id="detailEmptyState"/);
  assert.match(detail, /id="detailContent"/);
});

test('R7 详情筛选弹窗支持项目查询和设备单选', () => {
  const html = read('pages/ops-r7.html');
  for (const id of [
    'gatewayFilterDialog',
    'gatewayProjectSelect',
    'gatewayDeviceBody',
    'gatewayDevicePager',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /type="radio"/);
  assert.match(html, /function queryGatewayDevices\(/);
  assert.match(html, /function confirmGatewaySelection\(/);
  assert.match(html, /onChange:function\(\)\{selectedGatewaySn='';renderGatewayDevices\(\);\}/);
  assert.match(html, /if\(projects\.length===1\)\{projectSelect\.value=projects\[0\];queryGatewayDevices\(\);\}/);
});

test('R7 详情展示列表字段和刷新入口', () => {
  const html = read('pages/ops-r7.html');
  for (const text of [
    '所属项目',
    '流量情况',
    '软件版本',
    '产品版本',
    '外机品牌',
    '内机品牌',
    '在线状态',
    '项目地址',
    '系统状态',
    '外机故障',
    '内机故障',
    '刷新',
  ]) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /function refreshDevice\(/);
});

test('R7 详情实现拉取设定和四个完整页签', () => {
  const html = read('pages/ops-r7.html');
  for (const text of [
    '拉取设定',
    '参数设置',
    '开始时间',
    '结束时间',
    '更新间隔',
    '是否启用',
    '历史参数',
    '参数曲线',
    '参数筛选',
    '预警列表',
  ]) {
    assert.match(html, new RegExp(text));
  }
  for (const name of [
    'savePullSettings',
    'renderHistoryPacket',
    'drawCurve',
    'applyParamFilter',
    'queryFilteredParams',
    'renderWarnings',
  ]) {
    assert.match(html, new RegExp(`function ${name}\\(`));
  }
});

test('R7 历史参数支持按时间点定位数据包', () => {
  const html = read('pages/ops-r7.html');
  assert.match(html, /<input[^>]*id="historyLocator"[^>]*type="datetime-local"/);
  assert.match(html, /function locateHistoryPacket\(/);
});

test('R7 list quick filters use a lightweight summary strip and synchronize selection', () => {
  const html = read('pages/ops-r7-list.html');
  assert.match(html, /class="summary summary-strip"/);
  assert.match(html, /class="summary-label">设备总数<\/span>/);
  assert.match(html, /id="summaryTotal"[^>]*aria-pressed="true"/);
  assert.match(html, /function setQuickFilterActive\(/);
  assert.match(html, /setAttribute\('aria-pressed'/);
});
