/* 绑定账号页（MP.pages.login-bind）：微信首次授权后绑定已有平台账号
   演示账号：admin/123456（物业管理员），其余提示"账号或密码错误"；V2.0 去角色化，绑定成功即物业管理员身份 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['login-bind']={
  title:'绑定账号',
  note:[
    {type:'新增',text:'微信授权后绑定已有账号，账号体系与 Web 端互通'},
    {type:'新增',text:'预留 Web 端微信扫码登录的绑定逻辑演示'},
  ],
  render(el){
    el.innerHTML=
    '<div class="mp-card">'
      +'<div style="font-size:14px;color:var(--mp-ts);line-height:1.7">微信首次登录需绑定平台账号，绑定后微信可一键登录。</div>'
      +'<div class="mp-sub" style="margin-top:10px;line-height:1.7">Web 端适配预留：Web 端登录页后续新增「微信扫码登录」入口，扫码后同样走账号绑定流程，双端共用一套绑定关系（原型仅作逻辑演示）。</div>'
    +'</div>'
    +'<div class="mp-card">'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>账号</div><input id="bdAcc" placeholder="账号（或手机号）" autocomplete="off"></div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>密码</div><input id="bdPwd" type="password" placeholder="请输入密码"></div>'
    +'</div>'
    +'<button class="mp-btn mp-btn-primary mp-btn-block" id="bdOk">绑定并登录</button>';
  },
  mount(el){
    el.querySelector('#bdOk').onclick=()=>{
      const acc=el.querySelector('#bdAcc').value.trim(), pwd=el.querySelector('#bdPwd').value;
      if(!acc){MP.ui.toast('请输入账号','er');return;}
      if(!pwd){MP.ui.toast('请输入密码','er');return;}
      if(acc!=='admin'||pwd!=='123456'){MP.ui.toast('账号或密码错误','er');return;}
      /* 绑定成功：写绑定关系 + 登录态（V2.0 固定物业管理员身份） */
      MP.store.set('wxBound',true);
      MP.state.set('loggedIn',true);
      MP.state.set('role','admin');
      MP.ui.toast('绑定成功','ok');
      setTimeout(()=>MP.switchTab('home'),300);
    };
  },
};
