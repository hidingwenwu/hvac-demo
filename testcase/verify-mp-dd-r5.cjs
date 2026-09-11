/* R5 冒烟：device-detail 双页签（模式设置/限定设置）交互实测
   用 playwright-core + 本机 Chrome 直开 file:// 原型，覆盖：
   双页签切换 / 电源双大卡与锁定禁用 / 模式图标卡 / 温度滑块 ± / 风速卡 /
   确定写回 / 限定设置四开关 / 温度范围双滑块 min<max / 制热制冷固定互斥 /
   设置起效写回 lock / 解除锁定二次确认 / 离线禁用
   运行：node testcase/verify-mp-dd-r5.cjs */
const path=require('node:path');
const { chromium }=require('playwright-core');
const FILE='file:///'+path.join(__dirname,'..','hvac-demo-mp.html').replace(/\\/g,'/');

let pass=0,failCount=0;
function ok(cond,msg){ if(cond){pass++;console.log('  ✓ '+msg)}else{failCount++;console.error('  ✗ '+msg)} }

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:414,height:896}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(()=>{ localStorage.clear(); });
  await page.reload();
  /* 登录（账号密码演示账号 admin/admin123，见 login.js） */
  await page.evaluate(()=>{ MP.state.set('loggedIn',true); MP.state.set('role','admin'); });
  await page.evaluate(()=>MP.switchTab('device'));

  /* 进 d1（在线、开机、无锁定） */
  await page.evaluate(()=>MP.go('device-detail',{id:'d1'}));
  await page.waitForTimeout(50);

  console.log('[A] 模式设置页签结构');
  ok(await page.locator('.mp-dd-tab').count()===2,'胶囊页签两个');
  ok((await page.locator('.mp-dd-tab.on').innerText())==='模式设置','默认选中模式设置');
  ok(await page.locator('.mp-dd-head .path').innerText().then(t=>t.includes(' / ')),'顶部设备卡含项目/房间路径');
  ok(await page.locator('.mp-dd-unit svg').count()===1,'室内机占位图渲染');
  ok(await page.locator('.mp-dd-pcard').count()===2,'设备开关机双大卡');
  ok(await page.locator('.mp-dd-pcard.on').innerText().then(t=>t.includes('开机')),'d1 开机卡选中');
  ok(await page.locator('.mp-dd-icards').count()===2,'模式+风速两组图标卡');
  ok(await page.locator('.mp-dd-icard[data-m]').count()===4,'模式四卡');
  ok(await page.locator('.mp-dd-icard[data-w]').count()===4,'风速四卡');
  ok(await page.locator('#ddTRange').count()===1,'温度滑块存在');
  ok((await page.locator('#ddTRange').getAttribute('min'))==='16'&&(await page.locator('#ddTRange').getAttribute('max'))==='31','温度滑块 16-31');
  ok(await page.locator('.mp-ticks i').count()===16,'刻度 16 根（16-31）');
  ok((await page.locator('#ddOk').innerText())==='确定','底部确定按钮');

  console.log('[B] 模式设置交互与确定写回');
  await page.locator('#ddTPlus').click();
  ok((await page.locator('#ddTempV').innerText())===String(+ await page.evaluate(()=>MP.data.devices[0].temp)+1),'＋ 后大字 +1（面板态）');
  await page.locator('#ddTMinus').click();
  await page.locator('#ddTRange').evaluate(el=>{ el.value=28; el.dispatchEvent(new Event('input')); });
  ok((await page.locator('#ddTempV').innerText())==='28','滑块拖到 28 大字同步');
  ok(await page.evaluate(()=>MP.data.devices[0].temp)!==28,'未点确定前设备对象未写回');
  await page.locator('.mp-dd-icard[data-m="heat"]').click();
  await page.locator('.mp-dd-icard[data-w="high"]').click();
  await page.locator('#ddOk').click();
  ok(await page.evaluate(()=>{const d=MP.data.devices[0];return d.temp===28&&d.mode==='heat'&&d.wind==='high';}),'确定写回 power/mode/temp/wind');
  /* 关机联动：点关机卡 → 模式/温度/风速区降透明，滑块 disabled */
  await page.locator('.mp-dd-pcard[data-p="0"]').click();
  ok(await page.locator('.mp-dd-modecard.mp-dd-dim').count()===3,'面板选关机后三区降透明');
  ok(await page.locator('#ddTRange').isDisabled(),'面板选关机后滑块禁用');
  await page.locator('.mp-dd-pcard[data-p="1"]').click();
  ok(await page.locator('.mp-dd-modecard.mp-dd-dim').count()===0,'回选开机后三区恢复');

  console.log('[C] 限定设置页签');
  await page.locator('.mp-dd-tab[data-tab="limit"]').click();
  await page.waitForTimeout(50);
  ok((await page.locator('.mp-dd-tab.on').innerText())==='限定设置','页签切到限定设置');
  ok(await page.locator('.mp-card.mp-lim .mp-switch').count()===4,'限定设置四个开关行（禁止启动/禁止关闭/制热固定/制冷固定）');
  ok(await page.locator('.mp-lim-col .mp-lim .mp-switch').count()===1,'温度范围限定开关行（展开卡内）');
  ok(await page.locator('.mp-drange').count()===0,'温度范围限定默认关（无双滑块）');
  /* 开温度范围限定 → 展开双滑块 */
  await page.locator('.mp-switch[data-lk="tempOn"]').click();
  await page.waitForTimeout(50);
  ok(await page.locator('.mp-drange input').count()===2,'开启后双滑块出现');
  ok((await page.locator('#lmRV').innerText())==='23-28','默认区间 23-28°C');
  ok((await page.locator('#lmLo').getAttribute('max'))==='32','双滑块范围 16-32');
  /* min<max 校验：lo 拖到 >=hi 被钳到 hi-1 */
  await page.locator('#lmLo').evaluate(el=>{ el.value=30; el.dispatchEvent(new Event('input')); });
  ok((await page.locator('#lmRV').innerText())==='27-28','lo 越界钳到 hi-1（min<max）');
  await page.locator('#lmHi').evaluate(el=>{ el.value=20; el.dispatchEvent(new Event('input')); });
  ok((await page.locator('#lmRV').innerText())==='27-28','hi 越界钳到 lo+1');
  /* 制热/制冷固定互斥 */
  await page.locator('.mp-switch[data-lk="heatFix"]').click();
  await page.waitForTimeout(30);
  await page.locator('.mp-switch[data-lk="coolFix"]').click();
  await page.waitForTimeout(30);
  ok(!(await page.locator('.mp-switch[data-lk="heatFix"] input').isChecked())&&(await page.locator('.mp-switch[data-lk="coolFix"] input').isChecked()),'制冷固定开启时制热固定自动关');
  /* 设置起效：写回 lock */
  await page.locator('.mp-switch[data-lk="noOn"]').click();
  await page.locator('#lmApply').click();
  ok(await page.evaluate(()=>{const L=MP.data.devices[0].lock;
    return L.noOn===true&&L.coolFix===true&&L.heatFix===false&&L.tempLo===27&&L.tempHi===28;}),'设置起效写回 device.lock（含区间 27-28）');
  ok(await page.evaluate(()=>MP.data.devices[0].mode)==='cool','制冷固定同步写 d.mode=cool');

  console.log('[D] 锁定联动回模式设置页签');
  await page.locator('.mp-dd-tab[data-tab="mode"]').click();
  await page.waitForTimeout(50);
  ok(await page.locator('.mp-dd-pcard[data-p="1"].dis').count()===1,'noOn 后开机卡禁用');
  ok(await page.locator('.mp-dd-pcard[data-p="0"].dis').count()===0,'noOff 未设，关机卡可用');
  ok(await page.locator('.mp-dd-modecard .mp-dd-lock').count()>=2,'模式/温度区显示锁定标');
  ok(await page.locator('.mp-dd-icard[data-m].dis').count()===4,'制冷固定后模式四卡全禁用');
  ok(await page.locator('.mp-dd-icard[data-m="cool"].on').count()===1,'制冷固定卡保持选中');
  ok((await page.locator('#ddTRange').getAttribute('min'))==='27'&&(await page.locator('#ddTRange').getAttribute('max'))==='28','温度滑块收窄到锁定范围 27-28');
  await page.locator('.mp-dd-pcard[data-p="1"]').click();
  ok(await page.evaluate(()=>MP.data.devices[0].power)===true,'禁用的开机卡点击不写面板态');

  console.log('[E] 解除锁定');
  await page.locator('.mp-dd-tab[data-tab="limit"]').click();
  await page.waitForTimeout(50);
  await page.locator('#lmUnlock').click();
  await page.waitForTimeout(30);
  await page.locator('.mp-modal .mp-btn-danger').click();   /* 二次确认 */
  await page.waitForTimeout(50);
  ok(await page.evaluate(()=>{const L=MP.data.devices[0].lock;
    return !L.noOn&&!L.noOff&&!L.heatFix&&!L.coolFix&&L.tempLo===null&&L.tempHi===null;}),'解除锁定清空全部锁定字段');

  console.log('[F] d6 种子（mode 锁 + noOn）与离线设备');
  await page.evaluate(()=>{ MP.back(); MP.go('device-detail',{id:'d6'}); });
  await page.waitForTimeout(300);   /* 等退场动画移除旧页，避免双页共存干扰选择器 */
  ok(await page.locator('.mp-dd-pcard[data-p="1"].dis').count()===1,'d6 noOn:true 开机卡禁用（种子演示）');
  ok(await page.locator('.mp-dd-modecard .mp-dd-lock').first().innerText().then(t=>t.includes('模式锁定')),'d6 模式锁定标显示');
  await page.evaluate(()=>{ MP.back(); MP.go('device-detail',{id:'d5'}); });   /* d5: i=4 → 离线 */
  await page.waitForTimeout(300);
  ok(await page.locator('.mp-dd-banner.wn').count()===1,'离线黄条');
  ok(await page.locator('#ddOk').isDisabled(),'离线确定按钮禁用');
  ok((await page.locator('#ddOk').innerText())==='确定','确定按钮文案');
  /* 限定设置在离线时仍可下发（平台侧配置语义） */
  await page.locator('.mp-dd-tab[data-tab="limit"]').click();
  await page.waitForTimeout(50);
  ok(await page.locator('.mp-switch[data-lk="noOff"] input').isEnabled(),'离线时限定设置开关仍可操作');

  ok(errors.length===0,'无 pageerror'+(errors.length?('：'+errors[0]):''));
  await browser.close();
  console.log('\n'+(failCount?('共 '+failCount+' 项未通过'):'全部通过')+'（'+pass+' 项）');
  process.exit(failCount?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
