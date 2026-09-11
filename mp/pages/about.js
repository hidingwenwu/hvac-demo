/* 关于页（MP.pages.about）：品牌信息 + 备案/版权/客服
   除登录页外唯一出现备案主体「青岛飞奕科技有限公司」的页面 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages.about={
  title:'关于',
  note:[
    {type:'优化',text:'品牌更名统一为「空调集控管家」'},
  ],

  render(el){
    el.innerHTML=
    /* 1. 居中品牌区：占位 LOGO + 产品名 + 版本 */
    '<div class="mp-login-brand">'
      +'<div class="mp-login-logo">'+MP.icon('snow')+'</div>'
      +'<div class="mp-login-name">空调集控管家</div>'
      +'<div class="mp-login-sub">V1.0.0</div>'
    +'</div>'
    /* 2. 信息列表：备案主体 / 客服电话 / 版权声明 */
    +'<div class="mp-list">'
      +'<div class="mp-item"><div class="bd"><div class="t1">备案主体</div></div><div class="ft">青岛飞奕科技有限公司</div></div>'
      +'<div class="mp-item"><div class="bd"><div class="t1">客服电话</div></div><div class="ft">400-000-0000（占位）</div></div>'
      +'<div class="mp-item"><div class="bd"><div class="t1">版权声明</div></div><div class="ft">© 2026 青岛飞奕科技有限公司</div></div>'
    +'</div>';
  },
};
