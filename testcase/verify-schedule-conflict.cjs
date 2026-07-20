const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { findConflictRooms } = require('../pages/ctrl-schedule-conflict.js');
const {
  roomsForSelection,
  filterTasksBySelection,
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

test('楼层选择解析该层全部房间', () => {
  assert.deepEqual(roomsForSelection({ bld: '博研楼', fl: '8F' }, buildingTree), [
    '博研楼/8F/806',
    '博研楼/8F/808',
    '博研楼/8F/810',
    '博研楼/8F/812',
  ]);
});

test('单个房间选择只解析该房间', () => {
  assert.deepEqual(roomsForSelection({ bld: '博研楼', fl: '8F', room: '806' }, buildingTree), [
    '博研楼/8F/806',
  ]);
  assert.deepEqual(roomsForSelection(null, buildingTree), []);
  assert.deepEqual(roomsForSelection({ bld: '博研楼' }, buildingTree), [
    '博研楼/8F/806',
    '博研楼/8F/808',
    '博研楼/8F/810',
    '博研楼/8F/812',
    '博研楼/9F/903',
    '博研楼/9F/906',
  ]);
});

test('左侧建筑树只筛选已有任务', () => {
  const tasks = [
    task({ rooms: ['博研楼/8F/806'] }),
    task({ rooms: ['博研楼/9F/903'] }),
    task({ rooms: ['其他楼/7F/707'] }),
  ];

  assert.deepEqual(filterTasksBySelection(tasks, null, buildingTree), tasks);
  assert.deepEqual(filterTasksBySelection(tasks, { bld: '博研楼' }, buildingTree), tasks.slice(0, 2));
  assert.deepEqual(filterTasksBySelection(tasks, { bld: '博研楼', fl: '8F' }, buildingTree), [tasks[0]]);
  assert.deepEqual(filterTasksBySelection(tasks, { bld: '博研楼', fl: '9F', room: '903' }, buildingTree), [tasks[1]]);
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
  assert.equal(validateDraft(validDraft({ act: '' })), '请选择指令动作');
});

test('开机要求模式但不要求风速', () => {
  assert.equal(validateDraft(validDraft({ act: '开机', mode: '' })), '请选择空调模式');
  assert.equal(validateDraft(validDraft({ act: '开机', mode: '制冷', wind: '' })), '');
});

test('锁定设定按现网顺序校验锁定项和子选项', () => {
  assert.equal(validateDraft(validDraft({ act: '锁定设定', lockTypes: [] })), '请选择至少一个锁定项');
  assert.equal(validateDraft(validDraft({
    act: '锁定设定', lockTypes: ['onOff'], lockOnOff: '',
  })), '请选择锁定开机或者关机');
  assert.equal(validateDraft(validDraft({
    act: '锁定设定', lockTypes: ['mode'], lockModes: [],
  })), '请选择锁定制冷或制热或送风或除湿');
  assert.equal(validateDraft(validDraft({
    act: '锁定设定', lockTypes: ['temperature'], lockTempLow: 16, lockTempHigh: 31,
  })), '');
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

test('创建弹窗复刻现网字段与最新冲突文案', () => {
  const html = readFileSync(join(__dirname, '..', 'pages', 'ctrl-schedule.html'), 'utf8');

  assert.match(html, /<script src="ctrl-schedule-form\.js"><\/script>/);
  assert.match(html, /<script src="ctrl-schedule-conflict\.js"><\/script>/);
  assert.match(html, /schedule-task-dialog/);
  assert.match(html, /schedule-task-dialog\{[^}]*width:920px;[^}]*height:690px;[^}]*overflow:hidden/);
  assert.match(html, /schedule-task-body\{[^}]*overflow-y:auto/);
  assert.match(html, /请选择群组/);
  assert.match(html, /id="taskRoomTree"/);
  assert.match(html, /请输入任务名称/);
  assert.match(html, /请输入内容/);
  assert.match(html, /请选择小时/);
  assert.match(html, /请选择分钟/);
  assert.match(html, /关机并锁定/);
  assert.match(html, /解锁并开机/);
  assert.match(html, /锁定设定/);
  assert.match(html, /是否开关锁定/);
  assert.match(html, /锁定开机/);
  assert.match(html, /锁定关机/);
  assert.match(html, /是否模式锁定/);
  assert.match(html, /是否温度锁定/);
  assert.match(html, /温度上限/);
  assert.match(html, /温度下限/);
  assert.match(html, /renderLockSettings\(\)/);
  assert.match(html, /lockTypes:\s*selectedLockTypes\.slice\(\)/);
  assert.match(html, /工作日/);
  assert.match(html, /排除节假日/);
  assert.match(html, /您当前设置的时间已存在其他日程任务，继续保存可能出现空调控制指令冲突，涉及房间/);
  assert.match(html, /请核对后确认：是否仍要继续保存当前日程任务？/);
  assert.match(html, />取消<\/button>/);
  assert.match(html, />继续保存<\/button>/);
  assert.match(html, /ScheduleForm\.validateDraft\(data\)/);
  assert.match(html, /ScheduleConflict\.findConflictRooms\(data,\s*TASKS\)/);
  assert.match(html, /function continueConflictSave\(\)/);
  assert.match(html, /persistTask\(data\)/);
});

test('左侧建筑树仅筛选列表，创建弹窗独立选择房间', () => {
  const html = readFileSync(join(__dirname, '..', 'pages', 'ctrl-schedule.html'), 'utf8');

  assert.match(html, /ScheduleForm\.filterTasksBySelection\(TASKS,\s*treeSel,\s*TREE3\)/);
  assert.match(html, /const initialRooms=r\?\(r\.rooms\|\|\[\]\)\.slice\(\):\[\]/);
  assert.doesNotMatch(html, /ScheduleForm\.roomsForSelection\(treeSel,\s*TREE3\)/);
  assert.doesNotMatch(html, /请先选择楼层或房间/);
  assert.match(html, /selectedTaskRooms/);
  assert.match(html, /rooms:\s*selectedTaskRooms/);
  assert.match(html, /if\s*\(editId\s*>\s*-1\)\s*return persistTask\(data\);[\s\S]*findConflictRooms/);
});
