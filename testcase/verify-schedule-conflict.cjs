const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { findConflictRooms } = require('../pages/ctrl-schedule-conflict.js');
const {
  roomsForSelection,
  enabledWeekdays,
  applyWeekPreset,
  validateDraft,
} = require('../pages/ctrl-schedule-form.js');

function task(overrides = {}) {
  return {
    time: '08:00:00',
    vs: '2026-07-20',
    ve: '2026-07-26',
    days: [1, 2, 3, 4, 5],
    rooms: ['1号楼/7层/707'],
    ...overrides,
  };
}

const buildingTree = [{
  lb: '博研楼',
  floors: [
    { lb: '8F', rooms: ['806', '808', '810', '812'] },
    { lb: '9F', rooms: ['903', '906'] },
  ],
}];

function validDraft(overrides = {}) {
  return {
    name: '工作日开机',
    vs: '2026-07-20',
    ve: '2026-07-31',
    hour: '08',
    minute: '00',
    rooms: ['博研楼/8F/806'],
    act: '关机',
    mode: '',
    wind: '',
    ...overrides,
  };
}

test('楼层选择预选该层全部房间', () => {
  assert.deepEqual(roomsForSelection({ bld: '博研楼', fl: '8F' }, buildingTree), [
    '博研楼/8F/806',
    '博研楼/8F/808',
    '博研楼/8F/810',
    '博研楼/8F/812',
  ]);
});

test('单个房间选择只预选该房间', () => {
  assert.deepEqual(roomsForSelection({ bld: '博研楼', fl: '8F', room: '806' }, buildingTree), [
    '博研楼/8F/806',
  ]);
  assert.deepEqual(roomsForSelection(null, buildingTree), []);
  assert.deepEqual(roomsForSelection({ bld: '博研楼' }, buildingTree), []);
});

