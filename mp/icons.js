/* 空调集控管家 · SVG 线性图标库（R2 新增，替代全站 emoji/字符图标）
   统一规范：24×24 viewBox / fill=none / stroke=currentColor / stroke-width=1.5 /
   stroke-linecap=round / stroke-linejoin=round，颜色随 CSS color 继承
   调用：MP.icon(name[, cls[, sw]])
     name —— 图标名（见 ICONS 键）；未知名返回空串（渲染安全兜底）
     cls  —— 附加 class：尺寸用 xs(12)/sm(16)，其余尺寸由所在容器 CSS 指定（默认 20px）
     sw   —— 覆盖描边宽度（如大电源键用 2）
   图标分组：导航(home/device/me) 功能(group/schedule/strategy/env/bind/controller/elec/more)
            控制(power/snow/sun/fan/drop) 状态(lock/alert/check/arrow/back)
            补充(search/info/chat/bill/wallet) */
window.MP=window.MP||{};
(function(){
  var I={
    /* ── 导航 ── */
    home:'<path d="M4.5 10.8 12 4.2l7.5 6.6"/><path d="M6.5 9.3V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.3"/><path d="M10.2 20v-4.6a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1V20"/>',
    device:'<rect x="3" y="6" width="18" height="8.5" rx="2"/><path d="M7 11.4h6"/><path d="M17.2 11.4h.01"/><path d="M8.5 17.6c.7.9.7 1.7 0 2.6M12 17.6c.7.9.7 1.7 0 2.6M15.5 17.6c.7.9.7 1.7 0 2.6"/>',
    me:'<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.6 3.7-5.4 7-5.4s6.1 1.8 7 5.4"/>',
    /* ── 功能 ── */
    group:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    schedule:'<rect x="4" y="5" width="16" height="15.5" rx="2"/><path d="M4 10h16"/><path d="M8.5 3v3M15.5 3v3"/><path d="M12 13.4v2.4l1.7 1.2"/>',
    strategy:'<path d="M6.5 17.5C6.5 11 10.5 6.6 18.5 5.6 18 13.4 13.6 17.5 6.5 17.5Z"/><path d="M6.5 17.5c2.2-4.3 5.5-7.6 9.3-9.5"/>',
    env:'<path d="M7.2 4.5a1.8 1.8 0 0 1 3.6 0v7.4a4.2 4.2 0 1 1-3.6 0Z"/><path d="M16.9 6.2s3.1 3.3 3.1 5.4a3.1 3.1 0 1 1-6.2 0c0-2.1 3.1-5.4 3.1-5.4Z"/>',
    bind:'<path d="M9.8 14.2a4.2 4.2 0 0 0 5.9 0l2.4-2.4a4.17 4.17 0 1 0-5.9-5.9l-1.2 1.2"/><path d="M14.2 9.8a4.2 4.2 0 0 0-5.9 0l-2.4 2.4a4.17 4.17 0 1 0 5.9 5.9l1.2-1.2"/>',
    controller:'<rect x="3.5" y="13.5" width="17" height="7" rx="2"/><path d="M7 17h.01M10.2 17h.01"/><path d="M12 10h.01"/><path d="M9.3 7.4a4 4 0 0 1 5.4 0"/><path d="M7 5a7.5 7.5 0 0 1 10 0"/>',
    elec:'<circle cx="12" cy="12" r="8.5"/><path d="M8.8 8 12 11.8 15.2 8"/><path d="M12 11.8v4.7"/><path d="M9.4 13.2h5.2M9.4 15.2h5.2"/>',
    more:'<rect x="4" y="4" width="4" height="4" rx="1.1"/><rect x="10" y="4" width="4" height="4" rx="1.1"/><rect x="16" y="4" width="4" height="4" rx="1.1"/><rect x="4" y="10" width="4" height="4" rx="1.1"/><rect x="10" y="10" width="4" height="4" rx="1.1"/><rect x="16" y="10" width="4" height="4" rx="1.1"/><rect x="4" y="16" width="4" height="4" rx="1.1"/><rect x="10" y="16" width="4" height="4" rx="1.1"/><rect x="16" y="16" width="4" height="4" rx="1.1"/>',
    /* ── 控制 ── */
    power:'<path d="M12 3.5v7.2"/><path d="M7.1 6.5a8 8 0 1 0 9.8 0"/>',
    snow:'<path d="M12 2.5v19M2.5 12h19"/><path d="M9.5 5 12 7.5 14.5 5"/><path d="M9.5 19 12 16.5 14.5 19"/><path d="M5 9.5 7.5 12 5 14.5"/><path d="M19 9.5 16.5 12 19 14.5"/>',
    sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8V5M12 19v2.2M2.8 12H5M19 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/>',
    fan:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.3"/><path d="M12 10.7c.2-2.5 1.6-4.2 3.9-4.7.7 2.3-.6 4.3-2.8 5.2"/><path d="M13.1 12.8c2.4-.8 4.6-.4 5.9 1.2-1.6 1.7-4 1.8-5.8.5"/><path d="M10.9 12.8c-2.2 1.3-4.5 1.3-6-.3 1.5-1.8 3.9-2.3 5.9-1.3"/>',
    drop:'<path d="M12 3.8s5.8 6.5 5.8 10.4a5.8 5.8 0 1 1-11.6 0C6.2 10.3 12 3.8 12 3.8Z"/>',
    /* ── 状态 ── */
    lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/><path d="M12 14.3v2.2"/>',
    alert:'<path d="M10.6 5.2 3.9 17.2a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13.4 5.2a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 10v3.8"/><path d="M12 16.9h.01"/>',
    check:'<path d="M4.5 12.5l5 5L19.5 6.5"/>',
    arrow:'<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    back:'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    /* ── 补充 ── */
    search:'<circle cx="11" cy="11" r="6.2"/><path d="M15.5 15.5 19.8 19.8"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2v5"/><path d="M12 7.8h.01"/>',
    chat:'<path d="M12 4.2c-4.9 0-8.7 3.2-8.7 7.2 0 2.3 1.3 4.3 3.3 5.6l-.9 2.8 3.3-1.7c.9.2 1.9.4 3 .4 4.9 0 8.7-3.2 8.7-7.1S16.9 4.2 12 4.2Z"/><path d="M9 10.8h.01M15 10.8h.01"/>',
    bill:'<path d="M6 3.5h12V20.5l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z"/><path d="M9 8.5h6M9 12.2h6"/>',
    wallet:'<path d="M4 8a2.5 2.5 0 0 1 2.5-2.5H17A2.5 2.5 0 0 1 19.5 8v8a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 16Z"/><path d="M14.5 11.5h5v4h-5a2 2 0 0 1 0-4Z"/>',
  };
  MP.icons=I;
  MP.icon=function(name,cls,sw){
    var p=I[name];
    if(!p)return '';
    return '<svg class="mp-ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      +' stroke-width="'+(sw||1.5)+'" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
  };
})();
