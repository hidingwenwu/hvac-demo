import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
localStorage.setItem('fyProj', JSON.stringify({ name: '产品部测试-按小时预付费', meters: 92 }));

const window = {
  localStorage,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};
const context = vm.createContext({
  window,
  localStorage,
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  URLSearchParams,
  CustomEvent: class {}
});

vm.runInContext(read('pages/_fleet.js'), context, { filename: '_fleet.js' });
vm.runInContext(read('pages/_allocation.js'), context, { filename: '_allocation.js' });
vm.runInContext(read('pages/_energy-data.js'), context, { filename: '_energy-data.js' });

const energy = window.HvacEnergy;
assert.ok(energy, '共享数据层必须暴露 window.HvacEnergy');

const project = energy.getProject();
assert.equal(project.name, '产品部测试-按小时预付费');
assert.equal(project.meterCount, 92);
assert.equal(Object.hasOwn(project, 'feeRate'), false, '项目能耗元数据不得暴露费用费率');
assert.equal(energy.getCatalog('unit').length, 620);
assert.equal(energy.getCatalog('room').length, 140, '房间数按共享机队唯一房间统计');
assert.equal(energy.getCatalog('meter').length, 92);

const tenantFleet = window.HvacFleet.load();
const sharedRoomUnits = tenantFleet.units.filter(unit => unit.bld === '1号楼' && unit.fl === 3 && unit.room === '301');
assert.ok(sharedRoomUnits.length > 1, '租户聚合回归场景需要同一房间包含多台内机');
sharedRoomUnits[1].tenant = '独立测试租户';
window.HvacFleet.save(tenantFleet);
const independentTenant = energy.getCatalog('tenant').find(item => item.id === 'tenant:独立测试租户');
assert.ok(independentTenant, '逐内机修改租户后，新租户必须进入能耗对象目录');
assert.deepEqual(JSON.parse(JSON.stringify(independentTenant.unitIds)), [sharedRoomUnits[1].uid], '租户目录必须只聚合实际归属该租户的内机');
const independentTenantTrend = energy.queryTrend({ obj: independentTenant.id, granularity: 'day', from: '2026-08-01', to: '2026-08-03' });
const independentUnitTrend = energy.queryTrend({ obj: `unit:${sharedRoomUnits[1].uid}`, granularity: 'day', from: '2026-08-01', to: '2026-08-03' });
assert.equal(independentTenantTrend.summary.total, independentUnitTrend.summary.total, '新租户能耗必须等于其实际内机能耗');
sharedRoomUnits[1].tenant = '产品部';
window.HvacFleet.save(tenantFleet);

const query = {
  obj: 'project',
  granularity: 'day',
  from: '2026-08-01',
  to: '2026-08-03',
  metric: 'energy'
};
const first = energy.queryTrend(query);
const second = energy.queryTrend(query);
assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)), '同条件刷新数据必须保持不变');
assert.equal(first.points.length, 3);
assert.equal(first.summary.total, Number(first.points.reduce((sum, point) => sum + point.energy, 0).toFixed(2)));
assert.ok(first.points.every(point => !Object.hasOwn(point, 'fee')), '趋势点不得包含费用字段');
assert.equal(Object.hasOwn(first.summary, 'fee'), false, '趋势汇总不得包含费用字段');
assert.ok(first.summary.total > 1200 && first.summary.total < 3000, '项目日能耗应保持 400~1000 kWh 量级');

const buildings = energy.getCatalog('building');
assert.equal(buildings.length, 1);
const buildingTrend = energy.queryTrend({ ...query, obj: buildings[0].id });
assert.equal(buildingTrend.summary.total, first.summary.total, '唯一楼栋汇总必须等于项目汇总');

const rooms = energy.getCatalog('room');
const roomA = rooms[0];
const roomB = rooms[1];
const roomATrend = energy.queryTrend({ ...query, obj: roomA.id });
const roomBTrend = energy.queryTrend({ ...query, obj: roomB.id });
const group = energy.saveGroup({ name: '测试区域', roomIds: [roomA.id, roomB.id], remark: '跨房间汇总' });
assert.equal(group.name, '测试区域');
const groupTrend = energy.queryTrend({ ...query, obj: `group:${group.id}` });
assert.equal(
  groupTrend.summary.total,
  Number((roomATrend.summary.total + roomBTrend.summary.total).toFixed(2)),
  '群组能耗必须等于成员房间能耗之和'
);
assert.throws(
  () => energy.saveGroup({ name: '测试区域', roomIds: [roomA.id] }),
  /群组名称已存在/
);

const meters = energy.getCatalog('meter').slice(0, 2);
const meterOne = energy.queryTrend({ ...query, obj: meters[0].id });
const meterTwo = energy.queryTrend({ ...query, obj: meters[1].id });
const meterSum = energy.queryTrend({ ...query, obj: `meter:${meters[0].rawId},${meters[1].rawId}` });
assert.equal(
  meterSum.summary.total,
  Number((meterOne.summary.total + meterTwo.summary.total).toFixed(2)),
  '电表多选按合计口径返回单一序列'
);

