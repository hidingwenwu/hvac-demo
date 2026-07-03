// step2b: 从 _sidebar.html 解析完整菜单树(含路由与图标)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(OUT, '_sidebar.html'), 'utf8');

// 轻量解析:按序扫描 el-submenu 标题 / 菜单项 a[href]
const menu = [];
let curGroup = null, curSub = null;

// 用正则逐段扫描
const re = /<div class="el-submenu__title"[^>]*>[\s\S]*?xlink:href="#(icon-[^"]*)"[\s\S]*?<span[^>]*>([^<]+)<\/span>|<a href="([^"]+)"[^>]*>\s*<li[^>]*class="el-menu-item[^"]*"[^>]*>(?:[\s\S]*?xlink:href="#(icon-[^"]*)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;

// 先按嵌套深度处理:padding-left 20=一级 40=二级 60=三级
const re2 = /(?:<div class="el-submenu__title" style="padding-left: (\d+)px[^"]*"[^>]*>(?:[\s\S]{0,500}?xlink:href="#(icon-[^"]+)")?[\s\S]{0,800}?<span[^>]*>([^<]+)<\/span>)|(?:<a href="([^"]+)"[^>]*>\s*<li[^>]*class="el-menu-item[^"]*"[^>]*style="padding-left: (\d+)px[^"]*"[^>]*>(?:[\s\S]{0,500}?xlink:href="#(icon-[^"]+)")?[\s\S]{0,800}?<span[^>]*>([^<]+)<\/span>)/g;

let m;
const stack = [{ depth: 0, children: menu }];
while ((m = re2.exec(html))) {
  if (m[3] !== undefined) {
    // submenu 标题
    const depth = +m[1], icon = m[2] || '', label = m[3].trim();
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    const g = { type: 'group', label, icon, children: [] };
    stack[stack.length - 1].children.push(g);
    stack.push({ depth, children: g.children });
  } else {
    const href = m[4], depth = +m[5], icon = m[6] || '', label = m[7].trim();
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].children.push({ type: 'item', label, route: href, icon });
  }
}
fs.writeFileSync(path.join(OUT, 'menu.json'), JSON.stringify(menu, null, 2));
// 摘要打印
function pr(nodes, ind) {
  for (const n of nodes) {
    console.log(ind + (n.type === 'group' ? '▸ ' : '· ') + n.label + (n.route ? '  ' + n.route : '') + (n.icon ? '  [' + n.icon + ']' : ''));
    if (n.children) pr(n.children, ind + '  ');
  }
}
pr(menu, '');
