/* 设备列表 Tab 主页（MP.pages.device）：对应 Web 端「集中控制-空调控制」pages/ctrl-ac.html
   自上而下：搜索框 + 批量控制入口 → 状态筛选 chips（横向滚动）→ 设备卡片 2 列网格（R4，对齐现行小程序）→ 多选模式底部操作栏
   支持下拉刷新（同 home 模式）与上拉加载演示（mock 一次性返回，仅演示 loading 态）
   筛选维度对照 Web：开关状态（开机/关机）、在线状态（在线/离线）、故障状态，移动端合并为一行单选 chips
   本文件同时导出两件共用件（供 group-detail 等页复用，避免两份实现漂移）：
   MP.devCard(d,opts) 设备卡片渲染（layout:'grid' 网格卡 / 'row' 单列卡）；MP.devBatchRun(act,devs,opt,onDone) 批量控制动作集 */
window.MP=window.MP||{};MP.pages=MP.pages||{};

/* 设备卡片共用渲染：device 列表（2 列网格）与 group-detail 成员列表（单列）复用
   opts: {layout:'row'|'grid'（默认 row）, check:bool 多选态（grid=底部方形勾选/row=左侧勾选圈）, sel:bool 选中态}
   grid 卡结构（R8 对齐 gwdbg .ac-unit-card 信息骨架，自上而下六段）：
     ① 顶部行：模式/风速小图标 + 右侧「开/关」状态文字
     ② 名称行（含离线/故障 tag）
     ③ 设定温度大字（关机 --）
     ④ 室温小字
     ⑤ 模式·风速主色小字行（原仅 row 卡有，本轮补进网格卡）
     ⑥ 底部行：方形勾选（多选态）+ 房间名 + 圆形电源钮
   圆形电源钮恒输出（离线自动带禁用样式） */
MP.devCard=function(d,opts){
  opts=opts||{};
  const P=MP.pages.device;
  if(opts.layout==='grid'){
    const on=d.online&&d.power;
    const locked=d.lock&&(d.lock.power||d.lock.mode||d.lock.tempHi!=null||d.lock.tempLo!=null);
    /* 单状态表达（优先级 离线>故障；开关机由顶部「开/关」文字与电源钮颜色表达，不再出 tag） */
    const stateTag=!d.online?'<span class="mp-tag tag-info">离线</span>':(d.fault?'<span class="mp-tag tag-er">故障</span>':'');
    const check=opts.check?'<span class="mp-chk-sq'+(opts.sel?' on':'')+(!d.online?' dis':'')+'" data-chk="'+d.id+'"></span>':'';
    return '<div class="mp-dev-card grid'+(d.online?'':' off')+(opts.sel?' sel':'')+'" data-id="'+d.id+'">'
      /* 顶部左侧为设备标识图标（对位 gwdbg 卡片的产品图槽位）；模式/风速改由 ⑤ 文字行表达，避免同一信息出两遍 */
      +'<div class="g-head">'
        +'<div class="g-icons'+(on?' on':'')+'">'+MP.icon('device')+'</div>'
        +'<span class="g-onoff'+(on?' on':'')+'">'+(d.power?'开':'关')+'</span>'
      +'</div>'
      +'<div class="g-name"><span class="nm">'+d.name+'</span>'+stateTag+'</div>'
      +'<div class="g-temp">'
        +(locked?'<span class="lk">'+MP.icon('lock','xs')+'</span>':'')
        +'<span class="tv mp-num">'+(d.power?d.temp+'<span class="u">°C</span>':'--')+'</span>'
      +'</div>'
      +'<span class="g-return">室温 '+(d.online?d.roomTemp+'°C':'--')+'</span>'
      +'<div class="g-modes">'+MP.icon(P.MODE_ICON[d.mode],'xs')+P.MODE_TXT[d.mode]
        +'<span class="sp">·</span>'+P.WIND_TXT[d.wind]+'</div>'
      +'<div class="g-foot">'+check+'<span class="g-room">'+d.room+'</span>'+P._powBtn(d)+'</div>'
    +'</div>';
  }
  const check=opts.check?'<span class="mp-check'+(opts.sel?' on':'')+(!d.online?' dis':'')+'" data-chk="'+d.id+'"></span>':'';
  return '<div class="mp-dev-card'+(d.online?'':' off')+(opts.sel?' sel':'')+'" data-id="'+d.id+'">'
    +check
    +'<div class="bd">'
      +'<div class="t1">'+d.name+' '+P._stateTag(d)+'</div>'
      +'<div class="t2">'+d.room+'</div>'
    +'</div>'
    +'<div class="rt">'
      +'<div class="tp">'+(d.power?d.temp+'<span class="u">°C</span>':'--')+'</div>'
      +'<div class="mw">'+P.MODE_TXT[d.mode]+' · '+P.WIND_TXT[d.wind]+'</div>'
    +'</div>'
    +P._powBtn(d)
  +'</div>';
};

