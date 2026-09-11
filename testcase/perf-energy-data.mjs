// 能耗数据层性能基准：计时 + 结果指纹（用于优化前后对比，保证数值不变）
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

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
  window, localStorage, console, Date, Math, JSON, Set, Map, URLSearchParams,
  CustomEvent: class {}
});
vm.runInContext(read('pages/_fleet.js'), context, { filename: '_fleet.js' });
vm.runInContext(read('pages/_allocation.js'), context, { filename: '_allocation.js' });
const dataFile = process.argv[2] || 'pages/_energy-data.js';
vm.runInContext(read(dataFile), context, { filename: dataFile });
const energy = window.HvacEnergy;

const today = energy.getDataWindow().to;
const monthStart = today.slice(0, 8) + '01';
const thirtyAgo = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();

function digest(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}
function bench(label, fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(label.padEnd(46), ms.toFixed(1).padStart(9), 'ms  fp=' + digest(out));
  return out;
}

console.log('--- 冷启动（各页面首查路径） ---');
bench('overview getOverview', () => energy.getOverview());
bench('trend project day 30d', () => energy.queryComparison({ obj: 'project', granularity: 'day', from: thirtyAgo, to: today }));
bench('rank room month', () => energy.getRanking({ dimension: 'room', metric: 'energy', from: monthStart, to: today, limit: 10 }));
bench('rank tenant month', () => energy.getRanking({ dimension: 'tenant', metric: 'energy', from: monthStart, to: today, limit: 10 }));
bench('structure zone month', () => energy.getStructure({ dimension: 'zone', from: monthStart, to: today }));
bench('report room month', () => energy.getReport({ level: 'room', granularity: 'month', from: monthStart, to: today }));
bench('load project today', () => energy.queryLoad({ date: today, obj: 'project' }));
bench('load 30d rows (load page table)', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
    rows.push(energy.queryLoad({ date: d.toISOString().slice(0, 10), obj: 'project' }));
  }
  return rows;
});
const rooms = energy.getCatalog('room');
bench('trend room x5 day 30d (drill-down)', () => rooms.slice(0, 5).map(r => energy.queryComparison({ obj: r.id, granularity: 'day', from: thirtyAgo, to: today })));
bench('compare objects x4 day 30d', () => rooms.slice(0, 4).map(r => energy.queryTrend({ obj: r.id, granularity: 'day', from: thirtyAgo, to: today })));

console.log('--- 温热（重复查询，模拟页面内交互） ---');
bench('overview getOverview (warm)', () => energy.getOverview());
bench('rank room month (warm)', () => energy.getRanking({ dimension: 'room', metric: 'energy', from: monthStart, to: today, limit: 10 }));
bench('report room month (warm)', () => energy.getReport({ level: 'room', granularity: 'month', from: monthStart, to: today }));
bench('trend project day 30d (warm)', () => energy.queryComparison({ obj: 'project', granularity: 'day', from: thirtyAgo, to: today }));
