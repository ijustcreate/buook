const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-shelf-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-shelf-profile-')):null;
  const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
  const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  try{
    if(!profile)await page.goto(process.argv[2]||'http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
    const spines=await page.evaluate(()=>[...document.querySelectorAll('.shelf-spine')].map(button=>{
      const book=savedBooks.find(b=>b.id===button.dataset.bookId),canvas=button.querySelector('canvas'),texture=closedMaterials(book).spine;
      const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,expected=texture.getContext('2d').getImageData(0,0,texture.width,texture.height).data;
      if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))throw new Error('Shelf differs from 3D spine material');
      if(!actual.some((v,i)=>i%4===3&&v===0))throw new Error('Opaque rectangular fill on shelf spine');
      return{id:book.id,width:button.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height,name:button.getAttribute('aria-label')};
    }));assert.equal(spines.length,11);assert(spines.find(b=>b.id==='starter-dracula').width>spines.find(b=>b.id==='starter-keeper').width);
    assert(spines.find(b=>b.id==='starter-dracula').height>spines.find(b=>b.id==='starter-frankenstein').height);
    await page.screenshot({path:path.join(output,'ornate-shelf.png')});
    await page.locator('[data-book-id="starter-dorian-gray"]').click();assert.equal(await page.evaluate(()=>activeBookId),'starter-dorian-gray');
    await page.locator('#shelf-open').click();
    await page.locator('[data-book-id="starter-secret-garden"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>activeBookId),'starter-secret-garden');
    if(!profile){await page.setViewportSize({width:420,height:800});await page.evaluate(()=>{renderShelf();$('#shelf').showModal();});await page.screenshot({path:path.join(output,'narrow-shelf.png')});assert(await page.locator('#shelf').evaluate(e=>e.scrollWidth<=e.clientWidth+2));}
    assert.deepEqual(errors,[]);console.log(JSON.stringify({spines,exactMaterials:true,clickAndKeyboard:true,errors,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
