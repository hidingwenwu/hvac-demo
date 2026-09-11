/* 电费查询·物业管理员（MP.pages['elec-admin']，二级页）：对应 Web 端「电费相关-电费查询」（pages/elec-query.html），
   小程序端简化为月份账单视图——月份切换横条（‹ 2026-08 ›，左右切月过滤 bills，范围近 3 个月）
   → 汇总卡 3 数字（本月总电费/已缴/欠费，按 status 分）→「查看租户台账」入口（跳 elec-tenant-list）
   → 租户账单列表（租户名/用量 kWh/金额/状态 tag；行按 tenantId 可点击跳 elec-tenant-detail 只读详情，
     缺 tenantId 时不响应点击避免死链——R6 新增下钻入口，此前账单行不可点）。
   权限：仅物业管理员可见，非 admin 角色进入时 toast 并返回（入口按角色路由，此处为直接 hash 进入的兜底）。
   数据读 MP.data.bills（演示数据只含 2026-08/2026-07，切到 2026-06 演示空态）。 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['elec-admin']={
  title:'电费账单',
  note:[
    {type:'简化',text:'Web 端多维度电费报表简化为月份账单列表'},
    {type:'优化',text:'月份切换+汇总卡适配移动端查看'},
    {type:'新增',text:'新增「查看租户台账」入口与账单行点击下钻至租户详情（R6）'},
  ],

  CUR:'2026-08',          /* 当前账期（演示基准月） */
  SPAN:3,                 /* 可回看月数（近 3 个月） */
  STATUS_TAG:{'已缴':'tag-ok','欠费':'tag-er','未出账':'tag-info'},

  /* 月份偏移：'2026-08' + (-1) → '2026-07' */
  _shift(month,delta){
    const p=month.split('-'); let y=+p[0], m=+p[1]+delta;
    while(m<1){m+=12;y--;} while(m>12){m-=12;y++;}
    return y+'-'+(m<10?'0':'')+m;
  },

  /* 列表区+汇总卡按当前月份重渲染（月份切换时只更新这两块） */
  _renderMonth(el){
    const month=this._month;
    const list=MP.data.bills.filter(b=>b.month===month);
    const sum=a=>a.reduce((t,b)=>t+b.amount,0);
    const paid=sum(list.filter(b=>b.status==='已缴'));
    const debt=sum(list.filter(b=>b.status==='欠费'));
    el.querySelector('#billMonth').textContent=month;
    /* 边界月份箭头置灰：右不超过当前账期，左不超过 SPAN-1 个月 */
    el.querySelector('#billPrev').classList.toggle('dis',month===this._shift(this.CUR,-(this.SPAN-1)));
    el.querySelector('#billNext').classList.toggle('dis',month===this.CUR);
    el.querySelector('#billSum').innerHTML=
        '<div class="si"><div class="sv">¥'+sum(list).toFixed(2)+'</div><div class="sl">本月总电费</div></div>'
      +'<div class="si"><div class="sv ok">¥'+paid.toFixed(2)+'</div><div class="sl">已缴</div></div>'
      +'<div class="si"><div class="sv er">¥'+debt.toFixed(2)+'</div><div class="sl">欠费</div></div>';
    el.querySelector('#billList').innerHTML=list.length
      ? '<div class="mp-list">'+list.map(b=>{
          const tid=(b.tenantId&&MP.q.tenant(b.tenantId))?b.tenantId:'';   /* 缺 tenantId/查无租户 → 不可点，避免死链 */
          return '<div class="mp-item'+(tid?'':' ro')+'"'+(tid?' data-tid="'+tid+'"':'')+'><div class="bd">'
            +'<div class="t1">'+b.tenant+'</div>'
            +'<div class="t2">用量 '+b.usage+' kWh</div>'
          +'</div><div class="mp-bill-r">'
            +'<div class="amt">¥'+b.amount.toFixed(2)+'</div>'
            +'<span class="mp-tag '+(this.STATUS_TAG[b.status]||'tag-info')+'">'+b.status+'</span>'
          +'</div></div>';
        }).join('')+'</div>'
        +'<div class="mp-elec-hint">仅演示近 '+this.SPAN+' 个月数据</div>'
      : '<div class="mp-empty"><div class="ic">'+MP.icon('bill')+'</div><div class="tx">'+month+' 暂无账单数据</div></div>';
    /* 账单行点击下钻至租户详情（R6 新增） */
    el.querySelectorAll('#billList .mp-item[data-tid]').forEach(row=>row.onclick=()=>{
      const t=MP.q.tenant(row.dataset.tid);
      if(t)MP.go('elec-tenant-detail',{id:t.id});
    });
  },

  render(el){
    const role=MP.state.get('role')||'admin';
    this._deny=role!=='admin';
    if(this._deny){ el.innerHTML=''; return; }   /* 无权限时不渲染内容，mount 中 toast+back */
    this._month=this.CUR;
    el.innerHTML=
      /* 1. 月份切换横条 */
      '<div class="mp-elec-month">'
        +'<span class="arr" id="billPrev">‹</span>'
        +'<span class="mo" id="billMonth"></span>'
        +'<span class="arr" id="billNext">›</span>'
      +'</div>'
      /* 2. 汇总卡：本月总电费 / 已缴 / 欠费 */
      +'<div class="mp-card"><div class="mp-elec-sum" id="billSum"></div></div>'
      /* 2.5 租户台账入口：管理员多租户查看视角（R6 新增） */
      +'<div class="mp-elec-linkrow" id="toTenantList">查看租户台账<span class="arr">›</span></div>'
      /* 3. 租户账单列表（含底部演示范围说明） */
      +'<div id="billList"></div>';
    this._renderMonth(el);
  },

  mount(el){
    if(this._deny){
      MP.ui.toast('当前角色无权限查看','er');
      /* 栈底直达（hash 进入）时 back 为 no-op，兜底回首页 Tab */
      if(MP.stack.length<=1)MP.switchTab('home'); else MP.back();
      return;
    }
    const self=this;
    el.querySelector('#toTenantList').onclick=()=>MP.go('elec-tenant-list');
    el.querySelector('#billPrev').onclick=()=>{
      const min=self._shift(self.CUR,-(self.SPAN-1));
      if(self._month===min)return;
      self._month=self._shift(self._month,-1);
      self._renderMonth(el);
    };
    el.querySelector('#billNext').onclick=()=>{
      if(self._month===self.CUR)return;
      self._month=self._shift(self._month,1);
      self._renderMonth(el);
    };
  },
};