/* 批量控制共用动作集：device 列表与 group-detail 复用，交互一致（ActionSheet 选参 → confirm → 应用 → toast）
   act: powerOn/powerOff/setMode/setTemp/setWind；devs: 目标设备对象数组
   opt.emptyMsg: 目标为空时的提示；onDone: 应用成功后回调（页面自刷），仅改内存演示 */
MP.devBatchRun=function(act,devs,opt,onDone){
  opt=opt||{};
  const P=MP.pages.device, n=devs.length;
  if(!n){ MP.ui.toast(opt.emptyMsg||'请先勾选设备'); return; }
  const apply=(desc,fn)=>{
    MP.ui.confirm({title:'批量控制',text:'将对 '+n+' 台设备执行 '+desc},()=>{
      devs.forEach(fn);
      if(onDone)onDone();
      MP.ui.toast('已下发 '+n+' 台设备控制指令','ok');
    });
  };
  if(act==='powerOn') return apply('开机',d=>{d.power=true;});
  if(act==='powerOff') return apply('关机',d=>{d.power=false;});
  if(act==='setMode'){
    MP.ui.sheet({title:'选择模式',actions:Object.keys(P.MODE_TXT).map(k=>({key:k,label:P.MODE_TXT[k]}))},k=>{
      if(!k)return;
      apply('模式「'+P.MODE_TXT[k]+'」',d=>{d.mode=k;});
    });
    return;
  }
  if(act==='setTemp'){
    MP.ui.sheet({title:'选择设定温度（16-31°C）',actions:[22,24,26,28].map(t=>({key:String(t),label:t+'°C'})).concat([{key:'custom',label:'自定义温度…'}])},k=>{
      if(!k)return;
      if(k==='custom'){ MP.ui.toast('演示环境请使用快捷温度档'); return; }
      apply('温度「'+k+'°C」',d=>{d.temp=+k;});
    });
    return;
  }
  if(act==='setWind'){
    MP.ui.sheet({title:'选择风速',actions:Object.keys(P.WIND_TXT).map(k=>({key:k,label:P.WIND_TXT[k]}))},k=>{
      if(!k)return;
      apply('风速「'+P.WIND_TXT[k]+'」',d=>{d.wind=k;});
    });
  }
};

