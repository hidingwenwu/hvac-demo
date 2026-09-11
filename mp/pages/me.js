/* 我的·个人中心 Tab 主页（MP.pages.me）：移动端新增模块，旧小程序无对应页
   自上而下：用户卡（头像/账号/角色标签/所属项目）→ 功能列表 → 退出登录
   V2.0 去角色化：单一物业管理员身份，移除角色切换演示入口 */
window.MP=window.MP||{};MP.pages=MP.pages||{};
MP.pages.me={
  title:'我的',tab:true,
  note:[
    {type:'新增',text:'个人中心为移动端新增模块，旧小程序无'},
    {type:'删减',text:'V2.0 去角色化：移除「切换角色」演示入口，固定物业管理员身份'},
  ],

  _project(){
    const pid=MP.state.get('projectId');
    return MP.data.projects.find(p=>p.id===pid)||MP.data.projects[0];
  },

  render(el){
    const pj=this._project();
    el.innerHTML=
    /* 1. 用户卡：圆形头像（首字符）+ 账号名 + 角色标签（固定物业管理员）+ 所属项目 */
    '<div class="mp-card mp-me-user">'
      +'<div class="mp-me-avatar admin">A</div>'
      +'<div class="bd">'
        +'<div class="t1">admin<span class="mp-tag tag-primary">物业管理员</span></div>'
        +'<div class="t2">所属项目：'+pj.name+'</div>'
      +'</div>'
    +'</div>'
    /* 2. 账号相关 */
    +'<div class="mp-list">'
      +'<div class="mp-item" id="meProfile"><div class="ic">'+MP.icon('me')+'</div><div class="bd"><div class="t1">账号信息</div></div><div class="arrow"></div></div>'
      +'<div class="mp-item" id="meLoginSet"><div class="ic">'+MP.icon('lock')+'</div><div class="bd"><div class="t1">登录设置</div></div><div class="arrow"></div></div>'
    +'</div>'
    /* 3. 关于 */
    +'<div class="mp-list">'
      +'<div class="mp-item" id="meAbout"><div class="ic">'+MP.icon('info')+'</div><div class="bd"><div class="t1">关于</div></div><div class="arrow"></div></div>'
    +'</div>'
    /* 4. 退出登录：红色描边大按钮，二次确认 */
    +'<button class="mp-btn mp-btn-danger-plain mp-btn-block" id="meLogout">退出登录</button>';
  },

  mount(el){
    el.querySelector('#meProfile').onclick=()=>MP.go('me-profile');
    el.querySelector('#meLoginSet').onclick=()=>MP.go('login-settings');
    el.querySelector('#meAbout').onclick=()=>MP.go('about');

    /* 退出登录：清登录态 → hash 指向 login → reload 重建（boot 兜底进登录页） */
    el.querySelector('#meLogout').onclick=()=>{
      MP.ui.confirm({title:'退出登录',text:'确定退出当前账号？',okText:'退出',danger:true},()=>{
        MP.state.set('loggedIn',false);
        location.hash='/login';
        location.reload();
      });
    };
  },
};
