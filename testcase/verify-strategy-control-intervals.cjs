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
