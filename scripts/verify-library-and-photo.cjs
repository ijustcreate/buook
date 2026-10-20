const {chromium,_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-library-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-library-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>loaded,null,{timeout:60000});
  const capture=async name=>{await page.screenshot({path:path.join(output,name+'.png')});};
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await ready();
    assert.equal(await page.locator('#shelf').evaluate(e=>e.open),true);await capture('startup-shelf');
    const books=await page.evaluate(()=>savedBooks.map(b=>({name:b.name,pageCount:b.pageCount,id:b.id})));
    assert.equal(books.length,3);
    const geometry=await page.evaluate(()=>{
      const result=[];$('#shelf').close();
      for(const novel of starterLibrary.values()){
        openSavedBook(novel.id);const chapters=sectionPages();
        if(pageCount<100||pageCount>4096||!chapters.length)throw new Error('Novel pagination/contents failed');
        const p=document.createElement('canvas').getContext('2d');p.font='12px Georgia';
        let lines=0;
        for(const data of Object.values(novel.pages))if(data.novel){
          const rows=data.body.split('\n');if(rows.length>18)throw new Error('Text overflows page height');
          for(const row of rows)if(p.measureText(row).width>305)throw new Error('Text overflows page width');lines+=rows.length;
        }
        spread=Math.floor(pageCount/4);draw();
        result.push({name:novel.name,pages:pageCount,sourcePages:novel.sourcePages,chapters:chapters.length,lines,height:ClosedBooks3D.thickness(pageCount),openThickness:pageThickness()});
      }
      return result;
    });await capture('novel-spread');
    assert(geometry[0].height>geometry[1].height);assert(geometry.every(b=>b.height<230&&b.openThickness<2.1));
    await page.evaluate(()=>{openSavedBook('starter-frankenstein');bookContent.pages[5]={...bookPage(5),body:'A private edited line'};persistBookContent();saveBook();});
    await page.reload();await ready();
    assert.equal(await page.evaluate(()=>savedBooks.length),3);
    assert.equal(await page.evaluate(()=>{openSavedBook('starter-frankenstein');return bookPage(5).body;}),'A private edited line');
    const bindings=await page.evaluate(()=>[8,28,498,984,4096].map(pages=>{
      pageCount=pages;spread=Math.floor(spreadCount()/2);motion=null;closedEdge=null;draw();
      const a=coverPoint(BOARD_SEAM,565),b=coverPoint(SPINE_END,565);
      if(!resting(1,1).every(p=>Number.isFinite(p.x+p.z)))throw new Error('Nonfinite large-book page geometry');
      return{pages,width:b.x-a.x,thickness:ClosedBooks3D.thickness(pages)};
    }));
    for(let i=1;i<bindings.length;i++)assert(bindings[i].width>bindings[i-1].width&&bindings[i].thickness>bindings[i-1].thickness);
    const results=[];
    for(const grab of [{rx:0,ry:0},{rx:52,ry:32}]){
      const start=await page.evaluate(grab=>{
        $('#shelf').close();openSavedBook('starter-keeper');spread=3;closedEdge=null;motion=null;
        for(const item of allInserts())Object.assign(itemState(item),{pageNumber:99999,outside:false});
        const item=keepsakes[0],state=itemState(item);Object.assign(state,{pageNumber:6,u:.55,v:.5,rotation:0,taped:false,back:false,outside:false});draw();
        const chain=resting(1,1-spread/(spreadCount()-1)),q=rigidInsertPoint(chain,1,6,state,grab.rx,grab.ry,128*208/180),r=canvas.getBoundingClientRect();
        return{x:r.x+q.x/W*r.width,y:r.y+q.y/H*r.height};
      },grab);
      await page.mouse.move(start.x,start.y);await page.mouse.down();
      assert.equal(await page.evaluate(()=>!!itemDrag),true);
      await page.mouse.move(start.x+34,start.y+65,{steps:20});
      const result=await page.evaluate(()=>{
        const d=itemDrag,s=itemState(d.item),side=s.pageNumber%2===0?1:-1,chain=resting(side,side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1));
        const c=Math.cos(s.rotation),t=Math.sin(s.rotation),q=rigidInsertPoint(chain,side,s.pageNumber,s,d.localX*c-d.localY*t,d.localX*t+d.localY*c,128*208/180);
        return{rotation:s.rotation,pinError:Math.hypot(q.x-d.lastPointer.x,q.y-d.lastPointer.y),u:s.u,v:s.v};
      });await page.mouse.up();results.push(result);
      assert(result.pinError<.1);
    }
    assert(Math.abs(results[0].rotation)<.001);assert(Math.abs(results[1].rotation)>.1);await capture('photo-tug');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({books,geometry,bindings,drag:results,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
