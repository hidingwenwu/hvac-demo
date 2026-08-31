/* ============================================================
   共享机队数据源(_fleet.js)
   空调与房间关系(device-ac-room) ↔ 空调控制(ctrl-ac) 联动核心:
   - 机队按项目隔离:以 fyProj 项目名为 key 分存,壳层切换项目后各页即得本项目机队
   - 两类租户示例风格:
     物业型(平台测试_新计费/二次分摊-H):项目内仅一个物业租户,房间名即租户名(商铺)
     常规型(其余项目):租户为公司名,房间为正常房号
   - localStorage 持久化:绑定/解绑/标识名称/容量/租户/新建建筑 修改即时写入(按项目各自存取)
   - 两页加载时读取同一份数据,天然保持对应同步
   ============================================================ */
window.HvacFleet=(function(){
  const KEY='hvacFleetV2';
  const DEFAULT_PROJECT='产品部测试-按小时预付费';
  const FLOORS=[3,7,9,14,23];

  function projName(){
    try{const p=JSON.parse(localStorage.getItem('fyProj')||'null');if(p&&p.name)return p.name;}catch(e){}
    return DEFAULT_PROJECT;
  }
  function storeKey(){return KEY+':'+projName();}

  /* 默认机队(产品部测试-按小时预付费):与空调控制页楼层分布一致(3/7/9/14/23 层,每层 124 台,共 620)
     内机标识名称默认空(现网常态:大部分不设定) */
  function genDefault(){
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

  /* 各项目机队种子:
     property  → 物业型:全部内机挂在唯一物业租户下,房间名即租户名
     tenants   → 常规型:按房间轮转分配公司租户,空串表示该房间暂未分配租户 */
  const SEEDS={
    '平台测试_新计费':{
      property:'恒信物业',
      buildings:[{bld:'A座',floors:[
        {fl:1,rooms:['晨光咖啡','每日便利店','鲜果茶饮','优品生活馆','康正大药房','快剪美发','川味火锅','拾光书店'],units:3},
        {fl:2,rooms:['型动健身','妈咪宝贝','樱花美甲','乐学培训','宠物生活馆','数码潮品','美妆集合店','茶艺馆'],units:3},
        {fl:3,rooms:['星聚影院','电玩城','儿童乐园','量贩KTV','台球俱乐部','美食广场'],units:4}
      ]}]
    },
    '二次分摊-H':{
      property:'恒安物业',
      buildings:[{bld:'H座',floors:[
        {fl:1,rooms:['邻里超市','一路飘香餐饮','悦读咖啡','口腔诊所','房产中介','花间花店','麦香烘焙'],units:3},
        {fl:2,rooms:['24小时健身','绘本馆','明亮眼镜','手机快修','洁净干洗','图文快印'],units:3}
      ]}]
    },
    '分摊计费-ly':{
      tenants:['蓝海科技','云启信息','恒润贸易','博雅咨询',''],
      buildings:[
        {bld:'1号楼',floors:[{fl:5,rooms:20,units:3},{fl:6,rooms:20,units:3}]},
        {bld:'2号楼',floors:[{fl:3,rooms:16,units:3},{fl:4,rooms:16,units:3}]}
      ]
    },
    '平台测试_后付费':{
      tenants:['晨曦广告','众合律所','大成装饰','优选电商',''],
      buildings:[{bld:'1号楼',floors:[{fl:2,rooms:16,units:3},{fl:3,rooms:16,units:3},{fl:5,rooms:16,units:3}]}]
    },
    '001':{
      tenants:['启明工作室','远航物流',''],
      buildings:[{bld:'1号楼',floors:[{fl:1,rooms:10,units:2},{fl:2,rooms:10,units:2}]}]
    }
  };

  function genSpec(spec){
    const units=[];let n=0;
    spec.buildings.forEach(b=>{
      b.floors.forEach(f=>{
        const names=Array.isArray(f.rooms)?f.rooms:Array.from({length:f.rooms},(_,i)=>String(f.fl*100+i+1));
        names.forEach((room,ri)=>{
          const count=f.units||3;
          const tenant=spec.property?spec.property:(spec.tenants[ri%spec.tenants.length]||'');
          for(let k=0;k<count;k++){
            units.push({
              uid:n,bld:b.bld,fl:f.fl,room,
              addr:`${1+n%2}-${1+n%3}-${f.fl<10?f.fl:f.fl+16}-${1+n%8}`,
              name:'',
              cap:[70,45,56,70][n%4],
              capKw:['2.2kW','2.8kW','3.6kW'][n%3],
              tenant,
              bound:true
            });
            n++;
          }
        });
      });
    });
    /* 每个项目留 2 台未绑定示例 */
    if(units.length>2){units[units.length-1].bound=false;units[units.length-2].bound=false;}
    return units;
  }

  function gen(name){return SEEDS[name]?genSpec(SEEDS[name]):genDefault();}

  function load(){
    try{
      const d=JSON.parse(localStorage.getItem(storeKey())||'null');
      if(d&&Array.isArray(d.units)&&d.units.length)return d;
      /* 旧版全局机队仅归属于默认项目,首次访问时迁移一次 */
      if(projName()===DEFAULT_PROJECT){
        const legacy=JSON.parse(localStorage.getItem(KEY)||'null');
        if(legacy&&Array.isArray(legacy.units)&&legacy.units.length){
          const store={units:legacy.units,extra:legacy.extra||[]};
          try{localStorage.setItem(storeKey(),JSON.stringify(store));localStorage.removeItem(KEY);}catch(e){}
          return store;
        }
      }
    }catch(e){}
    return {units:gen(projName()),extra:[]};         /* extra:新建的空建筑节点 [{bld,fl,room}] */
  }
  function save(store){
    try{localStorage.setItem(storeKey(),JSON.stringify({units:store.units,extra:store.extra||[]}));}catch(e){}
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

  return {load,save,tree,FLOORS,key:storeKey,gen};
})();
