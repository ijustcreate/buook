const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'book-editions-')),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
  const books=await page.evaluate(()=>savedBooks.filter(b=>b.starterId&&b.starterId!=='keeper').map(b=>({id:b.id,name:b.name})));
  const results=[];
  for(const book of books){
   const result=await page.evaluate(id=>{
    openSavedBook(id);const base=starterLibrary.get(bookContent.starterId),entries=Object.entries(base.pages).filter(([,p])=>p.novel&&!p.titlePage&&!p.tocRows&&p.body?.trim()).sort((a,b)=>b[1].body.length-a[1].body.length),dense=Number(entries[0][0]);
    spread=Math.ceil(dense/2);updateControls();draw();
    const verse=entries.some(([,p])=>p.preserveLines),shown=!$('#format-verse').closest('label').hidden;if(verse!==shown)throw Error('Verse control scope');
    const paragraphs=Object.values(base.pages).filter(p=>p.paragraphStarts?.length).length;
    return {name:bookName,sourcePages:readingPageCount(),physicalPages:pageCount,densePage:dense+1,verse,paragraphPages:paragraphs,fontSize:bookBodyFontSize(document.createElement('canvas').getContext('2d'))};
   },book.id);
   await page.screenshot({path:path.join(output,book.id+'.png')});results.push(result);
  }
  await page.evaluate(()=>{openSavedBook('starter-dracula');spread=20;preferredReaderPage=40;updateControls();draw();});
  await page.waitForFunction(()=>bookPage(39).sourceFigures?.every(f=>getSourceIllustration(f.src)));
  await page.screenshot({path:path.join(output,'ink-plate.png')});
  const plate=await page.evaluate(async()=>{
   const f=bookPage(39).sourceFigures[0],image=await createImageBitmap(await(await fetch(f.src)).blob()),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const p=c.getContext('2d');p.drawImage(image,0,0);const a=p.getImageData(0,0,c.width,c.height).data;let clear=0,semi=0;for(let i=3;i<a.length;i+=4){if(a[i]===0)clear++;else if(a[i]<255)semi++;}return{recipe:f.recipe.version,original:f.originalSrc!==f.src,clear,semi};
  });assert.equal(plate.recipe,3);assert(plate.original&&plate.clear>100&&plate.semi>100);
  await page.click('#read-text');assert.equal(await page.evaluate(()=>readerPage),40);await page.click('#reading-close');
  await page.keyboard.press('z');assert.equal(await page.evaluate(()=>bookFocusSide),1);await page.click('#reader-focus-other');assert.equal(await page.evaluate(()=>bookFocusSide),-1);
  await page.click('#read-text');assert.equal(await page.evaluate(()=>readerPage),39);await page.click('#reading-close');await page.screenshot({path:path.join(output,'page-close-up.png')});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>bookFocusSide),null);
  assert.equal(await page.locator('#hand').isVisible(),false);
  const counts=await page.evaluate(()=>({fonts:bookFonts.size,plates:Object.keys(sourceInkTreatments).length}));assert.deepEqual(counts,{fonts:28,plates:103});
  await page.click('#shelf-open');assert.equal(await page.evaluate(()=>bookShelfMode&&closedBooks3D.shelfOnly),true);await page.screenshot({path:path.join(output,'shelf.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'shelf-mobile.png')});
  assert.deepEqual(errors,[]);const report={results,plate,counts,currentPageReader:true,pageFocus:true,errors,output};await fs.writeFile(path.join(output,'review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
