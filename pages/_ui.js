/* 共享交互助手:消息提示 / 分页器 / 弹窗。所有子页面引用。 */

/* 消息提示:$msg('保存成功','success'|'error'|'warning'|'info') */
function $msg(text, type) {
  type = type || 'success';
  var wrap = document.querySelector('.msg-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'msg-wrap'; document.body.appendChild(wrap); }
  var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  var m = document.createElement('div');
  m.className = 'msg ' + type;
  m.innerHTML = '<span>' + icons[type] + '</span><span>' + text + '</span>';
  wrap.appendChild(m);
  setTimeout(function () { m.style.opacity = '0'; m.style.transition = 'opacity .3s'; setTimeout(function () { m.remove(); }, 300); }, 2200);
}

/* 弹窗:$modal('id') 打开 / $modalClose('id') 关闭;点遮罩关闭 */
function $modal(id) { var el = document.getElementById(id); el.classList.add('show'); }
function $modalClose(id) { document.getElementById(id).classList.remove('show'); }
document.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('modal')) e.target.classList.remove('show');
});

/* 分页器:$pager(el, {total, page, size, sizes, onChange})
   渲染 共X条 | X条/页 | ‹ 1 2 … n › | 前往 X 页 */
function $pager(el, opt) {
  if (typeof el === 'string') el = document.getElementById(el);
  var total = opt.total, size = opt.size || 10, page = opt.page || 1;
  var sizes = opt.sizes || [10, 20, 50, 100];
  var pages = Math.max(1, Math.ceil(total / size));
  if (page > pages) page = pages;

  function nums() {
    // 生成页码序列(带省略号),最多显示7个页码位
    var arr = [];
    if (pages <= 7) { for (var i = 1; i <= pages; i++) arr.push(i); return arr; }
    arr.push(1);
    var s = Math.max(2, page - 2), e = Math.min(pages - 1, page + 2);
    if (page <= 4) { s = 2; e = 6; }
    if (page >= pages - 3) { s = pages - 5; e = pages - 1; }
    if (s > 2) arr.push('…');
    for (var j = s; j <= e; j++) arr.push(j);
    if (e < pages - 1) arr.push('…');
    arr.push(pages);
    return arr;
  }
  var h = '<span class="pg-total">共 ' + total + ' 条</span>';
  h += '<select class="pg-size">' + sizes.map(function (s2) { return '<option value="' + s2 + '"' + (s2 === size ? ' selected' : '') + '>' + s2 + '条/页</option>'; }).join('') + '</select>';
  h += '<button class="pgb pg-prev"' + (page === 1 ? ' disabled' : '') + '>‹</button>';
  h += nums().map(function (n) {
    return n === '…' ? '<span class="pgb" style="cursor:default">…</span>'
      : '<button class="pgb pg-num' + (n === page ? ' pga' : '') + '" data-p="' + n + '">' + n + '</button>';
  }).join('');
  h += '<button class="pgb pg-next"' + (page === pages ? ' disabled' : '') + '>›</button>';
  h += '<span class="pg-jump">前往 <input type="text" value="' + page + '"> 页</span>';
  el.className = 'pg';
  el.innerHTML = h;

  function go(p, s2) {
    p = Math.min(Math.max(1, p), Math.ceil(total / (s2 || size)));
    opt.page = p; if (s2) opt.size = s2;
    $pager(el, opt);
    if (opt.onChange) opt.onChange(p, s2 || size);
  }
  el.querySelector('.pg-size').onchange = function () { go(1, +this.value); };
  el.querySelector('.pg-prev').onclick = function () { go(page - 1); };
  el.querySelector('.pg-next').onclick = function () { go(page + 1); };
  el.querySelectorAll('.pg-num').forEach(function (b) { b.onclick = function () { go(+b.dataset.p); }; });
  el.querySelector('.pg-jump input').onkeydown = function (e) { if (e.key === 'Enter') go(+this.value || 1); };
}

