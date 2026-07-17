import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const storage = new Map();
const window = {
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value)
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};
const context = vm.createContext({ window, localStorage: window.localStorage, CustomEvent: class {} });
vm.runInContext(read('pages/_allocation.js'), context);
const allocation = window.HvacAllocation;

allocation.reset();
const dynamicPublicRoomId = '1号楼|13层|1302';
allocation.setPublicRoom(dynamicPublicRoomId, true);
assert.ok(allocation.getState().publicRoomIds.includes(dynamicPublicRoomId));
assert.equal(
  allocation.getAvailablePublicRooms().find((room) => room.id === dynamicPublicRoomId)?.label,
  '1号楼 / 13层 / 1302'
);
allocation.saveRule({
  id: 'rule-dynamic-public-room',
  name: '动态公区房间',
  dimension: 'tenant',
  method: 'usage',
  publicRoomIds: [dynamicPublicRoomId],
  participantIds: ['tenant:产品部'],
  ratios: {}
});
assert.ok(allocation.getState().usage.some((row) => row.publicRoomId === dynamicPublicRoomId));
allocation.deleteRule('rule-dynamic-public-room');
allocation.setPublicRoom(dynamicPublicRoomId, false);
assert.ok(!allocation.getState().publicRoomIds.includes(dynamicPublicRoomId));

const billingRows = [
  { tenant: '产品部', room: '1号楼 8层 801', use: '3.25', fee: '2.98' },
  { tenant: '产品部', room: '1号楼 8层 802', use: '4.75', fee: '4.36' }
];
assert.equal(allocation.aggregateBilling(billingRows, 'room').length, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(allocation.aggregateBilling(billingRows, 'tenant'))),
  [{ tenant: '产品部', room: '1号楼 8层 801', use: 8, fee: 7.34 }]
);

const dailyRows = [
  { date: '2026-07-15', tenant: '产品部', room: '1号楼 8层 801', addr: '1-1-1-1', use: '2', fee: '1.84' },
  { date: '2026-07-15', tenant: '产品部', room: '1号楼 8层 801', addr: '1-1-1-2', use: '3', fee: '2.75' }
];
assert.equal(allocation.aggregateDaily(dailyRows, 'unit').length, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(allocation.aggregateDaily(dailyRows, 'room'))),
  [{ date: '2026-07-15', tenant: '产品部', room: '1号楼 8层 801', addr: '1-1-1-1', use: 5, fee: 4.59 }]
);
assert.deepEqual(
  JSON.parse(JSON.stringify(allocation.aggregateDaily(dailyRows, 'tenant'))),
  [{ date: '2026-07-15', tenant: '产品部', room: '1号楼 8层 801', addr: '1-1-1-1', use: 5, fee: 4.59 }]
);

allocation.reset();
allocation.deleteRule('rule-office');
allocation.deleteRule('rule-property');
allocation.saveRule({
  id: 'rule-regression',
  name: '规则明细同步',
  dimension: 'tenant',
  method: 'ratio',
  publicRoomIds: ['1号楼|8层|8层电梯厅'],
  participantIds: ['tenant:产品部', 'tenant:运营部'],
  ratios: { 'tenant:产品部': 60, 'tenant:运营部': 40 }
});
const persisted = JSON.parse(storage.get(allocation.KEY));
persisted.usage.push({
  date: '2026-07-15',
  ruleId: 'rule-deleted',
  publicRoomId: '1号楼|8层|8层电梯厅',
  publicRoom: '1号楼 8层 8层电梯厅',
  participantId: 'tenant:财务部',
  participant: '财务部',
  dimension: 'tenant',
  ratio: 100,
  use: 99,
  fee: 90.88
});
storage.set(allocation.KEY, JSON.stringify(persisted));
const publicDetail = allocation.queryDetails({
  mode: 'public',
  start: '2026-07-09',
  end: '2026-07-15',
  targetId: '1号楼|8层|8层电梯厅'
});
assert.deepEqual(JSON.parse(JSON.stringify(publicDetail.rows.map((row) => row.targetId))), ['tenant:产品部', 'tenant:运营部']);
assert.deepEqual(JSON.parse(JSON.stringify(publicDetail.rows.map((row) => row.ratio))), [60, 40]);
const participantDetail = allocation.queryDetails({
  mode: 'participant',
  start: '2026-07-09',
  end: '2026-07-15',
  targetId: 'tenant:产品部'
});
assert.equal(participantDetail.rows.length, 1);
assert.equal(participantDetail.rows[0].targetId, '1号楼|8层|8层电梯厅');

const roomPage = read('pages/device-ac-room.html');
assert.match(roomPage, /<th[^>]*>公区标记<\/th>/);
assert.match(roomPage, /class="switch[^"`]*\$\{isPublic/);
assert.match(roomPage, /allocation\.setPublicRoom/);
assert.match(roomPage, /allocation\.subscribe/);
assert.equal((roomPage.match(/<td class="pub-placeholder">[^<]+<\/td>/g) || []).length, 2);
assert.doesNotMatch(roomPage, /class="pub-state/);
assert.match(roomPage, /function pickRoom\([\s\S]*?renderTree\(\);renderSlots\(\);relQuery\(\);/);
assert.match(roomPage, /!selRoom\|\|\(r\.fl===selRoom\.fl&&r\.room===selRoom\.name\)/);

const billingPage = read('pages/elec-query.html');
assert.match(billingPage, /按房间/);
assert.match(billingPage, /按租户/);
assert.match(billingPage, /aggregateBilling/);

const dailyPage = read('pages/elec-daily.html');
assert.match(dailyPage, /按内机/);
assert.match(dailyPage, /按房间/);
assert.match(dailyPage, /按租户/);
assert.match(dailyPage, /aggregateDaily/);

const commonAreaPage = read('pages/elec-common-area.html');
assert.match(commonAreaPage, /class="rule-overview"/);
assert.match(commonAreaPage, /class="rule-meta-grid"/);
assert.match(commonAreaPage, /class="rule-basic-grid"/);
assert.match(commonAreaPage, /新增公区分摊规则/);
assert.match(commonAreaPage, /function setRuleDimension\(dimension\)/);
assert.match(commonAreaPage, /class="detail-toolbar"/);
assert.match(commonAreaPage, /<th>参与分摊对象<\/th><th>分摊比例<\/th><th>承担用量\(kWh\)<\/th><th>承担费用\(元\)<\/th>/);
assert.doesNotMatch(commonAreaPage, /function openCreate\(\)[\s\S]*?\$modal\('dlgDimension'\)/);
assert.doesNotMatch(commonAreaPage, /class="summary-bar"/);
assert.doesNotMatch(commonAreaPage, /<th>序号<\/th>/);

for (const file of [
  'hvac-demo.html',
  'pages/elec-common-area.html',
  'pages/device-ac-room.html',
  'pages/elec-query.html',
  'pages/elec-daily.html'
]) {
  const html = read(file);
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new Function(match[1]), `${file} contains invalid inline JavaScript`);
  }
}

console.log('common-area cross-page contract passed');
