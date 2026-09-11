/* 租户账单详情·只读（MP.pages['elec-tenant-detail']，三级页；R6 新增）：管理员查看单一租户的账单/余额详情
   （原 mp/pages/elec-recharge.js 为租户自助充值页，管理员场景无需该操作，R6 改造为只读详情页，原页面已删除）。
   顶部：租户名 + 房间 + 计费方式 tag（预付费/后付费）。
   prepaid 分支：余额大字卡（复用原 elec-tenant 余额卡视觉，充足绿/不足橙）→ 不足时第三人称提醒条（管理员视角，
     不再是"请及时充值"的第一人称口吻，全页无任何充值按钮）→ 消费/充值记录 tab 列表
     （复用 .mp-tn-tabs/TYPE_IC/.mp-rc-amt，数据源 MP.q.tenant(id).records）。
   postpaid 分支：无余额卡，改为账单历史列表（复用 elec-admin 账单行视觉 .mp-item.ro+.mp-bill-r+STATUS_TAG），
     数据源 MP.q.tenantBills(id)（已按月份降序），一次性展示全部种子月份，不做月份切换。
   非法/不存在 id（直接 hash 进入）→ 未找到空态（参考 device-detail.js 处理模式）。
   权限：仅物业管理员可见（本页为直接 hash 可达的三级页，复用 elec-admin/elec-tenant-list 的 _deny 兜底，
     门禁先于租户查找生效——非 admin 角色不渲染任何内容，不消耗租户查询）。 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['elec-tenant-detail']={
  title:'租户详情',
  note:[
    {type:'新增',text:'租户账单/余额只读详情，支持预付费余额+记录、后付费账单历史两种视角'},
    {type:'简化',text:'管理员视角为只读查看，取消自助充值操作入口（该操作面向租户本人，超出管理员场景）'},
  ],

  TABS:[
    {key:'consume', label:'消费记录'},
    {key:'recharge',label:'充值记录'},
  ],
  TYPE_IC:{consume:'bill',recharge:'wallet'},   /* mp/icons.js 图标名 */
  STATUS_TAG:{'已缴':'tag-ok','欠费':'tag-er','未出账':'tag-info'},

  _tenant(params){ return MP.q.tenant(params&&params.id); },

  /* 消费/充值记录列表区：按当前 tab 过滤局部重渲 */
  _renderRecords(el,t){
    const tab=this._tab;
    const list=(t.records||[]).filter(r=>r.type===tab);
    el.querySelector('#rcList').innerHTML=list.length
      ? '<div class="mp-list">'+list.map(r=>
          '<div class="mp-item ro"><div class="ic">'+MP.icon(this.TYPE_IC[r.type])+'</div><div class="bd">'
            +'<div class="t1">'+r.desc+'</div>'
            +'<div class="t2">'+r.time+'</div>'
          +'</div><div class="mp-rc-amt '+(r.amount>=0?'plus':'minus')+'">'
            +(r.amount>=0?'+':'')+r.amount.toFixed(2)
          +'</div></div>').join('')+'</div>'
      : '<div class="mp-empty"><div class="ic">'+MP.icon(tab==='consume'?'bill':'wallet')+'</div>'
        +'<div class="tx">暂无'+(tab==='consume'?'消费':'充值')+'记录</div></div>';
    el.querySelectorAll('.mp-tn-tabs .mp-seg-i').forEach(i=>i.classList.toggle('on',i.dataset.k===tab));
  },

  render(el,params){
    const role=MP.state.get('role')||'admin';
    this._deny=role!=='admin';
    if(this._deny){ el.innerHTML=''; return; }   /* 无权限时不渲染内容，mount 中 toast+back */
    const t=this._tenant(params);
    if(!t){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('bill')+'</div><div class="tx">未找到该租户</div></div>';
      return;
    }
    this._id=t.id;
    const head='<div class="mp-card mp-tn-head">'
      +'<div class="nm">'+t.name+'<span class="mp-tag tag-primary">'+(t.feeMode==='prepaid'?'预付费':'后付费')+'</span></div>'
      +'<div class="room">'+t.room+'</div>'
    +'</div>';

    if(t.feeMode==='prepaid'){
      const enough=t.balance>t.remind;
      this._tab='consume';   /* 每次进入默认消费记录 tab */
      el.innerHTML=head
        /* 余额大字卡 */
        +'<div class="mp-card mp-tn-balance">'
          +'<div class="lab">当前余额（元）</div>'
          +'<div class="val '+(enough?'ok':'wn')+'">¥'+t.balance.toFixed(2)+'</div>'
          +'<span class="mp-tag '+(enough?'tag-ok':'tag-wn')+'">'+(enough?'余额充足':'余额不足')+'</span>'
        +'</div>'
        /* 余额不足提醒条：第三人称（管理员视角查看他人账户，无充值入口） */
        +(enough ? '' : '<div class="mp-tn-bar low">该租户余额低于提醒阈值 ¥'+t.remind.toFixed(0)+'，请及时提醒续费</div>')
        /* 消费/充值记录 tab */
        +'<div class="mp-seg mp-tn-tabs">'
          +this.TABS.map(tb=>'<div class="mp-seg-i" data-k="'+tb.key+'">'+tb.label+'</div>').join('')
        +'</div>'
        +'<div id="rcList"></div>';
      this._renderRecords(el,t);
      return;
    }

    /* postpaid：账单历史列表，一次性展示全部种子月份（已按月份降序），无月份切换 */
    const bills=MP.q.tenantBills(t.id);
    el.innerHTML=head
      +'<div class="mp-card"><div class="mp-card-t">账单历史</div>'
      +(bills.length
        ? '<div class="mp-list">'+bills.map(b=>
            '<div class="mp-item ro"><div class="bd">'
              +'<div class="t1">'+b.month+'</div>'
              +'<div class="t2">用量 '+b.usage+' kWh</div>'
            +'</div><div class="mp-bill-r">'
              +'<div class="amt">¥'+b.amount.toFixed(2)+'</div>'
              +'<span class="mp-tag '+(this.STATUS_TAG[b.status]||'tag-info')+'">'+b.status+'</span>'
            +'</div></div>').join('')+'</div>'
        : '<div class="mp-empty"><div class="ic">'+MP.icon('bill')+'</div><div class="tx">暂无账单数据</div></div>')
      +'</div>';
  },

  mount(el,params){
    if(this._deny){
      MP.ui.toast('当前角色无权限查看','er');
      /* 栈底直达（hash 进入）时 back 为 no-op，兜底回首页 Tab */
      if(MP.stack.length<=1)MP.switchTab('home'); else MP.back();
      return;
    }
    const t=this._tenant(params);
    if(!t)return;                       /* 未找到：render 已展示空态，无需绑定交互 */
    if(t.feeMode!=='prepaid')return;    /* postpaid 分支为纯静态列表，无交互元素 */
    const self=this;
    el.querySelectorAll('.mp-tn-tabs .mp-seg-i').forEach(i=>i.onclick=()=>{
      if(self._tab===i.dataset.k)return;
      self._tab=i.dataset.k;
      self._renderRecords(el,t);
    });
  },
};
