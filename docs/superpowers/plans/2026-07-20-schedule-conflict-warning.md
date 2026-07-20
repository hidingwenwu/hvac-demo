# 日程任务防冲突提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在创建日程任务时精确检测同一时间点、共同执行日期和重叠房间，并允许用户取消或继续创建。

**Architecture:** 新增无 DOM 依赖的 `ScheduleConflict` 纯函数模块，负责房间交集和自然日级别的冲突计算。现有页面负责从左侧树解析房间范围、调用模块、展示警告弹窗和完成一次性保存。

**Tech Stack:** HTML5、原生 JavaScript、CSS、Node.js 内置测试运行器、Playwright 浏览器验证。

## Global Constraints

- 仅创建任务时检测，编辑任务不检测。
- 只判断执行时间完全相同的任务，禁止使用 30 分钟区间规则。
- 任意共同执行日和任意重叠房间命中即提示。
- 未选择左侧楼层或房间时禁止创建。
- 警告不强制阻断，按钮文案必须为“取消”和“继续创建”。
- 提示语必须使用需求指定文案，房间列表汇总并去重。

---

### Task 1: 精确冲突计算模块

**Files:**
- Create: `pages/ctrl-schedule-conflict.js`
- Create: `testcase/verify-schedule-conflict.cjs`

**Interfaces:**
- Consumes: 候选任务与已有任务，字段为 `time: string`、`vs: YYYY-MM-DD`、`ve: YYYY-MM-DD`、`days: number[]`、`rooms: string[]`。
- Produces: `ScheduleConflict.findConflictRooms(candidate, tasks): string[]`，返回去重后的冲突房间。

- [x] **Step 1: 写失败测试**

使用 Node 内置 `node:test` 编写以下独立用例：同时间且共同日期/房间命中；相差 1 分钟和 29 分钟均不命中；日期交集内星期不重合不命中；房间不重合不命中；多任务房间去重；日期区间边界命中。

```js
test('同一时间、共同执行日和重叠房间会返回冲突房间', () => {
  const candidate = task({ rooms: ['1号楼/7层/707'] });
  const existing = task({ rooms: ['1号楼/7层/707', '1号楼/7层/713'] });
  assert.deepEqual(findConflictRooms(candidate, [existing]), ['1号楼/7层/707']);
});

test('30分钟内但时间点不同不构成冲突', () => {
  const candidate = task({ time: '08:29:00' });
  assert.deepEqual(findConflictRooms(candidate, [task({ time: '08:00:00' })]), []);
});
```

- [x] **Step 2: 运行测试并确认正确失败**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: FAIL，原因是 `pages/ctrl-schedule-conflict.js` 尚不存在。

- [x] **Step 3: 实现最小纯函数模块**

实现日期字符串的本地日历解析、日期逐日递增、共同执行日判断、房间集合交集和稳定去重。通过浏览器全局和 CommonJS 双出口公开 API。

```js
function findConflictRooms(candidate, tasks) {
  const conflicts = [];
  tasks.forEach(function (task) {
    if (normalizeTime(task.time) !== normalizeTime(candidate.time)) return;
    if (!hasSharedOccurrence(candidate, task)) return;
    intersect(candidate.rooms, task.rooms).forEach(function (room) {
      if (conflicts.indexOf(room) < 0) conflicts.push(room);
    });
  });
  return conflicts;
}
```

- [x] **Step 4: 运行测试并确认通过**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 全部测试 PASS，且无警告和异常。

- [x] **Step 5: 提交本任务**

```bash
git add pages/ctrl-schedule-conflict.js testcase/verify-schedule-conflict.cjs
git commit -m "feat: add exact schedule conflict detection"
```

### Task 2: 创建流程与非阻断警告弹窗

**Files:**
- Modify: `pages/ctrl-schedule.html`
- Modify: `testcase/verify-schedule-conflict.cjs`

**Interfaces:**
- Consumes: Task 1 的 `ScheduleConflict.findConflictRooms(candidate, TASKS)`。
- Produces: `roomsForSelection(selection): string[]`、创建表单冲突警告流程、带 `rooms` 字段的新建任务数据。

- [x] **Step 1: 写页面契约失败测试**

读取 HTML 文本并验证：加载冲突模块；存在指定两段提示文案；存在“取消”和“继续创建”按钮；保存入口在新建时调用冲突检测；未选范围时存在阻止创建提示；继续按钮调用独立的最终保存函数。

```js
test('日程页面包含非阻断冲突确认流程', () => {
  const html = readFileSync(pagePath, 'utf8');
  assert.match(html, /ctrl-schedule-conflict\.js/);
  assert.match(html, /您当前设置的时间已存在其他日程任务/);
  assert.match(html, /继续创建/);
  assert.match(html, /ScheduleConflict\.findConflictRooms/);
});
```

- [x] **Step 2: 运行测试并确认正确失败**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 新增页面契约用例 FAIL，因为页面尚未接入模块和弹窗。

- [x] **Step 3: 补充任务房间数据与选择解析**

为 mock 任务补充 `rooms`；将楼层选择映射为该层所有完整路径，将房间选择映射为单个完整路径；未选或只选建筑节点时返回空列表并提示“请先选择楼层或房间”。

```js
function roomsForSelection(selection) {
  if (!selection || !selection.fl) return [];
  if (selection.room) return [selection.bld + '/' + selection.fl + '/' + selection.room];
  const building = TREE3.find(function (item) { return item.lb === selection.bld; });
  const floor = building && building.floors.find(function (item) { return item.lb === selection.fl; });
  return floor ? floor.rooms.map(function (room) {
    return selection.bld + '/' + selection.fl + '/' + room;
  }) : [];
}
```

- [x] **Step 4: 接入警告弹窗和一次性保存**

把表单读取与实际写入拆开。`saveTask()` 校验并构造候选任务；编辑时直接写入；新建时调用 `findConflictRooms`。有冲突则缓存候选任务并显示警告；“取消”只关闭警告；“继续创建”取出缓存并调用 `persistTask()` 一次。

```js
const conflictRooms = ScheduleConflict.findConflictRooms(data, TASKS);
if (conflictRooms.length) return showConflictWarning(data, conflictRooms);
persistTask(data);
```

- [x] **Step 5: 运行自动测试并确认通过**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 所有纯逻辑和页面契约测试 PASS。

- [x] **Step 6: 浏览器验证关键交互**

启动静态服务后在浏览器验证：未选范围阻止创建；同时间冲突弹窗文案与房间正确；取消保留表单；继续创建仅新增一条；不同时间直接保存；页面在桌面视口无重叠和截断。

Run: `npx --yes http-server . -p 4173`

Expected: `http://127.0.0.1:4173/hvac-demo.html` 可打开并进入“集中控制 - 日程管理”，控制台无错误。

- [x] **Step 7: 提交本任务**

```bash
git add pages/ctrl-schedule.html testcase/verify-schedule-conflict.cjs
git commit -m "feat: warn before creating conflicting schedules"
```
