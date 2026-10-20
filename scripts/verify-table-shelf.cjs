const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-table-shelf-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-shelf-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  try{
    if(!profile)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    const initial=await page.evaluate(()=>{
      $('#shelf').close();openSavedBook('starter-frankenstein');closedEdge='front';closedSceneKey='';updateControls();draw();
      const r=closedBooks3D,point={x:-160,y:r.models[0].height/2,z:0},before=r.project(point);
      r.orbitBy(30,0);const right=r.project(point);r.reset();r.orbitBy(0,30);const down=r.project(point);r.reset();
      if(right.x<=before.x||down.y<=before.y)throw new Error('Visible spine does not follow pointer');
      toggleBookTable();
      for(const id of ['starter-dracula','starter-dorian-gray','starter-time-machine','starter-secret-garden']){
        r.selected=r.models.find(m=>m.id===id);r.moveSelected(true);
      }
      return{right:right.x-before.x,down:down.y-before.y,shelf:r.models.filter(m=>m.shelved).length,furniture:r.faces.filter(f=>!f.model).length};
    });assert.equal(initial.shelf,4);assert(initial.furniture>0);
    await page.screenshot({path:path.join(output,'table-and-shelf.png')});
    const hit=async id=>page.evaluate(id=>{
      const r=closedBooks3D,m=r.models.find(m=>m.id===id);
      // Search opaque rendered pixels, not a potentially occluded face centre.
      for(const face of r.faces.filter(f=>f.model===m).reverse()){
        const p=face.screen.reduce((a,b)=>({x:a.x+b.x/face.screen.length,y:a.y+b.y/face.screen.length}),{x:0,y:0});
        if(p.x>10&&p.x<990&&p.y>10&&p.y<670&&r.hit(p)===m)return p;
      }
      throw new Error('No reachable book '+id);
    },id);
    const rightClick=async id=>{const p=await hit(id),r=await page.locator('#book').boundingBox();await page.mouse.click(r.x+p.x/1000*r.width,r.y+p.y/680*r.height,{button:'right'});await page.locator('#book-context-menu').waitFor({state:'visible'});};
    await rightClick('starter-time-machine');await page.getByRole('menuitem',{name:'Move to table',exact:true}).click();
    assert.equal(await page.evaluate(()=>closedBooks3D.models.find(m=>m.id==='starter-time-machine').shelved),false);
    await rightClick('starter-time-machine');await page.getByRole('menuitem',{name:'Move to bookshelf',exact:true}).click();
    await page.reload();await page.waitForFunction(()=>loaded);await page.evaluate(()=>{$('#shelf').close();toggleBookTable();});
    assert.equal(await page.evaluate(()=>closedBooks3D.models.filter(m=>m.shelved).length),4);
    await rightClick('starter-time-machine');await page.getByRole('menuitem',{name:'Read book',exact:true}).click();await page.waitForFunction(()=>!coverMotion&&!closedEdge&&!bookTableMode);
    assert.equal(await page.evaluate(()=>activeBookId),'starter-time-machine');
    await page.evaluate(()=>animateCover('front',true));await page.waitForFunction(()=>!coverMotion&&bookTableMode);
    assert.equal(await page.evaluate(()=>closedBooks3D.selected.shelved),true);
    await rightClick('starter-dracula');await page.getByRole('menuitem',{name:'View cover',exact:true}).click();
    assert.equal(await page.evaluate(()=>activeBookId==='starter-dracula'&&closedEdge==='front'&&!bookTableMode),true);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({initial,contextActions:true,persistence:true,readShelfAndReturn:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