test('日期范围只启用其中实际出现的星期', () => {
  assert.deepEqual(enabledWeekdays('2026-07-20', '2026-07-21'), [1, 2]);
  assert.deepEqual(enabledWeekdays('2026-07-20', '2026-07-26'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(enabledWeekdays('', '2026-07-21'), []);
});

test('星期快捷操作只选择当前已启用星期', () => {
  assert.deepEqual(applyWeekPreset([2], [1, 2, 6], 'workdays'), [1, 2]);
  assert.deepEqual(applyWeekPreset([1], [1, 2, 6], 'weekend'), [6]);
  assert.deepEqual(applyWeekPreset([1, 2], [1, 2, 6], 'clear'), []);
});

test('表单校验顺序与现网一致', () => {
  assert.equal(validateDraft(validDraft({ name: '' })), '请填写任务名称');
  assert.equal(validateDraft(validDraft({ vs: '' })), '请选择执行日期');
  assert.equal(validateDraft(validDraft({ hour: '' })), '请选择执行时间的小时');
  assert.equal(validateDraft(validDraft({ minute: '' })), '请选择执行时间的分钟');
  assert.equal(validateDraft(validDraft({ rooms: [] })), '请选择房间');
});

test('开机要求模式但不要求风速', () => {
  assert.equal(validateDraft(validDraft({ act: '开机', mode: '' })), '请选择空调模式');
  assert.equal(validateDraft(validDraft({ act: '开机', mode: '制冷', wind: '' })), '');
});

test('同一时间、共同执行日和重叠房间会返回冲突房间', () => {
  const candidate = task({ rooms: ['1号楼/7层/707'] });
  const existing = task({ rooms: ['1号楼/7层/707', '1号楼/7层/713'] });

  assert.deepEqual(findConflictRooms(candidate, [existing]), ['1号楼/7层/707']);
});

test('时间点不同不构成冲突，即使相差不超过30分钟', () => {
  const existing = task({ time: '08:00:00' });

  assert.deepEqual(findConflictRooms(task({ time: '08:01:00' }), [existing]), []);
  assert.deepEqual(findConflictRooms(task({ time: '08:29:00' }), [existing]), []);
  assert.deepEqual(findConflictRooms(task({ time: '08:30:00' }), [existing]), []);
});

test('日期区间相交但没有共同执行星期不构成冲突', () => {
  const candidate = task({ vs: '2026-07-20', ve: '2026-07-21', days: [1] });
  const existing = task({ vs: '2026-07-20', ve: '2026-07-21', days: [2] });

  assert.deepEqual(findConflictRooms(candidate, [existing]), []);
});

test('同一时间和共同执行日但房间不重叠不构成冲突', () => {
  const candidate = task({ rooms: ['1号楼/7层/707'] });
  const existing = task({ rooms: ['1号楼/7层/713'] });

  assert.deepEqual(findConflictRooms(candidate, [existing]), []);
});

test('多个任务命中时按候选任务房间顺序去重', () => {
  const candidate = task({
    rooms: ['1号楼/7层/707', '1号楼/7层/713', '1号楼/7层/产品部'],
  });
  const tasks = [
    task({ rooms: ['1号楼/7层/713', '1号楼/7层/707'] }),
    task({ rooms: ['1号楼/7层/707', '1号楼/7层/产品部'] }),
  ];

  assert.deepEqual(findConflictRooms(candidate, tasks), [
    '1号楼/7层/707',
    '1号楼/7层/713',
    '1号楼/7层/产品部',
  ]);
});

test('有效日期交集边界当天共同执行时构成冲突', () => {
  const candidate = task({ vs: '2026-07-20', ve: '2026-07-22', days: [3] });
  const existing = task({ vs: '2026-07-22', ve: '2026-07-24', days: [3] });

  assert.deepEqual(findConflictRooms(candidate, [existing]), ['1号楼/7层/707']);
});

test('无有效日期交集时不构成冲突', () => {
  const candidate = task({ vs: '2026-07-20', ve: '2026-07-22', days: [3] });
  const existing = task({ vs: '2026-07-23', ve: '2026-07-24', days: [4] });

  assert.deepEqual(findConflictRooms(candidate, [existing]), []);
});

test('未选择周运行时间时按日期范围内每天执行', () => {
  const candidate = task({
    days: [],
    rooms: ['博研楼/8F/806'],
    vs: '2026-07-20',
    ve: '2026-07-20',
  });
  const existing = task({
    days: [],
    rooms: ['博研楼/8F/806'],
    vs: '2026-07-20',
    ve: '2026-07-20',
  });

  assert.deepEqual(findConflictRooms(candidate, [existing]), ['博研楼/8F/806']);
});

test('任一任务排除的日期不参与冲突', () => {
  const candidate = task({
    days: [1],
    rooms: ['博研楼/8F/806'],
    vs: '2026-07-20',
    ve: '2026-07-20',
    excludeDates: ['2026-07-20'],
  });
  const existing = task({
    days: [1],
    rooms: ['博研楼/8F/806'],
    vs: '2026-07-20',
    ve: '2026-07-20',
  });

  assert.deepEqual(findConflictRooms(candidate, [existing]), []);
  assert.deepEqual(findConflictRooms(existing, [{ ...candidate, excludeDates: ['2026-07-20'] }]), []);
});

test('日程页面包含非阻断冲突确认流程', () => {
  const html = readFileSync(join(__dirname, '..', 'pages', 'ctrl-schedule.html'), 'utf8');

  assert.match(html, /<script src="ctrl-schedule-conflict\.js"><\/script>/);
  assert.match(html, /您当前设置的时间已存在其他日程任务，继续创建可能出现空调控制指令冲突，涉及房间/);
  assert.match(html, /请核对后确认：是否仍要继续创建当前日程任务？/);
  assert.match(html, />取消<\/button>/);
  assert.match(html, />继续创建<\/button>/);
  assert.match(html, /ScheduleConflict\.findConflictRooms\(data,\s*TASKS\)/);
  assert.match(html, /function continueConflictCreation\(\)/);
  assert.match(html, /persistTask\(data\)/);
});

test('新建任务必须选择楼层或房间并保存解析后的房间列表', () => {
  const html = readFileSync(join(__dirname, '..', 'pages', 'ctrl-schedule.html'), 'utf8');

  assert.match(html, /function roomsForSelection\(selection\)/);
  assert.match(html, /请先选择楼层或房间/);
  assert.match(html, /rooms:\s*rooms/);
  assert.match(html, /if\s*\(editId\s*>\s*-1\)\s*return persistTask\(data\);[\s\S]*findConflictRooms/);
});
