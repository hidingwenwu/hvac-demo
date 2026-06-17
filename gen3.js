const fs=require('fs'),pt=require('path');
const O='D:/BaiduSyncdisk/丁文武/原型网页文件/集控计费平台原型/pages';
const ok=s=>`<span class="tag tok">${s}</span>`;
const er=s=>`<span class="tag ter">${s}</span>`;
const wn=s=>`<span class="tag twn">${s}</span>`;
const tn=s=>`<span class="tag tin">${s}</span>`;
const W=(t,body)=>`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${t}</title><link rel="stylesheet" href="_base.css"></head><body>${body}</body></html>`;
const TP=(t,sts,fis,cols,rows,act='')=>{
  const sc=sts.length?`<div class="sc">${sts.map(([v,c,l])=>`<div class="scd"><div class="sc-lb">${l}</div><div class="sc-v ${c}">${v}</div></div>`).join('')}</div>`:'';
  const fb=fis.length?`<div class="fb">${fis.map(([l,i])=>`<div class="fi"><div class="fl">${l}</div>${i}</div>`).join('')}<button class="btn btnp">查询</button><button class="btn">重置</button></div>`:'';
  const tw=`<div class="tw"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="pg"><div class="pg-info">共${rows.length*4}条</div><div class="pgr"><span class="pgb pga">1</span><span class="pgb">2</span><span class="pgb">›</span></div></div></div>`;
  return W(t,`<div class="ph"><div class="pt">${t}</div><div class="pa">${act}</div></div>${sc}${fb}${tw}`);
};
const si=(ph,w=130)=>`<input placeholder="${ph}" style="width:${w}px">`;
const ss=(os,w=120)=>`<select style="width:${w}px"><option value="">全部</option>${os.map(o=>`<option>${o}</option>`).join('')}</select>`;
const sd=()=>`<input type="date" style="width:130px">`;
const sdr=()=>`${sd()} <span style="color:var(--ts);font-size:12px">至</span> ${sd()}`;

const pages={

'ctrl-fault': TP('故障记录',
  [['3','scr','当前故障'],['12','scw','本月故障'],['98.8%','scg','7日正常率']],
  [['所属项目',ss(['上海某商业广场','北京某写字楼'],160)],['空调/位置',si('请输入',130)],['故障类型',ss(['通信故障','传感器故障','压缩机故障','其他'])],['状态',ss(['活跃','已恢复'],100)]],
  ['序号','空调名称','安装位置','控制器','通道','品牌','型号','设定温度(℃)','回风温度(℃)','故障描述','上报时间','状态'],
  [[1,'1F-大厅-03','一楼大厅','CTR001','CH03','大金','FTXS35K2V1B','26','—','E3:通信故障','2026-06-10 11:20',er('故障')],
   [2,'3F-储藏-01','三楼储藏室','CTR003','CH01','美的','KFR-35GW','—','—','E6:传感器异常','2026-06-09 15:44',wn('待确认')],
   [3,'B1-餐饮-02','B1餐饮区','CTR005','CH04','格力','KFR-72LW','24','32.1','F1:过热保护','2026-06-09 08:30',er('故障')]],
  `<button class="btn">导出</button>`),

'ctrl-onoff': TP('开关机记录',
  [],
  [['所属项目',ss(['上海某商业广场','全部'],160)],['空调名称',si('请输入',140)],['动作',ss(['开机','关机'],100)],['时间范围',sdr()]],
  ['序号','空调名称','安装位置','动作','操作方式','操作人','操作时间'],
  [[1,'1F-大厅-01','一楼大厅',ok('开机'),'日程','系统自动','2026-06-10 08:00:00'],
   [2,'1F-大厅-02','一楼大厅',ok('开机'),'日程','系统自动','2026-06-10 08:00:02'],
   [3,'2F-会议室-01','二楼大会议室',ok('开机'),'手动','op_user1','2026-06-10 09:02:15'],
   [4,'2F-办公区-01','二楼开放办公区',ok('开机'),'策略','系统自动','2026-06-10 08:45:30'],
   [5,'B1-餐饮-01','B1餐饮区',er('关机'),'手动','op_user2','2026-06-10 22:00:10'],
   [6,'2F-会议室-01','二楼大会议室',er('关机'),'手动','op_user1','2026-06-10 18:05:00'],
   [7,'1F-大厅-01','一楼大厅',er('关机'),'日程','系统自动','2026-06-09 22:00:00']],
  `<button class="btn">导出</button>`),

'strategy-wind': TP('风水联动',
  [['12','scc','联动设备'],['10','scg','策略生效'],['2','scr','异常']],
  [['所属项目',ss(['上海某商业广场','北京某写字楼'],160)],['设备名称',si('请输入',140)]],
  ['设备名称','连接地址','回风温度(℃)','送风温度(℃)','防冻温度(℃)','进水温度(℃)','出水温度(℃)','策略状态','操作'],
  [['冷水机组-01','192.168.10.201','12.5','7.2','3.1','12.0','7.0',ok('正常运行'),'<div class="op"><a>详情</a><a>设置</a></div>'],
   ['冷水机组-02','192.168.10.202','13.1','7.5','3.4','12.8','7.3',ok('正常运行'),'<div class="op"><a>详情</a><a>设置</a></div>'],
   ['冷却塔-01','192.168.10.203','—','—','—','28.5','24.2',ok('正常运行'),'<div class="op"><a>详情</a><a>设置</a></div>'],
   ['空调机组-AHU01','192.168.10.204','18.2','14.5','2.8','12.2','7.1',wn('偏差预警'),'<div class="op"><a>详情</a><a>设置</a></div>'],
   ['空调机组-AHU02','192.168.10.205','17.8','13.9','2.5','—','—',er('离线'),'<div class="op"><a>详情</a><a>设置</a></div>']],
  `<button class="btn">导出</button>`),

};

Object.entries(pages).forEach(([id,html])=>{
  fs.writeFileSync(pt.join(O,id+'.html'),html,'utf8');
  console.log('✓',id);
});
console.log('gen3 done:',Object.keys(pages).length,'pages');
