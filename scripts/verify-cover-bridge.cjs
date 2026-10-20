const {chromium,_electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-bridge-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-bridge-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const capture=async name=>{const data=await page.evaluate(()=>canvas.toDataURL().split(',')[1]);await fs.writeFile(path.join(output,name+'.png'),Buffer.from(data,'base64'));};
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');
    await page.waitForFunction(()=>loaded,null,{timeout:60000});
    const results=[];
    for(const edge of ['front','back']){
      await page.evaluate(edge=>{
        spread=edge==='front'?0:spreadCount()-1;closedEdge=edge;spineView=false;bookTableMode=false;closedSceneKey='';draw();updateControls();
        closedBooks3D.yaw=.8;closedBooks3D.pitch=edge==='front'?.65:-.8;draw();
        window.bridgeBefore=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        window.originalRAF=window.requestAnimationFrame;window.bridgeFrames=[];window.requestAnimationFrame=callback=>{bridgeFrames.push(callback);return bridgeFrames.length;};
        open3DBook();window.testBridge=coverMotion.bridge;
      },edge);
      const first=await page.evaluate(()=>{
        const now=ctx.getImageData(0,0,canvas.width,canvas.height).data;let changed=0;for(let i=0;i<now.length;i+=4)if(Math.abs(now[i]-bridgeBefore[i])+Math.abs(now[i+1]-bridgeBefore[i+1])+Math.abs(now[i+2]-bridgeBefore[i+2])+Math.abs(now[i+3]-bridgeBefore[i+3])>12)changed++;
        return changed/(now.length/4);
      });assert.ok(first<.005,`First ${edge} frame jumped: ${first}`);
      for(const progress of [.1,.3,.449,.451,.65,.85,1]){
        await page.evaluate(progress=>bridgeFrames.shift()(testBridge.start+testBridge.duration*progress),progress);
        await capture(`${edge}-open-${progress}`);
      }
      assert.equal(await page.evaluate(()=>!!coverMotion||!!closedEdge||bookTableMode||spineView),false);
      // Closing returns to precisely the original 3D camera, not a reset pose.
      await page.evaluate(edge=>{animateCover(edge,true);window.testBridge=coverMotion.bridge;},edge);
      for(const progress of [0,.2,.5,.8,1]){await page.evaluate(progress=>bridgeFrames.shift()(testBridge.start+testBridge.duration*progress),progress);await capture(`${edge}-close-${progress}`);}
      const returned=await page.evaluate(()=>({yaw:closedBooks3D.yaw,pitch:closedBooks3D.pitch,locked:document.body.classList.contains('book-transitioning'),fixed:document.querySelector('.book-stage').style.position}));
      assert.equal(returned.yaw,.8);assert.equal(returned.pitch,edge==='front'?.65:-.8);assert.equal(returned.locked,false);assert.equal(returned.fixed,'');
      await page.evaluate(()=>window.requestAnimationFrame=originalRAF);
      results.push({edge,firstFrameChanged:first,returned});
    }
    const tableReturn=await page.evaluate(()=>{
      window.bridgeFrames=[];window.originalRAF=window.requestAnimationFrame;window.requestAnimationFrame=cb=>{bridgeFrames.push(cb);return bridgeFrames.length;};
      closedEdge=null;spineView=false;bookTableMode=false;spread=0;
      bookName='Table transition original';$('#book-name').value=bookName;saveBook();bookName='Table transition selected';$('#book-name').value=bookName;saveBook(true);
      toggleBookTable();closedBooks3D.arrange(true);closedBooks3D.yaw=.7;closedBooks3D.pitch=.65;
      closedBooks3D.selected=closedBooks3D.models.find(m=>m.id!==activeBookId);draw();
      const selected=closedBooks3D.selected.id,positions=JSON.stringify(closedBooks3D.models.map(m=>[m.id,m.x,m.y,m.z,m.angle]));
      open3DBook();let b=coverMotion.bridge;bridgeFrames.shift()(b.start+b.duration);
      if(activeBookId!==selected||coverMotion)throw new Error('Selected table book did not open');
      animateCover('front',true);b=coverMotion.bridge;bridgeFrames.shift()(b.start+b.duration);
      if(!bookTableMode||closedBooks3D.selected.id!==selected||closedBooks3D.yaw!==.7||JSON.stringify(closedBooks3D.models.map(m=>[m.id,m.x,m.y,m.z,m.angle]))!==positions)throw new Error('Table placement jumped on return');
      window.requestAnimationFrame=originalRAF;bookTableMode=false;closedEdge=null;spineView=false;return true;
    });
    const hits=await page.evaluate(()=>{
      closedEdge=null;spineView=false;bookTableMode=false;spread=5;motion=null;
      for(const item of allInserts()){const state=itemMounts.get(item.sheet);state.outside=true;}
      const feather=keepsakes.find(item=>item.type==='feather'),state=itemMounts.get(feather.sheet);
      Object.assign(state,{taped:true,outside:false,anchorPage:10,pageNumber:10,u:.6,v:.45,rotation:0});draw();
      const hit=itemHits.find(hit=>hit.item===feather);let area=0,active=0;
      for(let y=Math.floor(hit.y-hit.h/2);y<hit.y+hit.h/2;y+=4)for(let x=Math.floor(hit.x-hit.w/2);x<hit.x+hit.w/2;x+=4){area++;if(itemHit({x,y})?.item===feather)active++;}
      if(active===0||active/area>.4)throw new Error('Transparent feather rectangle steals clicks: '+active/area);
      return {fraction:active/area};
    });
    const collisions=await page.evaluate(()=>{
      const results=[];
      for(const direction of [-1,1]){
        spread=5;motion=null;for(const item of allInserts())Object.assign(itemMounts.get(item.sheet),{taped:false,outside:true});
        const item=keepsakes[0],hinge=CX+bookState().shift;
        Object.assign(itemMounts.get(item.sheet),{taped:false,outside:true,outsideX:hinge,outsideY:330,rotation:0,v:.5});
        begin(direction,true);if(!motion.gutterContacts.length)throw new Error('No gutter collision contact');
        const before=motion.gutterContacts[0].initialU;
        motion.progress=.7;draw();const after=itemState(item).u;
        if(after<=before+.01)throw new Error('Turning face did not push card to receiving side');
        finish(false);if(!itemMounts.get(item.sheet).outside)throw new Error('Canceled push changed original ownership');
        begin(direction,true);motion.progress=.7;draw();finish(true);
        if(itemMounts.get(item.sheet).outside)throw new Error('Gutter card still floating after turn');
        results.push({direction,before,after,page:itemMounts.get(item.sheet).pageNumber});
      }return results;
    });
    assert.deepEqual(errors,[]);console.log(JSON.stringify({results,tableReturn,hits,collisions,errors,output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
