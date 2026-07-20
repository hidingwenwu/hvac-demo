# 日程创建弹窗现网复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地日程创建弹窗严格复刻为测试平台当前实现，并以弹窗最终房间范围执行精确冲突检测和非阻断继续保存。

**Architecture:** 新增纯函数表单状态模块，负责左侧已有任务筛选、日期星期联动和校验；现有冲突模块扩展每日执行与排除日期语义；`ctrl-schedule.html` 只负责 DOM 渲染、现网样式和保存流程。所有新增行为先通过 Node 内置测试锁定，再在浏览器中与测试平台逐项对照。

**Tech Stack:** HTML5、原生 JavaScript、CSS、Node.js 内置测试运行器、Codex in-app Browser。

## Global Constraints

- 源码修改仅限 `D:\workspace\hvac-demo`。
- 创建弹窗宽度约 `920px`，使用现网双栏布局、字段顺序、暗色样式和整体遮罩滚动。
- 页面左侧建筑树仅筛选已有任务；创建弹窗不继承左侧选择，最终保存和冲突检测以弹窗最终勾选房间为准。
- 仅“开机”显示温度、模式、风速和取消选中区域。
- 冲突只比较完全相同时间点、共同实际执行日和重叠房间。
- 提示文案必须使用“继续保存 / 继续保存当前日程任务”，按钮必须为“取消 / 继续保存”。
- 编辑任务不执行新增冲突检测。
- 不修改共享 `_base.css` 与 `_ui.js`，避免影响其他原型页面。

---

### Task 1: 表单状态与校验纯函数

**Files:**
- Create: `pages/ctrl-schedule-form.js`
- Modify: `testcase/verify-schedule-conflict.cjs`

**Interfaces:**
- Consumes: 建筑树、页面选择、日期范围、星期集合和任务草稿。
- Produces: `ScheduleForm.roomsForSelection(selection, tree)`、`ScheduleForm.filterTasksBySelection(tasks, selection, tree)`、`ScheduleForm.enabledWeekdays(start, end)`、`ScheduleForm.applyWeekPreset(selected, enabled, preset)`、`ScheduleForm.validateDraft(draft)`；草稿日期字段统一使用 `vs / ve`，动作字段统一使用 `act`。

- [ ] **Step 1: 写失败测试**

新增真实表单规则用例：整栋、楼层和房间范围解析；左侧范围只筛选已有任务；短日期范围只启用实际出现星期；工作日/周末只选择已启用星期；取消清空；校验顺序为名称、日期、小时、分钟、房间、指令动作、开机模式和锁定设定子项。

