/* ============================================================
   共享计费网关数据源(_billing-gw.js)
   计费网关列表(sys-bill-gw) ↔ 控制器管理/电表管理/电费相关页面 联动核心:
   - 判定口径:设备 SN 在计费网关列表内 = 计费版本(是),否则 = 否
   - localStorage 持久化:计费网关列表页增删即时写入,各页加载时读取同一份数据
   - 演示场景:B2-2(fa…0343)不在列表内 → 控制器管理显示"是否计费版本:否",
     电表管理添加/绑定界面不列出该网关,其下 7/21 层房间电费/当量/日使用数据为 0;
     在「系统管理-计费网关列表」添加该 SN 后,各页面刷新即恢复
   ============================================================ */
window.HvacBillingGw=(function(){
  const KEY='hvacBillingGwV1';

  /* 默认列表:前 9 条取自计费网关列表页线上截图,
     后 7 条为本项目计费设备(5 台抄表器 + B2-1 集控网关 + 1 台 F16G 温控器) */
  const SEED=[
    {sn:'fa000001400001240251025000300067',date:'2026-07-02',by:'chuhuojilu',remark:''},
    {sn:'fa000001400001240251025000300112',date:'2026-06-18',by:'chuhuojilu',remark:''},
    {sn:'fa000001400001240242118000200093',date:'2026-06-05',by:'chuhuojilu2',remark:''},
    {sn:'fa000001400001240242118000200041',date:'2026-05-29',by:'chuhuojilu2',remark:''},
    {sn:'fa000001400001240239067000200188',date:'2026-05-16',by:'chuhuojilu',remark:''},
    {sn:'fa000001400001240239067000200127',date:'2026-05-16',by:'chuhuojilu',remark:''},
    {sn:'fa000001400001240225034000100076',date:'2026-04-22',by:'chuhuojilu2',remark:''},
    {sn:'fa000001400001240225034000100031',date:'2026-04-09',by:'chuhuojilu',remark:''},
    {sn:'fa000001400001240211012000100009',date:'2026-03-27',by:'chuhuojilu',remark:''},
    {sn:'391df10258d42f83cee49c9e6ee0efa4',date:'2025-06-27',by:'chuhuojilu',remark:'B2栋21~25层抄表器'},
    {sn:'275b647a7878e52540b69c9e6ee02b4c',date:'2025-06-27',by:'chuhuojilu',remark:'B2栋16~20层抄表器'},
    {sn:'861d5345da5643d49dbd9c9e6edf7370',date:'2025-06-27',by:'chuhuojilu',remark:'B2栋11~15层抄表器'},
    {sn:'a176334174880a5db4679c9e6ea66b30',date:'2025-06-27',by:'chuhuojilu',remark:'B2栋6~10层抄表器'},
    {sn:'aec0109604dd731c62659c9e6ee291b4',date:'2025-06-27',by:'chuhuojilu',remark:'B2栋3~5层抄表器'},
    {sn:'fa000001400001240240614000100379',date:'2025-06-24',by:'chuhuojilu',remark:'B2-1集控网关(计费)'},
    {sn:'e2048988197047e7c3f982ff0c2c4f908',date:'2025-03-07',by:'chuhuojilu2',remark:'F16G温控器(计费)'}
  ];

  function load(){
    try{
      const v=JSON.parse(localStorage.getItem(KEY)||'null');
      if(Array.isArray(v)&&v.length)return v;
    }catch(e){}
    save(SEED);return SEED.slice();
  }
  function save(list){try{localStorage.setItem(KEY,JSON.stringify(list));}catch(e){}}

  return {
    list:()=>load(),
    /* SN 是否在计费网关列表内(忽略大小写) */
    isBilling(sn){return load().some(r=>r.sn.toLowerCase()===String(sn).toLowerCase());},
    /* 批量添加(新条目置顶,与本页现有交互一致) */
    addSns(sns,remark,by,date){
      const list=load();
      sns.forEach(sn=>list.unshift({sn:String(sn).toLowerCase(),date,by,remark:remark||''}));
      save(list);
    },
    remove(sns){
      const del=new Set(sns.map(s=>String(s).toLowerCase()));
      save(load().filter(r=>!del.has(r.sn.toLowerCase())));
    }
  };
})();
