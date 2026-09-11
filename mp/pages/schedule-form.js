/* 日程表单（MP.pages['schedule-form']，二级页）：新增/编辑复用同一页，URL 参数 ?id 区分（无 id=新增，有 id=编辑）
   字段顺序固定：日程名称(*必填) → 执行时间(input type="time"，默认 08:00) → 重复(7 圆形 chip 多选 + 灰字回显，
   全不选=单次) → 执行动作(开机/关机 2 段；开机时显示模式 4 chip 单选 + 温度步进 16-31) → 执行目标
   (segmented 群组/设备：群组单选列表，设备多选列表，两种模式勾选互不串数据)
   底部「保存」：非空校验 → saveSchedules 持久化 → MP.back() + toast；同目标同时间已有启用日程时
   追加冲突提醒（不阻断保存，Web 端独立冲突面板的移动端简化） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['schedule-form']={
  title:'日程表单',   /* 占位标题；mount 中按新增/编辑覆盖为「新增日程/编辑日程」 */
  note:[
    {type:'优化',text:'Web 表单改为移动端分步区块：时间/重复/动作/目标'},
    {type:'简化',text:'冲突检测提示保留为保存时 toast（Web 端为独立冲突面板）'},
  ],

  WK:['一','二','三','四','五','六','日'],   /* days 约定：1=周一 … 7=周日 */
  MODE_TXT:{cool:'制冷',heat:'制热',fan:'送风',dry:'除湿'},
  TEMP_MIN:16,TEMP_MAX:31,

  render(el,params){
    const id=params&&params.id;
    const s=id?MP.q.schedules().find(x=>x.id===id):null;
    if(id&&!s){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('schedule')+'</div><div class="tx">未找到该日程</div></div>';
      return;
    }
    /* 编辑态初始值：目标勾选回填——优先 targetIds；旧数据无 targetIds 时群组按 targetName 反查，设备留空待重选 */
    let gId=null; const devIds=new Set();
    if(s){
      if(s.targetType==='group'){
        gId=(s.targetIds&&s.targetIds[0])
          ||(MP.q.groups().find(g=>g.name===s.targetName)||{}).id||null;
      }else{
        (s.targetIds||[]).forEach(did=>{ if(MP.data.devices.some(d=>d.id===did))devIds.add(did); });
      }
    }
    this._st={
      name:s?s.name:'',
      time:s?s.time:'08:00',
      days:s?(s.days||[]).slice():[],
      power:s?!!(s.action&&s.action.power):true,
      mode:s&&s.action&&s.action.mode?s.action.mode:'cool',
      temp:s&&s.action&&s.action.temp?s.action.temp:26,
      targetType:s?s.targetType:'group',
      gId:gId, devIds:devIds,
    };

    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        /* 1. 日程名称（必填） */
        +'<div class="mp-card">'
          +'<div class="mp-field"><span class="lab"><span class="req">*</span>日程名称</span>'
          +'<input id="sName" maxlength="30" placeholder="请输入日程名称" value="'+this._st.name+'"></div>'
        +'</div>'
        /* 2. 执行时间：原生 time 输入（移动端唤起系统时间滚轮） */
        +'<div class="mp-card">'
          +'<div class="mp-field"><span class="lab"><span class="req">*</span>执行时间</span>'
          +'<input type="time" id="sTime" value="'+this._st.time+'"></div>'
        +'</div>'
        /* 3. 重复：7 个圆形 chip 多选 + 灰字回显 */
        +'<div class="mp-card">'
          +'<div class="mp-card-t">重复</div>'
          +'<div class="mp-wk-chips" id="wkChips"></div>'
          +'<div class="mp-wk-echo" id="wkEcho"></div>'
        +'</div>'
        /* 4. 执行动作：开关 2 段；开机时显示模式 4 chip + 温度步进 */
        +'<div class="mp-card">'
          +'<div class="mp-card-t">执行动作</div>'
          +'<div class="mp-seg" id="actSeg">'
            +'<div class="mp-seg-i'+(this._st.power?' on':'')+'" data-p="1">开机</div>'
            +'<div class="mp-seg-i'+(this._st.power?'':' on')+'" data-p="0">关机</div>'
          +'</div>'
          +'<div id="actOn" style="display:'+(this._st.power?'block':'none')+'">'
            +'<div class="mp-sec" style="padding-left:0">模式</div>'
            +'<div class="mp-sch-modes" id="modeChips"></div>'
            +'<div class="mp-sec" style="padding-left:0">设定温度</div>'
            +'<div class="mp-sch-temp"><div class="mp-stepper">'
              +'<span class="st-btn" id="tMinus">−</span>'
              +'<span class="st-val" id="tVal"></span>'
              +'<span class="st-btn" id="tPlus">+</span>'
            +'</div></div>'
          +'</div>'
        +'</div>'
        /* 5. 执行目标：segmented 群组/设备 → 下方 picker 列表 */
        +'<div class="mp-card">'
          +'<div class="mp-card-t">执行目标</div>'
          +'<div class="mp-seg" id="tgtSeg">'
            +'<div class="mp-seg-i'+(this._st.targetType==='group'?' on':'')+'" data-t="group">群组</div>'
            +'<div class="mp-seg-i'+(this._st.targetType==='device'?' on':'')+'" data-t="device">设备</div>'
          +'</div>'
          +'<div class="mp-sec" style="padding-left:0" id="tgtHint"></div>'
        +'</div>'
        +'<div class="mp-list" id="tgtList" style="margin-top:0"></div>'
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnSave">保存</button></div>'
    +'</div>';

    this._refreshWk(el);
    this._refreshModes(el);
    this._refreshTemp(el);
    this._refreshTargets(el);
  },

  /* 重复星期 chips：多选切换 + 灰字回显（"每周一、三、五 执行" / "单次执行"） */
  _refreshWk(el){
    const self=this, st=this._st;
    el.querySelector('#wkChips').innerHTML=this.WK.map((w,i)=>
      '<span class="mp-wk-chip'+(st.days.indexOf(i+1)>=0?' on':'')+'" data-d="'+(i+1)+'">'+w+'</span>'
    ).join('');
    el.querySelector('#wkEcho').textContent=st.days.length
      ? '每周'+st.days.slice().sort((a,b)=>a-b).map(d=>this.WK[d-1]).join('、')+' 执行'
      : '单次执行';
    el.querySelectorAll('#wkChips .mp-wk-chip').forEach(c=>c.onclick=()=>{
      const d=+c.dataset.d, i=st.days.indexOf(d);
      if(i>=0)st.days.splice(i,1); else st.days.push(d);
      self._refreshWk(el);
    });
  },

  /* 模式 4 chip 单选 */
  _refreshModes(el){
    const self=this, st=this._st;
    el.querySelector('#modeChips').innerHTML=Object.keys(this.MODE_TXT).map(k=>
      '<span class="mp-chip'+(st.mode===k?' on':'')+'" data-m="'+k+'">'+this.MODE_TXT[k]+'</span>'
    ).join('');
    el.querySelectorAll('#modeChips .mp-chip').forEach(c=>c.onclick=()=>{
      st.mode=c.dataset.m; self._refreshModes(el);
    });
  },

  /* 温度步进 16–31：到边界置灰但可点，点击给提示（复用 .mp-stepper 的 edge 惯例） */
  _refreshTemp(el){
    const st=this._st;
    el.querySelector('#tVal').textContent=st.temp+'°C';
    el.querySelector('#tMinus').className='st-btn'+(st.temp<=this.TEMP_MIN?' edge':'');
    el.querySelector('#tPlus').className='st-btn'+(st.temp>=this.TEMP_MAX?' edge':'');
  },

  /* 目标 picker：群组=单选列表（radio 式勾选），设备=多选列表（勾选）；两种模式勾选互不串数据 */
  _refreshTargets(el){
    const self=this, st=this._st;
    const box=el.querySelector('#tgtList');
    if(st.targetType==='group'){
      el.querySelector('#tgtHint').textContent='选择 1 个群组';
      box.innerHTML=MP.q.groups().map(g=>
        '<div class="mp-sch-tgt" data-gid="'+g.id+'">'
          +'<span class="mp-check'+(st.gId===g.id?' on':'')+'"></span>'
          +'<div class="bd">'+g.name+'<div class="t2">共 '+g.deviceIds.length+' 台设备</div></div>'
        +'</div>'
      ).join('')||'<div class="mp-sch-tgt"><div class="bd mp-muted">暂无群组，请先到群组管理创建</div></div>';
      box.querySelectorAll('.mp-sch-tgt[data-gid]').forEach(r=>r.onclick=()=>{
        st.gId=r.dataset.gid; self._refreshTargets(el);
      });
    }else{
      el.querySelector('#tgtHint').textContent='选择设备（已选 '+st.devIds.size+' 台，可多选）';
      box.innerHTML=MP.data.devices.map(d=>
        '<div class="mp-sch-tgt" data-did="'+d.id+'">'
          +'<span class="mp-check'+(st.devIds.has(d.id)?' on':'')+'"></span>'
          +'<div class="bd">'+d.name+'<div class="t2">'+d.room+'</div></div>'
          +'<span class="mp-tag '+(d.online?(d.power?'tag-ok">开机':'tag-info">关机'):'tag-info">离线')+'</span>'
        +'</div>'
      ).join('');
      box.querySelectorAll('.mp-sch-tgt[data-did]').forEach(r=>r.onclick=()=>{
        const id=r.dataset.did;
        if(st.devIds.has(id))st.devIds.delete(id); else st.devIds.add(id);
        self._refreshTargets(el);
      });
    }
  },

  /* 目标显示名：群组=群名；设备=单台设备名 / 多台取首台+" 等 N 台" */
  _targetName(){
    const st=this._st;
    if(st.targetType==='group'){
      const g=MP.q.groups().find(x=>x.id===st.gId);
      return g?g.name:'';
    }
    const names=Array.from(st.devIds).map(id=>(MP.data.devices.find(d=>d.id===id)||{}).name).filter(Boolean);
    if(!names.length)return '';
    return names.length===1?names[0]:names[0]+' 等 '+names.length+' 台';
  },

  mount(el,params){
    const self=this, id=params&&params.id;
    if(id&&!MP.q.schedules().some(x=>x.id===id))return;   /* 日程不存在时 render 已给空态 */
    document.getElementById('nb-title').textContent=id?'编辑日程':'新增日程';
    const st=this._st;

    el.querySelector('#sName').oninput=e=>{ st.name=e.target.value; };
    el.querySelector('#sTime').onchange=e=>{ st.time=e.target.value; };

    /* 动作 segmented：开机 ↔ 关机，开机时才显示模式与温度 */
    el.querySelectorAll('#actSeg .mp-seg-i').forEach(i=>i.onclick=()=>{
      st.power=i.dataset.p==='1';
      el.querySelectorAll('#actSeg .mp-seg-i').forEach(x=>x.classList.toggle('on',x===i));
      el.querySelector('#actOn').style.display=st.power?'block':'none';
    });
    /* 温度步进 */
    el.querySelector('#tMinus').onclick=()=>{
      if(st.temp<=self.TEMP_MIN){ MP.ui.toast('温度范围 '+self.TEMP_MIN+'~'+self.TEMP_MAX+'°C'); return; }
      st.temp--; self._refreshTemp(el);
    };
    el.querySelector('#tPlus').onclick=()=>{
      if(st.temp>=self.TEMP_MAX){ MP.ui.toast('温度范围 '+self.TEMP_MIN+'~'+self.TEMP_MAX+'°C'); return; }
      st.temp++; self._refreshTemp(el);
    };
    /* 目标 segmented：群组 ↔ 设备，切换仅换列表，勾选互不串数据 */
    el.querySelectorAll('#tgtSeg .mp-seg-i').forEach(i=>i.onclick=()=>{
      st.targetType=i.dataset.t;
      el.querySelectorAll('#tgtSeg .mp-seg-i').forEach(x=>x.classList.toggle('on',x===i));
      self._refreshTargets(el);
    });

    el.querySelector('#btnSave').onclick=()=>{
      const name=(el.querySelector('#sName').value||'').trim();
      const time=el.querySelector('#sTime').value;
      if(!name){ MP.ui.toast('请输入日程名称','er'); return; }
      if(!time){ MP.ui.toast('请选择执行时间','er'); return; }
      const targetIds=st.targetType==='group'
        ? (st.gId?[st.gId]:[])
        : Array.from(st.devIds);
      if(!targetIds.length){ MP.ui.toast('请选择执行目标','er'); return; }

      const targetName=self._targetName();
      /* 冲突提醒：同目标同时间已有启用中日程 → 不阻断保存，toast 提示（Web 端冲突面板的移动端简化） */
      const conflict=MP.q.schedules().some(x=>x.id!==id&&x.enabled&&x.time===time
        &&x.targetType===st.targetType&&x.targetName===targetName);

      const list=MP.q.schedules();
      if(id){
        const s=list.find(x=>x.id===id);
        if(s){
          s.name=name; s.time=time; s.days=st.days.slice().sort((a,b)=>a-b);
          s.action=st.power?{power:true,mode:st.mode,temp:st.temp}:{power:false};
          s.targetType=st.targetType; s.targetIds=targetIds; s.targetName=targetName;
        }
      }else{
        list.push({
          id:'s'+Date.now(), name:name, time:time, days:st.days.slice().sort((a,b)=>a-b),
          action:st.power?{power:true,mode:st.mode,temp:st.temp}:{power:false},
          targetType:st.targetType, targetIds:targetIds, targetName:targetName, enabled:true,
        });
      }
      MP.q.saveSchedules(list);
      MP.back();
      MP.ui.toast(conflict?'已保存，与已有日程时间接近，请注意冲突':'已保存',conflict?'':'ok');
    };
  },
};
