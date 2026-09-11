/* 电费查询·租户台账列表（MP.pages['elec-tenant-list']，二级页；R6 新增）：管理员多租户账单/余额台账视角
   （原 mp/pages/elec-tenant.js 为租户第一人称视角，R6 改造为管理员查看名下全部租户，原页面已删除）。
   自上而下：搜索框（租户名称/房间）+ 状态筛选 chips（全部/异常/正常）→ 租户列表：
     prepaid 租户右侧显示 ¥余额 + 充足/不足 tag；postpaid 租户显示最新账单金额 + 已缴/欠费/未出账 tag（无账单显示 --）。
   异常判定：prepaid 余额<=提醒阈值 → 异常；postpaid 最新账单 status==='欠费' → 异常；其余（含无账单）→ 正常。
   点击行 → elec-tenant-detail 只读详情。权限：仅物业管理员可见（本页为直接 hash 可达入口，复用 elec-admin 的 _deny 兜底）。 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['elec-tenant-list']={
  title:'租户台账',
  note:[
    {type:'新增',text:'管理员多租户台账视角（原 elec-tenant 租户自视角改造）'},
    {type:'优化',text:'搜索+状态筛选快速定位租户'},
  ],

  CHIPS:[['all','全部'],['abnormal','异常'],['normal','正常']],
  STATUS_TAG:{'已缴':'tag-ok','欠费':'tag-er','未出账':'tag-info'},

  _pid(){
    let pid=MP.state.get('projectId');
    if(!pid){ pid='p1'; MP.state.set('projectId','p1'); }
    return pid;
  },

  /* 异常判定：prepaid 余额<=提醒阈值；postpaid 最新账单欠费；其余（含无账单）为正常 */
  _abnormal(t){
    if(t.feeMode==='prepaid')return t.balance<=t.remind;
    const bills=MP.q.tenantBills(t.id);
    return bills.length>0 && bills[0].status==='欠费';
  },

  _match(t,kw){
    if(!kw)return true;
    kw=kw.toLowerCase();
    return t.name.toLowerCase().indexOf(kw)>=0 || t.room.toLowerCase().indexOf(kw)>=0;
  },

  _list(){
    const kw=(this._kw||'').trim();
    return MP.q.tenants(this._pid()).filter(t=>{
      if(!this._match(t,kw))return false;
      if(this._filter==='abnormal')return this._abnormal(t);
      if(this._filter==='normal')return !this._abnormal(t);
      return true;
    });
  },

  /* 右侧状态列：prepaid=余额+充足/不足；postpaid=最新账单金额+状态（无账单 -- + 暂无账单） */
  _statCol(t){
    if(t.feeMode==='prepaid'){
      const ok=t.balance>t.remind;
      return '<div class="amt">¥'+t.balance.toFixed(2)+'</div>'
        +'<span class="mp-tag '+(ok?'tag-ok':'tag-wn')+'">'+(ok?'充足':'不足')+'</span>';
    }
    const bills=MP.q.tenantBills(t.id);
    if(!bills.length)return '<div class="amt">--</div><span class="mp-tag tag-info">暂无账单</span>';
    const b=bills[0];
    return '<div class="amt">¥'+b.amount.toFixed(2)+'</div>'
      +'<span class="mp-tag '+(this.STATUS_TAG[b.status]||'tag-info')+'">'+b.status+'</span>';
  },

  _rowHTML(t){
    return '<div class="mp-item" data-id="'+t.id+'"><div class="bd">'
      +'<div class="t1">'+t.name+'</div>'
      +'<div class="t2">'+t.room+'</div>'
      +'</div><div class="mp-bill-r">'+this._statCol(t)+'</div></div>';
  },

  /* 列表区局部重渲（搜索输入/筛选切换时调用，不整页重渲以保留输入焦点） */
  _renderList(el){
    const all=MP.q.tenants(this._pid());
    const list=this._list();
    el.querySelector('#tnList').innerHTML=list.length
      ? '<div class="mp-list">'+list.map(t=>this._rowHTML(t)).join('')+'</div>'
      : (all.length
        ? '<div class="mp-empty"><div class="ic">'+MP.icon('bill')+'</div><div class="tx">暂无符合条件的租户</div></div>'
        : '<div class="mp-empty"><div class="ic">'+MP.icon('bill')+'</div><div class="tx">该项目暂无租户台账数据</div></div>');
    this._bindRows(el);
  },

  _bindRows(el){
    el.querySelectorAll('#tnList .mp-item').forEach(row=>row.onclick=()=>{
      MP.go('elec-tenant-detail',{id:row.dataset.id});
    });
  },

  render(el){
    const role=MP.state.get('role')||'admin';
    this._deny=role!=='admin';
    if(this._deny){ el.innerHTML=''; return; }   /* 无权限时不渲染内容，mount 中 toast+back */
    this._kw=''; this._filter='all';
    el.innerHTML=
      /* 1. 搜索框 */
      '<div class="mp-dev-top">'
        +'<div class="mp-dev-search"><span class="ic">'+MP.icon('search','sm')+'</span><input id="tnKw" placeholder="搜索租户名称/房间"></div>'
      +'</div>'
      /* 2. 状态筛选 chips */
      +'<div class="mp-dev-chips" id="tnChips">'+this.CHIPS.map(c=>'<span class="mp-chip'+(c[0]===this._filter?' on':'')+'" data-f="'+c[0]+'">'+c[1]+'</span>').join('')+'</div>'
      /* 3. 租户列表 */
      +'<div id="tnList"></div>';
    this._renderList(el);
  },

  mount(el){
    if(this._deny){
      MP.ui.toast('当前角色无权限查看','er');
      /* 栈底直达（hash 进入）时 back 为 no-op，兜底回首页 Tab */
      if(MP.stack.length<=1)MP.switchTab('home'); else MP.back();
      return;
    }
    const self=this;
    el.querySelector('#tnKw').oninput=(e)=>{ self._kw=e.target.value; self._renderList(el); };
    el.querySelectorAll('#tnChips .mp-chip').forEach(c=>c.onclick=()=>{
      if(self._filter===c.dataset.f)return;
      self._filter=c.dataset.f;
      el.querySelectorAll('#tnChips .mp-chip').forEach(x=>x.classList.toggle('on',x.dataset.f===self._filter));
      self._renderList(el);
    });
  },
};
