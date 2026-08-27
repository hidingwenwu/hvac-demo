(function (global) {
  'use strict';

  var GROUP_KEY = 'hvacEnergyGroups:v2';
  var LEGACY_GROUP_KEY = 'hvacEnergyGroups:v1';
  var PROJECT_DEFAULT = '产品部测试-按小时预付费';
  var GRAN_LIMITS = { hour: 24, day: 366, month: 24, year: 2 };
  var GRAN_LABELS = { hour: '按小时', day: '按日', month: '按月', year: '按年' };
  var MONTH_FACTORS = [1.32, 1.18, 0.18, 0.12, 0.22, 1.05, 1.36, 1.42, 1.12, 0.18, 0.34, 1.24];
  var projectCache = null;
  var energyCache = {};
  var FLEET_STORAGE_KEY = 'hvacFleetV2';

  /* 派生数据记忆层：机队/房间/电表/目录/对象解析只算一次；
     以 localStorage 原文串做签名，机队或群组被其他页面改写后自动失效重建 */
  var metaCache = freshMetaCache();

  function freshMetaCache() {
    return { sigs: null, units: null, rooms: null, meters: null, catalogs: {}, objects: {}, unitSources: {}, weights: {}, dateParts: {}, meterScale: {}, yearAnnual: {}, meterEntries: null };
  }

  function safeStorageGet(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function projectName() {
    if (!projectCache) projectCache = projectMeta();
    return projectCache.name;
  }

  function ensureFresh() {
    var fleetSig = safeStorageGet(global.HvacFleet && global.HvacFleet.key ? global.HvacFleet.key() : FLEET_STORAGE_KEY);
    var groupSig = safeStorageGet(GROUP_KEY + ':' + projectName());
    if (metaCache.sigs && metaCache.sigs.fleet === fleetSig && metaCache.sigs.group === groupSig) return;
    var fleetChanged = !metaCache.sigs || metaCache.sigs.fleet !== fleetSig;
    var groupChanged = !metaCache.sigs || metaCache.sigs.group !== groupSig;
    if (fleetChanged) {
      metaCache.units = null;
      metaCache.rooms = null;
      metaCache.meters = null;
      metaCache.catalogs = {};
      metaCache.unitSources = {};
      metaCache.weights = {};
      metaCache.meterEntries = null;
    }
    if (fleetChanged || groupChanged) {
      metaCache.objects = {};
      if (metaCache.catalogs) delete metaCache.catalogs.group;
    }
    metaCache.sigs = { fleet: fleetSig, group: groupSig };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits == null ? 2 : digits);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function formatNumber(value, digits) {
    if (value == null || Number.isNaN(Number(value))) return '--';
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: digits == null ? 2 : digits,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function dateObj(value) {
    var text = String(value || '').trim().replace(' ', 'T');
    if (text.length === 10) text += 'T00:00:00';
    else if (text.length === 16) text += ':00';
    return new Date(text);
  }

  function dateText(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function dateTimeText(date) {
    return dateText(date) + ' ' + pad(date.getHours()) + ':00';
  }

  function todayText() {
    return dateText(new Date());
  }

  function addDays(value, amount) {
    var date = dateObj(String(value).slice(0, 10));
    date.setDate(date.getDate() + amount);
    return dateText(date);
  }

  function addHours(value, amount) {
    var date = dateObj(value);
    date.setHours(date.getHours() + amount);
    return dateTimeText(date);
  }

  function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function shiftMonths(value, amount) {
    var source = dateObj(value);
    var day = source.getDate();
    var target = new Date(source.getFullYear(), source.getMonth() + amount, 1, source.getHours());
    target.setDate(Math.min(day, lastDayOfMonth(target.getFullYear(), target.getMonth())));
    return String(value).length > 10 ? dateTimeText(target) : dateText(target);
  }

  function shiftYears(value, amount) {
    var source = dateObj(value);
    var targetYear = source.getFullYear() + amount;
    var target = new Date(targetYear, source.getMonth(), 1, source.getHours());
    target.setDate(Math.min(source.getDate(), lastDayOfMonth(targetYear, source.getMonth())));
    return String(value).length > 10 ? dateTimeText(target) : dateText(target);
  }

  function daysBetween(from, to) {
    return Math.round((dateObj(String(to).slice(0, 10)) - dateObj(String(from).slice(0, 10))) / 86400000) + 1;
  }

  function hoursBetween(from, to) {
    return Math.round((dateObj(to) - dateObj(from)) / 3600000) + 1;
  }

  function monthEnd(value) {
    var date = dateObj(String(value).slice(0, 7) + '-01');
    return dateText(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }

  function hash(text) {
    var result = 2166136261;
    var str = String(text);
    for (var index = 0; index < str.length; index++) {
      result ^= str.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function rand(text) {
    return (hash(text) % 10000) / 10000;
  }

  function readProjectFromStorage() {
    try {
      return JSON.parse(global.localStorage.getItem('fyProj') || 'null');
    } catch (error) {
      return null;
    }
  }

  function projectMeta() {
    var saved = readProjectFromStorage();
    var name = saved && saved.name || PROJECT_DEFAULT;
    var meterCount = Number(saved && saved.meters);
    if (!Number.isFinite(meterCount)) meterCount = name === '001' ? 0 : 92;
    return {
      name: name,
      unit: saved && saved.unit === 'hour' ? 'hour' : 'day',
      meterCount: meterCount,
      hasMeters: meterCount > 0
    };
  }

  function refreshProject() {
    projectCache = null;
    energyCache = {};
    metaCache = freshMetaCache();
    return getProject();
  }

  function getProject() {
    if (!projectCache) projectCache = projectMeta();
    return clone(projectCache);
  }

  function getGranularities() {
    var values = getProject().unit === 'hour'
      ? ['hour', 'day', 'month', 'year']
      : ['day', 'month', 'year'];
    return values.map(function (value) {
      return { value: value, label: GRAN_LABELS[value] };
    });
  }

  function getDataWindow() {
    var to = todayText();
    var fromDate = dateObj(to);
    fromDate.setFullYear(fromDate.getFullYear() - 2);
    fromDate.setDate(fromDate.getDate() + 1);
    return { from: dateText(fromDate), to: to, months: 24 };
  }

  function fleet() {
    if (global.HvacFleet && global.HvacFleet.load) return global.HvacFleet.load();
    return { units: [], extra: [] };
  }

  function units() {
    ensureFresh();
    if (!metaCache.units) metaCache.units = fleet().units || [];
    return metaCache.units;
  }

  function unitRoomId(unit) {
    return 'room:' + [unit.bld, unit.fl + '层', unit.room].join('|');
  }

  function unitSystemId(unit) {
    return 'system:sys-' + (hash(unit.addr) % 6 + 1);
  }

  function roomRows() {
    ensureFresh();
    if (!metaCache.rooms) metaCache.rooms = buildRoomRows();
    return metaCache.rooms;
  }

  function buildRoomRows() {
    var map = {};
    units().forEach(function (unit) {
      var id = unitRoomId(unit);
      if (!map[id]) {
        map[id] = {
          id: id,
          rawId: id.slice(5),
          type: 'room',
          name: String(unit.room),
          bld: unit.bld,
          fl: String(unit.fl) + '层',
          room: String(unit.room),
          tenant: unit.tenant || '未分配',
          unitIds: []
        };
      }
      map[id].unitIds.push(unit.uid);
    });
    return Object.keys(map).map(function (key) {
      return map[key];
    }).sort(function (left, right) {
      return left.rawId.localeCompare(right.rawId, 'zh-CN', { numeric: true });
    });
  }

  function meterRows() {
    ensureFresh();
    if (!metaCache.meters) metaCache.meters = buildMeterRows();
    return metaCache.meters;
  }

  function buildMeterRows() {
    var project = getProject();
    var currentUnits = units();
    if (!project.hasMeters) return [];
    return Array.from({ length: project.meterCount }, function (_, index) {
      return {
        id: 'meter:' + index,
        rawId: String(index),
        type: 'meter',
        name: '电表 ' + pad(index + 1),
        unitIds: currentUnits.filter(function (unit) {
          return unit.uid % project.meterCount === index;
        }).map(function (unit) {
          return unit.uid;
        })
      };
    });
  }

  function catalog(type) {
    ensureFresh();
    if (!metaCache.catalogs[type]) {
      var built = buildCatalog(type);
      /* 构建期间可能触发群组种子持久化 → ensureFresh 重置 catalogs，须重取当前对象再赋值 */
      metaCache.catalogs[type] = built;
    }
    return metaCache.catalogs[type];
  }

  function buildCatalog(type) {
    var currentUnits = units();
    var rooms = roomRows();
    var result = [];
    if (type === 'unit') {
      result = currentUnits.map(function (unit) {
        return {
          id: 'unit:' + unit.uid,
          rawId: String(unit.uid),
          type: 'unit',
          name: unit.name || ('内机 ' + unit.addr),
          bld: unit.bld,
          fl: String(unit.fl) + '层',
          room: String(unit.room),
          tenant: unit.tenant || '未分配',
          unitIds: [unit.uid],
          addr: unit.addr
        };
      });
    } else if (type === 'room') {
      result = rooms;
    } else if (type === 'building') {
      var buildings = {};
      rooms.forEach(function (room) {
        if (!buildings[room.bld]) buildings[room.bld] = [];
        buildings[room.bld].push(room);
      });
      result = Object.keys(buildings).map(function (name) {
        return {
          id: 'building:' + name,
          rawId: name,
          type: 'building',
          name: name,
          bld: name,
          unitIds: buildings[name].reduce(function (all, room) {
            return all.concat(room.unitIds);
          }, [])
        };
      });
    } else if (type === 'floor') {
      var floors = {};
      rooms.forEach(function (room) {
        var key = room.bld + '|' + room.fl;
        if (!floors[key]) floors[key] = [];
        floors[key].push(room);
      });
      result = Object.keys(floors).map(function (key) {
        var parts = key.split('|');
        return {
          id: 'floor:' + key,
          rawId: key,
          type: 'floor',
          name: parts[0] + ' ' + parts[1],
          bld: parts[0],
          fl: parts[1],
          unitIds: floors[key].reduce(function (all, room) {
            return all.concat(room.unitIds);
          }, [])
        };
      });
    } else if (type === 'tenant') {
      var tenants = {};
      currentUnits.forEach(function (unit) {
        var name = unit.tenant || '未分配';
        if (!tenants[name]) tenants[name] = [];
        tenants[name].push(unit.uid);
      });
      result = Object.keys(tenants).map(function (name) {
        return {
          id: 'tenant:' + name,
          rawId: name,
          type: 'tenant',
          name: name,
          unitIds: tenants[name]
        };
      });
    } else if (type === 'system') {
      var systems = {};
      currentUnits.forEach(function (unit) {
        var id = unitSystemId(unit);
        if (!systems[id]) systems[id] = [];
        systems[id].push(unit.uid);
      });
      result = Object.keys(systems).map(function (id) {
        return {
          id: id,
          rawId: id.slice(7),
          type: 'system',
          name: '空调系统 ' + id.slice(11),
          unitIds: systems[id]
        };
      });
    } else if (type === 'meter') {
      result = meterRows();
    } else if (type === 'group') {
      var roomCatalog = rooms;
      var meterCatalog = meterRows();
      result = listGroups().map(function (group) {
        var sourceCatalog = group.type === 'meter' ? meterCatalog : roomCatalog;
        var validMembers = group.memberIds.filter(function (memberId) {
          return sourceCatalog.some(function (entry) {
            return entry.id === memberId;
          });
        });
        var item = {
          id: 'group:' + group.id,
          rawId: group.id,
          type: 'group',
          groupType: group.type,
          name: group.name,
          memberIds: group.memberIds.slice(),
          memberCount: group.memberIds.length,
          invalidCount: group.memberIds.length - validMembers.length,
          unitIds: [],
          meterIds: []
        };
        if (group.type === 'meter') {
          item.meterIds = validMembers.slice();
          item.unitIds = validMembers.reduce(function (all, memberId) {
            var meter = meterCatalog.find(function (entry) {
              return entry.id === memberId;
            });
            return meter ? all.concat(meter.unitIds) : all;
          }, []);
        } else {
          item.roomIds = validMembers.slice();
          item.unitIds = validMembers.reduce(function (all, memberId) {
            var room = roomCatalog.find(function (entry) {
              return entry.id === memberId;
            });
            return room ? all.concat(room.unitIds) : all;
          }, []);
        }
        item.unitIds = Array.from(new Set(item.unitIds));
        return item;
      });
    }
    return result;
  }

  function getCatalog(type) {
    return clone(catalog(type));
  }

  function allUnitsForObject(objectId) {
    var id = objectId || 'project';
    if (id === 'project') {
      return units().map(function (unit) {
        return unit.uid;
      });
    }
    var types = ['unit', 'room', 'building', 'floor', 'tenant', 'system', 'group', 'meter'];
    for (var index = 0; index < types.length; index++) {
      var item = catalog(types[index]).find(function (entry) {
        return entry.id === id;
      });
      if (item) return Array.from(new Set(item.unitIds || []));
    }
    return [];
  }

  function resolveObject(id) {
    ensureFresh();
    var key = id || 'project';
    if (!Object.prototype.hasOwnProperty.call(metaCache.objects, key)) {
      /* 解析期间可能触发群组种子持久化 → ensureFresh 重置 objects，须先算后赋（重取当前 objects） */
      var resolved = resolveObjectUncached(key);
      metaCache.objects[key] = resolved;
    }
    return metaCache.objects[key];
  }

  function resolveObjectUncached(id) {
    if (!id || id === 'project') {
      return {
        id: 'project',
        type: 'project',
        name: '项目整体',
        unitIds: allUnitsForObject('project')
      };
    }
    var types = ['unit', 'room', 'building', 'floor', 'tenant', 'system', 'group', 'meter'];
    for (var index = 0; index < types.length; index++) {
      var item = catalog(types[index]).find(function (entry) {
        return entry.id === id;
      });
      if (item) return item;
    }
    return null;
  }

  /* 日期解析记忆：同一日期字符串只构造一次 Date（热路径每天被调用数千次） */
  function dateParts(date) {
    var key = String(date).slice(0, 10);
    var cached = metaCache.dateParts[key];
    if (!cached) {
      var parsed = dateObj(key);
      cached = { year: parsed.getFullYear(), month: parsed.getMonth(), dow: parsed.getDay() };
      metaCache.dateParts[key] = cached;
    }
    return cached;
  }

  function meterScale(rawId) {
    if (metaCache.meterScale[rawId] == null) {
      metaCache.meterScale[rawId] = 18 + hash(projectName() + '|meter|' + rawId) % 25;
    }
    return metaCache.meterScale[rawId];
  }

  function yearAnnual(year) {
    if (metaCache.yearAnnual[year] == null) {
      metaCache.yearAnnual[year] = 0.96 + (hash(projectName() + '|year|' + year) % 9) / 100;
    }
    return metaCache.yearAnnual[year];
  }

  function meterHourCents(meter, date, hour) {
    if (!meter) return 0;
    var parts = dateParts(date);
    var season = MONTH_FACTORS[parts.month];
    var workday = parts.dow === 0 || parts.dow === 6 ? 0.72 : 1;
    var active = hour >= 8 && hour <= 19 ? 1 : hour >= 20 && hour <= 22 ? 0.55 : 0.18;
    var scale = meterScale(meter.rawId);
    var annual = yearAnnual(parts.year);
    var variation = 0.92 + rand(projectName() + '|meter-energy|' + meter.rawId + '|' + date + '|' + hour) * 0.16;
    return Math.max(0, Math.round(scale * season * workday * active * annual * variation));
  }

  function hourLimitForDate(date) {
    var today = todayText();
    if (date < today) return 23;
    if (date > today) return -1;
    return new Date().getHours();
  }

  function unitWeight(unit) {
    var uid = unit ? unit.uid : 0;
    if (metaCache.weights[uid] == null) {
      var capacity = Number(unit && unit.cap) || 50;
      metaCache.weights[uid] = capacity * (0.85 + rand(projectName() + '|unit-share|' + uid) * 0.3);
    }
    return metaCache.weights[uid];
  }

  function allocateInteger(total, entries) {
    if (!entries.length || total <= 0) {
      return entries.map(function (entry) {
        return { id: entry.id, value: 0 };
      });
    }
    var weightTotal = entries._weightTotal;
    if (weightTotal == null) {
      weightTotal = entries.reduce(function (sum, entry) {
        return sum + entry.weight;
      }, 0);
      entries._weightTotal = weightTotal;
    }
    var values = entries.map(function (entry) {
      var exact = weightTotal ? total * entry.weight / weightTotal : total / entries.length;
      return {
        id: entry.id,
        value: Math.floor(exact),
        remainder: exact - Math.floor(exact)
      };
    });
    var assigned = values.reduce(function (sum, entry) {
      return sum + entry.value;
    }, 0);
    values.sort(function (left, right) {
      return right.remainder - left.remainder || left.id - right.id;
    });
    for (var index = 0; index < total - assigned; index++) {
      values[index % values.length].value += 1;
    }
    return values;
  }

  function hourMeterCents(date, hour) {
    var key = projectName() + '|meter-hour|' + date + '|' + hour;
    if (energyCache[key]) return energyCache[key].slice();
    var values = meterRows().map(function (meter) {
      return meterHourCents(meter, date, hour);
    });
    energyCache[key] = values;
    return values.slice();
  }

  /* 每台电表的成员权重清单在项目内不变，构建一次复用（权重来自 unitWeight 记忆值） */
  function meterWeightEntries() {
    if (!metaCache.meterEntries) {
      var unitById = {};
      units().forEach(function (unit) {
        unitById[unit.uid] = unit;
      });
      metaCache.meterEntries = meterRows().map(function (meter) {
        return meter.unitIds.map(function (unitId) {
          return { id: unitId, weight: unitWeight(unitById[unitId]) };
        });
      });
    }
    return metaCache.meterEntries;
  }

  function hourUnitCents(date, hour) {
    var key = projectName() + '|unit-hour|' + date + '|' + hour;
    if (energyCache[key]) return energyCache[key].slice();
    var values = Array.from({ length: units().length }, function () {
      return 0;
    });
    var meterValues = hourMeterCents(date, hour);
    var entriesList = meterWeightEntries();
    for (var meterIndex = 0; meterIndex < entriesList.length; meterIndex++) {
      allocateInteger(meterValues[meterIndex] || 0, entriesList[meterIndex]).forEach(function (entry) {
        values[entry.id] = entry.value;
      });
    }
    energyCache[key] = values;
    return values.slice();
  }

  function dayMeterCents(date) {
    var key = projectName() + '|meter-day|' + date;
    if (energyCache[key]) return energyCache[key].slice();
    var values = Array.from({ length: getProject().meterCount }, function () {
      return 0;
    });
    var hourLimit = hourLimitForDate(date);
    for (var hour = 0; hour <= hourLimit; hour++) {
      hourMeterCents(date, hour).forEach(function (value, index) {
        values[index] += value;
      });
    }
    energyCache[key] = values;
    return values.slice();
  }

  function dayUnitCents(date) {
    var key = projectName() + '|unit-day|' + date;
    if (energyCache[key]) return energyCache[key].slice();
    var values = Array.from({ length: units().length }, function () {
      return 0;
    });
    var hourLimit = hourLimitForDate(date);
    for (var hour = 0; hour <= hourLimit; hour++) {
      hourUnitCents(date, hour).forEach(function (value, index) {
        values[index] += value;
      });
    }
    energyCache[key] = values;
    return values.slice();
  }

  function sourceForObject(object, options) {
    if (options && Array.isArray(options.meterIds)) {
      return {
        mode: 'meter',
        ids: options.meterIds.map(function (id) {
          return Number(String(id).replace('meter:', ''));
        })
      };
    }
    if (options && Array.isArray(options.unitIds)) {
      return { mode: 'unit', ids: Array.from(new Set(options.unitIds)) };
    }
    if (object.type === 'project') {
      return {
        mode: 'meter',
        ids: meterRows().map(function (meter) {
          return Number(meter.rawId);
        })
      };
    }
    if (object.type === 'meter') {
      return { mode: 'meter', ids: [Number(object.rawId)] };
    }
    if (object.type === 'group' && object.groupType === 'meter') {
      return {
        mode: 'meter',
        ids: object.meterIds.map(function (id) {
          return Number(String(id).replace('meter:', ''));
        })
      };
    }
    return { mode: 'unit', ids: Array.from(new Set(object.unitIds || [])) };
  }

  function sourceHourCents(source, date, hour) {
    var values = source.mode === 'meter' ? hourMeterCents(date, hour) : hourUnitCents(date, hour);
    return source.ids.reduce(function (sum, id) {
      return sum + (values[id] || 0);
    }, 0);
  }

  function sourceDayCents(source, date) {
    var values = source.mode === 'meter' ? dayMeterCents(date) : dayUnitCents(date);
    return source.ids.reduce(function (sum, id) {
      return sum + (values[id] || 0);
    }, 0);
  }

  function unitRuntimeHundredths(unitId, date) {
    var parts = dateParts(date);
    var season = MONTH_FACTORS[parts.month];
    var workday = parts.dow === 0 || parts.dow === 6 ? 0.72 : 1;
    var base = 0.45 + rand(projectName() + '|runtime|' + unitId + '|' + date) * 5.8;
    return Math.max(0, Math.round(base * Math.min(1.2, season) * workday * 100));
  }

  function sourceUnitIds(source) {
    if (source.mode === 'unit') return source.ids.slice();
    var key = source.ids.join(',');
    if (!metaCache.unitSources[key]) {
      var meters = meterRows();
      var collected = Array.from(new Set(source.ids.reduce(function (all, meterIndex) {
        var meter = meters[meterIndex];
        return meter ? all.concat(meter.unitIds) : all;
      }, [])));
      metaCache.unitSources[key] = collected;
    }
    return metaCache.unitSources[key].slice();
  }

  function dayUnitRuntimeHundredths(date) {
    var key = projectName() + '|runtime-day|' + date;
    var values = energyCache[key];
    if (!values) {
      values = {};
      units().forEach(function (unit) {
        values[unit.uid] = unitRuntimeHundredths(unit.uid, date);
      });
      energyCache[key] = values;
    }
    return values;
  }

  function sourceDayRuntimeHundredths(source, date) {
    var dayValues = dayUnitRuntimeHundredths(date);
    return sourceUnitIds(source).reduce(function (sum, unitId) {
      return sum + (dayValues[unitId] || 0);
    }, 0);
  }

  function normalizeRange(granularity, from, to) {
    var available = getGranularities().map(function (item) {
      return item.value;
    });
    granularity = available.indexOf(granularity) >= 0 ? granularity : available[0];
    var windowRange = getDataWindow();
    from = String(from || (granularity === 'hour' ? windowRange.to : addDays(windowRange.to, -29)));
    to = String(to || (granularity === 'hour' ? from : windowRange.to));
    var hasTime = granularity === 'hour' && (from.length > 10 || to.length > 10);
    var fromDate = from.slice(0, 10);
    var toDate = to.slice(0, 10);
    if (fromDate < windowRange.from) {
      from = hasTime ? windowRange.from + ' 00:00' : windowRange.from;
      fromDate = windowRange.from;
    }
    if (toDate > windowRange.to) {
      to = hasTime ? windowRange.to + ' ' + pad(new Date().getHours()) + ':00' : windowRange.to;
      toDate = windowRange.to;
    }
    var empty = fromDate > toDate;
    var truncated = false;
    if (granularity === 'hour' && hasTime && !empty) {
      var currentLimit = windowRange.to + ' ' + pad(new Date().getHours()) + ':00';
      if (to > currentLimit) to = currentLimit;
      if (from > to) empty = true;
      if (!empty && hoursBetween(from, to) > GRAN_LIMITS.hour) {
        from = addHours(to, -(GRAN_LIMITS.hour - 1));
        truncated = true;
      }
    }
    if (granularity === 'day' && !empty && daysBetween(from, to) > GRAN_LIMITS.day) {
      from = addDays(to, -(GRAN_LIMITS.day - 1));
      truncated = true;
    }
    var pointCount = 0;
    if (!empty) {
      if (granularity === 'hour') {
        pointCount = hasTime ? hoursBetween(from, to) : Math.max(0, hourLimitForDate(fromDate) + 1);
      } else if (granularity === 'day') {
        pointCount = daysBetween(from, to);
      } else if (granularity === 'month') {
        var monthCount = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
        if (monthCount > GRAN_LIMITS.month) truncated = true;
        pointCount = Math.min(monthCount, GRAN_LIMITS.month);
      } else {
        var yearCount = Number(toDate.slice(0, 4)) - Number(fromDate.slice(0, 4)) + 1;
        if (yearCount > GRAN_LIMITS.year) truncated = true;
        pointCount = Math.min(yearCount, GRAN_LIMITS.year);
      }
    }
    return {
      granularity: granularity,
      from: from,
      to: to,
      empty: empty,
      truncated: truncated,
      pointCount: pointCount,
      label: GRAN_LABELS[granularity]
    };
  }

  function pointDescriptors(range) {
    if (range.empty) return [];
    var points = [];
    if (range.granularity === 'hour') {
      if (range.from.length > 10 || range.to.length > 10) {
        for (var currentHour = range.from; currentHour <= range.to; currentHour = addHours(currentHour, 1)) {
          points.push({
            label: currentHour.slice(11, 16),
            date: currentHour.slice(0, 10),
            hour: Number(currentHour.slice(11, 13))
          });
        }
      } else {
        var hourLimit = hourLimitForDate(range.from.slice(0, 10));
        for (var hour = 0; hour <= hourLimit; hour++) {
          points.push({
            label: pad(hour) + ':00',
            date: range.from.slice(0, 10),
            hour: hour
          });
        }
      }
      return points;
    }
    if (range.granularity === 'day') {
      for (var day = range.from.slice(0, 10); day <= range.to.slice(0, 10); day = addDays(day, 1)) {
        points.push({ label: day, from: day, to: day });
      }
      return points;
    }
    if (range.granularity === 'month') {
      var monthCursor = range.from.slice(0, 7) + '-01';
      while (monthCursor <= range.to.slice(0, 10)) {
        var monthFrom = monthCursor < range.from.slice(0, 10) ? range.from.slice(0, 10) : monthCursor;
        var monthTo = monthEnd(monthCursor);
        if (monthTo > range.to.slice(0, 10)) monthTo = range.to.slice(0, 10);
        points.push({ label: monthCursor.slice(0, 7), from: monthFrom, to: monthTo });
        monthCursor = shiftMonths(monthCursor, 1).slice(0, 7) + '-01';
      }
      return points.slice(-GRAN_LIMITS.month);
    }
    var yearCursor = Number(range.from.slice(0, 4));
    var yearEnd = Number(range.to.slice(0, 4));
    for (; yearCursor <= yearEnd; yearCursor++) {
      var yearFrom = yearCursor + '-01-01';
      var yearTo = yearCursor + '-12-31';
      if (yearFrom < range.from.slice(0, 10)) yearFrom = range.from.slice(0, 10);
      if (yearTo > range.to.slice(0, 10)) yearTo = range.to.slice(0, 10);
      points.push({ label: String(yearCursor), from: yearFrom, to: yearTo });
    }
    return points.slice(-GRAN_LIMITS.year);
  }

  function queryTrend(options) {
    options = options || {};
    var range = normalizeRange(options.granularity || 'day', options.from, options.to);
    var object = options.object || resolveObject(options.obj || 'project') || resolveObject('project');
    var source = sourceForObject(object, options);
    var points = pointDescriptors(range).map(function (descriptor) {
      var energyCents = 0;
      var runtimeHundredths = 0;
      if (range.granularity === 'hour') {
        energyCents = sourceHourCents(source, descriptor.date, descriptor.hour);
      } else {
        for (var date = descriptor.from; date <= descriptor.to; date = addDays(date, 1)) {
          energyCents += sourceDayCents(source, date);
          runtimeHundredths += sourceDayRuntimeHundredths(source, date);
        }
      }
      return {
        label: descriptor.label,
        energy: round(energyCents / 100, 2),
        runtime: round(runtimeHundredths / 100, 2)
      };
    });
    var totalCents = points.reduce(function (sum, point) {
      return sum + Math.round(point.energy * 100);
    }, 0);
    var runtimeTotal = round(points.reduce(function (sum, point) {
      return sum + point.runtime;
    }, 0), 2);
    var maxPoint = points.reduce(function (best, point) {
      return !best || point.energy > best.energy ? point : best;
    }, null);
    var minPoint = points.reduce(function (best, point) {
      return !best || point.energy < best.energy ? point : best;
    }, null);
    return {
      object: clone(object),
      range: range,
      points: points,
      summary: {
        total: round(totalCents / 100, 2),
        average: points.length ? round(totalCents / 100 / points.length, 2) : null,
        max: maxPoint ? maxPoint.energy : null,
        maxLabel: maxPoint ? maxPoint.label : '--',
        min: minPoint ? minPoint.energy : null,
        minLabel: minPoint ? minPoint.label : '--',
        runtime: runtimeTotal
      }
    };
  }

  function changeRate(current, previous) {
    if (current == null || previous == null || Number(previous) === 0) return null;
    if (Math.abs(Number(previous)) < 1) return null;
    return round((Number(current) - Number(previous)) * 100 / Number(previous), 1);
  }

  function comparisonRange(options, mode) {
    options = options || {};
    var granularity = options.granularity || 'day';
    var from = String(options.from || getDataWindow().to);
    var to = String(options.to || from);
    if (mode === 'yoy') {
      return { from: shiftYears(from, -1), to: shiftYears(to, -1) };
    }
    if (granularity === 'hour' && (from.length > 10 || to.length > 10)) {
      var hourCount = hoursBetween(from, to);
      return { from: addHours(from, -hourCount), to: addHours(from, -1) };
    }
    if (granularity === 'month') {
      var fromDate = dateObj(from);
      var toDate = dateObj(to);
      var monthCount = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + toDate.getMonth() - fromDate.getMonth() + 1;
      return { from: shiftMonths(from, -monthCount), to: shiftMonths(to, -monthCount) };
    }
    if (granularity === 'year') {
      var yearCount = Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1;
      return { from: shiftYears(from, -yearCount), to: shiftYears(to, -yearCount) };
    }
    var dayCount = daysBetween(from, to);
    return { from: addDays(from, -dayCount), to: addDays(from, -1) };
  }

  function pointComparisonRange(options, mode) {
    options = options || {};
    var granularity = options.granularity || 'day';
    var from = String(options.from || getDataWindow().to);
    var to = String(options.to || from);
    if (mode === 'yoy') {
      return { from: shiftYears(from, -1), to: shiftYears(to, -1) };
    }
    if (granularity === 'hour') {
      /* 单日模式（from/to 为纯日期）：环比=昨日同时段 */
      if (from.length <= 10 && to.length <= 10) {
        return { from: addDays(from, -1), to: addDays(to, -1) };
      }
      var hourFrom = from.slice(0, 10) + ' 00:00';
      var hourTo = to.length > 10 ? to : to.slice(0, 10) + ' 23:00';
      return { from: addHours(hourFrom, -1), to: addHours(hourTo, -1) };
    }
    if (granularity === 'month') {
      return { from: shiftMonths(from, -1), to: shiftMonths(to, -1) };
    }
    if (granularity === 'year') {
      return { from: shiftYears(from, -1), to: shiftYears(to, -1) };
    }
    return { from: addDays(from, -1), to: addDays(to, -1) };
  }

  function pointComparisonLabel(label, granularity, mode) {
    if (granularity === 'year') return String(Number(label) - 1);
    if (mode === 'yoy') {
      if (granularity === 'hour') return label;
      if (granularity === 'month') return shiftYears(label + '-01', -1).slice(0, 7);
      return shiftYears(label, -1);
    }
    /* 小时点位按相同时钟标签对齐（今日 08:00 ↔ 昨日/去年同期 08:00） */
    if (granularity === 'hour') return label;
    if (granularity === 'month') return shiftMonths(label + '-01', -1).slice(0, 7);
    return addDays(label, -1);
  }

  function alignPointComparison(current, source, granularity, mode, range) {
    var sourceByLabel = {};
    source.points.forEach(function (point) {
      sourceByLabel[point.label] = point;
    });
    var points = current.points.map(function (point) {
      var expectedLabel = pointComparisonLabel(point.label, granularity, mode);
      var compared = sourceByLabel[expectedLabel];
      return {
        label: expectedLabel,
        energy: compared && compared.energy != null ? compared.energy : null,
        runtime: compared && compared.runtime != null ? compared.runtime : null
      };
    });
    return {
      object: clone(current.object),
      range: Object.assign({}, source.range, range),
      points: points,
      summary: source.summary
    };
  }

  function queryPointComparison(current, options, mode) {
    var granularity = options.granularity || 'day';
    var range = pointComparisonRange(options, mode);
    var windowRange = getDataWindow();
    if (range.to.slice(0, 10) < windowRange.from || range.from.slice(0, 10) > windowRange.to) {
      return emptyComparison(current, range);
    }
    var from = range.from;
    var to = range.to;
    if (from.slice(0, 10) < windowRange.from) {
      from = from.length > 10 ? windowRange.from + ' 00:00' : windowRange.from;
    }
    if (to.slice(0, 10) > windowRange.to) {
      to = to.length > 10 ? windowRange.to + ' 23:00' : windowRange.to;
    }
    var source = queryTrend(Object.assign({}, options, { from: from, to: to }));
    return alignPointComparison(current, source, granularity, mode, range);
  }

  function rangeAvailable(range) {
    var windowRange = getDataWindow();
    return range.from.slice(0, 10) >= windowRange.from && range.to.slice(0, 10) <= windowRange.to;
  }

  function emptyComparison(current, range) {
    return {
      object: clone(current.object),
      range: {
        granularity: current.range.granularity,
        from: range.from,
        to: range.to,
        empty: true,
        label: current.range.label
      },
      points: current.points.map(function (point) {
        return { label: point.label, energy: null, runtime: null };
      }),
      summary: {
        total: null,
        average: null,
        max: null,
        maxLabel: '--',
        min: null,
        minLabel: '--',
        runtime: null
      }
    };
  }

  function queryComparison(options) {
    options = options || {};
    var current = queryTrend(options);
    var momRange = comparisonRange(options, 'mom');
    var yoyRange = comparisonRange(options, 'yoy');
    var mom = rangeAvailable(momRange)
      ? queryTrend(Object.assign({}, options, momRange))
      : emptyComparison(current, momRange);
    var yoy = rangeAvailable(yoyRange)
      ? queryTrend(Object.assign({}, options, yoyRange))
      : emptyComparison(current, yoyRange);
    var includePointComparison = options.pointComparison !== false;
    var pointMom = includePointComparison
      ? queryPointComparison(current, options, 'mom')
      : mom;
    var pointYoy = includePointComparison
      ? alignPointComparison(current, yoy, options.granularity || 'day', 'yoy', yoyRange)
      : yoy;
    var rows = current.points.map(function (point, index) {
      var momPoint = pointMom.points[index] || {};
      var yoyPoint = pointYoy.points[index] || {};
      return {
        label: point.label,
        current: point.energy,
        mom: momPoint.energy == null ? null : momPoint.energy,
        yoy: yoyPoint.energy == null ? null : yoyPoint.energy,
        momRate: changeRate(point.energy, momPoint.energy),
        yoyRate: changeRate(point.energy, yoyPoint.energy),
        runtime: point.runtime
      };
    });
    return { current: current, mom: mom, yoy: yoy, pointMom: pointMom, pointYoy: pointYoy, rows: rows };
  }

  function movingAverage(points, size) {
    return points.map(function (_, index) {
      var start = Math.max(0, index - size + 1);
      var values = points.slice(start, index + 1).map(function (point) {
        return point.energy;
      });
      return round(values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length, 2);
    });
  }

  function getOverview() {
    var today = getDataWindow().to;
    var monthStart = today.slice(0, 7) + '-01';
    var yearStart = today.slice(0, 4) + '-01-01';
    var todayTrend = queryTrend({ obj: 'project', granularity: 'hour', from: today, to: today });
    var monthComparison = queryComparison({ obj: 'project', granularity: 'day', from: monthStart, to: today, pointComparison: false });
    var yearComparison = queryComparison({ obj: 'project', granularity: 'month', from: yearStart, to: today, pointComparison: false });
    var trend = queryTrend({ obj: 'project', granularity: 'day', from: addDays(today, -29), to: today });
    var ranking = getRanking({ dimension: 'room', metric: 'energy', from: monthStart, to: today, limit: 10 });
    var structure = getStructure({ dimension: 'zone', from: monthStart, to: today });
    var load = queryLoad({ date: today, obj: 'project' });
    return {
      updatedAt: today + ' ' + pad(new Date().getHours()) + ':00',
      today: todayTrend.summary,
      month: Object.assign({}, monthComparison.current.summary, { momRate: changeRate(monthComparison.current.summary.total, monthComparison.mom.summary.total) }),
      year: Object.assign({}, yearComparison.current.summary, { yoyRate: changeRate(yearComparison.current.summary.total, yearComparison.yoy.summary.total) }),
      trend: trend.points,
      trendAverage: movingAverage(trend.points, 7),
      ranking: ranking.rows,
      structure: structure.rows,
      load: Object.assign({}, load.summary, { realtime: load.points.length ? load.points[load.points.length - 1].load : null }),
      anomalies: []
    };
  }

  function getRanking(options) {
    options = options || {};
    var type = options.dimension || 'room';
    var metric = options.metric === 'runtime' ? 'runtime' : 'energy';
    var allRows = catalog(type).map(function (item) {
      var result = queryComparison({
        obj: item.id,
        granularity: 'day',
        from: options.from || addDays(getDataWindow().to, -29),
        to: options.to || getDataWindow().to,
        pointComparison: false
      });
      var currentValue = metric === 'runtime' ? result.current.summary.runtime : result.current.summary.total;
      var momValue = metric === 'runtime' ? result.mom.summary.runtime : result.mom.summary.total;
      var yoyValue = metric === 'runtime' ? result.yoy.summary.runtime : result.yoy.summary.total;
      return {
        id: item.id,
        name: item.name,
        energy: result.current.summary.total,
        runtime: result.current.summary.runtime,
        percent: 0,
        momRate: changeRate(currentValue, momValue),
        yoyRate: changeRate(currentValue, yoyValue)
      };
    });
    allRows.sort(function (left, right) {
      return options.order === 'asc' ? left[metric] - right[metric] : right[metric] - left[metric];
    });
    var total = round(allRows.reduce(function (sum, row) {
      return sum + row[metric];
    }, 0), 2);
    allRows.forEach(function (row) {
      row.percent = total ? round(row[metric] * 100 / total, 2) : 0;
    });
    return {
      rows: allRows.slice(0, Number(options.limit || 10)),
      allRows: allRows,
      total: total,
      metric: metric
    };
  }

  function structureItems(dimension) {
    var configuredPublicIds = global.HvacAllocation && global.HvacAllocation.getState
      ? (global.HvacAllocation.getState().publicRoomIds || [])
      : [];
    var rooms = roomRows();
    var publicUnitIds = rooms.filter(function (room) {
      return configuredPublicIds.indexOf(room.rawId) >= 0;
    }).reduce(function (all, room) {
      return all.concat(room.unitIds);
    }, []);
    var publicSet = {};
    publicUnitIds.forEach(function (unitId) {
      publicSet[unitId] = true;
    });
    if (dimension === 'zone') {
      return [
        { id: 'public', name: '公区', type: 'zone', unitIds: publicUnitIds },
        {
          id: 'tenant',
          name: '租户区',
          type: 'zone',
          unitIds: units().filter(function (unit) {
            return !publicSet[unit.uid];
          }).map(function (unit) {
            return unit.uid;
          })
        }
      ];
    }
    var catalogType = dimension === 'building' ? 'building' : dimension === 'floor' ? 'floor' : 'tenant';
    return catalog(catalogType).slice(0, 8);
  }

  function getStructure(options) {
    options = options || {};
    var dimension = options.dimension || 'zone';
    var from = options.from || getDataWindow().to.slice(0, 7) + '-01';
    var to = options.to || getDataWindow().to;
    var previousRange = comparisonRange({ granularity: 'day', from: from, to: to }, 'mom');
    var items = structureItems(dimension);
    var rows = items.map(function (item) {
      var current = queryTrend({ object: item, unitIds: item.unitIds, granularity: 'day', from: from, to: to });
      var previous = rangeAvailable(previousRange)
        ? queryTrend({ object: item, unitIds: item.unitIds, granularity: 'day', from: previousRange.from, to: previousRange.to })
        : null;
      return {
        id: item.id,
        name: item.name,
        energy: current.summary.total,
        previousEnergy: previous ? previous.summary.total : null,
        percent: 0,
        previousPercent: null,
        percentagePointChange: null
      };
    });
    var total = round(rows.reduce(function (sum, row) {
      return sum + row.energy;
    }, 0), 2);
    var previousTotal = round(rows.reduce(function (sum, row) {
      return sum + (row.previousEnergy || 0);
    }, 0), 2);
    rows.forEach(function (row) {
      row.percent = total ? round(row.energy * 100 / total, 2) : 0;
      row.previousPercent = previousTotal && row.previousEnergy != null
        ? round(row.previousEnergy * 100 / previousTotal, 2)
        : null;
      row.percentagePointChange = row.previousPercent == null
        ? null
        : round(row.percent - row.previousPercent, 1);
    });
    return { rows: rows, total: total, previousTotal: previousTotal || null };
  }

  function loadShape(date, count, signature) {
    return Array.from({ length: count }, function (_, index) {
      var hour = Math.floor(index / 4);
      var quarter = index % 4;
      var active = hour >= 8 && hour <= 19 ? 1 : hour >= 20 && hour <= 22 ? 0.55 : 0.18;
      var variation = 0.9 + rand(signature + '|load|' + date + '|' + index) * 0.2;
      return active * variation * (quarter === 0 ? 1.04 : 0.99);
    });
  }

  function buildLoad(options) {
    var date = options.date;
    var object = resolveObject(options.obj || 'project') || resolveObject('project');
    var source = sourceForObject(object, options);
    var energy = round(sourceDayCents(source, date) / 100, 2);
    var now = new Date();
    var pointCount = date === todayText()
      ? Math.min(96, now.getHours() * 4 + Math.floor(now.getMinutes() / 15) + 1)
      : 96;
    if (date > todayText()) pointCount = 0;
    var signature = getProject().name + '|' + object.id;
    var raw = loadShape(date, pointCount, signature);
    var rawIntegral = raw.reduce(function (sum, value) {
      return sum + value * 0.25;
    }, 0);
    var loads = raw.map(function (value) {
      return rawIntegral ? round(value * energy / rawIntegral, 4) : 0;
    });
    if (loads.length) {
      var integrated = loads.reduce(function (sum, value) {
        return sum + value * 0.25;
      }, 0);
      loads[loads.length - 1] = round(loads[loads.length - 1] + (energy - integrated) / 0.25, 4);
    }
    var points = loads.map(function (load, index) {
      var hour = Math.floor(index / 4);
      var quarter = index % 4;
      return {
        label: pad(hour) + ':' + pad(quarter * 15),
        load: load,
        setTemp: round(24 + rand(date + '|set|' + index) * 2, 1),
        roomTemp: round(25 + rand(date + '|room|' + index) * 2, 1)
      };
    });
    var maxPoint = points.reduce(function (best, point) {
      return !best || point.load > best.load ? point : best;
    }, null);
    var average = points.length
      ? round(points.reduce(function (sum, point) {
        return sum + point.load;
      }, 0) / points.length, 2)
      : null;
    return {
      date: date,
      points: points,
      summary: {
        max: maxPoint ? round(maxPoint.load, 2) : null,
        maxAt: maxPoint ? maxPoint.label : '--',
        average: average,
        rate: maxPoint && maxPoint.load ? round(average * 100 / maxPoint.load, 2) : null,
        energy: energy
      }
    };
  }

  function queryLoad(options) {
    options = options || {};
    var date = options.date || getDataWindow().to;
    if (date < getDataWindow().from || date > getDataWindow().to) {
      return {
        date: date,
        points: [],
        summary: {
          max: null,
          maxAt: '--',
          average: null,
          rate: null,
          energy: null,
          yoyMax: null,
          yoyRate: null
        }
      };
    }
    var result = buildLoad(Object.assign({}, options, { date: date }));
    var yoyDate = shiftYears(date, -1);
    var yoy = yoyDate >= getDataWindow().from
      ? buildLoad(Object.assign({}, options, { date: yoyDate }))
      : null;
    result.summary.yoyMax = yoy ? yoy.summary.max : null;
    result.summary.yoyRate = changeRate(result.summary.max, result.summary.yoyMax);
    return result;
  }

  function getReport(options) {
    options = options || {};
    var level = options.level || 'room';
    var granularity = options.granularity || 'day';
    var from = options.from || getDataWindow().to.slice(0, 7) + '-01';
    var to = options.to || getDataWindow().to;
    var list = level === 'project' ? [resolveObject('project')] : catalog(level);
    var rows = list.map(function (item) {
      var comparison = queryComparison({
        obj: item.id,
        granularity: granularity,
        from: from,
        to: to,
        pointComparison: false
      });
      var current = comparison.current.summary;
      return {
        id: item.id,
        name: item.name,
        energy: current.total,
        runtime: current.runtime,
        unitEnergy: current.runtime ? round(current.total / current.runtime, 2) : 0,
        momRate: changeRate(current.total, comparison.mom.summary.total),
        yoyRate: changeRate(current.total, comparison.yoy.summary.total)
      };
    });
    var total = {
      energy: round(rows.reduce(function (sum, row) {
        return sum + row.energy;
      }, 0), 2),
      runtime: round(rows.reduce(function (sum, row) {
        return sum + row.runtime;
      }, 0), 2)
    };
    return {
      rows: rows,
      total: total,
      granularity: granularity,
      range: { from: from, to: to }
    };
  }

  function groupStorageKey(prefix) {
    return prefix + ':' + projectName();
  }

  function normalizeGroup(group) {
    var type = group && group.type === 'meter' ? 'meter' : 'room';
    var memberIds = Array.isArray(group && group.memberIds)
      ? group.memberIds
      : Array.isArray(group && group.roomIds)
        ? group.roomIds
        : [];
    return {
      id: group.id,
      type: type,
      name: String(group.name || ''),
      memberIds: Array.from(new Set(memberIds)),
      remark: String(group.remark || ''),
      createdAt: group.createdAt || todayText() + ' 10:00'
    };
  }

  function readGroups(key) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      return Array.isArray(saved) ? saved.map(normalizeGroup) : null;
    } catch (error) {
      return null;
    }
  }

  function persistGroups(groups) {
    global.localStorage.setItem(groupStorageKey(GROUP_KEY), JSON.stringify(groups));
  }

  function listGroups() {
    var current = readGroups(groupStorageKey(GROUP_KEY));
    if (current) return clone(current);
    var legacy = readGroups(groupStorageKey(LEGACY_GROUP_KEY));
    if (legacy) {
      persistGroups(legacy);
      return clone(legacy);
    }
    if (!getProject().hasMeters) return [];
    var rooms = roomRows();
    var meters = meterRows();
    var seeded = [
      {
        id: 'g-office',
        type: 'room',
        name: '办公核心区',
        memberIds: rooms.slice(0, 5).map(function (room) {
          return room.id;
        }),
        remark: '工作日重点分析区域',
        createdAt: todayText() + ' 09:00'
      },
      {
        id: 'g-public',
        type: 'room',
        name: '公区巡检区',
        memberIds: rooms.filter(function (_, index) {
          return index % 13 === 0;
        }).slice(0, 4).map(function (room) {
          return room.id;
        }),
        remark: '公共区域用能',
        createdAt: todayText() + ' 10:30'
      },
      {
        id: 'g-meters',
        type: 'meter',
        name: '重点电表组合',
        memberIds: meters.slice(0, 3).map(function (meter) {
          return meter.id;
        }),
        remark: '重点回路统计',
        createdAt: todayText() + ' 14:20'
      }
    ];
    persistGroups(seeded);
    return clone(seeded);
  }

  function saveGroup(input) {
    input = input || {};
    var type = input.type === 'meter' ? 'meter' : input.type === 'room' ? 'room' : '';
    if (!type) throw new Error('请选择群组类型');
    var name = String(input.name || '').trim();
    if (!name) throw new Error('请输入群组名称');
    if (name.length > 20) throw new Error('群组名称不能超过20字');
    var memberIds = Array.from(new Set(input.memberIds || input.roomIds || []));
    if (!memberIds.length) throw new Error(type === 'meter' ? '请选择至少一个电表' : '请选择至少一个房间');
    var sourceCatalog = catalog(type);
    var invalid = memberIds.filter(function (memberId) {
      return !sourceCatalog.some(function (entry) {
        return entry.id === memberId;
      });
    });
    if (invalid.length) {
      throw new Error(type === 'meter' ? '电表群组只能选择电表成员' : '房间群组只能选择房间成员');
    }
    var groups = listGroups();
    if (groups.some(function (group) {
      return group.name === name && group.id !== input.id;
    })) {
      throw new Error('群组名称已存在');
    }
    var item = {
      id: input.id || 'g-' + Date.now(),
      type: type,
      name: name,
      memberIds: memberIds,
      remark: String(input.remark || '').slice(0, 50),
      createdAt: input.createdAt || todayText() + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes())
    };
    var index = groups.findIndex(function (group) {
      return group.id === item.id;
    });
    if (index >= 0) groups[index] = item;
    else groups.push(item);
    persistGroups(groups);
    return clone(item);
  }

  function deleteGroup(id) {
    var groups = listGroups().filter(function (group) {
      return group.id !== id;
    });
    persistGroups(groups);
    return clone(groups);
  }

  global.HvacEnergy = {
    GRAN_LABELS: GRAN_LABELS,
    getProject: getProject,
    refreshProject: refreshProject,
    getGranularities: getGranularities,
    getDataWindow: getDataWindow,
    getCatalog: getCatalog,
    normalizeRange: normalizeRange,
    queryTrend: queryTrend,
    comparisonRange: comparisonRange,
    queryComparison: queryComparison,
    changeRate: changeRate,
    getOverview: getOverview,
    getRanking: getRanking,
    getStructure: getStructure,
    queryLoad: queryLoad,
    getReport: getReport,
    listGroups: listGroups,
    saveGroup: saveGroup,
    deleteGroup: deleteGroup,
    resolveObject: resolveObject,
    formatNumber: formatNumber
  };

  if (typeof document !== 'undefined' && !getProject().hasMeters) {
    document.body.classList.add('energy-no-meter');
    var noMeter = document.createElement('div');
    noMeter.id = 'noMeterState';
    noMeter.className = 'energy-no-meter-state';
    noMeter.innerHTML = '<div class="energy-no-meter-icon">⚡</div><div class="energy-no-meter-title">当前项目未配置电表</div><div class="energy-no-meter-text">暂无可分析的能耗数据，请切换至已配置电表的项目。</div><button class="btn btnp" onclick="parent.postMessage({nav:\'overview-big\'},\'*\')">返回项目总览</button>';
    document.body.appendChild(noMeter);
  }
})(window);
