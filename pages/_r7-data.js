(function (global) {
  'use strict';

  var SELECTED_SN_KEY = 'hvac:r7:selectedSn';
  var PROJECT_BINDINGS_KEY = 'hvac:r7:projectBindings';
  var DEFAULT_PROJECTS = [
    '凤凰台测试',
    '海信产业园',
    '中关村软件园',
    '临港科技城',
    '南山智慧大厦',
    '狮山金融中心',
    '武汉创意天地',
    '宝鸡维也纳酒店R7'
  ];
  /* 软件版本体系(按产品线区分):MAX版 0.35/0.34 系列,标准版 0.26/0.25/0.24 系列 */
  var VERSION_LATEST = {'MAX版':'0.35.0.1.13','标准版':'0.26.0.0.5'};
  var VERSION_POOL = {
    'MAX版':['0.35.0.1.13','0.35.0.1.11','0.35.0.0.9','0.34.2.1.6','0.34.1.0.3'],
    '标准版':['0.26.0.0.5','0.26.0.0.3','0.25.2.1.8','0.25.1.4.0','0.24.3.2.7']
  };
  /* 机队生成表:[项目,产品线,版本序号,外机,内机,在线,系统状态,剩余流量M,外机故障,内机故障]
     42 台:MAX版 23 / 标准版 19;在线 35;故障 9;低流量 6 —— 数字分布刻意拉开 */
  var DEVICE_ROWS = [
    ['凤凰台测试','MAX版',0,'美的','格力',1,'开机',136,'',''],
    ['海信产业园','标准版',0,'海信','美的',1,'开机',42,'E7',''],
    ['中关村软件园','标准版',1,'格力','海信',0,'关机',18,'C0,E6','H4'],
    ['临港科技城','MAX版',0,'大金','三菱电机',1,'开机',287,'','U4,A3'],
    ['南山智慧大厦','MAX版',1,'日立','东芝',1,'关机',94,'',''],
    ['','MAX版',1,'三菱电机','日立',0,'关机',33,'',''],
    ['狮山金融中心','标准版',2,'东芝','约克',1,'开机',391,'',''],
    ['武汉创意天地','标准版',2,'约克','大金',1,'开机',76,'P3',''],
    ['西安研发中心','标准版',0,'海尔','美的',1,'开机',211,'',''],
    ['杭州智慧园区','MAX版',2,'美的','海尔',1,'开机',165,'',''],
    ['广州国际金融城','标准版',1,'格力','格力',0,'关机',46,'E1','F0'],
    ['宝鸡维也纳酒店R7','MAX版',0,'海信','海信',1,'开机',128,'',''],
    ['凤凰台测试','MAX版',0,'美的','大金',1,'开机',245,'',''],
    ['海信产业园','MAX版',0,'海信','格力',1,'开机',312,'',''],
    ['中关村软件园','MAX版',0,'大金','美的',1,'开机',89,'',''],
    ['临港科技城','MAX版',0,'三菱电机','海尔',1,'开机',176,'',''],
    ['南山智慧大厦','标准版',0,'日立','海信',1,'开机',264,'',''],
    ['狮山金融中心','MAX版',0,'东芝','三菱电机',1,'关机',58,'',''],
    ['武汉创意天地','标准版',0,'约克','约克',1,'开机',143,'',''],
    ['西安研发中心','MAX版',1,'海尔','日立',1,'开机',327,'',''],
    ['杭州智慧园区','MAX版',1,'美的','东芝',1,'开机',199,'',''],
    ['广州国际金融城','MAX版',1,'格力','大金',0,'关机',82,'',''],
    ['宝鸡维也纳酒店R7','MAX版',1,'海信','三菱电机',1,'开机',221,'',''],
    ['凤凰台测试','标准版',0,'美的','海尔',1,'开机',156,'',''],
    ['海信产业园','标准版',0,'海信','海信',1,'开机',298,'',''],
    ['中关村软件园','标准版',0,'大金','格力',1,'开机',71,'',''],
    ['临港科技城','MAX版',2,'三菱电机','美的',1,'开机',184,'',''],
    ['南山智慧大厦','MAX版',2,'日立','大金',1,'开机',269,'',''],
    ['','标准版',2,'格力','三菱重工',0,'关机',39,'H1',''],
    ['狮山金融中心','MAX版',2,'东芝','日立',1,'开机',118,'','E2'],
    ['武汉创意天地','MAX版',2,'约克','海尔',1,'开机',233,'',''],
    ['西安研发中心','标准版',1,'海尔','美的',1,'开机',167,'',''],
    ['杭州智慧园区','标准版',1,'美的','格力',1,'关机',92,'',''],
    ['广州国际金融城','标准版',1,'格力','东芝',1,'开机',204,'',''],
    ['宝鸡维也纳酒店R7','标准版',1,'海信','大金',0,'关机',27,'','H5'],
    ['凤凰台测试','MAX版',3,'美的','三菱电机',1,'开机',251,'',''],
    ['海信产业园','MAX版',3,'海信','日立',1,'开机',139,'',''],
    ['中关村软件园','MAX版',3,'大金','海尔',0,'关机',64,'F3',''],
    ['临港科技城','标准版',3,'三菱电机','格力',1,'开机',188,'',''],
    ['南山智慧大厦','标准版',3,'日立','美的',1,'开机',112,'',''],
    ['狮山金融中心','MAX版',4,'东芝','海信',1,'开机',276,'',''],
    ['武汉创意天地','标准版',4,'约克','三菱电机',1,'开机',95,'','']
  ];
  var REGIONS = ['370500','110108','310115','440305','510107','320505','420106','610113','330106','440106','120103','370201'];
  var ADDRESSES = [
    '青岛市市北区凤凰台路 18 号','青岛市崂山区株洲路 151 号','北京市海淀区东北旺西路 8 号','上海市浦东新区环湖西二路 888 号',
    '深圳市南山区科技南十二路 6 号','成都市武侯区天府五街 200 号','苏州市虎丘区狮山路 28 号','武汉市武昌区公正路 9 号',
    '西安市雁塔区锦业一路 58 号','杭州市西湖区文三路 478 号','广州市天河区临江大道 59 号','天津市河西区友谊路 35 号'
  ];
  var BASE_DEVICES = DEVICE_ROWS.map(function (row, index) {
    var product = row[1], version = VERSION_POOL[product][row[2]];
    var month = 1 + (index % 12), day = 1 + (index * 3) % 27;
    return {
      sn:'R7-' + REGIONS[index % REGIONS.length] + '-24' + String(101 + index).slice(1) + '-' + String(1000 + index * 7).slice(1),
      project:row[0],
      trafficPlan:(index % 3 === 2) ? 500 : 300,
      trafficRemain:row[7],
      version:version,
      latestVersion:VERSION_LATEST[product],
      productVersion:product,
      outdoorBrand:row[3],
      indoorBrand:row[4],
      online:row[5] === 1,
      address:ADDRESSES[index % ADDRESSES.length],
      systemStatus:row[6],
      systemModes:row[6] === '开机' ? [['制冷'],['制冷','送风'],['制冷','自动'],['送风'],['除湿']][index % 5] : [],
      outdoorErrors:row[8] ? row[8].split(',') : [],
      indoorErrors:row[9] ? row[9].split(',') : [],
      lastCommunicationAt:'2026-07-2' + (index % 3) + ' ' + String(8 + month).padStart(2,'0') + ':' + String((index * 7) % 60).padStart(2,'0') + ':' + String((index * 13) % 60).padStart(2,'0')
    };
  });

  function safeStorage(storageName) {
    try {
      return global[storageName];
    } catch (error) {
      return null;
    }
  }

  function readBindings() {
    var storage = safeStorage('localStorage');
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(PROJECT_BINDINGS_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function devices() {
    var bindings = readBindings();
    return BASE_DEVICES.map(function (device) {
      return Object.assign({}, device, {
        project: Object.prototype.hasOwnProperty.call(bindings, device.sn) ? bindings[device.sn] : device.project,
        systemModes: device.systemModes.slice(),
        outdoorErrors: device.outdoorErrors.slice(),
        indoorErrors: device.indoorErrors.slice()
      });
    });
  }

  function getDevice(sn) {
    return devices().find(function (device) { return device.sn === sn; }) || null;
  }

  function selectDevice(sn) {
    var device = getDevice(sn);
    var storage = safeStorage('sessionStorage');
    if (device && storage) storage.setItem(SELECTED_SN_KEY, sn);
    return device;
  }

  function selectedDevice() {
    var storage = safeStorage('sessionStorage');
    var sn = storage ? storage.getItem(SELECTED_SN_KEY) : '';
    return getDevice(sn) || devices()[0] || null;
  }

  function bindProject(sn, project) {
    if (!getDevice(sn) || !project) return false;
    var storage = safeStorage('localStorage');
    if (!storage) return false;
    var bindings = readBindings();
    bindings[sn] = project;
    storage.setItem(PROJECT_BINDINGS_KEY, JSON.stringify(bindings));
    return true;
  }

  function projects() {
    var names = DEFAULT_PROJECTS.concat(devices().map(function (device) { return device.project; }));
    return names.filter(function (name, index) { return name && names.indexOf(name) === index; }).sort();
  }

  function traffic(device) {
    return {
      label: device.trafficPlan + 'M/月',
      remain: device.trafficRemain + 'M',
      state: device.trafficRemain < 50 ? 'warning' : 'normal'
    };
  }

  function productVersion(device) {
    return device.productVersion;
  }

  function hasFault(device) {
    return Boolean(device.outdoorErrors.length || device.indoorErrors.length);
  }

  function stats(source) {
    var list = source || devices();
    var online = list.filter(function (device) { return device.online; }).length;
    var standard = list.filter(function (device) { return device.productVersion === '标准版'; }).length;
    return {
      total: list.length,
      online: online,
      offline: list.length - online,
      running: list.filter(function (device) { return device.systemStatus === '开机'; }).length,
      faults: list.filter(hasFault).length,
      trafficWarnings: list.filter(function (device) { return traffic(device).state === 'warning'; }).length,
      onlineRate: list.length ? Math.round(online * 100 / list.length) : 0,
      standard: standard,
      max: list.length - standard,
      upgradeable: list.filter(function (device) { return device.version !== device.latestVersion; }).length
    };
  }

  function brandDistribution(source, field) {
    var counts = {};
    (source || devices()).forEach(function (device) {
      var name = device[field] || '未知';
      counts[name] = (counts[name] || 0) + 1;
    });
    var total = Object.keys(counts).reduce(function (sum, key) { return sum + counts[key]; }, 0);
    var max = Object.keys(counts).reduce(function (value, key) { return Math.max(value, counts[key]); }, 0) || 1;
    return Object.keys(counts).map(function (name) {
      return {name:name,value:counts[name],percent:total ? Math.round(counts[name] * 100 / total) : 0,width:counts[name] * 100 / max};
    }).sort(function (left, right) { return right.value - left.value || left.name.localeCompare(right.name, 'zh-CN'); });
  }

  function combinationDistribution(source, limit) {
    var counts = {};
    var list = source || devices();
    list.forEach(function (device) {
      var name = device.outdoorBrand+' + '+device.indoorBrand;
      counts[name] = (counts[name] || 0) + 1;
    });
    var max = Object.keys(counts).reduce(function (value, key) { return Math.max(value, counts[key]); }, 0) || 1;
    return Object.keys(counts).map(function (name) {
      return {name:name,value:counts[name],percent:list.length ? Math.round(counts[name] * 100 / list.length) : 0,width:counts[name] * 100 / max};
    }).sort(function (left, right) {
      return right.value - left.value || left.name.localeCompare(right.name, 'zh-CN');
    }).slice(0,limit||20);
  }

  global.R7Store = {
    devices: devices,
    getDevice: getDevice,
    selectDevice: selectDevice,
    selectedDevice: selectedDevice,
    bindProject: bindProject,
    projects: projects,
    traffic: traffic,
    productVersion: productVersion,
    hasFault: hasFault,
    stats: stats,
    brandDistribution: brandDistribution,
    combinationDistribution: combinationDistribution
  };
})(window);
