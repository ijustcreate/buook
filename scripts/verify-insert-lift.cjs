const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-insert-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-insert-profile-')):null;
 const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
 const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  if(!profile)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
  const origin=await page.evaluate(()=>{openSavedBook('starter-keeper');spread=1;draw();const item=keepsakes.find(i=>i.sheet===1)||keepsakes[0];Object.assign(itemState(item),{outside:false,pageNumber:2,u:.6,v:.62,rotation:.12,back:false,taped:false});draw();window.testInsert=item;window.originalMount={...itemState(item)};const hit=itemHits.find(h=>h.item===item),r=canvas.getBoundingClientRect();return{x:r.left+hit.x/W*r.width,y:r.top+hit.y/H*r.height};});
  await page.mouse.click(origin.x,origin.y);await page.waitForFunction(()=>inspection?.lift===1);
  assert.equal(await page.evaluate(()=>getComputedStyle($('#inspect')).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await page.evaluate(()=>itemHits.some(h=>h.item===testInsert)),false);
  await page.screenshot({path:path.join(output,'lifted.png')});
  await page.click('#flip-item');await page.waitForFunction(()=>inspection?.back&&!inspection.animating);
  await page.click('#close-item');await page.waitForFunction(()=>!inspection);
  assert.deepEqual(await page.evaluate(()=>['u','v','rotation','pageNumber'].map(k=>itemState(testInsert)[k])),[.6,.62,.12,2]);
  assert.equal(await page.evaluate(()=>itemState(testInsert).back),true);
  await page.evaluate(()=>openItem(testInsert,true,2));await page.waitForFunction(()=>inspection?.lift===1);await page.click('#tape-item');
  assert.equal(await page.evaluate(()=>itemState(testInsert).taped&&itemState(testInsert).back),true);
  const strips=await page.evaluate(()=>insertTapeLayout(testInsert));assert.equal(strips.length,2);assert.ok(strips.every(s=>s.length<=58));
  await page.screenshot({path:path.join(output,'taped-back.png')});
  if(!profile){await page.setViewportSize({width:320,height:640});await page.waitForFunction(()=>{const r=document.querySelector('#insert-focus').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+.1;});const bounds=await page.locator('#insert-focus').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=320.1);await page.screenshot({path:path.join(output,'mobile.png')});await page.setViewportSize({width:1180,height:950});}
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!inspection);
  await page.reload();await page.waitForFunction(()=>loaded);
  assert.equal(await page.evaluate(()=>itemState(keepsakes.find(i=>i.sheet===1)||keepsakes[0]).back),true);
  assert.equal(await page.evaluate(()=>itemState(keepsakes.find(i=>i.sheet===1)||keepsakes[0]).taped),true);
  await page.evaluate(()=>{$('#shelf').close();closedEdge=null;spread=1;draw();const item=keepsakes.find(i=>i.sheet===1)||keepsakes[0];openItem(item,true,2);});await page.waitForFunction(()=>inspection?.lift===1);
  await page.click('#tape-item');await page.mouse.click(8,8);await page.waitForFunction(()=>!inspection);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({lift:true,flipPersists:true,tapedBackPersists:true,exactReturn:true,escape:true,outsideDismiss:true,strips,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
