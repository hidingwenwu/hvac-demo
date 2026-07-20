const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'ctrl-ac.html'), 'utf8');

assert.match(html, /const AC_VISUAL_PROMO_KEY='acVisualPromoSeen'/);
assert.match(html, /function showVisualPromoOnce\(\)/);
assert.match(html, /if\(v==='plan'\)\{renderPlan\(\);showVisualPromoOnce\(\);\}/);
assert.match(html, /localStorage\.setItem\(AC_VISUAL_PROMO_KEY,'1'\)/);
assert.doesNotMatch(html, /sessionStorage\.getItem\('acPromoShown'\)/);
assert.doesNotMatch(html, /每次进入弹一次新功能推广/);
assert.match(html, /\.promo \.dialog\{[^}]*overflow:visible;/);
assert.match(html, /<button[^>]+class="promo-close"[^>]+aria-label="关闭功能介绍"/);
assert.match(html, /<span class="new-badge" id="visualNewBadge">New<\/span>/);
assert.match(html, /function syncVisualNewBadge\(\)/);
assert.match(html, /badge\.style\.display=localStorage\.getItem\(AC_VISUAL_PROMO_KEY\)\?'none':''/);
assert.match(html, /localStorage\.setItem\(AC_VISUAL_PROMO_KEY,'1'\);\s*syncVisualNewBadge\(\);\s*\$modal\('dlgPromo'\)/);
assert.match(html, /setPow\(false\);\s*syncVisualNewBadge\(\);/);
assert.match(html, /<div class="promo-tip"><span>请点击右上角<\/span><svg class="promo-guide-icon"[^>]*>[\s\S]*?<\/svg><span>参考操作指引页面内视频说明<\/span><\/div>/);
assert.match(html, /<svg class="promo-guide-icon"[^>]*><circle cx="12" cy="12" r="9\.2"\/><path d="M9\.6 9\.3a2\.5 2\.5 0 1 1 3\.4 2\.4c-\.8\.3-1 \.9-1 1\.8"\/><circle cx="12" cy="16\.6" r="\.4" fill="currentColor"\/><\/svg>/);
assert.match(html, /<div class="promo-left">\s*<div class="promo-img" id="promoImg"><\/div>\s*<div class="promo-tip">/);
assert.match(html, /<div class="promo-right">\s*<div class="promo-pts">[\s\S]*?<div class="promo-cta">/);

console.log('ac visual promo contract passed');
