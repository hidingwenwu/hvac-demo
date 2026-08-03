/* 故障预警功能端到端验证(2026-08-01 一期收敛后形态):
   菜单(故障预警组位于电费相关与智慧运维之间,3 个子项) / 站内提醒=铃铛红点(无站内信/登录弹窗) /
   铃铛(红点;下拉面板=今日新增·未处理总数·故障级三卡片+最近3条故障级) /
   故障总览(趋势统计7/30日柱状图切换,故障分类双饼图=未处理口径) /
   故障详情(项目运维一期8类故障:基础配置5类+计费分摊3类;空调故障) /
   故障推送配置(仅飞奕技术支持;推送范围独立配置,短信抽屉只留短信内容,无接收人数列) /
   故障代码库弹窗标题(当前项目:xxx)+小字说明 / 非计费项目过滤 / 旧页面文件保留
   运行:cd testcase && node verify-alarm.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const PORT = 8807;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOT = path.join(__dirname, 'live-alarm');
fs.mkdirSync(SHOT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/hvac-demo.html';
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const loc = m.location();
      if ((loc && /favicon/.test(loc.url || '')) || /favicon/i.test(m.text())) return;
      errors.push(m.text());
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());

    /* ── 0. 旧页面文件全部保留(未删除,可回退) ── */
    ['ctrl-fault.html', 'alarm-ops.html', 'alarm-ac.html', 'alarm-code-lib.html',
      'elec-alert.html', 'elec-warn.html', 'elec-warn-hour.html', 'elec-warn-daily.html']
      .forEach(f => assert.ok(fs.existsSync(path.join(ROOT, 'pages', f)), `旧页面文件应保留: ${f}`));
    console.log('OK 旧页面文件全部保留');

    await page.goto(`${BASE}/hvac-demo.html`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await page.waitForLoadState('networkidle');

    /* ── 1. 站内信已取消:登录弹窗移除,站内提醒由铃铛红点承担 ── */
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#slMask').count(), 0, '登录站内信弹窗应已移除');
    console.log('OK 站内信取消:无登录弹窗,站内提醒由铃铛红点承担');

    /* ── 2. 菜单位置与构成 ── */
    const groups = await page.evaluate(() =>
      [...document.querySelectorAll('#nav > *')].map(el =>
        (el.classList.contains('mi') ? el : el.querySelector('.mi')).querySelector('.lb').textContent.trim()));
    const iElec = groups.indexOf('电费相关'), iAlarm = groups.indexOf('故障预警'), iOps = groups.indexOf('智慧运维');
    assert.ok(iElec > -1 && iAlarm > iElec && iOps > iAlarm, `菜单顺序错误: ${groups.join('/')}`);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.mi .lb')].map(e => e.textContent.trim()));
    ['故障总览', '故障详情', '故障推送'].forEach(t => assert.ok(labels.includes(t), `菜单缺少: ${t}`));
    assert.ok(!labels.includes('故障推送配置'), '菜单应更名为「故障推送」');
    ['项目运维故障', '空调故障预警', '异常统计（按天）', '异常统计（按小时）', '异常每日盘点', '故障代码库', '推送记录']
      .forEach(t => assert.ok(!labels.includes(t), `菜单应移除: ${t}`));
    console.log('OK 菜单:故障预警组位于电费相关与智慧运维之间,仅 3 个子项');

    /* ── 3. 铃铛角标(红点)与下拉面板(三卡片:今日新增/未处理总数/故障级 + 最近3条故障级) ── */
    assert.ok(await page.locator('#alarmBdg').isVisible(), '有未处理故障时铃铛应显红点');
    assert.equal((await page.locator('#alarmBdg').innerText()).trim(), '', '铃铛红点不应展示数量');
    await page.click('#alarmBell');
    await page.waitForSelector('#alarmPanel.show');
    const cnts = await page.evaluate(() => [...document.querySelectorAll('.ap-cnt .n')].map(e => +e.textContent));
    const expToday = await page.evaluate(() => window.$alarmTodayNew());
    assert.deepEqual(cnts, [expToday, 45, 19]);   // 今日新增(动态)/未处理总数/故障级
    const cntsT = await page.locator('.ap-cnt .t').allTextContents();
    assert.deepEqual(cntsT, ['今日新增', '未处理总数', '故障级']);
    assert.ok((await page.locator('.ap-sec').innerText()).includes('最近故障级预警'));
    assert.equal(await page.locator('.ap-item').count(), 3, '明细仅展示最近 3 条故障级');
    assert.ok((await page.locator('#alarmPanel').innerText()).includes('查看详情'));
    await page.screenshot({ path: path.join(SHOT, 'shell-bell.png') });
    await page.click('.hd-left');
    console.log(`OK 铃铛:红点;三卡片 今日新增${expToday}/未处理45/故障级19,明细3条故障级`);

    /* 子页面导航助手 */
    async function nav(id, q) {
      await page.evaluate(([id, q]) => window.nav(id, q), [id, q || '']);
      await page.waitForFunction(id => document.getElementById('fr').src.includes(id + '.html'), id);
      await page.waitForTimeout(700);
      return page.frames().find(f => f.url().includes(id + '.html'));
    }

    /* 铃铛总数计数:打开下拉面板读取「未处理总数」卡片 */
    async function bellTotal() {
      await page.click('#alarmBell');
      await page.waitForSelector('#alarmPanel.show');
      const sum = await page.evaluate(() => {
        const ns = [...document.querySelectorAll('.ap-cnt .n')].map(e => +e.textContent);
        return ns[1];   // 第二张卡片 = 未处理总数
      });
      await page.click('.hd-left');   // 收起面板
      await page.waitForTimeout(150);
      return sum;
    }

    /* ── 4.pre 等级深链跨 Tab(P0-2 修复):两 Tab 同步筛选,落地优先有数据的项目运维 ── */
    let fr0 = await nav('alarm-detail', 'level=1&status=new');
    assert.ok(await page.frameLocator('#fr').locator('.tab', { hasText: '项目运维' }).first().evaluate(el => el.classList.contains('active')));
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 8 条'));
    assert.equal(await fr0.evaluate(() => document.getElementById('aLevel').value), '1', '空调侧应同步等级筛选');
    fr0 = await nav('alarm-detail', 'level=3&status=new');
    assert.ok(await page.frameLocator('#fr').locator('.tab', { hasText: '空调故障' }).first().evaluate(el => el.classList.contains('active')), '运维无提示级应直达空调故障 Tab');
    assert.ok((await page.frameLocator('#fr').locator('#acPager .pg-total').innerText()).includes('共 6 条'));
    assert.equal(await page.frameLocator('#fr').locator('#acLvCards .lv-card.active').count(), 1, '空调档位卡应同步高亮');
    /* 今日新增深链(P1 修复):当日时间范围 + 状态=全部 */
    fr0 = await nav('alarm-detail', 'today=1');
    assert.ok(await page.frameLocator('#fr').locator('.tab', { hasText: '项目运维' }).first().evaluate(el => el.classList.contains('active')));
    const todayChk = await fr0.evaluate(() => ({
      s: document.getElementById('oStart').value, e: document.getElementById('oEnd').value,
      st: document.getElementById('oSt').value, today: window.$alarmNow().slice(0, 10),
    }));
    assert.ok(todayChk.s === todayChk.today && todayChk.e === todayChk.today && todayChk.st === '', '今日新增深链应带当日范围+全部状态');
    assert.ok(+((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).replace(/\D/g, '')) >= 1, '任意时段今日至少 1 条(00:01 保底记录)');
    /* 最近故障/铃铛明细的记录定位深链(P1 修复):对象关键字直达该记录 */
    fr0 = await nav('alarm-detail', 'status=&obj=' + encodeURIComponent('控制器 86200945'));
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 1 条'));
    assert.ok((await page.frameLocator('#fr').locator('#opsBody').innerText()).includes('86200945'));
    /* 建筑树楼栋校验(P2 修复):跨楼栋不命中 */
    assert.equal(await fr0.evaluate(() => window.$tree3Match({ bld: '2号楼' }, { bld: '1号楼', fl: '7层', room: 101 })), false, '选 2号楼 不应命中 1号楼记录');
    console.log('OK 深链:等级双Tab同步、今日新增(当日范围+全部状态)、记录定位(共1条)、树楼栋校验');

    /* ── 4. 故障总览(趋势统计切换 + 故障分类饼图) ── */
    let fr = await nav('alarm-overview');
    assert.equal(await page.frameLocator('#fr').locator('.scd').count(), 7);
    const cardVals = await page.frameLocator('#fr').locator('.scd .sc-v').allTextContents();
    const expectToday = await fr.evaluate(() => window.$alarmTodayNew());
    assert.deepEqual(cardVals.map(v => v.trim()), [expectToday + '条', '45条', '18条', '27条', '19条', '20条', '6条']);
    /* 趋势统计:柱状图 + 近7日/近30日切换 */
    assert.equal(await page.frameLocator('#fr').locator('#trendSeg .seg-btn').count(), 2);
    assert.equal(await page.frameLocator('#fr').locator('#trend rect').count(), 14, '近7日应为 7×2 根柱');
    await page.frameLocator('#fr').locator('#trendSeg .seg-btn', { hasText: '近30日' }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.frameLocator('#fr').locator('#trend rect').count(), 60, '近30日应为 30×2 根柱');
    await page.frameLocator('#fr').locator('#trendSeg .seg-btn', { hasText: '近7日' }).click();
    await page.waitForTimeout(200);
    /* 故障分类:双饼图(未处理口径)+ hover 数据 */
    const pieTitles = await page.frameLocator('#fr').locator('.pi-t').allTextContents();
    assert.deepEqual(pieTitles, ['故障类别', '故障等级']);
    assert.ok(await page.frameLocator('#fr').locator('.pi-arc').count() >= 4, '饼图扇形应存在');
    const tip0 = await page.frameLocator('#fr').locator('.pi-arc').first().getAttribute('data-tip');
    assert.ok(/条(.*%)/.test(tip0) || /条\(\d+(\.\d+)?%\)/.test(tip0), 'hover 提示应含数字与比例: ' + tip0);
    assert.ok((await page.frameLocator('#fr').locator('#share').innerText()).includes('当前全部未处理故障'), '注释应说明未处理口径');
    assert.equal(await page.frameLocator('#fr').locator('.recent-row').count(), 10);
    await page.screenshot({ path: path.join(SHOT, 'alarm-overview.png') });
    console.log('OK 故障总览:7 卡片(未处理45/运维18/空调27/故障19/警示20/提示6),趋势7↔30切换,故障分类双饼图');

    /* ── 5. 故障详情-项目运维 Tab ── */
    fr = await nav('alarm-detail');
    const opsHead = await page.frameLocator('#fr').locator('#tabOps thead').innerText();
    ['故障等级', '故障子类', '故障名称', '故障对象', '故障描述', '故障时间', '状态'].forEach(h => assert.ok(opsHead.includes(h), `运维列表缺少列: ${h}`));
    ['异常类型', '关键信息', '首次发生'].forEach(h => assert.ok(!opsHead.includes(h), `运维列表应去掉列: ${h}`));
    /* 一期故障名称收敛:基础配置 5 类 + 计费分摊 3 类 */
    const nameOpts = await page.frameLocator('#fr').locator('#oName option').allTextContents();
    assert.deepEqual(nameOpts, ['全部名称', '控制器离线', '电表离线', '环境感知设备离线', '控制器存储空间不够', '内机未绑定建筑物', '缺少抄表记录', '电表未绑空调系统', '电表可能绑错空调系统']);
    /* 未处理口径含「已恢复待确认」(P0-1 修复):默认筛选 18 = 15 未处理 + 3 已恢复待确认 */
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 18 条'));
    assert.ok((await page.frameLocator('#fr').locator('#oSt option:checked').innerText()).includes('含待确认'));
    const opsLv = await page.frameLocator('#fr').locator('#opsLvCards .ln').allTextContents();
    assert.deepEqual(opsLv, ['8', '10', '0']);
    /* 状态单值:已恢复待确认(共 3 条)且状态列每行仅一个状态 */
    await page.frameLocator('#fr').locator('#oSt').selectOption('gone');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('3'));
    const oneTag = await fr.evaluate(() => [...document.querySelectorAll('#opsBody tr')].every(tr => tr.querySelectorAll('td:nth-child(9) .tag').length === 1));
    assert.ok(oneTag, '状态列应每行仅一个状态值');
    /* 故障对象为纯文本(无点击弹窗) */
    assert.equal(await page.frameLocator('#fr').locator('#opsBody .obj').count(), 0);
    /* 故障类别=计费分摊 8 条 */
    await page.frameLocator('#fr').locator('#oSt').selectOption('');
    await page.frameLocator('#fr').locator('#oCat').selectOption('bill');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('8'));
    await page.frameLocator('#fr').locator('#oCat').selectOption('');
    await page.frameLocator('#fr').locator('#oSt').selectOption('new');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    /* 默认排序:故障时间倒序 */
    const sortedOps = await fr.evaluate(() => {
      const t = [...document.querySelectorAll('#opsBody tr')].map(tr => tr.cells[6].textContent);
      return t.length > 1 && t.every((v, i) => i === 0 || t[i - 1] >= v);
    });
    assert.ok(sortedOps, '运维列表应按故障时间倒序');
    /* 处理:先按对象定位 控制器 86200945(ops-1),处理人可编辑 */
    await page.frameLocator('#fr').locator('#oObj').fill('86200945');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    await page.frameLocator('#fr').locator('#opsBody .op a', { hasText: '处理' }).first().click();
    await page.frameLocator('#fr').locator('#handleNote').fill('已现场处理,控制器恢复在线');
    await page.frameLocator('#fr').locator('#handleBy').fill('张三');
    await page.frameLocator('#fr').locator('#dlgHandle button', { hasText: '确认处理' }).click();
    await page.waitForTimeout(400);
    await page.frameLocator('#fr').locator('#oObj').fill('');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 17 条'));
    assert.equal(await fr.evaluate(() => window.$alarmStatus('ops-1').by), '张三');
    assert.equal(await bellTotal(), 44);
    await page.screenshot({ path: path.join(SHOT, 'alarm-detail-ops.png') });
    console.log('OK 项目运维 Tab:一期8类名称、三档卡 8/10/0、含待确认口径 18→17、计费分摊 8、铃铛总数 44');

    /* ── 6. 故障详情-空调故障 Tab(?tab=ac 直达) ── */
    fr = await nav('alarm-detail', 'tab=ac');
    assert.ok(await page.frameLocator('#fr').locator('.tab', { hasText: '空调故障' }).first().evaluate(el => el.classList.contains('active')));
    /* 建筑物信息树:初始即渲染(与集中控制页同组件);房间筛选项已移除(经树筛选) */
    assert.ok(await page.frameLocator('#fr').locator('#tree .tree-row').count() > 0, '建筑物树应初始渲染');
    assert.equal(await page.frameLocator('#fr').locator('#aRoom').count(), 0, '房间筛选项应移除');
    assert.ok((await page.frameLocator('#fr').locator('#acPager .pg-total').innerText()).includes('27'));
    const acLv = await page.frameLocator('#fr').locator('#acLvCards .ln').allTextContents();
    assert.deepEqual(acLv, ['11', '10', '6']);
    /* 格力-L1 详情联查通用库 */
    await page.frameLocator('#fr').locator('#aSt').selectOption('');
    await page.frameLocator('#fr').locator('#aCode').fill('L1');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#acBody').innerText()).includes('内风机保护'));
    await page.frameLocator('#fr').locator('#acBody .fault-code').first().click();
    const acDetail = await page.frameLocator('#fr').locator('#acDetailGrid').innerText();
    assert.ok(acDetail.includes('排查建议') && acDetail.includes('依据通用代码库') && acDetail.includes('故障'));
    /* 详情弹窗直接弹出本项目代码库(P0-3 修复):不再跳转故障推送页 */
    await page.frameLocator('#fr').locator('#dlgAcDetail button', { hasText: '前往故障代码库' }).click();
    await page.waitForTimeout(800);
    assert.ok((await page.evaluate(() => document.getElementById('fr').src)).includes('alarm-detail'), '不应跳离故障详情页');
    const clDetail = page.frames().find(f => f.url().includes('alarm-code-lib.html'));
    assert.ok(clDetail && clDetail.url().includes('proj='), '应在详情页内弹出代码库(带项目参数)');
    assert.ok((await page.frameLocator('#fr').locator('#clTitle').innerText()).includes('故障代码库(当前项目:'));
    await page.frameLocator('#fr').locator('#dlgCodeLib .dx').click();
    await page.waitForTimeout(300);
    /* 未收录代码 X9 → 未知故障 */
    await page.frameLocator('#fr').locator('#aCode').fill('X9');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#acBody').innerText()).includes('未知故障'));
    await page.screenshot({ path: path.join(SHOT, 'alarm-detail-ac.png') });
    console.log('OK 空调故障 Tab:27 条、三档卡 11/10/6、真实故障码联查通用库、未收录显示未知故障');

    /* ── 7. 故障代码库(直达页面)+ 屏蔽联动 ── */
    fr = await nav('alarm-code-lib');
    assert.ok((await page.frameLocator('#fr').locator('body').innerText()).includes('除常规故障码外，以下故障码也纳入监测范围'));
    assert.equal(await page.frameLocator('#fr').locator('#curProjName').innerText(), '产品部测试-按小时预付费');
    assert.ok((await page.frameLocator('#fr').locator('#tbAdd').innerText()).includes('XW'));   // 种子新增监测码
    /* 项目屏蔽:格力-LH(提示级) */
    await page.frameLocator('#fr').locator('.tab', { hasText: '项目屏蔽' }).click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('button', { hasText: '添加屏蔽' }).click();
    await page.frameLocator('#fr').locator('#bkBrand').fill('格力');
    await page.frameLocator('#fr').locator('#bkCode').fill('LH');
    await page.frameLocator('#fr').locator('#dlgBlock button', { hasText: '确认屏蔽' }).click();
    await page.waitForTimeout(400);
    assert.equal(await page.frameLocator('#fr').locator('#tbBlk tr').count(), 1);
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 43);
    fr = await nav('alarm-detail', 'tab=ac');
    await page.frameLocator('#fr').locator('#aSt').selectOption('');
    await page.frameLocator('#fr').locator('#aCode').fill('LH');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#acBody').innerText()).includes('已屏蔽'));
    /* 取消屏蔽恢复 */
    fr = await nav('alarm-code-lib');
    await page.frameLocator('#fr').locator('.tab', { hasText: '项目屏蔽' }).click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('.op a', { hasText: '取消屏蔽' }).click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 44);
    console.log('OK 故障代码库:种子 XW、屏蔽 LH 联动铃铛总数 44→43、取消恢复');

    /* ── 7.5 小写故障码(P0-5 修复):屏蔽 格力-db 正常生效并联查通用库 ── */
    await page.frameLocator('#fr').locator('button', { hasText: '添加屏蔽' }).click();
    await page.frameLocator('#fr').locator('#bkBrand').fill('格力');
    await page.frameLocator('#fr').locator('#bkCode').fill('db');
    await page.frameLocator('#fr').locator('#dlgBlock button', { hasText: '确认屏蔽' }).click();
    await page.waitForTimeout(400);
    assert.ok((await page.frameLocator('#fr').locator('#tbBlk').innerText()).includes('机组调试状态'), '小写码应联查到通用库名称');
    assert.equal(await bellTotal(), 43);   // 格力-db(提示级,1 条)被屏蔽
    fr = await nav('alarm-detail', 'tab=ac');
    await page.frameLocator('#fr').locator('#aSt').selectOption('');
    await page.frameLocator('#fr').locator('#aCode').fill('db');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#acBody').innerText()).includes('已屏蔽'), '小写码屏蔽应对故障记录生效');
    fr = await nav('alarm-code-lib');
    await page.frameLocator('#fr').locator('.tab', { hasText: '项目屏蔽' }).click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('.op a', { hasText: '取消屏蔽' }).click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 44);
    /* 大小写并存码严格区分:海信 EE(故障)/Ee(提示)为两个不同码,屏蔽 Ee 不误伤 EE */
    const caseChk = await fr.evaluate(() => ({
      EE: window.$alarmCodeLookup('海信', 'EE').level,
      Ee: window.$alarmCodeLookup('海信', 'Ee').level,
    }));
    assert.deepEqual(caseChk, { EE: 1, Ee: 3 }, '海信 EE/Ee 应为两个不同等级的故障码');
    await page.frameLocator('#fr').locator('button', { hasText: '添加屏蔽' }).click();
    await page.frameLocator('#fr').locator('#bkBrand').fill('海信');
    await page.frameLocator('#fr').locator('#bkCode').fill('Ee');
    await page.frameLocator('#fr').locator('#dlgBlock button', { hasText: '确认屏蔽' }).click();
    await page.waitForTimeout(400);
    const lvChk = await fr.evaluate(() => ({
      blockedEe: window.$alarmFaultLevelProj({ brand: '海信', code: 'Ee' }),
      aliveEE: window.$alarmFaultLevelProj({ brand: '海信', code: 'EE' }),
    }));
    assert.deepEqual(lvChk, { blockedEe: 0, aliveEE: 1 }, '屏蔽 Ee 不应误伤 EE');
    assert.equal(await bellTotal(), 43);   // 海信-Ee(提示级,1 条)被屏蔽
    await page.frameLocator('#fr').locator('.op a', { hasText: '取消屏蔽' }).click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 44);
    console.log('OK 故障码大小写:小写 db 屏蔽生效(44→43→44),并存码 EE/Ee 严格区分不误伤');

    /* ── 8. 故障推送(仅飞奕技术支持,页面内不展示角色提示;推送范围独立配置;无接收人数列) ── */
    fr = await nav('alarm-push');
    assert.equal(await page.frameLocator('#fr').locator('.role-bar').count(), 0, '页面内不应展示角色说明横幅');
    assert.equal(await page.frameLocator('#fr').locator('#fName').getAttribute('list'), 'projList', '项目名称应支持下拉选择');
    assert.equal(await page.frameLocator('#fr').locator('#projList option').count(), 6);
    assert.equal(await page.frameLocator('#fr').locator('#tbody tr').count(), 6);
    const head = await page.frameLocator('#fr').locator('.tw thead').first().innerText();
    ['短信推送', '推送范围'].forEach(h => assert.ok(head.includes(h)));
    assert.ok(!head.includes('站内信'), '站内信通道已取消,不应有站内信列');
    assert.ok(!head.includes('接收人数'), '接收人数列应移除');
    const row1 = await page.frameLocator('#fr').locator('#tbody tr').first().innerText();
    assert.ok(row1.includes('产品部测试-按小时预付费') && row1.includes('故障') && row1.includes('项目运维+空调故障'));
    assert.ok(row1.includes('推送范围配置') && row1.includes('短信推送配置'), '操作列应有独立的推送范围配置');
    const sw = await page.frameLocator('#fr').locator('#tbody tr').first().locator('.switch').evaluateAll(els => els.map(e => e.classList.contains('on')));
    assert.deepEqual(sw, [true]);   // 仅短信开关,种子项目开启
    /* 旧版残缺推送配置的防御合并(P2 修复) */
    const mergeChk = await fr.evaluate(() => {
      localStorage.setItem('fyAlarmPushCfg', JSON.stringify({ '二次分摊-H': { enabled: true } }));
      const c = window.$alarmPushCfgGet('二次分摊-H');
      localStorage.removeItem('fyAlarmPushCfg');
      return c.enabled === true && Array.isArray(c.scope.levels) && Array.isArray(c.scope.cats) && !!c.strategy.dnd && c.strategy.mode === 'realtime';
    });
    assert.ok(mergeChk, '旧版残缺推送配置应与默认结构逐层合并,不致页面报错');
    /* 维护窗口(缺失能力补充):窗口期内产生的故障全局忽略 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '维护窗口' }).first().click();
    await page.frameLocator('#fr').locator('#dlgMaint.show').waitFor();
    const win = await fr.evaluate(() => {
      const p = n => String(n).padStart(2, '0');
      const f = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      return { from: f(new Date(Date.now() - 6.5 * 86400000)), to: f(new Date(Date.now() + 3600000)) };   /* ≤7 天上限内,覆盖全部 mock 故障 */
    });
    await fr.evaluate(w => {
      document.getElementById('mOn').classList.add('on');
      document.getElementById('mFrom').value = w.from;
      document.getElementById('mTo').value = w.to;
      document.getElementById('mNote').value = '机房停电检修';
    }, win);
    await page.frameLocator('#fr').locator('#dlgMaint button', { hasText: '保存' }).click();
    await page.waitForTimeout(400);
    assert.ok((await page.frameLocator('#fr').locator('#tbody tr').first().innerText()).includes('生效中'), '列表应显示维护窗口生效中');
    assert.equal(await bellTotal(), 0, '窗口期覆盖全部 mock 故障时未处理应为 0');
    assert.ok(!(await page.locator('#alarmBdg').isVisible()), '维护窗口期内铃铛红点应消失');
    /* 总览/详情页顶提示维护窗口生效中(项目用户可感知) */
    fr = await nav('alarm-detail');
    assert.ok(await page.frameLocator('#fr').locator('#maintBar').isVisible(), '详情页应显示维护窗口提示条');
    assert.ok((await page.frameLocator('#fr').locator('#maintBar').innerText()).includes('维护窗口'));
    fr = await nav('alarm-push');
    await page.frameLocator('#fr').locator('.op a', { hasText: '维护窗口' }).first().click();
    await page.frameLocator('#fr').locator('#dlgMaint.show').waitFor();
    await fr.evaluate(() => document.getElementById('mOn').classList.remove('on'));
    await page.frameLocator('#fr').locator('#dlgMaint button', { hasText: '保存' }).click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 44, '关闭维护窗口后应恢复计数');
    console.log('OK 维护窗口:启用后未处理 44→0、红点消失,关闭恢复 44');
    /* 推送范围配置(独立弹窗,作用于短信;铃铛不受范围限制) */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送范围配置' }).first().click();
    await page.frameLocator('#fr').locator('#dlgScope.show').waitFor();
    const scopeCks = await fr.evaluate(() => ({
      lv1: document.getElementById('sLv1').checked, lv2: document.getElementById('sLv2').checked,
      ops: document.getElementById('sCatOps').checked, ac: document.getElementById('sCatAc').checked,
    }));
    assert.deepEqual(scopeCks, { lv1: true, lv2: false, ops: true, ac: true });
    assert.ok((await page.frameLocator('#fr').locator('#dlgScope').innerText()).includes('铃铛红点不受此范围限制'), '范围仅作用于短信,铃铛全局提醒');
    await page.frameLocator('#fr').locator('#dlgScope .dx').click();
    /* 短信抽屉:只保留短信内容(启用/接收人/策略),不再含推送范围 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '短信推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 2);
    assert.equal(await fr.evaluate(() => document.getElementById('dLv1')), null, '短信抽屉不应再含推送范围勾选');
    assert.ok(!(await page.frameLocator('#fr').locator('#drawer').innerText()).includes('推送范围'), '短信抽屉不应再出现推送范围分区');
    assert.ok((await page.frameLocator('#fr').locator('#drawer').innerText()).includes('根因抑制'), '策略区应说明根因抑制内置规则');
    /* 推送记录弹窗(按项目) */
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送记录' }).first().click();
    await page.frameLocator('#fr').locator('#dlgLog.show').waitFor();
    assert.ok((await page.frameLocator('#fr').locator('#logPager .pg-total').innerText()).includes('共 4 条'));   // 4 条短信(含根因合并),无站内信流水
    assert.ok((await page.frameLocator('#fr').locator('#logBody').innerText()).includes('等故障'), '推送记录应含根因合并「××等故障 N 条」模板示例');
    assert.ok(!(await page.frameLocator('#fr').locator('#dlgLog').innerText()).includes('站内信'), '推送记录不应再有站内信渠道');
    await page.frameLocator('#fr').locator('#dlgLog .dx').click();
    /* 测试推送 → 记录 6 条 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '短信推送配置' }).first().click();
    await page.frameLocator('#fr').locator('button', { hasText: '测试推送' }).click();
    await page.waitForTimeout(300);
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送记录' }).first().click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#logPager .pg-total').innerText()).includes('共 5 条'));
    await page.frameLocator('#fr').locator('#dlgLog .dx').click();
    /* 故障代码库:操作列按项目弹窗(iframe 带 ?proj=),标题=故障代码库(当前项目:xxx)+小字说明 */
    await page.frameLocator('#fr').locator('#tbody .op a', { hasText: '故障代码库' }).first().click();
    await page.waitForTimeout(900);
    const clFrame = page.frames().find(f => f.url().includes('alarm-code-lib.html'));
    assert.ok(clFrame, '代码库弹窗应加载 alarm-code-lib.html');
    assert.ok(clFrame.url().includes('proj='), '代码库弹窗应按项目加载(?proj=)');
    const clTitle = await page.frameLocator('#fr').locator('#clTitle').innerText();
    assert.ok(clTitle.includes('故障代码库(当前项目:'), '弹窗标题应为 故障代码库(当前项目:xxx): ' + clTitle);
    assert.ok((await page.frameLocator('#fr').locator('.cl-sub').innerText()).includes('配置仅对当前项目生效'), '标题下应有小字说明');
    assert.ok(await clFrame.locator('#curProjBar').isHidden(), '弹窗内页顶部冗余项目条应隐藏');
    assert.ok(await clFrame.locator('#tbAdd').isVisible());
    await page.frameLocator('#fr').locator('#dlgCodeLib .dx').click();
    /* 001:加接收人保存 */
    await page.frameLocator('#fr').locator('#fName').fill('001');
    await page.frameLocator('#fr').locator('button', { hasText: '搜索' }).click();
    await page.waitForTimeout(300);
    await page.frameLocator('#fr').locator('.op a', { hasText: '短信推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#dName').fill('现场负责人');
    await page.frameLocator('#fr').locator('#dPhone').fill('13800001111');
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '添加' }).last().click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '保存' }).click();
    await page.waitForTimeout(300);
    /* 接收人数列已移除:重开抽屉确认接收人已保存 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '短信推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 1);
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT, 'alarm-push.png') });
    console.log('OK 故障推送:无页内角色提示、项目下拉、范围独立配置、短信抽屉纯短信、无接收人数列、代码库弹窗新标题、001 配置保存');

    /* ── 9. 非计费项目(001):计费分摊过滤 ── */
    await page.selectOption('#projSel', '001');
    await page.waitForTimeout(900);
    await page.click('#alarmBell');
    await page.waitForSelector('#alarmPanel.show');
    const cnts9 = await page.evaluate(() => [...document.querySelectorAll('.ap-cnt .n')].map(e => +e.textContent));
    const expToday9 = await page.evaluate(() => window.$alarmTodayNew({ bill: false }));
    /* 处理状态按项目隔离(P0-4 修复):种子项目处理的 ops-1 不影响 001,故未处理=基础10+空调27=37 */
    assert.deepEqual(cnts9, [expToday9, 37, 16]);   // 今日新增(动态)/未处理37/故障级16
    await page.click('.hd-left');
    fr = await nav('alarm-detail');
    const catOpts = await page.frameLocator('#fr').locator('#oCat option').allTextContents();
    assert.deepEqual(catOpts, ['全部子类', '基础配置']);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 10 条'));   // 基础10条,ops-1 在本项目仍未处理
    assert.ok((await page.frameLocator('#fr').locator('#opsBody').innerText()).includes('86200945'), '种子项目已处理的记录在 001 应仍为未处理(状态按项目隔离)');
    await page.selectOption('#projSel', '产品部测试-按小时预付费');
    await page.waitForTimeout(900);
    console.log('OK 非计费项目:铃铛(未处理37/故障级16,状态按项目隔离)、运维 Tab 无计费分摊类别');

    /* ── 10. 其余菜单回归(电费相关/集中控制正常) ── */
    fr = await nav('elec-query');
    assert.ok(await page.frameLocator('#fr').locator('body').count() > 0);
    fr = await nav('ctrl-ac');
    assert.ok(await page.frameLocator('#fr').locator('body').count() > 0);
    console.log('OK 电费查询/空调控制回归正常');

    /* ── 11. 无 JS 报错 ── */
    assert.deepEqual(errors, [], '存在控制台/页面错误');
    console.log('OK 全部页面无 JS 报错');
    console.log('\n全部断言通过 ✅  截图输出: testcase/live-alarm/');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error('FAIL:', e.message); server.close(); process.exit(1); });
