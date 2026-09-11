/* 环境感知（MP.pages['env-list']，二级页）：对应 Web 端「集中控制-环境感知监测」3 个页面
   （pages/ctrl-env.html 温湿度 / ctrl-env-human.html 人体感知 / ctrl-env-door.html 门窗感知），
   小程序端合并为单页 3 tab 分段切换，纯只读监测（去除 Web 端设备配置操作）。
   数据读 MP.data.envSensors（type: th/human/door）；本页无任何编辑，故不走 MP.q 覆盖层。
   tab 切换只重渲染列表区；下拉刷新与 home 同惯例（scrollTop<=0 + 下拉 >60px + _rfBound 守卫）。 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['env-list']={
  title:'环境感知',
  note:[
    {type:'优化',text:'Web 端 3 个环境感知页面合并为单页 3 tab'},
    {type:'简化',text:'去除 Web 端设备配置操作，移动端只读监测'},
  ],

  /* tab 定义：key 对应 envSensors.type */
  TABS:[
    {key:'th',   label:'温湿度'},
    {key:'human',label:'人体存在'},
    {key:'door', label:'门窗'},
  ],
  /* 时间 mock（演示数据，按设备 id 确定性取值，避免每次渲染抖动） */
  TIME:{e1:'5 分钟前',e2:'8 分钟前',e3:'12 分钟前',e4:'--',e5:'23 分钟前',e6:'1 小时前'},

  /* 电量条：宽度=battery%，<20% 红色 */
  _bat(s){
    const low=s.battery<20;
    return '<div class="mp-env-bat"><span class="lb">电量</span>'
      +'<div class="bar"><div class="in'+(low?' low':'')+'" style="width:'+s.battery+'%"></div></div>'
      +'<span class="pct">'+s.battery+'%</span></div>';
  },

  _head(s){
    return '<div class="e-head"><div class="bd">'
      +'<div class="e-name">'+s.name+'</div>'
      +'<div class="e-room">'+s.room+'</div>'
      +'</div><span class="mp-tag '+(s.online?'tag-ok':'tag-info')+'">'+(s.online?'在线':'离线')+'</span></div>';
  },

  /* 温湿度卡：温度大字 + 湿度 + 电量条 + 上报时间 */
  _thCard(s){
    const off=!s.online;
    return '<div class="mp-env-card'+(off?' off':'')+'">'+this._head(s)
      +'<div class="mp-env-rd">'
        +'<div class="ri"><div class="rv">'+(off?'--':s.temp)+'<span class="u">°C</span></div><div class="rl">温度</div></div>'
        +'<div class="rsep"></div>'
        +'<div class="ri"><div class="rv">'+(off?'--':s.humidity)+'<span class="u">%</span></div><div class="rl">湿度</div></div>'
      +'</div>'
      +this._bat(s)
      +'<div class="mp-env-time">上报时间 '+(off?'--':this.TIME[s.id]||'--')+'</div>'
    +'</div>';
  },

  /* 人体存在卡：状态大字（有人绿/无人灰）+ 最后触发时间 + 电量条 */
  _humanCard(s){
    const off=!s.online;
    const st=off?'--':s.state;
    return '<div class="mp-env-card'+(off?' off':'')+'">'+this._head(s)
      +'<div class="mp-env-rd"><div class="ri">'
        +'<div class="rv '+(st==='有人'?'ok':'mut')+'">'+st+'</div><div class="rl">当前状态</div>'
      +'</div></div>'
      +this._bat(s)
      +'<div class="mp-env-time">最后触发 '+(off?'--':this.TIME[s.id]||'--')+'</div>'
    +'</div>';
  },

  /* 门窗卡：状态 tag（开启橙/关闭绿）+ 状态变更时间 + 电量条 */
  _doorCard(s){
    const off=!s.online;
    const open=!off&&s.state==='开启';
    return '<div class="mp-env-card'+(off?' off':'')+'">'+this._head(s)
      +'<div class="mp-env-door">'
        +'<span class="mp-tag '+(off?'tag-info':open?'tag-wn':'tag-ok')+'">'+(off?'--':s.state)+'</span>'
        +'<span class="mp-sub">状态变更 '+(off?'--':this.TIME[s.id]||'--')+'</span>'
      +'</div>'
      +this._bat(s)
    +'</div>';
  },

  /* 列表区：按当前 tab 过滤渲染；tab 内空态 */
  _renderList(el){
    const tab=this._tab;
    const list=MP.data.envSensors.filter(s=>s.type===tab);
    const box=el.querySelector('#envList');
    const label=this.TABS.find(t=>t.key===tab).label;
    box.innerHTML=list.length
      ? list.map(s=>this['_'+tab+'Card'](s)).join('')
      : '<div class="mp-empty"><div class="ic">'+MP.icon('env')+'</div><div class="tx">暂无'+label+'传感器</div></div>';
    el.querySelectorAll('.mp-env-tabs .mp-seg-i').forEach(i=>i.classList.toggle('on',i.dataset.k===tab));
  },

  /* 下拉刷新：loading 800ms → 重渲染列表 + toast（与 home 同惯例） */
  onPullRefresh(el){
    MP.ui.loading('刷新中…');
    setTimeout(()=>{ MP.ui.hideLoading(); this._renderList(el); MP.ui.toast('已刷新','ok'); },800);
  },

  render(el){
    this._tab='th';   /* 每次进入默认温湿度 tab */
    const seg=this.TABS.map(t=>'<div class="mp-seg-i" data-k="'+t.key+'">'+t.label+'</div>').join('');
    el.innerHTML='<div class="mp-home-refresh" id="rfBar"><span id="rfTx">下拉刷新</span></div>'
      +'<div class="mp-seg mp-env-tabs">'+seg+'</div>'
      +'<div id="envList"></div>';
    this._renderList(el);
  },

  mount(el){
    const self=this;
    /* tab 单选切换：只重渲染列表区 */
    el.querySelectorAll('.mp-env-tabs .mp-seg-i').forEach(i=>i.onclick=()=>{
      if(self._tab===i.dataset.k)return;
      self._tab=i.dataset.k;
      self._renderList(el);
    });

    /* 下拉刷新：仅页面滚动到顶部时生效；renderFrame 复用同一 el，监听只绑一次 */
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
        if(go)self.onPullRefresh(el);
      });
    }
  },
};
