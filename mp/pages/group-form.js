/* 群组表单（MP.pages.group-form，二级页）：新增/编辑复用同一页，URL 参数 ?id 区分（无 id=新增，有 id=编辑）
   表单：群组名称（必填，红色 *，限 10 字对齐 Web 端弹窗）；选择设备——按房间分组勾选列表，
   房间父级勾选联动（全选 on / 半选 half / 无）；底部固定「保存」→ 校验 → saveGroups 持久化 → MP.back() + toast */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['group-form']={
  title:'群组表单',   /* 占位标题；mount 中按新增/编辑覆盖为「新增群组/编辑群组」 */
  note:[
    {type:'优化',text:'Web 弹窗表单改为独立表单页，新增/编辑复用'},
    {type:'优化',text:'设备选择按房间分组，父级勾选联动全选/半选'},
  ],

  /* 房间分组：按 MP.data.devices 的 room 字段出现顺序去重
     （room 为空串的设备——如 R7 追加的待绑定新机 d19/d20——不参与分组，否则会渲染出一个无标题空分组头） */
  _rooms(){
    const order=[];
    MP.data.devices.forEach(d=>{ if(d.room&&order.indexOf(d.room)<0)order.push(d.room); });
    return order.map(r=>({room:r,devs:MP.data.devices.filter(d=>d.room===r)}));
  },

  render(el,params){
    const id=params&&params.id;
    const g=id?MP.q.groups().find(x=>x.id===id):null;
    if(id&&!g){
      el.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('group')+'</div><div class="tx">未找到该群组</div></div>';
      return;
    }
    /* 勾选集：编辑时回填群组已有设备（过滤掉已不存在的设备 id） */
    this._sel=new Set(g?g.deviceIds.filter(did=>MP.data.devices.some(d=>d.id===did)):[]);
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        +'<div class="mp-card">'
          +'<div class="mp-field"><span class="lab"><span class="req">*</span>群组名称</span>'
          +'<input id="gName" maxlength="10" placeholder="请输入群组名称" value="'+(g?g.name:'')+'"></div>'
        +'</div>'
        +'<div class="mp-sec">选择设备（已选 <span id="selCnt">0</span> 台）</div>'
        +'<div class="mp-list" id="roomList"></div>'
      +'</div>'
      +'<div class="mp-footer"><button class="mp-btn mp-btn-primary mp-btn-block" id="btnSave">保存</button></div>'
    +'</div>';
    this._refreshRooms(el);
  },

  /* 房间勾选区重渲染：父级 全选 on / 半选 half / 无；子级按 _sel 勾选 */
  _refreshRooms(el){
    const self=this;
    const box=el.querySelector('#roomList');
    box.innerHTML=this._rooms().map(rg=>{
      const ids=rg.devs.map(d=>d.id);
      const n=ids.filter(id=>self._sel.has(id)).length;
      const st=n===0?'':(n===ids.length?' on':' half');
      const rows=rg.devs.map(d=>
        '<div class="mp-room-row" data-did="'+d.id+'">'
          +'<span class="mp-check'+(self._sel.has(d.id)?' on':'')+'"></span>'
          +'<div class="bd"><div class="t1">'+d.name+'</div></div>'
          +'<span class="mp-tag '+(d.online?(d.power?'tag-ok">开机':'tag-info">关机'):'tag-info">离线')+'</span>'
        +'</div>').join('');
      return '<div class="mp-room-grp">'
        +'<div class="mp-room-head" data-room="'+rg.room+'">'
          +'<span class="mp-check'+st+'"></span>'
          +'<div class="bd">'+rg.room+'</div>'
          +'<span class="mp-sub">'+n+'/'+ids.length+'</span>'
        +'</div>'+rows
      +'</div>';
    }).join('');
    el.querySelector('#selCnt').textContent=this._sel.size;

    /* 父级勾选联动：本房间全选 → 点击清空；未全选（含半选）→ 点击全选 */
    box.querySelectorAll('.mp-room-head').forEach(h=>h.onclick=()=>{
      const rg=self._rooms().find(x=>x.room===h.dataset.room);
      const ids=rg.devs.map(d=>d.id);
      const all=ids.every(id=>self._sel.has(id));
      ids.forEach(id=>{ if(all)self._sel.delete(id); else self._sel.add(id); });
      self._refreshRooms(el);
    });
    /* 子级勾选：切换单台 */
    box.querySelectorAll('.mp-room-row').forEach(r=>r.onclick=()=>{
      const id=r.dataset.did;
      if(self._sel.has(id))self._sel.delete(id); else self._sel.add(id);
      self._refreshRooms(el);
    });
  },

  mount(el,params){
    const self=this, id=params&&params.id;
    if(id&&!MP.q.groups().some(x=>x.id===id))return;   /* 群组不存在时 render 已给空态 */
    document.getElementById('nb-title').textContent=id?'编辑群组':'新增群组';
    el.querySelector('#btnSave').onclick=()=>{
      const name=el.querySelector('#gName').value.trim();
      if(!name){ MP.ui.toast('请输入群组名称','er'); return; }
      if(!self._sel.size){ MP.ui.toast('请至少选择 1 台设备','er'); return; }
      const list=MP.q.groups();
      if(id){
        const g=list.find(x=>x.id===id);
        if(g){ g.name=name; g.deviceIds=Array.from(self._sel); }
      }else{
        list.push({id:'g'+Date.now(),name:name,deviceIds:Array.from(self._sel)});
      }
      MP.q.saveGroups(list);
      MP.back();
      MP.ui.toast('已保存','ok');
    };
  },
};
