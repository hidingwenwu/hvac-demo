/* 空调集控管家小程序原型 · 结构回归校验（仅原型自身回归，不属于交付测试用例） */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
let fail=0;
function ok(cond,msg){ if(cond){console.log('  ✓ '+msg)} else {fail++;console.error('  ✗ '+msg)} }
function read(p){ return fs.existsSync(path.join(ROOT,p)) ? fs.readFileSync(path.join(ROOT,p),'utf8') : null }

console.log('[1] 文件存在性');
['hvac-demo-mp.html','mp/mp.css','mp/data.js','mp/pages/home.js'].forEach(f=>ok(read(f)!==null,f+' 存在'));

const shell=read('hvac-demo-mp.html');
if(shell){
  console.log('[2] 入口壳');
  ok(shell.includes('空调集控管家'),'标题含「空调集控管家」');
  ok(!/type=["']module["']/.test(shell),'未使用 ES module');
  ['mp/mp.css','mp/data.js','mp/pages/home.js'].forEach(s=>ok(shell.includes('src="'+s+'"')||shell.includes('href="'+s+'"'),'引用 '+s));
  ok(shell.includes('MP.go'),'壳内实现 MP.go');
  ok(shell.includes('MP.ui.toast'),'壳内实现 MP.ui.toast');
}
const data=read('mp/data.js');
if(data){
  console.log('[3] 数据层');
  ['projects','devices','groups','schedules','strategies','envSensors','controllers','bills','tenants'].forEach(k=>ok(data.includes(k+':')||data.includes(k+' ='),'MP.data.'+k));
  ok(data.includes("'prepaid'")&&data.includes("'postpaid'"),'含预付费+后付费两种项目');
}
const css=read('mp/mp.css');
if(css){
  console.log('[4] 主题');
  ok(css.includes('#F5F7FA')||css.includes('#f5f7fa'),'浅色页面底');
  ok(css.includes('#1F65FF')||css.includes('#1f65ff'),'主色 #1F65FF');
}
console.log('[5] 登录模块');
const login=read('mp/pages/login.js'), bind=read('mp/pages/login-bind.js');
ok(login!==null&&login.includes('MP.pages.login'),'login 页注册');
ok(bind!==null&&bind.includes("MP.pages['login-bind']="),'login-bind 页真实注册');
if(login){
  ['账号密码','验证码','微信','青岛飞奕科技有限公司'].forEach(s=>ok(login.includes(s),'login 含「'+s+'」'));
  ok(/60/.test(login)&&/countdown|timer|Interval/i.test(login),'验证码 60s 倒计时');
  /* V2.0 去角色化（剥离 note 后检查页面主体，避免 note 删减说明误命中） */
  const _lgn=login.replace(/note:\[[\s\S]*?\]/,'');
  ok(!_lgn.includes('mp-demo-card')&&!_lgn.includes('demoToggle'),'login 无演示账号快捷登录卡片区（V2.0）');
  ok(login.includes("MP.state.set('role','admin')"),'login 登录成功固定写 role=admin');
  ok(!login.includes("acc==='tenant'"),'login 账号密码不再认 tenant 演示账号（V2.0）');
}
if(bind){
  ok(bind.includes('绑定'),'login-bind 含绑定逻辑');
  ok(bind.includes('Web'),'login-bind 含 Web 端适配说明');
  ok(bind.includes("MP.state.set('role','admin')"),'login-bind 绑定成功固定写 role=admin');
}
const sh=read('hvac-demo-mp.html');
ok(sh.includes('src="mp/pages/login.js"')&&sh.includes('src="mp/pages/login-bind.js"'),'壳引用登录两页');
ok(/first='login'/.test(sh)&&/MP\.stack=\[\{name:first/.test(sh),'未登录 boot 直达 login 页');

console.log('[6] 首页');
const home=read('mp/pages/home.js');
ok(home!==null&&home.includes('MP.pages.home'),'home 页注册');
if(home){
  ok(home.includes('tab:true'),'home 为 Tab 页');
  ['banner','项目切换','onPullRefresh'].forEach(s=>ok(home.includes(s),'home 含「'+s+'」'));
  /* R3 新结构：快捷功能卡 / 环形设备状态卡 / 锁定状态卡 / 日程群组概览卡 / 全部功能宫格 */
  ['空调控制','定时任务','群组管理'].forEach(s=>ok(home.includes(s),'快捷功能卡含「'+s+'」'));
  ok(home.includes('<svg')&&home.includes('stroke-dasharray')&&home.includes('stroke-dashoffset'),'home 含 SVG 环形进度图（stroke-dasharray 实现）');
  ok(home.includes('可用设备总数')&&home.includes('平均设定温度')&&home.includes('平均室内温度'),'home 状态卡含环形中心文案与两个平均温度 chips');
  ['运行','关机','故障','离线'].forEach(s=>ok(home.includes(s),'状态四格含「'+s+'」'));
  ['模式锁定','温度锁定','开关锁定'].forEach(s=>ok(home.includes(s),'锁定三格含「'+s+'」'));
  ok((home.match(/查看全部/g)||[]).length>=2,'日程/群组概览卡含「查看全部」');
  ok(home.includes('MP.q.schedules()')&&home.includes('MP.q.groups()'),'home 日程/群组数量取自 MP.q 实时查询');
  ok(home.includes('devFilter'),'home 状态四格点击经 devFilter 预设设备页筛选');
  ['空调控制','群组管理','日程管理','节能策略','环境感知','电费查询','空调房间绑定','控制器'].forEach(s=>ok(home.includes(s),'宫格含「'+s+'」'));
  ok(!home.includes("label:'更多'"),'home 宫格无「更多」项（func 已删，V2.0）');
  ok(home.includes("to:'elec-admin'")&&!home.includes('elec-tenant'),'home 宫格「电费查询」固定 elec-admin（V2.0）');
  /* R3 清理：能耗演示数据 / 旧状态卡与柱状图 / GRID ready 死分支 */
  ok(!home.includes('TREND')&&!home.includes('TODAY_KWH')&&!home.includes('186.4'),'home 无近 7 日能耗/今日能耗演示数据（R3 移除）');
  ok(!home.includes('mp-home-chart')&&!home.includes('mp-home-env')&&!home.includes('mp-home-stat'),'home 无旧柱状图/环境摘要/旧状态卡类名（R3 移除）');
  ok(!home.includes('ready')&&!home.includes('功能建设中'),'home GRID 无 ready 死分支与「功能建设中」兜底（R3 清理）');
  /* note 6 条 type 序列 */
  const _nt=home.match(/note:\[([\s\S]*?)\]/);
  const _types=_nt?Array.from(_nt[1].matchAll(/type:'([^']+)'/g)).map(m=>m[1]):[];
  ok(_types.join(',')==='新增,新增,新增,删减,删减,优化','home note 6 条 type 序列（新增×3/删减×2/优化）');
}
const css2=read('mp/mp.css');
if(css2){
  ok(css2.includes('mp-home'),'mp.css 含首页样式区');
  ok(css2.includes('.mp-home-quick')&&css2.includes('.mp-home-ring')&&css2.includes('.mp-home-lock')&&css2.includes('.mp-home-mini'),'mp.css 含首页 V2 新样式区');
  ok(!css2.includes('.mp-home-stat')&&!css2.includes('.mp-home-chart')&&!css2.includes('.mp-home-env'),'mp.css 旧首页样式（状态卡/柱状图/环境摘要）已清理');
}

console.log('[7] 我的模块');
const me=read('mp/pages/me.js'), prof=read('mp/pages/me-profile.js'),
      ls=read('mp/pages/login-settings.js'), ab=read('mp/pages/about.js');
ok(me!==null&&me.includes('MP.pages.me'),'me 页注册');
ok(prof!==null&&prof.includes("MP.pages['me-profile']="),'me-profile 页真实注册');
ok(ls!==null&&ls.includes("MP.pages['login-settings']="),'login-settings 页真实注册');
ok(ab!==null&&ab.includes('MP.pages.about'),'about 页注册');
if(me){
  ok(me.includes('tab:true'),'me 为 Tab 页');
  ok(me.includes('物业管理员')&&me.includes('tag-primary'),'me 用户卡固定「物业管理员」tag（V2.0）');
  ok(!me.replace(/note:\[[\s\S]*?\]/,'').includes('切换角色'),'me 无「切换角色」入口（V2.0）');
}
if(ls){ ['原密码','新密码'].forEach(s=>ok(ls.includes(s),'login-settings 含「'+s+'」')); }
if(ab){ ['空调集控管家','青岛飞奕科技有限公司'].forEach(s=>ok(ab.includes(s),'about 含「'+s+'」')); }
ok(shell.includes('src="mp/pages/me.js"')&&shell.includes('src="mp/pages/me-profile.js"')
  &&shell.includes('src="mp/pages/login-settings.js"')&&shell.includes('src="mp/pages/about.js"'),'壳引用我的模块四页');

console.log('[8] 设备控制');
const dev=read('mp/pages/device.js'), dd=read('mp/pages/device-detail.js');
ok(dev!==null&&dev.includes('MP.pages.device'),'device 页注册');
ok(dd!==null&&dd.includes("MP.pages['device-detail']="),'device-detail 页真实注册');
if(dev){
  ok(dev.includes('tab:true'),'device 为 Tab 页');
  ['批量控制','开关状态','搜索'].forEach(s=>ok(dev.includes(s),'device 含「'+s+'」'));
  ok(dev.includes("MP.state.get('devFilter')")&&dev.includes("MP.state.set('devFilter','')"),'device 读取并一次性消费首页 devFilter 预设筛选（R3）');
  /* R4 网格化 + R8 卡片重排：2 列卡片网格 + 整卡点选多选（主色描边 + 底部方形勾选） */
  ok(dev.includes("layout:'grid'"),'device 设备卡使用 grid 网格布局（R4）');
  ok(dev.includes('mp-dev-grid'),'device 列表容器为 mp-dev-grid 网格类（R4）');
  ok(dev.includes('g-modes')&&dev.includes('MODE_TXT[d.mode]'),'device 网格卡含模式·风速文字行（R8 起，替代 R4 双图标行）');
  ok(dev.includes('mp-chk-sq'),'device 多选为网格卡底部方形勾选（R8 起，替代 R4 右上角圆标）');
  ok(dev.includes('g-return')&&dev.includes('室温 '),'device 网格卡含室温小字（R8 起为独立 g-return 行）');
  ok(css2.includes('.mp-dev-grid')&&css2.includes('grid-template-columns:1fr 1fr'),'mp.css 含设备网格 2 列定义（R4）');
  ok(css2.includes('.mp-dev-card.grid .mp-pow')&&css2.includes('.mp-chk-sq'),'mp.css 含网格卡电源钮与方形勾选样式（R8）');
  ok(css2.includes('.mp-dev-card.sel'),'mp.css 多选选中态为主色描边（R4）');
}
if(dd){
  ['16','31','制冷','制热','送风','除湿','风速','锁定'].forEach(s=>ok(dd.includes(s),'device-detail 含「'+s+'」'));
  /* R5 双页签重构（模式设置/限定设置） */
  ['模式设置','限定设置','确定'].forEach(s=>ok(dd.includes(s),'device-detail 含「'+s+'」（R5）'));
  ok(dd.includes('mp-dd-tab'),'device-detail 含胶囊页签（R5）');
  ok(dd.includes('mp-dd-pcards')&&dd.includes('data-p'),'device-detail 设备开关机双大卡（R5）');
  ok(dd.includes('mp-dd-icards')&&dd.includes('MP.icon(this.MODE_ICON[k])'),'device-detail 模式/风速图标卡（R5）');
  ok(dd.includes('type="range"')&&dd.includes('mp-range')&&dd.includes('mp-ticks'),'device-detail 设定温度滑块+刻度（R5）');
  /* R5 限定设置：四开关 + 温度范围双滑块 + 双按钮 */
  ['禁止启动','禁止关闭','温度范围限定','制热固定','制冷固定','解除锁定','设置起效'].forEach(s=>ok(dd.includes(s),'device-detail 限定设置含「'+s+'」（R5）'));
  ok(dd.includes('mp-drange')&&dd.includes('lmLo')&&dd.includes('lmHi'),'device-detail 温度范围双滑块区间选择器（R5）');
  ok(dd.includes('noOn')&&dd.includes('noOff')&&dd.includes('heatFix')&&dd.includes('coolFix'),'device-detail 锁定模型含新字段（R5）');
  ok(dd.includes('lm.lo>=lm.hi')&&dd.includes('lm.hi-1')&&dd.includes('lm.lo+1'),'device-detail 双滑块 min<max 校验（R5）');
  ok(css2.includes('.mp-dd-tabs')&&css2.includes('.mp-dd-pcards')&&css2.includes('.mp-dd-icards'),'mp.css 含控制面板 V2 页签/双大卡/图标卡（R5）');
  ok(css2.includes('.mp-range')&&css2.includes('.mp-drange')&&css2.includes('.mp-btn-soft'),'mp.css 含定制滑块/双滑块/浅蓝按钮（R5）');
  ok(!css2.includes('.mp-dd-pow{')&&!css2.includes('.mp-dd-modes')&&!css2.includes('.mp-dd-rt{'),'mp.css 旧控制面板样式（大电源键/旧模式格/室温大字）已清理（R5）');
  /* data.js 锁定模型扩展：d6 补 noOn:true 演示，生成循环补齐新键 */
  const _dt=read('mp/data.js');
  ok(_dt.includes('noOn:i===5'),'data.js d6 种子补 noOn:true（R5）');
  ok(_dt.includes('noOff:false')&&_dt.includes('heatFix:false')&&_dt.includes('coolFix:false'),'data.js lock 生成循环补齐新字段（R5）');
}
ok(shell.includes('src="mp/pages/device.js"')&&shell.includes('src="mp/pages/device-detail.js"'),'壳引用设备控制两页');

console.log('[9] 群组管理');
const gl=read('mp/pages/group-list.js'),
      gd=read('mp/pages/group-detail.js'), gf=read('mp/pages/group-form.js');
ok(gl!==null&&gl.includes("MP.pages['group-list']"),'group-list 页注册');
ok(gd!==null&&gd.includes("MP.pages['group-detail']"),'group-detail 页注册');
ok(gf!==null&&gf.includes("MP.pages['group-form']"),'group-form 页注册');
if(gl){ ['新增群组','saveGroups','在线率'].forEach(s=>ok(gl.includes(s),'group-list 含「'+s+'」')); }
if(gd){ ['批量控制','MP.devCard','MP.devBatchRun'].forEach(s=>ok(gd.includes(s),'group-detail 含「'+s+'」')); }
if(gd){ ok(gd.includes("layout:'row'"),'group-detail 成员设备卡保持 row 单列布局（R4 不随 device 网格化）'); }
if(gf){ ['群组名称','选择设备','half','saveGroups'].forEach(s=>ok(gf.includes(s),'group-form 含「'+s+'」')); }
ok(dev.includes('MP.devCard')&&dev.includes('MP.devBatchRun'),'device 抽出共用设备卡与批量控制');
['group-list','group-detail','group-form'].forEach(p=>ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p));
ok(home!==null&&/label:'群组管理'[^}]*to:'group-list'/.test(home),'home 宫格「群组管理」已接通');

console.log('[10] 日程管理');
const sl=read('mp/pages/schedule-list.js'), sf=read('mp/pages/schedule-form.js');
ok(sl!==null&&sl.includes("MP.pages['schedule-list']"),'schedule-list 页注册');
ok(sf!==null&&sf.includes("MP.pages['schedule-form']"),'schedule-form 页注册');
if(sl){ ['新增日程','saveSchedules','mp-switch','已启用','已停用','单次'].forEach(s=>ok(sl.includes(s),'schedule-list 含「'+s+'」')); }
if(sf){ ['执行时间','重复','动作','目标','type="time"','saveSchedules'].forEach(s=>ok(sf.includes(s),'schedule-form 含「'+s+'」')); }
['schedule-list','schedule-form'].forEach(p=>ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p));
ok(home!==null&&/label:'日程管理'[^}]*to:'schedule-list'/.test(home),'home 宫格「日程管理」已接通');

