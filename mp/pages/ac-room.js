/* 空调与房间关系（MP.pages['ac-room']，二级页★）：对应 Web 端「项目及设备管理-空调与房间关系」pages/device-ac-room.html
   R7：MP.acRoom 共用对象扩展 buildings()/locate() 两个只读方法（楼栋/楼层/房间三级注册表 + 房间名反查楼栋楼层），
   供 ac-room-bind 现场连续绑定流下钻选点；本列表页在房间分组头的房间名前挂一个楼栋小标注（.mp-ar-bd）。
   绑定关系数据模型：设备对象的 room 归属。覆盖层 MP.store('acRoomBinds') 为 {deviceId: roomName} 映射，
   读取优先取覆盖层、无覆盖回退 device.room；解绑=映射为 ''（空串=未绑定），绑定=映射为房间名。
   页面结构：顶部「+ 绑定空调」主色按钮 → 按房间分组的折叠列表（房间行点击折叠/展开，
   展开显示已绑空调行：设备名/SN/在线 tag + 右侧「解绑」文字钮，confirm 二次确认 → 持久化 + 重渲染 + toast）
   → 底部「未绑定设备」分组（room 为空的设备列出，便于看到可绑资源）；无任何设备时显示空态 */
window.MP=window.MP||{};MP.pages=MP.pages||{};

/* ── 绑定关系共用工具（ac-room / ac-room-bind / controller 三页共用，避免两份实现漂移） ── */
MP.acRoom={
  /* 覆盖层读取：未初始化时给两台演示种子（d17/d18 未绑定，便于首访演示绑定流程），仅内存回退、首次增删改时才落盘 */
  map(){ return MP.store.get('acRoomBinds')||{d17:'',d18:''}; },
  /* 设备当前归属房间：覆盖层优先（含 ''=未绑定），无覆盖回退 device.room */
  roomOf(d){ const m=this.map(); return (d.id in m)?m[d.id]:(d.room||''); },
  /* 设备 SN：与 device-detail 同一生成惯例 */
  snOf(d){ return 'FY-AC-2026-'+String(parseInt(d.id.slice(1),10)).padStart(4,'0'); },
  /* 已有房间清单：按 devices 顺序去重（只列非空），覆盖层新房间随被绑设备位置出现 */
  rooms(){
    const order=[];
    MP.data.devices.forEach(d=>{ const r=this.roomOf(d); if(r&&order.indexOf(r)<0)order.push(r); },this);
    return order;
  },
  bind(ids,room){ const m=this.map(); ids.forEach(id=>{ m[id]=room; }); MP.store.set('acRoomBinds',m); },
  unbind(id){ const m=this.map(); m[id]=''; MP.store.set('acRoomBinds',m); },
  /* 楼栋/楼层/房间三级注册表（R7 新增，只读，供 ac-room-bind 现场绑定流的下钻选点用）：
     与 rooms() 的区别——rooms() 只列「已有设备绑定」的房间，buildings() 是全量选点注册表（含空房间） */
  buildings(){ return MP.data.buildings; },
  /* 反查扁平房间显示名属于哪个楼栋/楼层（R7 新增）：返回 {building,floor}，找不到返回 null
     （房间显示名 = 楼层名+房间名拼接；调用方需静默降级不报错，如「未绑定设备」这类非真实房间名） */
  locate(roomName){
    for(const b of MP.data.buildings){
      for(const f of b.floors){
        for(const r of f.rooms){
          if(f.name+r.name===roomName)return {building:b,floor:f};
        }
      }
    }
    return null;
  },
};

