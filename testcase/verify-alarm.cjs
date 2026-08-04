/* 故障预警功能端到端验证(2026-08-04 评审修改后形态):
   菜单(故障预警组位于电费相关与智慧运维之间,3 个子项) / 站内提醒=铃铛红点(无站内信/登录弹窗) /
   铃铛(红点;下拉面板=今日新增·未处理总数·故障级三卡片+最近3条故障级) /
   故障总览(趋势统计7/30日柱状图切换,故障分类双饼图=未处理口径;最近故障列=类别/等级/名称·代码/发生对象/发生时间,从左到右) /
   故障详情(项目运维一期8类;双 Tab 均含 故障发生/恢复时间·持续时长 列与恢复时间筛选;
     空调列表无故障名称列、故障代码纯文本、经操作列-详情看明细;批量处理/批量忽略,无批量删除;
     详情弹窗:等级仅展示标签(未收录默认警示的提示并入排查建议)、时间字段无后缀文案、恢复时间常显、无「前往故障代码库」) /
   故障推送(仅飞奕技术支持;推送配置合并抽屉=开关+范围+接收人+策略;项目名纯文本不可点击;无测试推送;
     去重为后台内置规则且页面不展示提示语;无维护窗口/根因抑制;推送方式筛选) /
   故障代码库(项目自定义=仅等级自定义,未收录码走通用库维护) / 非计费项目过滤 / 旧页面文件保留
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
    /* 最近故障(2026-08-04 评审):类别与等级分列,名称·代码/发生对象/发生时间从左到右依次排列 */
    const recChk = await fr.evaluate(() => [...document.querySelectorAll('.recent-row')].map(row => ({
      cat: row.querySelector('.rcat').textContent.trim(),
      lv: row.querySelector('.rlv .tag').textContent.trim(),
      obj: row.querySelector('.ro').textContent.trim(),
      time: row.querySelector('.rm').textContent.trim(),
    })));
    assert.ok(recChk.every(x => ['项目运维', '空调故障'].includes(x.cat)), '故障类别应分列展示: ' + JSON.stringify(recChk[0]));
    assert.ok(recChk.every(x => ['故障', '警示', '提示'].includes(x.lv)), '故障等级应独立成列(标签): ' + JSON.stringify(recChk[0]));
    assert.ok(recChk.every(x => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(x.time)), '发生时间应为完整时间戳: ' + recChk[0].time);
    const recAc = recChk.find(x => x.cat === '空调故障');
    assert.ok(recAc && /号楼-\d+层-\d+\(\d+-\d+-\d+-\d+\)/.test(recAc.obj), '空调发生对象应为 楼栋-楼层-房间(内机地址): ' + recAc.obj);
    await page.screenshot({ path: path.join(SHOT, 'alarm-overview.png') });
    console.log('OK 故障总览:7 卡片(未处理45/运维18/空调27/故障19/警示20/提示6),趋势7↔30切换,故障分类双饼图');

    /* ── 5. 故障详情-项目运维 Tab ── */
    fr = await nav('alarm-detail');
    const opsHead = await page.frameLocator('#fr').locator('#tabOps thead').innerText();
    ['故障等级', '故障子类', '故障名称', '故障对象', '故障发生时间', '故障恢复时间', '持续时长', '状态', '处理人'].forEach(h => assert.ok(opsHead.includes(h), `运维列表缺少列: ${h}`));
    ['故障描述', '异常类型', '关键信息', '首次发生'].forEach(h => assert.ok(!opsHead.includes(h), `运维列表应去掉列: ${h}`));
    /* 一期故障名称收敛:基础配置 5 类 + 计费分摊 3 类 */
    const nameOpts = await page.frameLocator('#fr').locator('#oName option').allTextContents();
    assert.deepEqual(nameOpts, ['全部名称', '控制器离线', '电表离线', '环境感知设备离线', '控制器存储空间不够', '内机未绑定建筑物', '缺少抄表记录', '电表未绑空调系统', '电表可能绑错空调系统']);
    /* 未处理口径含「已恢复待确认」(P0-1 修复):默认筛选 18 = 15 未处理 + 3 已恢复待确认 */
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 18 条'));
    assert.equal((await page.frameLocator('#fr').locator('#oSt option:checked').innerText()).trim(), '未处理', '状态筛选默认项文案应为「未处理」(口径仍含已恢复待确认)');
    const opsLv = await page.frameLocator('#fr').locator('#opsLvCards .ln').allTextContents();
    assert.deepEqual(opsLv, ['8', '10', '0']);
    /* 状态单值:已恢复待确认(共 3 条)且状态列每行仅一个状态 */
    await page.frameLocator('#fr').locator('#oSt').selectOption('gone');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('3'));
    const oneTag = await fr.evaluate(() => [...document.querySelectorAll('#opsBody tr')].every(tr => tr.querySelectorAll('td:nth-child(10) .tag').length === 1));
    assert.ok(oneTag, '状态列应每行仅一个状态值');
    const goneCells = await fr.evaluate(() => [...document.querySelectorAll('#opsBody tr')].every(tr => tr.cells[7].textContent.trim() !== '—' && tr.cells[8].textContent.trim() !== ''));
    assert.ok(goneCells, '已恢复待确认记录应展示故障恢复时间与持续时长');
    /* 运维详情弹窗(2026-08-04 评审):无首次发生/时间后缀文案,恢复时间常显与列表同步 */
    await page.frameLocator('#fr').locator('#opsBody .op a', { hasText: '详情' }).first().click();
    const opsGoneDetail = await page.frameLocator('#fr').locator('#opsDetailGrid').innerText();
    assert.ok(opsGoneDetail.includes('故障恢复时间'), '已恢复记录详情应含故障恢复时间');
    assert.ok(!opsGoneDetail.includes('首次发生') && !opsGoneDetail.includes('至今') && !opsGoneDetail.includes('本次故障开始时间'), '运维详情应去掉首次发生与时间后缀文案');
    await page.frameLocator('#fr').locator('#dlgOpsDetail button', { hasText: '关闭' }).click();
    await page.waitForTimeout(200);
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
    /* 未恢复记录详情:故障恢复时间常显「—」,与列表一致 */
    await page.frameLocator('#fr').locator('#opsBody .op a', { hasText: '详情' }).first().click();
    const opsNewDetail = await page.frameLocator('#fr').locator('#opsDetailGrid').innerText();
    assert.ok(/故障恢复时间[::\s]*—/.test(opsNewDetail), '未恢复记录详情恢复时间应常显「—」: ' + opsNewDetail.replace(/\n/g, '|'));
    await page.frameLocator('#fr').locator('#dlgOpsDetail button', { hasText: '关闭' }).click();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('#opsBody .op a', { hasText: '处理' }).first().click();
    /* 处理弹窗摘要(2026-08-04 评审):运维仅一行 故障对象:故障名称 */
    const opsHandleSum = await page.frameLocator('#fr').locator('#handleSum').innerText();
    assert.ok(opsHandleSum.trim() === '控制器 86200945:控制器离线', '运维处理弹窗摘要应为一行 故障对象:故障名称: ' + opsHandleSum);
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
    console.log('OK 项目运维 Tab:一期8类名称、三档卡 8/10/0、含待确认口径 18→17、计费分摊 8、处理摘要=名称+对象、铃铛总数 44');

    /* ── 6. 故障详情-空调故障 Tab(?tab=ac 直达) ── */
    fr = await nav('alarm-detail', 'tab=ac');
    assert.ok(await page.frameLocator('#fr').locator('.tab', { hasText: '空调故障' }).first().evaluate(el => el.classList.contains('active')));
    /* 建筑物信息树:初始即渲染(与集中控制页同组件);房间筛选项已移除(经树筛选) */
    assert.ok(await page.frameLocator('#fr').locator('#tree .tree-row').count() > 0, '建筑物树应初始渲染');
    assert.equal(await page.frameLocator('#fr').locator('#aRoom').count(), 0, '房间筛选项应移除');
    assert.ok((await page.frameLocator('#fr').locator('#acPager .pg-total').innerText()).includes('27'));
    const acLv = await page.frameLocator('#fr').locator('#acLvCards .ln').allTextContents();
    assert.deepEqual(acLv, ['11', '10', '6']);
    /* 列改造:无故障名称列(故障描述仅详情展示)、故障代码纯文本、含恢复时间/持续时长 */
    const acHead = await page.frameLocator('#fr').locator('#tabAc thead').innerText();
    ['故障代码', '故障等级', '故障发生时间', '故障恢复时间', '持续时长', '状态', '操作'].forEach(h => assert.ok(acHead.includes(h), `空调列表缺少列: ${h}`));
    assert.ok(!acHead.includes('故障名称'), '空调列表应去掉故障名称列(故障描述仅详情展示)');
    assert.equal(await page.frameLocator('#fr').locator('#acBody .fault-code').count(), 0, '故障代码应为纯文本不可点击');
    assert.ok(!(await page.frameLocator('#fr').locator('#tabAc .batch-bar').innerText()).includes('批量删除'), '空调 Tab 批量删除已移除');
    /* 已恢复待确认(空调恢复口径与运维一致):3 条,恢复时间/持续时长展示 */
    await page.frameLocator('#fr').locator('#aSt').selectOption('gone');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#acPager .pg-total').innerText()).includes('共 3 条'));
    const acGoneCells = await fr.evaluate(() => [...document.querySelectorAll('#acBody tr')].every(tr => tr.cells[10].textContent.trim() !== '—' && tr.cells[11].textContent.trim() !== ''));
    assert.ok(acGoneCells, '已恢复记录应展示故障恢复时间与持续时长');
    await page.frameLocator('#fr').locator('#acBody .op a', { hasText: '详情' }).first().click();
    const goneDetail = await page.frameLocator('#fr').locator('#acDetailGrid').innerText();
    assert.ok(goneDetail.includes('故障恢复时间') && goneDetail.includes('恢复确认'), '已恢复详情应展示恢复时间与恢复确认提示');
    assert.ok(!goneDetail.includes('至今'), '持续时长不再带「至今」后缀');
    await page.frameLocator('#fr').locator('#dlgAcDetail button', { hasText: '关闭' }).click();
    /* 格力-L1:列表不展示名称,经操作列「详情」查看明细(故障描述联查通用库) */
    await page.frameLocator('#fr').locator('#aSt').selectOption('');
    await page.frameLocator('#fr').locator('#aCode').fill('L1');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok(!(await page.frameLocator('#fr').locator('#acBody').innerText()).includes('内风机保护'), '列表不应展示故障名称');
    await page.frameLocator('#fr').locator('#acBody .op a', { hasText: '详情' }).first().click();
    const acDetail = await page.frameLocator('#fr').locator('#acDetailGrid').innerText();
    assert.ok(acDetail.includes('故障描述') && acDetail.includes('内风机保护') && acDetail.includes('排查建议'));
    /* 2026-08-04 评审:等级仅展示标签(无判定依据说明),弹窗不再提供「前往故障代码库」 */
    assert.ok(!acDetail.includes('依据通用代码库') && !acDetail.includes('依据项目自定义'), '故障等级后不应再有判定依据说明');
    assert.equal(await page.frameLocator('#fr').locator('#dlgAcDetail button', { hasText: '前往故障代码库' }).count(), 0, '详情弹窗应去掉「前往故障代码库」入口');
    assert.equal(await page.frameLocator('#fr').locator('#dlgCodeLib').count(), 0, '故障详情页不再内嵌代码库弹窗');
    await page.frameLocator('#fr').locator('#dlgAcDetail button', { hasText: '关闭' }).click();
    await page.waitForTimeout(200);
    /* 处理弹窗摘要(2026-08-04 评审):空调仅 内机位置/内机地址/故障代码/故障描述/排查建议 */
    await page.frameLocator('#fr').locator('#acBody .op a', { hasText: '处理' }).first().click();
    const acHandleSum = await page.frameLocator('#fr').locator('#handleSum').innerText();
    assert.ok(acHandleSum.includes('1号楼') && acHandleSum.includes('7层') && acHandleSum.includes('716') && acHandleSum.includes('1-1-23-2'), '空调处理弹窗摘要应含内机位置与内机地址');
    assert.ok(acHandleSum.includes('L1') && acHandleSum.includes('内风机保护') && acHandleSum.includes('排查建议'), '空调处理弹窗摘要应含故障代码/故障描述/排查建议');
    assert.ok(!acHandleSum.includes('依据通用代码库') && !acHandleSum.includes('故障级'), '空调处理弹窗摘要不应含等级/判定依据信息');
    await page.frameLocator('#fr').locator('#dlgHandle button', { hasText: '取消' }).click();
    await page.waitForTimeout(200);
    /* 未收录代码 X9:未知故障 + 默认警示 + 提示并入排查建议 */
    await page.frameLocator('#fr').locator('#aCode').fill('X9');
    await page.frameLocator('#fr').locator('#tabAc button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    await page.frameLocator('#fr').locator('#acBody .op a', { hasText: '详情' }).first().click();
    const x9Detail = await page.frameLocator('#fr').locator('#acDetailGrid').innerText();
    assert.ok(x9Detail.includes('未知故障') && x9Detail.includes('警示'), '未收录码应展示未知故障、默认按警示处理');
    assert.ok(x9Detail.includes('排查建议') && x9Detail.includes('请联系飞奕维护至通用故障码库'), '未收录提示应并入排查建议');
    await page.frameLocator('#fr').locator('#dlgAcDetail button', { hasText: '关闭' }).click();
    await page.screenshot({ path: path.join(SHOT, 'alarm-detail-ac.png') });
    console.log('OK 空调故障 Tab:27 条、三档卡 11/10/6、无名称列/代码纯文本、恢复时间+持续时长、已恢复待确认 3 条、详情联查通用库(描述/排查建议)、无前往代码库入口、未收录默认警示提示入排查建议、处理摘要=位置/地址/代码/描述/建议');

    /* ── 7. 故障代码库(直达页面):项目自定义(仅等级自定义)+ 屏蔽联动 ── */
    fr = await nav('alarm-code-lib');
    const clBody = await page.frameLocator('#fr').locator('body').innerText();
    assert.ok(clBody.includes('项目自定义'), '页签应为「项目自定义」');
    assert.ok(!clBody.includes('项目新增'), '不应再出现「项目新增」表述');
    assert.ok(clBody.includes('以下故障码在本项目按自定义等级生效'), '横幅应说明仅等级自定义');
    assert.ok(clBody.includes('请联系飞奕维护至通用故障码库'), '未收录码场景应指引联系飞奕维护通用库');
    assert.equal(await page.frameLocator('#fr').locator('#curProjName').innerText(), '产品部测试-按小时预付费');
    /* 种子:格力-L7 无主内机 通用警示 → 本项目故障 */
    const addRow = await page.frameLocator('#fr').locator('#tbAdd').innerText();
    assert.ok(addRow.includes('L7') && addRow.includes('无主内机') && addRow.includes('警示') && addRow.includes('故障'), '自定义种子应为 L7 通用警示→本项目故障: ' + addRow);
    assert.equal(await fr.evaluate(() => window.$alarmFaultLevelProj({ brand: '格力', code: 'L7' })), 1, 'L7 本项目应按自定义等级(故障)生效');
    /* 表单仅 品牌/故障码/自定义等级;通用库无此码时拒绝保存 */
    await page.frameLocator('#fr').locator('button', { hasText: '添加自定义故障码' }).click();
    await page.frameLocator('#fr').locator('#dlgProjAdd.show').waitFor();
    const formChk = await fr.evaluate(() => ({
      model: !!document.getElementById('paModel'), name: !!document.getElementById('paName'),
      desc: !!document.getElementById('paDesc'), advice: !!document.getElementById('paAdvice'),
      level: !!document.getElementById('paLevel'),
    }));
    assert.deepEqual(formChk, { model: false, name: false, desc: false, advice: false, level: true }, '表单应仅保留品牌/故障码/自定义等级');
    await page.frameLocator('#fr').locator('#paBrand').fill('格力');
    await page.frameLocator('#fr').locator('#paCode').fill('ZZ9');
    await page.waitForTimeout(200);
    assert.ok((await page.frameLocator('#fr').locator('#paScnTip').innerText()).includes('无法自定义等级'), '未收录码应即时提示无法自定义');
    await page.frameLocator('#fr').locator('#dlgProjAdd button', { hasText: '保存' }).click();
    await page.waitForTimeout(300);
    assert.equal(await fr.evaluate(() => Object.keys(window.$alarmProjCodeGet('产品部测试-按小时预付费').adds).length), 1, '未收录码不应被保存(场景1走通用库维护)');
    await page.frameLocator('#fr').locator('#dlgProjAdd .dx').click();
    await page.waitForTimeout(200);
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
    console.log('OK 故障代码库:项目自定义(种子 L7 警示→故障)、未收录码拒绝保存、屏蔽 LH 联动铃铛 44→43、取消恢复');

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

    /* ── 7.8 批量操作(多选;批量处理/批量忽略/批量删除;删除后全局剔除) ── */
    fr = await nav('alarm-detail');
    await page.frameLocator('#fr').locator('#oName').selectOption('内机未绑定建筑物');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 2 条'));
    await page.frameLocator('#fr').locator('#opsAllCk').check();
    await page.waitForTimeout(200);
    assert.ok((await page.frameLocator('#fr').locator('#opsSelCnt').innerText()).includes('已选 2 条'), '全选后应显示已选条数');
    await page.frameLocator('#fr').locator('#tabOps .batch-bar button', { hasText: '批量处理' }).click();
    await page.frameLocator('#fr').locator('#dlgHandle.show').waitFor();
    assert.ok((await page.frameLocator('#fr').locator('#handleSum').innerText()).includes('2'), '批量处理弹窗应汇总条数');
    await page.frameLocator('#fr').locator('#handleNote').fill('已批量完成建筑物绑定');
    await page.frameLocator('#fr').locator('#dlgHandle button', { hasText: '确认处理' }).click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 42, '批量处理 2 条后未处理 44→42');
    /* 批量忽略(维护窗口的替代方案:计划检修等场景先批量忽略,复发自动重新告警) */
    await page.frameLocator('#fr').locator('#oName').selectOption('电表未绑空调系统');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 2 条'));
    await page.frameLocator('#fr').locator('#opsAllCk').check();
    await page.waitForTimeout(200);
    await page.frameLocator('#fr').locator('#tabOps .batch-bar button', { hasText: '批量忽略' }).click();
    await page.frameLocator('#fr').locator('#__confirm_modal.show').waitFor();
    await page.frameLocator('#fr').locator('#__confirm_modal .__ok').click();
    await page.waitForTimeout(400);
    assert.equal(await bellTotal(), 40, '批量忽略 2 条后未处理 42→40');
    /* 无批量删除(批量忽略已起到批量清理效果);已忽略记录在「全部」中留痕可查 */
    assert.equal(await page.frameLocator('#fr').locator('#tabOps .batch-bar button').count(), 2, '批量操作应仅有批量处理/批量忽略');
    assert.ok(!(await page.frameLocator('#fr').locator('#tabOps .batch-bar').innerText()).includes('批量删除'), '批量删除已移除');
    await page.frameLocator('#fr').locator('#oName').selectOption('');
    await page.frameLocator('#fr').locator('#oSt').selectOption('');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#opsPager .pg-total').innerText()).includes('共 18 条'), '全部状态列表应保留全部 18 条记录(忽略留痕可查)');
    await page.frameLocator('#fr').locator('#oSt').selectOption('new');
    await page.frameLocator('#fr').locator('#tabOps button', { hasText: '查询' }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT, 'alarm-detail-batch.png') });
    console.log('OK 批量操作:批量处理 44→42、批量忽略 42→40(无批量删除,全部状态留痕 18 条)');

    /* ── 8. 故障推送(仅飞奕技术支持;全页=短信推送管理;推送配置合并抽屉;推送方式筛选) ── */
    fr = await nav('alarm-push');
    assert.equal(await page.frameLocator('#fr').locator('.role-bar').count(), 0, '页面内不应展示角色说明横幅');
    assert.equal(await page.frameLocator('#fr').locator('#fName').getAttribute('list'), 'projList', '项目名称应支持下拉选择');
    assert.equal(await page.frameLocator('#fr').locator('#projList option').count(), 6);
    assert.equal(await page.frameLocator('#fr').locator('#tbody tr').count(), 6);
    const head = await page.frameLocator('#fr').locator('.tw thead').first().innerText();
    ['项目名称', '短信推送', '推送范围', '推送方式', '最近推送', '操作'].forEach(h => assert.ok(head.includes(h), `推送列表缺少列: ${h}`));
    ['维护窗口', '站内信', '接收人数'].forEach(h => assert.ok(!head.includes(h), `推送列表应去掉列: ${h}`));
    const row1 = await page.frameLocator('#fr').locator('#tbody tr').first().innerText();
    assert.ok(row1.includes('产品部测试-按小时预付费') && row1.includes('故障') && row1.includes('项目运维+空调故障'));
    assert.ok(row1.includes('推送配置') && row1.includes('推送记录') && row1.includes('故障代码库'), '操作列应为 推送配置/推送记录/故障代码库');
    assert.ok(!row1.includes('推送范围配置') && !row1.includes('短信推送配置') && !row1.includes('维护窗口'), '范围与短信配置应合并为「推送配置」,维护窗口移除');
    assert.equal(await page.frameLocator('#fr').locator('#tbody .pj').count(), 0, '项目名称应为纯文本,不再可点击弹推送配置');
    assert.equal(await page.frameLocator('#fr').locator('#dlgScope').count(), 0, '独立推送范围弹窗应移除');
    assert.equal(await page.frameLocator('#fr').locator('#dlgMaint').count(), 0, '维护窗口弹窗应移除');
    const sw = await page.frameLocator('#fr').locator('#tbody tr').first().locator('.switch').evaluateAll(els => els.map(e => e.classList.contains('on')));
    assert.deepEqual(sw, [true]);   // 仅短信开关,种子项目开启
    /* 推送方式筛选:全部项目默认实时推送 */
    await page.frameLocator('#fr').locator('#fMode').selectOption('daily');
    await page.frameLocator('#fr').locator('button', { hasText: '搜索' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#tbody').innerText()).includes('暂无数据'), '筛选每日汇总应为空');
    await page.frameLocator('#fr').locator('#fMode').selectOption('realtime');
    await page.frameLocator('#fr').locator('button', { hasText: '搜索' }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.frameLocator('#fr').locator('#tbody tr').count(), 6, '实时推送应命中全部 6 个项目');
    await page.frameLocator('#fr').locator('button', { hasText: '重置' }).first().click();
    await page.waitForTimeout(300);
    /* 旧版残缺推送配置的防御合并(P2 修复) */
    const mergeChk = await fr.evaluate(() => {
      localStorage.setItem('fyAlarmPushCfg', JSON.stringify({ '二次分摊-H': { enabled: true } }));
      const c = window.$alarmPushCfgGet('二次分摊-H');
      localStorage.removeItem('fyAlarmPushCfg');
      return c.enabled === true && Array.isArray(c.scope.levels) && Array.isArray(c.scope.cats) && !!c.strategy.dnd && c.strategy.mode === 'realtime';
    });
    assert.ok(mergeChk, '旧版残缺推送配置应与默认结构逐层合并,不致页面报错');
    /* 推送配置抽屉:开关+推送范围+接收人+推送策略一体(全页均为短信推送管理) */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.ok((await page.frameLocator('#fr').locator('#drawerTitle').innerText()).includes('推送配置 - 产品部测试-按小时预付费'));
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 2);
    const scopeCks = await fr.evaluate(() => ({
      lv1: document.getElementById('dLv1').checked, lv2: document.getElementById('dLv2').checked,
      ops: document.getElementById('dCatOps').checked, ac: document.getElementById('dCatAc').checked,
    }));
    assert.deepEqual(scopeCks, { lv1: true, lv2: false, ops: true, ac: true }, '推送范围默认仅故障级+双类别');
    const drawerTxt = await page.frameLocator('#fr').locator('#drawer').innerText();
    assert.ok(drawerTxt.includes('推送范围') && drawerTxt.includes('铃铛红点不受此范围限制'), '抽屉应含推送范围分区(仅作用于短信)');
    assert.ok(!drawerTxt.includes('内置去重') && !drawerTxt.includes('24 小时内不重复'), '去重为后台内置规则:页面无配置项、不展示提示语(规则写入功能说明文档)');
    assert.ok(!drawerTxt.includes('根因抑制'), '根因抑制规则已从原型移除');
    assert.ok(!drawerTxt.includes('静音'), '故障级豁免注解不应使用「静音」表述');
    assert.ok(!drawerTxt.includes('测试推送'), '推送测试功能已取消');
    assert.equal(await fr.evaluate(() => !!document.getElementById('dFreq')), false, '24h 频控配置项应移除(内置去重替代)');
    /* 推送记录弹窗(按项目):3 条短信种子(根因合并流水已移除,无站内信流水) */
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送记录' }).first().click();
    await page.frameLocator('#fr').locator('#dlgLog.show').waitFor();
    assert.ok((await page.frameLocator('#fr').locator('#logPager .pg-total').innerText()).includes('共 3 条'));
    const logTxt = await page.frameLocator('#fr').locator('#logBody').innerText();
    assert.ok(!logTxt.includes('等故障'), '根因合并推送流水应移除');
    assert.ok(logTxt.includes('【空调集控】'), '短信签名应为【空调集控】');
    assert.ok(!(await page.frameLocator('#fr').locator('#dlgLog').innerText()).includes('站内信'), '推送记录不应再有站内信渠道');
    await page.frameLocator('#fr').locator('#dlgLog .dx').click();
    /* 推送测试已取消(2026-08-04 评审):抽屉底部仅 取消/保存,推送记录保持 3 条种子 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.equal(await page.frameLocator('#fr').locator('#drawer button', { hasText: '测试推送' }).count(), 0, '抽屉应无「测试推送」按钮');
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.waitForTimeout(200);
    /* 每日汇总无需免打扰(2026-08-04):选每日汇总隐藏免打扰设置且保存后不生效,切回实时恢复 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.ok(await page.frameLocator('#fr').locator('#dDndRow').isVisible(), '实时推送应展示免打扰设置');
    await page.frameLocator('#fr').locator('input[name="dMode"][value="daily"]').check();
    assert.ok(await page.frameLocator('#fr').locator('#dDailyTime').isVisible(), '每日汇总应显示汇总时刻');
    assert.ok(await page.frameLocator('#fr').locator('#dDndRow').isHidden(), '每日汇总时不展示免打扰设置');
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '保存' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#tbody tr').first().innerText()).includes('每日汇总'), '保存后列表应显示每日汇总');
    assert.equal(await fr.evaluate(() => window.$alarmPushCfgGet('产品部测试-按小时预付费').strategy.dnd.on), false, '每日汇总保存后免打扰不生效');
    /* 恢复实时推送(演示默认态) */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    await page.frameLocator('#fr').locator('input[name="dMode"][value="realtime"]').check();
    assert.ok(await page.frameLocator('#fr').locator('#dDndRow').isVisible(), '切回实时应恢复免打扰设置');
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '保存' }).click();
    await page.waitForTimeout(300);
    assert.ok((await page.frameLocator('#fr').locator('#tbody tr').first().innerText()).includes('实时推送'), '恢复后列表应显示实时推送');
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
    /* 001:手动接收人须短信验证码验证后添加(平台账号已验证免验) */
    await page.frameLocator('#fr').locator('#fName').fill('001');
    await page.frameLocator('#fr').locator('button', { hasText: '搜索' }).click();
    await page.waitForTimeout(300);
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.equal(await page.frameLocator('#fr').locator('#dSendCode').count(), 1, '手动录入应为「发送验证码」入口,无直接添加按钮');
    await page.frameLocator('#fr').locator('#dName').fill('现场负责人');
    await page.frameLocator('#fr').locator('#dPhone').fill('13800001111');
    await page.frameLocator('#fr').locator('#dSendCode').click();
    await page.waitForTimeout(200);
    assert.ok((await page.frameLocator('#fr').locator('#dSendCode').innerText()).includes('重新发送'), '发送后 60s 内不可重复发送');
    const codeTip = await page.frameLocator('#fr').locator('#dCodeTip').innerText();
    const demoCode = (codeTip.match(/验证码[::](\d{6})/) || [])[1];
    assert.ok(demoCode, '演示环境应展示验证码: ' + codeTip);
    /* 错误验证码被拒绝 */
    await page.frameLocator('#fr').locator('#dCode').fill(demoCode === '000000' ? '111111' : '000000');
    await page.frameLocator('#fr').locator('#dCodeRow button', { hasText: '验证并添加' }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 0, '验证码错误不应添加接收人');
    /* 正确验证码通过 */
    await page.frameLocator('#fr').locator('#dCode').fill(demoCode);
    await page.frameLocator('#fr').locator('#dCodeRow button', { hasText: '验证并添加' }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 1, '验证通过后方可添加接收人');
    /* 平台账号已验证:直接添加无需验证码 */
    await page.frameLocator('#fr').locator('#dAccSel').selectOption({ index: 1 });
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '添加' }).first().click();
    await page.waitForTimeout(200);
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 2, '平台账号选择即添加(免验证)');
    await page.frameLocator('#fr').locator('#drawer button', { hasText: '保存' }).click();
    await page.waitForTimeout(300);
    /* 接收人数列已移除:重开抽屉确认接收人已保存 */
    await page.frameLocator('#fr').locator('.op a', { hasText: '推送配置' }).first().click();
    await page.frameLocator('#fr').locator('#drawer.show').waitFor();
    assert.equal(await page.frameLocator('#fr').locator('.rc-tag').count(), 2);
    await page.frameLocator('#fr').locator('#drawer .dx').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT, 'alarm-push.png') });
    console.log('OK 故障推送:6 列表格、项目名纯文本、推送方式筛选、合并推送配置抽屉(范围+接收人+策略;去重后台内置不展示;无测试推送)、每日汇总免打扰联动、推送记录 3 条种子、代码库弹窗、001 手机号验证码验证后添加保存');

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
