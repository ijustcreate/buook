const {chromium,_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-3d-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-3d-'));
  const ready=async()=>{await page.waitForFunction(()=>loaded&&!motion&&!coverMotion,null,{timeout:60000});await page.evaluate(()=>{$('#shelf').close();$('.reader-tools').open=true;});};
  const mouse=async p=>{const box=await page.locator('#book').boundingBox();return{x:box.x+p.x/1000*box.width,y:box.y+p.y/680*box.height};};
  const drag=async(from,to)=>{const a=await mouse(from),b=await mouse(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await ready();
    assert.equal(await page.title(),'Pixel Book');
    await page.evaluate(()=>{openSavedBook('starter-keeper');savedBooks=[];localStorage.setItem('keepers-book-shelf-v1','[]');});
    await page.locator('#close-book').click();await page.waitForFunction(()=>closedEdge==='front'&&!coverMotion);
    await page.waitForFunction(()=>closedBooks3D.faces.length>0);
    const before=await page.evaluate(()=>closedBooks3D.yaw);
    await drag({x:500,y:345},{x:700,y:380});
    assert.notEqual(await page.evaluate(()=>closedBooks3D.yaw),before);
    assert.equal(await page.evaluate(()=>closedEdge),'front');
    const faces=await page.evaluate(()=>{
      const views=[];
      for(const pitch of [-1.1,.2,1.1])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/4){
        closedBooks3D.pitch=pitch;closedBooks3D.yaw=yaw;draw();
        const faces=closedBooks3D.faces;
        if(!faces.some(f=>f.kind==='cover'))throw new Error('Missing cover');
        if(faces.some(f=>f.world.some(p=>!Number.isFinite(p.x+p.y+p.z))))throw new Error('Invalid 3D vertex');
        if(faces.some(f=>f.kind==='cover'&&(pitch>0?f.normal.y<0:f.normal.y>0)))throw new Error('Back-face culling failed');
        views.push(faces.length);
      }
      closedBooks3D.reset();return views;
    });
    await page.locator('#book').screenshot({path:path.join(output,'single.png')});
    await page.locator('#flip-closed').click();await page.waitForFunction(()=>closedEdge==='back'&&!closedFlipMotion);
    assert.ok(await page.evaluate(()=>closedBooks3D.faces.filter(face=>face.kind==='cover').every(face=>face.normal.y<0)));
    await page.locator('#book').screenshot({path:path.join(output,'back.png')});
    await page.locator('#flip-closed').click();await page.waitForFunction(()=>closedEdge==='front'&&!closedFlipMotion);
    await page.locator('#book-3d-open').click();await page.waitForFunction(()=>!closedEdge&&!coverMotion);
    await page.locator('#next').click();await page.waitForFunction(()=>spread===1&&!motion);
    await page.locator('#previous').click();await page.waitForFunction(()=>spread===0&&!motion);
    // Create two real shelf entries; no throwaway demo books pollute the shelf.
    await page.evaluate(()=>{bookName='3D test original';$('#book-name').value=bookName;saveBook();bookName='3D test second';$('#book-name').value=bookName;saveBook(true);});
    await page.locator('#book-table').click();
    await page.locator('#book-3d-spread').click();
    await page.locator('#book-3d-move').click();
    const move=await page.evaluate(()=>{
      const [a,b]=closedBooks3D.models;
      return{from:closedBooks3D.project(closedBooks3D.world(a,0,a.height,0)),to:closedBooks3D.project({x:b.x,y:a.y+a.height,z:b.z}),id:a.id,target:b.id};
    });
    await drag(move.from,move.to);
    const landed=await page.evaluate(({id,target})=>{
      const a=closedBooks3D.models.find(m=>m.id===id),b=closedBooks3D.models.find(m=>m.id===target);
      return {x:a.x,z:a.z,y:a.y,support:b.y+b.height,error:Math.hypot(a.x-b.x,a.z-b.z)};
    },move);
    assert.ok(landed.error<5,JSON.stringify(landed));assert.equal(landed.y,landed.support);
    await page.locator('#book-3d-turn-right').click();
    await page.locator('#book-3d-stack').click();
    await page.locator('#book').screenshot({path:path.join(output,'stack.png')});
    const layout=await page.evaluate(()=>localStorage.getItem('pixel-book-table-v1'));
    await page.reload();await ready();await page.locator('#book-table').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('pixel-book-table-v1')),layout);
    const persistence=await page.evaluate(()=>{
      const stored=JSON.parse(localStorage.getItem('pixel-book-table-v1'));
      return closedBooks3D.models.every(m=>m.x===stored[m.id].x&&m.z===stored[m.id].z&&m.y===stored[m.id].y&&m.angle===stored[m.id].angle);
    });assert.ok(persistence);
    // Removing the lower support makes the other book settle to the table.
    const gravity=await page.evaluate(()=>{
      const bottom=[...closedBooks3D.models].sort((a,b)=>a.y-b.y)[0];
      bottom.x=600;closedBooks3D.settle(bottom);draw();return closedBooks3D.models.every(m=>m.y===0);
    });assert.ok(gravity);
    await page.evaluate(()=>{closedBooks3D.selected=closedBooks3D.models.find(m=>m.id!==activeBookId);});
    await page.locator('#book-3d-open').click();await ready();
    assert.equal(await page.evaluate(()=>bookTableMode||closedEdge||spineView),false);
    assert.equal(await page.evaluate(()=>bookName),'3D test original');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({views:faces.length,orbit:true,dragToStack:landed,layoutReload:persistence,gravity,openSelected:true,pageTurns:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
