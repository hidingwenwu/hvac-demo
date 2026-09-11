/* 群组详情（MP.pages.group-detail，二级页）：群信息头 + 成员设备卡列表 + 底部固定批量控制栏
   成员设备卡复用 MP.devCard（device.js 抽出的共用渲染），卡片电源钮行为同 device 列表页
   批量控制目标为群内在线设备（离线不下发，对齐 device 页离线禁选），交互共用 MP.devBatchRun */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['group-detail']={
  title:'群组详情',
  note:[
    {type:'优化',text:'成员设备复用设备卡片，电源键一键开关机'},
    {type:'新增',text:'底部批量控制栏，对群内在线设备统一下发'},
  ],

  _grp(params){ return MP.q.groups().find(g=>g.id===(params&&params.id)); },
  _members(g){ return g.deviceIds.map(id=>MP.data.devices.find(d=>d.id===id)).filter(Boolean); },

  render(el,params){
    const g=this._grp(params);
    if(!g){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('group')+'</div><div class="tx">未找到该群组</div></div>';
      return;
    }
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        +'<div class="mp-card mp-grp-head">'
          +'<div class="g-name">'+g.name+'<span class="g-edit" id="btnEdit">编辑</span></div>'
          +'<div class="g-stats" id="gdStats"></div>'
        +'</div>'
        +'<div class="mp-sec">成员设备</div>'
        +'<div id="gdList"></div>'
      +'</div>'
      +'<div class="mp-batch-bar">'
        +'<div class="cnt" id="gdCnt"></div>'
        +'<div class="acts">'
          +'<span class="act" data-a="powerOn">开机</span>'
          +'<span class="act" data-a="powerOff">关机</span>'
          +'<span class="act" data-a="setMode">模式</span>'
          +'<span class="act" data-a="setTemp">温度</span>'
          +'<span class="act" data-a="setWind">风速</span>'
        +'</div>'
      +'</div>'
    +'</div>';
    this._refresh(el,params);
  },

  /* 局部刷新：头部统计 + 成员卡片 + 批量栏计数（电源切换 / 批量下发后调用） */
  _refresh(el,params){
    const g=this._grp(params);
    if(!g)return;
    const ms=this._members(g);
    const total=ms.length,
          online=ms.filter(d=>d.online).length,
          running=ms.filter(d=>d.online&&d.power).length;
    el.querySelector('#gdStats').innerHTML=
        '<div class="st"><div class="n">'+total+'</div><div class="t">设备数</div></div>'
      +'<div class="st"><div class="n ok">'+online+'</div><div class="t">在线</div></div>'
      +'<div class="st"><div class="n pri">'+running+'</div><div class="t">运行中</div></div>';
    el.querySelector('#gdList').innerHTML=ms.length
      ? ms.map(d=>MP.devCard(d,{layout:'row'})).join('')   /* 成员管理场景保持单列卡，不随 device 网格化 */
      : '<div class="mp-empty"><div class="ic">'+MP.icon('device')+'</div><div class="tx">群组内暂无设备</div></div>';
    el.querySelector('#gdCnt').textContent='批量控制对群内 '+online+' 台在线设备生效';
    this._bindList(el,params);
  },

  _bindList(el,params){
    const self=this;
    el.querySelectorAll('#gdList .mp-dev-card').forEach(card=>{
      card.onclick=()=>MP.go('device-detail',{id:card.dataset.id});
    });
    /* 卡片电源钮：即时切换开关机（仅内存演示），行为同 device 列表页 */
    el.querySelectorAll('#gdList .mp-pow').forEach(p=>p.onclick=e=>{
      e.stopPropagation();
      if(p.classList.contains('dis')){ MP.ui.toast('设备离线，无法控制'); return; }
      const d=MP.data.devices.find(x=>x.id===p.dataset.pow);
      if(!d)return;
      d.power=!d.power;
      self._refresh(el,params);
      MP.ui.toast(d.power?'已开机':'已关机','ok');
    });
  },

  mount(el,params){
    const self=this;
    const g=this._grp(params);
    if(!g)return;
    el.querySelector('#btnEdit').onclick=()=>MP.go('group-form',{id:g.id});
    /* 批量控制：目标为群内在线设备，动作集共用 MP.devBatchRun（ActionSheet 选参 → confirm → toast） */
    el.querySelectorAll('.mp-batch-bar .act').forEach(a=>a.onclick=()=>{
      const devs=self._members(self._grp(params)).filter(d=>d.online);
      MP.devBatchRun(a.dataset.a,devs,{emptyMsg:'群内无在线设备，无法控制'},()=>self._refresh(el,params));
    });
  },
};
