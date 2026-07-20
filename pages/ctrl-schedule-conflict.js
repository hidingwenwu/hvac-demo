(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ScheduleConflict = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeTime(value) {
    var parts = String(value || '').split(':');
    if (parts.length < 2) return '';
    return [parts[0].padStart(2, '0'), parts[1].padStart(2, '0'), (parts[2] || '00').padStart(2, '0')].join(':');
  }

  function parseDate(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }

  function formatDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function runsOn(task, date, dateKey) {
    if ((task.excludeDates || []).indexOf(dateKey) >= 0) return false;
    var days = task.days || [];
    return !days.length || days.indexOf(date.getDay()) >= 0;
  }

  function hasSharedOccurrence(left, right) {
    var leftStart = parseDate(left.vs);
    var leftEnd = parseDate(left.ve);
    var rightStart = parseDate(right.vs);
    var rightEnd = parseDate(right.ve);
    if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;

    var start = new Date(Math.max(leftStart.getTime(), rightStart.getTime()));
    var end = new Date(Math.min(leftEnd.getTime(), rightEnd.getTime()));
    if (start > end) return false;

    for (var date = start; date <= end; date.setDate(date.getDate() + 1)) {
      var dateKey = formatDate(date);
      if (runsOn(left, date, dateKey) && runsOn(right, date, dateKey)) return true;
    }
    return false;
  }

  function findConflictRooms(candidate, tasks) {
    var conflicts = new Set();
    var candidateRooms = candidate.rooms || [];

    (tasks || []).forEach(function (task) {
      if (normalizeTime(task.time) !== normalizeTime(candidate.time)) return;
      if (!hasSharedOccurrence(candidate, task)) return;
      var taskRooms = new Set(task.rooms || []);
      candidateRooms.forEach(function (room) {
        if (taskRooms.has(room)) conflicts.add(room);
      });
    });

    return Array.from(conflicts);
  }

  return {
    findConflictRooms: findConflictRooms,
    hasSharedOccurrence: hasSharedOccurrence,
  };
}));
