/* 首页（MP.pages.home）：移动端专属首页，Web 端无对应页
   V2.0 R3：对齐现行小程序首页结构 —— banner 条（项目切换）→ 快捷功能卡 → 室内机设备状态卡（SVG 环形在线率）
   → 锁定状态卡 → 日程/群组概览卡 → 全部功能宫格；支持下拉刷新（touch 下拉 >60px 松手触发）
   数据全部实时计算：设备统计/锁定统计/平均温度取自 MP.data.devices，日程/群组数取自 MP.q
   （R3 移除：近 7 日能耗柱状图与今日能耗演示值——能耗明细属 Web 端能力；环境摘要条——平均室温已并入状态卡 chips） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages.home={
  title:'空调集控管家',tab:true,
  note:[
    {type:'新增',text:'对齐现行小程序首页：顶部快捷功能卡（空调控制/定时任务/群组管理）+ 环形在线率设备状态卡 + 锁定状态卡 + 日程/群组概览卡'},
    {type:'新增',text:'室内机设备状态卡：SVG 环形进度（在线率）+ 运行/关机/故障/离线四格（点击直达设备页并预设筛选）+ 平均设定/室内温度，全部按 MP.data.devices 实时计算'},
    {type:'新增',text:'锁定状态卡：模式/温度/开关锁定数量按设备 lock 字段实时统计'},
    {type:'删减',text:'移除近 7 日能耗柱状图与今日能耗演示值：能耗明细属 Web 端能力，移动端首页聚焦状态总览（现行小程序首页无此区块）'},
    {type:'删减',text:'移除环境摘要条：平均室温已并入设备状态卡底部 chips'},
    {type:'优化',text:'全部功能宫格 8 项色板收敛为 8 个色相区分色（原深蓝底块与主蓝重复），banner 条保留项目切换'},
  ],

  /* 快捷功能卡：3 张横排（彩色圆角底块 + 白色图标 + 名称），对齐现行小程序首页顶部
     act: 'tab' → MP.switchTab(to)；'go' → MP.go(to)；cls: 色块类（mp.css .qk-b/o/g） */
  QUICK:[
    {icon:'device',  cls:'b',label:'空调控制',act:'tab',to:'device'},
    {icon:'schedule',cls:'o',label:'定时任务',act:'go', to:'schedule-list'},
    {icon:'group',   cls:'g',label:'群组管理',act:'go', to:'group-list'},
  ],

  /* 全部功能宫格 8 项（V2.0：func 宫格页删除，入口收进本表；电费查询固定管理员账单）
     tint: 宫格底色板（mp.css .gi-b/c/g/o/p/y/d/s，R3 收敛为 8 个色相区分色）；sub: 副标题 */
  GRID:[
    {icon:'device',    tint:'b',label:'空调控制',    act:'tab',to:'device'},
    {icon:'group',     tint:'c',label:'群组管理',    act:'go', to:'group-list'},
    {icon:'schedule',  tint:'o',label:'日程管理',    act:'go', to:'schedule-list'},
    {icon:'strategy',  tint:'g',label:'节能策略',    act:'go', to:'strategy-list'},
    {icon:'env',       tint:'p',label:'环境感知',    act:'go', to:'env-list'},
    {icon:'elec',      tint:'y',label:'电费查询',    act:'go', to:'elec-admin',sub:'账单查询'},
    {icon:'bind',      tint:'d',label:'空调房间绑定', act:'go', to:'ac-room'},
    {icon:'controller',tint:'s',label:'控制器',      act:'go', to:'controller'},
  ],

  /* 设备状态四格 → device 页状态筛选 chips 映射（与 device.js _match 语义一一对应）：
     点击经 MP.state.devFilter 预设筛选后 switchTab 进设备页，device.js 读取后一次性消费 */
  DEV4:[
    {f:'on',     label:'运行', cls:'pri'},
    {f:'off',    label:'关机', cls:'mut'},
    {f:'fault',  label:'故障', cls:'er'},
    {f:'offline',label:'离线', cls:'dk'},
  ],
  RING_R:54,   /* 环形图半径（stroke-width 10，viewBox 128×128） */

  /* 当前项目：state 为空时默认 p1 并写入 */
  _curProject(){
    let pid=MP.state.get('projectId');
    if(!pid){ pid='p1'; MP.state.set('projectId','p1'); }
    return MP.data.projects.find(p=>p.id===pid)||MP.data.projects[0];
  },

  /* SVG 环形进度（非 canvas）：灰底环 + 主色进度环，-90° 起笔自顶部；
     初始 dashoffset=周长（空环），mount 时 rAF 写入目标值，CSS transition 600ms 扫入 */
  _ring(pct){
    const R=this.RING_R, C=+(2*Math.PI*R).toFixed(2);
    return '<svg viewBox="0 0 128 128">'
      +'<circle class="bg" cx="64" cy="64" r="'+R+'"/>'
      +'<circle class="fg" id="ringFg" cx="64" cy="64" r="'+R+'" transform="rotate(-90 64 64)"'
      +' style="stroke-dasharray:'+C+';stroke-dashoffset:'+C+'" data-c="'+C+'" data-pct="'+pct+'"/>'
      +'</svg>';
  },

  /* 下拉刷新：loading 800ms → toast（列表页通用模式，本页首个落地） */
  onPullRefresh(){
    MP.ui.loading('刷新中…');
    setTimeout(()=>{ MP.ui.hideLoading(); MP.ui.toast('已刷新','ok'); },800);
  },

  render(el){
    const pj=this._curProject();
    const devs=MP.data.devices;
    const total=devs.length,
          online=devs.filter(d=>d.online).length,
          /* 四格口径与 device.js 状态筛选 chips 一致：运行/关机按在线设备开关划分，
             故障为独立维度（故障机可能同时处于开机态，与运行格存在交叉），离线=不在线 */
          cnt={
            on:     devs.filter(d=>d.online&&d.power).length,
            off:    devs.filter(d=>d.online&&!d.power).length,
            fault:  devs.filter(d=>d.fault).length,
            offline:devs.filter(d=>!d.online).length,
          },
          lockMode =devs.filter(d=>d.lock&&d.lock.mode).length,
          lockTemp =devs.filter(d=>d.lock&&(d.lock.tempHi!=null||d.lock.tempLo!=null)).length,
          lockPower=devs.filter(d=>d.lock&&d.lock.power).length;
    const pct=total?online/total:0;

    /* 平均设定/室内温度：在线且开机设备的实时平均，保留 1 位小数；无在线开机设备显示 -- */
    const act=devs.filter(d=>d.online&&d.power);
    const avgTemp=act.length?(act.reduce((s,d)=>s+d.temp,0)/act.length).toFixed(1):'--';
    const avgRoom=act.length?(act.reduce((s,d)=>s+d.roomTemp,0)/act.length).toFixed(1):'--';

    const quick=this.QUICK.map((q,i)=>'<div class="qk" data-i="'+i+'"><div class="qb qk-'+q.cls+'">'+MP.icon(q.icon)+'</div><div class="ql">'+q.label+'</div></div>').join('');
    const grid=this.GRID.map((g,i)=>'<div class="mp-home-grid-item" data-i="'+i+'"><div class="gi gi-'+g.tint+'">'+MP.icon(g.icon)+'</div><div class="gl">'+g.label+'</div>'
      +(g.sub?'<div class="gs">'+g.sub+'</div>':'')+'</div>').join('');

    el.innerHTML=
    '<div class="mp-home-refresh" id="rfBar"><span id="rfTx">下拉刷新</span></div>'
    /* 1. 自定义 banner 条：LOGO（项目可配置企业标识，未配置用灰底占位）+ 项目切换 */
    +'<div class="mp-card mp-home-banner" id="pjSwitch">'
      +(pj.banner
        ? '<img class="logo" src="'+pj.banner+'" alt="">'
        : '<div class="logo ph">LOGO</div>')
      +'<div class="pj">'
        +'<div class="pj-name">'+pj.name+'</div>'
        +'<div class="pj-sub">'+(pj.feeMode==='prepaid'?'预付费':'后付费')+(pj.selfRecharge?' · 已开通自助充值':'')+'</div>'
      +'</div>'
      +'<div class="sw">切换 ⌄</div>'
    +'</div>'
    /* 2. 快捷功能卡：空调控制 / 定时任务 / 群组管理（对齐现行小程序首页顶部三入口） */
    +'<div class="mp-card mp-home-quick">'+quick+'</div>'
    /* 3. 室内机设备状态卡：左环形在线率 + 右 2×2 四格 + 底部平均温度 chips */
    +'<div class="mp-card">'
      +'<div class="mp-card-t">室内机设备状态</div>'
      +'<div class="mp-home-devstat">'
        +'<div class="mp-home-ring">'+this._ring(pct)
          +'<div class="rc"><div class="rl">可用设备总数</div><div class="rn mp-num">'+online+'<span class="u">台</span></div></div>'
        +'</div>'
        +'<div class="mp-home-dev4">'
          +this.DEV4.map(c=>'<div class="cell" data-f="'+c.f+'"><div class="n mp-num '+c.cls+'">'+cnt[c.f]+'</div><div class="t">'+c.label+'<i>›</i></div></div>').join('')
        +'</div>'
      +'</div>'
      +'<div class="mp-home-chips">'
        +'<span class="chip">平均设定温度 <b>'+avgTemp+'°C</b></span>'
        +'<span class="chip">平均室内温度 <b>'+avgRoom+'°C</b></span>'
      +'</div>'
    +'</div>'
    /* 4. 锁定状态卡：模式/温度/开关锁定三格大数字（按设备 lock 字段实时统计） */
    +'<div class="mp-card">'
      +'<div class="mp-card-t">锁定状态</div>'
      +'<div class="mp-home-lock">'
        +'<div class="lk"><div class="n mp-num">'+lockMode+'</div><div class="t">模式锁定数量</div></div>'
        +'<div class="lk"><div class="n mp-num">'+lockTemp+'</div><div class="t">温度锁定数量</div></div>'
        +'<div class="lk"><div class="n mp-num">'+lockPower+'</div><div class="t">开关锁定数量</div></div>'
      +'</div>'
    +'</div>'
    /* 5. 日程/群组概览卡：大数字 + 查看全部，整卡可点（纵排，对齐现行小程序） */
    +'<div class="mp-card mp-home-mini" data-go="schedule-list">'
      +'<div class="mp-card-t">日程管理<span class="more">查看全部 ›</span></div>'
      +'<div class="mn mp-num">'+MP.q.schedules().length+'</div><div class="ms">定时任务数量</div>'
    +'</div>'
    +'<div class="mp-card mp-home-mini" data-go="group-list">'
      +'<div class="mp-card-t">群组管理<span class="more">查看全部 ›</span></div>'
      +'<div class="mn mp-num">'+MP.q.groups().length+'</div><div class="ms">当前群组数量</div>'
    +'</div>'
    /* 6. 全部功能宫格：2 行 4 列 */
    +'<div class="mp-card">'
      +'<div class="mp-card-t">全部功能</div>'
      +'<div class="mp-home-grid">'+grid+'</div>'
    +'</div>';
  },

  mount(el){
    const self=this;

    /* ── 环形进度扫入动画：初始空环，rAF 后写入目标 dashoffset（CSS transition 600ms） ── */
    const fg=el.querySelector('#ringFg');
    if(fg){
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const c=+fg.dataset.c;
        fg.style.strokeDashoffset=(c*(1-(+fg.dataset.pct))).toFixed(2);
      }));
    }

    /* ── 项目切换：点 banner → sheet 列出全部项目 → 写入 state + 重渲染 + toast ── */
    el.querySelector('#pjSwitch').onclick=()=>{
      const cur=self._curProject();
      MP.ui.sheet({
        title:'项目切换',
        actions:MP.data.projects.map(p=>({key:p.id,label:p.name+(p.id===cur.id?'（当前）':'')})),
      },key=>{
        if(!key||key===cur.id)return;
        MP.state.set('projectId',key);
        MP.renderFrame();   /* 重新 render+mount 本页 */
        const p=MP.data.projects.find(x=>x.id===key);
        MP.ui.toast('已切换至 '+p.name,'ok');
      });
    };

    /* ── 快捷功能卡 ── */
    el.querySelectorAll('.mp-home-quick .qk').forEach(it=>it.onclick=()=>{
      const q=self.QUICK[+it.dataset.i];
      if(q.act==='tab')MP.switchTab(q.to);
      else MP.go(q.to);
    });

    /* ── 设备状态四格：预设筛选（devFilter 一次性消费）→ 设备 Tab ── */
    el.querySelectorAll('.mp-home-dev4 .cell').forEach(c=>c.onclick=()=>{
      MP.state.set('devFilter',c.dataset.f);
      MP.switchTab('device');
    });

    /* ── 日程/群组概览卡：整卡跳转 ── */
    el.querySelectorAll('.mp-home-mini').forEach(c=>c.onclick=()=>MP.go(c.dataset.go));

    /* ── 宫格点击：8 项全部已接通，按 act 路由 ── */
    el.querySelectorAll('.mp-home-grid-item').forEach(it=>it.onclick=()=>{
      const g=self.GRID[+it.dataset.i];
      if(g.act==='tab')MP.switchTab(g.to);
      else MP.go(g.to);
    });

    /* ── 下拉刷新：仅页面滚动到顶部时下拉生效，避免与列表滚动冲突。
       renderFrame 重渲染复用同一 el，监听只绑一次；刷新头元素在事件触发时现查 ── */
    if(!el._rfBound){
      el._rfBound=true;
      let startY=0, pulling=false, dy=0;
      el.addEventListener('touchstart',e=>{
        if(el.scrollTop<=0){ startY=e.touches[0].clientY; pulling=true; }
      },{passive:true});
      el.addEventListener('touchmove',e=>{
        if(!pulling)return;
        dy=e.touches[0].clientY-startY;
        const bar=el.querySelector('#rfBar'), tx=el.querySelector('#rfTx');
        if(dy>0&&bar){
          bar.style.height=Math.min(dy/2,64)+'px';
          if(tx)tx.textContent=dy>60?'松开刷新':'下拉刷新';
        }
      },{passive:true});
      el.addEventListener('touchend',()=>{
        if(!pulling)return;
        pulling=false;
        const go=dy>60; dy=0;
        const bar=el.querySelector('#rfBar'), tx=el.querySelector('#rfTx');
        if(bar)bar.style.height='0';
        if(tx)tx.textContent='下拉刷新';
        if(go)self.onPullRefresh();
      });
    }
  },
};
