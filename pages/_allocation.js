(function (global) {
  'use strict';

  var KEY = 'hvacCommonAreaState:v1';
  var EVENT = 'hvac-allocation-change';
  var ROOMS = [
    { id: '1号楼|8层|8层电梯厅', bld: '1号楼', fl: '8层', room: '8层电梯厅' },
    { id: '1号楼|8层|803会议室', bld: '1号楼', fl: '8层', room: '803会议室' },
    { id: '1号楼|9层|9层电梯厅', bld: '1号楼', fl: '9层', room: '9层电梯厅' },
    { id: '1号楼|13层|中走廊', bld: '1号楼', fl: '13层', room: '中走廊' },
    { id: '1号楼|14层|14层走廊', bld: '1号楼', fl: '14层', room: '14层走廊' },
    { id: '1号楼|8层|801', bld: '1号楼', fl: '8层', room: '801' },
    { id: '1号楼|8层|802', bld: '1号楼', fl: '8层', room: '802' },
    { id: '1号楼|9层|901', bld: '1号楼', fl: '9层', room: '901' },
    { id: '1号楼|13层|1301', bld: '1号楼', fl: '13层', room: '1301' },
    { id: '1号楼|14层|1404', bld: '1号楼', fl: '14层', room: '1404' },
    { id: '1号楼|9层|中间北区', bld: '1号楼', fl: '9层', room: '中间北区' }
  ];
  var TENANTS = [
    '物业', '901会议室', '916会议室', '912会议室', '910会议室', '908会议室', '人资部', '818',
    '816会议室', '808会议室', '801会议室内', '801会议室', '803会议室', '老板办公室', '硬件焊接室818',
    '产品部', '中弘网关事业部', '工业节能事业部', '应用技术部', '飞奕事业部', '中间北区', '西北区',
    '电梯厅', '906会议室', '8层电梯厅', '806会议室', '810会议室', '812会议室', '软件研发',
    '硬件研发', '财务部', '质量部', '运营部', '东1排', '制造部', '测试部', '车库实验室'
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sum(values) {
    return values.reduce(function (total, value) {
      return total + Number(value || 0);
    }, 0);
  }

  function nowText() {
    var date = new Date();
    function pad(value) { return String(value).padStart(2, '0'); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function parseRoomId(roomId) {
    if (typeof roomId !== 'string') return null;
    var parts = roomId.split('|');
    if (parts.length !== 3 || parts.some(function (part) { return !part.trim(); })) return null;
    return { id: roomId, bld: parts[0], fl: parts[1], room: parts[2] };
  }

  function resolveRoom(roomId) {
    return ROOMS.find(function (room) { return room.id === roomId; }) || parseRoomId(roomId);
  }

  function seedRules() {
    return [
      {
        id: 'rule-office',
        name: '公区分摊规则测试1',
        dimension: 'tenant',
        method: 'ratio',
        publicRoomIds: ['1号楼|9层|中间北区'],
        participantIds: ['tenant:应用技术部', 'tenant:飞奕事业部', 'tenant:硬件研发'],
        ratios: {
          'tenant:应用技术部': 40,
          'tenant:飞奕事业部': 50,
          'tenant:硬件研发': 10
        },
        createdAt: '2026-07-15 13:14:11',
        updatedAt: '2026-07-15 13:14:11'
      },
      {
        id: 'rule-property',
        name: '9楼电梯厅公区分摊规则',
        dimension: 'tenant',
        method: 'ratio',
        publicRoomIds: ['1号楼|9层|9层电梯厅'],
        participantIds: ['tenant:人资部', 'tenant:中弘网关事业部', 'tenant:工业节能事业部', 'tenant:应用技术部', 'tenant:飞奕事业部'],
        ratios: {
          'tenant:人资部': 20,
          'tenant:中弘网关事业部': 20,
          'tenant:工业节能事业部': 20,
          'tenant:应用技术部': 20,
          'tenant:飞奕事业部': 20
        },
        createdAt: '2026-07-15 13:15:11',
        updatedAt: '2026-07-15 13:15:11'
      }
    ];
  }

  function usageForRule(rule, ruleIndex) {
    var dates = ['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15'];
    var rows = [];
    var usageWeights = rule.participantIds.map(function (participantId, participantIndex) {
      if (rule.method === 'ratio') return Number(rule.ratios[participantId] || 0);
      return [38, 34, 28][participantIndex] || 1;
    });
    var weightTotal = sum(usageWeights);
    rule.publicRoomIds.forEach(function (roomId, roomIndex) {
      var room = resolveRoom(roomId);
      if (!room) return;
      rule.participantIds.forEach(function (participantId, participantIndex) {
        dates.forEach(function (date, dateIndex) {
          var ratio = rule.method === 'ratio'
            ? usageWeights[participantIndex]
            : Number((usageWeights[participantIndex] * 100 / weightTotal).toFixed(2));
          var totalUse = 18 + ruleIndex * 6 + roomIndex * 4 + dateIndex * 1.35;
          var use = Number((totalUse * ratio / 100).toFixed(2));
          rows.push({
            date: date,
            ruleId: rule.id,
            publicRoomId: roomId,
            publicRoom: room.bld + ' ' + room.fl + ' ' + room.room,
            participantId: participantId,
            participant: participantId.slice(participantId.indexOf(':') + 1),
            dimension: rule.dimension,
            ratio: ratio,
            use: use,
            fee: Number((use * 0.918).toFixed(2))
          });
        });
      });
    });
    return rows;
  }

  function seedUsage() {
    var rows = [];
    seedRules().forEach(function (rule, ruleIndex) {
      rows = rows.concat(usageForRule(rule, ruleIndex));
    });
    return rows;
  }

  function seedState() {
    return {
      version: 1,
      projectDimension: 'tenant',
      publicRoomIds: ['1号楼|9层|中间北区', '1号楼|9层|9层电梯厅'],
      rules: seedRules(),
      usage: seedUsage()
    };
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    global.dispatchEvent(new CustomEvent(EVENT, { detail: clone(state) }));
    return clone(state);
  }

  function load() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return save(seedState());
    try {
      var state = JSON.parse(raw);
      if (!state || state.version !== 1 || !Array.isArray(state.rules)) return save(seedState());
      return state;
    } catch (error) {
      return save(seedState());
    }
  }

  function getState() {
    return clone(load());
  }

  function setPublicRoom(roomId, enabled) {
    var state = load();
    state.publicRoomIds = state.publicRoomIds.filter(function (id) { return id !== roomId; });
    if (enabled && resolveRoom(roomId)) state.publicRoomIds.push(roomId);
    save(state);
    return getState();
  }

  function validateRule(rule, editingId) {
    var state = load();
    if (!rule.name || !rule.name.trim()) return { ok: false, message: '请输入规则名称' };
    if (!rule.publicRoomIds || !rule.publicRoomIds.length) return { ok: false, message: '请选择公区空调房间' };
    if (!rule.participantIds || !rule.participantIds.length) {
      return { ok: false, message: rule.dimension === 'room' ? '请选择参与分摊的房间' : '请选择参与分摊的租户' };
    }
    if (state.projectDimension && state.projectDimension !== rule.dimension) {
      return { ok: false, message: '当前项目分摊维度已锁定' };
    }
    var occupied = state.rules.find(function (saved) {
      return saved.id !== editingId && saved.publicRoomIds.some(function (roomId) {
        return rule.publicRoomIds.indexOf(roomId) >= 0;
      });
    });
    if (occupied) return { ok: false, message: '所选公区房间已被规则占用：「' + occupied.name + '」' };
    if (rule.dimension === 'room') {
      var publicParticipant = rule.participantIds.find(function (participantId) {
        return participantId.indexOf('room:') === 0 && state.publicRoomIds.indexOf(participantId.slice(5)) >= 0;
      });
      if (publicParticipant) return { ok: false, message: '参与分摊的房间不能是公区房间' };
    }
    if (rule.method === 'ratio') {
      var total = sum(rule.participantIds.map(function (id) { return rule.ratios && rule.ratios[id]; }));
      if (Math.abs(total - 100) > 0.001) {
        return { ok: false, message: '分摊比例之和须为100%，当前为' + total.toFixed(2) + '%' };
      }
    }
    return { ok: true };
  }

  function saveRule(rule) {
    var savedRule = clone(rule);
    if (!savedRule.id) savedRule.id = 'rule-' + Date.now();
    var check = validateRule(savedRule, savedRule.id);
    if (!check.ok) throw new Error(check.message);
    var state = load();
    if (!state.projectDimension) state.projectDimension = savedRule.dimension;
    var index = state.rules.findIndex(function (item) { return item.id === savedRule.id; });
    savedRule.createdAt = index < 0
      ? (savedRule.createdAt || nowText())
      : (savedRule.createdAt || state.rules[index].createdAt || state.rules[index].updatedAt || nowText());
    savedRule.updatedAt = nowText();
    if (index < 0) state.rules.push(savedRule); else state.rules[index] = savedRule;
    var ruleIndex = index < 0 ? state.rules.length - 1 : index;
    state.usage = (state.usage || []).filter(function (row) { return row.ruleId !== savedRule.id; });
    state.usage = state.usage.concat(usageForRule(savedRule, ruleIndex));
    save(state);
    return clone(savedRule);
  }

  function deleteRule(ruleId) {
    var state = load();
    state.rules = state.rules.filter(function (rule) { return rule.id !== ruleId; });
    state.usage = (state.usage || []).filter(function (row) { return row.ruleId !== ruleId; });
    if (!state.rules.length) state.projectDimension = null;
    return save(state);
  }

  function getAvailablePublicRooms(editingId) {
    var state = load();
    return state.publicRoomIds.map(resolveRoom).filter(Boolean).map(function (room) {
      var owner = state.rules.find(function (rule) {
        return rule.id !== editingId && rule.publicRoomIds.indexOf(room.id) >= 0;
      });
      var option = clone(room);
      option.label = room.bld + ' / ' + room.fl + ' / ' + room.room;
      option.disabled = Boolean(owner);
      option.occupiedBy = owner ? owner.name : '';
      return option;
    });
  }

  function getParticipants(dimension) {
    var state = load();
    if (dimension === 'tenant') {
      return TENANTS.map(function (tenant) {
        return { id: 'tenant:' + tenant, label: tenant, tenant: tenant };
      });
    }
    return ROOMS.filter(function (room) {
      return state.publicRoomIds.indexOf(room.id) < 0;
    }).map(function (room) {
      return {
        id: 'room:' + room.id,
        label: room.bld + ' / ' + room.fl + ' / ' + room.room,
        bld: room.bld,
        fl: room.fl,
        room: room.room
      };
    });
  }

  function groupRows(rows, keys) {
    var grouped = {};
    var order = [];
    rows.forEach(function (row) {
      var key = keys.map(function (name) { return String(row[name] == null ? '' : row[name]); }).join('\u001f');
      if (!grouped[key]) {
        grouped[key] = clone(row);
        grouped[key].use = 0;
        grouped[key].fee = 0;
        order.push(key);
      }
      grouped[key].use += Number(row.use || 0);
      grouped[key].fee += Number(row.fee || 0);
    });
    return order.map(function (key) {
      grouped[key].use = Number(grouped[key].use.toFixed(2));
      grouped[key].fee = Number(grouped[key].fee.toFixed(2));
      return grouped[key];
    });
  }

  function queryDetails(query) {
    query = query || {};
    var state = load();
    var mode = query.mode === 'participant' ? 'participant' : 'public';
    var activeRules = {};
    state.rules.forEach(function (rule) { activeRules[rule.id] = rule; });
    var rows = state.usage.filter(function (row) {
      var rule = activeRules[row.ruleId];
      return rule &&
        rule.publicRoomIds.indexOf(row.publicRoomId) >= 0 &&
        rule.participantIds.indexOf(row.participantId) >= 0 &&
        (!query.start || row.date >= query.start) &&
        (!query.end || row.date <= query.end) &&
        (!query.targetId || (mode === 'public' ? row.publicRoomId === query.targetId : row.participantId === query.targetId));
    });
    var keys = mode === 'public'
      ? ['publicRoomId', 'participantId', 'ratio']
      : ['participantId', 'publicRoomId', 'ratio'];
    var resultRows = groupRows(rows, keys).map(function (row) {
      return {
        targetId: mode === 'public' ? row.participantId : row.publicRoomId,
        target: mode === 'public' ? row.participant : row.publicRoom,
        ratio: row.ratio,
        use: row.use,
        fee: row.fee
      };
    });
    return {
      mode: mode,
      headers: mode === 'public'
        ? ['参与分摊对象', '分摊比例', '承担用量(kWh)', '承担费用(元)']
        : ['公区房间', '分摊比例', '承担用量(kWh)', '承担费用(元)'],
      rows: resultRows
    };
  }

  function aggregateBilling(rows, mode) {
    return mode === 'room' ? clone(rows) : groupRows(rows, ['tenant']);
  }

  function aggregateDaily(rows, mode) {
    if (mode === 'unit') return clone(rows);
    return groupRows(rows, mode === 'room' ? ['date', 'tenant', 'room'] : ['date', 'tenant']);
  }

  function subscribe(callback) {
    function onCustom(event) { callback(clone(event.detail || load())); }
    function onStorage(event) { if (event.key === KEY) callback(getState()); }
    global.addEventListener(EVENT, onCustom);
    global.addEventListener('storage', onStorage);
    return function () {
      global.removeEventListener(EVENT, onCustom);
      global.removeEventListener('storage', onStorage);
    };
  }

  global.HvacAllocation = {
    KEY: KEY,
    rooms: clone(ROOMS),
    tenants: TENANTS.slice(),
    getState: getState,
    reset: function () { return save(seedState()); },
    setPublicRoom: setPublicRoom,
    validateRule: validateRule,
    saveRule: saveRule,
    deleteRule: deleteRule,
    getAvailablePublicRooms: getAvailablePublicRooms,
    getParticipants: getParticipants,
    queryDetails: queryDetails,
    aggregateBilling: aggregateBilling,
    aggregateDaily: aggregateDaily,
    subscribe: subscribe
  };
})(window);
