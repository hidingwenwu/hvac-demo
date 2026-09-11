/* 空调集控管家 · 模拟数据 + 全局状态（localStorage 持久化，仅前端演示） */
window.MP = window.MP || {};
(function(){
  /* ── 持久化 ── */
  function persist(key){ return {
    get(k){ const o=JSON.parse(localStorage.getItem(key)||'{}'); return k?o[k]:o; },
    set(k,v){ const o=JSON.parse(localStorage.getItem(key)||'{}'); o[k]=v; localStorage.setItem(key,JSON.stringify(o)); }
  };}
  MP.state = persist('mp_state');   // 登录态/角色/当前项目
  MP.store = persist('mp_store');   // 业务数据增删改覆盖层

  /* ── 项目：1 预付费(开自助充值) + 1 后付费 ── */
  const projects=[
    {id:'p1',name:'蓝海商业广场',feeMode:'prepaid', selfRecharge:true, banner:null},
    {id:'p2',name:'云谷办公中心',feeMode:'postpaid',selfRecharge:false,banner:null},
  ];

  /* ── 空调设备 18 台：确定性生成，覆盖 在线/离线/故障 × 开关 × 模式 × 锁定 ── */
  const rooms=['一楼大堂','二楼会议室A','二楼会议室B','三楼开放办公区','三楼经理室','四楼培训室'];
  const modes=['cool','heat','fan','dry'], winds=['auto','low','mid','high'];
  const devices=[];
  for(let i=0;i<18;i++){
    const online=i%6!==4, fault=i===7||i===15;   // 每6台1台离线；2台故障
    devices.push({
      id:'d'+(i+1), name:'空调-'+(i+1)+'号机', room:rooms[i%rooms.length],
      online, fault:online&&fault,
      power:online&&i%3!==2, mode:modes[i%4], temp:22+(i%6), roomTemp:24+(i%5),
      wind:winds[i%4],
      /* 锁定模型：tempHi/tempLo=温度范围限定；mode=模式锁定；power=开关全锁；
         noOn/noOff=禁止启动/禁止关闭；heatFix/coolFix=制热/制冷固定（R5 限定设置页签下发）
         d6(i===5) 叠加 noOn:true 演示「模式锁定+禁止启动」组合下发 */
      lock:{tempHi:i===2?28:null,tempLo:i===2?20:null,mode:i===5,power:i===10,
            noOn:i===5,noOff:false,heatFix:false,coolFix:false},
    });
  }
  /* R7：追加 2 台待绑定新机（room:'' 即未绑定，无需再进 MP.acRoom 默认种子），
     供「楼栋/楼层/房间三级下钻 + 现场连续绑定流」演示从空房间开始绑起 */
  devices.push(
    {id:'d19',name:'空调-19号机',room:'', online:true, fault:false,
     power:false, mode:'cool', temp:24, roomTemp:26, wind:'auto',
     lock:{tempHi:null,tempLo:null,mode:false,power:false,noOn:false,noOff:false,heatFix:false,coolFix:false}},
    {id:'d20',name:'空调-20号机',room:'', online:true, fault:false,
     power:false, mode:'cool', temp:24, roomTemp:26, wind:'auto',
     lock:{tempHi:null,tempLo:null,mode:false,power:false,noOn:false,noOff:false,heatFix:false,coolFix:false}},
  );

  /* ── 楼栋/楼层/房间三级结构（R7：房间绑定现场流用的选点注册表，与 device.room 扁平字符串并存——
     楼栋 1号楼下的 4 个楼层 6 个房间是现状 rooms[] 的原样结构化，room 显示名（楼层名+房间名拼接，
     如 "一楼大堂"）与现有 device.room 字符串逐一对应，保证已绑定设备零回归；
     2号楼/3号楼是新增的空房间（现场新交付场景，尚无设备绑定），供连续绑定流演示「从空房间开始绑起」。
     显示名拼接规则=楼层名+房间名，不含楼栋名（因绑定存储层 MP.acRoom 仍是扁平字符串 key，
     见 roomOf/bind 契约），故全楼盘范围内房间显示名必须互不重复——本注册表已保证唯一 ── */
  const buildings=[
    {id:'bd1',name:'1号楼',floors:[
      {id:'f1',name:'一楼',rooms:[{id:'r1',name:'大堂'}]},
      {id:'f2',name:'二楼',rooms:[{id:'r2',name:'会议室A'},{id:'r3',name:'会议室B'}]},
      {id:'f3',name:'三楼',rooms:[{id:'r4',name:'开放办公区'},{id:'r5',name:'经理室'}]},
      {id:'f4',name:'四楼',rooms:[{id:'r6',name:'培训室'}]},
    ]},
    {id:'bd2',name:'2号楼',floors:[
      {id:'f5',name:'一楼',rooms:[{id:'r7',name:'前台'},{id:'r8',name:'配电室'}]},
    ]},
    {id:'bd3',name:'3号楼',floors:[
      {id:'f6',name:'一楼',rooms:[{id:'r9',name:'门卫室'}]},
    ]},
  ];

  /* ── 群组 / 日程 / 策略 / 环境感知 / 控制器 / 电费 ── */
  const groups=[
    {id:'g1',name:'二楼会议区',deviceIds:['d2','d3']},
    {id:'g2',name:'三楼办公区',deviceIds:['d4','d5','d6','d7']},
    {id:'g3',name:'公共区',    deviceIds:['d1','d16','d17']},
  ];
  const schedules=[
    {id:'s1',name:'工作日早开机', time:'08:30',days:[1,2,3,4,5],action:{power:true, mode:'cool',temp:26},targetType:'group', targetName:'三楼办公区',enabled:true},
    {id:'s2',name:'工作日晚关机', time:'18:00',days:[1,2,3,4,5],action:{power:false},              targetType:'group', targetName:'三楼办公区',enabled:true},
    {id:'s3',name:'周六半天运行', time:'09:00',days:[6],          action:{power:true, mode:'cool',temp:27},targetType:'device',targetName:'一楼大堂区域',enabled:false},
  ];
  /* ── R8：节能策略参照 Web 端四页（strategy-env/wind/load/ultimate）补全的枚举与库数据 ──
     取舍说明：字段结构、控件形态、枚举取值逐项照搬 Web 端；但房间/楼层的**具体数据**沿用本原型
     自己的 buildings 三级注册表（不搬 Web 演示环境的「博研楼/801会议室」等），保证原型内部自洽 */

  /* 法定节假日库（供「一键排除节假日」与排除日期 chip 名称，照搬 Web 端 env/ultimate 两页同一份） */
  const holidays=[
    {name:'端午节',dates:['2026-06-19','2026-06-20','2026-06-21']},
    {name:'中秋节',dates:['2026-09-25','2026-09-26','2026-09-27']},
    {name:'国庆节',dates:['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07']},
    {name:'元旦',  dates:['2027-01-01','2027-01-02','2027-01-03']},
  ];

  /* 风水联动策略库（Web 端「策略管理」弹窗维护的策略模板：设备类型 + 运行模式 + 温度设定 + 风速 + 联动水阀）
     风水联动的任务表单只做「时间 + 房间范围 + 引用哪条策略」的绑定，这是它与其余三类最大的结构差异 */
  const windLib=[
    {id:'wl1',name:'夏季制冷节能策略',  devType:'水机',  mode:'制冷',temp:'26℃',wind:'自动',valve:'随风盘启停'},
    {id:'wl2',name:'办公时段舒适策略',  devType:'水机',  mode:'制冷',temp:'25℃',wind:'中速',valve:'随风盘启停'},
    {id:'wl3',name:'夜间值班低负荷策略',devType:'水机',  mode:'制冷',temp:'28℃',wind:'低速',valve:'常闭'},
    {id:'wl4',name:'大厅恒温策略',      devType:'温控器',mode:'制冷',temp:'26℃',wind:'自动',valve:'常开'},
    {id:'wl5',name:'会议室预冷策略',    devType:'氟机',  mode:'制冷',temp:'24℃',wind:'高速',valve:'随风盘启停'},
    {id:'wl6',name:'过渡季送风策略',    devType:'直膨机',mode:'送风',temp:'26℃',wind:'低速',valve:'常闭'},
    {id:'wl7',name:'梅雨季除湿策略',    devType:'水机',  mode:'除湿',temp:'27℃',wind:'低速',valve:'随风盘启停'},
  ];

  /* 策略表单枚举字典（逐项照搬 Web 端下拉选项，含「不设置/不控制/不锁定」这类空值语义项） */
  const stgEnum={
    acType:['水机','氟机','直膨机','温控器'],                 /* 空调类型（负荷调控）/ 设备类型（风水联动） */
    loadStrategy:['温度上调策略','风速限制策略','分组轮停策略','锁定设定温度策略'],
    loadSource:['手动创建','需求响应'],
    cycle:[['day','按天'],['hour','按小时']],                  /* 执行周期（风水联动） */
    condKind:[['human','人在状态'],['door','门窗状态'],['temp','温度'],['humi','湿度']],
    humanState:['有人','无人'],
    doorState:['开启','关闭'],
    compare:[['gt','高于 >'],['lt','低于 <'],['ge','升高到 ≥'],['le','降低到 ≤']],
    actKind:[['ac','空调控制'],['lock','锁定控制'],['delay','延时']],
    acPower:['开关不控制','开机','关机'],
    acMode:['模式不控制','制冷','制热','送风','除湿'],
    acWind:['风速不控制','高','中','低'],
    lockPower:['开关机不锁定','禁止关机','禁止启动'],
    lockMode:['制冷','制热','送风','除湿'],
    lockTemp:['温度不锁定','锁定温度范围'],
    /* 极致节能「空调控制配置」四项，空值项文案为「不设置」（与环境感知的「不控制」不同，照搬原文） */
    setPower:['不设置','开机','关机'],
    setMode:['不设置','制冷','制热','送风','除湿'],
    setWind:['不设置','低','中','高'],
    weekTxt:['周一','周二','周三','周四','周五','周六','周日'],
  };

  /* 策略种子数据（R8 改造为完整结构，四类各一条，覆盖四种表单形态） */
  const strategies=[
    {id:'st1',type:'env',name:'会议室人走关机',enabled:true,
      memo:'会议室无人后延时关闭空调，避免空转',
      dateStart:'2026-07-01',dateEnd:'2026-12-31',timeStart:'08:00',timeEnd:'20:00',
      weekdays:[1,2,3,4,5],excludeDates:['2026-10-01'],
      conds:[{kind:'human',state:'无人'}],holdOn:true,holdMin:10,
      actions:[{kind:'ac',power:'关机',mode:'模式不控制',temp:null,wind:'风速不控制'}],
      rooms:['二楼会议室A','二楼会议室B'],
      desc:'检测到无人并持续满足 10 分钟时，将空调关机。',targetName:'二楼会议室A 等 2 个房间'},
    {id:'st2',type:'wind',name:'大厅风盘恒温',enabled:true,
      memo:'',dateStart:'2026-07-01',dateEnd:'2026-09-30',cycle:'day',libId:'wl4',
      rangeFloor:'1号楼 一楼',
      desc:'按「大厅恒温策略」下发：制冷 26℃ 自动风，水阀常开。',targetName:'1号楼 一楼'},
    {id:'st3',type:'load',name:'午间高峰负荷调控',enabled:false,
      acType:'水机',dtStart:'2026-07-01T11:30',dtEnd:'2026-07-01T13:30',
      targetKw:'320',targetPct:'15',loadStrategy:'分组轮停策略',source:'需求响应',
      rangeFloors:['1号楼 三楼','1号楼 四楼'],
      desc:'目标负荷 320kW（幅度 15%），执行分组轮停策略。',targetName:'1号楼 三楼 等 2 个区域'},
    {id:'st4',type:'ultimate',name:'办公区定时下发',enabled:false,
      memo:'防止人为随意改动设定温度',
      dateStart:'2026-07-01',dateEnd:'2026-12-31',timeStart:'08:00',timeEnd:'18:00',
      weekdays:[1,2,3,4,5],excludeDates:[],
      interval:30,acPower:'开机',acMode:'制冷',acTemp:26,acWind:'中',
      rooms:['三楼开放办公区','四楼培训室'],
      desc:'每 30 分钟下发一次控制指令，将空调设置为 开机 制冷 26℃ 中风。',targetName:'三楼开放办公区 等 2 个房间'},
  ];
  const envSensors=[
    {id:'e1',type:'th',   name:'温湿度-大堂',   room:'一楼大堂',online:true, temp:26.5,humidity:58,battery:86},
    {id:'e2',type:'th',   name:'温湿度-办公区', room:'三楼开放办公区',online:true, temp:27.1,humidity:61,battery:72},
    {id:'e3',type:'human',name:'人体-会议室A',  room:'二楼会议室A',online:true, state:'无人',battery:91},
    {id:'e4',type:'human',name:'人体-经理室',   room:'三楼经理室',online:false,state:'--',battery:12},
    {id:'e5',type:'door', name:'门窗-会议室B',  room:'二楼会议室B',online:true, state:'关闭',battery:78},
    {id:'e6',type:'door', name:'门窗-大堂侧门', room:'一楼大堂',online:true, state:'开启',battery:65},
  ];
  /* deviceIds（R7 新增）：controller↔device 真实关联，供 ac-room-bind「按控制器分组」筛选；
     与 acCount 数值一一对应（c3 因新增 d19/d20 两台待绑定机，acCount 由 3 改为 5，
     controller.js 直接读 c.acCount 展示，页面本身无需改动） */
  const controllers=[
    {id:'c1',sn:'FY-CTL-20260101',name:'控制器-1号楼',online:true, brand:'海尔',acCount:8, version:'V2.3.1',signal:'强',
     deviceIds:['d1','d2','d3','d4','d5','d6','d7','d8']},
    {id:'c2',sn:'FY-CTL-20260102',name:'控制器-2号楼',online:true, brand:'格力',acCount:7, version:'V2.3.1',signal:'中',
     deviceIds:['d9','d10','d11','d12','d13','d14','d15']},
    {id:'c3',sn:'FY-CTL-20260315',name:'控制器-3号楼',online:false,brand:'美的',acCount:5, version:'V2.1.0',signal:'--',
     deviceIds:['d16','d17','d18','d19','d20']},
  ];
  const bills=[
    {id:'b1',month:'2026-08',tenant:'101 商铺',tenantId:'t1',usage:1286,amount:1157.40,status:'已缴'},
    {id:'b2',month:'2026-08',tenant:'202 办公',tenantId:'t2',usage: 942,amount: 847.80,status:'欠费'},
    {id:'b3',month:'2026-07',tenant:'101 商铺',tenantId:'t1',usage:1102,amount: 991.80,status:'已缴'},
    {id:'b4',month:'2026-08',tenant:'301 办公',tenantId:'t3',usage:1560,amount:1404.00,status:'欠费'},
    {id:'b5',month:'2026-07',tenant:'301 办公',tenantId:'t3',usage:1480,amount:1332.00,status:'已缴'},
  ];
  /* ── 租户台账（R6：单一 tenant 对象改造为 tenants 数组，管理员视角查看多租户） ──
     prepaid 租户：balance/remind/records（消费/充值流水，_project.feeMode 为 prepaid 时使用）
     postpaid 租户：不带 balance/records，账单走 bills[].tenantId 关联查询 */
  const tenants=[
    {id:'t1',name:'101 商铺',room:'1栋101',projectId:'p1',feeMode:'prepaid',
     balance:236.50,remind:100,
     records:[
       {type:'consume', desc:'8月电费扣款',time:'2026-08-05 09:00',amount:-320.00},
       {type:'recharge',desc:'微信充值',    time:'2026-08-01 10:20',amount:500.00},
       {type:'consume', desc:'7月电费扣款',time:'2026-07-05 09:00',amount:-298.50},
     ]},
    {id:'t2',name:'202 办公',room:'2栋202',projectId:'p1',feeMode:'prepaid',
     balance:42.00,remind:100,
     records:[
       {type:'consume', desc:'8月电费扣款',time:'2026-08-05 09:00',amount:-847.80},
       {type:'recharge',desc:'微信充值',    time:'2026-07-28 14:05',amount:300.00},
     ]},
    {id:'t3',name:'301 办公',room:'3栋301',projectId:'p2',feeMode:'postpaid'},
  ];

  MP.data={projects:projects,devices:devices,buildings:buildings,groups:groups,schedules:schedules,strategies:strategies,envSensors:envSensors,controllers:controllers,bills:bills,tenants:tenants,
    holidays:holidays,windLib:windLib,stgEnum:stgEnum};

  /* ── 业务数据读取统一走 store 覆盖层（增删改持久化） ── */
  MP.q={
    schedules(){ const o=MP.store.get('schedules'); return o||schedules.slice(); },
    saveSchedules(list){ MP.store.set('schedules',list); },
    strategies(){ const o=MP.store.get('strategies'); return o||strategies.slice(); },
    saveStrategies(list){ MP.store.set('strategies',list); },
    groups(){ const o=MP.store.get('groups'); return o||groups.slice(); },
    saveGroups(list){ MP.store.set('groups',list); },
    /* R6：租户台账均为只读查询（管理员查看视角，无 store 覆盖层） */
    tenants(projectId){ return MP.data.tenants.filter(t=>t.projectId===projectId); },
    tenant(id){ return MP.data.tenants.find(t=>t.id===id); },
    tenantBills(id){ return MP.data.bills.filter(b=>b.tenantId===id).slice().sort((a,b)=>a.month<b.month?1:a.month>b.month?-1:0); },
  };
})();
