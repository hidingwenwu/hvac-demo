/* 日程列表（MP.pages['schedule-list']，二级页）：对应 Web 端「集中控制-日程管理」pages/ctrl-schedule.html 任务表格
   日程卡：左侧时间大字（HH:MM）+ 名称 + 重复星期 chips（一二三四五六日，选中主色；days 空=单次）+
   动作摘要（"开机·制冷 26°C → 三楼办公区"，关机则"关机 → 目标"）；右侧 .mp-switch 启停（切换即持久化）
   删除交互沿用群组列表惯例：长按卡片 → ActionSheet → confirm 二次确认 → saveSchedules 覆盖层持久化 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['schedule-list']={
  title:'日程管理',
  note:[
    {type:'优化',text:'Web 表格改为纵向日程卡流：时间大字 + 重复星期 chips + 动作摘要'},
    {type:'新增',text:'卡片右侧开关即时启停，无需进编辑页'},
    {type:'优化',text:'删除改为长按卡片 + ActionSheet + 二次确认'},
  ],

  WK:['一','二','三','四','五','六','日'],   /* days 约定：1=周一 … 7=周日 */
  MODE_TXT:{cool:'制冷',heat:'制热',fan:'送风',dry:'除湿'},

  /* 动作摘要："开机·制冷 26°C → 三楼办公区" / "关机 → 目标" */
  _summary(s){
    const act=s.action&&s.action.power
      ? '开机·'+this.MODE_TXT[s.action.mode]+' '+s.action.temp+'°C'
      : '关机';
    return act+' → '+(s.targetName||'');
  },

  _daysHTML(days){
    if(!days||!days.length)return '<div class="mp-sch-days"><span class="once">单次</span></div>';
    return '<div class="mp-sch-days">'
      +this.WK.map((w,i)=>'<span class="d'+(days.indexOf(i+1)>=0?' on':'')+'">'+w+'</span>').join('')
    +'</div>';
  },

  _cardHTML(s){
    return '<div class="mp-sch-card'+(s.enabled?'':' off')+'" data-id="'+s.id+'">'
      +'<div class="tm">'+s.time+'</div>'
      +'<div class="bd">'
        +'<div class="nm">'+s.name+'</div>'
        +this._daysHTML(s.days)
        +'<div class="sm">'+this._summary(s)+'</div>'
      +'</div>'
      +'<label class="mp-switch" data-sw="'+s.id+'"><input type="checkbox"'+(s.enabled?' checked':'')+'><span class="tk"></span></label>'
    +'</div>';
  },

  render(el){
    this._lp=false;   /* 长按抑制标记：长按触发后抑制紧随其后的合成 click，避免误进编辑 */
    const list=MP.q.schedules();
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow" id="schList">'
      +(list.length
        ? list.map(s=>this._cardHTML(s)).join('')
        : '<div class="mp-empty"><div class="ic">'+MP.icon('schedule')+'</div><div class="tx">暂无日程，点击下方按钮新增</div></div>')
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnAdd">+ 新增日程</button></div>'
    +'</div>';
  },

  mount(el){
    const self=this;
    el.querySelector('#btnAdd').onclick=()=>MP.go('schedule-form',{});
    /* 启停开关：切换即 saveSchedules 持久化 + toast；停用卡片降透明 */
    el.querySelectorAll('.mp-switch').forEach(sw=>{
      sw.onclick=e=>e.stopPropagation();   /* 开关点击不冒泡到卡片（避免误进编辑） */
      /* 开关上的 touchstart/mousedown 同样不冒泡：防长按开关误触卡片的长按删除 ActionSheet */
      sw.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
      sw.addEventListener('mousedown',e=>e.stopPropagation());
      sw.querySelector('input').onchange=e=>{
        const id=sw.dataset.sw, on=e.target.checked;
        const list=MP.q.schedules(), s=list.find(x=>x.id===id);
        if(s){ s.enabled=on; MP.q.saveSchedules(list); }
        sw.closest('.mp-sch-card').classList.toggle('off',!on);
        MP.ui.toast(on?'已启用':'已停用','ok');
      };
    });
    el.querySelectorAll('#schList .mp-sch-card').forEach(card=>{
      const id=card.dataset.id;
      card.onclick=()=>{
        if(self._lp){ self._lp=false; return; }
        MP.go('schedule-form',{id:id});
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

  /* 删除：ActionSheet → confirm 二次确认（红色删除钮）→ saveSchedules 覆盖层持久化 → 重渲染 */
  _del(el,id){
    const s=MP.q.schedules().find(x=>x.id===id);
    if(!s)return;
    MP.ui.sheet({title:'日程「'+s.name+'」',actions:[{key:'del',label:'删除日程',danger:true}]},k=>{
      if(k!=='del')return;
      MP.ui.confirm({title:'删除日程',text:'确定删除日程「'+s.name+'」吗？',okText:'删除',danger:true},()=>{
        MP.q.saveSchedules(MP.q.schedules().filter(x=>x.id!==id));
        MP.renderFrame();
        MP.ui.toast('已删除','ok');
      });
    });
  },
};
