/* 节能策略表单（MP.pages['strategy-form']，二级页）：新增/编辑复用同一页，URL 参数 ?id 区分
   ── R8 重做：对照 Web 端四个独立策略页（strategy-env / strategy-wind / strategy-load /
      strategy-ultimate）的新建任务表单逐字段补全，四类策略共用一页、按类型切换分区 ──

   分区骨架（分区标题照搬 Web 端原文）：
     ① 策略类型（4 chip 单选；编辑态只读，对齐 Web「创建后不可修改」）
     ② 基础信息    —— 四类字段不同，见下表
     ③ 类型专属区  —— env：如果满足条件 + 则执行如下动作；wind：执行策略；
                      load：负荷调控目标；ultimate：空调控制配置
     ④ 生效范围    —— env/ultimate 房间树多选；wind 房间范围单选；load 调控范围多选

   四类基础信息字段对照：
     env      任务名称* / 任务描述 / 生效日期* / 生效时间* / 周重复时间* / 排除日期
     ultimate 任务名称* / 任务描述 / 生效日期* / 生效时间* / 周运行时间* / 排除日期
     wind     任务名称* / 时间范围* / 执行周期* / 备注
     load     任务名称* / 空调类型* / 起始时间* / 结束时间*

   移动端取舍（相对 Web 端）：
     · Web 弹窗左右双栏（左房间树 + 右表单）→ 移动端单列纵向分区，房间树落在最后一区
     · Web「策略管理」「调控范围」等页面级独立弹窗 → 并入本表单对应分区（策略库只读引用）
     · Web 锁定温度范围的双手柄滑块 → 下限/上限两个下拉（触屏更易精确选值）
     · 具体房间/楼层数据用本原型 buildings 注册表，不搬 Web 演示环境的楼栋房间名
   校验规则逐条对齐 Web 端（相邻动作不同类、末位不可为延时、四项至少设一项等，见 _validate） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['strategy-form']={
  title:'策略表单',   /* 占位标题；mount 中按新增/编辑覆盖为「新增策略/编辑策略」 */
  note:[
    {type:'新增',text:'按 Web 端四类策略页补全表单：生效日期/时间、周重复、排除日期、触发条件、动作链'},
    {type:'新增',text:'环境感知支持 4 类触发条件（人在/门窗/温度/湿度）与最多 16 步动作链'},
    {type:'新增',text:'极致节能补下发间隔（5-120 分钟）与开关机/模式/温度/风速四项指令'},
    {type:'优化',text:'Web 弹窗左右双栏改为单列分区，房间树下沉到「生效范围」区'},
    {type:'优化',text:'锁定温度范围的双手柄滑块改为下限/上限两个下拉，触屏更易精确选值'},
    {type:'简化',text:'Web 端「策略管理」「调控范围」独立弹窗并入本表单对应分区'},
  ],

  TYPE_TXT:{env:'环境感知联动',wind:'风水联动',load:'负荷调控',ultimate:'极致节能'},

  /* ══════════ 一、公共工具 ══════════ */

  E(){ return MP.data.stgEnum; },

  /* 全量房间显示名（= 楼层名 + 房间名，与 R7 绑定页同一口径） */
  _allRooms(){
    const out=[];
    MP.data.buildings.forEach(b=>b.floors.forEach(f=>f.rooms.forEach(r=>{
      out.push({name:f.name+r.name,building:b.name,floor:f.name});
    })));
    return out;
  },
  /* 楼层范围显示名（= 楼栋名 + 空格 + 楼层名）：风水联动「房间范围」与负荷调控「调控范围」的粒度 */
  _allFloors(){
    const out=[];
    MP.data.buildings.forEach(b=>b.floors.forEach(f=>{
      out.push({name:b.name+' '+f.name,count:f.rooms.length});
    }));
    return out;
  },

  /* 下拉：opts 支持 ['A','B'] 或 [['k','标签']] 两种写法 */
  _sel(id,opts,val,extra){
    return '<select class="mp-sel" id="'+id+'"'+(extra||'')+'>'
      +opts.map(o=>{
        const k=Array.isArray(o)?o[0]:o, t=Array.isArray(o)?o[1]:o;
        return '<option value="'+k+'"'+(String(val)===String(k)?' selected':'')+'>'+t+'</option>';
      }).join('')
    +'</select>';
  },

  /* 生效时间下拉选项（5 分钟粒度，照搬 Web：开始 00:00~23:55；结束额外含 24:00）；构建一次后缓存 */
  _timeOpts(isEnd){
    if(!this._toCache){
      const a=[];
      for(let h=0;h<24;h++)for(let m=0;m<60;m+=5){
        a.push((h<10?'0'+h:h)+':'+(m<10?'0'+m:m));
      }
      this._toCache=a;
    }
    return isEnd?this._toCache.concat(['24:00']):this._toCache;
  },

  /* 日期工具 */
  _cmpDate(a,b){ return a<b?-1:a>b?1:0; },
  _holidayOf(d){
    const h=(MP.data.holidays||[]).find(x=>x.dates.indexOf(d)>=0);
    return h?h.name:'';
  },

  /* ══════════ 二、状态初始化 ══════════ */

  /* 各类型的空白初值（新增态；编辑态用已存字段逐项覆盖） */
  _blank(type){
    const st={
      type:type,name:'',memo:'',
      dateStart:'2026-07-01',dateEnd:'2026-12-31',
      timeStart:'00:00',timeEnd:'24:00',
      weekdays:[1,2,3,4,5],           /* 默认工作日，对齐 Web */
      excludeDates:[],
      cycle:'day',libId:(MP.data.windLib[0]||{}).id||'',
      acType:'水机',dtStart:'',dtEnd:'',
      targetKw:'',targetPct:'',loadStrategy:'温度上调策略',source:'手动创建',
      interval:15,acPower:'不设置',acMode:'不设置',acTemp:'',acWind:'不设置',
      conds:[{kind:'human',state:'无人'}],   /* Web 新建首条默认「人在状态-无人」 */
      holdOn:false,holdMin:10,
      actions:[{kind:'ac',power:'开关不控制',mode:'模式不控制',temp:'',wind:'风速不控制'}],
      rooms:[],rangeFloor:'全部房间',rangeFloors:[],
      treeOpen:{},   /* 房间树展开态（key = 楼栋/楼层 id） */
    };
    return st;
  },

  _load(s){
    const st=this._blank(s.type);
    ['name','memo','dateStart','dateEnd','timeStart','timeEnd','cycle','libId','acType',
     'dtStart','dtEnd','targetKw','targetPct','loadStrategy','source',
     'interval','acPower','acMode','acWind','rangeFloor','holdMin'].forEach(k=>{
      if(s[k]!=null)st[k]=s[k];
    });
    if(s.acTemp!=null)st.acTemp=s.acTemp;
    if(s.holdOn!=null)st.holdOn=!!s.holdOn;
    if(Array.isArray(s.weekdays)&&s.weekdays.length)st.weekdays=s.weekdays.slice();
    if(Array.isArray(s.excludeDates))st.excludeDates=s.excludeDates.slice();
    if(Array.isArray(s.conds)&&s.conds.length)st.conds=JSON.parse(JSON.stringify(s.conds));
    if(Array.isArray(s.actions)&&s.actions.length)st.actions=JSON.parse(JSON.stringify(s.actions));
    if(Array.isArray(s.rooms))st.rooms=s.rooms.slice();
    if(Array.isArray(s.rangeFloors))st.rangeFloors=s.rangeFloors.slice();
    return st;
  },

  /* ══════════ 三、摘要文案（列表页「控制策略」列口径，照搬 Web 拼接规则） ══════════ */

  _condTxt(c){
    if(c.kind==='human')return '人在状态为'+c.state;
    if(c.kind==='door')return '门窗状态为'+c.state;
    const opTxt={gt:'高于',lt:'低于',ge:'升高到',le:'降低到'}[c.op]||'高于';
    if(c.kind==='temp')return '温度'+opTxt+(c.val===''||c.val==null?'--':c.val)+'℃';
    return '湿度'+opTxt+(c.val===''||c.val==null?'--':c.val)+'%';
  },
  _actTxt(a){
    if(a.kind==='delay')return '延时'+(a.min||'--')+'分钟';
    if(a.kind==='ac'){
      const p=[];
      if(a.power&&a.power!=='开关不控制')p.push(a.power);
      if(a.mode&&a.mode!=='模式不控制')p.push(a.mode);
      if(a.temp!==''&&a.temp!=null)p.push(a.temp+'℃');
      if(a.wind&&a.wind!=='风速不控制')p.push(a.wind+'风');
      return p.length?'将空调设置为'+p.join(' '):'空调控制（未设置参数）';
    }
    const p=[];
    if(a.lockPower&&a.lockPower!=='开关机不锁定')p.push(a.lockPower);
    if(a.lockModes&&a.lockModes.length)p.push('模式锁定'+a.lockModes.join('、'));
    if(a.lockTemp==='锁定温度范围')p.push('温度锁定'+a.lockLo+'-'+a.lockHi+'℃');
    return p.length?'执行锁定控制：'+p.join(' / '):'解除全部锁定';
  },

  /* 摘要入口：入参为完整策略对象（R8 起结构化字段），旧调用方传 params 时兜底返回类型名 */
  summ(s){
    if(!s||typeof s!=='object')return '';
    const t=s.type;
    if(t==='env'){
      const c=(s.conds||[]).map(x=>this._condTxt(x)).join('且');
      const hold=s.holdOn?'并持续满足'+s.holdMin+'分钟':'';
      const a=(s.actions||[]).map(x=>this._actTxt(x)).join('，');
      return '检测到'+(c||'--')+hold+'时，'+(a||'尚未配置执行动作')+'。';
    }
    if(t==='wind'){
      const lib=(MP.data.windLib||[]).find(x=>x.id===s.libId);
      if(!lib)return '尚未选择执行策略。';
      return '按「'+lib.name+'」下发：'+lib.mode+' '+lib.temp+' '+lib.wind+'风，水阀'+lib.valve+'。';
    }
    if(t==='load'){
      return '目标负荷 '+(s.targetKw||'--')+'kW（幅度 '+(s.targetPct||'--')+'%），执行'+(s.loadStrategy||'--')+'。';
    }
    if(t==='ultimate'){
      const p=[];
      if(s.acPower&&s.acPower!=='不设置')p.push(s.acPower);
      if(s.acMode&&s.acMode!=='不设置')p.push(s.acMode);
      if(s.acTemp!==''&&s.acTemp!=null)p.push(s.acTemp+'℃');
      if(s.acWind&&s.acWind!=='不设置')p.push(s.acWind+'风');
      return '每 '+(s.interval||'--')+' 分钟下发一次控制指令，将空调设置为 '+(p.length?p.join(' '):'（未设置）')+'。';
    }
    return '';
  },

  /* 生效范围显示名（列表页「生效范围」行） */
  _targetName(st){
    if(st.type==='wind')return st.rangeFloor||'';
    if(st.type==='load'){
      const a=st.rangeFloors;
      if(!a.length)return '';
      return a.length===1?a[0]:a[0]+' 等 '+a.length+' 个区域';
    }
    const a=st.rooms;
    if(!a.length)return '';
    return a.length===1?a[0]:a[0]+' 等 '+a.length+' 个房间';
  },

  /* ══════════ 四、渲染 ══════════ */

  render(el,params){
    const id=params&&params.id;
    const s=id?MP.q.strategies().find(x=>x.id===id):null;
    if(id&&!s){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('strategy')+'</div><div class="tx">未找到该策略</div></div>';
      return;
    }
    this._ro=!!s;   /* 编辑态：类型只读 */
    this._st=s?this._load(s):this._blank('env');

    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        +'<div class="mp-card">'
          +'<div class="mp-card-t">策略类型'+(s?'<span class="more">创建后不可修改</span>':'')+'</div>'
          +'<div class="mp-stg-types'+(s?' ro':'')+'" id="typeChips">'
          +Object.keys(this.TYPE_TXT).map(k=>'<span class="mp-chip'+(this._st.type===k?' on':'')+'" data-t="'+k+'">'+this.TYPE_TXT[k]+'</span>').join('')
          +'</div>'
        +'</div>'
        +'<div id="stgBody"></div>'
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnSave">'
        +(this._st.type==='ultimate'?'保存并启用任务':'保存')+'</button></div>'
    +'</div>';
    this._renderBody(el);
  },

  /* 分区主体：按类型组装，结构性变化（增删条件/动作、切类型、切树展开）后整体重渲染 */
  _renderBody(el){
    const st=this._st;
    let h=this._secBase();
    if(st.type==='env')      h+=this._secCond()+this._secAct();
    else if(st.type==='wind')h+=this._secWind();
    else if(st.type==='load')h+=this._secLoad();
    else                     h+=this._secUlt();
    h+=this._secScope();
    el.querySelector('#stgBody').innerHTML=h;
    const btn=el.querySelector('#btnSave');
    if(btn)btn.textContent=st.type==='ultimate'?'保存并启用任务':'保存';
    this._bindBody(el);
  },

  /* ── ② 基础信息 ── */
  _secBase(){
    const st=this._st, E=this.E();
    let h='<div class="mp-card"><div class="mp-card-t">基础信息</div>';
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>任务名称</span>'
      +'<input class="mp-inp" id="fName" maxlength="30" placeholder="请输入任务名称" value="'+(st.name||'')+'"></div>';

    if(st.type==='load'){
      h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>空调类型</span>'+this._sel('fAcType',E.acType,st.acType)+'</div>'
        +'<div class="mp-fr"><span class="lab"><span class="req">*</span>起始时间</span>'
        +'<input class="mp-inp" type="datetime-local" id="fDtStart" value="'+(st.dtStart||'')+'"></div>'
        +'<div class="mp-fr"><span class="lab"><span class="req">*</span>结束时间</span>'
        +'<input class="mp-inp" type="datetime-local" id="fDtEnd" value="'+(st.dtEnd||'')+'"></div>';
      return h+'</div>';
    }

    /* env / ultimate：任务描述紧随任务名称（字段顺序照搬 Web 端表单，不自行调整） */
    if(st.type!=='wind'){
      h+='<div class="mp-fr"><span class="lab">任务描述</span>'
        +'<textarea class="mp-inp mp-ta" id="fMemo" maxlength="200" placeholder="'
        +(st.type==='env'?'请输入任务描述':'请输入任务说明')+'">'+(st.memo||'')+'</textarea></div>';
    }

    /* 日期区间：env / ultimate 为「生效日期」，wind 为「时间范围」（照搬各页原文标签） */
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>'+(st.type==='wind'?'时间范围':'生效日期')+'</span>'
      +'<div class="mp-2col"><input class="mp-inp" type="date" id="fDs" value="'+(st.dateStart||'')+'">'
      +'<span class="sep">至</span><input class="mp-inp" type="date" id="fDe" value="'+(st.dateEnd||'')+'"></div></div>';

    if(st.type==='wind'){
      h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>执行周期</span>'
        +'<div class="mp-seg" id="fCycle">'
        +E.cycle.map(c=>'<div class="mp-seg-i'+(st.cycle===c[0]?' on':'')+'" data-c="'+c[0]+'">'+c[1]+'</div>').join('')
        +'</div></div>'
        +'<div class="mp-fr"><span class="lab">备注</span>'
        +'<input class="mp-inp" id="fMemo" placeholder="请输入备注" value="'+(st.memo||'')+'"></div>';
      return h+'</div>';
    }

    /* env / ultimate 共有：生效时间 + 周重复 + 排除日期 */
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>生效时间</span>'
      +'<div class="mp-2col">'+this._sel('fTs',this._timeOpts(false),st.timeStart)
      +'<span class="sep">至</span>'+this._sel('fTe',this._timeOpts(true),st.timeEnd)+'</div>'
      +'<div class="hint">5 分钟粒度；结束时间可选 24:00 表示当日 24 点整</div></div>';

    /* 周重复时间 / 周运行时间：七天多选 + 4 个快捷按钮 */
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>'+(st.type==='env'?'周重复时间':'周运行时间')+'</span>'
      +'<div class="mp-week" id="fWeek">'
      +E.weekTxt.map((w,i)=>'<span class="wd'+(st.weekdays.indexOf(i+1)>=0?' on':'')+'" data-d="'+(i+1)+'">'+w.replace('周','')+'</span>').join('')
      +'</div>'
      +'<div class="mp-week-quick" id="fWeekQ">'
      +[['work','工作日'],['end','周末'],['all','全选'],['none','取消']]
        .map(q=>'<span class="qk" data-q="'+q[0]+'">'+q[1]+'</span>').join('')
      +'</div></div>';

    /* 排除日期 */
    h+='<div class="mp-fr"><span class="lab">排除日期</span>'
      +'<div class="mp-2col"><input class="mp-inp" type="date" id="fEx">'
      +'<span class="mp-mini-btn" id="fExAdd">+ 添加</span></div>'
      +'<div class="mp-2col" style="margin-top:8px"><span class="mp-mini-btn wide" id="fExHoliday">一键排除节假日</span></div>'
      +'<div class="mp-exlist" id="fExList">'
      +(st.excludeDates.length
        ? st.excludeDates.slice().sort().map(d=>{
            const hn=this._holidayOf(d);
            return '<span class="ex">'+d+(hn?'（'+hn+'）':'')+'<i data-x="'+d+'">×</i></span>';
          }).join('')
        : '<span class="mp-muted" style="font-size:12px">未设置排除日期</span>')
      +'</div></div>';

    return h+'</div>';
  },

  /* ── ③-env-1 如果满足条件 ── */
  _secCond(){
    const st=this._st, E=this.E();
    const used=st.conds.map(c=>c.kind);
    let h='<div class="mp-card"><div class="mp-card-t">如果满足条件<span class="more">条件之间为「且」关系</span></div>';
    h+=st.conds.map((c,i)=>{
      /* 同一类条件只能配一次：已被其它行占用的类型置 disabled（照搬 Web） */
      const kindOpts=E.condKind.map(k=>{
        const dis=(used.indexOf(k[0])>=0&&k[0]!==c.kind)?' disabled':'';
        return '<option value="'+k[0]+'"'+(c.kind===k[0]?' selected':'')+dis+'>'+k[1]+'</option>';
      }).join('');
      let body='';
      if(c.kind==='human'||c.kind==='door'){
        const opts=c.kind==='human'?E.humanState:E.doorState;
        body='<div class="mp-seg sm" data-seg="cond" data-i="'+i+'">'
          +opts.map(o=>'<div class="mp-seg-i'+(c.state===o?' on':'')+'" data-v="'+o+'">'+o+'</div>').join('')
        +'</div>';
      }else{
        const unit=c.kind==='temp'?'℃':'%';
        const ph=c.kind==='temp'?'-10~50':'1~99';
        body='<div class="mp-2col">'+this._sel('condOp'+i,E.compare,c.op||'gt',' data-i="'+i+'"')
          +'<div class="mp-unit"><input class="mp-inp" type="number" id="condVal'+i+'" data-i="'+i+'" placeholder="'+ph+'" value="'+(c.val==null?'':c.val)+'"><span class="u">'+unit+'</span></div></div>';
      }
      return '<div class="mp-dyn-row">'
        +'<div class="hd"><span class="pfx">'+(i===0?'如果':'且')+'</span>'
          +'<select class="mp-sel" data-condkind="'+i+'">'+kindOpts+'</select>'
          +'<span class="del" data-delcond="'+i+'">×</span></div>'
        +'<div class="bd">'+body+'</div>'
      +'</div>';
    }).join('');
    h+='<div class="mp-add-btn'+(st.conds.length>=4?' dis':'')+'" id="btnAddCond">＋ 且满足条件</div>';
    /* 持续满足条件（虚线卡片，勾选后显现时长输入） */
    h+='<div class="mp-hold">'
      +'<div class="hd" id="holdTgl"><span class="mp-check'+(st.holdOn?' on':'')+'"></span><span class="tx">持续满足条件</span></div>'
      +(st.holdOn
        ? '<div class="mp-2col" style="margin-top:10px"><div class="mp-unit">'
          +'<input class="mp-inp" type="number" id="fHoldMin" min="1" max="60" value="'+st.holdMin+'"><span class="u">分钟</span></div></div>'
        : '')
      +'<div class="hint">'+(st.holdOn
          ? '满足条件后 '+st.holdMin+' 分钟再次确认，仍然满足条件再执行'
          : '满足条件立即执行')+'</div>'
    +'</div>';
    return h+'</div>';
  },

  /* ── ③-env-2 则执行如下动作 ── */
  _secAct(){
    const st=this._st, E=this.E();
    let h='<div class="mp-card"><div class="mp-card-t">则执行如下动作<span class="more">最多 16 步，按顺序执行</span></div>';
    h+=st.actions.map((a,i)=>{
      let body='';
      if(a.kind==='ac'){
        body='<div class="mp-sub-fr"><span class="l">开关机</span>'+this._sel('acP'+i,E.acPower,a.power||'开关不控制',' data-i="'+i+'" data-k="power"')+'</div>'
          +'<div class="mp-sub-fr"><span class="l">空调模式</span>'+this._sel('acM'+i,E.acMode,a.mode||'模式不控制',' data-i="'+i+'" data-k="mode"')+'</div>'
          +'<div class="mp-sub-fr"><span class="l">温度</span>'
            +'<div class="mp-unit"><input class="mp-inp" type="number" min="16" max="31" placeholder="温度不控制" data-i="'+i+'" data-k="temp" value="'+(a.temp==null?'':a.temp)+'"><span class="u">℃</span></div></div>'
          +'<div class="mp-sub-fr"><span class="l">风速</span>'+this._sel('acW'+i,E.acWind,a.wind||'风速不控制',' data-i="'+i+'" data-k="wind"')+'</div>';
      }else if(a.kind==='lock'){
        const lm=a.lockModes||[];
        body='<div class="mp-sub-fr"><span class="l">开关机锁定</span>'+this._sel('lkP'+i,E.lockPower,a.lockPower||'开关机不锁定',' data-i="'+i+'" data-k="lockPower"')+'</div>'
          +'<div class="mp-sub-fr col"><span class="l">模式锁定</span>'
            +'<div class="mp-chips-wrap" data-lockmode="'+i+'">'
            +E.lockMode.map(m=>'<span class="mp-chip sm'+(lm.indexOf(m)>=0?' on':'')+'" data-v="'+m+'">'+m+'</span>').join('')
            +'</div>'
            +'<div class="hint">未选表示模式不锁定；制热不能与制冷或除湿同时锁定</div></div>'
          +'<div class="mp-sub-fr"><span class="l">温度锁定</span>'+this._sel('lkT'+i,E.lockTemp,a.lockTemp||'温度不锁定',' data-i="'+i+'" data-k="lockTemp"')+'</div>'
          +(a.lockTemp==='锁定温度范围'
            ? '<div class="mp-sub-fr"><span class="l">锁定温度范围</span><div class="mp-2col">'
              +this._sel('lkLo'+i,this._tempOpts(),a.lockLo==null?16:a.lockLo,' data-i="'+i+'" data-k="lockLo"')
              +'<span class="sep">~</span>'
              +this._sel('lkHi'+i,this._tempOpts(),a.lockHi==null?30:a.lockHi,' data-i="'+i+'" data-k="lockHi"')
              +'</div></div>'
            : '');
      }else{
        body='<div class="mp-sub-fr"><span class="l">延时时长</span>'
          +'<div class="mp-unit"><input class="mp-inp" type="number" min="5" max="240" data-i="'+i+'" data-k="min" value="'+(a.min==null?10:a.min)+'"><span class="u">分钟</span></div></div>';
      }
      return '<div class="mp-dyn-row">'
        +'<div class="hd"><span class="idx">'+(i+1)+'</span>'
          +'<select class="mp-sel" data-actkind="'+i+'">'
          +E.actKind.map(k=>'<option value="'+k[0]+'"'+(a.kind===k[0]?' selected':'')+'>'+k[1]+'</option>').join('')
          +'</select>'
          +'<span class="del" data-delact="'+i+'">×</span></div>'
        +'<div class="bd">'+body+'</div>'
      +'</div>';
    }).join('');
    h+='<div class="mp-add-btn'+(st.actions.length>=16?' dis':'')+'" id="btnAddAct">＋ 添加动作</div>'
      +'<div class="hint">相邻两个动作不允许相同，最后一个动作不能是延时</div>';
    return h+'</div>';
  },
  _tempOpts(){
    if(!this._tCache){ this._tCache=[]; for(let t=16;t<=30;t++)this._tCache.push(String(t)); }
    return this._tCache;
  },

  /* ── ③-wind 执行策略（引用策略库，只读展示策略参数） ── */
  _secWind(){
    const st=this._st;
    const lib=MP.data.windLib||[];
    let h='<div class="mp-card"><div class="mp-card-t">执行策略<span class="more">由 Web 端策略库维护</span></div>';
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>选择策略</span>'
      +this._sel('fLib',lib.map(x=>[x.id,x.name]),st.libId)+'</div>';
    const cur=lib.find(x=>x.id===st.libId);
    if(cur){
      h+='<div class="mp-lib-view">'
        +'<div class="r"><span class="l">设备类型</span><span class="v">'+cur.devType+'</span></div>'
        +'<div class="r"><span class="l">运行模式</span><span class="v">'+cur.mode+'</span></div>'
        +'<div class="r"><span class="l">温度设定</span><span class="v">'+cur.temp+'</span></div>'
        +'<div class="r"><span class="l">风速</span><span class="v">'+cur.wind+'</span></div>'
        +'<div class="r"><span class="l">联动水阀</span><span class="v">'+cur.valve+'</span></div>'
      +'</div>';
    }
    return h+'</div>';
  },

  /* ── ③-load 负荷调控目标 ── */
  _secLoad(){
    const st=this._st, E=this.E();
    let h='<div class="mp-card"><div class="mp-card-t">负荷调控目标</div>';
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>负荷调控目标(kW)</span>'
      +'<div class="mp-unit"><input class="mp-inp" type="number" id="fKw" placeholder="请输入目标负荷" value="'+(st.targetKw||'')+'"><span class="u">kW</span></div></div>'
      +'<div class="mp-fr"><span class="lab"><span class="req">*</span>负荷调控目标(幅度)</span>'
      +'<div class="mp-unit"><input class="mp-inp" type="number" id="fPct" placeholder="请输入调控幅度，如 15" value="'+(st.targetPct||'')+'"><span class="u">%</span></div></div>'
      +'<div class="mp-fr"><span class="lab"><span class="req">*</span>策略</span>'+this._sel('fLoadStg',E.loadStrategy,st.loadStrategy)
      +'<div class="hint">策略自带调控步长，由 Web 端「策略管理」维护</div></div>'
      +'<div class="mp-fr"><span class="lab">来源</span>'+this._sel('fSource',E.loadSource,st.source)+'</div>';
    return h+'</div>';
  },

  /* ── ③-ultimate 空调控制配置 ── */
  _secUlt(){
    const st=this._st, E=this.E();
    let h='<div class="mp-card"><div class="mp-card-t">空调控制配置</div>';
    h+='<div class="mp-fr"><span class="lab"><span class="req">*</span>下发间隔</span>'
      +'<div class="mp-unit"><input class="mp-inp" type="number" id="fItv" min="5" max="120" value="'+st.interval+'"><span class="u">分钟</span></div>'
      +'<div class="hint">5-120 分钟。示例：生效时间 08:00 至 12:00、下发间隔 30 分钟，则在 08:00、08:30、09:00 … 11:30 各下发一次控制指令。</div></div>'
      +'<div class="mp-fr"><span class="lab">开关机</span>'+this._sel('fUp',E.setPower,st.acPower)+'</div>'
      +'<div class="mp-fr"><span class="lab">空调模式</span>'+this._sel('fUm',E.setMode,st.acMode)+'</div>'
      +'<div class="mp-fr"><span class="lab">温度</span>'
      +'<div class="mp-unit"><input class="mp-inp" type="number" id="fUt" min="16" max="31" step="0.5" placeholder="不设置" value="'+(st.acTemp===''||st.acTemp==null?'':st.acTemp)+'"><span class="u">℃</span></div></div>'
      +'<div class="mp-fr"><span class="lab">风速</span>'+this._sel('fUw',E.setWind,st.acWind)
      +'<div class="hint">选择「不设置」表示不改变空调该项状态；开关机 / 模式 / 温度 / 风速中至少需要设置一项</div></div>';
    return h+'</div>';
  },

  /* ── ④ 生效范围 ── */
  _secScope(){
    const st=this._st;
    if(st.type==='wind'){
      const opts=['全部房间'].concat(this._allFloors().map(f=>f.name));
      return '<div class="mp-card"><div class="mp-card-t">生效范围</div>'
        +'<div class="mp-fr"><span class="lab"><span class="req">*</span>房间范围</span>'
        +this._sel('fRange',opts,st.rangeFloor)
        +'<div class="hint">风水联动按楼层/区域整体下发，粒度为楼层</div></div></div>';
    }
    if(st.type==='load'){
      const fl=this._allFloors();
      return '<div class="mp-card"><div class="mp-card-t">调控范围<span class="more">已选 '+st.rangeFloors.length+' 个</span></div>'
        +'<div class="hint" style="margin:0 0 6px">勾选参与负荷调控的区域</div></div>'
        +'<div class="mp-list" style="margin-top:0" id="rangeList">'
        +fl.map(f=>'<div class="mp-sch-tgt" data-rf="'+f.name+'">'
          +'<span class="mp-check'+(st.rangeFloors.indexOf(f.name)>=0?' on':'')+'"></span>'
          +'<div class="bd">'+f.name+'<div class="t2">'+f.count+' 个房间</div></div>'
        +'</div>').join('')
        +'</div>';
    }
    /* env / ultimate：楼栋 → 楼层 → 房间三级树，楼栋/楼层可整选 */
    let h='<div class="mp-card"><div class="mp-card-t">生效范围<span class="more">已选 '+st.rooms.length+' 个房间</span></div>'
      +'<div class="hint" style="margin:0">勾选本策略作用的房间，楼栋/楼层可整选</div></div>'
      +'<div class="mp-list" style="margin-top:0" id="roomTree">';
    MP.data.buildings.forEach(b=>{
      const bRooms=[];
      b.floors.forEach(f=>f.rooms.forEach(r=>bRooms.push(f.name+r.name)));
      const bSel=bRooms.filter(n=>st.rooms.indexOf(n)>=0).length;
      const bCls=bSel===0?'':(bSel===bRooms.length?'on':'half');
      const bOpen=!!st.treeOpen[b.id];
      h+='<div class="mp-arb-row lv1"><span class="mp-check '+bCls+'" data-ckb="'+b.id+'"></span>'
        +'<div class="bd" data-tgl="'+b.id+'">'+b.name+'</div>'
        +'<span class="mp-sub">'+bRooms.length+' 个房间</span>'
        +'<span class="mp-ar-arrow'+(bOpen?'':' off')+'" data-tgl="'+b.id+'"></span></div>';
      if(!bOpen)return;
      b.floors.forEach(f=>{
        const fRooms=f.rooms.map(r=>f.name+r.name);
        const fSel=fRooms.filter(n=>st.rooms.indexOf(n)>=0).length;
        const fCls=fSel===0?'':(fSel===fRooms.length?'on':'half');
        const fOpen=!!st.treeOpen[f.id];
        h+='<div class="mp-arb-row lv2"><span class="mp-check '+fCls+'" data-ckf="'+b.id+'|'+f.id+'"></span>'
          +'<div class="bd" data-tgl="'+f.id+'">'+f.name+'</div>'
          +'<span class="mp-sub">'+fRooms.length+' 间</span>'
          +'<span class="mp-ar-arrow'+(fOpen?'':' off')+'" data-tgl="'+f.id+'"></span></div>';
        if(!fOpen)return;
        fRooms.forEach(n=>{
          h+='<div class="mp-arb-row lv3" data-ckr="'+n+'"><span class="mp-check'+(st.rooms.indexOf(n)>=0?' on':'')+'"></span>'
            +'<div class="bd">'+n+'</div></div>';
        });
      });
    });
    return h+'</div>';
  },

  /* ══════════ 五、事件绑定 ══════════ */

  _bindBody(el){
    const self=this, st=this._st, E=this.E();
    const $=id=>el.querySelector('#'+id);
    const on=(id,ev,fn)=>{ const n=$(id); if(n)n['on'+ev]=fn; };
    const re=()=>self._renderBody(el);

    /* 基础信息：文本/日期/时间/下拉直写状态（不重渲染，避免输入焦点丢失） */
    on('fName','input',e=>{st.name=e.target.value;});
    on('fMemo','input',e=>{st.memo=e.target.value;});
    on('fDs','change',e=>{st.dateStart=e.target.value;});
    on('fDe','change',e=>{st.dateEnd=e.target.value;});
    on('fTs','change',e=>{st.timeStart=e.target.value;});
    on('fTe','change',e=>{st.timeEnd=e.target.value;});
    on('fAcType','change',e=>{st.acType=e.target.value;});
    on('fDtStart','change',e=>{st.dtStart=e.target.value;});
    on('fDtEnd','change',e=>{st.dtEnd=e.target.value;});
    on('fKw','input',e=>{st.targetKw=e.target.value;});
    on('fPct','input',e=>{st.targetPct=e.target.value;});
    on('fLoadStg','change',e=>{st.loadStrategy=e.target.value;});
    on('fSource','change',e=>{st.source=e.target.value;});
    on('fItv','input',e=>{st.interval=e.target.value;});
    on('fUp','change',e=>{st.acPower=e.target.value;});
    on('fUm','change',e=>{st.acMode=e.target.value;});
    on('fUt','input',e=>{st.acTemp=e.target.value;});
    on('fUw','change',e=>{st.acWind=e.target.value;});
    on('fRange','change',e=>{st.rangeFloor=e.target.value;});
    on('fLib','change',e=>{st.libId=e.target.value;re();});   /* 换策略要刷新下方参数只读区 */

    /* 执行周期 segmented */
    const cyc=$('fCycle');
    if(cyc)cyc.querySelectorAll('.mp-seg-i').forEach(i=>i.onclick=()=>{ st.cycle=i.dataset.c; re(); });

    /* 周重复：七天格 + 快捷 */
    const wk=$('fWeek');
    if(wk)wk.querySelectorAll('.wd').forEach(d=>d.onclick=()=>{
      const v=+d.dataset.d, i=st.weekdays.indexOf(v);
      if(i>=0)st.weekdays.splice(i,1); else st.weekdays.push(v);
      re();
    });
    const wq=$('fWeekQ');
    if(wq)wq.querySelectorAll('.qk').forEach(q=>q.onclick=()=>{
      const k=q.dataset.q;
      if(k==='work')st.weekdays=[1,2,3,4,5];
      else if(k==='end')st.weekdays=[6,7];
      else if(k==='all')st.weekdays=[1,2,3,4,5,6,7];
      else st.weekdays=[];
      re();
    });

    /* 排除日期：添加 / 一键节假日 / 删除 */
    on('fExAdd','click',()=>{
      const v=$('fEx').value;
      if(!v){ MP.ui.toast('请先选择要排除的日期','er'); return; }
      if(st.dateStart&&st.dateEnd&&(v<st.dateStart||v>st.dateEnd)){
        MP.ui.toast('排除日期需在生效日期范围内','er'); return;
      }
      if(st.excludeDates.indexOf(v)>=0){ MP.ui.toast('该日期已在排除列表中'); return; }
      st.excludeDates.push(v); re();
    });
    on('fExHoliday','click',()=>{
      let n=0;
      (MP.data.holidays||[]).forEach(h=>h.dates.forEach(d=>{
        if(st.dateStart&&st.dateEnd&&(d<st.dateStart||d>st.dateEnd))return;   /* 只加生效期内的 */
        if(st.excludeDates.indexOf(d)<0){ st.excludeDates.push(d); n++; }
      }));
      re();
      MP.ui.toast(n?'已排除 '+n+' 个节假日日期':'生效日期范围内没有可排除的节假日',n?'ok':'info');
    });
    const exl=$('fExList');
    if(exl)exl.querySelectorAll('i[data-x]').forEach(x=>x.onclick=()=>{
      st.excludeDates=st.excludeDates.filter(d=>d!==x.dataset.x); re();
    });

    /* ── 触发条件 ── */
    el.querySelectorAll('select[data-condkind]').forEach(s=>s.onchange=()=>{
      const i=+s.dataset.condkind, k=s.value;
      st.conds[i]=k==='human'?{kind:'human',state:'无人'}
        :k==='door'?{kind:'door',state:'关闭'}
        :{kind:k,op:'gt',val:''};
      re();
    });
    el.querySelectorAll('[data-delcond]').forEach(d=>d.onclick=()=>{
      if(st.conds.length<=1){ MP.ui.toast('至少保留 1 个触发条件','er'); return; }
      st.conds.splice(+d.dataset.delcond,1); re();
    });
    el.querySelectorAll('[data-seg="cond"]').forEach(sg=>{
      const i=+sg.dataset.i;
      sg.querySelectorAll('.mp-seg-i').forEach(b=>b.onclick=()=>{ st.conds[i].state=b.dataset.v; re(); });
    });
    el.querySelectorAll('select[id^="condOp"]').forEach(s=>s.onchange=()=>{ st.conds[+s.dataset.i].op=s.value; });
    el.querySelectorAll('input[id^="condVal"]').forEach(n=>n.oninput=()=>{ st.conds[+n.dataset.i].val=n.value; });
    on('btnAddCond','click',()=>{
      if(st.conds.length>=4){ MP.ui.toast('4 类触发条件均已配置，不能继续添加','er'); return; }
      const used=st.conds.map(c=>c.kind);
      const next=E.condKind.map(k=>k[0]).find(k=>used.indexOf(k)<0);
      st.conds.push(next==='human'?{kind:'human',state:'无人'}
        :next==='door'?{kind:'door',state:'关闭'}
        :{kind:next,op:'gt',val:''});
      re();
    });
    on('holdTgl','click',()=>{ st.holdOn=!st.holdOn; re(); });
    on('fHoldMin','input',e=>{ st.holdMin=e.target.value; });

    /* ── 执行动作 ── */
    el.querySelectorAll('select[data-actkind]').forEach(s=>s.onchange=()=>{
      const i=+s.dataset.actkind, k=s.value;
      st.actions[i]=k==='ac'?{kind:'ac',power:'开关不控制',mode:'模式不控制',temp:'',wind:'风速不控制'}
        :k==='lock'?{kind:'lock',lockPower:'开关机不锁定',lockModes:[],lockTemp:'温度不锁定',lockLo:16,lockHi:31}
        :{kind:'delay',min:10};
      re();
    });
    el.querySelectorAll('[data-delact]').forEach(d=>d.onclick=()=>{
      if(st.actions.length<=1){ MP.ui.toast('至少保留 1 个执行动作','er'); return; }
      st.actions.splice(+d.dataset.delact,1); re();
    });
    /* 动作行内的 select / number 统一按 data-i + data-k 回写 */
    el.querySelectorAll('.mp-dyn-row .bd select[data-k],.mp-dyn-row .bd input[data-k]').forEach(n=>{
      const h=()=>{
        const i=+n.dataset.i, k=n.dataset.k;
        if(!st.actions[i])return;
        st.actions[i][k]=n.value;
        if(k==='lockTemp')re();   /* 切到「锁定温度范围」需显现上下限 */
      };
      if(n.tagName==='SELECT')n.onchange=h; else n.oninput=h;
    });
    el.querySelectorAll('[data-lockmode]').forEach(w=>{
      const i=+w.dataset.lockmode;
      w.querySelectorAll('.mp-chip').forEach(c=>c.onclick=()=>{
        const a=st.actions[i]; a.lockModes=a.lockModes||[];
        const v=c.dataset.v, k=a.lockModes.indexOf(v);
        if(k>=0)a.lockModes.splice(k,1); else a.lockModes.push(v);
        re();
      });
    });
    on('btnAddAct','click',()=>{
      if(st.actions.length>=16){ MP.ui.toast('最多 16 个执行动作','er'); return; }
      /* 照搬 Web 默认规则：上一个是控制类动作(空调控制/锁定控制)则新增延时，否则新增空调控制 */
      const last=st.actions[st.actions.length-1];
      st.actions.push(last&&(last.kind==='ac'||last.kind==='lock')
        ? {kind:'delay',min:10}
        : {kind:'ac',power:'开关不控制',mode:'模式不控制',temp:'',wind:'风速不控制'});
      re();
    });

    /* ── 生效范围 ── */
    const rl=$('rangeList');
    if(rl)rl.querySelectorAll('[data-rf]').forEach(r=>r.onclick=()=>{
      const v=r.dataset.rf, i=st.rangeFloors.indexOf(v);
      if(i>=0)st.rangeFloors.splice(i,1); else st.rangeFloors.push(v);
      re();
    });
    const tree=$('roomTree');
    if(tree){
      tree.querySelectorAll('[data-tgl]').forEach(t=>t.onclick=()=>{
        const k=t.dataset.tgl; st.treeOpen[k]=!st.treeOpen[k]; re();
      });
      tree.querySelectorAll('[data-ckb]').forEach(c=>c.onclick=e=>{
        e.stopPropagation();
        const b=MP.data.buildings.find(x=>x.id===c.dataset.ckb);
        const names=[]; b.floors.forEach(f=>f.rooms.forEach(r=>names.push(f.name+r.name)));
        self._toggleGroup(names); re();
      });
      tree.querySelectorAll('[data-ckf]').forEach(c=>c.onclick=e=>{
        e.stopPropagation();
        const p=c.dataset.ckf.split('|');
        const b=MP.data.buildings.find(x=>x.id===p[0]);
        const f=b.floors.find(x=>x.id===p[1]);
        self._toggleGroup(f.rooms.map(r=>f.name+r.name)); re();
      });
      tree.querySelectorAll('[data-ckr]').forEach(r=>r.onclick=()=>{
        const n=r.dataset.ckr, i=st.rooms.indexOf(n);
        if(i>=0)st.rooms.splice(i,1); else st.rooms.push(n);
        re();
      });
    }
  },

  /* 整组勾选：全选中则整组取消，否则整组选中（父级三态勾选的标准行为） */
  _toggleGroup(names){
    const st=this._st;
    const all=names.every(n=>st.rooms.indexOf(n)>=0);
    if(all)st.rooms=st.rooms.filter(n=>names.indexOf(n)<0);
    else names.forEach(n=>{ if(st.rooms.indexOf(n)<0)st.rooms.push(n); });
  },

  /* ══════════ 六、校验（逐条对齐 Web 端） ══════════ */

  _validate(){
    const st=this._st;
    const num=v=>v===''||v==null?null:Number(v);
    if(!(st.name||'').trim())return '请输入任务名称';

    if(st.type==='load'){
      if(!st.dtStart||!st.dtEnd)return '请选择起止时间';
      if(st.dtStart>=st.dtEnd)return '结束时间必须晚于起始时间';
      if(!String(st.targetKw).trim())return '请输入负荷调控目标';
      if(!st.rangeFloors.length)return '请勾选调控范围';
      return '';
    }

    if(!st.dateStart||!st.dateEnd)return st.type==='wind'?'请选择时间范围':'请选择生效日期';
    if(this._cmpDate(st.dateStart,st.dateEnd)>0)return '结束日期不得早于开始日期';

    if(st.type==='wind'){
      if(!st.libId)return '请选择执行策略';
      if(!st.rangeFloor)return '请选择房间范围';
      return '';
    }

    /* env / ultimate 共有：生效时间 / 周重复 / 排除日期 / 房间 */
    if(st.timeStart>=st.timeEnd)return '结束时间必须晚于开始时间';
    if(!st.weekdays.length)return st.type==='env'?'请至少选择一天周重复时间':'请至少选择一天周运行时间';
    const bad=st.excludeDates.find(d=>d<st.dateStart||d>st.dateEnd);
    if(bad)return '排除日期 '+bad+' 不在生效日期范围内';
    if(!st.rooms.length)return '请至少选择一个房间';

    if(st.type==='ultimate'){
      const itv=num(st.interval);
      if(itv==null||!Number.isInteger(itv)||itv<5||itv>120)return '下发间隔需为 5-120 之间的整数';
      const t=num(st.acTemp);
      if(t!=null&&(t<16||t>31))return '温度需在 16-31℃ 之间';
      const any=(st.acPower&&st.acPower!=='不设置')||(st.acMode&&st.acMode!=='不设置')
        ||t!=null||(st.acWind&&st.acWind!=='不设置');
      if(!any)return '开关机、模式、温度、风速中至少需要设置一项';
      return '';
    }

    /* env 触发条件 */
    if(!st.conds.length)return '至少保留 1 个触发条件';
    for(let i=0;i<st.conds.length;i++){
      const c=st.conds[i];
      if(c.kind==='temp'||c.kind==='humi'){
        const v=num(c.val);
        const lo=c.kind==='temp'?-10:1, hi=c.kind==='temp'?50:99;
        const nm=c.kind==='temp'?'温度':'湿度';
        if(v==null)return '请填写'+nm+'条件的阈值';
        if(!Number.isInteger(v)||v<lo||v>hi)return nm+'阈值需为 '+lo+'~'+hi+' 之间的整数';
      }
    }
    if(st.holdOn){
      const m=num(st.holdMin);
      if(m==null||!Number.isInteger(m)||m<1||m>60)return '持续时长需为 1-60 之间的整数';
    }
    /* env 执行动作 */
    if(!st.actions.length)return '至少配置 1 个执行动作';
    if(st.actions.length>16)return '最多 16 个执行动作';
    for(let i=1;i<st.actions.length;i++)if(st.actions[i-1].kind===st.actions[i].kind)return '第 '+(i+1)+' 个动作与上一个相同，相邻动作不允许相同';
    /* 控制类动作(空调控制/锁定控制)后必须紧跟延时,末位动作除外:对齐 Web 端 V1.2 */
    for(let i=0;i<st.actions.length-1;i++){const k=st.actions[i].kind;if((k==='ac'||k==='lock')&&st.actions[i+1].kind!=='delay')return '第 '+(i+1)+' 个控制类动作后必须紧跟一个延时动作';}
    for(let i=0;i<st.actions.length;i++){
      const a=st.actions[i];
      if(a.kind==='ac'){
        const t=num(a.temp);
        const any=(a.power&&a.power!=='开关不控制')||(a.mode&&a.mode!=='模式不控制')
          ||t!=null||(a.wind&&a.wind!=='风速不控制');
        if(!any)return '第 '+(i+1)+' 个空调控制动作至少需要选择一个控制参数';
        if(t!=null&&(!Number.isInteger(t)||t<16||t>31))return '第 '+(i+1)+' 个动作的温度需为 16-31℃ 的整数';
      }else if(a.kind==='delay'){
        const m=num(a.min);
        if(m==null||!Number.isInteger(m)||m<5||m>240)return '第 '+(i+1)+' 个延时需为 5-240 分钟的整数';
      }else{
        const lm=a.lockModes||[];
        if(lm.indexOf('制热')>=0&&(lm.indexOf('制冷')>=0||lm.indexOf('除湿')>=0))
          return '第 '+(i+1)+' 个动作：制热不能与制冷或除湿同时锁定';
        if(a.lockTemp==='锁定温度范围'&&Number(a.lockLo)>Number(a.lockHi))
          return '第 '+(i+1)+' 个动作：锁定温度下限不得高于上限';
      }
    }
    if(st.actions[st.actions.length-1].kind==='delay')return '最后一个执行动作不能是延时';
    return '';
  },

  /* ══════════ 七、挂载与保存 ══════════ */

  mount(el,params){
    const self=this, id=params&&params.id;
    const s=id?MP.q.strategies().find(x=>x.id===id):null;
    if(id&&!s)return;
    document.getElementById('nb-title').textContent=id?'编辑策略':'新增策略';
    const st=this._st;

    /* 类型 4 chip 单选：仅新增态可切换；切换后整表重置为该类型空白初值 */
    if(!s){
      el.querySelectorAll('#typeChips .mp-chip').forEach(c=>c.onclick=()=>{
        const keepName=st.name;
        self._st=self._blank(c.dataset.t);
        self._st.name=keepName;   /* 已输入的名称跨类型保留，避免误清 */
        el.querySelectorAll('#typeChips .mp-chip').forEach(x=>x.classList.toggle('on',x===c));
        self._renderBody(el);
      });
    }

    el.querySelector('#btnSave').onclick=()=>{
      const cur=self._st;
      const err=self._validate();
      if(err){ MP.ui.toast(err,'er'); return; }

      const rec={
        id:id||('st'+Date.now()),
        type:cur.type, name:cur.name.trim(), enabled:s?s.enabled:true,
        memo:cur.memo,
      };
      if(cur.type==='load'){
        Object.assign(rec,{acType:cur.acType,dtStart:cur.dtStart,dtEnd:cur.dtEnd,
          targetKw:cur.targetKw,targetPct:cur.targetPct,loadStrategy:cur.loadStrategy,
          source:cur.source,rangeFloors:cur.rangeFloors.slice()});
      }else if(cur.type==='wind'){
        Object.assign(rec,{dateStart:cur.dateStart,dateEnd:cur.dateEnd,cycle:cur.cycle,
          libId:cur.libId,rangeFloor:cur.rangeFloor});
      }else{
        Object.assign(rec,{dateStart:cur.dateStart,dateEnd:cur.dateEnd,
          timeStart:cur.timeStart,timeEnd:cur.timeEnd,
          weekdays:cur.weekdays.slice().sort(),excludeDates:cur.excludeDates.slice().sort(),
          rooms:cur.rooms.slice()});
        if(cur.type==='env'){
          Object.assign(rec,{conds:JSON.parse(JSON.stringify(cur.conds)),
            holdOn:cur.holdOn,holdMin:Number(cur.holdMin),
            actions:JSON.parse(JSON.stringify(cur.actions))});
        }else{
          Object.assign(rec,{interval:Number(cur.interval),acPower:cur.acPower,acMode:cur.acMode,
            acTemp:cur.acTemp===''||cur.acTemp==null?null:Number(cur.acTemp),acWind:cur.acWind});
        }
      }
      rec.desc=self.summ(rec);
      rec.targetName=self._targetName(cur);

      const list=MP.q.strategies();
      if(id){
        const i=list.findIndex(x=>x.id===id);
        if(i>=0)list[i]=rec;
      }else list.push(rec);
      MP.q.saveStrategies(list);
      MP.back();
      /* 极致节能对齐 Web 端「保存并启用任务」的成功提示口径 */
      MP.ui.toast(cur.type==='ultimate'
        ? '已保存，将每 '+rec.interval+' 分钟下发一次'
        : '已保存','ok');
    };
  },
};