console.log('[11] 节能策略');
const stl=read('mp/pages/strategy-list.js'), stf=read('mp/pages/strategy-form.js');
ok(stl!==null&&stl.includes("MP.pages['strategy-list']"),'strategy-list 页注册');
ok(stf!==null&&stf.includes("MP.pages['strategy-form']"),'strategy-form 页注册');
if(stl){
  ['环境感知联动','风水联动','负荷调控','极致节能'].forEach(s=>ok(stl.includes(s),'strategy-list 含类型「'+s+'」'));
  ['新增策略','saveStrategies','mp-switch','已启用','已停用'].forEach(s=>ok(stl.includes(s),'strategy-list 含「'+s+'」'));
}
if(stf){
  ["type==='env'","type==='wind'","type==='load'","type==='ultimate'"].forEach(s=>ok(stf.includes(s),'strategy-form 含动态字段分支「'+s+'」'));
  /* R8：策略表单按 Web 端四类策略页重做，PARAM_DEF 步进器改为完整分区表单 */
  ['策略类型','任务名称','生效范围','如果满足条件','则执行如下动作','空调控制配置','saveStrategies']
    .forEach(s=>ok(stf.includes(s),'strategy-form 含「'+s+'」'));
}
['strategy-list','strategy-form'].forEach(p=>ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p));
ok(read('mp/mp.css').includes('tag-ultimate'),'mp.css 含 tag-ultimate 紫色变体');
ok(home!==null&&/label:'节能策略'[^}]*to:'strategy-list'/.test(home),'home 宫格「节能策略」已接通');

