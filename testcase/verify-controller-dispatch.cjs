/* 控制器管理-下发分体控制器配置 端到端验证(本地原型页,与 mock 数据强耦合)
   覆盖:选择约束提示 / oc·dbx·hrjn·FD01G 弹窗字段 / FD01G 开关联动 / 各项校验与确认文案 */
const { chromium } = require('playwright-core');
const path = require('path');

const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'pages', 'device-controller.html').replace(/\\/g, '/');

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.log('  ✗', name, extra ? JSON.stringify(extra) : ''); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(PAGE);
  await page.waitForTimeout(400);

  const lastMsg = () => page.evaluate(() => {
    const w = document.querySelector('.msg-wrap'); if (!w || !w.lastElementChild) return '';
    return w.lastElementChild.innerText.replace(/^[✓✕⚠ℹ]\s*/, '').trim();
  });
  const confirmText = () => page.evaluate(() => {
    const el = document.querySelector('#__confirm_modal .__ct'); return el ? el.textContent : '';
  });
  const confirmVisible = () => page.evaluate(() => {
    const el = document.getElementById('__confirm_modal'); return !!el && el.classList.contains('show');
  });
  const clickConfirmOk = () => page.evaluate(() => document.querySelector('#__confirm_modal .__ok').click());
  const clickConfirmCancel = () => page.evaluate(() => {
    const el = document.getElementById('__confirm_modal');
    [...el.querySelectorAll('button')].find(b => /取\s*消/.test(b.innerText)).click();
  });
  const dispatchVisible = () => page.evaluate(() => document.getElementById('dlgDispatch').classList.contains('show'));
  const closeDispatch = () => page.evaluate(() => $modalClose('dlgDispatch'));
  const selectModels = (models) => page.evaluate((ms) => {
    HOSTS.forEach(h => h._ck = false);
    ms.forEach(m => { const h = HOSTS.find(x => x.model === m && !x._ck); if (h) h._ck = true; });
    renderCards();
  }, models);
  const selectAllOf = (model) => page.evaluate((m) => {
    HOSTS.forEach(h => h._ck = (h.model === m));
    renderCards();
  }, model);
  const clickDispatch = async () => { await page.evaluate(() => openDispatch()); await page.waitForTimeout(250); };

  console.log('■ 页面加载与卡片渲染');
  const cardCnt = await page.locator('.card').count();
  ok(cardCnt === 10, `第一页渲染 10 张卡片(实际 ${cardCnt})`);
  const total = await page.evaluate(() => HOSTS.length);
  ok(total === 14, `主机总数 14(实际 ${total})`);
  const models = await page.evaluate(() => [...new Set(HOSTS.map(h => h.model))]);
  ok(['FD01G', 'hrjn', 'dbx', 'oc'].every(m => models.includes(m)), '数据含 FD01G/hrjn/dbx/oc 分体机型号', models);

  console.log('■ 选择约束(与现网一致)');
  await page.evaluate(() => { HOSTS.forEach(h => h._ck = false); renderCards(); });
  await clickDispatch();
  ok((await lastMsg()) === '请先勾选主机', '未勾选 → 请先勾选主机');

  await selectModels(['E74G']); await clickDispatch();
  ok((await lastMsg()) === '请选择分体空调主机', '勾选抄表器 E74G → 请选择分体空调主机');

  await selectModels(['FD01G', 'E74G']); await clickDispatch();
  ok((await lastMsg()) === '请选择分体空调主机', '混选 FD01G+E74G → 请选择分体空调主机');

  await selectModels(['oc', 'dbx']); await clickDispatch();
  ok((await lastMsg()) === '请选择同一型号的主机', '混选 oc+dbx → 请选择同一型号的主机');
  ok(!(await dispatchVisible()), '约束不满足时弹窗不打开');

  console.log('■ oc 弹窗(仅品牌代码)');
  await selectModels(['oc']); await clickDispatch();
  ok(await dispatchVisible(), 'oc 弹窗打开');
  let body = await page.evaluate(() => document.getElementById('dispBody').innerText);
  ok(/当前控制器型号：\s*oc/.test(body), '显示 当前控制器型号:oc');
  ok(await page.evaluate(() => !!document.getElementById('dBrand')), '有品牌代码输入框');
  ok(await page.evaluate(() => !document.getElementById('dAcType') && !document.getElementById('dMode')), '无空调类型/供电模式(非 hrjn/FD01G 项)');
  await page.fill('#dBrand', 'abc'); await page.evaluate(() => sendBrand());
  ok((await lastMsg()) === '请输入空调品牌代码(十进制)', '品牌代码非数字 → 校验提示');
  await page.fill('#dBrand', '255'); await page.evaluate(() => sendBrand()); await page.waitForTimeout(150);
  ok(await confirmVisible(), '品牌代码合法 → 弹确认框');
  ok(/255\(0xFF\)/.test(await confirmText()), '确认文案含十进制与十六进制(255/0xFF)', await confirmText());
  await clickConfirmOk(); await page.waitForTimeout(150);
  ok((await lastMsg()) === '下发成功', '确认后提示 下发成功');
  await closeDispatch();

  console.log('■ dbx 弹窗(与 oc 同构)');
  await selectModels(['dbx']); await clickDispatch();
  body = await page.evaluate(() => document.getElementById('dispBody').innerText);
  ok(/当前控制器型号：\s*dbx/.test(body) && await page.evaluate(() => !!document.getElementById('dBrand')), 'dbx 弹窗含品牌代码');
  await closeDispatch();

  console.log('■ hrjn 弹窗(空调类型+品牌代码+待机功耗)');
  await selectModels(['hrjn']); await clickDispatch();
  const acOpts = await page.evaluate(() => [...document.getElementById('dAcType').options].map(o => o.text));
  ok(['壁挂机', '单相柜机', '三相柜机'].every(o => acOpts.includes(o)), '空调类型选项 壁挂机/单相柜机/三相柜机', acOpts);
  ok(await page.evaluate(() => !!document.getElementById('dStandby')), '有待机功耗输入框(W)');
  await page.evaluate(() => sendAcType());
  ok((await lastMsg()) === '请选择空调类型', '未选空调类型 → 校验提示');
  await page.selectOption('#dAcType', { label: '壁挂机' }); await page.evaluate(() => sendAcType()); await page.waitForTimeout(150);
  ok(/空调类型为:壁挂机/.test(await confirmText()), '空调类型确认文案正确');
  await clickConfirmCancel();
  await page.fill('#dStandby', '-3'); await page.evaluate(() => sendStandby());
  ok((await lastMsg()) === '请输入正确的待机功耗(W)', '待机功耗负数 → 校验提示');
  await page.fill('#dStandby', '5'); await page.evaluate(() => sendStandby()); await page.waitForTimeout(150);
  ok(/待机功耗为:5W/.test(await confirmText()), '待机功耗确认文案正确');
  await clickConfirmCancel();
  await page.screenshot({ path: path.join(__dirname, 'ctrl-dispatch-hrjn.png') });
  await closeDispatch();

  console.log('■ FD01G 弹窗(本次新增:品牌代码+电流互感器+电量采集)');
  await selectAllOf('FD01G'); await clickDispatch();
  ok(await dispatchVisible(), 'FD01G(同型号2台) 弹窗打开');
  body = await page.evaluate(() => document.getElementById('dispBody').innerText);
  ok(/当前控制器型号：\s*FD01G/.test(body) && /已选 2 台/.test(body), '显示型号 FD01G 与已选台数');
  ok(await page.evaluate(() => !!document.getElementById('dBrand') && !!document.getElementById('dCtSwitch') && !!document.getElementById('dMode') && !!document.getElementById('dVolt') && !!document.getElementById('dPf')), '含品牌代码/电流互感器开关/供电模式/电压/功率因数全部配置项');
  ok(/电量采集配置/.test(body), '含「电量采集配置」分组标题');
  ok(/P = U × I × cosΦ/.test(body) && /√3/.test(body), '含单相/三相功率公式');

  // 电流互感器开关联动
  let thVisible = await page.evaluate(() => document.getElementById('dCtThRow').style.display !== 'none');
  ok(!thVisible, '开关默认关闭,电流阈值行隐藏');
  await page.evaluate(() => sendCt()); await page.waitForTimeout(150);
  ok(/关闭电流互感器辅助判断/.test(await confirmText()), '关闭状态下发 → 确认关闭文案');
  await clickConfirmCancel();
  await page.evaluate(() => toggleCt());
  thVisible = await page.evaluate(() => document.getElementById('dCtThRow').style.display !== 'none');
  ok(thVisible, '打开开关后电流阈值行显示');
  await page.fill('#dCtTh', '30'); await page.evaluate(() => sendCt());
  ok((await lastMsg()) === '电流阈值必须为不小于50的整数', '阈值<50 → 校验提示');
  await page.fill('#dCtTh', '120'); await page.evaluate(() => sendCt()); await page.waitForTimeout(150);
  ok(/开启电流互感器辅助判断,电流阈值 120mA/.test(await confirmText()), '开启+阈值确认文案正确');
  await clickConfirmCancel();

  // 供电模式提示联动
  let noteVisible = await page.evaluate(() => document.getElementById('dModeNote').style.display !== 'none');
  ok(!noteVisible, '单相模式下无提示');
  await page.selectOption('#dMode', 'three'); await page.evaluate(() => modeChanged());
  noteVisible = await page.evaluate(() => document.getElementById('dModeNote').style.display !== 'none');
  ok(noteVisible, '三相模式显示"仅采集一相电流"提示');
  await page.evaluate(() => sendMode()); await page.waitForTimeout(150);
  ok(/供电模式为:三相模式/.test(await confirmText()), '供电模式确认文案正确');
  await clickConfirmCancel();

  // 电压/功率因数校验
  await page.fill('#dVolt', '-5'); await page.evaluate(() => sendVolt());
  ok((await lastMsg()) === '电压有效值必须为非负数', '电压负数 → 校验提示');
  await page.fill('#dVolt', '380'); await page.evaluate(() => sendVolt()); await page.waitForTimeout(150);
  ok(/电压有效值为:380V/.test(await confirmText()), '电压确认文案正确');
  await clickConfirmCancel();
  await page.fill('#dPf', '1.5'); await page.evaluate(() => sendPf());
  ok((await lastMsg()) === '功率因数必须在0-1之间', '功率因数>1 → 校验提示');
  await page.fill('#dPf', '0.95'); await page.evaluate(() => sendPf()); await page.waitForTimeout(150);
  ok(/功率因数为:0.95/.test(await confirmText()), '功率因数确认文案正确');
  await clickConfirmOk(); await page.waitForTimeout(150);
  ok((await lastMsg()) === '下发成功', 'FD01G 配置项确认后 下发成功');
  await page.screenshot({ path: path.join(__dirname, 'ctrl-dispatch-fd01g.png') });
  await closeDispatch();

  console.log('■ 新建主机型号');
  const createOpts = await page.evaluate(() => [...document.getElementById('cModel').options].map(o => o.text));
  ok(createOpts.includes('FD01G'), '新建主机型号下拉含 FD01G', createOpts);

  await browser.close();
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('脚本异常:', e); process.exit(1); });