/* 确认框:$confirm('确定删除?', onOk) */
function $confirm(text, onOk) {
  var id = '__confirm_modal';
  var el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id; el.className = 'modal';
    el.innerHTML = '<div class="dialog" style="width:420px">' +
      '<div class="dh"><span>提示</span><span class="dx" onclick="$modalClose(\'' + id + '\')">✕</span></div>' +
      '<div class="db" style="padding:10px 20px 20px;font-size:14px"><span class="__ct"></span></div>' +
      '<div class="df"><button class="btn" onclick="$modalClose(\'' + id + '\')">取 消</button><button class="btnp btn __ok">确 定</button></div></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.__ct').textContent = text;
  el.querySelector('.__ok').onclick = function () { $modalClose(id); if (onOk) onOk(); };
  $modal(id);
}

/* ── 建筑物三级树:楼栋-楼层-房间 ──
   $tree3(el, data, onChange)
   data: [{lb:'1号楼', floors:[{lb:'8层', rooms:['产品部','801会议室']}]}]
   onChange(sel) — sel 为 null(未选)或 {bld, fl, room}(fl/room 可为 undefined,表示选中整栋/整层)
   $tree3From(rows) — 由含 bld/fl/room 字段的记录集合构建 data
   $tree3Match(sel, r) — 判断记录 r{fl,room} 是否命中当前选择 */
function $tree3(el, data, onChange) {
  if (typeof el === 'string') el = document.getElementById(el);
  var sel = null;
  var same = function (a, b) { return a && b && a.bld === b.bld && a.fl === b.fl && a.room === b.room; };
  function pick(s) { sel = same(sel, s) ? null : s; render(); if (onChange) onChange(sel); }
  function render() {
    el.innerHTML = '';
    data.forEach(function (b) {
      el.appendChild(row(0, b, { bld: b.lb }, b.floors && b.floors.length));
      if (b.open) (b.floors || []).forEach(function (f) {
        el.appendChild(row(1, f, { bld: b.lb, fl: f.lb }, f.rooms && f.rooms.length));
        if (f.open) (f.rooms || []).forEach(function (rm) {
          el.appendChild(row(2, { lb: rm }, { bld: b.lb, fl: f.lb, room: rm }, false));
        });
      });
    });
  }
  function row(depth, node, s, expandable) {
    var r = document.createElement('div');
    r.className = 'tree-row' + (node.open ? ' open' : '') + (same(sel, s) ? ' active' : '');
    r.style.paddingLeft = (6 + depth * 18) + 'px';
    r.innerHTML = (expandable ? '<span class="arr">▶</span>' : '<span class="arr" style="visibility:hidden">▶</span>') + '<span>' + node.lb + '</span>';
    if (expandable) r.querySelector('.arr').onclick = function (e) { e.stopPropagation(); node.open = !node.open; render(); };
    r.onclick = function () { pick(s); };
    return r;
  }
  render();
  return { reset: function () { sel = null; render(); } };
}
function $tree3From(rows) {
  var data = [];
  rows.forEach(function (r) {
    var bl = r.bld || '1号楼', fl = String(r.fl), rm = r.room != null ? String(r.room) : null;
    var b = data.find(function (x) { return x.lb === bl; });
    if (!b) { b = { lb: bl, open: false, floors: [] }; data.push(b); }
    var f = b.floors.find(function (x) { return x.lb === fl; });
    if (!f) { f = { lb: fl, open: false, rooms: [] }; b.floors.push(f); }
    if (rm && f.rooms.indexOf(rm) < 0) f.rooms.push(rm);
  });
  data.forEach(function (b) {
    b.floors.sort(function (a, c) { return parseInt(a.lb) - parseInt(c.lb); });
    b.floors.forEach(function (f) { f.rooms.sort(); });
  });
  return data;
}
function $tree3Match(sel, r) {
  if (!sel) return true;
  if (sel.fl != null && String(r.fl) !== sel.fl) return false;
  if (sel.room != null && String(r.room) !== sel.room) return false;
  return true;
}