MP.pages['ac-room']={
  title:'空调与房间关系',
  note:[
    {type:'优化',text:'Web 端三段式绑定面板改为按房间分组折叠列表，绑定/解绑直达'},
    {type:'新增',text:'移动端保留绑定能力为高频运维场景（现场调房间即改）'},
    {type:'简化',text:'Web 端楼栋/楼层/房间三级树简化为房间一级分组'},
  ],

  /* 房间分组：按 MP.acRoom.rooms() 顺序，每组取当前已绑设备；末尾追加「未绑定设备」分组 */
  _groups(){
    const gs=MP.acRoom.rooms().map(r=>({room:r,devs:MP.data.devices.filter(d=>MP.acRoom.roomOf(d)===r)}));
    const un=MP.data.devices.filter(d=>!MP.acRoom.roomOf(d));
    if(un.length)gs.push({room:'未绑定设备',devs:un,unbound:true});
    return gs;
  },

  render(el){
    this._collapsed=new Set();   /* 折叠态：进入页面默认全部展开 */
    el.innerHTML='<div class="mp-fill">'
      +'<div class="grow">'
        +'<button class="mp-btn mp-btn-primary mp-btn-block" id="btnBind">＋ 绑定空调</button>'
        +'<div id="roomBox"></div>'
      +'</div>'
    +'</div>';
    this._refresh(el);
  },

  /* 分组列表重渲染：房间行（房间名 + 已绑 N 台 + 展开箭头）→ 展开时列出已绑空调行 */
  _refresh(el){
    const self=this, box=el.querySelector('#roomBox');
    const gs=this._groups();
    if(!MP.data.devices.length){
      box.innerHTML='<div class="mp-empty"><div class="ic">'+MP.icon('bind')+'</div><div class="tx">暂无设备</div></div>';
      return;
    }
    box.innerHTML=gs.map(g=>{
      const collapsed=self._collapsed.has(g.room);
      const rows=collapsed?'':g.devs.map(d=>{
        const right=g.unbound
          ? '<span class="mp-tag tag-wn">未绑定</span>'
          : '<span class="mp-ar-unbind" data-unbind="'+d.id+'">解绑</span>';
        return '<div class="mp-room-row" data-did="'+d.id+'">'
          +'<div class="bd"><div class="t1">'+d.name+'</div><div class="t2">'+MP.acRoom.snOf(d)+'</div></div>'
          +'<span class="mp-tag '+(d.online?'tag-ok">在线':'tag-info">离线')+'</span>'
          +right
        +'</div>';
      }).join('');
      /* 楼栋小标注（R7）：房间名前挂所属楼栋，locate 取不到（如「未绑定设备」分组）则不显示，文案原样保留 */
      const loc=g.unbound?null:MP.acRoom.locate(g.room);
      const bdTag=loc?'<span class="mp-ar-bd">'+loc.building.name+'</span>':'';
      return '<div class="mp-list mp-ar-grp">'
        +'<div class="mp-room-head" data-room="'+g.room+'">'
          +'<span class="mp-ar-arrow'+(collapsed?' off':'')+'"></span>'
          +'<div class="bd">'+bdTag+g.room+'</div>'
          +'<span class="mp-sub">'+(g.unbound?'':'已绑 ')+g.devs.length+' 台</span>'
        +'</div>'+rows
      +'</div>';
    }).join('');

    /* 房间行：点击折叠/展开 */
    box.querySelectorAll('.mp-room-head').forEach(h=>h.onclick=()=>{
      const r=h.dataset.room;
      if(self._collapsed.has(r))self._collapsed.delete(r); else self._collapsed.add(r);
      self._refresh(el);
    });
    /* 解绑：confirm 二次确认 → 持久化（覆盖层映射为 ''）→ 重渲染 + toast */
    box.querySelectorAll('.mp-ar-unbind').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const d=MP.data.devices.find(x=>x.id===b.dataset.unbind);
      if(!d)return;
      const room=MP.acRoom.roomOf(d);
      MP.ui.confirm({title:'解除绑定',text:'将「'+d.name+'」从「'+room+'」解绑？',okText:'解绑',danger:true},()=>{
        MP.acRoom.unbind(d.id);
        self._refresh(el);
        MP.ui.toast('已解绑「'+d.name+'」','ok');
      });
    });
  },

  mount(el){
    el.querySelector('#btnBind').onclick=()=>MP.go('ac-room-bind');
  },
};
