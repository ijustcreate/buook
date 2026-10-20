const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-classics-'));
  const profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-classics-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  if(profile)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.webContents.setBackgroundThrottling(false);});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    assert.equal(await page.locator('#shelf-books button').count(),10);
    await page.screenshot({path:path.join(output,'ten-book-shelf.png')});
    const books=await page.evaluate(async()=>{
      const source=await (await fetch('assets/classic-library.json')).json(),results=[],p=document.createElement('canvas').getContext('2d');
      $('#shelf').close();
      for(const novel of source){
        openSavedBook('starter-'+novel.id);
        if(readingPageCount()!==novel.sourcePages||pageCount!==Math.ceil(novel.sourcePages/2)*2)throw new Error('PDF count changed');
        if(sectionPages().length!==novel.chapters.length)throw new Error('Contents lost chapters');
        for(const chapter of novel.chapters)if(bookPage(chapter.page).tocLabel!==chapter.title)throw new Error('Wrong chapter destination');
        let minimumFont=14;
        for(let i=0;i<novel.sourcePages;i++){
          const data=bookPage(i),layout=layoutNovelText(data.body,p,data.preserveLines);minimumFont=Math.min(minimumFont,layout.size);
          if(layout.lines.length*layout.lineHeight>274.01)throw new Error(novel.id+' page '+(i+1)+' overflows');
          if(layout.lines.join(' ').replace(/\s+/g,' ').trim()!==novel.textPages[i].replace(/\s+/g,' ').trim())throw new Error('Lost source text');
          if(data.sourcePage!==i+1)throw new Error('Wrong source page');
        }
        results.push({name:novel.name,pages:novel.sourcePages,chapters:sectionPages().length,minimumFont});
      }
      return results;
    });
    await page.evaluate(()=>openSavedBook('starter-divine-comedy'));await page.locator('#contents-open').click();
    assert.equal(await page.locator('#contents-list button').count(),104);
    await page.screenshot({path:path.join(output,'dante-contents.png')});
    await page.locator('#contents-list button').filter({hasText:'Paradiso - Canto I'}).first().click();
    await page.waitForFunction(()=>!coverMotion&&!motion&&!queuedTurns.length&&spread===138);
    await page.locator('#read-text').click();assert.equal(await page.locator('#reading-text').evaluate(e=>e.classList.contains('preserve-lines')),true);
    assert((await page.locator('#reading-text').innerText()).includes('\n'));
    await page.screenshot({path:path.join(output,'dante-reading.png')});await page.locator('#reading-close').click();
    await page.waitForFunction(()=>!motion&&!queuedTurns.length);
    // Model a pre-update shelf, preserving a private edit, font, and deleted Dracula.
    await page.evaluate(()=>{
      const privateBook={id:'my-private-copy',name:'Private notebook',pageCount:28,pages:{4:{body:'Do not overwrite this'}}};
      const frank={...savedBooks.find(b=>b.id==='starter-frankenstein'),bookFont:'mojang-regular',pages:{8:{body:'My own note'}}};
      savedBooks=[privateBook,frank];localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));
      localStorage.setItem('pixel-book-starters-v1','1');localStorage.removeItem('pixel-book-seeded-catalog-v1');
    });
    await page.reload();await page.waitForFunction(()=>loaded);
    const upgrade=await page.evaluate(()=>({ids:savedBooks.map(b=>b.id),frank:savedBooks.find(b=>b.id==='starter-frankenstein'),private:savedBooks.find(b=>b.id==='my-private-copy')}));
    assert.equal(upgrade.ids.length,9);assert(!upgrade.ids.includes('starter-dracula'));
    assert.equal(upgrade.frank.pages[8].body,'My own note');assert.equal(upgrade.frank.bookFont,'mojang-regular');assert.equal(upgrade.private.pages[4].body,'Do not overwrite this');
    await page.evaluate(()=>{savedBooks=savedBooks.filter(b=>b.id!=='starter-time-machine');localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));});
    await page.reload();await page.waitForFunction(()=>loaded);assert.equal(await page.evaluate(()=>savedBooks.some(b=>b.id==='starter-time-machine')),false);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({books,upgradePreservesEdits:true,deletedBooksStayDeleted:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
