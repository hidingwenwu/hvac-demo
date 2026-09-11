/* 控制器（MP.pages['controller']，二级页）：对应 Web 端「项目及设备管理-控制器」pages/device-controller.html
   控制器卡列表：名称 + SN + 品牌 tag（海尔蓝 / 格力绿 / 美的橙）+ 在线绿/离线灰 tag
   + 接控空调数 + 固件版本 + 信号强度（强/中/弱 图标化 ●●●/●●○/●○○，离线显示「--」）
   离线卡顶部黄条提示「控制器离线，数据可能不是最新」；点击卡片展开/收起详情区
   （只读参数 mock：心跳间隔 60s / 上报周期 300s / 重连次数）
   移动端不做 Web 端的参数下发编辑（见 note 删减说明） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['controller']={
  title:'控制器',
  note:[
    {type:'优化',text:'Web 表格改为卡片流，台账信息一屏尽览'},
    {type:'新增',text:'点击卡片展开只读运行参数（心跳/上报/重连），现场排障速查'},
    {type:'删减',text:'Web 端参数下发与编辑能力移动端不提供，仅只读查看'},
  ],

  /* 品牌 tag 配色：海尔蓝 tag-primary / 格力绿 tag-ok / 美的橙 tag-wn，其余灰 */
  _brandTag(b){
    const cls={'海尔':'tag-primary','格力':'tag-ok','美的':'tag-wn'}[b]||'tag-info';
    return '<span class="mp-tag '+cls+'">'+b+'</span>';
  },
  /* 信号强度图标化：强 ●●● / 中 ●●○ / 弱 ●○○（实心圆主色，空心圆灰）；离线「--」 */
  _signal(c){
    if(!c.online||c.signal==='--')return '<span class="mp-muted">--</span>';
    const n={'强':3,'中':2,'弱':1}[c.signal]||0;
    let dots='';
    for(let i=0;i<3;i++)dots+='<span class="mp-sig'+(i<n?' on':'')+'">●</span>';
    return '<span class="mp-sig-w">'+dots+'</span><span class="mp-sub"> '+c.signal+'</span>';
  },

  render(el){
    this._open=new Set();   /* 展开态：进入页面默认全部收起 */
    el.innerHTML='<div id="ctlBox"></div>';
    this._refresh(el);
  },

  _refresh(el){
    const self=this, box=el.querySelector('#ctlBox');
    const list=MP.data.controllers;
    if(!list.length){
      box.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('controller')+'</div><div class="tx">暂无控制器</div></div>';
      return;
    }
    box.innerHTML=list.map(c=>{
      const open=self._open.has(c.id);
      const detail=open
        ? '<div class="mp-ctl-detail">'
            +'<div class="kv"><span class="k">心跳间隔</span><span class="v">60s</span></div>'
            +'<div class="kv"><span class="k">上报周期</span><span class="v">300s</span></div>'
            +'<div class="kv"><span class="k">重连次数</span><span class="v">'+(c.online?0:12)+' 次</span></div>'
            +'<div class="kv-tip">运行参数为只读演示数据，参数下发请在 Web 端操作</div>'
          +'</div>'
        : '';
      return '<div class="mp-ctl-card'+(c.online?'':' off')+'" data-cid="'+c.id+'">'
        +(c.online?'':'<div class="mp-ctl-offbar">控制器离线，数据可能不是最新</div>')
        +'<div class="hd">'
          +'<div class="bd">'
            +'<div class="t1">'+c.name+' '
              +'<span class="mp-tag '+(c.online?'tag-ok">在线':'tag-info">离线')+'</span>'
            +'</div>'
            +'<div class="t2">SN：'+c.sn+'</div>'
          +'</div>'
          +'<span class="mp-ar-arrow'+(open?'':' off')+'"></span>'
        +'</div>'
        +'<div class="mp-ctl-grid">'
          +'<div class="gi"><div class="gv">'+this._brandTag(c.brand)+'</div><div class="gl">品牌</div></div>'
          +'<div class="gi"><div class="gv">'+c.acCount+' 台</div><div class="gl">接控空调</div></div>'
          +'<div class="gi"><div class="gv">'+c.version+'</div><div class="gl">固件版本</div></div>'
          +'<div class="gi"><div class="gv">'+this._signal(c)+'</div><div class="gl">信号强度</div></div>'
        +'</div>'
        +detail
      +'</div>';
    }).join('');

    /* 点击卡片：展开/收起详情区 */
    box.querySelectorAll('.mp-ctl-card').forEach(card=>card.onclick=()=>{
      const id=card.dataset.cid;
      if(self._open.has(id))self._open.delete(id); else self._open.add(id);
      self._refresh(el);
    });
  },

  mount(){},
};
