/* 温度范围 16~30 → 16~31 同步：strategy-env.html + mp/strategy-form.js + mp 说明文档 */
const fs = require('fs');
let log = [];
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf8');
  for (const [oldStr, newStr, expect] of pairs) {
    const cnt = s.split(oldStr).length - 1;
    if (expect !== undefined && cnt !== expect) { console.error(file, '数量不符', JSON.stringify(oldStr.slice(0, 50)), '实际', cnt, '期望', expect); process.exit(1); }
    if (cnt === 0) { console.error(file, '未命中:', oldStr.slice(0, 60)); process.exit(1); }
    s = s.split(oldStr).join(newStr);
  }
  fs.writeFileSync(file, s);
  log.push(file + ' OK');
};

edit('D:/workspace/hvac-demo/pages/strategy-env.html', [
  ['<input type="range" min="16" max="30"', '<input type="range" min="16" max="31"', 2],
  ['<input type="number" min="16" max="30" step="1" value="${a.temp||\'\'}', '<input type="number" min="16" max="31" step="1" value="${a.temp||\'\'}', 1],
  ['(30-16)', '(31-16)', 2],
  ['numberInRange(a.lockTempMin,16,30)', 'numberInRange(a.lockTempMin,16,31)', 1],
  ['numberInRange(a.lockTempMax,16,30)', 'numberInRange(a.lockTempMax,16,31)', 1],
  ['numberInRange(a.temp,16,30)', 'numberInRange(a.temp,16,31)', 1],
  ['16~30\\u2103', '16~31\\u2103', 2],
  ["actions[i].lockTempMax=actions[i].lockTempMax||'30'", "actions[i].lockTempMax=actions[i].lockTempMax||'31'", 1],
  ["hi=a.lockTempMax||'30'", "hi=a.lockTempMax||'31'", 1],
  ['+(a.lockTempMax||30)', '+(a.lockTempMax||31)', 2],
]);

edit('D:/workspace/hvac-demo/mp/pages/strategy-form.js', [
  ['type="number" min="16" max="30"', 'type="number" min="16" max="31"', 2],
  ["return '温度需在 16-30℃ 之间'", "return '温度需在 16-31℃ 之间'", 1],
  ['t<16||t>30', 't<16||t>31', 2],
  ["个动作的温度需为 16-30℃ 的整数", "个动作的温度需为 16-31℃ 的整数", 1],
  ['lockLo:16,lockHi:30', 'lockLo:16,lockHi:31', 1],
]);

edit('D:/workspace/hvac-demo/docs/小程序原型功能说明.md', [
  ['（16–30℃）', '（16–31℃）', 1],
]);

console.log(log.join('\n'));
/* 残留检查 */
const chk = (f) => /16~30|16-30℃|max="30"|,16,30\)|\(30-16\)/.test(fs.readFileSync(f, 'utf8'));
console.log('strategy-env 残留:', chk('D:/workspace/hvac-demo/pages/strategy-env.html'));
console.log('strategy-form 残留:', chk('D:/workspace/hvac-demo/mp/pages/strategy-form.js'));
