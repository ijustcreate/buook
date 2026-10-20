const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-type-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-type-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    const results=await page.evaluate(()=>{
      const p=document.createElement('canvas').getContext('2d'),results=[];
      for(const base of starterLibrary.values())if(!base.legacy){
        openSavedBook(base.id);const start=performance.now(),size=bookBodyFontSize(p);let checked=0;
        for(let n=0;n<readingPageCount();n++){
          const data=bookPage(n);if(!data.novel||data.titlePage||data.tocRows||!data.body?.trim())continue;
          const region=novelBodyRegion(data),layout=layoutBookBody(data,p);
          if(layout.size!==size)throw new Error('Per-page body font change');
          if(layout.lines.length*layout.lineHeight>region.height+.01)throw new Error(base.name+' overflow on '+(n+1));
          if(layout.lines.join(' ').replace(/\s+/g,' ').trim()!==region.text.replace(/\s+/g,' ').trim())throw new Error('Omitted text');
          p.font=layout.size+'px '+bookFontFamily();p.fontKerning='none';if(layout.lines.some((line,i)=>p.measureText(line).width+(layout.indents?.[i]||0)>320.5))throw new Error('Horizontal overflow');
          checked++;
        }
        results.push({name:base.name,size,checked,elapsedMs:Math.round(performance.now()-start)});
      }
      openSavedBook('starter-dorian-gray');$('#shelf').close();spread=6;closedEdge=null;coverMotion=null;updateControls();draw();
      const dense=layoutBookBody(bookPage(11),p),short=layoutBookBody(bookPage(12),p);
      if(short.size!==dense.size||short.lineHeight!==dense.lineHeight||short.lines.length>=dense.lines.length)throw new Error('Sparse page expanded');
      return{books:results,dense:{size:dense.size,lines:dense.lines.length},short:{size:short.size,lines:short.lines.length}};
    });
    await page.screenshot({path:path.join(output,'equal-body-size.png')});
    await page.evaluate(()=>{bookContent.pages[12]={...bookPage(12),body:'A short final line.'};textures.clear();shadedTextures.clear();draw();});
    assert.equal(await page.evaluate(()=>{const p=document.createElement('canvas').getContext('2d');return layoutBookBody(bookPage(11),p).size===layoutBookBody(bookPage(12),p).size;}),true);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({...results,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
