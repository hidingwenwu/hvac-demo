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
  var BASE_DEVICES = [
    {sn:'R7-370500-240716-0018',project:'凤凰台测试',trafficPlan:300,trafficRemain:136,version:'R7.2.6',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'美的',indoorBrand:'格力',online:true,address:'青岛市市北区凤凰台路 18 号',systemStatus:'开机',systemModes:['制冷','送风'],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:40:00'},
    {sn:'R7-370500-240625-0041',project:'海信产业园',trafficPlan:300,trafficRemain:42,version:'R7.2.5',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'海信',indoorBrand:'美的',online:true,address:'青岛市崂山区株洲路 151 号',systemStatus:'开机',systemModes:['制冷','自动'],outdoorErrors:['E7'],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:39:35'},
    {sn:'R7-110108-240612-0007',project:'中关村软件园',trafficPlan:300,trafficRemain:18,version:'R7.2.4',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'格力',indoorBrand:'海信',online:false,address:'北京市海淀区东北旺西路 8 号',systemStatus:'关机',systemModes:[],outdoorErrors:['C0','E6'],indoorErrors:['H4'],lastCommunicationAt:'2026-07-22 09:18:22'},
    {sn:'R7-310115-240531-0023',project:'临港科技城',trafficPlan:500,trafficRemain:287,version:'R7.2.6',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'大金',indoorBrand:'三菱电机',online:true,address:'上海市浦东新区环湖西二路 888 号',systemStatus:'开机',systemModes:['制冷'],outdoorErrors:[],indoorErrors:['U4','A3'],lastCommunicationAt:'2026-07-22 14:40:12'},
    {sn:'R7-440305-240427-0012',project:'南山智慧大厦',trafficPlan:300,trafficRemain:94,version:'R7.2.3',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'日立',indoorBrand:'东芝',online:true,address:'深圳市南山区科技南十二路 6 号',systemStatus:'关机',systemModes:[],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:38:56'},
    {sn:'R7-510107-240318-0036',project:'',trafficPlan:300,trafficRemain:33,version:'R7.2.5',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'三菱电机',indoorBrand:'日立',online:false,address:'成都市武侯区天府五街 200 号',systemStatus:'关机',systemModes:[],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-21 21:05:16'},
    {sn:'R7-320505-240206-0029',project:'狮山金融中心',trafficPlan:500,trafficRemain:391,version:'R7.2.2',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'东芝',indoorBrand:'约克',online:true,address:'苏州市虎丘区狮山路 28 号',systemStatus:'开机',systemModes:['制热','送风'],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:39:48'},
    {sn:'R7-420106-231218-0015',project:'武汉创意天地',trafficPlan:300,trafficRemain:76,version:'R7.2.1',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'约克',indoorBrand:'大金',online:true,address:'武汉市武昌区公正路 9 号',systemStatus:'开机',systemModes:['除湿'],outdoorErrors:['P3'],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:39:03'},
    {sn:'R7-610113-231107-0009',project:'西安研发中心',trafficPlan:300,trafficRemain:211,version:'R7.2.6',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'海尔',indoorBrand:'美的',online:true,address:'西安市雁塔区锦业一路 58 号',systemStatus:'开机',systemModes:['制冷'],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:40:05'},
    {sn:'R7-330106-230923-0028',project:'杭州智慧园区',trafficPlan:500,trafficRemain:165,version:'R7.2.5',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'美的',indoorBrand:'海尔',online:true,address:'杭州市西湖区文三路 478 号',systemStatus:'开机',systemModes:['制冷','自动'],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:39:58'},
    {sn:'R7-440106-230812-0017',project:'广州国际金融城',trafficPlan:300,trafficRemain:46,version:'R7.2.4',latestVersion:'R7.2.6',productVersion:'标准版',outdoorBrand:'格力',indoorBrand:'格力',online:false,address:'广州市天河区临江大道 59 号',systemStatus:'关机',systemModes:[],outdoorErrors:['E1'],indoorErrors:['F0'],lastCommunicationAt:'2026-07-22 07:26:11'},
    {sn:'R7-120103-230628-0032',project:'宝鸡维也纳酒店R7',trafficPlan:300,trafficRemain:128,version:'R7.2.6',latestVersion:'R7.2.6',productVersion:'MAX版',outdoorBrand:'海信',indoorBrand:'海信',online:true,address:'天津市河西区友谊路 35 号',systemStatus:'开机',systemModes:['送风'],outdoorErrors:[],indoorErrors:[],lastCommunicationAt:'2026-07-22 14:40:08'}
  ];

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
