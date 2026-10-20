const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'book-grab-shelf-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'book-grab-profile-')):null,browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true}),page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
 if(profile)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.webContents.setBackgroundThrottling(false);});
 page.on('pageerror',error=>errors.push(error.message));
 try{
  if(!profile)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
  assert.equal(await page.evaluate(()=>bookShelfMode&&closedBooks3D.shelfOnly),true);
  assert.equal(await page.locator('#shelf').evaluate(el=>el.open),false);
  const shelf=await page.evaluate(()=>({count:closedBooks3D.models.length,before:localStorage.getItem('pixel-book-table-v1'),positions:closedBooks3D.models.map(m=>closedBooks3D.world(m,0,m.height/2,m.length/2))}));
  assert.equal(shelf.count,11);assert.ok(shelf.positions.every(p=>Math.abs(p.y-24)<.001));
  await page.screenshot({path:path.join(output,'shelf.png')});
  await page.click('#shelf-open');assert.equal(await page.evaluate(()=>localStorage.getItem('pixel-book-table-v1')),shelf.before);
  const bookHit=await page.evaluate(()=>{
   const m=closedBooks3D.models.find(m=>m.id==='starter-dracula');for(const face of closedBooks3D.faces.filter(f=>f.model===m)){
    const p=face.screen.reduce((p,q)=>({x:p.x+q.x/face.screen.length,y:p.y+q.y/face.screen.length}),{x:0,y:0}),r=canvas.getBoundingClientRect(),x=Math.round(r.left+p.x*r.width/W),y=Math.round(r.top+p.y*r.height/H);
    if(![-1,0,1].every(dx=>[-1,0,1].every(dy=>closedBooks3D.hit({x:(x+dx-r.left)*W/r.width,y:(y+dy-r.top)*H/r.height})===m)))continue;return{x,y};
   }throw Error('No shelf spine hit');
  });
  await page.mouse.click(bookHit.x,bookHit.y,{button:'right'});
  await page.locator('#book-context-menu').waitFor({state:'visible'});await page.getByRole('menuitem',{name:'Read book',exact:true}).click();await page.waitForFunction(()=>!coverMotion);assert.equal(await page.evaluate(()=>activeBookId),'starter-dracula');
  await page.evaluate(()=>animateCover('front',true));await page.waitForFunction(()=>!coverMotion);assert.equal(await page.evaluate(()=>bookShelfMode&&closedBooks3D.shelfOnly),true);
  await page.click('#reader-library-switch');assert.equal(await page.evaluate(()=>bookTableMode&&!bookShelfMode),true);await page.click('#shelf-open');
  await page.evaluate(()=>{openSavedBook('starter-dracula');spread=5;closedEdge=null;updateControls();draw();});
  const results=[];
  for(const side of [1,-1])for(const v of [.08,.5,.92]){
   const target=await page.evaluate(({side,v})=>{
    spread=5;motion=null;drag=null;const chain=resting(side,side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1));
    const p=project(sampleChain(chain,.9),v),r=canvas.getBoundingClientRect();return {x:r.left+p.x*r.width/W,y:r.top+p.y*r.height/H};
   },{side,v});
   await page.mouse.move(target.x,target.y);await page.mouse.down();
   await page.mouse.move(target.x-side*170,target.y+(v<.5?25:-25),{steps:4});
   const pose=await page.evaluate(()=>{
    if(!motion?.grab)throw Error('No material grab');const g=motion.grab,c=turnChain(motion.direction,motion.progress),held=project(sampleChain(c,g.u),g.v);
    const r=canvas.getBoundingClientRect();return{u:g.u,v:g.v,p:motion.progress,held:{x:r.left+held.x*r.width/W,y:r.top+held.y*r.height/H},top:project(c.at(-1),0),bottom:project(c.at(-1),1),pins:[g.pinX,g.pinY]};
   });
   assert.ok(Math.abs(pose.u-.9)<.01&&Math.abs(pose.v-v)<.01,JSON.stringify(pose));
   assert.ok(Math.hypot(pose.held.x-(target.x-side*170),pose.held.y-(target.y+(v<.5?25:-25)))<2,'Held material point slipped '+JSON.stringify({side,v,target,pose}));
   if(side===1)await page.screenshot({path:path.join(output,`grab-${v}.png`)});
   await page.mouse.up();await page.waitForFunction(()=>!motion);results.push({side,...pose});
  }
  // A short pull cancels rather than silently advancing; a click still turns.
  const click=await page.evaluate(()=>{spread=5;updateControls();draw();const q=project(sampleChain(resting(1,1-spread/(spreadCount()-1)),.9),.5),r=canvas.getBoundingClientRect();return{x:r.left+q.x*r.width/W,y:r.top+q.y*r.height/H};});
  await page.mouse.move(click.x,click.y);await page.mouse.down();await page.mouse.move(click.x-12,click.y);await page.mouse.up();await page.waitForFunction(()=>!motion);assert.equal(await page.evaluate(()=>spread),5);
  await page.mouse.click(click.x,click.y);await page.waitForFunction(()=>!motion);assert.equal(await page.evaluate(()=>spread),6);
  await page.click('#shelf-open');assert.equal(await page.evaluate(()=>bookShelfMode),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({shelf,results,errors,output}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
