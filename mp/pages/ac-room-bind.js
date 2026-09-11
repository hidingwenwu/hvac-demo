/* 绑定空调（MP.pages['ac-room-bind']，二级页）：R7 重设计为「楼栋/楼层/房间三级下钻 + 现场连续绑定流」，
   对应 Web 端「项目及设备管理-空调与房间关系」的绑定面板；建筑物结构由 Web 端预先建好，
   小程序只消费既有结构做现场绑定，不提供楼栋/楼层/房间的新增编辑。
   单页内部两步状态机（this._step）：
   ① 'room' 选点（进入默认）：楼栋→楼层→房间三级折叠树（数据源 MP.acRoom.buildings()，含尚无任何设备的空房间，
      与只列已有绑定的 MP.acRoom.rooms() 不同），逐级下钻，房间行显示「已绑 N 台」；点房间行 → 记录房间进入 ②。
   ② 'devices' 多选绑定（可重复停留）：顶部房间路径条（楼栋 › 楼层 › 房间）+「更换房间」回 ①；
      SN 尾号搜索框 +「全部 / 按控制器分组」二态切换（分组按 controllers[].deviceIds 反查，空组不显示，
      两者可叠加生效）；设备行为圆形 mp-check 多选；底部摘要条「已选 N 台 → 房间名」+「确认绑定」。
      确认后 MP.acRoom.bind 持久化 → toast → 清空勾选但停留本页、房间不变，刚绑的设备实时移出未绑定池，
      可继续绑下一批；搜索框右侧「完成」退出整个流程回 ac-room 列表页。
   注：步骤切换与列表刷新都在页内自行重渲，壳的 mount 只在首次 render 后调用一次，
   因此事件绑定全部随各步骤的渲染函数就地完成，mount 不承担绑定职责。 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['ac-room-bind']={
  title:'绑定空调',
  note:[
    {type:'新增',text:'楼栋/楼层/房间三级下钻选点，可绑到尚无任何设备的空房间'},
    {type:'新增',text:'现场连续绑定流：确认后停留在当前房间继续绑下一批，无需退出重进'},
    {type:'优化',text:'未绑定空调支持 SN 尾号搜索与按控制器分组，现场逐台核对更快'},
    {type:'删减',text:'取消现场手输新建房间，房间结构统一由 Web 端维护，避免现场造出重名房间'},
  ],

  SEGS:[['all','全部'],['ctl','按控制器分组']],

  /* 房间显示名 = 楼层名+房间名（与 data.js buildings 注册表、device.room 扁平字符串拼接规则一致） */
  _full(f,r){ return f.name+r.name; },
  /* 某房间当前已绑设备数（0 台也照常显示，仅为数量提示，与列表页「未绑定设备」分组语义无关） */
  _bound(full){ return MP.data.devices.filter(d=>MP.acRoom.roomOf(d)===full).length; },
  /* 未绑定设备池：roomOf 为空 + 命中 SN 尾号搜索词 */
  _pool(){
    const kw=(this._kw||'').trim().toLowerCase();
    return MP.data.devices.filter(d=>{
      if(MP.acRoom.roomOf(d))return false;
      return !kw||MP.acRoom.snOf(d).toLowerCase().indexOf(kw)>=0;
    });
  },
  /* 当前房间面包屑：楼栋 › 楼层 › 房间；注册表反查不到时静默降级为房间名本身
     （房间短名由「显示名 = 楼层名+房间名」契约反推截取） */
  _path(){
    const loc=MP.acRoom.locate(this._room);
    return loc?loc.building.name+' › '+loc.floor.name+' › '+this._room.slice(loc.floor.name.length)
              :this._room;
  },

  render(el){
    this._step='room';      /* 'room' 房间选点 / 'devices' 设备多选绑定 */
    this._room='';          /* 已选房间显示名（楼层名+房间名） */
    this._sel=new Set();    /* 勾选待绑设备 id */
    this._kw='';            /* SN 尾号搜索词 */
    this._seg='all';        /* 'all' 平铺 / 'ctl' 按控制器分组 */
    this._open=new Set();   /* 三级树展开态（楼栋/楼层 id）：进入默认全部折叠，逐级下钻 */
    this._renderStep(el);
  },

  /* 步骤切换总入口：两步页面结构差异大，整页重渲不做局部复用 */
  _renderStep(el){
    if(this._step==='room')this._renderRoomStep(el); else this._renderDevStep(el);
  },

  /* ── Step ① 房间选点 ── */
  _renderRoomStep(el){
    el.innerHTML='<div class="mp-sec">选择目标房间（楼栋 / 楼层 / 房间逐级展开）</div>'
      +'<div id="bdTree"></div>';
    this._refreshTree(el);
  },

  /* 三级折叠树重渲：楼栋行/楼层行点击折叠展开，房间行点击进入 Step ② */
  _refreshTree(el){
    const self=this, box=el.querySelector('#bdTree');
    const bs=MP.acRoom.buildings()||[];
    if(!bs.length){
      box.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('home')+'</div>'
        +'<div class="tx">暂无楼栋结构<br>请先在 Web 端建立楼栋/楼层/房间</div></div>';
      return;
    }
    box.innerHTML='<div class="mp-list mp-arb-tree">'+bs.map(b=>{
      const bOpen=self._open.has(b.id);
      const nRoom=b.floors.reduce((n,f)=>n+f.rooms.length,0);
      let s='<div class="mp-arb-row lv1" data-open="'+b.id+'">'
        +'<span class="mp-ar-arrow'+(bOpen?'':' off')+'"></span>'
        +'<div class="bd">'+b.name+'</div>'
        +'<span class="mp-sub">'+nRoom+' 个房间</span>'
      +'</div>';
      if(!bOpen)return s;
      return s+b.floors.map(f=>{
        const fOpen=self._open.has(f.id);
        let t='<div class="mp-arb-row lv2" data-open="'+f.id+'">'
          +'<span class="mp-ar-arrow'+(fOpen?'':' off')+'"></span>'
          +'<div class="bd">'+f.name+'</div>'
          +'<span class="mp-sub">'+f.rooms.length+' 个房间</span>'
        +'</div>';
        if(!fOpen)return t;
        return t+f.rooms.map(r=>{
          const full=self._full(f,r);
          return '<div class="mp-arb-row lv3" data-room="'+full+'">'
            +'<div class="bd">'+r.name+'</div>'
            +'<span class="mp-sub">已绑 '+self._bound(full)+' 台</span>'
            +'<span class="arrow"></span>'
          +'</div>';
        }).join('');
      }).join('');
    }).join('')+'</div>';

    /* 楼栋/楼层行：折叠展开 */
    box.querySelectorAll('[data-open]').forEach(row=>row.onclick=()=>{
      const k=row.dataset.open;
      if(self._open.has(k))self._open.delete(k); else self._open.add(k);
      self._refreshTree(el);
    });
    /* 房间行：选中该房间 → 进入设备多选步骤（每次换房间重置勾选/搜索/分组态） */
    box.querySelectorAll('[data-room]').forEach(row=>row.onclick=()=>{
      self._room=row.dataset.room;
      self._sel.clear(); self._kw=''; self._seg='all';
      self._step='devices';
      self._renderStep(el);
    });
  },

  /* ── Step ② 设备多选绑定 ── */
  _renderDevStep(el){
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        /* 1. 当前房间路径条 + 更换房间 */
        +'<div class="mp-card mp-arb-path">'
          +'<div class="bd"><div class="lab">当前绑定房间</div><div class="pt">'+this._path()+'</div></div>'
          +'<span class="mp-arb-chg" id="btnChg">更换房间</span>'
        +'</div>'
        /* 2. SN 尾号搜索 + 完成（退出整个绑定流程；导航栏右槽已被改造说明按钮占用，故置于此处） */
        +'<div class="mp-dev-top">'
          +'<div class="mp-dev-search"><span class="ic">'+MP.icon('search','sm')+'</span>'
            +'<input id="snKw" placeholder="输入 SN 尾号搜索"></div>'
          +'<span class="mp-dev-batch-btn" id="btnDone">完成</span>'
        +'</div>'
        /* 3. 全部 / 按控制器分组 */
        +'<div class="mp-seg mp-arb-seg" id="arbSeg">'
          +this.SEGS.map(s=>'<div class="mp-seg-i'+(s[0]===this._seg?' on':'')+'" data-k="'+s[0]+'">'+s[1]+'</div>').join('')
        +'</div>'
        /* 4. 未绑定设备多选区 */
        +'<div id="devBox"></div>'
      +'</div>'
      /* 5. 底部摘要条（含「筛选外已选」警示与一键清空，见 _syncFoot） */
      +'<div class="mp-footer mp-arb-foot">'
        +'<div class="sum"><span class="tx" id="sumTx"></span><span class="clr" id="btnClr">清空</span></div>'
        +'<button class="mp-btn mp-btn-primary mp-btn-block" id="btnOk">确认绑定</button>'
      +'</div>'
    +'</div>';
    this._refreshDevs(el);
    this._bindDevStep(el);
  },

  /* 单个未绑定设备行：圆形 mp-check 多选 + 设备名/SN + 在线离线 tag */
  _devRow(d){
    return '<div class="mp-sch-tgt" data-did="'+d.id+'">'
      +'<span class="mp-check'+(this._sel.has(d.id)?' on':'')+'"></span>'
      +'<div class="bd">'+d.name+'<div class="t2">'+MP.acRoom.snOf(d)+'</div></div>'
      +'<span class="mp-tag '+(d.online?'tag-ok">在线':'tag-info">离线')+'</span>'
    +'</div>';
  },
  /* 控制器分组块：小标题（控制器名 + 组内待绑台数）+ 组内设备行 */
  _grpHTML(name,ds){
    return '<div class="mp-list">'
      +'<div class="mp-arb-gh">'+name+'<span class="mp-sub">'+ds.length+' 台待绑</span></div>'
      +ds.map(d=>this._devRow(d)).join('')
    +'</div>';
  },
  /* 按控制器分组：遍历 controllers 用 deviceIds 反查组内未绑定设备，只渲染非空组；
     无归属控制器的剩余设备归入「未分组」 */
  _ctlHTML(pool){
    const used={}, blocks=[];
    (MP.data.controllers||[]).forEach(c=>{
      const ds=pool.filter(d=>(c.deviceIds||[]).indexOf(d.id)>=0);
      ds.forEach(d=>{ used[d.id]=1; });
      if(ds.length)blocks.push(this._grpHTML(c.name,ds));
    },this);
    const rest=pool.filter(d=>!used[d.id]);
    if(rest.length)blocks.push(this._grpHTML('未分组',rest));
    return blocks.join('');
  },

  /* 未绑定设备区局部重渲（搜索输入/分组切换/确认绑定后调用，不整页重渲以保留搜索框焦点） */
  _refreshDevs(el){
    const self=this, box=el.querySelector('#devBox');
    const pool=this._pool();
    if(!pool.length){
      const all=MP.data.devices.filter(d=>!MP.acRoom.roomOf(d));
      box.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('device')+'</div><div class="tx">'
        +(all.length?'无匹配该 SN 尾号的未绑定空调'
                    :'暂无未绑定空调<br>可点击上方「更换房间」继续，或点「完成」退出')
        +'</div></div>';
      this._syncFoot(el);
      return;
    }
    box.innerHTML=this._seg==='ctl'
      ? this._ctlHTML(pool)
      : '<div class="mp-list">'+pool.map(d=>this._devRow(d)).join('')+'</div>';
    /* 点击行切换选中态：仅切勾选圆标 class + 刷新摘要，不整区重渲 */
    box.querySelectorAll('.mp-sch-tgt').forEach(it=>it.onclick=()=>{
      const id=it.dataset.did;
      if(self._sel.has(id))self._sel.delete(id); else self._sel.add(id);
      it.querySelector('.mp-check').classList.toggle('on',self._sel.has(id));
      self._syncFoot(el);
    });
    this._syncFoot(el);
  },

  /* 当前搜索/分组筛选之外的已选台数（即屏幕上看不见、但会被一并绑走的勾选）：
     勾选态刻意跨搜索保留——现场动线就是「搜一台 SN 尾号勾一台、清空搜索词再搜下一台」，
     逐字符触发的 oninput 若清空勾选会直接毁掉该动线；因此不清空，改为把隐藏勾选显性化并加确认闸门 */
  _selOut(){
    const vis=this._pool().filter(d=>this._sel.has(d.id)).length;
    return this._sel.size-vis;
  },

  /* 底部摘要条：「已选 N 台（其中 M 台不在当前筛选内）→ 房间名」+ 一键清空；
     N=0 时整条保留、按钮置灰但仍可点（点击给 toast 提示），清空钮隐藏 */
  _syncFoot(el){
    const n=this._sel.size, out=this._selOut();
    el.querySelector('#sumTx').innerHTML='已选 <b>'+n+'</b> 台'
      +(out?'<span class="out">（其中 '+out+' 台不在当前筛选内）</span>':'')
      +' → '+this._room;
    el.querySelector('#btnClr').style.display=n?'':'none';
    el.querySelector('#btnOk').classList.toggle('dim',n===0);
  },

  /* 真正落绑：持久化 → 清空勾选 → toast → 停留本页重渲（刚绑的设备自动移出待绑池） */
  _doBind(el){
    const n=this._sel.size;
    MP.acRoom.bind(Array.from(this._sel),this._room);
    this._sel.clear();
    MP.ui.toast('已绑定 '+n+' 台到「'+this._room+'」','ok');
    this._refreshDevs(el);
  },

  _bindDevStep(el){
    const self=this;
    /* 更换房间：回选点树；展开态不跨步骤保留，重新逐级下钻（可接受的简化），并清空本轮勾选 */
    el.querySelector('#btnChg').onclick=()=>{
      self._step='room'; self._open=new Set(); self._sel.clear();
      self._renderStep(el);
    };
    /* 完成：退出整个绑定流程回 ac-room 列表页（该页实时反映本次全部新绑定） */
    el.querySelector('#btnDone').onclick=()=>MP.back();
    el.querySelector('#snKw').oninput=e=>{ self._kw=e.target.value; self._refreshDevs(el); };
    el.querySelectorAll('#arbSeg .mp-seg-i').forEach(i=>i.onclick=()=>{
      if(self._seg===i.dataset.k)return;
      self._seg=i.dataset.k;
      el.querySelectorAll('#arbSeg .mp-seg-i').forEach(x=>x.classList.toggle('on',x.dataset.k===self._seg));
      self._refreshDevs(el);
    });
    /* 一键清空勾选：搜索/分组切换后发现有筛选外的残留勾选时，一步重来 */
    el.querySelector('#btnClr').onclick=()=>{ self._sel.clear(); self._refreshDevs(el); };
    /* 确认绑定：校验 → （存在筛选外勾选时先二次确认）→ 落绑 → 停留本页继续绑下一批 */
    el.querySelector('#btnOk').onclick=()=>{
      const n=self._sel.size;
      if(!n){ MP.ui.toast('请至少勾选 1 台空调','er'); return; }
      const out=self._selOut();
      if(out){
        /* 存在当前筛选看不见的勾选 → 硬闸门：现场绑错的代价高，不允许静默绑走屏幕外设备 */
        MP.ui.confirm({title:'确认绑定',
          text:'本次将绑定 '+n+' 台，其中 '+out+' 台不在当前筛选结果内（屏幕上看不到）。确认全部绑定到「'+self._room+'」？',
          okText:'全部绑定'},()=>self._doBind(el));
        return;
      }
      self._doBind(el);
    };
  },

  /* 事件绑定随各步骤渲染函数就地完成（步骤切换时壳不会再次调用 mount），此处无需处理 */
  mount(){},
};
