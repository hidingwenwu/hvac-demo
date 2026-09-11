/* 群组列表（MP.pages.group-list，二级页）：对应 Web 端「集中控制-群组控制」pages/ctrl-group.html 左侧群组卡片区
   群组卡：群名 + 设备数 + 运行中数（按 MP.data.devices 实时计算）+ 在线率进度条
   删除交互：长按卡片 → ActionSheet（删除/取消）→ confirm 二次确认 → saveGroups 持久化
   （移动端无左滑，长按 + ActionSheet 为列表页统一删除惯例，后续 schedule/strategy 列表沿用） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['group-list']={
  title:'群组管理',
  note:[
    {type:'优化',text:'Web 卡片网格改为纵向卡片流，适配触屏浏览'},
    {type:'新增',text:'卡片实时显示运行中数与在线率进度条'},
    {type:'优化',text:'删除改为长按卡片 + ActionSheet + 二次确认'},
  ],

  _members(g){ return g.deviceIds.map(id=>MP.data.devices.find(d=>d.id===id)).filter(Boolean); },

  _cardHTML(g){
    const ms=this._members(g);
    const total=ms.length,
          online=ms.filter(d=>d.online).length,
          running=ms.filter(d=>d.online&&d.power).length,
          rate=total?Math.round(online/total*100):0;
    return '<div class="mp-card mp-grp-card" data-id="'+g.id+'">'
      +'<div class="g-t1">'+g.name+'<span class="cnt">共 '+total+' 台</span></div>'
      +'<div class="g-sub">运行中 <b>'+running+'</b> 台 · 在线 '+online+' 台</div>'
      +'<div class="g-rate"><div class="bar"><div class="in" style="width:'+rate+'%"></div></div><span class="pct">在线率 '+rate+'%</span></div>'
    +'</div>';
  },

  render(el){
    this._lp=false;   /* 长按抑制标记：长按触发后抑制紧随其后的合成 click，避免误进详情 */
    const list=MP.q.groups();
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow" id="grpList">'
      +(list.length
        ? list.map(g=>this._cardHTML(g)).join('')
        : '<div class="mp-empty"><div class="ic">'+MP.icon('group')+'</div><div class="tx">暂无群组，点击下方按钮新增</div></div>')
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnAdd">+ 新增群组</button></div>'
    +'</div>';
  },

  mount(el){
    const self=this;
    el.querySelector('#btnAdd').onclick=()=>MP.go('group-form',{});
    el.querySelectorAll('#grpList .mp-grp-card').forEach(card=>{
      const id=card.dataset.id;
      card.onclick=()=>{
        if(self._lp){ self._lp=false; return; }
        MP.go('group-detail',{id:id});
      };
      /* 长按 500ms 触发删除 ActionSheet（touch + mouse 双通道，兼容桌面浏览器演示） */
      let timer=null;
      const start=()=>{ timer=setTimeout(()=>{
        self._lp=true;
        setTimeout(()=>{ self._lp=false; },800);   /* 兜底：长按后未产生 click 时自动复位 */
        self._del(el,id);
      },500); };
      const cancel=()=>{ if(timer){ clearTimeout(timer); timer=null; } };
      card.addEventListener('touchstart',start,{passive:true});
      card.addEventListener('touchend',cancel);
      card.addEventListener('touchmove',cancel);
      card.addEventListener('mousedown',start);
      card.addEventListener('mouseup',cancel);
      card.addEventListener('mouseleave',cancel);
      card.addEventListener('contextmenu',e=>e.preventDefault());
    });
  },

  /* 删除：ActionSheet → confirm 二次确认（红色删除钮）→ saveGroups 覆盖层持久化 → 重渲染 */
  _del(el,id){
    const g=MP.q.groups().find(x=>x.id===id);
    if(!g)return;
    MP.ui.sheet({title:'群组「'+g.name+'」',actions:[{key:'del',label:'删除群组',danger:true}]},k=>{
      if(k!=='del')return;
      MP.ui.confirm({title:'删除群组',text:'确定删除群组「'+g.name+'」吗？',okText:'删除',danger:true},()=>{
        MP.q.saveGroups(MP.q.groups().filter(x=>x.id!==id));
        MP.renderFrame();
        MP.ui.toast('已删除','ok');
      });
    });
  },
};