console.log('[12] 环境感知');
const env=read('mp/pages/env-list.js');
ok(env!==null&&env.includes("MP.pages['env-list']"),'env-list 页注册');
if(env){
  ['温湿度','人体存在','门窗'].forEach(s=>ok(env.includes(s),'env-list 含 tab「'+s+'」'));
  ['电量','离线','onPullRefresh'].forEach(s=>ok(env.includes(s),'env-list 含「'+s+'」'));
}
ok(shell.includes('src="mp/pages/env-list.js"'),'壳引用 env-list');
ok(home!==null&&/label:'环境感知'[^}]*to:'env-list'/.test(home),'home 宫格「环境感知」已接通');

console.log('[13] 设备管理');
const ar=read('mp/pages/ac-room.js'), arb=read('mp/pages/ac-room-bind.js'), ctl=read('mp/pages/controller.js');
ok(ar!==null&&ar.includes("MP.pages['ac-room']"),'ac-room 页注册');
ok(arb!==null&&arb.includes("MP.pages['ac-room-bind']"),'ac-room-bind 页注册');
ok(ctl!==null&&ctl.includes("MP.pages['controller']"),'controller 页注册');
if(ar){ ['绑定','解绑','acRoomBinds','MP.acRoom','roomOf'].forEach(s=>ok(ar.includes(s),'ac-room 含「'+s+'」')); }
if(arb){ ['选择目标房间','确认绑定','未绑定'].forEach(s=>ok(arb.includes(s),'ac-room-bind 含「'+s+'」')); }
if(ctl){ ['SN','在线','信号','固件','接控空调'].forEach(s=>ok(ctl.includes(s),'controller 含「'+s+'」')); }
['ac-room','ac-room-bind','controller'].forEach(p=>ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p));
ok(home!==null&&/label:'空调房间绑定'[^}]*to:'ac-room'/.test(home),'home 宫格「空调房间绑定」已接通');
ok(home!==null&&/label:'控制器'[^}]*to:'controller'/.test(home),'home 宫格「控制器」已接通（V2.0 新增）');

