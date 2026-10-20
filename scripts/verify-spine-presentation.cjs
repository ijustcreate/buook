const {chromium,_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-spine-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-spine-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const capture=async name=>{const data=await page.evaluate(()=>canvas.toDataURL().split(',')[1]);await fs.writeFile(path.join(output,name+'.png'),Buffer.from(data,'base64'));};
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded,null,{timeout:60000});
    await page.evaluate(()=>$('#shelf').close());
    const result=await page.evaluate(()=>{
      closedEdge='front';spineView=false;spread=0;bookTableMode=false;closedSceneKey='';draw();updateControls();
      const spineFaces=closedBooks3D.faces.filter(f=>f.kind==='spine');
      if(!spineFaces.length)throw new Error('Default pose does not show spine');
      for(const face of spineFaces){const [a,b,,d]=face.screen;if((b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x)<=0)throw new Error('Spine inscription UVs are mirrored');}
      const material=closedMaterials(current3DBook()),alphaChecks=[];
      // With no custom cover inscriptions both board textures have identical
      // local orientation: their ornate guards belong to the free edge.
      if(material.front.toDataURL()!==material.back.toDataURL())throw new Error('Back board artwork is horizontally reversed');
      for(const pages of [8,28,56]){
        pageCount=pages;const left=resting(-1,1),right=resting(1,1);
        for(let i=0;i<left.length;i++)if(left[i].x!==-right[i].x||left[i].z!==right[i].z)throw new Error('Endpaper roll is not mirrored');
        const inner=right[1],outer=right.at(-1);
        if((inner.z-right[0].z)/inner.x<.5)throw new Error('Endpaper binding is too flat');
        if(Math.abs(outer.z-right.at(-2).z)>.001)throw new Error('Endpaper does not flatten onto block');
      }
      pageCount=28;
      for(const texture of [material.front,material.back,material.spine]){
        const lit=closedBooks3D.shadedTexture(texture,.3),p=spriteSurface(texture.width,texture.height).getContext('2d');
        p.drawImage(texture,0,0);const before=p.getImageData(0,0,texture.width,texture.height).data;
        p.clearRect(0,0,texture.width,texture.height);p.drawImage(lit,0,0);const after=p.getImageData(0,0,texture.width,texture.height).data;
        let transparent=0;for(let i=3;i<before.length;i+=4){if(before[i]===0){transparent++;if(after[i]!==0)throw new Error('Lighting fills transparent artwork');}}
        if(!transparent)throw new Error('Fixture does not exercise transparency');alphaChecks.push(transparent);
      }
      const point={x:160,y:closedBooks3D.models[0].height/2,z:0},before=closedBooks3D.project(point);
      closedBooks3D.orbitBy(30,0);const right=closedBooks3D.project(point);if(right.x<=before.x)throw new Error('Right drag rotates book left');
      closedBooks3D.reset();closedBooks3D.orbitBy(0,30);const down=closedBooks3D.project(point);if(down.y<=before.y)throw new Error('Down drag rotates book up');
      closedBooks3D.reset();return{spineFaces:spineFaces.length,alphaChecks,rightDrag:right.x-before.x,downDrag:down.y-before.y,roll:closedBooks3D.roll};
    });
    await capture('upright-default');
    await page.evaluate(()=>{closedBooks3D.pitch=-.43;draw();});await capture('upright-back');
    for(const [name,yaw,pitch] of [['head',-Math.PI/2-.45,.48],['tail',-Math.PI/2+.45,.48],['spine-flat',-Math.PI/2,.04]]){
      await page.evaluate(({yaw,pitch})=>{closedBooks3D.yaw=yaw;closedBooks3D.pitch=pitch;draw();},{yaw,pitch});await capture(name);
    }
    await page.evaluate(()=>{ctx.clearRect(0,0,W,H);drawSpineView();});await capture('earlier-static-reference');
    for(const [name,index] of [['first-binding',0],['last-binding',14]]){
      await page.evaluate(index=>{closedEdge=null;spineView=false;spread=index;draw();updateControls();},index);await capture(name);
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({...result,errors,output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
