/* R8 回归验证（原型自身回归，非交付测试用例）：
   ① 设备网格卡 gwdbg 风格重排（顶部开关文字 / 模式风速行 / 底部方形勾选 + 电源钮）
   ② 节能策略表单四类字段与校验（对照 Web 端 strategy-env/wind/load/ultimate）
   ③ 全站视觉令牌迁移（主色 / 卡片描边 / 选中语言） */
const path=require('node:path');
const fs=require('node:fs');
const { chromium }=require('playwright-core');
const ROOT=path.join(__dirname,'..');
const FILE='file:///'+path.join(ROOT,'hvac-demo-mp.html').replace(/\\/g,'/');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok  '+m);} else {fail++;console.log('  FAIL '+m);} };

(async()=>{
  const css=fs.readFileSync(path.join(ROOT,'mp','mp.css'),'utf8');
  const devjs=fs.readFileSync(path.join(ROOT,'mp','pages','device.js'),'utf8');

  console.log('\n[静态] 视觉令牌与样式');
  ok(css.includes('--mp-primary:#2457D6'),'主色迁移为 gwdbg #2457D6');
  ok(css.includes('--mp-tx:#17233A'),'正文色迁移为蓝黑 #17233A');
  ok(css.includes('--mp-card-bd'),'新增卡片 1px 描边令牌');
  ok(css.includes('--mp-r:14px'),'卡片圆角 14px');
  ok(/\.mp-card\{[^}]*border:1px solid var\(--mp-card-bd\)/.test(css),'卡片带 1px 描边');
  ok(css.includes('.mp-dev-card.sel{border-color:var(--mp-primary);box-shadow:0 0 0 2px var(--mp-primary-ring)'),
     '卡片选中态为主色描边 + 2px 光环');
  ok(css.includes('.mp-chip.on{border-color:var(--mp-primary)'),'chips 选中为描边+淡蓝底（非实心反白）');

  console.log('\n[静态] 设备卡片结构（gwdbg 骨架）');
  ok(devjs.includes('g-head')&&devjs.includes('g-onoff'),'网格卡有顶部行与开/关状态文字');
  ok(devjs.includes('g-return'),'网格卡有室温小字行');
  ok(devjs.includes('g-modes'),'网格卡有模式·风速主色行');
  ok(devjs.includes('g-foot')&&devjs.includes('mp-chk-sq'),'网格卡底部行含方形勾选');
  ok(!devjs.includes('mp-gcheck'),'旧的右上角圆形勾选已移除');
  ok(css.includes('.mp-dev-card.grid .mp-pow{width:40px'),'电源钮改为底部行内（不再绝对定位）');

  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:414,height:896}});
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.goto(FILE);
  await page.evaluate(()=>{ localStorage.clear(); MP.state.set('loggedIn',true); MP.state.set('role','admin'); });

  /* toast 存活 2s，连续断言会读到上一条：每次点击前先清空，读取时取最后一条 */
  const clearToast=()=>page.evaluate(()=>{ document.querySelectorAll('.mp-toast').forEach(t=>t.remove()); });
  const toast=()=>page.evaluate(()=>{
    const a=document.querySelectorAll('.mp-toast');
    return a.length?a[a.length-1].textContent:'';
  });
  const save=async()=>{ await clearToast(); await page.evaluate(()=>document.querySelector('#btnSave').click()); await page.waitForTimeout(150); };
  const gotoForm=async(type)=>{
    await page.evaluate(()=>{ MP.switchTab('home'); MP.go('strategy-list'); MP.go('strategy-form',{}); });
    await page.waitForTimeout(150);
    await page.evaluate(ty=>{ const c=document.querySelector('#typeChips .mp-chip[data-t="'+ty+'"]'); if(c)c.click(); },type);
    await page.waitForTimeout(150);
  };
  const setVal=(sel,v)=>page.evaluate(([s,val])=>{
    const n=document.querySelector(s);
    n.value=val;
    n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}));
  },[sel,v]);

  console.log('\n[设备页] 卡片渲染');
  await page.evaluate(()=>MP.switchTab('device'));
  await page.waitForTimeout(250);
  const dev=await page.evaluate(()=>document.querySelector('#pages .mp-page:last-child').innerHTML);
  ok(dev.includes('g-onoff'),'设备卡渲染出开/关状态文字');
  ok(/g-modes[^<]*>.*制冷/.test(dev.replace(/\n/g,'')),'设备卡渲染出模式文字');
  await page.evaluate(()=>document.querySelector('#btnMulti').click());
  await page.waitForTimeout(150);
  const dev2=await page.evaluate(()=>document.querySelector('#pages .mp-page:last-child').innerHTML);
  ok(dev2.includes('mp-chk-sq'),'批量控制态出现方形勾选框');

  console.log('\n[策略表单] 环境感知联动');
  await gotoForm('env');
  let html=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(html.includes('任务描述')&&html.includes('生效日期')&&html.includes('生效时间')
     &&html.includes('周重复时间')&&html.includes('排除日期'),'基础信息六项字段齐全');
  ok(html.includes('如果满足条件')&&html.includes('则执行如下动作'),'两个分区标题照搬 Web 原文');
  ok(html.includes('持续满足条件'),'含「持续满足条件」开关');
  const order=await page.evaluate(()=>Array.from(document.querySelectorAll('#stgBody .mp-card:first-of-type .mp-fr>.lab'))
    .map(n=>n.textContent.replace('*','')));
  ok(order[0]==='任务名称'&&order[1]==='任务描述'&&order[2]==='生效日期',
     '字段顺序与 Web 一致：任务名称→任务描述→生效日期（实际：'+order.slice(0,3).join('/')+'）');

  await setVal('#fName','回归-环境感知');
  await save();
  ok((await toast()).includes('房间'),'未选房间时拦截并提示选房间');

  /* 楼栋整选：1号楼 6 个房间 */
  await page.evaluate(()=>document.querySelector('#roomTree [data-ckb]').click());
  await page.waitForTimeout(200);
  let scope=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(scope.includes('已选 6 个房间'),'楼栋整选联动勾选其下全部房间');

  /* 动作 1（空调控制）未设任何参数 → 先拦截「至少一个控制参数」 */
  await save();
  ok((await toast()).includes('至少需要选择一个控制参数'),'空调控制动作未设参数被拦截');

  /* 设开关机=关机，让动作 1 合法，再验证后续动作链规则 */
  await page.evaluate(()=>{
    const s=document.querySelector('#acP0'); s.value='关机';
    s.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(150);

  /* 添加动作 → 默认补一条延时 → 末位为延时应被拦截 */
  await page.evaluate(()=>document.querySelector('#btnAddAct').click());
  await page.waitForTimeout(150);
  await save();
  ok((await toast()).includes('最后一个执行动作不能是延时'),'末位延时被拦截（对齐 Web 校验）');

  /* 第 2 个动作切为锁定控制 → 空调控制后无延时,命中 V1.2 新规拦截 */
  await page.evaluate(()=>{
    const s=document.querySelectorAll('select[data-actkind]')[1];
    s.value='lock'; s.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(180);
  await save();
  ok((await toast()).includes('控制类动作后必须紧跟一个延时动作'),'控制类动作后无延时被拦截（V1.2 新规）');

  /* 切回延时,再添加第 3 个动作并切为锁定控制 → [空调控制,延时,锁定] 合法序列 */
  await page.evaluate(()=>{
    const s=document.querySelectorAll('select[data-actkind]')[1];
    s.value='delay'; s.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>document.querySelector('#btnAddAct').click());
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const s=document.querySelectorAll('select[data-actkind]')[2];
    s.value='lock'; s.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(180);
  /* 锁定控制后再添加动作 → 默认应为延时(验证后删除该动作) */
  await page.evaluate(()=>document.querySelector('#btnAddAct').click());
  await page.waitForTimeout(150);
  const kind3=await page.evaluate(()=>document.querySelectorAll('select[data-actkind]')[3].value);
  ok(kind3==='delay','锁定控制后添加动作默认为延时（V1.2 新规）');
  await page.evaluate(()=>document.querySelectorAll('[data-delact]')[3].click());
  await page.waitForTimeout(150);

  /* 锁定控制 + 制热与制冷同时锁定 → 冲突拦截 */
  await page.evaluate(()=>{
    const w=document.querySelector('[data-lockmode="2"]');
    w.querySelector('.mp-chip[data-v="制冷"]').click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const w=document.querySelector('[data-lockmode="2"]');
    w.querySelector('.mp-chip[data-v="制热"]').click();
  });
  await page.waitForTimeout(150);
  await save();
  ok((await toast()).includes('制热不能与制冷'),'制热与制冷同时锁定被拦截');

  /* 取消制热 → 冲突解除 → 保存成功 */
  await page.evaluate(()=>document.querySelector('[data-lockmode="2"] .mp-chip[data-v="制热"]').click());
  await page.waitForTimeout(150);
  await save();
  await page.waitForTimeout(150);
  const saved=await page.evaluate(()=>MP.q.strategies().find(s=>s.name==='回归-环境感知'));
  ok(!!saved,'环境感知策略保存成功');
  ok(saved&&saved.rooms&&saved.rooms.length===6,'保存的房间数为 6');
  ok(saved&&saved.desc.indexOf('检测到')===0&&saved.desc.includes('关机'),'摘要按 Web 口径生成：'+(saved?saved.desc:''));
  ok(saved&&saved.actions.length===3&&saved.actions[2].kind==='lock','动作链结构正确保存');

  console.log('\n[策略表单] 一键排除节假日');
  await gotoForm('env');
  await page.evaluate(()=>document.querySelector('#fExHoliday').click());
  await page.waitForTimeout(200);
  const exHtml=await page.evaluate(()=>document.querySelector('#fExList').innerHTML);
  ok(exHtml.includes('国庆节')&&exHtml.includes('中秋节'),'一键排除节假日按生效期填入并标注节日名');
  ok(!exHtml.includes('2027-01-01'),'超出生效日期范围的节假日不加入');

  console.log('\n[策略表单] 风水联动');
  await gotoForm('wind');
  html=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(html.includes('时间范围')&&html.includes('执行周期')&&html.includes('备注'),'wind 基础信息字段齐全');
  ok(html.includes('执行策略')&&html.includes('联动水阀'),'含策略库引用与只读参数（含联动水阀）');
  ok(html.includes('房间范围'),'生效范围为「房间范围」单选');
  await setVal('#fLib','wl4');
  await page.waitForTimeout(200);
  html=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(html.includes('常开'),'切换策略后只读参数区同步刷新');

  console.log('\n[策略表单] 负荷调控');
  await gotoForm('load');
  html=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(html.includes('空调类型')&&html.includes('起始时间')&&html.includes('结束时间'),'load 基础信息字段齐全');
  ok(html.includes('负荷调控目标(kW)')&&html.includes('负荷调控目标(幅度)')&&html.includes('来源'),
     'load 目标区字段照搬 Web 原文标签');
  ok(html.includes('调控范围'),'生效范围为「调控范围」多选');
  await setVal('#fName','回归-负荷');
  await save();
  ok((await toast()).includes('起止时间'),'未填起止时间被拦截');

  console.log('\n[策略表单] 极致节能');
  await gotoForm('ultimate');
  html=await page.evaluate(()=>document.querySelector('#stgBody').innerHTML);
  ok(html.includes('空调控制配置')&&html.includes('下发间隔'),'ultimate 含空调控制配置与下发间隔');
  ok(html.includes('周运行时间'),'周字段标签为「周运行时间」（与 env 的「周重复时间」区分）');
  const btnTxt=await page.evaluate(()=>document.querySelector('#btnSave').textContent);
  ok(btnTxt==='保存并启用任务','保存按钮文案照搬 Web「保存并启用任务」');
  await setVal('#fName','回归-极致');
  await page.evaluate(()=>document.querySelector('#roomTree [data-ckb]').click());
  await page.waitForTimeout(180);
  await save();
  ok((await toast()).includes('至少需要设置一项'),'四项均不设置被拦截');
  await setVal('#fItv','3');
  await save();
  ok((await toast()).includes('5-120'),'下发间隔越界被拦截');

  console.log('\n[策略列表] 编辑回填');
  await page.evaluate(()=>{ MP.switchTab('home'); MP.go('strategy-list'); });
  await page.waitForTimeout(200);
  const listHtml=await page.evaluate(()=>document.querySelector('#pages .mp-page:last-child').innerHTML);
  ok(listHtml.includes('检测到无人'),'列表摘要显示结构化 desc');
  ok(listHtml.includes('生效范围：'),'列表显示生效范围行');
  await page.evaluate(()=>MP.go('strategy-form',{id:'st1'}));
  await page.waitForTimeout(250);
  const back=await page.evaluate(()=>({
    name:document.querySelector('#fName').value,
    body:document.querySelector('#stgBody').innerHTML,
    ro:!!document.querySelector('#typeChips.mp-stg-types.ro')||!!document.querySelector('.mp-stg-types.ro'),
  }));
  ok(back.name==='会议室人走关机','编辑态名称回填');
  ok(back.body.includes('已选 2 个房间'),'编辑态房间回填 2 个');
  ok(back.body.includes('持续满足条件'),'编辑态触发条件区回填');
  ok(back.ro,'编辑态策略类型只读');

  console.log('\n[全局] 页面错误');
  ok(errs.length===0,'无 JS 运行时错误'+(errs.length?'：'+errs.join(' | '):''));

  await browser.close();
  console.log('\n通过 '+pass+' 项，失败 '+fail+' 项\n');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
