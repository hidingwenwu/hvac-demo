/* 临时：R5 截图脚本（模式设置/限定设置/锁定联动态） */
const path=require('node:path');
const { chromium }=require('playwright-core');
const FILE='file:///'+path.join(__dirname,'..','hvac-demo-mp.html').replace(/\\/g,'/');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:414,height:896}});
  await page.goto(FILE);
  await page.evaluate(()=>{ localStorage.clear(); MP.state.set('loggedIn',true); MP.state.set('role','admin'); });
  await page.evaluate(()=>{ MP.switchTab('device'); MP.go('device-detail',{id:'d1'}); });
  await page.waitForTimeout(200);
  await page.locator('#phone').screenshot({path:__dirname+'/r5-mode.png'});
  await page.locator('.mp-dd-tab[data-tab="limit"]').click();
  await page.waitForTimeout(100);
  await page.locator('.mp-switch[data-lk="tempOn"]').click();
  await page.waitForTimeout(100);
  await page.locator('#phone').screenshot({path:__dirname+'/r5-limit.png'});
  await page.evaluate(()=>{ MP.back(); MP.go('device-detail',{id:'d6'}); });
  await page.waitForTimeout(300);
  await page.locator('#phone').screenshot({path:__dirname+'/r5-locked.png'});
  await browser.close();
  console.log('DONE');
})().catch(e=>{console.error(e);process.exit(1)});
