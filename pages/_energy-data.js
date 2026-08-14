(function (global) {
  'use strict';

  var GROUP_KEY = 'hvacEnergyGroups:v1';
  var PROJECT_DEFAULT = '产品部测试-按小时预付费';
  var TODAY = '2026-08-13';
  var GRAN_LIMITS = { hour: 1, day: 92, week: 26, month: 36, year: 3 };
  var GRAN_LABELS = { hour: '按时', day: '按日', week: '按周', month: '按月', year: '按年' };
  var projectCache = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function round(value, digits) {
    var factor = Math.pow(10, digits == null ? 2 : digits);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }
  function formatNumber(value, digits) {
    if (value == null || Number.isNaN(Number(value))) return '--';
    return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits == null ? 2 : digits, maximumFractionDigits: digits == null ? 2 : digits });
  }
  function dateObj(text) { return new Date(String(text) + 'T00:00:00'); }
  function dateText(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function addDays(text, amount) { var d = dateObj(text); d.setDate(d.getDate() + amount); return dateText(d); }
  function daysBetween(from, to) { return Math.round((dateObj(to) - dateObj(from)) / 86400000) + 1; }
  function monthText(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1); }
  function startOfWeek(text) {
    var d = dateObj(text); var day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return dateText(d);
  }
  function hash(text) {
    var h = 2166136261;
    String(text).split('').forEach(function (ch) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); });
    return h >>> 0;
  }
  function rand(text) { return (hash(text) % 10000) / 10000; }
  function projectMeta() {
    var saved = null;
    try { saved = JSON.parse(global.localStorage.getItem('fyProj') || 'null'); } catch (e) {}
    var name = saved && saved.name || PROJECT_DEFAULT;
    var meterCount = name === '001' ? 0 : 92;
    return { name: name, meterCount: meterCount, hasMeters: meterCount > 0 };
  }
  function refreshProject() { projectCache = null; return getProject(); }
  function getProject() { if (!projectCache) projectCache = projectMeta(); return clone(projectCache); }
  function fleet() {
    if (global.HvacFleet && global.HvacFleet.load) return global.HvacFleet.load();
    return { units: [], extra: [] };
  }
  function units() { return fleet().units || []; }
  function unitRoomId(unit) { return 'room:' + [unit.bld, unit.fl + '层', unit.room].join('|'); }
  function unitSystemId(unit) { return 'system:sys-' + (hash(unit.addr) % 6 + 1); }
  function roomRows() {
    var map = {};
    units().forEach(function (unit) {
      var id = unitRoomId(unit);
      if (!map[id]) map[id] = { id: id, rawId: id.slice(5), type: 'room', name: String(unit.room), bld: unit.bld, fl: String(unit.fl) + '层', room: String(unit.room), tenant: unit.tenant || '未分配', unitIds: [] };
      map[id].unitIds.push(unit.uid);
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) { return a.rawId.localeCompare(b.rawId, 'zh-CN', { numeric: true }); });
  }
  function catalog(type) {
    var us = units(); var rooms = roomRows(); var result;
    if (type === 'unit') {
      result = us.map(function (u) { return { id: 'unit:' + u.uid, rawId: String(u.uid), type: 'unit', name: u.name || ('内机 ' + u.addr), bld: u.bld, fl: String(u.fl) + '层', room: String(u.room), tenant: u.tenant || '未分配', unitIds: [u.uid], addr: u.addr }; });
    } else if (type === 'room') result = rooms;
    else if (type === 'building') {
      var bs = {}; rooms.forEach(function (r) { if (!bs[r.bld]) bs[r.bld] = []; bs[r.bld].push(r); });
      result = Object.keys(bs).map(function (name) { return { id: 'building:' + name, rawId: name, type: 'building', name: name, bld: name, unitIds: bs[name].reduce(function (out, r) { return out.concat(r.unitIds); }, []) }; });
    } else if (type === 'floor') {
      var fs = {}; rooms.forEach(function (r) { var key = r.bld + '|' + r.fl; if (!fs[key]) fs[key] = []; fs[key].push(r); });
      result = Object.keys(fs).map(function (key) { var p = key.split('|'); return { id: 'floor:' + key, rawId: key, type: 'floor', name: p[0] + ' ' + p[1], bld: p[0], fl: p[1], unitIds: fs[key].reduce(function (out, r) { return out.concat(r.unitIds); }, []) }; });
    } else if (type === 'tenant') {
      var ts = {}; us.forEach(function (unit) { var name = unit.tenant || '未分配'; if (!ts[name]) ts[name] = []; ts[name].push(unit.uid); });
      result = Object.keys(ts).map(function (name) { return { id: 'tenant:' + name, rawId: name, type: 'tenant', name: name, unitIds: ts[name] }; });
    } else if (type === 'system') {
      var ss = {}; us.forEach(function (u) { var id = unitSystemId(u); if (!ss[id]) ss[id] = []; ss[id].push(u.uid); });
      result = Object.keys(ss).map(function (id) { return { id: id, rawId: id.slice(7), type: 'system', name: '空调系统 ' + id.slice(11), unitIds: ss[id] }; });
    } else if (type === 'meter') {
      result = getProject().hasMeters ? Array.from({ length: getProject().meterCount }, function (_, i) { return { id: 'meter:' + i, rawId: String(i), type: 'meter', name: '电表 ' + pad(i + 1), unitIds: us.filter(function (u) { return u.uid % getProject().meterCount === i; }).map(function (u) { return u.uid; }) }; }) : [];
    } else if (type === 'group') {
      result = listGroups().map(function (g) { return { id: 'group:' + g.id, rawId: g.id, type: 'group', name: g.name, roomIds: g.roomIds.slice(), unitIds: g.roomIds.reduce(function (out, roomId) { var room = rooms.find(function (r) { return r.id === roomId; }); return room ? out.concat(room.unitIds) : out; }, []), memberCount: g.roomIds.length, invalidCount: g.roomIds.filter(function (roomId) { return !rooms.some(function (r) { return r.id === roomId; }); }).length }; });
    } else result = [];
    return clone(result || []);
  }
  function getCatalog(type) { return catalog(type); }
  function allUnitsForObject(obj) {
    var id = obj || 'project';
    if (id === 'project') return units().map(function (u) { return u.uid; });
    var ids = id.indexOf('meter:') === 0 ? id.slice(6).split(',').filter(Boolean).reduce(function (out, meterId) { var meter = catalog('meter').find(function (m) { return m.rawId === meterId; }); return meter ? out.concat(meter.unitIds) : out; }, []) : (catalog('unit').concat(catalog('room'), catalog('building'), catalog('floor'), catalog('tenant'), catalog('system'), catalog('group')).find(function (item) { return item.id === id; }) || {}).unitIds;
    return Array.from(new Set(ids || []));
  }
  function resolveObject(id) {
    if (!id || id === 'project') return { id: 'project', type: 'project', name: '项目整体', unitIds: allUnitsForObject('project') };
    if (id.indexOf('meter:') === 0 && id.indexOf(',') >= 0) return { id: id, type: 'meter', name: id.slice(6).split(',').map(function (n) { return '电表 ' + pad(Number(n) + 1); }).join('、'), unitIds: allUnitsForObject(id) };
    var types = ['unit', 'room', 'building', 'floor', 'tenant', 'system', 'group', 'meter'];
    for (var i = 0; i < types.length; i++) { var item = catalog(types[i]).find(function (entry) { return entry.id === id; }); if (item) return item; }
    return null;
  }
  function dailyUnitEnergy(uid, date) {
    var base = 0.035 + rand(getProject().name + '|energy|' + uid + '|' + date) * 0.085;
    var dayFactor = [0.42, 0.54, 0.61, 0.68, 0.72, 0.55, 0.46][dateObj(date).getDay()];
    return round(base * dayFactor * 21.3, 2);
  }
  function hourlyEnergy(uid, date, hour) {
    var hourWeight = hour >= 8 && hour <= 21 ? 1.2 : 0.45;
    return dailyUnitEnergy(uid, date) * hourWeight / 21.3;
  }
  function pointEnergy(unitIds, date, hour) { return unitIds.reduce(function (sum, uid) { return sum + hourlyEnergy(uid, date, hour); }, 0); }
  function dayEnergy(unitIds, date) { return round(unitIds.reduce(function (sum, uid) { return sum + dailyUnitEnergy(uid, date); }, 0), 2); }
  function unitRuntime(uid, date) { return round(0.65 + rand(getProject().name + '|runtime|' + uid + '|' + date) * 2.15, 2); }
  function periodRuntime(unitIds, from, to) { var total = 0; for (var date = from; date <= to; date = addDays(date, 1)) unitIds.forEach(function (uid) { total += unitRuntime(uid, date); }); return round(total, 2); }
  function periodKey(date, granularity) {
    if (granularity === 'hour') return date.slice(0, 10) + ' ' + date.slice(11, 13) + ':00';
    if (granularity === 'week') return startOfWeek(date);
    if (granularity === 'month') return date.slice(0, 7);
    if (granularity === 'year') return date.slice(0, 4);
    return date.slice(0, 10);
  }
  function pointDates(from, to, granularity) {
    var out = [];
    if (granularity === 'hour') { for (var h = 0; h < 24; h++) out.push(from + ' ' + pad(h) + ':00'); return out; }
    var seen = {}; var current = from; while (current <= to) { var key = periodKey(current, granularity); if (!seen[key]) { seen[key] = true; out.push(key); } current = addDays(current, 1); }
    return out;
  }
  function normalizeRange(granularity, from, to) {
    granularity = GRAN_LIMITS[granularity] ? granularity : 'day';
    from = from || (granularity === 'hour' ? TODAY : addDays(TODAY, -29)); to = to || TODAY;
    if (granularity === 'hour') { from = from.slice(0, 10); to = from; return { granularity: granularity, from: from, to: to, truncated: false, pointCount: 24, label: GRAN_LABELS[granularity] }; }
    var limit = GRAN_LIMITS[granularity];
    var originalPoints = pointDates(from, to, granularity);
    var truncated = originalPoints.length > limit;
    if (truncated) {
      var firstKept = originalPoints[originalPoints.length - limit];
      from = granularity === 'month' ? firstKept + '-01' : granularity === 'year' ? firstKept + '-01-01' : firstKept;
    }
    return { granularity: granularity, from: from, to: to, truncated: truncated, pointCount: pointDates(from, to, granularity).length, label: GRAN_LABELS[granularity] };
  }
  function queryTrend(options) {
    options = options || {};
    var range = normalizeRange(options.granularity || 'day', options.from, options.to);
    var object = options.object || resolveObject(options.obj || 'project') || resolveObject('project');
    var componentIds = [];
    if (object.type === 'group' && object.roomIds) componentIds = object.roomIds.filter(function (roomId) { return resolveObject(roomId); });
    if (object.type === 'meter' && object.id.indexOf(',') >= 0) componentIds = object.id.slice(6).split(',').filter(Boolean).map(function (rawId) { return 'meter:' + rawId; });
    if (componentIds.length) {
      var componentResults = componentIds.map(function (componentId) { return queryTrend({ obj: componentId, granularity: range.granularity, from: range.from, to: range.to }); });
      var combinedPoints = componentResults[0].points.map(function (point, pointIndex) {
        var energy = round(componentResults.reduce(function (sum, result) { return sum + result.points[pointIndex].energy; }, 0), 2);
        var runtime = round(componentResults.reduce(function (sum, result) { return sum + result.points[pointIndex].runtime; }, 0), 2);
        return { label: point.label, energy: energy, runtime: runtime };
      });
      var combinedTotal = round(combinedPoints.reduce(function (sum, point) { return sum + point.energy; }, 0), 2);
      var combinedMax = combinedPoints.reduce(function (best, point) { return !best || point.energy > best.energy ? point : best; }, null);
      var combinedMin = combinedPoints.reduce(function (best, point) { return !best || point.energy < best.energy ? point : best; }, null);
      return { object: clone(object), range: range, points: combinedPoints, summary: { total: combinedTotal, average: combinedPoints.length ? round(combinedTotal / combinedPoints.length, 2) : 0, max: combinedMax ? combinedMax.energy : null, maxLabel: combinedMax ? combinedMax.label : '--', min: combinedMin ? combinedMin.energy : null, minLabel: combinedMin ? combinedMin.label : '--', runtime: round(combinedPoints.reduce(function (sum, point) { return sum + point.runtime; }, 0), 2) } };
    }
    var ids = options.unitIds || object.unitIds || allUnitsForObject(object.id);
    var points = pointDates(range.from, range.to, range.granularity).map(function (key) {
      var energy = 0, runtimeFrom = range.from, runtimeTo = range.from;
      if (range.granularity === 'hour') {
        energy = pointEnergy(ids, key.slice(0, 10), Number(key.slice(11, 13)));
      } else {
        var start = key;
        var end = key;
        if (range.granularity === 'week') end = addDays(key, 6);
        if (range.granularity === 'month') {
          start = key + '-01';
          var monthStart = dateObj(start);
          end = dateText(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
        }
        if (range.granularity === 'year') { start = key + '-01-01'; end = key + '-12-31'; }
        if (start < range.from) start = range.from;
        if (end > range.to) end = range.to;
        runtimeFrom = start; runtimeTo = end;
        for (var date = start; date <= end; date = addDays(date, 1)) energy += dayEnergy(ids, date);
      }
      return { label: key, energy: round(energy, 2), runtime: range.granularity === 'hour' ? round(periodRuntime(ids, runtimeFrom, runtimeTo) / 24, 2) : periodRuntime(ids, runtimeFrom, runtimeTo) };
    });
    var values = points.map(function (p) { return p.energy; }); var total = round(values.reduce(function (a, b) { return a + b; }, 0), 2); var avg = points.length ? round(total / points.length, 2) : 0; var max = points.reduce(function (a, b) { return !a || b.energy > a.energy ? b : a; }, null); var min = points.reduce(function (a, b) { return !a || b.energy < a.energy ? b : a; }, null);
    return { object: clone(object), range: range, points: points, summary: { total: total, average: avg, max: max ? max.energy : null, maxLabel: max ? max.label : '--', min: min ? min.energy : null, minLabel: min ? min.label : '--', runtime: round(points.reduce(function (sum, p) { return sum + p.runtime; }, 0), 2) } };
  }
  function getOverview() {
    var today = queryTrend({ obj: 'project', granularity: 'hour', from: TODAY, to: TODAY }); var month = queryTrend({ obj: 'project', granularity: 'day', from: TODAY.slice(0, 7) + '-01', to: TODAY }); var year = queryTrend({ obj: 'project', granularity: 'month', from: '2026-01-01', to: TODAY }); var trend = queryTrend({ obj: 'project', granularity: 'day', from: addDays(TODAY, -29), to: TODAY }); var ranking = getRanking({ dimension: 'room', metric: 'energy', from: TODAY.slice(0, 7) + '-01', to: TODAY, limit: 10 }); var structure = getStructure({ dimension: 'zone', from: TODAY.slice(0, 7) + '-01', to: TODAY }); var load = queryLoad({ date: TODAY }); var loadSummary = clone(load.summary); loadSummary.realtime = load.points.length ? load.points[load.points.length - 1].load : null; return { updatedAt: '2026-08-13 10:00', today: today.summary, month: month.summary, year: year.summary, trend: trend.points, ranking: ranking.rows, structure: structure.rows, load: loadSummary, anomalies: [{ level: '提示', title: '1号楼 3层电表通讯延迟', time: '今天 09:15' }, { level: '警示', title: '产品部能耗较近 7 日均值上升 12%', time: '昨天 18:40' }] }; }
  function getRanking(options) { options = options || {}; var type = options.dimension || 'room'; var metric = ['energy', 'runtime'].indexOf(options.metric) >= 0 ? options.metric : 'energy'; var rows = catalog(type).map(function (item) { var result = queryTrend({ obj: item.id, granularity: 'day', from: options.from || addDays(TODAY, -29), to: options.to || TODAY }); return { id: item.id, name: item.name, energy: result.summary.total, runtime: result.summary.runtime, percent: 0 }; }).sort(function (a, b) { return options.order === 'asc' ? a[metric] - b[metric] : b[metric] - a[metric]; }); var total = rows.reduce(function (s, r) { return s + r[metric]; }, 0); rows.forEach(function (r) { r.percent = total ? round(r[metric] * 100 / total, 2) : 0; }); var limit = Number(options.limit || 10); return { rows: rows.slice(0, limit), total: total, metric: metric }; }
  function getStructure(options) {
    options = options || {};
    var dimension = options.dimension || 'zone';
    var from = options.from || TODAY.slice(0, 7) + '-01';
    var to = options.to || TODAY;
    var configuredPublicIds = global.HvacAllocation && global.HvacAllocation.getState ? (global.HvacAllocation.getState().publicRoomIds || []) : [];
    var publicUnitIds = roomRows().filter(function (room) { return configuredPublicIds.indexOf(room.rawId) >= 0; }).reduce(function (out, room) { return out.concat(room.unitIds); }, []);
    var publicSet = {}; publicUnitIds.forEach(function (uid) { publicSet[uid] = true; });
    var rows = dimension === 'zone'
      ? [{ id: 'public', name: '公区', unitIds: publicUnitIds }, { id: 'tenant', name: '租户区', unitIds: units().filter(function (u) { return !publicSet[u.uid]; }).map(function (u) { return u.uid; }) }]
      : catalog(dimension === 'building' ? 'building' : 'tenant').slice(0, 8);
    var result = rows.map(function (item) {
      var trend = queryTrend({ object: item, unitIds: item.unitIds, granularity: 'day', from: from, to: to });
      return { id: item.id, name: item.name, energy: trend.summary.total, percent: 0 };
    });
    var projectTotal = queryTrend({ obj: 'project', granularity: 'day', from: from, to: to }).summary.total;
    var total = round(result.reduce(function (s, r) { return s + r.energy; }, 0), 2);
    result.forEach(function (r) { r.percent = total ? round(r.energy * 100 / total, 2) : 0; });
    return { rows: result, total: total };
  }
  function queryLoad(options) {
    options = options || {};
    var date = options.date || TODAY;
    var ids = allUnitsForObject(options.obj || 'project');
    var signature = ids.length ? ids.length + '|' + ids[0] + '|' + ids[ids.length - 1] : '0';
    var points = Array.from({ length: 96 }, function (_, i) {
      var hour = Math.floor(i / 4), quarter = i % 4;
      var base = ids.length * (0.055 + rand(getProject().name + '|load|' + signature + '|' + date + '|' + i) * 0.045);
      var office = hour >= 8 && hour <= 21 ? 1 : .32;
      var kw = base * office * (quarter === 0 ? 1.05 : .96);
      return { label: pad(hour) + ':' + pad(quarter * 15), load: round(kw, 2), setTemp: round(24 + rand(date + '|set|' + i) * 2, 1), roomTemp: round(25 + rand(date + '|room|' + i) * 2, 1) };
    });
    var max = points.reduce(function (a, b) { return !a || b.load > a.load ? b : a; }, null);
    var average = round(points.reduce(function (s, p) { return s + p.load; }, 0) / points.length, 2);
    return { date: date, points: points, summary: { max: max.load, maxAt: max.label, average: average, rate: max.load ? round(average * 100 / max.load, 2) : 0, energy: dayEnergy(ids, date) }, rows: [date] };
  }
  function getReport(options) {
    options = options || {};
    var level = options.level || 'room';
    var from = options.from || TODAY.slice(0, 7) + '-01';
    var to = options.to || TODAY;
    var list = level === 'project' ? [resolveObject('project')] : catalog(level);
    var rows = list.map(function (item) {
      var trend = queryTrend({ obj: item.id, granularity: 'day', from: from, to: to });
      return { id: item.id, name: item.name, energy: trend.summary.total, runtime: trend.summary.runtime, unitEnergy: trend.summary.runtime ? round(trend.summary.total / trend.summary.runtime, 2) : 0, mom: null, yoy: null };
    });
    var total = { energy: round(rows.reduce(function (sum, row) { return sum + row.energy; }, 0), 2), runtime: round(rows.reduce(function (sum, row) { return sum + row.runtime; }, 0), 2) };
    return { rows: rows, total: total };
  }
  function groupStorageKey() { return GROUP_KEY + ':' + getProject().name; }
  function listGroups() {
    try {
      var raw = global.localStorage.getItem(groupStorageKey());
      if (raw) { var saved = JSON.parse(raw); return Array.isArray(saved) ? saved : []; }
    } catch (e) {}
    if (!getProject().hasMeters) return [];
    var rooms = roomRows();
    var seeded = [
      { id: 'g-office', name: '办公核心区', roomIds: rooms.slice(0, 5).map(function (r) { return r.id; }), remark: '工作日重点分析区域', createdAt: '2026-08-01 09:00' },
      { id: 'g-public', name: '公区巡检区', roomIds: rooms.filter(function (_, i) { return i % 13 === 0; }).slice(0, 4).map(function (r) { return r.id; }), remark: '公共区域用能', createdAt: '2026-08-02 10:30' },
      { id: 'g-floor', name: '三层整层', roomIds: rooms.filter(function (r) { return r.fl === '3层'; }).slice(0, 8).map(function (r) { return r.id; }), remark: '按楼层汇总', createdAt: '2026-08-03 14:20' }
    ];
    global.localStorage.setItem(groupStorageKey(), JSON.stringify(seeded));
    return seeded;
  }
  function saveGroup(input) { input = input || {}; var name = String(input.name || '').trim(); if (!name) throw new Error('请输入群组名称'); if (name.length > 20) throw new Error('群组名称不能超过20字'); var rooms = roomRows(); var roomIds = Array.from(new Set(input.roomIds || [])).filter(function (id) { return rooms.some(function (r) { return r.id === id; }); }); if (!roomIds.length) throw new Error('请选择至少一个房间'); var rows = listGroups(); if (rows.some(function (g) { return g.name === name && g.id !== input.id; })) throw new Error('群组名称已存在'); var item = { id: input.id || 'g-' + Date.now(), name: name, roomIds: roomIds, remark: String(input.remark || '').slice(0, 50), createdAt: input.createdAt || '2026-08-13 10:00' }; var index = rows.findIndex(function (g) { return g.id === item.id; }); if (index >= 0) rows[index] = item; else rows.push(item); global.localStorage.setItem(groupStorageKey(), JSON.stringify(rows)); return clone(item); }
  function deleteGroup(id) { var rows = listGroups().filter(function (g) { return g.id !== id; }); global.localStorage.setItem(groupStorageKey(), JSON.stringify(rows)); return rows; }

  global.HvacEnergy = { GRAN_LABELS: GRAN_LABELS, getProject: getProject, refreshProject: refreshProject, getCatalog: getCatalog, normalizeRange: normalizeRange, queryTrend: queryTrend, getOverview: getOverview, getRanking: getRanking, getStructure: getStructure, queryLoad: queryLoad, getReport: getReport, listGroups: listGroups, saveGroup: saveGroup, deleteGroup: deleteGroup, resolveObject: resolveObject, formatNumber: formatNumber };
  if (typeof document !== 'undefined' && !getProject().hasMeters) {
    document.body.classList.add('energy-no-meter');
    var noMeter = document.createElement('div');
    noMeter.id = 'noMeterState';
    noMeter.className = 'energy-no-meter-state';
    noMeter.innerHTML = '<div class="energy-no-meter-icon">⚡</div><div class="energy-no-meter-title">当前项目未配置电表</div><div class="energy-no-meter-text">暂无可分析的能耗数据，请切换至已配置电表的项目。</div><button class="btn btnp" onclick="parent.postMessage({nav:\'overview-big\'},\'*\')">返回项目总览</button>';
    document.body.appendChild(noMeter);
  }
})(window);
