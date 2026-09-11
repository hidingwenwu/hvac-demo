/* 登录设置页（MP.pages.login-settings）：修改密码 + 微信绑定状态 + 登录方式说明
   演示校验：原密码固定 123456；新密码 ≥6 位且两次输入一致
   微信绑定状态读 MP.store.wxBound，已绑定可解绑（confirm 二次确认） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['login-settings']={
  title:'登录设置',
  note:[
    {type:'新增',text:'修改密码、微信绑定管理为移动端新增能力，旧小程序无'},
    {type:'新增',text:'微信解绑后下次微信一键登录需重新绑定账号'},
  ],

  render(el){
    const bound=!!MP.store.get('wxBound');
    el.innerHTML=
    /* 1. 修改密码 */
    '<div class="mp-card">'
      +'<div class="mp-card-t">修改密码</div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>原密码</div><input id="lsOld" type="password" placeholder="请输入原密码"></div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>新密码</div><input id="lsNew" type="password" placeholder="请输入新密码（≥6 位）"></div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>确认新密码</div><input id="lsNew2" type="password" placeholder="请再次输入新密码"></div>'
      +'<button class="mp-btn mp-btn-primary" id="lsSave" style="width:100%;margin-top:14px">确认修改</button>'
    +'</div>'
    /* 2. 微信绑定状态 */
    +'<div class="mp-list">'
      +'<div class="mp-item" id="lsWx"><div class="ic">'+MP.icon('chat')+'</div><div class="bd"><div class="t1">微信绑定状态</div>'
        +(bound?'<div class="t2">解绑后微信一键登录需重新绑定</div>':'<div class="t2">可在登录页使用微信登录并绑定</div>')
      +'</div><div class="ft">'+(bound?'<span class="mp-tag tag-ok">已绑定</span>':'<span class="mp-tag tag-info">未绑定</span>')+'</div>'
      +(bound?'<div class="arrow"></div>':'')
      +'</div>'
    +'</div>'
    /* 3. 登录方式说明（静态文案） */
    +'<div class="mp-sec">登录方式说明</div>'
    +'<div class="mp-card" style="margin-top:0">'
      +'<div style="font-size:14px;color:var(--mp-ts);line-height:1.9">'
      +'1. 账号密码：使用平台分配的账号与密码登录。<br>'
      +'2. 手机验证码：输入绑定手机号获取验证码登录，验证码 60 秒内有效。<br>'
      +'3. 微信一键登录：授权微信身份快捷登录，首次需绑定平台账号，解绑后需重新绑定。'
      +'</div>'
    +'</div>';
  },

  mount(el){
    /* ── 修改密码：必填 → 原密码演示校验 123456 → 新密码 ≥6 位 → 两次一致 ── */
    el.querySelector('#lsSave').onclick=()=>{
      const o=el.querySelector('#lsOld').value,
            n1=el.querySelector('#lsNew').value,
            n2=el.querySelector('#lsNew2').value;
      if(!o){MP.ui.toast('请输入原密码','er');return;}
      if(!n1){MP.ui.toast('请输入新密码','er');return;}
      if(!n2){MP.ui.toast('请再次输入新密码','er');return;}
      if(o!=='123456'){MP.ui.toast('原密码错误','er');return;}
      if(n1.length<6){MP.ui.toast('新密码不少于 6 位','er');return;}
      if(n1!==n2){MP.ui.toast('两次输入的新密码不一致','er');return;}
      MP.ui.toast('密码已修改','ok');
      el.querySelector('#lsOld').value=''; el.querySelector('#lsNew').value=''; el.querySelector('#lsNew2').value='';
    };

    /* ── 微信绑定状态：已绑定 → 点击解绑（confirm + 重渲染）；未绑定 → 仅提示 ── */
    const wx=el.querySelector('#lsWx');
    if(wx)wx.onclick=()=>{
      if(!MP.store.get('wxBound')){ MP.ui.toast('当前未绑定微信'); return; }
      MP.ui.confirm({title:'解绑微信',text:'解绑后微信一键登录需重新绑定账号，确定解绑？',okText:'解绑',danger:true},()=>{
        MP.store.set('wxBound',false);
        MP.renderFrame();
        MP.ui.toast('已解绑微信','ok');
      });
    };
  },
};