MP.pages.device={
  title:'设备',tab:true,
  note:[
    {type:'优化',text:'Web 表格改为 2 列卡片网格（R4 对齐现行小程序），适配触屏浏览'},
    {type:'新增',text:'卡片电源键一键开关机，无需进详情页'},
    {type:'简化',text:'Web 端温度范围双框筛选简化为状态 chips'},
    {type:'优化',text:'批量控制改为整卡点选（主色描边+勾选圆标）+ 底部操作栏 + ActionSheet'},
    {type:'新增',text:'首页设备状态四格点击直达本页并预设状态筛选（devFilter 一次性消费）'},
  ],

  /* 模式/风速 key → 中文（与 MP.data.devices 字段一致，四值对齐 Web 端） */
  MODE_TXT:{cool:'制冷',heat:'制热',fan:'送风',dry:'除湿'},
  WIND_TXT:{auto:'自动',low:'低风',mid:'中风',high:'高风'},
  MODE_ICON:{cool:'snow',heat:'sun',fan:'fan',dry:'drop'},   /* mp/icons.js 图标名（网格卡顶部小图标行） */
  /* 状态筛选 chips：全部/开机/关机/在线/离线/故障（单选） */
  CHIPS:[['all','全部'],['on','开机'],['off','关机'],['online','在线'],['offline','离线'],['fault','故障']],
  TEMP_MIN:16,TEMP_MAX:31,

  /* 状态标签：优先级 离线 > 故障 > 开关机，只显示一个最高优先级状态 */
  _stateTag(d){
    if(!d.online)return '<span class="mp-tag tag-info">离线</span>';
    if(d.fault)return '<span class="mp-tag tag-er">故障</span>';
    return d.power?'<span class="mp-tag tag-ok">开机</span>':'<span class="mp-tag tag-info">关机</span>';
  },
  _match(d){
    const kw=this._kw, f=this._filter;
    if(kw&&!(d.name.includes(kw)||d.room.includes(kw)))return false;
    if(f==='on')return d.online&&d.power;
    if(f==='off')return d.online&&!d.power;
    if(f==='online')return d.online;
    if(f==='offline')return !d.online;
    if(f==='fault')return d.fault;
    return true;
  },
  _list(){ return MP.data.devices.filter(d=>this._match(d)); },

  /* 圆形电源按钮（SVG 电源符，描边 2px）：开机主色实心 / 关机灰描边 / 离线禁用 */
  _powBtn(d){
    return '<span class="mp-pow'+(d.power?' on':'')+(!d.online?' dis':'')+'" data-pow="'+d.id+'">'+MP.icon('power','',2)+'</span>';
  },

  _cardHTML(d){
    return MP.devCard(d,{layout:'grid',check:this._multi,sel:this._sel.has(d.id)});
  },

  render(el){
    /* 页内状态：每次进入重置；首页状态四格跳转可经 MP.state.devFilter 预设筛选（一次性消费） */
    this._kw=''; this._filter='all';
    const pf=MP.state.get('devFilter');
    if(pf){ this._filter=pf; MP.state.set('devFilter',''); }
    this._multi=false; this._sel=new Set();
    this._loadedAll=false; this._loadingMore=false;

    el.innerHTML=
    '<div class="mp-home-refresh" id="rfBar"><span id="rfTx">下拉刷新</span></div>'
    /* 1. 搜索 + 批量控制入口 */
    +'<div class="mp-dev-top">'
      +'<div class="mp-dev-search"><span class="ic">'+MP.icon('search','sm')+'</span><input id="devKw" placeholder="搜索设备名称 / 房间"></div>'
      +'<div class="mp-dev-batch-btn" id="btnMulti">批量控制</div>'
    +'</div>'
    /* 2. 状态筛选 chips（横向滚动，单选） */
    +'<div class="mp-dev-chips" id="devChips">'
      +this.CHIPS.map(c=>'<span class="mp-chip'+(c[0]===this._filter?' on':'')+'" data-f="'+c[0]+'">'+c[1]+'</span>').join('')
    +'</div>'
    /* 3. 设备卡片 2 列网格（R4） */
    +'<div class="mp-dev-grid" id="devList"></div>'
    +'<div class="mp-dev-more" id="devMore" style="display:none"><span class="mp-spinner sm"></span>加载中…</div>'
    /* 4. 多选模式底部操作栏 */
    +'<div class="mp-batch-bar" id="batchBar" style="display:none">'
      +'<div class="cnt" id="batchCnt">已选 0 台</div>'
      +'<div class="acts">'
        +'<span class="act" data-a="powerOn">开机</span>'
        +'<span class="act" data-a="powerOff">关机</span>'
        +'<span class="act" data-a="setMode">模式</span>'
        +'<span class="act" data-a="setTemp">温度</span>'
        +'<span class="act" data-a="setWind">风速</span>'
        +'<span class="act cancel" data-a="cancel">取消</span>'
      +'</div>'
    +'</div>';
    this._refreshList(el);
  },

  /* 只重渲染列表区（不重渲染整页，避免搜索框失焦） */
  _refreshList(el){
    const list=this._list();
    /* 筛选/搜索变化时修剪选择集：不在当前结果中的自动取消，避免批量控制误伤看不见的设备（对齐 Web 端） */
    if(this._sel.size){
      const vis=new Set(list.map(d=>d.id));
      Array.from(this._sel).forEach(id=>{ if(!vis.has(id))this._sel.delete(id); });
    }
    const box=el.querySelector('#devList');
    box.innerHTML=list.length
      ? list.map(d=>this._cardHTML(d)).join('')
      : '<div class="mp-empty"><div class="ic">'+MP.icon('device')+'</div><div class="tx">暂无符合条件的设备</div></div>';
    this._bindList(el);
    const cnt=el.querySelector('#batchCnt');
    if(cnt)cnt.textContent='已选 '+this._sel.size+' 台';
  },

  _bindList(el){
    const self=this;
    el.querySelectorAll('#devList .mp-dev-card').forEach(card=>{
      const id=card.dataset.id;
      card.onclick=()=>{
        if(self._multi){ self._toggleSel(el,id); return; }
        MP.go('device-detail',{id:id});
      };
    });
    /* 多选方形勾选（grid 卡底部行，R8 起）：点击仅切换勾选，不进详情 */
    el.querySelectorAll('#devList .mp-chk-sq').forEach(c=>c.onclick=e=>{
      e.stopPropagation();
      if(c.classList.contains('dis')){ MP.ui.toast('设备离线，无法控制'); return; }
      self._toggleSel(el,c.dataset.chk);
    });
    /* 卡片电源钮：即时切换开关机（仅内存演示，不入 localStorage） */
    el.querySelectorAll('#devList .mp-pow').forEach(p=>p.onclick=e=>{
      e.stopPropagation();
      if(p.classList.contains('dis')){ MP.ui.toast('设备离线，无法控制'); return; }
      const d=MP.data.devices.find(x=>x.id===p.dataset.pow);
      if(!d)return;
      if(self._multi){ self._toggleSel(el,d.id); return; }
      d.power=!d.power;
      self._refreshList(el);
      MP.ui.toast(d.power?'已开机':'已关机','ok');
    });
  },

  _toggleSel(el,id){
    const d=MP.data.devices.find(x=>x.id===id);
    if(d&&!d.online){ MP.ui.toast('设备离线，无法控制'); return; }
    this._sel.has(id)?this._sel.delete(id):this._sel.add(id);
    this._refreshList(el);
  },

  /* 批量控制：委托共用件 MP.devBatchRun（交互与 group-detail 一致），应用后清空勾选并刷新列表 */
  _batch(el,act){
    const self=this;
    if(act==='cancel'){ self._exitMulti(el); return; }
    const devs=Array.from(this._sel).map(id=>MP.data.devices.find(x=>x.id===id)).filter(Boolean);
    MP.devBatchRun(act,devs,{emptyMsg:'请先勾选设备'},()=>{ self._sel.clear(); self._refreshList(el); });
  },

  _enterMulti(el){
    this._multi=true; this._sel.clear();
    el.querySelector('#btnMulti').textContent='退出批量';
    el.querySelector('#batchBar').style.display='';
    this._refreshList(el);
  },
  _exitMulti(el){
    this._multi=false; this._sel.clear();
    el.querySelector('#btnMulti').textContent='批量控制';
    el.querySelector('#batchBar').style.display='none';
    this._refreshList(el);
  },

  onPullRefresh(){
    MP.ui.loading('刷新中…');
    setTimeout(()=>{ MP.ui.hideLoading(); MP.ui.toast('已刷新','ok'); },800);
  },

  mount(el){
    const self=this;

    /* 搜索：名称/房间模糊匹配，实时过滤 */
    el.querySelector('#devKw').oninput=e=>{
      self._kw=e.target.value.trim();
      self._loadedAll=false;
      self._refreshList(el);
    };

    /* 状态筛选 chips：单选 */
    el.querySelectorAll('#devChips .mp-chip').forEach(c=>c.onclick=()=>{
      self._filter=c.dataset.f;
      self._loadedAll=false;
      el.querySelectorAll('#devChips .mp-chip').forEach(x=>x.classList.toggle('on',x===c));
      self._refreshList(el);
    });

    /* 批量控制入口开关 */
    el.querySelector('#btnMulti').onclick=()=>{ self._multi?self._exitMulti(el):self._enterMulti(el); };

    /* 底部操作栏 */
    el.querySelectorAll('#batchBar .act').forEach(a=>a.onclick=()=>self._batch(el,a.dataset.a));

    /* 上拉加载演示：结果 >10 条时滚动到底触发 600ms loading（mock 一次性返回，仅演示加载态）
       el 在 renderFrame 间复用，监听只绑一次 */
    if(!el._scrollBound){
      el._scrollBound=true;
      el.addEventListener('scroll',()=>{
        if(self._loadingMore||self._loadedAll)return;
        if(self._list().length<=10)return;
        if(el.scrollTop+el.clientHeight>=el.scrollHeight-24){
          self._loadingMore=true;
          el.querySelector('#devMore').style.display='';
          setTimeout(()=>{
            const more=el.querySelector('#devMore');
            if(more)more.style.display='none';
            self._loadingMore=false; self._loadedAll=true;
            MP.ui.toast('已加载全部');
          },600);
        }
      },{passive:true});
    }

    /* 下拉刷新：同 home 模式（仅滚动到顶部时下拉生效） */
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
