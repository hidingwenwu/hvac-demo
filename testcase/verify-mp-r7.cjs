/* R7 冒烟：ac-room-bind 房间绑定现场流交互实测
   用 playwright-core + 本机 Chrome 直开 file:// 原型，覆盖：
   楼栋/楼层/房间三级下钻 / 空房间可选 / 面包屑与摘要条 / SN 尾号搜索真过滤 /
   按控制器分组真过滤（空组不显示、与搜索叠加） / 确认绑定后停留继续绑下一批 /
   待绑池清零空态不自动跳转 / 更换房间与完成出口 / ac-room 楼栋标注 /
   I-1 回归：勾选被搜索隐藏时不得静默误绑（显性提示 + 二次确认闸门 + 一键清空） /
   I-2 回归：group-form 不因空串 room 渲染无标题空分组
   运行：node testcase/verify-mp-r7.cjs */
const path=require('node:path');
const { chromium }=require('playwright-core');
const FILE='file:///'+path.join(__dirname,'..','hvac-demo-mp.html').replace(/\\/g,'/');

let pass=0,failCount=0;
function ok(cond,msg){ if(cond){pass++;console.log('  ✓ '+msg)}else{failCount++;console.error('  ✗ '+msg)} }
const TOAST=2100;   /* 壳内 toast 存活 2000ms，等它散场再断言下一个 */

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:414,height:896}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(()=>{ localStorage.clear(); });
  await page.reload();
  await page.evaluate(()=>{ MP.state.set('loggedIn',true); MP.state.set('role','admin'); });

  console.log('[A] 数据层与共用工具');
  ok(await page.evaluate(()=>MP.data.devices.length)===20,'设备总数 20 台（含 R7 追加的 d19/d20）');
  ok(await page.evaluate(()=>MP.data.buildings.length)===3,'buildings 3 个楼栋');
  ok(await page.evaluate(()=>MP.data.buildings.reduce((n,b)=>n+b.floors.length,0))===6,'buildings 6 个楼层');
  ok(await page.evaluate(()=>MP.data.buildings.reduce((n,b)=>n+b.floors.reduce((m,f)=>m+f.rooms.length,0),0))===9,'buildings 9 个房间');
  ok(await page.evaluate(()=>MP.data.devices.filter(d=>!MP.acRoom.roomOf(d)).length)===4,'首访未绑定池 4 台（d17/d18 种子 + d19/d20 新机）');
  ok(await page.evaluate(()=>MP.acRoom.locate('一楼大堂').building.name)==='1号楼','locate(一楼大堂) → 1号楼');
  ok(await page.evaluate(()=>MP.acRoom.locate('未绑定设备'))===null,'locate 非真实房间名 → null（静默降级）');
  ok(await page.evaluate(()=>MP.acRoom.rooms().length)>0,'rooms() 既有契约未回归');
  /* 三级注册表拼接名与现状扁平 room 逐一对应（已绑定设备零回归的根本保证） */
  ok(await page.evaluate(()=>{
    const names=[]; MP.data.buildings.forEach(b=>b.floors.forEach(f=>f.rooms.forEach(r=>names.push(f.name+r.name))));
    return MP.data.devices.filter(d=>d.room).every(d=>names.indexOf(d.room)>=0);
  }),'全部非空 device.room 均能在三级注册表中找到对应房间');

  /* 走真实入口：首页 → ac-room 列表页 →「＋ 绑定空调」 */
  await page.evaluate(()=>MP.switchTab('home'));
  await page.evaluate(()=>MP.go('ac-room'));
  await page.waitForTimeout(60);
  await page.locator('#btnBind').click();
  await page.waitForTimeout(60);

  console.log('[B] Step ① 楼栋/楼层/房间三级下钻');
  ok(await page.locator('.mp-arb-row').count()===3,'进入默认只见 3 个楼栋行（全部折叠）');
  ok(await page.locator('.mp-arb-row.lv1').count()===3,'3 行均为 lv1 楼栋行');
  await page.locator('.mp-arb-row.lv1').first().click();
  await page.waitForTimeout(40);
  ok(await page.locator('.mp-arb-row.lv2').count()===4,'展开 1号楼 → 4 个楼层行');
  await page.locator('.mp-arb-row.lv2').first().click();
  await page.waitForTimeout(40);
  ok(await page.locator('.mp-arb-row.lv3').count()===1,'展开 1号楼/一楼 → 1 个房间行');
  ok((await page.locator('.mp-arb-row.lv3').first().innerText()).includes('已绑 3 台'),'一楼大堂显示「已绑 3 台」');
  /* 折叠 1号楼，改下钻 2号楼的新交付空房间 */
  await page.locator('.mp-arb-row.lv1').first().click();
  await page.waitForTimeout(40);
  await page.locator('.mp-arb-row.lv1').nth(1).click();
  await page.waitForTimeout(40);
  await page.locator('.mp-arb-row.lv2').first().click();
  await page.waitForTimeout(40);
  ok(await page.locator('.mp-arb-row.lv3').count()===2,'2号楼/一楼 → 2 个空房间行');
  ok((await page.locator('.mp-arb-row.lv3').first().innerText()).includes('已绑 0 台'),'空房间显示「已绑 0 台」（而非「未绑定」）');
  await page.locator('.mp-arb-row.lv3').first().click();   /* 一楼前台：全新空房间，旧版根本选不到 */
  await page.waitForTimeout(60);

  console.log('[C] Step ② 面包屑 / 摘要条 / 0 台校验');
  ok((await page.locator('.mp-arb-path .pt').innerText())==='2号楼 › 一楼 › 前台','面包屑「2号楼 › 一楼 › 前台」');
  ok((await page.locator('#sumTx').innerText()).includes('已选 0 台 → 一楼前台'),'摘要条「已选 0 台 → 一楼前台」');
  ok(await page.locator('#btnOk.dim').count()===1,'0 台时确认按钮置灰');
  ok(!(await page.locator('#btnClr').isVisible()),'0 台时「清空」钮隐藏');
  await page.locator('#btnOk').click();
  await page.waitForTimeout(40);
  ok((await page.locator('.mp-toast').innerText()).includes('请至少勾选 1 台空调'),'0 台点击给 toast 而非静默');
  await page.waitForTimeout(TOAST);

  console.log('[D] SN 尾号搜索真过滤');
  ok(await page.locator('.mp-sch-tgt').count()===4,'「全部」列出 4 台未绑定');
  await page.locator('#snKw').fill('0017');
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-sch-tgt').count()===1,'SN 尾号 0017 过滤出 1 台');
  ok((await page.locator('.mp-sch-tgt').first().innerText()).includes('FY-AC-2026-0017'),'过滤结果确为 0017 那台');
  await page.locator('#snKw').fill('zzz');
  await page.waitForTimeout(60);
  ok((await page.locator('.mp-empty .tx').innerText()).includes('无匹配该 SN 尾号'),'无匹配时空态文案');
  await page.locator('#snKw').fill('');
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-sch-tgt').count()===4,'清空搜索词恢复全量 4 台');

  console.log('[E] 按控制器分组真过滤（空组不显示 / 与搜索叠加）');
  await page.locator('#arbSeg .mp-seg-i[data-k="ctl"]').click();
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-arb-gh').count()===1,'只渲染 1 个非空组（c1/c2 无未绑定设备，空组不显示）');
  ok((await page.locator('.mp-arb-gh').first().innerText()).includes('控制器-3号楼'),'分组小标题为控制器名');
  ok((await page.locator('.mp-arb-gh').first().innerText()).includes('4 台待绑'),'分组小标题含组内待绑台数');
  ok(await page.locator('.mp-sch-tgt').count()===4,'分组模式下 4 台全部归入该组');
  await page.locator('#snKw').fill('0019');
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-arb-gh').count()===1&&await page.locator('.mp-sch-tgt').count()===1,'分组与搜索可叠加生效');
  ok((await page.locator('.mp-arb-gh').first().innerText()).includes('1 台待绑'),'叠加后组内台数随筛选收敛');
  await page.locator('#snKw').fill('');
  await page.waitForTimeout(60);
  await page.locator('#arbSeg .mp-seg-i[data-k="all"]').click();
  await page.waitForTimeout(60);

  console.log('[F] I-1 回归：勾选被搜索隐藏时不得静默误绑');
  await page.locator('.mp-sch-tgt').nth(0).click();
  await page.locator('.mp-sch-tgt').nth(1).click();
  await page.waitForTimeout(40);
  ok(await page.locator('.mp-check.on').count()===2,'先勾选 2 台');
  ok(await page.locator('#btnClr').isVisible(),'有勾选后「清空」钮出现');
  /* 搜到完全无匹配：列表空，但勾选仍在 —— 必须显性告知，不能装作已选 0 台 */
  await page.locator('#snKw').fill('zzzz');
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-sch-tgt').count()===0,'搜索 zzzz 后列表为空');
  ok((await page.locator('#sumTx').innerText()).includes('其中 2 台不在当前筛选内'),'摘要条显性标出 2 台筛选外已选（I-1）');
  /* 更隐蔽的中间态：屏幕上只有一台未勾选的设备，勾选的却是屏幕外另两台 */
  await page.locator('#snKw').fill('0019');
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-sch-tgt').count()===1&&await page.locator('.mp-check.on').count()===0,'搜 0019 时屏幕仅 1 台且未勾选');
  ok((await page.locator('#sumTx').innerText()).includes('其中 2 台不在当前筛选内'),'中间态同样显性标出筛选外已选（I-1）');
  /* 硬闸门：点确认绑定必须弹二次确认，而不是静默绑走屏幕外设备 */
  await page.locator('#btnOk').click();
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-modal').count()===1,'存在筛选外勾选时点确认 → 弹出二次确认（I-1 闸门）');
  const modalTx=await page.locator('.mp-modal .c').innerText();
  ok(modalTx.includes('2 台不在当前筛选结果内'),'确认弹窗说明有几台看不到');
  await page.locator('.mp-modal [data-a=no]').click();
  await page.waitForTimeout(60);
  ok(await page.evaluate(()=>MP.data.devices.filter(d=>!MP.acRoom.roomOf(d)).length)===4,'取消后未绑定池仍为 4 台（未误绑）');
  /* 一键清空：发现残留勾选后可一步重来 */
  await page.locator('#btnClr').click();
  await page.waitForTimeout(60);
  ok((await page.locator('#sumTx').innerText()).includes('已选 0 台'),'「清空」钮清空全部勾选（I-1）');
  ok(await page.locator('#btnOk.dim').count()===1,'清空后确认按钮回到置灰态');
  await page.locator('#snKw').fill('');
  await page.waitForTimeout(60);

  console.log('[G] 连续绑定：确认后停留在当前房间继续绑下一批');
  await page.locator('.mp-sch-tgt').nth(0).click();
  await page.locator('.mp-sch-tgt').nth(1).click();
  await page.waitForTimeout(40);
  ok((await page.locator('#sumTx').innerText()).includes('已选 2 台')
    &&!(await page.locator('#sumTx').innerText()).includes('不在当前筛选内'),'无筛选时摘要条不出现筛选外提示');
  await page.locator('#btnOk').click();
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-modal').count()===0,'全部可见时确认绑定不弹二次确认，直接落绑');
  ok((await page.locator('.mp-toast').innerText()).includes('已绑定 2 台到「一楼前台」'),'toast「已绑定 2 台到「一楼前台」」');
  ok(await page.locator('.mp-arb-path .pt').count()===1,'确认后仍停留在 Step ②（未退出整页）');
  ok((await page.locator('.mp-arb-path .pt').innerText())==='2号楼 › 一楼 › 前台','房间保持不变，可继续绑下一批');
  ok(await page.locator('.mp-sch-tgt').count()===2,'刚绑的 2 台已移出待绑池');
  ok((await page.locator('#sumTx').innerText()).includes('已选 0 台'),'勾选已清空');
  ok(await page.evaluate(()=>MP.data.devices.filter(d=>MP.acRoom.roomOf(d)==='一楼前台').length)===2,'绑定已持久化到 acRoomBinds');
  await page.waitForTimeout(TOAST);

  console.log('[H] 待绑池清零：空态且不自动跳转');
  await page.locator('.mp-sch-tgt').nth(0).click();
  await page.locator('.mp-sch-tgt').nth(1).click();
  await page.locator('#btnOk').click();
  await page.waitForTimeout(60);
  ok((await page.locator('.mp-empty .tx').innerText()).includes('暂无未绑定空调'),'池清零后显示空态');
  ok(await page.locator('.mp-arb-path .pt').count()===1,'池清零仍停留本页，不自动跳转');
  ok(await page.evaluate(()=>MP.cur().name)==='ac-room-bind','路由仍在 ac-room-bind');
  await page.waitForTimeout(TOAST);

  console.log('[I] 更换房间 / 完成出口 / ac-room 楼栋标注');
  await page.locator('#btnChg').click();
  await page.waitForTimeout(60);
  ok(await page.locator('.mp-arb-row').count()===3,'「更换房间」→ 回选点树且全部重新折叠');
  await page.locator('.mp-arb-row.lv1').first().click();
  await page.waitForTimeout(40);
  await page.locator('.mp-arb-row.lv2').first().click();
  await page.waitForTimeout(40);
  await page.locator('.mp-arb-row.lv3').first().click();
  await page.waitForTimeout(60);
  ok((await page.locator('.mp-arb-path .pt').innerText())==='1号楼 › 一楼 › 大堂','换到 1号楼/一楼/大堂');
  await page.locator('#btnDone').click();
  await page.waitForTimeout(120);
  ok(await page.evaluate(()=>MP.cur().name)==='ac-room','「完成」→ MP.back() 回 ac-room 列表页');
  ok(await page.locator('.mp-ar-bd').count()>0,'房间分组头出现楼栋小标注');
  const heads=await page.locator('.mp-room-head').allInnerTexts();
  ok(heads.some(t=>t.includes('1号楼')&&t.includes('一楼大堂')),'「一楼大堂」标注 1号楼');
  ok(heads.some(t=>t.includes('2号楼')&&t.includes('一楼前台')),'本轮新绑的「一楼前台」实时出现并标注 2号楼');
  ok(heads.filter(t=>t.includes('未绑定设备')).every(t=>!t.includes('号楼')),'「未绑定设备」分组不挂楼栋标注');

  console.log('[J] I-2 回归：group-form 无空串 room 造成的空分组');
  await page.evaluate(()=>MP.switchTab('home'));
  await page.evaluate(()=>MP.go('group-form'));
  await page.waitForTimeout(80);
  const ghs=await page.locator('.mp-room-head .bd').allInnerTexts();
  ok(ghs.length===6,'房间分组恰为 6 个（d19/d20 的空串 room 不成组）');
  ok(ghs.every(t=>t.trim().length>0),'不存在无标题的空分组头（I-2）');
  ok(await page.locator('.mp-room-row').count()===18,'分组内设备合计 18 台（空 room 的 2 台不参与分组）');

  ok(errors.length===0,'无 pageerror'+(errors.length?'（'+errors.slice(0,3).join(' | ')+'）':''));
  await browser.close();
  if(failCount){ console.error('\n共 '+failCount+' 项未通过'); process.exit(1); }
  console.log('\n全部通过（'+pass+' 项）');
})();