/* ── R7 房间绑定现场流重设计：楼栋/楼层/房间三级注册表 + 连续绑定流 ── */
if(data){
  /* 三级注册表：3 楼栋 / 6 楼层 / 9 房间，且已导出到 MP.data */
  ok(/const\s+buildings\s*=\s*\[/.test(data),'data.js 定义 buildings 三级注册表（R7）');
  ok(/MP\.data=\{[^}]*buildings:buildings/.test(data),'data.js 导出 MP.data.buildings（R7）');
  ok((data.match(/\{id:'bd\d+',name:'[^']+',floors:\[/g)||[]).length===3,'buildings 含 3 个楼栋（R7）');
  ok((data.match(/\{id:'f\d+',name:'[^']+',rooms:\[/g)||[]).length===6,'buildings 含 6 个楼层（R7）');
  ok((data.match(/\{id:'r\d+',name:'[^']+'\}/g)||[]).length===9,'buildings 含 9 个房间（R7）');
  /* 现状 6 个扁平房间名 = 楼层名+房间名拼接，逐一对应，已绑定设备零回归 */
  [['一楼','大堂'],['二楼','会议室A'],['二楼','会议室B'],['三楼','开放办公区'],['三楼','经理室'],['四楼','培训室']]
    .forEach(p=>ok(data.includes("'"+p[0]+p[1]+"'")&&data.includes("name:'"+p[1]+"'"),
      'buildings 房间「'+p[1]+'」拼接后与现有 rooms[] 项「'+p[0]+p[1]+'」对应（R7 零回归）'));
  /* 追加 2 台待绑定新机（room:'' 即未绑定，不进 acRoomBinds 种子） */
  ok(data.includes("id:'d19'")&&data.includes("id:'d20'"),'data.js 追加 d19/d20 两台待绑定设备（R7）');
  ok(/id:'d19',name:'空调-19号机',room:''/.test(data)&&/id:'d20',name:'空调-20号机',room:''/.test(data),
    'd19/d20 的 room 为空串（未绑定，无需 acRoomBinds 种子）（R7）');
  ok(data.includes("map(){ return MP.store.get('acRoomBinds')")===false,'acRoomBinds 种子不在 data.js（仍由 MP.acRoom 维护）');
  /* controller↔device 关联：三条 deviceIds 与 acCount 一一对应（c3 因新增 2 台由 3 改 5） */
  ok((data.match(/deviceIds:\[/g)||[]).length>=3,'controllers 三条均补 deviceIds（R7）');
  ok(data.includes("deviceIds:['d16','d17','d18','d19','d20']")&&/acCount:5,[^\n]*version:'V2\.1\.0'/.test(data),
    'c3 deviceIds 含新增 d19/d20 且 acCount 同步改为 5（R7）');
  /* 只在 controllers 常量块内统计（groups[] 同样有 deviceIds 字段，不能全文匹配） */
  const _ctlBlock=(data.match(/const controllers=\[[\s\S]*?\n  \];/)||[''])[0];
  ok((_ctlBlock.match(/'d\d+'/g)||[]).length===20,'三条 controller 的 deviceIds 合计覆盖 20 台设备（R7）');
}
if(ar){
  /* MP.acRoom 共用对象：既有 5 方法签名不回归 + R7 新增 2 只读方法 */
  ['map()','roomOf(d)','snOf(d)','rooms()','bind(ids,room)','unbind(id)']
    .forEach(s=>ok(ar.includes(s),'MP.acRoom 既有方法「'+s+'」签名未回归（R7）'));
  ok(ar.includes('buildings(){')&&ar.includes('return MP.data.buildings'),'MP.acRoom 新增 buildings() 注册表方法（R7）');
  ok(ar.includes('locate(roomName){')&&ar.includes('return {building:b,floor:f}')&&/return null;\s*\n\s*\},/.test(ar),
    'MP.acRoom 新增 locate() 反查方法（命中返回 {building,floor}，未命中返回 null）（R7）');
  ok(ar.includes('MP.acRoom.locate(g.room)')&&ar.includes('mp-ar-bd'),'ac-room 房间分组头挂楼栋小标注（R7）');
  ok(ar.includes('g.unbound?null:MP.acRoom.locate'),'ac-room「未绑定设备」分组不做楼栋反查（静默降级）（R7）');
  /* 折叠展开与解绑二次确认等既有逻辑不动 */
  ok(ar.includes('mp-ar-arrow')&&ar.includes('_collapsed'),'ac-room 折叠展开逻辑保留（R7 未动）');
  ok(ar.includes('MP.ui.confirm')&&ar.includes('MP.acRoom.unbind'),'ac-room 解绑二次确认保留（R7 未动）');
}
if(arb){
  /* 页面主体（剥离块注释）：注释里会提及 rooms() 作对比说明，不能全文匹配 */
  const _arbBody=arb.replace(/\/\*[\s\S]*?\*\//g,'');
  /* 两步状态机 + 三级下钻选点 */
  ok(_arbBody.includes("this._step='room'")&&_arbBody.includes("self._step='devices'"),
    'ac-room-bind 为 room/devices 两步状态机（R7）');
  ok(_arbBody.includes('MP.acRoom.buildings()')&&!_arbBody.includes('MP.acRoom.rooms()'),
    'ac-room-bind 选点数据源为 buildings() 全量注册表（非只列已绑的 rooms()）（R7）');
  ok(arb.includes('mp-arb-row')&&arb.includes('lv1')&&arb.includes('lv2')&&arb.includes('lv3'),
    'ac-room-bind 三级树行含 lv1/lv2/lv3 层级（R7）');
  ok(arb.includes('mp-ar-arrow')&&arb.includes('data-open'),'ac-room-bind 楼栋/楼层行复用折叠箭头交互（R7）');
  ok(arb.includes('已绑 ')&&arb.includes('_bound(full)'),'ac-room-bind 房间行显示「已绑 N 台」（R7）');
  /* 面包屑 + 更换房间 + 完成出口 */
  ok(arb.includes('mp-arb-path')&&arb.includes('›'),'ac-room-bind 顶部房间面包屑路径条（R7）');
  ok(arb.includes('btnChg')&&arb.includes('更换房间'),'ac-room-bind 含「更换房间」回选点入口（R7）');
  ok(arb.includes('btnDone')&&arb.includes('完成')&&arb.includes('MP.back()'),'ac-room-bind 含「完成」退出流程出口（R7）');
  /* SN 尾号搜索 + 按控制器分组（复用既有 class，不另起一套） */
  ok(arb.includes('mp-dev-search')&&arb.includes('snKw')&&arb.includes('SN 尾号搜索'),
    'ac-room-bind SN 尾号搜索框复用 .mp-dev-search（R7）');
  ok(arb.includes('MP.acRoom.snOf(d).toLowerCase().indexOf(kw)'),'ac-room-bind 搜索按 SN 子串匹配（R7）');
  ok(arb.includes('mp-seg')&&arb.includes('mp-seg-i')&&arb.includes('按控制器分组'),
    'ac-room-bind 分组切换复用 .mp-seg/.mp-seg-i 胶囊（R7）');
  ok(arb.includes('deviceIds||[]).indexOf(d.id)')&&arb.includes('未分组'),
    'ac-room-bind 按 controllers[].deviceIds 反查分组，无归属归「未分组」（R7）');
  ok(arb.includes('if(ds.length)blocks.push'),'ac-room-bind 空控制器分组不渲染（R7）');
  /* 多选惯例 + 底部摘要条 + 连续绑定（绑定后不 back） */
  ok(arb.includes('mp-sch-tgt')&&arb.includes('mp-check'),'ac-room-bind 设备行沿用 .mp-sch-tgt+.mp-check 多选（R7）');
  ok(arb.includes('mp-footer')&&arb.includes('mp-arb-foot')&&arb.includes('已选 ')&&arb.includes(' 台 → '),
    'ac-room-bind 底部摘要条「已选 N 台 → 房间名」（R7）');
  ok(arb.includes("classList.toggle('dim',n===0)"),'ac-room-bind 未选时按钮置灰仍可点（点击给 toast）（R7）');
  ok(arb.includes('请至少勾选 1 台空调'),'ac-room-bind 0 台校验 toast（R7）');
  ok(/MP\.acRoom\.bind\(Array\.from\(this\._sel\),this\._room\)/.test(arb),'ac-room-bind 调用 MP.acRoom.bind 持久化（R7）');
  ok(/this\._sel\.clear\(\);\s*\n\s*MP\.ui\.toast\('已绑定 '\+n\+' 台到/.test(arb),
    'ac-room-bind 绑定后清空勾选并 toast「已绑定 N 台到…」（R7）');
  /* I-1 修复：勾选跨搜索保留，但「筛选外已选」必须显性化 + 确认闸门，杜绝绑走屏幕外设备 */
  ok(arb.includes('_selOut()')&&arb.includes('this._sel.size-vis'),'ac-room-bind 计算筛选外已选台数 _selOut（I-1）');
  ok(arb.includes('台不在当前筛选内'),'ac-room-bind 摘要条显性标出筛选外已选台数（I-1）');
  ok(/if\(out\)\{[\s\S]{0,400}MP\.ui\.confirm\(\{title:'确认绑定'/.test(arb),
    'ac-room-bind 存在筛选外勾选时强制二次确认（I-1 硬闸门）');
  ok(arb.includes('btnClr')&&arb.includes('一键清空'),'ac-room-bind 提供一键清空勾选出口（I-1）');
  ok(!/oninput=e=>\{[^}]*_sel\.clear/.test(arb),'ac-room-bind 搜索 oninput 不清空勾选（保留搜一台勾一台动线）（I-1）');
  ok(!/MP\.acRoom\.bind\([\s\S]{0,200}MP\.back\(\)/.test(arb),'ac-room-bind 确认绑定后不退出、停留本页继续绑（R7）');
  /* 现场手输新建房间已取消（房间结构统一由 Web 端维护），仅允许出现在 note 删减说明里 */
  ok(!arb.replace(/note:\[[\s\S]*?\]/,'').includes('新建房间'),'ac-room-bind 页面主体无现场新建房间输入（R7 删减）');
  ok(!arb.includes('newRoom'),'ac-room-bind 无 newRoom 输入框残留（R7 删减）');
}
if(css2){
  ok(css2.includes('.mp-ar-bd{'),'mp.css 含 ac-room 楼栋小标注样式（R7）');
  ok(css2.includes('.mp-arb-row{')&&css2.includes('.mp-arb-row.lv2{')&&css2.includes('.mp-arb-row.lv3{'),
    'mp.css 含三级树层级缩进样式（R7）');
  ok(css2.includes('.mp-arb-path{')&&css2.includes('.mp-arb-chg{'),'mp.css 含房间路径条与更换房间钮样式（R7）');
  ok(css2.includes('.mp-arb-seg{')&&css2.includes('.mp-arb-gh{'),'mp.css 含分组切换外边距与控制器分组小标题样式（R7）');
  ok(css2.includes('.mp-arb-foot .sum{')&&css2.includes('.mp-btn.dim{'),'mp.css 含底部摘要条与置灰可点按钮样式（R7）');
  ok(css2.includes('.mp-arb-foot .sum .out{')&&css2.includes('.mp-arb-foot .sum .clr{'),
    'mp.css 含筛选外已选警示色与清空钮样式（I-1）');
}
/* I-2：d19/d20 的 room 为空串，group-form 房间分组需过滤空 room，否则渲染出无标题空分组头 */
const gf7=read('mp/pages/group-form.js');
if(gf7){
  ok(/forEach\(d=>\{ if\(d\.room&&order\.indexOf\(d\.room\)<0\)/.test(gf7),
    'group-form._rooms 过滤空串 room，不渲染无标题空分组（I-2）');
}

console.log('[14] 电费查询');
const ea=read('mp/pages/elec-admin.js'), etl=read('mp/pages/elec-tenant-list.js'), etd=read('mp/pages/elec-tenant-detail.js');
ok(ea!==null&&ea.includes("MP.pages['elec-admin']"),'elec-admin 页注册');
ok(etl!==null&&etl.includes("MP.pages['elec-tenant-list']"),'elec-tenant-list 页注册');
ok(etd!==null&&etd.includes("MP.pages['elec-tenant-detail']"),'elec-tenant-detail 页注册');
if(ea){ ['账单','已缴','欠费'].forEach(s=>ok(ea.includes(s),'elec-admin 含「'+s+'」')); }
if(etl){ ['搜索','异常','正常'].forEach(s=>ok(etl.includes(s),'elec-tenant-list 含「'+s+'」')); }
if(etd){ ['消费','充值','余额'].forEach(s=>ok(etd.includes(s),'elec-tenant-detail 含「'+s+'」')); }
['elec-admin','elec-tenant-list','elec-tenant-detail'].forEach(p=>ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p));
ok(home!==null&&/label:'电费查询'[^}]*to:'elec-admin'/.test(home),'home 宫格「电费查询」已接通');
ok(read('mp/pages/elec-tenant.js')===null,'mp/pages/elec-tenant.js 已删除（R6）');
ok(read('mp/pages/elec-recharge.js')===null,'mp/pages/elec-recharge.js 已删除（R6）');
/* 全站精确匹配扫描旧 key：elec-tenant / elec-recharge 均带引号定界精确匹配，避免误伤自身前缀子串
   的 elec-tenant-list / elec-tenant-detail（陷阱：!f.includes('elec-tenant') 会对新页面自身文件名假阳性） */
const OLD_KEY_RE=/['"]elec-tenant['"]|['"]elec-recharge['"]/;
const pagesDir=path.join(ROOT,'mp/pages');
const SCAN_ELEC=['hvac-demo-mp.html','mp/data.js','mp/mp.css'].concat(fs.readdirSync(pagesDir).map(f=>'mp/pages/'+f));
SCAN_ELEC.forEach(f=>{ const c=read(f); if(c===null)return;
  ok(!OLD_KEY_RE.test(c),f+' 无旧 elec-tenant/elec-recharge 精确引用（R6）'); });

console.log('[15] 全量收口');
const PAGES=['login','login-bind','home','device','device-detail','group-list','group-detail','group-form','schedule-list','schedule-form','strategy-list','strategy-form','env-list','ac-room','ac-room-bind','controller','elec-admin','elec-tenant-list','elec-tenant-detail','me','me-profile','login-settings','about'];
ok(PAGES.length===23,'页面清单共 23 页（V2.0 删除 func；R6 起 elec-tenant/elec-recharge 改造为 elec-tenant-list/elec-tenant-detail）');
PAGES.forEach(p=>{
  const f=read('mp/pages/'+p+'.js');
  ok(f!==null,'页面 '+p+' 文件存在');
  if(f){
    /* 真实注册语法：MP.pages['xxx']= 或 MP.pages.<camelName>=（不认文件头注释） */
    const camel=p.replace(/-(\w)/g,(m,c)=>c.toUpperCase());
    ok(f.includes("MP.pages['"+p+"']=")||f.includes('MP.pages.'+camel+'='),'页面 '+p+' 真实注册');
    ok(f.includes('note:['),'页面 '+p+' 含改造说明 note');
  }
  ok(shell.includes('src="mp/pages/'+p+'.js"'),'壳引用 '+p);
});
/* 禁词：仅允许出现在 note/删减说明上下文，页面主体（去掉 note 数组后）不得出现 */
['故障预警','系统管理','智慧运维'].forEach(s=>{
  PAGES.forEach(p=>{ const f=read('mp/pages/'+p+'.js'); if(!f)return;
    const noNote=f.replace(/note:\[[\s\S]*?\]/,'');
    ok(!noNote.includes(s),'页面 '+p+' 主体无「'+s+'」入口'); });
});
/* 旧品牌名残留 */
PAGES.concat(['data']).forEach(p=>{ const f=read(p==='data'?'mp/data.js':'mp/pages/'+p+'.js'); if(!f)return;
  ok(!f.includes('空调集中管理系统'),(p==='data'?'data.js':'页面 '+p)+' 无「空调集中管理系统」残留'); });
const navHtml=read('hvac-demo.html');
ok(navHtml!==null&&!navHtml.includes('hvac-demo-mp.html'),'Web 导航已移除小程序原型入口');

console.log('[16] V2.0 去角色化与 3 Tab 收口');
ok(shell.includes("MP.TABS=['home','device','me']"),'壳 MP.TABS 为 home/device/me 三项');
ok(!shell.includes("'func'")&&!shell.includes('pages/func.js'),'壳无 func 引用（script/TABS/defs）');
ok(read('mp/pages/func.js')===null,'mp/pages/func.js 文件已删除');
/* 全站（壳 + mp/ 全部 js/css）无 func 路由残留 */
const SCAN=['hvac-demo-mp.html','mp/data.js','mp/mp.css'].concat(PAGES.map(p=>'mp/pages/'+p+'.js'));
SCAN.forEach(f=>{ const c=read(f); if(c===null)return;
  ok(!/switchTab\('func'\)|MP\.go\('func'\)|MP\.pages\.func|pages\/func\.js/.test(c),f+' 无 func 残留引用'); });
/* wxBoundRole 键已随去角色化删除，全站无残留 */
SCAN.forEach(f=>{ const c=read(f); if(c===null)return;
  ok(!c.includes('wxBoundRole'),f+' 无 wxBoundRole 残留'); });

console.log('[17] SVG 图标体系与 emoji 清零（R2）');
const icons=read('mp/icons.js');
ok(icons!==null,'mp/icons.js 存在');
ok(icons!==null&&icons.includes('MP.icon='),'icons.js 定义 MP.icon');
ok(shell.includes('src="mp/icons.js"'),'壳引用 icons.js');
/* 加载顺序：data.js → icons.js → 各 pages（pages 渲染时调用 MP.icon） */
const _iData=shell.indexOf('src="mp/data.js"'), _iIcons=shell.indexOf('src="mp/icons.js"'),
      _iPages=shell.indexOf('src="mp/pages/');
ok(_iData>-1&&_iIcons>_iData&&_iPages>_iIcons,'icons.js 加载顺序在 data.js 之后、pages 之前');
/* 图标清单齐备（R2 规范：导航 3 + 功能 8 + 控制 5 + 状态 5 + 补充 5 = 26） */
const ICONS=['home','device','me','group','schedule','strategy','env','bind','controller','elec','more',
  'power','snow','sun','fan','drop','lock','alert','check','arrow','back','search','info','chat','bill','wallet'];
if(icons){
  ok(ICONS.length===26,'图标清单共 26 个');
  ICONS.forEach(n=>ok(new RegExp('\\b'+n+":'").test(icons),'图标 '+n+' 已定义'));
  ok(icons.includes('viewBox="0 0 24 24"'),'图标统一 24×24 viewBox');
  ok(icons.includes('stroke-width="')&&icons.includes('stroke-linecap="round"')&&icons.includes('stroke-linejoin="round"'),'图标统一描边/圆角端点规范');
}
/* 全站（壳 + mp/ 全部 js/css）emoji 清零：仅扫描 emoji 区段（1F000-1FAFF / 2600-26FF / 2700-27BF / 2B00-2BFF / 2139 ℹ / 24D8 ⓘ / FE0F），
   °C ‹ › ⌄ → ● ○ ① ② 等排版字符不在区段内；✓(2713) ★(2605) 为白名单先行剥离 */
const EMOJI_RE=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{2139}\u{24D8}\u{FE0F}]/gu;
const SCAN2=['hvac-demo-mp.html','mp/data.js','mp/icons.js','mp/mp.css'].concat(PAGES.map(p=>'mp/pages/'+p+'.js'));
SCAN2.forEach(f=>{ const c=read(f); if(c===null)return;
  const m=c.replace(/[✓★]/g,'').match(EMOJI_RE);
  ok(!m,f+' 无 emoji'+(m?'（残留 '+m.slice(0,5).join(' ')+'）':'')); });
/* R2 视觉令牌落地 */
const cssR2=read('mp/mp.css');
if(cssR2){
  ok(cssR2.includes('.mp-ic{'),'mp.css 含 .mp-ic 图标基类');
  ok(cssR2.includes('--mp-shadow:0 8px 24px rgba(28,49,81,.06)'),'mp.css 卡片柔和扩散阴影令牌（R8 对齐 gwdbg）');
  ok(cssR2.includes('--mp-btn-grad:#2457D6'),'mp.css 主按钮改实心主色（R8 对齐 gwdbg，立体感由主色投影承担）');
  ok(cssR2.includes('.mp-num{'),'mp.css 含 .mp-num 大数字工具类');
  ok(cssR2.includes('backdrop-filter:blur(10px)'),'mp.css 导航栏毛玻璃');
  ok(!cssR2.includes('mp-demo-card')&&!cssR2.includes('mp-demo-t'),'mp.css 无 mp-demo-* 残留');
  ok(!cssR2.includes('mp-me-avatar.tenant'),'mp.css 无 tenant 头像残留');
}
/* 关键调用点：TabBar / 首页宫格 / 设备电源钮 / 详情模式图标 均走 MP.icon */
ok(shell.includes('MP.icon(d[2])'),'壳 TabBar 使用 MP.icon');
if(home)ok(home.includes("MP.icon(g.icon)")&&home.includes("gi-'+g.tint"),'home 宫格使用 MP.icon + 底色板');
if(dev)ok(dev.includes("MP.icon('power'"),'device 电源钮使用 MP.icon');
if(dd)ok(dd.includes('MP.icon(this.MODE_ICON[k])'),'device-detail 模式图标使用 MP.icon');

if(fail){console.error('\n共 '+fail+' 项未通过');process.exit(1)}
console.log('\n全部通过');
