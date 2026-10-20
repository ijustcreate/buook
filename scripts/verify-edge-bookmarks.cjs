const {chromium,_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-tabs-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-tabs-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const capture=async name=>{const b=await page.evaluate(()=>canvas.toDataURL().split(',')[1]);await fs.writeFile(path.join(output,name+'.png'),Buffer.from(b,'base64'));};
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded,null,{timeout:60000});
    const initial=await page.evaluate(()=>{
      spread=5;for(const item of allInserts())Object.assign(itemMounts.get(item.sheet),{outside:false,pageNumber:99999,taped:false});
      const positions=[{page:10,u:.35,v:0,edge:'top'},{page:10,u:.65,v:1,edge:'bottom'},{page:9,u:1,v:.3,edge:'left'},{page:10,u:1,v:.75,edge:'right'}];
      positions.forEach((p,i)=>{Object.assign(itemMounts.get(keepsakes[i].sheet),{pageNumber:p.page,outside:false,taped:false,u:p.u,v:p.v,rotation:-.1,back:false});rememberEdgeBookmark(keepsakes[i]);if(itemState(keepsakes[i]).edgeMark.edge!==p.edge)throw new Error('Wrong edge');});
      draw();return JSON.stringify(bookContent.edgeBookmarks);
    });await capture('all-edges-visible');
    const hidden=await page.evaluate(()=>{
      for(let i=0;i<3;i++){begin(1,true);motion.progress=1;draw();finish(true);}draw();
      return itemHits.filter(hit=>hit.hiddenMark).map(hit=>({id:hit.item.sheet,page:hit.pageNumber}));
    });assert.equal(hidden.length,4);await capture('tabs-in-left-stack');
    const clickable=await page.evaluate(()=>{
      const h=itemHits.find(h=>h.hiddenMark&&itemState(h.item).edgeMark.edge==='top');
      for(let y=h.y-h.h/2;y<h.y+h.h/2;y+=2)for(let x=h.x-h.w/2;x<h.x+h.w/2;x+=2)if(itemHit({x,y})===h)return{x,y,page:h.pageNumber};
      throw new Error('No exposed clickable tab');
    });
    const rect=await page.locator('#book').boundingBox();await page.mouse.click(rect.x+clickable.x/1000*rect.width,rect.y+clickable.y/680*rect.height);
    await page.waitForFunction(target=>spread===Math.ceil(target/2)&&!motion&&!queuedTurns.length,clickable.page,{timeout:15000});
    assert.equal(await page.evaluate(()=>JSON.stringify(bookContent.edgeBookmarks)),initial);
    await page.reload();await page.waitForFunction(()=>loaded);
    assert.equal(await page.evaluate(()=>JSON.stringify(bookContent.edgeBookmarks)),initial);
    assert.equal(await page.evaluate(()=>allInserts().filter(item=>itemState(item).edgeMark).length),4);
    await page.evaluate(()=>{bookName='Bookmark shelf test';$('#book-name').value=bookName;saveBook();bookContent.edgeBookmarks=[];restoreEdgeBookmarks();openSavedBook(activeBookId);});
    assert.equal(await page.evaluate(()=>allInserts().filter(item=>itemState(item).edgeMark).length),4);
    await capture('reloaded-right-stack');
    const rightTips=await page.evaluate(()=>itemHits.filter(h=>h.hiddenMark).map(h=>{
      let clickable=false;for(let y=h.y-h.h/2;y<h.y+h.h/2&&!clickable;y+=2)for(let x=h.x-h.w/2;x<h.x+h.w/2;x+=2)if(itemHit({x,y})===h){clickable=true;break;}
      return {edge:itemState(h.item).edgeMark.edge,clickable};
    }));assert.ok(rightTips.every(t=>t.clickable),JSON.stringify(rightTips));
    await page.locator('#close-book').click();await page.waitForFunction(()=>!coverMotion&&!!closedEdge);
    await capture('closed-3d-tabs');
    const tab=await page.evaluate(()=>{
      for(const face of closedBooks3D.faces.filter(f=>f.bookmarkPage!==undefined)){
        const xs=face.screen.map(p=>p.x),ys=face.screen.map(p=>p.y);
        for(let y=Math.min(...ys);y<=Math.max(...ys);y+=2)for(let x=Math.min(...xs);x<=Math.max(...xs);x+=2){const h=closedBooks3D.hitFace({x,y});if(h?.bookmarkPage!==undefined)return{x,y,page:h.bookmarkPage};}
      }throw new Error('Closed-book bookmarks not clickable');
    });
    const closedRect=await page.locator('#book').boundingBox();await page.mouse.click(closedRect.x+tab.x/1000*closedRect.width,closedRect.y+tab.y/680*closedRect.height);
    await page.waitForFunction(target=>!coverMotion&&!closedEdge&&spread===Math.ceil(target/2)&&!motion&&!queuedTurns.length,tab.page,{timeout:20000});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({edges:4,hidden,clickNavigation:true,reload:true,shelfRestore:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