```js
test('楼层选择解析该层全部房间', () => {
  assert.deepEqual(roomsForSelection({ bld: '博研楼', fl: '8F' }, tree), [
    '博研楼/8F/806', '博研楼/8F/808', '博研楼/8F/810', '博研楼/8F/812',
  ]);
});

test('开机校验要求模式但不要求风速', () => {
  const draft = validDraft({ act: '开机', mode: '' });
  assert.equal(validateDraft(draft), '请选择空调模式');
  assert.equal(validateDraft({ ...draft, mode: '制冷', wind: '' }), '');
});
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: FAIL，原因是 `pages/ctrl-schedule-form.js` 尚不存在。

- [ ] **Step 3: 实现最小表单状态模块**

使用浏览器全局与 CommonJS 双出口；日期在本地中午解析，避免时区跨日；校验消息精确返回现网文案。

```js
function validateDraft(draft) {
  if (!String(draft.name || '').trim()) return '请填写任务名称';
  if (!draft.vs || !draft.ve) return '请选择执行日期';
  if (!draft.hour) return '请选择执行时间的小时';
  if (!draft.minute) return '请选择执行时间的分钟';
  if (!(draft.rooms || []).length) return '请选择房间';
  if (draft.act === '开机' && !draft.mode) return '请选择空调模式';
  return '';
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 表单状态新增用例全部 PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add pages/ctrl-schedule-form.js testcase/verify-schedule-conflict.cjs
git commit -m "feat: add schedule form state rules"
```

### Task 2: 实际执行日冲突语义

**Files:**
- Modify: `pages/ctrl-schedule-conflict.js`
- Modify: `testcase/verify-schedule-conflict.cjs`

**Interfaces:**
- Consumes: `days: number[]`、`excludeDates: string[]`。
- Produces: 空星期集合表示日期范围内每天执行；排除日期不参与冲突。

- [ ] **Step 1: 写失败测试**

```js
test('未选择周运行时间时按每天执行检测冲突', () => {
  const candidate = task({ days: [], rooms: ['博研楼/8F/806'], vs: '2026-07-20', ve: '2026-07-20' });
  const existing = task({ days: [], rooms: ['博研楼/8F/806'], vs: '2026-07-20', ve: '2026-07-20' });
  assert.deepEqual(findConflictRooms(candidate, [existing]), ['博研楼/8F/806']);
});

test('双方任一任务排除的日期不参与冲突', () => {
  const candidate = task({ days: [], excludeDates: ['2026-07-20'] });
  assert.deepEqual(findConflictRooms(candidate, [task({ days: [] })]), []);
});
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 两个新增用例 FAIL，证明现有空星期与排除日期语义尚未实现。

- [ ] **Step 3: 实现精确实际执行日判断**

逐日遍历日期交集；空星期集合匹配所有星期；候选或已有任务的 `excludeDates` 包含当前日期时跳过。

```js
function runsOn(task, date, dateKey) {
  if ((task.excludeDates || []).indexOf(dateKey) >= 0) return false;
  return !(task.days || []).length || task.days.indexOf(date.getDay()) >= 0;
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 冲突算法全部 PASS，包括精确时间、日期边界、每日执行和排除日期。

- [ ] **Step 5: 提交本任务**

```bash
git add pages/ctrl-schedule-conflict.js testcase/verify-schedule-conflict.cjs
git commit -m "feat: detect actual schedule occurrence conflicts"
```

### Task 3: 现网创建弹窗与保存流程

**Files:**
- Modify: `pages/ctrl-schedule.html`
- Modify: `testcase/verify-schedule-conflict.cjs`

**Interfaces:**
- Consumes: `ScheduleForm` 与 `ScheduleConflict`。
- Produces: 现网双栏创建弹窗、房间复选树、字段联动、排除日期、最新冲突提示和任务数据。

- [ ] **Step 1: 写页面契约失败测试**

验证页面加载 `ctrl-schedule-form.js`；创建弹窗存在 `920px` 双栏结构、群组输入、弹窗房间树、30/100 字计数、小时分钟选择、五个动作、周运行快捷按钮、排除日期区；提示包含最新文案和“继续保存”。

```js
test('创建弹窗复刻现网字段与最新冲突文案', () => {
  const html = readFileSync(pagePath, 'utf8');
  assert.match(html, /schedule-task-dialog/);
  assert.match(html, /请选择群组/);
  assert.match(html, /请输入任务名称/);
  assert.match(html, /请输入内容/);
  assert.match(html, /请选择小时/);
  assert.match(html, /关机并锁定/);
  assert.match(html, /排除节假日/);
  assert.match(html, /继续保存可能出现空调控制指令冲突/);
  assert.match(html, />继续保存<\/button>/);
});
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 页面契约新增用例 FAIL，因为旧弹窗字段和文案不符合现网。

- [ ] **Step 3: 替换弹窗结构与局部样式**

实现 `920px` 弹窗、`222px + 30px + 1fr` 双栏、300px 右栏控件、Element 风格单选按钮、开机设置卡片、弹窗内部滚动和固定底部按钮。左侧建筑树通过 `ScheduleForm.filterTasksBySelection(TASKS, treeSel, TREE3)` 筛选已有任务；新建弹窗房间范围固定从空选择开始。

```css
.schedule-task-dialog{position:relative;width:920px;min-height:690px;background:#1a2233;border-radius:4px;}
.schedule-task-body{display:grid;grid-template-columns:222px minmax(0,1fr);gap:30px;padding:28px 20px 76px;}
.schedule-main-field{width:300px;}
.schedule-task-footer{position:absolute;right:20px;bottom:16px;display:flex;gap:10px;}
```

- [ ] **Step 4: 接入现网交互与数据模型**

实现字符计数、小时分钟下拉、六种动作、仅开机显示空调设置区、仅锁定设定显示锁定面板、温度 16-31、模式/风速卡片、星期启用与快捷操作、排除日期列表。锁定面板包含开关锁定、模式锁定、温度锁定及其现网子控件。任务数据额外保存 `lockTypes`、`lockOnOff`、`lockModes`、`lockTempLow`、`lockTempHigh`，并继续兼容列表和冲突模块。

```js
function saveTask() {
  const data = readTaskDraft();
  const error = ScheduleForm.validateDraft(data);
  if (error) return $msg(error, 'error');
  if (editId > -1) return persistTask(data);
  const conflictRooms = ScheduleConflict.findConflictRooms(data, TASKS);
  if (conflictRooms.length) return showConflictWarning(data, conflictRooms);
  persistTask(data);
}
```

- [ ] **Step 5: 更新冲突提示和继续保存流程**

显示：

```text
您当前设置的时间已存在其他日程任务，继续保存可能出现空调控制指令冲突，涉及房间[房间列表]。
请核对后确认：是否仍要继续保存当前日程任务？
```

按钮为“取消 / 继续保存”；取消保留草稿；继续保存清空缓存后调用 `persistTask` 一次。

- [ ] **Step 6: 运行自动测试并确认通过**

Run: `node --test testcase/verify-schedule-conflict.cjs`

Expected: 全部算法、表单规则与页面契约测试 PASS。

- [ ] **Step 7: 浏览器对照测试平台**

启动本地静态服务，分别打开测试平台和本地页面，对照验证：弹窗宽度、双栏起点、字段顺序、控件宽度、动作条件区、星期快捷操作、排除列表、校验消息、左侧已有任务筛选、创建弹窗房间独立选择、冲突取消和继续保存。检查浏览器控制台无错误。

Run: `npx.cmd --yes http-server . -p 4173 -a 127.0.0.1 -c-1`

Expected: 本地页面主要几何尺寸与测试平台采集值一致；交互路径全部通过。

- [ ] **Step 8: 提交本任务**

```bash
git add pages/ctrl-schedule.html testcase/verify-schedule-conflict.cjs
git commit -m "feat: replicate live schedule creation dialog"
```
