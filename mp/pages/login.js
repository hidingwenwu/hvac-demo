/* 登录页：账号密码 / 手机验证码 / 微信一键登录
   演示账号：物业管理员 admin/123456（写死校验，仅原型演示）；V2.0 去角色化，登录即物业管理员身份 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages.login={
  title:'登录',
  note:[
    {type:'新增',text:'新增手机验证码、微信一键登录两种方式，旧小程序仅账号密码'},
    {type:'新增',text:'微信首次登录绑定已有账号，Web 端后续同步适配扫码/绑定登录，双端登录体系统一'},
    {type:'优化',text:'登录页改版为移动端竖屏布局，品牌更名「空调集控管家」'},
    {type:'删减',text:'V2.0 去角色化：删除演示账号快捷登录卡片区，登录成功即物业管理员身份'},
  ],
  _timer:null,   /* 验证码倒计时定时器，页面重渲染时必须清理防泄漏 */

  /* 登录成功统一入口：写登录态与角色（V2.0 固定物业管理员）→ toast → 回首页 Tab */
  _doLogin(){
    MP.state.set('loggedIn',true);
    MP.state.set('role','admin');   /* role 键保留：elec-admin 等页既有 role 判断不破坏 */
    MP.ui.toast('登录成功','ok');
    setTimeout(()=>MP.switchTab('home'),300);
  },

  render(el){
    el.innerHTML=
    '<div class="mp-login-brand">'
      +'<div class="mp-login-logo">'+MP.icon('snow')+'</div>'
      +'<div class="mp-login-name">空调集控管家</div>'
      +'<div class="mp-login-sub">空调集中控制 · 节能管理移动助手</div>'
    +'</div>'
    +'<div class="mp-login-tabs">'
      +'<div class="mp-login-tab on" data-t="account">账号密码</div>'
      +'<div class="mp-login-tab" data-t="sms">手机验证码</div>'
      +'<div class="mp-login-tab" data-t="wx">微信登录</div>'
    +'</div>'
    +'<div class="mp-card" id="lgBody" style="margin-top:0"></div>'
    +'<div class="mp-copyright">© 2026 青岛飞奕科技有限公司</div>';
  },

  mount(el){
    const self=this;
    if(self._timer){clearInterval(self._timer);self._timer=null;}   /* 重渲染清理旧倒计时 */
    const body=el.querySelector('#lgBody');
    let tab='account';

    /* ── 三个登录 tab 的表单渲染 ── */
    function renderBody(){
      el.querySelectorAll('.mp-login-tab').forEach(t=>t.classList.toggle('on',t.dataset.t===tab));
      if(tab==='account'){
        body.innerHTML=
          '<div class="mp-field"><div class="lab"><span class="req">*</span>账号</div><input id="lgAcc" placeholder="请输入账号" autocomplete="off"></div>'
          +'<div class="mp-field"><div class="lab"><span class="req">*</span>密码</div><input id="lgPwd" type="password" placeholder="请输入密码"></div>'
          +'<button class="mp-btn mp-btn-primary" id="lgGo" style="width:100%;margin-top:14px">登录</button>';
        body.querySelector('#lgGo').onclick=()=>{
          const acc=body.querySelector('#lgAcc').value.trim(), pwd=body.querySelector('#lgPwd').value;
          if(!acc){MP.ui.toast('请输入账号','er');return;}
          if(!pwd){MP.ui.toast('请输入密码','er');return;}
          if(acc==='admin'&&pwd==='123456')self._doLogin();
          else MP.ui.toast('账号或密码错误','er');
        };
      }
      else if(tab==='sms'){
        body.innerHTML=
          '<div class="mp-field"><div class="lab"><span class="req">*</span>手机号</div><input id="lgPhone" maxlength="11" inputmode="numeric" placeholder="请输入 11 位手机号"></div>'
          +'<div class="mp-field"><div class="lab"><span class="req">*</span>验证码</div><input id="lgCode" maxlength="6" inputmode="numeric" placeholder="请输入 6 位验证码">'
          +'<button class="mp-code-btn" id="lgSend">获取验证码</button></div>'
          +'<button class="mp-btn mp-btn-primary" id="lgGo" style="width:100%;margin-top:14px">登录</button>';
        const sendBtn=body.querySelector('#lgSend');
        sendBtn.onclick=()=>{
          const phone=body.querySelector('#lgPhone').value.trim();
          if(!/^1\d{10}$/.test(phone)){MP.ui.toast('请输入正确的手机号','er');return;}
          MP.ui.toast('验证码已发送（演示环境任意 6 位）','ok');
          /* 60s 倒计时：每秒更新文案，结束恢复；按钮不在 DOM 中（页面重渲染）时自清 */
          let n=60; sendBtn.disabled=true; sendBtn.textContent=n+'s 后重发';
          self._timer=setInterval(()=>{
            n--;
            if(!document.contains(sendBtn)){clearInterval(self._timer);self._timer=null;return;}
            if(n<=0){clearInterval(self._timer);self._timer=null;sendBtn.disabled=false;sendBtn.textContent='获取验证码';}
            else sendBtn.textContent=n+'s 后重发';
          },1000);
        };
        body.querySelector('#lgGo').onclick=()=>{
          const phone=body.querySelector('#lgPhone').value.trim(), code=body.querySelector('#lgCode').value.trim();
          if(!/^1\d{10}$/.test(phone)){MP.ui.toast('请输入正确的手机号','er');return;}
          if(!/^\d{6}$/.test(code)){MP.ui.toast('请输入 6 位验证码','er');return;}
          self._doLogin();   /* 演示环境：验证码登录同样进入物业管理员身份 */
        };
      }
      else{ /* wx 微信登录 */
        body.innerHTML=
          '<div style="padding:22px 6px 4px;text-align:center;font-size:13px" class="mp-muted">使用微信身份快捷登录<br>首次登录需绑定平台账号</div>'
          +'<button class="mp-btn mp-btn-wx" id="lgWx" style="width:100%;margin:12px 0 8px">微信一键登录</button>';
        body.querySelector('#lgWx').onclick=()=>{
          /* 模拟微信授权弹窗：允许后按绑定状态分流 */
          MP.ui.confirm({
            title:'微信授权',
            text:'<div class="mp-wx-auth"><div class="avatar">'+MP.icon('me')+'</div>'
              +'<div style="font-weight:600;color:var(--mp-tx)">微信用户</div>'
              +'<div>「空调集控管家」申请获取你的昵称、头像</div></div>',
            okText:'允许', cancelText:'拒绝',
          },()=>{
            if(MP.store.get('wxBound'))self._doLogin();   /* 已绑定：直接登录（物业管理员身份） */
            else{MP.ui.toast('首次登录请先绑定平台账号');MP.go('login-bind');}
          });
        };
      }
    }

    el.querySelectorAll('.mp-login-tab').forEach(t=>t.onclick=()=>{tab=t.dataset.t;renderBody();});

    renderBody();
  },
};
