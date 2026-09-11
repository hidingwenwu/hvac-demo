/* 节能策略列表（MP.pages['strategy-list']，二级页）：对应 Web 端「节能策略」4 个独立页面
   （strategy-env / strategy-wind / strategy-load / strategy-ultimate），小程序端合并为一个列表
   策略卡：策略名 + 类型 tag（四类四色：env 绿 / wind 蓝 / load 橙 / ultimate 紫）+ 摘要 desc +
   生效范围行（有 targetName 时显示）；右侧 .mp-switch 启停（切换即 saveStrategies 持久化）
   交互惯例同日程列表：点击卡片进编辑（strategy-form?id），长按 500ms → ActionSheet → confirm 删除 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['strategy-list']={
  title:'节能策略',
  note:[
    {type:'简化',text:'Web 端 4 个独立策略页面合并为一个策略列表，按类型标签区分'},
    {type:'优化',text:'参数配置折叠进表单页，列表只看状态'},
  ],

  /* 策略类型字典 + 标签配色（四类四色） */
  TYPE_TXT:{env:'环境感知联动',wind:'风水联动',load:'负荷调控',ultimate:'极致节能'},
  TAG_CLS:{env:'tag-ok',wind:'tag-primary',load:'tag-wn',ultimate:'tag-ultimate'},

  /* 摘要：优先用数据自带 desc；缺失时借表单的 summ() 按结构化字段现算（R8 起入参为整条策略对象） */
  _desc(s){
    if(s.desc)return s.desc;
    const f=MP.pages['strategy-form'];
    return (f&&f.summ&&f.summ(s))||this.TYPE_TXT[s.type]||'';
  },

  _cardHTML(s){
    return '<div class="mp-stg-card'+(s.enabled?'':' off')+'" data-id="'+s.id+'">'
      +'<div class="bd">'
        +'<div class="nm">'+s.name+'<span class="mp-tag '+(this.TAG_CLS[s.type]||'tag-info')+'">'+(this.TYPE_TXT[s.type]||s.type)+'</span></div>'
        +'<div class="sm">'+this._desc(s)+'</div>'
        +(s.targetName?'<div class="sm">生效范围：'+s.targetName+'</div>':'')
      +'</div>'
      +'<label class="mp-switch" data-sw="'+s.id+'"><input type="checkbox"'+(s.enabled?' checked':'')+'><span class="tk"></span></label>'
    +'</div>';
  },

  render(el){
    this._lp=false;   /* 长按抑制标记：长按触发后抑制紧随其后的合成 click，避免误进编辑 */
    const list=MP.q.strategies();
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow" id="stgList">'
      +(list.length
        ? list.map(s=>this._cardHTML(s)).join('')
        : '<div class="mp-empty"><div class="ic">'+MP.icon('strategy')+'</div><div class="tx">暂无策略，点击下方按钮新增</div></div>')
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnAdd">+ 新增策略</button></div>'
    +'</div>';
  },

  mount(el){
    const self=this;
    el.querySelector('#btnAdd').onclick=()=>MP.go('strategy-form',{});
    /* 启停开关：切换即 saveStrategies 持久化 + toast；停用卡片降透明 */
    el.querySelectorAll('.mp-switch').forEach(sw=>{
      sw.onclick=e=>e.stopPropagation();   /* 开关点击不冒泡到卡片（避免误进编辑） */
      /* 开关上的 touchstart/mousedown 同样不冒泡：防长按开关误触卡片的长按删除 ActionSheet */
      sw.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
      sw.addEventListener('mousedown',e=>e.stopPropagation());
      sw.querySelector('input').onchange=e=>{
        const id=sw.dataset.sw, on=e.target.checked;
        const list=MP.q.strategies(), s=list.find(x=>x.id===id);
        if(s){ s.enabled=on; MP.q.saveStrategies(list); }
        sw.closest('.mp-stg-card').classList.toggle('off',!on);
        MP.ui.toast(on?'已启用':'已停用','ok');
      };
    });
    el.querySelectorAll('#stgList .mp-stg-card').forEach(card=>{
      const id=card.dataset.id;
      card.onclick=()=>{
        if(self._lp){ self._lp=false; return; }
        MP.go('strategy-form',{id:id});
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

  /* 删除：ActionSheet → confirm 二次确认（红色删除钮）→ saveStrategies 覆盖层持久化 → 重渲染 */
  _del(el,id){
    const s=MP.q.strategies().find(x=>x.id===id);
    if(!s)return;
    MP.ui.sheet({title:'策略「'+s.name+'」',actions:[{key:'del',label:'删除策略',danger:true}]},k=>{
      if(k!=='del')return;
      MP.ui.confirm({title:'删除策略',text:'确定删除策略「'+s.name+'」吗？',okText:'删除',danger:true},()=>{
        MP.q.saveStrategies(MP.q.strategies().filter(x=>x.id!==id));
        MP.renderFrame();
        MP.ui.toast('已删除','ok');
      });
    });
  },
};
