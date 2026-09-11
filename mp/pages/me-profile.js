/* 账号信息页（MP.pages.me-profile）：账号资料展示与编辑
   可编辑：姓名 / 手机号 / 邮箱（保存后写 MP.store 按角色分键持久化）
   只读项：账号 / 角色 / 所属项目（角色与项目由登录态决定，本页不可改） */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages['me-profile']={
  title:'账号信息',
  note:[
    {type:'新增',text:'移动端新增账号资料页，旧小程序无'},
  ],

  ROLE_TXT:{admin:'物业管理员',tenant:'租户'},
  /* 演示默认资料：按角色各一份 */
  DEFAULTS:{
    admin:{name:'王建国',phone:'13800000001',email:'admin@example.com'},
    tenant:{name:'李晓梅',phone:'13900000002',email:'tenant@example.com'},
  },

  _role(){ return MP.state.get('role')||'admin'; },
  _profile(){
    const role=this._role();
    return Object.assign({},this.DEFAULTS[role],MP.store.get('profile_'+role)||{});
  },
  _project(){
    const pid=MP.state.get('projectId');
    return MP.data.projects.find(p=>p.id===pid)||MP.data.projects[0];
  },

  render(el){
    const role=this._role(), pf=this._profile(), pj=this._project();
    el.innerHTML=
    /* 1. 只读信息：账号 / 角色 / 所属项目 */
    '<div class="mp-list">'
      +'<div class="mp-item"><div class="bd"><div class="t1">账号</div></div><div class="ft">'+role+'</div></div>'
      +'<div class="mp-item"><div class="bd"><div class="t1">角色</div></div><div class="ft">'+this.ROLE_TXT[role]+'</div></div>'
      +'<div class="mp-item"><div class="bd"><div class="t1">所属项目</div></div><div class="ft">'+pj.name+'</div></div>'
    +'</div>'
    /* 2. 可编辑资料：姓名 / 手机号 / 邮箱 */
    +'<div class="mp-card">'
      +'<div class="mp-card-t">基本资料</div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>姓名</div><input id="pfName" maxlength="20" value="'+pf.name+'" autocomplete="off"></div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>手机号</div><input id="pfPhone" maxlength="11" inputmode="numeric" value="'+pf.phone+'"></div>'
      +'<div class="mp-field"><div class="lab"><span class="req">*</span>邮箱</div><input id="pfMail" maxlength="50" value="'+pf.email+'"></div>'
    +'</div>'
    +'<button class="mp-btn mp-btn-primary mp-btn-block" id="pfSave">保存</button>';
  },

  mount(el){
    const self=this;
    el.querySelector('#pfSave').onclick=()=>{
      const name=el.querySelector('#pfName').value.trim(),
            phone=el.querySelector('#pfPhone').value.trim(),
            email=el.querySelector('#pfMail').value.trim();
      if(!name){MP.ui.toast('请输入姓名','er');return;}
      if(!phone){MP.ui.toast('请输入手机号','er');return;}
      if(!/^1\d{10}$/.test(phone)){MP.ui.toast('请输入正确的手机号','er');return;}
      if(!email){MP.ui.toast('请输入邮箱','er');return;}
      MP.store.set('profile_'+self._role(),{name:name,phone:phone,email:email});
      MP.ui.toast('已保存','ok');
    };
  },
};
