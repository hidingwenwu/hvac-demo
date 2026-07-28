/* ============================================================
   共享机队数据源(_fleet.js)
   空调与房间关系(device-ac-room) ↔ 空调控制(ctrl-ac) 联动核心:
   - 唯一权威机队:620 台内机(楼栋/楼层/房间/内机地址/内机标识名称/容量/租户/绑定态)
   - localStorage 持久化:绑定/解绑/标识名称/容量/租户/新建建筑 修改即时写入
   - 两页加载时读取同一份数据,天然保持对应同步
   ============================================================ */
window.HvacFleet=(function(){
  const KEY='hvacFleetV2';
  const FLOORS=[3,7,9,14,23];

  /* 默认机队:与空调控制页楼层分布一致(3/7/9/14/23 层,每层 124 台,共 620)
     内机标识名称默认空(现网常态:大部分不设定) */
  function gen(){
    const units=[];let n=0;
    FLOORS.forEach(fl=>{
      for(let i=1;i<=124&&units.length<620;i++){
        const room=fl*100+((i-1)%28)+1;
        units.push({
          uid:n,bld:'1号楼',fl,room:String(room),
          addr:`${1+n%2}-${1+n%3}-${fl<10?fl:fl+16}-${1+n%8}`,
          name:'',                                   /* 内机标识名称 */
          cap:[70,45,56,70][n%4],                    /* 容量(关系页口径) */
          capKw:['2.2kW','2.8kW','3.6kW'][n%3],      /* 容量(控制页详情口径) */
          tenant:n%4===3?'飞奕':'产品部',
          bound:n<618                                /* 默认 2 台未绑定 */
        });
        n++;
      }
    });
    return units;
  }

  function load(){
    try{
      const d=JSON.parse(localStorage.getItem(KEY)||'null');
      if(d&&Array.isArray(d.units)&&d.units.length)return d;
    }catch(e){}
    return {units:gen(),extra:[]};                   /* extra:新建的空建筑节点 [{bld,fl,room}] */
  }
  function save(store){
    try{localStorage.setItem(KEY,JSON.stringify({units:store.units,extra:store.extra||[]}));}catch(e){}
  }

  /* 建筑树:机队 bld/fl/room 聚合 + 新建空节点,输出 [{name,type,children}] 三级 */
  function tree(store){
    const blds={};
    const ensure=(b,f,r)=>{
      const bld=blds[b]=blds[b]||{name:b,type:'楼栋',open:false,children:{}};
      const fl=bld.children[f]=bld.children[f]||{name:f,type:'楼层',open:false,children:new Set()};
      if(r)fl.children.add(r);
    };
    store.units.forEach(u=>ensure(u.bld,u.fl+'层',u.room));
    (store.extra||[]).forEach(n=>ensure(n.bld,n.fl,n.room));
    return Object.values(blds).map(b=>({
      name:b.name,type:b.type,open:b.open,
      children:Object.values(b.children).map(f=>({
        name:f.name,type:f.type,open:f.open,
        children:[...f.children].sort((a,b2)=>a.localeCompare(b2,'zh-Hans-CN',{numeric:true})).map(r=>({name:r,type:'房间'}))
      })).sort((a,b2)=>a.name.localeCompare(b2.name,'zh-Hans-CN',{numeric:true}))
    })).sort((a,b2)=>a.name.localeCompare(b2.name,'zh-Hans-CN',{numeric:true}));
  }

  return {load,save,tree,FLOORS};
})();
