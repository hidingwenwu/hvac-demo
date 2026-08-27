/* ============================================================
   能耗分析共享筛选组件(_energy-filter.js)
   $erange — 起止一体范围选择控件：一个输入框，弹层内左侧快捷项 +
             右侧日历/月历/年历，第一次点击选起始、第二次选截止；
             mode: date(日期范围) | month(月份范围) | year(年度范围) | single(单日)
             pick: 'range'(默认) | 'start'(仅选起始，用于对比期自动等长)
   $eobj   — 统计对象两级选择：类型下拉 + 具体对象；
             楼栋/楼层/房间三级级联，租户/群组/电表扁平单选；
             filterGroupType:'meter' 时群组仅列电表群组
   ============================================================ */
(function (global) {
  'use strict';

  function pad(v) { return String(v).padStart(2, '0'); }
  function fmtD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseD(s) { return new Date(String(s).slice(0, 10) + 'T00:00:00'); }
  function addD(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return fmtD(d); }
  function monthLastDay(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
  function monthStartOf(s) { return String(s).slice(0, 7) + '-01'; }
  function monthEndOf(s) { var y = Number(String(s).slice(0, 4)), m0 = Number(String(s).slice(5, 7)) - 1; return String(s).slice(0, 7) + '-' + pad(monthLastDay(y, m0)); }
  function shiftMonthText(s, n) { var d = parseD(monthStartOf(s)); d.setMonth(d.getMonth() + n); return fmtD(d).slice(0, 7); }
  function clampRange(from, to, min, max) {
    if (from < min) from = min;
    if (to > max) to = max;
    if (from > to) { var t = from; from = to; to = t; }
    return [from, to];
  }

  var QUICK = {
    date: [['today', '今日'], ['yesterday', '昨日'], ['week', '本周'], ['month', '本月'], ['lastMonth', '上月'], ['year', '本年']],
    single: [['today', '今日'], ['yesterday', '昨日']],
    month: [['month', '本月'], ['lastMonth', '上月'], ['year', '本年']],
    year: [['year', '本年'], ['lastYear', '去年'], ['threeYears', '近三年']]
  };

  function quickRange(key, max) {
    var t = String(max).slice(0, 10);
    var dow = (parseD(t).getDay() + 6) % 7;
    if (key === 'today') return [t, t];
    if (key === 'yesterday') { var y = addD(t, -1); return [y, y]; }
    if (key === 'week') return [addD(t, -dow), t];
    if (key === 'month') return [t.slice(0, 8) + '01', t];
    if (key === 'lastMonth') { var end = addD(t.slice(0, 8) + '01', -1); return [end.slice(0, 8) + '01', end]; }
    if (key === 'year') return [t.slice(0, 4) + '-01-01', t];
    if (key === 'lastYear') { var y1 = Number(t.slice(0, 4)) - 1; return [y1 + '-01-01', y1 + '-12-31']; }
    if (key === 'threeYears') return [Number(t.slice(0, 4)) - 2 + '-01-01', t];
    return [t, t];
  }

  /* ─────────────────────────── 范围选择控件 ─────────────────────────── */
  function $erange(el, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    opts = opts || {};
    var mode = opts.mode || 'date';
    var pick = opts.pick === 'start' ? 'start' : 'range';
    var min = String(opts.min || '2000-01-01').slice(0, 10);
    var max = String(opts.max || '2099-12-31').slice(0, 10);
    var from = String(opts.from || max).slice(0, 10);
    var to = String(opts.to || max).slice(0, 10);
    var onChange = opts.onChange || function () {};
    var open = false, pending = null;
    var viewY = parseD(to).getFullYear(), viewM = parseD(to).getMonth();

    el.classList.add('erf-range');
    el.innerHTML = '<button type="button" class="erf-btn"><span class="erf-text"></span><span class="erf-arrow">▾</span></button><div class="erf-pop" style="display:none"></div>';
    var btn = el.querySelector('.erf-btn'), pop = el.querySelector('.erf-pop'), text = el.querySelector('.erf-text');

    /* 面板内部点击不向外冒泡：首次点选会重绘面板（事件目标随之脱离 DOM），
       若冒泡到 document 级"点外部关闭"监听器，contains 判断失效会导致面板被误关 */
    pop.addEventListener('click', function (e) { e.stopPropagation(); });

    function display() {
      if (pick === 'start') {
        text.textContent = '起：' + (mode === 'month' ? from.slice(0, 7) : mode === 'year' ? from.slice(0, 4) : from);
        return;
      }
      if (mode === 'single') text.textContent = from;
      else if (mode === 'month') text.textContent = from.slice(0, 7) + ' ~ ' + to.slice(0, 7);
      else if (mode === 'year') text.textContent = from.slice(0, 4) + ' ~ ' + to.slice(0, 4);
      else text.textContent = from + ' ~ ' + to;
    }

    function apply(notify) {
      var r = clampRange(from, to, min, max);
      from = r[0]; to = r[1];
      display();
      closePop();
      if (notify !== false) onChange({ from: from, to: to, mode: mode });
    }

    function closePop() { open = false; pending = null; pop.style.display = 'none'; }

    function inRange(d) { return pick === 'range' && cmp(from, to, d); }
    function cmp(a, b, d) { return d >= a && d <= b; }

    function cellState(d) {
      if (d < min || d > max) return 'dis';
      if (pending === d || (pick === 'start' && from === d)) return 'sel';
      if (mode === 'single') return from === d ? 'sel' : '';
      if (pick === 'range' && (from === d || to === d)) return 'sel';
      if (pending && pending < d && d <= to) return 'in';
      if (!pending && inRange(d)) return 'in';
      return '';
    }

    function pickDay(d) {
      if (mode === 'single') { from = d; to = d; apply(); return; }
      if (pick === 'start') { from = d; to = d; apply(); return; }
      if (!pending) { pending = d; renderPop(); return; }
      from = pending < d ? pending : d;
      to = pending < d ? d : pending;
      pending = null;
      apply();
    }

    function pickMonth(y, m0) {
      var d = y + '-' + pad(m0 + 1) + '-01';
      if (pick === 'start') { from = d; to = d; apply(); return; }
      if (!pending) { pending = d; renderPop(); return; }
      var s = pending < d ? pending : d, e = pending < d ? d : pending;
      from = monthStartOf(s); to = monthEndOf(e);
      pending = null;
      apply();
    }

    function pickYear(y) {
      var d = y + '-01-01';
      if (pick === 'start') { from = d; to = d; apply(); return; }
      if (!pending) { pending = d; renderPop(); return; }
      var s = Number(pending.slice(0, 4)), e = Number(y);
      if (s > e) { var t2 = s; s = e; e = t2; }
      from = s + '-01-01'; to = e + '-12-31';
      pending = null;
      apply();
    }

    function renderQuick() {
      if (pick === 'start') return '';
      var items = QUICK[mode] || QUICK.date;
      return '<div class="erf-quick">' + items.map(function (item) {
        return '<button type="button" data-quick="' + item[0] + '">' + item[1] + '</button>';
      }).join('') + '</div>';
    }

    function renderCalendar() {
      var first = new Date(viewY, viewM, 1);
      var lead = (first.getDay() + 6) % 7;
      var days = monthLastDay(viewY, viewM);
      var html = '<div class="erf-cal-head"><button type="button" data-nav="-1">‹</button><span>' + viewY + ' 年 ' + (viewM + 1) + ' 月</span><button type="button" data-nav="1">›</button></div>';
      html += '<div class="erf-grid erf-week">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="erf-grid">';
      for (var i = 0; i < lead; i++) html += '<span class="erf-cell dis"></span>';
      for (var d = 1; d <= days; d++) {
        var date = viewY + '-' + pad(viewM + 1) + '-' + pad(d);
        html += '<button type="button" class="erf-cell ' + cellState(date) + '" data-day="' + date + '">' + d + '</button>';
      }
      return html + '</div>';
    }

    function renderMonths() {
      var html = '<div class="erf-cal-head"><button type="button" data-nav="-1">‹</button><span>' + viewY + ' 年</span><button type="button" data-nav="1">›</button></div><div class="erf-months">';
      for (var m0 = 0; m0 < 12; m0++) {
        var start = viewY + '-' + pad(m0 + 1) + '-01', end = viewY + '-' + pad(m0 + 1) + '-' + pad(monthLastDay(viewY, m0));
        var dis = end < min || start > max;
        var state = dis ? 'dis' : '';
        if (!dis) {
          if (pending && pending.slice(0, 7) === start.slice(0, 7)) state = 'sel';
          else if (pick === 'start' && from.slice(0, 7) === start.slice(0, 7)) state = 'sel';
          else if (pick === 'range' && start >= monthStartOf(from) && start <= monthStartOf(to)) state = state || 'in';
          if (pick === 'range' && (monthStartOf(from) === start || monthStartOf(to) === start)) state = 'sel';
        }
        html += '<button type="button" class="erf-cell ' + state + '" data-month="' + m0 + '"' + (dis ? ' disabled' : '') + '>' + (m0 + 1) + '月</button>';
      }
      return html + '</div>';
    }

    function renderYears() {
      var y0 = Number(min.slice(0, 4)), y1 = Number(max.slice(0, 4));
      var html = '<div class="erf-cal-head"><span>选择年度范围</span></div><div class="erf-years">';
      for (var y = y0; y <= y1; y++) {
        var start = y + '-01-01', end = y + '-12-31';
        var state = '';
        if (pending && Number(pending.slice(0, 4)) === y) state = 'sel';
        else if (pick === 'start' && Number(from.slice(0, 4)) === y) state = 'sel';
        else if (pick === 'range' && y >= Number(from.slice(0, 4)) && y <= Number(to.slice(0, 4))) state = (y === Number(from.slice(0, 4)) || y === Number(to.slice(0, 4))) ? 'sel' : 'in';
        html += '<button type="button" class="erf-cell ' + state + '" data-year="' + y + '">' + y + '</button>';
      }
      return html + '</div>';
    }

    function renderPop() {
      var panel = mode === 'month' ? renderMonths() : mode === 'year' ? renderYears() : renderCalendar();
      pop.innerHTML = renderQuick() + '<div class="erf-panel">' + panel + '</div>';
      pop.querySelectorAll('[data-quick]').forEach(function (b) {
        b.onclick = function () {
          var r = clampRange(quickRange(b.dataset.quick, max)[0], quickRange(b.dataset.quick, max)[1], min, max);
          from = r[0]; to = r[1]; pending = null; apply();
        };
      });
      pop.querySelectorAll('[data-nav]').forEach(function (b) {
        b.onclick = function () {
          if (mode === 'month') viewY += Number(b.dataset.nav);
          else { viewM += Number(b.dataset.nav); if (viewM < 0) { viewM = 11; viewY--; } if (viewM > 11) { viewM = 0; viewY++; } }
          renderPop();
        };
      });
      pop.querySelectorAll('[data-day]').forEach(function (b) { if (!b.classList.contains('dis')) b.onclick = function () { pickDay(b.dataset.day); }; });
      pop.querySelectorAll('[data-month]').forEach(function (b) { if (!b.disabled) b.onclick = function () { pickMonth(viewY, Number(b.dataset.month)); }; });
      pop.querySelectorAll('[data-year]').forEach(function (b) { b.onclick = function () { pickYear(Number(b.dataset.year)); }; });
    }

    btn.onclick = function (e) {
      e.stopPropagation();
      open = !open;
      if (open) { pending = null; viewY = parseD(to).getFullYear(); viewM = parseD(to).getMonth(); renderPop(); pop.style.display = 'flex'; }
      else closePop();
    };
    document.addEventListener('click', function (e) { if (open && !el.contains(e.target)) closePop(); });

    display();
    return {
      getRange: function () { return { from: from, to: to }; },
      setRange: function (f, t) { from = String(f).slice(0, 10); to = String(t || f).slice(0, 10); apply(false); },
      setMode: function (m) { mode = m; closePop(); display(); },
      getMode: function () { return mode; }
    };
  }

  /* ─────────────────────────── 统计对象两级选择 ─────────────────────────── */
  var OBJ_LABELS = { project: '项目整体', building: '楼栋', floor: '楼层', room: '房间', tenant: '租户', group: '群组', meter: '电表' };

  function $eobj(el, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    opts = opts || {};
    var types = opts.types || ['project', 'building', 'floor', 'room', 'tenant', 'group', 'meter'];
    var onChange = opts.onChange || function () {};
    var energy = global.HvacEnergy;
    var state = { type: types[0], building: '', floor: '', obj: '' };

    el.classList.add('erf-obj');

    function catalogs(type) { return energy.getCatalog(type); }

    function render() {
      var html = '<select class="erf-type">' + types.map(function (t) {
        return '<option value="' + t + '"' + (state.type === t ? ' selected' : '') + '>' + (OBJ_LABELS[t] || t) + '</option>';
      }).join('') + '</select>';
      if (state.type === 'building' || state.type === 'floor' || state.type === 'room') {
        html += '<select class="erf-bld">' + catalogs('building').map(function (b) {
          return '<option value="' + b.name + '"' + (state.building === b.name ? ' selected' : '') + '>' + b.name + '</option>';
        }).join('') + '</select>';
      }
      if (state.type === 'floor' || state.type === 'room') {
        html += '<select class="erf-fl">' + catalogs('floor').filter(function (f) { return f.bld === state.building; }).map(function (f) {
          return '<option value="' + f.fl + '"' + (state.floor === f.fl ? ' selected' : '') + '>' + f.fl + '</option>';
        }).join('') + '</select>';
      }
      if (state.type === 'room') {
        html += '<select class="erf-room">' + catalogs('room').filter(function (r) { return r.bld === state.building && r.fl === state.floor; }).map(function (r) {
          return '<option value="' + r.id + '"' + (state.obj === r.id ? ' selected' : '') + '>' + r.name + '</option>';
        }).join('') + '</select>';
      }
      if (state.type === 'tenant' || state.type === 'meter') {
        html += '<select class="erf-flat">' + catalogs(state.type).map(function (item) {
          return '<option value="' + item.id + '"' + (state.obj === item.id ? ' selected' : '') + '>' + item.name + '</option>';
        }).join('') + '</select>';
      }
      if (state.type === 'group') {
        var groups = catalogs('group');
        if (opts.filterGroupType) groups = groups.filter(function (g) { return g.groupType === opts.filterGroupType; });
        html += '<select class="erf-flat">' + groups.map(function (g) {
          var tag = g.groupType === 'meter' ? '（电表群组）' : '（房间群组）';
          var invalid = g.invalidCount ? '（' + g.invalidCount + ' 个成员失效）' : '';
          return '<option value="' + g.id + '"' + (state.obj === g.id ? ' selected' : '') + '>' + g.name + tag + invalid + '</option>';
        }).join('') + '</select>';
      }
      el.innerHTML = html;
      el.querySelector('.erf-type').onchange = function () { state.type = this.value; reset(); render(); emit(); };
      var bld = el.querySelector('.erf-bld');
      if (bld) bld.onchange = function () { state.building = this.value; state.floor = ''; state.obj = ''; resetDeep(); render(); emit(); };
      var fl = el.querySelector('.erf-fl');
      if (fl) fl.onchange = function () { state.floor = this.value; state.obj = ''; render(); emit(); };
      var leaf = el.querySelector('.erf-room') || el.querySelector('.erf-flat');
      if (leaf) leaf.onchange = function () { state.obj = this.value; emit(); };
    }

    function reset() { state.building = ''; state.floor = ''; state.obj = ''; resetDeep(); }
    function resetDeep() {
      if ((state.type === 'building' || state.type === 'floor' || state.type === 'room') && !state.building) {
        var bs = catalogs('building');
        state.building = bs.length ? bs[0].name : '';
      }
      if ((state.type === 'floor' || state.type === 'room') && !state.floor) {
        var fs = catalogs('floor').filter(function (f) { return f.bld === state.building; });
        state.floor = fs.length ? fs[0].fl : '';
      }
      if (state.type === 'room' && !state.obj) {
        var rs = catalogs('room').filter(function (r) { return r.bld === state.building && r.fl === state.floor; });
        state.obj = rs.length ? rs[0].id : '';
      }
      if ((state.type === 'tenant' || state.type === 'meter') && !state.obj) {
        var items = catalogs(state.type);
        state.obj = items.length ? items[0].id : '';
      }
      if (state.type === 'group' && !state.obj) {
        var gs = catalogs('group');
        if (opts.filterGroupType) gs = gs.filter(function (g) { return g.groupType === opts.filterGroupType; });
        state.obj = gs.length ? gs[0].id : '';
      }
    }

    function current() {
      if (state.type === 'project') return 'project';
      if (state.type === 'building') return state.building ? 'building:' + state.building : 'project';
      if (state.type === 'floor') return state.floor ? 'floor:' + state.building + '|' + state.floor : 'project';
      return state.obj || 'project';
    }

    function emit() { onChange(current()); }

    reset();
    render();
    return {
      getValue: current,
      setValue: function (id) {
        id = String(id || 'project');
        var prefix = id.split(':')[0];
        if (types.indexOf(prefix) < 0) prefix = 'project';
        state.type = prefix;
        state.building = ''; state.floor = ''; state.obj = '';
        if (prefix === 'building') state.building = id.slice(9);
        else if (prefix === 'floor') { var fp = id.slice(6).split('|'); state.building = fp[0]; state.floor = fp[1] || ''; }
        else if (prefix === 'room') { var rp = id.slice(5).split('|'); state.building = rp[0]; state.floor = rp[1] || ''; state.obj = id; }
        else if (prefix === 'tenant' || prefix === 'meter' || prefix === 'group') state.obj = id;
        render();
      }
    };
  }

  global.$erange = $erange;
  global.$eobj = $eobj;
})(window);
