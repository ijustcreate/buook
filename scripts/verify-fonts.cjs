const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-fonts-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-font-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  if(profile)await browser.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.webContents.setBackgroundThrottling(false);});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    const count=await page.evaluate(()=>bookFonts.size);assert.equal(count,25);
    await page.evaluate(()=>{openSavedBook('starter-dracula');spread=50;updateControls();draw();});
    const original=await page.evaluate(()=>canvas.toDataURL());
    const tested=await page.evaluate(async()=>{
      const result=[],p=document.createElement('canvas').getContext('2d');
      const dense=Object.values(starterLibrary.get('dracula').pages).filter(p=>p.novel).sort((a,b)=>b.body.length-a.body.length)[0].body;
      for(const font of bookFonts.values()){
        await chooseBookFont(font.id);const layout=layoutNovelText(dense,p);
        const fonts=[],fake={save(){},restore(){},fillText(){fonts.push(this.font);}};
        drawPageNumber(fake,100,'bottom-center','keeper');
        if(!fonts[0]?.includes(font.family))throw new Error('Folio font does not match: '+font.label);
        if(layout.lines.length*layout.lineHeight>274.01)throw new Error('Font overflows source page: '+font.label);
        if(layout.lines.join(' ').replace(/\s+/g,' ').trim()!==dense.replace(/\s+/g,' ').trim())throw new Error('Font switch lost text: '+font.label);
        if(readingPageCount()!==509||pageCount!==510)throw new Error('Font switch changed PDF pagination');
        result.push({font:font.label,size:layout.size});
      }
      return result;
    });
    await page.locator('#book-font').selectOption('belanidiserif-regular');assert.notEqual(await page.evaluate(()=>canvas.toDataURL()),original);
    await page.screenshot({path:path.join(output,'live-book-font.png')});
    await page.locator('#read-text').click();await page.locator('#reading-font').selectOption('mojang-regular');
    assert.equal(await page.locator('#book-font').inputValue(),'mojang-regular');assert((await page.locator('#reading-text').evaluate(e=>getComputedStyle(e).fontFamily)).includes('PBFont-mojang-regular'));
    await page.screenshot({path:path.join(output,'live-reading-font.png')});await page.locator('#reading-close').click();
    await page.reload();await page.waitForFunction(()=>loaded);await page.evaluate(()=>openSavedBook('starter-dracula'));
    assert.equal(await page.locator('#book-font').inputValue(),'mojang-regular');
    await page.evaluate(()=>openSavedBook('starter-keeper'));assert.equal(await page.locator('#book-font').inputValue(),'original');
    // Import a local-only font through the actual file input, then reload it
    // from IndexedDB without putting its bytes in the public deployment.
    if(!profile){
      await page.locator('#font-files').setInputFiles({name:'QA-private-font.ttf',mimeType:'font/ttf',buffer:await fs.readFile(path.join(__dirname,'../assets/fonts/Alkhemikal.ttf'))});
      await page.waitForFunction(()=>bookFonts.has('qa-private-font'));await page.reload();await page.waitForFunction(()=>loaded);assert(await page.evaluate(()=>bookFonts.has('qa-private-font')));
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({fonts:count,tested,livePreview:true,persistence:true,privateImport:!profile,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
