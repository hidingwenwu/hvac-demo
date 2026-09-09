const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('环境感知联动执行动作延时最小为 5 分钟', () => {
  const html = read('pages/strategy-env.html');
  assert.match(html, /type="number" min="5" max="240" step="1"[^>]*setAction\(\$\{i\},'minutes'/);
  assert.match(html, /numberInRange\(a\.minutes,5,240\)/);
  assert.match(html, /延时时长请输入 5-240 分钟的整数/);
  assert.match(html, /延时动作可设置 5-240 分钟/);
});

test('极致节能下发间隔最小为 5 分钟', () => {
  const html = read('pages/strategy-ultimate.html');
  assert.match(html, /id="interval" type="number" min="5" max="120" step="1"/);
  assert.match(html, /分钟（ 5-120 分钟）/);
  assert.match(html, /下发间隔可设置 5-120 分钟/);
  assert.match(html, /numberInRange\(document\.getElementById\('interval'\)\.value,5,120,0\)/);
  assert.match(html, /下发间隔请输入 5-120 分钟的整数/);
});

test('环境感知联动控制类动作后必须紧跟延时（末位除外）', () => {
  /* 页面 JS 含 uXXXX 转义,先解码再做中文断言 */
  const dec = read('pages/strategy-env.html').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  assert.match(dec, /空调控制或锁定控制后必须紧跟一个延时动作/);
  assert.match(dec, /空调控制或锁定控制后必须紧跟一个延时（最后一个动作除外），避免控制器接收指令处理不及/);
  assert.match(dec, /last\.type==='control'\|\|last\.type==='lock'/);
  assert.match(dec, /actions\[i\+1\]\.type!=='delay'/);
});

test('环境感知联动开关机锁定选项更名为禁止关机/禁止启动', () => {
  const dec = read('pages/strategy-env.html').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  assert.match(dec, /禁止关机/);
  assert.match(dec, /禁止启动/);
  assert.ok(!/锁定开机|锁定关机/.test(dec), '不应再出现 锁定开机/锁定关机 旧文案');
  /* V1.4:温度锁定由下拉改为勾选框 */
  assert.match(dec, /type="checkbox"[^>]*lockTempEnabled/);
  assert.ok(!/温度不锁定|锁定温度范围/.test(dec), '不应再出现温度锁定旧下拉选项');
  /* V1.5:空调控制温度与锁定温度范围 16~31℃（对齐空调控制卡片） */
  assert.match(dec, /空调控制温度请输入 16~31℃ 的整数/);
  assert.match(dec, /锁定温度上下限请输入 16~31℃ 的整数/);
  assert.ok(!/16~30℃/.test(dec), '不应再出现 16~30℃ 旧范围');
});
