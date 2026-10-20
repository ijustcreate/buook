const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-design-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-design-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  if(profile)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.webContents.setBackgroundThrottling(false);});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    const set=async(id,spreadIndex)=>page.evaluate(({id,spreadIndex})=>{openSavedBook('starter-'+id);$('#shelf').close();closedEdge=null;coverMotion=null;motion=null;spread=spreadIndex;updateControls();draw();},{id,spreadIndex});
    await set('frankenstein',0);await page.screenshot({path:path.join(output,'centered-title.png')});
    const title=await page.evaluate(()=>{const c=document.createElement('canvas').getContext('2d'),calls=[];c.fillText=(text,x,y)=>calls.push({text,x,y,align:c.textAlign});drawSourceTitle(c,bookPage(0).titlePage);return calls;});
    assert(title.length>=2&&title.every(c=>c.x===200&&c.align==='center'));
    await set('frankenstein',2);await page.screenshot({path:path.join(output,'frankenstein-contents.png')});
    const contents=await page.evaluate(()=>({total:sectionPages().length,rows:[2,3,4].map(n=>bookPage(n).tocRows),layout:[2,3,4].map(n=>sourceContentsLayout(n))}));
    assert.equal(contents.total,31);assert.deepEqual(contents.rows.map(r=>r.length),[12,17,2]);
    for(const rows of contents.layout){assert(rows.every(r=>r.y+r.h<=310));for(let i=1;i<rows.length;i++)if(rows[i].x===rows[i-1].x)assert(rows[i].y>=rows[i-1].y+rows[i-1].h);}
    for(const [tocPage,target] of [[2,32],[3,178],[4,242]]){
      await set('frankenstein',Math.ceil(tocPage/2));
      const hit=await page.evaluate(({tocPage,target})=>{const h=tocHitAreas.find(h=>h.page===tocPage&&h.target===target);if(!h)throw new Error('TOC hit missing');const r=canvas.getBoundingClientRect();return{x:r.left+(h.x+h.w*.55)*r.width/W,y:r.top+(h.y+h.h*.5)*r.height/H};},{tocPage,target});
      await page.mouse.click(hit.x,hit.y);await page.waitForFunction(target=>!motion&&!queuedTurns.length&&spread===Math.ceil(target/2),target);
    }
    await set('dracula',2);await page.screenshot({path:path.join(output,'restored-illustration.png')});
    const art=await page.evaluate(()=>{const figures=Object.values(starterLibrary.get('dracula').pages).flatMap(p=>p.sourceFigures||[]);return{count:figures.length,loaded:sourceIllustrations.size,dimensions:figures.every(f=>sourceIllustrations.get(f.src)?.naturalWidth===f.width)};});
    assert.equal(art.count,28);assert(art.dimensions);await page.locator('#read-text').click();
    // The exact requested illustrated source page is available in the native reader.
    await page.evaluate(()=>{readerPage=4;renderReadingPage();});assert.equal(await page.locator('#reading-text img').count(),1);await page.locator('#reading-close').click();await page.waitForFunction(()=>!motion&&!queuedTurns.length);
    const geometry=await page.evaluate(()=>{const result=[];for(const count of [8,28,268,510])for(const amount of [.08,.25,.5,.92,1])for(const side of [-1,1]){pageCount=count;const chain=resting(side,amount),lengths=chain.slice(1).map((p,i)=>Math.hypot(p.x-chain[i].x,p.z-chain[i].z));const ratio=Math.max(...lengths)/Math.min(...lengths);if(ratio>1.16)throw new Error('Uneven material scale: '+ratio);result.push({count,amount,side,ratio});}return result;});
    await set('frankenstein',21);await page.screenshot({path:path.join(output,'uniform-page-text.png')});
    await page.evaluate(()=>{const right=resting(1,1-spread/(spreadCount()-1));ctx.save();ctx.strokeStyle='#13824b';ctx.lineWidth=1;for(let i=0;i<=8;i++){const a=project(sampleChain(right,i/8),0),b=project(sampleChain(right,i/8),1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.restore();});
    await page.screenshot({path:path.join(output,'material-grid.png')});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({contents:contents.rows.map(r=>r.length),clickedDestinations:[32,178,242],art,maximumMaterialRatio:Math.max(...geometry.map(x=>x.ratio)),errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