const limited = energy.normalizeRange('day', '2026-01-01', '2026-08-13');
assert.equal(limited.truncated, true);
assert.equal(limited.pointCount, 92);
for (const [granularity, from, maxPoints] of [['week', '2025-01-01', 26], ['month', '2022-01-01', 36], ['year', '2020-01-01', 3]]) {
  const bounded = energy.queryTrend({ obj: 'unit:0', granularity, from, to: '2026-08-13' });
  assert.ok(bounded.points.length <= maxPoints, `${granularity} 粒度不得超过 ${maxPoints} 个点`);
}

const report = energy.getReport({ level: 'room', from: '2026-08-01', to: '2026-08-03' });
assert.equal(
  report.total.energy,
  Number(report.rows.reduce((sum, row) => sum + row.energy, 0).toFixed(2)),
  '报表合计必须等于当前所列对象之和'
);
for (const row of report.rows) {
  const rowTrend = energy.queryTrend({ obj: row.id, granularity: 'day', from: '2026-08-01', to: '2026-08-03' });
  assert.equal(row.energy, rowTrend.summary.total, `报表行 ${row.name} 的能耗必须与对应趋势一致`);
  assert.equal(row.runtime, rowTrend.summary.runtime, `报表行 ${row.name} 的运行时长必须与对应趋势一致`);
  assert.equal(Object.hasOwn(row, 'fee'), false, `报表行 ${row.name} 不得包含费用字段`);
}
assert.equal(Object.hasOwn(report.total, 'fee'), false, '报表合计不得包含费用字段');
assert.ok(report.rows.every(row => row.energy >= 0 && row.runtime >= 0 && row.unitEnergy >= 0), '报表各行指标不得出现负值');
const tenantReport = energy.getReport({ level: 'tenant', from: '2026-08-01', to: '2026-08-03' });
assert.equal(tenantReport.total.energy, first.summary.total, '租户报表必须覆盖全部内机能耗');
assert.equal(tenantReport.total.energy, Number(tenantReport.rows.reduce((sum, row) => sum + row.energy, 0).toFixed(2)), '租户报表按内机租户归属汇总后必须等于项目');
const groupReport = energy.getReport({ level: 'group', from: '2026-08-01', to: '2026-08-03' });
assert.equal(
  groupReport.total.energy,
  Number(groupReport.rows.reduce((sum, row) => sum + row.energy, 0).toFixed(2)),
  '群组报表合计应为所列群组之和，不得强行对齐项目总量'
);
assert.ok(groupReport.rows.every(row => row.runtime >= 0 && row.unitEnergy >= 0), '群组报表运行时长不得为负');

const runtimeRanking = energy.getRanking({ dimension: 'room', metric: 'runtime', from: '2026-08-01', to: '2026-08-03', limit: 999, order: 'desc' });
assert.ok(runtimeRanking.rows.every((row, index) => index === 0 || runtimeRanking.rows[index - 1].runtime >= row.runtime), '运行时长排行必须按运行时长倒序');
assert.ok(Math.abs(Number(runtimeRanking.rows.reduce((sum, row) => sum + row.percent, 0).toFixed(2)) - 100) <= 0.05, '运行时长排行占比必须按运行时长计算');
assert.ok(runtimeRanking.rows.every(row => !Object.hasOwn(row, 'fee')), '排行结果不得包含费用字段');

const monthly = energy.queryTrend({ obj: 'project', granularity: 'month', from: '2026-06-01', to: '2026-08-13' });
assert.deepEqual(JSON.parse(JSON.stringify(monthly.points.map(point => point.label))), ['2026-06', '2026-07', '2026-08']);
assert.ok(monthly.points.every(point => Number.isFinite(point.energy) && point.energy > 0));
const augustStructure = energy.getStructure({ dimension: 'zone', from: '2026-08-01', to: '2026-08-03' });
assert.equal(augustStructure.rows.length, 2);
assert.equal(augustStructure.total, first.summary.total, '公区与租户区之和必须等于项目总能耗');
window.HvacAllocation.getState().publicRoomIds.forEach(roomId => window.HvacAllocation.setPublicRoom(roomId, false));
window.HvacAllocation.setPublicRoom(rooms[1].rawId, true);
const changedPublicEnergy = energy.queryTrend({ ...query, obj: rooms[1].id }).summary.total;
const changedStructure = energy.getStructure({ dimension: 'zone', from: '2026-08-01', to: '2026-08-03' });
assert.equal(changedStructure.rows[0].energy, changedPublicEnergy, '公区配置变化后结构分析必须同步更新');

localStorage.setItem('fyProj', JSON.stringify({ name: '001', meters: 0 }));
energy.refreshProject();
assert.equal(energy.getProject().meterCount, 0);
assert.equal(energy.getCatalog('meter').length, 0);
assert.equal(energy.getCatalog('group').length, 0, '群组必须按项目隔离');

console.log('energy data contract passed');
