/* 单设备控制面板 V2（MP.pages.device-detail，二级页；R5 全面重构，对齐现行小程序截图）
   结构：异常横幅（离线黄/故障红）→ 顶部设备卡（已选择空调 + 项目/房间路径 + 设备名 + 状态 tag + 室内机占位图）
        → 胶囊页签【模式设置 | 限定设置】→ 页签内容 → 底部固定操作条 → 设备信息卡
   模式设置：设备开关机双大卡 → 设定模式四图标卡（选中=主色描边白底）→ 设定温度滑块（16-31，锁定收窄）
        → 设定风速四图标卡 → 「确定」收集面板态一次性写回设备 + toast「设置已生效」
   限定设置（管理员下发锁定）：禁止启动/禁止关闭/温度范围限定（双滑块区间 16-32）/制热固定/制冷固定
        → 「解除锁定」（清空全部锁定）|「设置起效」（校验后写回 device.lock）
   锁定语义（数据模型）：lock={tempHi,tempLo,mode,power,noOn,noOff,heatFix,coolFix}
        power=开关全锁；noOn/noOff=禁止启动/禁止关闭；电源区禁用条件=power||(noOn&&noOff)，单卡各随 noOn/noOff 禁用
        mode=模式全锁；heatFix/coolFix=模式固定制热/制冷（整区禁用，固定模式卡保持选中，下发时同步写 d.mode）
   面板态：_st（模式设置）/_lm（限定设置）为页内未下发暂存；切页签时从设备对象重读，双页签双向同步
   所有写回仅改内存值（演示，不入 localStorage），返回列表页即时同步（同一 MP.data.devices 数据源） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['device-detail']={
  title:'设备控制',
  note:[
    {type:'优化',text:'控制面板重构为双页签（模式设置/限定设置），对齐现行小程序'},
    {type:'新增',text:'限定设置纳入：管理员下发锁定（禁止启动/禁止关闭/温度范围限定/制热固定/制冷固定）'},
    {type:'优化',text:'设定温度由步进器改为滑块（- + 圆钮辅助，16-31°C，锁定收窄）'},
    {type:'优化',text:'「确定」收集面板态一次性写回设备 + toast；限定设置「设置起效」下发锁定'},
  ],

  MODE_TXT:{cool:'制冷',heat:'制热',fan:'送风',dry:'除湿'},
  MODE_ICON:{cool:'snow',heat:'sun',fan:'fan',dry:'drop'},   /* mp/icons.js 图标名 */
  WIND_TXT:{auto:'自动',low:'低风',mid:'中风',high:'高风'},
  TEMP_MIN:16,TEMP_MAX:31,   /* 设定温度滑块限幅 16–31°C，与 Web 端一致；锁定后按 lock 收窄 */
  LIM_MIN:16,LIM_MAX:32,     /* 温度范围限定双滑块 16–32°C（对齐现行小程序限定设置页） */

  _st:null,   /* 模式设置面板态 {dev,tab,power,mode,temp,wind} */
  _lm:null,   /* 限定设置面板态 {noOn,noOff,tempOn,lo,hi,heatFix,coolFix} */

  _dev(params){ return MP.data.devices.find(d=>d.id===(params&&params.id)); },
  _group(d){ const g=MP.data.groups.find(g=>g.deviceIds.indexOf(d.id)>=0); return g?g.name:'--'; },
  _sn(d){ return 'FY-AC-2026-'+String(parseInt(d.id.slice(1),10)).padStart(4,'0'); },
  _proj(){ const pid=MP.state.get('projectId')||'p1';
    const p=(MP.data.projects||[]).find(p=>p.id===pid)||(MP.data.projects||[])[0]; return p?p.name:''; },
  /* 温度有效范围：锁定上下限非 null 时收窄 */
  _range(d){
    return { lo:(d.lock&&d.lock.tempLo!=null)?d.lock.tempLo:this.TEMP_MIN,
             hi:(d.lock&&d.lock.tempHi!=null)?d.lock.tempHi:this.TEMP_MAX };
  },
  /* 电源锁定矩阵：all=整区禁用（开关全锁 或 禁止启动+禁止关闭 组合）；on/off=单卡禁用 */
  _powLock(d){ const L=d.lock||{};
    return { all:!!L.power||(!!L.noOn&&!!L.noOff), on:!!L.power||!!L.noOn, off:!!L.power||!!L.noOff }; },
  _powLockTxt(d){ const L=d.lock||{};
    if(L.power)return '开关全锁';
    if(L.noOn&&L.noOff)return '禁止启动 · 禁止关闭';
    if(L.noOn)return '禁止启动'; if(L.noOff)return '禁止关闭'; return ''; },
  /* 模式固定：heatFix→'heat' / coolFix→'cool'；与 mode 锁一并构成模式区禁用 */
  _modeFix(d){ const L=d.lock||{}; if(L.heatFix)return 'heat'; if(L.coolFix)return 'cool'; return null; },
  _modeLockTxt(d){ const L=d.lock||{};
    if(L.mode)return '模式锁定'; if(L.heatFix)return '制热固定'; if(L.coolFix)return '制冷固定'; return ''; },

  _stateTag(d){
    if(!d.online)return '<span class="mp-tag tag-info">离线</span>';
    if(d.fault)return '<span class="mp-tag tag-er">故障</span>';
    return '<span class="mp-tag tag-ok">在线</span>';
  },
  _lockTag(txt){ return '<span class="mp-dd-lock">'+MP.icon('lock','xs')+' '+txt+'<span class="mp-sub">（已被平台锁定）</span></span>'; },
  /* 室内机占位图：四面出风卡式机简形 SVG（产品图占位，非 MP.icon 图标体系） */
  _unit(){ return '<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'
    +'<rect x="8" y="8" width="56" height="56" rx="6"/>'
    +'<rect x="24" y="24" width="24" height="24" rx="3"/>'
    +'<path d="M12 12l12 12M60 12 48 24M12 60l12-12M60 60 48 48"/>'
    +'<path d="M33 8v5M39 8v5M33 64v-5M39 64v-5M8 33h5M8 39h5M64 33h-5M64 39h-5"/>'
    +'</svg>'; },
  /* 刻度行：min..max 逐值小刻线 + 两端数值标签 */
  _ticks(lo,hi){ let s='<div class="mp-ticks">'; for(let v=lo;v<=hi;v++)s+='<i></i>';
    return s+'</div><div class="mp-ticklab"><span>'+lo+'</span><span>'+hi+'</span></div>'; },

  render(el,params){
    const d=this._dev(params);
    if(!d){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('device')+'</div><div class="tx">未找到该设备</div></div>';
      return;
    }
    /* 面板态初始化：换设备重置；温度钳进有效区间 */
    if(!this._st||this._st.dev!==d.id){
      this._st={dev:d.id,tab:'mode',power:d.power,mode:d.mode,temp:d.temp,wind:d.wind};
      this._lm=null;
    }
    const st=this._st, L=d.lock||{}, R=this._range(d);
    if(st.temp<R.lo)st.temp=R.lo; if(st.temp>R.hi)st.temp=R.hi;

    /* 异常横幅：离线黄条 > 故障红条 */
    const banner=!d.online
      ? '<div class="mp-dd-banner wn">'+MP.icon('alert','sm')+' 设备离线，无法控制</div>'
      : (d.fault?'<div class="mp-dd-banner er">'+MP.icon('alert','sm')+' 设备故障，控制指令可能失效</div>':'');

    el.innerHTML=
    banner
    /* 1. 顶部设备卡：已选择空调 + 项目/房间路径 + 设备名/状态 tag + 室内机占位图 */
    +'<div class="mp-card mp-dd-head">'
      +'<div class="bd">'
        +'<div class="lab">已选择空调</div>'
        +'<div class="path">'+this._proj()+' / '+d.room+'</div>'
        +'<div class="nrow"><span class="nm">'+d.name+'</span>'+this._stateTag(d)+'</div>'
      +'</div>'
      +'<div class="mp-dd-unit">'+this._unit()+'</div>'
    +'</div>'
    /* 2. 胶囊页签 */
    +'<div class="mp-dd-tabs">'
      +'<div class="mp-dd-tab'+(st.tab==='mode'?' on':'')+'" data-tab="mode">模式设置</div>'
      +'<div class="mp-dd-tab'+(st.tab==='limit'?' on':'')+'" data-tab="limit">限定设置</div>'
    +'</div>'
    /* 3. 页签内容（控制区卡片，底部固定操作条统一在信息卡之后——sticky 末位常驻） */
    +(st.tab==='mode'?this._renderMode(d,st,R):this._renderLimit(d))
    /* 4. 设备信息卡 */
    +'<div class="mp-card">'
      +'<div class="mp-card-t">设备信息</div>'
      +'<div class="mp-item ro"><div class="bd"><div class="t1">设备 SN</div></div><div class="ft">'+this._sn(d)+'</div></div>'
      +'<div class="mp-item ro"><div class="bd"><div class="t1">所属群组</div></div><div class="ft">'+this._group(d)+'</div></div>'
      +'<div class="mp-item ro"><div class="bd"><div class="t1">所在房间</div></div><div class="ft">'+d.room+'</div></div>'
    +'</div>'
    /* 5. 底部固定操作条：模式设置=确定 / 限定设置=解除锁定+设置起效 */
    +(st.tab==='mode'
      ? '<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="ddOk"'
        +(!d.online?' disabled':'')+'>确定</button></div>'
      : '<div class="mp-footer mp-lim-ft">'
        +'<button class="mp-btn mp-btn-soft" id="lmUnlock">解除锁定</button>'
        +'<button class="mp-btn mp-btn-primary" id="lmApply">设置起效</button>'
      +'</div>');
  },

  /* ── 页签一：模式设置 ── */
  _renderMode(d,st,R){
    const pw=this._powLock(d), pwTxt=this._powLockTxt(d), mFix=this._modeFix(d), mLockTxt=this._modeLockTxt(d);
    const tempLocked=(d.lock&&(d.lock.tempHi!=null||d.lock.tempLo!=null));
    const secDim=!d.online||!st.power;          /* 离线/面板选关机：模式·温度·风速整区禁用 */
    const curMode=mFix||st.mode;                /* 模式固定时强制显示固定模式 */

    /* 设备开关机：关机/开机双大卡（选中=主色渐变实底白字；禁用=降透明但可点出原因 toast） */
    const pcard=(val,txt,dis)=>'<div class="mp-dd-pcard'+(st.power===val?' on':'')+(dis?' dis':'')+'" data-p="'+(val?1:0)+'">'
      +MP.icon('power','',1.8)+'<span>'+txt+'</span></div>';
    /* 设定模式：四图标卡（选中=主色 1.5px 描边+白底+主色字）；模式锁定/固定时各卡 dis */
    const modes=Object.keys(this.MODE_TXT).map(k=>
      '<div class="mp-dd-icard'+(curMode===k?' on':'')+(mLockTxt?' dis':'')+'" data-m="'+k+'">'
      +'<div class="mi">'+MP.icon(this.MODE_ICON[k])+'</div><div class="mt">'+this.MODE_TXT[k]+'</div></div>').join('');
    /* 设定风速：四图标卡（fan 图标按档位区分大小） */
    const winds=Object.keys(this.WIND_TXT).map(k=>
      '<div class="mp-dd-icard sz-'+k+(st.wind===k?' on':'')+'" data-w="'+k+'">'
      +'<div class="mi">'+MP.icon('fan')+'</div><div class="mt">'+this.WIND_TXT[k]+'</div></div>').join('');

    return '<div class="mp-card'+(pw.all||!d.online?' mp-dd-dim':'')+'">'
      +'<div class="mp-card-t">设备开关机'+(pwTxt?this._lockTag(pwTxt):'')+'</div>'
      +'<div class="mp-dd-pcards">'+pcard(false,'关机',pw.off||!d.online)+pcard(true,'开机',pw.on||!d.online)+'</div>'
    +'</div>'
    +'<div class="mp-card mp-dd-modecard'+(secDim?' mp-dd-dim':'')+'">'
      +'<div class="mp-card-t">设定模式'+(mLockTxt?this._lockTag(mLockTxt):'')+'</div>'
      +'<div class="mp-dd-icards">'+modes+'</div>'
    +'</div>'
    +'<div class="mp-card mp-dd-modecard'+(secDim?' mp-dd-dim':'')+'">'
      +'<div class="mp-card-t">设定温度'
        +(tempLocked?this._lockTag('锁定范围 '+R.lo+'-'+R.hi+'°C'):'<span class="mp-sub">（'+R.lo+'-'+R.hi+'°C）</span>')
      +'</div>'
      +'<div class="mp-dd-tempv"><span class="n" id="ddTempV">'+st.temp+'</span><span class="u">°C</span></div>'
      +'<div class="mp-dd-slider">'
        +'<span class="mp-sbtn" id="ddTMinus">−</span>'
        +'<div class="mp-dd-swrap">'
          +'<input type="range" class="mp-range" id="ddTRange" min="'+R.lo+'" max="'+R.hi+'" step="1" value="'+st.temp+'"'
            +(secDim?' disabled':'')+'>'
          +this._ticks(R.lo,R.hi)
        +'</div>'
        +'<span class="mp-sbtn" id="ddTPlus">＋</span>'
      +'</div>'
    +'</div>'
    +'<div class="mp-card mp-dd-modecard'+(secDim?' mp-dd-dim':'')+'">'
      +'<div class="mp-card-t">设定风速</div>'
      +'<div class="mp-dd-icards">'+winds+'</div>'
    +'</div>';
  },

  /* ── 页签二：限定设置（管理员下发锁定） ── */
  _renderLimit(d){
    if(!this._lm){ /* 从设备对象重读（页签同步入口） */
      const L=d.lock||{};
      this._lm={ noOn:!!L.noOn, noOff:!!L.noOff,
        tempOn:(L.tempHi!=null||L.tempLo!=null),
        lo:(L.tempLo!=null?L.tempLo:23), hi:(L.tempHi!=null?L.tempHi:28),
        heatFix:!!L.heatFix, coolFix:!!L.coolFix };
    }
    const lm=this._lm;
    const sw=(key,label)=>'<div class="mp-card mp-lim"><div class="lb">'+label+'</div>'
      +'<label class="mp-switch" data-lk="'+key+'"><input type="checkbox"'+(lm[key]?' checked':'')+'><span class="tk"></span></label></div>';

    return sw('noOn','禁止启动')
    +sw('noOff','禁止关闭')
    /* 温度范围限定：开关行；开启展开 双值大字 + 双滑块区间选择器（16-32，min<max 校验） */
    +'<div class="mp-card mp-lim-col">'
      +'<div class="mp-lim"><div class="lb">温度范围限定</div>'
        +'<label class="mp-switch" data-lk="tempOn"><input type="checkbox"'+(lm.tempOn?' checked':'')+'><span class="tk"></span></label></div>'
      +(lm.tempOn
        ? '<div class="mp-lim-expand">'
          +'<div class="mp-lim-rv"><span class="n" id="lmRV">'+lm.lo+'-'+lm.hi+'</span><span class="u">°C</span></div>'
          +'<div class="mp-drange">'
            +'<div class="tr"><div class="in" id="lmDRIn"></div></div>'
            +'<input type="range" id="lmLo" min="'+this.LIM_MIN+'" max="'+this.LIM_MAX+'" step="1" value="'+lm.lo+'">'
            +'<input type="range" id="lmHi" min="'+this.LIM_MIN+'" max="'+this.LIM_MAX+'" step="1" value="'+lm.hi+'">'
          +'</div>'
          +this._ticks(this.LIM_MIN,this.LIM_MAX)
        +'</div>'
        : '')
    +'</div>'
    +sw('heatFix','制热固定')
    +sw('coolFix','制冷固定');
  },

  mount(el,params){
    const self=this, d=this._dev(params);
    if(!d)return;
    const st=this._st, redo=()=>MP.renderFrame();

    /* 页签切换：从设备对象重读面板态（双页签双向同步，未下发的暂存被丢弃） */
    el.querySelectorAll('.mp-dd-tab').forEach(t=>t.onclick=()=>{
      const k=t.dataset.tab; if(st.tab===k)return;
      st.tab=k;
      st.power=d.power; st.mode=d.mode; st.temp=d.temp; st.wind=d.wind;
      self._lm=null;
      redo();
    });

    if(st.tab==='mode')this._mountMode(el,d,st);else this._mountLimit(el,d);
  },

  _mountMode(el,d,st){
    const self=this, L=d.lock||{}, R=this._range(d), redo=()=>MP.renderFrame();
    const mFix=this._modeFix(d), mLockTxt=this._modeLockTxt(d);
    const secDim=()=>!d.online||!st.power;

    /* 设备开关机双大卡：禁用卡点击给出原因；切换后面写回（「确定」统一下发） */
    el.querySelectorAll('.mp-dd-pcard').forEach(c=>c.onclick=()=>{
      const v=c.dataset.p==='1';
      if(!d.online){ MP.ui.toast('设备离线，无法控制'); return; }
      if(v&&(L.power||L.noOn)){ MP.ui.toast(L.power?'开关已被平台锁定':'已禁止启动，无法开机'); return; }
      if(!v&&(L.power||L.noOff)){ MP.ui.toast(L.power?'开关已被平台锁定':'已禁止关闭，无法关机'); return; }
      if(st.power===v)return;
      st.power=v;
      /* 局部刷新：双卡选中态 + 模式/温度/风速区禁用联动（不整页重渲，避免滚动跳顶） */
      el.querySelectorAll('.mp-dd-pcard').forEach(x=>x.classList.toggle('on',(x.dataset.p==='1')===v));
      el.querySelectorAll('.mp-dd-modecard').forEach(s=>s.classList.toggle('mp-dd-dim',secDim()));
      const rg=el.querySelector('#ddTRange'); if(rg)rg.disabled=secDim();
    });

    /* 设定模式：模式锁定/固定时禁用（点击提示）；固定时模式不可更改 */
    el.querySelectorAll('.mp-dd-icard[data-m]').forEach(m=>m.onclick=()=>{
      if(!d.online){ MP.ui.toast('设备离线，无法控制'); return; }
      if(!st.power){ MP.ui.toast('设备已关机，请先选择开机'); return; }
      if(mLockTxt){ MP.ui.toast(mLockTxt+'，已被平台锁定'); return; }
      const k=m.dataset.m; if(st.mode===k)return;
      st.mode=k;
      el.querySelectorAll('.mp-dd-icard[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m===k));
    });

    /* 设定温度滑块：- + 圆钮辅助 ±1；范围随锁定收窄；输入即更新大字与轨道填充 */
    const rg=el.querySelector('#ddTRange'), tv=el.querySelector('#ddTempV');
    const paint=()=>{ const p=(st.temp-R.lo)/(R.hi-R.lo)*100;
      rg.style.setProperty('--trk','linear-gradient(90deg,#4080FF 0,#1F65FF '+p+'%,#E9ECF2 '+p+'%)');
      tv.textContent=st.temp; };
    const setT=v=>{ st.temp=Math.max(R.lo,Math.min(R.hi,v)); rg.value=st.temp; paint(); };
    if(rg&&tv){
      paint();
      rg.oninput=()=>{ if(secDim())return; st.temp=+rg.value; paint(); };
      el.querySelector('#ddTMinus').onclick=()=>{ if(secDim())return;
        if(st.temp<=R.lo){ MP.ui.toast('已达温度下限'); return; } setT(st.temp-1); };
      el.querySelector('#ddTPlus').onclick=()=>{ if(secDim())return;
        if(st.temp>=R.hi){ MP.ui.toast('已达温度上限'); return; } setT(st.temp+1); };
    }

    /* 设定风速 */
    el.querySelectorAll('.mp-dd-icard[data-w]').forEach(w=>w.onclick=()=>{
      if(!d.online){ MP.ui.toast('设备离线，无法控制'); return; }
      if(!st.power){ MP.ui.toast('设备已关机，请先选择开机'); return; }
      const k=w.dataset.w; if(st.wind===k)return;
      st.wind=k;
      el.querySelectorAll('.mp-dd-icard[data-w]').forEach(x=>x.classList.toggle('on',x.dataset.w===k));
    });

    /* 确定：收集面板态一次性写回设备（模式固定时以固定模式为准），留在本页 */
    const ok=el.querySelector('#ddOk');
    if(ok)ok.onclick=()=>{
      if(!d.online){ MP.ui.toast('设备离线，无法控制'); return; }
      d.power=st.power; d.mode=mFix||st.mode; d.temp=st.temp; d.wind=st.wind;
      MP.ui.toast('设置已生效','ok');
    };
  },

  _mountLimit(el,d){
    const self=this, lm=this._lm, L=d.lock=d.lock||{}, redo=()=>MP.renderFrame();

    /* 开关行：切 tempOn 需重渲展开/收起区间区；制热/制冷固定互斥 */
    el.querySelectorAll('.mp-switch input').forEach(inp=>inp.onchange=()=>{
      const k=inp.closest('.mp-switch').dataset.lk, v=inp.checked;
      lm[k]=v;
      if(v&&k==='heatFix')lm.coolFix=false;
      if(v&&k==='coolFix')lm.heatFix=false;
      if(k==='tempOn'||k==='heatFix'||k==='coolFix')redo();   /* 展开/互斥需重渲 */
    });

    /* 双滑块区间选择器：强制 min<max（间距≥1），实时更新区间填充与双值大字 */
    const loI=el.querySelector('#lmLo'), hiI=el.querySelector('#lmHi'),
          inEl=el.querySelector('#lmDRIn'), rv=el.querySelector('#lmRV');
    if(loI&&hiI&&inEl&&rv){
      const paint=()=>{ const span=this.LIM_MAX-this.LIM_MIN;
        inEl.style.left=((lm.lo-this.LIM_MIN)/span*100)+'%';
        inEl.style.width=((lm.hi-lm.lo)/span*100)+'%';
        rv.textContent=lm.lo+'-'+lm.hi; };
      loI.oninput=()=>{ lm.lo=Math.min(+loI.value,lm.hi-1); loI.value=lm.lo; paint(); };
      hiI.oninput=()=>{ lm.hi=Math.max(+hiI.value,lm.lo+1); hiI.value=lm.hi; paint(); };
      paint();
    }

    /* 解除锁定：二次确认后清空全部锁定字段 */
    el.querySelector('#lmUnlock').onclick=()=>{
      MP.ui.confirm({title:'解除锁定',text:'确定解除该设备的全部锁定？',okText:'解除锁定',danger:true},()=>{
        L.tempHi=null; L.tempLo=null; L.mode=false; L.power=false;
        L.noOn=false; L.noOff=false; L.heatFix=false; L.coolFix=false;
        self._lm=null; redo();
        MP.ui.toast('已解除全部锁定','ok');
      });
    };

    /* 设置起效：校验（双固定互斥兜底 + 温度 min<max）→ 写回 device.lock；固定模式同步写 d.mode */
    el.querySelector('#lmApply').onclick=()=>{
      if(lm.heatFix&&lm.coolFix){ MP.ui.toast('制热固定与制冷固定不能同时开启','er'); return; }
      if(lm.tempOn&&lm.lo>=lm.hi){ MP.ui.toast('温度下限需小于上限','er'); return; }
      L.noOn=lm.noOn; L.noOff=lm.noOff;
      L.heatFix=lm.heatFix; L.coolFix=lm.coolFix;
      L.tempLo=lm.tempOn?lm.lo:null; L.tempHi=lm.tempOn?lm.hi:null;
      L.mode=false;   /* 模式锁定由 制热/制冷固定 表达（限定设置页签语义） */
      if(lm.heatFix)d.mode='heat';
      if(lm.coolFix)d.mode='cool';
      MP.ui.toast('限定已下发','ok');
    };
  },
};
