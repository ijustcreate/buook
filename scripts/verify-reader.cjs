const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-reader-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-reader-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  if(profile)await browser.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.webContents.setBackgroundThrottling(false);});
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(60000);
  const ready=()=>page.waitForFunction(()=>loaded,null,{timeout:60000});
  const capture=async name=>page.screenshot({path:path.join(output,name+'.png'),timeout:60000});
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await ready();
    const books=await page.evaluate(()=>savedBooks.map(b=>({name:b.name,pages:b.sourcePageCount||b.pageCount,physicalFaces:b.pageCount})));
    assert.equal(books.find(b=>b.name==='Dracula').pages,509);assert.equal(books.find(b=>b.name==='Frankenstein').pages,268);
    const fitting=await page.evaluate(()=>{
      const p=document.createElement('canvas').getContext('2d'),results=[];$('#shelf').close();
      for(const novel of starterLibrary.values())if(!novel.legacy){
        let minFont=14,characters=0;
        for(let i=0;i<novel.sourcePageCount;i++){
          const data=novel.pages[i],layout=layoutNovelText(data.body,p);minFont=Math.min(minFont,layout.size);characters+=data.body.length;
          if(layout.lines.length*layout.lineHeight>274.01)throw new Error('Source page overflow');
          if(layout.lines.join(' ').replace(/\s+/g,' ').trim()!==data.body.replace(/\s+/g,' ').trim())throw new Error('Source text omitted');
        }
        results.push({name:novel.name,pages:novel.sourcePageCount,minFont,characters});
      }
      openSavedBook('starter-dracula');return results;
    });
    await page.locator('#contents-open').click();assert.equal(await page.locator('#contents-list button').count(),27);
    await capture('external-contents');await page.locator('#contents-list button').first().click();
    await page.waitForFunction(()=>spread===3&&!motion&&!queuedTurns.length);
    assert.equal(await page.locator('#go-page').isVisible(),true);
    await page.locator('#go-page').fill('101');await page.locator('#go-page').press('Enter');await page.waitForFunction(()=>spread===50&&!motion&&!queuedTurns.length);
    await capture('sharp-book');
    assert.equal(await page.evaluate(()=>viewport(100).width),800);assert.equal(await page.evaluate(()=>canvas.width),1500);
    await page.locator('#read-text').click();
    assert.equal(await page.locator('#reading-folio').textContent(),'Page 101 of 509');
    assert.equal(await page.locator('#reading-text').innerText(),await page.evaluate(()=>bookPage(100).body.replace(/\s+/g,' ').trim()));
    await page.locator('#reading-size').fill('28');await page.locator('#reading-size').dispatchEvent('input');
    assert.equal(await page.locator('#reading-text').evaluate(e=>getComputedStyle(e).fontSize),'28px');await capture('large-text');
    await page.locator('#reading-close').click();await page.waitForFunction(()=>!motion&&!queuedTurns.length);
    await page.locator('#go-page').fill('509');await page.locator('#go-page-button').click();await page.waitForFunction(()=>spread===254&&!motion&&!queuedTurns.length);
    await page.evaluate(()=>{spread=0;closedEdge='front';closedSceneKey='';updateControls();draw();});
    await page.locator('#go-page').fill('509');await page.locator('#go-page-button').click();await page.waitForFunction(()=>!coverMotion&&!closedEdge&&spread===254&&!motion&&!queuedTurns.length,null,{timeout:30000});
    const palette=await page.evaluate(()=>{
      $('#outside-color').value='#28497a';$('#inside-color').value='#38a387';$('#inside-color').dispatchEvent(new Event('change'));
      const source=baseAssets.board,s=spriteSurface(source.width,source.height).getContext('2d');s.drawImage(source,0,0);const d=s.getImageData(0,0,source.width,source.height).data;
      const mask=coverMaterialMask(source,'board',d);let left=source.width,top=source.height,bottom=0,count=0;
      for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(mask[(y*source.width+x)*2]>200){left=Math.min(left,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
      spread=0;draw();return{left,top,bottom,count,inside:bookContent.palette.inside};
    });assert(palette.left<94&&palette.count>80000);await capture('aligned-lining');
    assert.equal(await page.locator('#inside-color').getAttribute('type'),'color');assert.equal(await page.locator('#outside-color').getAttribute('type'),'color');
    // Upgrade an edited v17 book without discarding its original page edits.
    await page.evaluate(()=>{
      const old=starterLibrary.get('dracula-legacy');savedBooks=[{id:'old-dracula',starterId:'dracula',name:'Dracula',pageCount:old.pageCount,pages:{12:{body:'Saved private edit'}}}];
      activeBookId='old-dracula';Object.assign(bookContent,{starterId:'dracula',pageCount:old.pageCount,pages:{12:{body:'Saved private edit'}},edgeBookmarks:[]});pageCount=old.pageCount;migrateStarterEditions();
      if(pageCount!==510||bookContent.sourcePageCount!==509||savedBooks.length!==2||savedBooks[1].pages[12].body!=='Saved private edit')throw new Error('Edition migration lost data');
    });
    assert.deepEqual(errors,[]);console.log(JSON.stringify({books,fitting,palette,contents:true,pageJump:true,readableText:true,migration:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
