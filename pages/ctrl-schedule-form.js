(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ScheduleForm = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseDate(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }

  function roomsForSelection(selection, tree) {
    if (!selection || !selection.fl) return [];
    if (selection.room) return [selection.bld + '/' + selection.fl + '/' + selection.room];
    var building = (tree || []).find(function (item) { return item.lb === selection.bld; });
    var floor = building && (building.floors || []).find(function (item) { return item.lb === selection.fl; });
    return floor ? floor.rooms.map(function (room) {
      return selection.bld + '/' + selection.fl + '/' + room;
    }) : [];
  }

  function enabledWeekdays(startValue, endValue) {
    var start = parseDate(startValue);
    var end = parseDate(endValue);
    if (!start || !end || start > end) return [];
    var weekdays = new Set();
    for (var date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      weekdays.add(date.getDay());
      if (weekdays.size === 7) break;
    }
    return Array.from(weekdays).sort(function (left, right) { return left - right; });
  }

  function applyWeekPreset(selected, enabled, preset) {
    var enabledSet = new Set(enabled || []);
    if (preset === 'clear') return [];
    var target = preset === 'workdays' ? [1, 2, 3, 4, 5] : [6, 0];
    return target.filter(function (day) { return enabledSet.has(day); });
  }

  function validateDraft(draft) {
    if (!String(draft.name || '').trim()) return '请填写任务名称';
    if (!draft.vs || !draft.ve) return '请选择执行日期';
    if (!draft.hour) return '请选择执行时间的小时';
    if (!draft.minute) return '请选择执行时间的分钟';
    if (!(draft.rooms || []).length) return '请选择房间';
    if (draft.act === '开机' && !draft.mode) return '请选择空调模式';
    return '';
  }

  return {
    roomsForSelection: roomsForSelection,
    enabledWeekdays: enabledWeekdays,
    applyWeekPreset: applyWeekPreset,
    validateDraft: validateDraft,
  };
}));
