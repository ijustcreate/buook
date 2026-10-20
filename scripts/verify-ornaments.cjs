const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1300,height:1000}}),errors=[],output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-ornaments-'));page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded,null,{timeout:60000});
  const atlas=await page.evaluate(()=>{
   const bounds=spineOrnamentNames.map((_,i)=>ornamentBounds(i));if(bounds.some(b=>b.w<20||b.h<20))throw new Error('Empty atlas cell');
   if(new Set(savedBooks.map(b=>JSON.stringify(b.spineOrnaments))).size<7)throw new Error('Missing theme variation');
   openSavedBook('starter-frankenstein');closedEdge='front';updateControls();draw();$('.book-options').open=true;$('.content-editor').open=true;refreshContentEditor();
   return bounds.length;
  });assert.equal(atlas,50);
  await page.selectOption('#spine-ornament-top','46');await page.selectOption('#spine-ornament-bottom','25');
  assert.equal(await page.evaluate(()=>savedBooks.find(b=>b.id===activeBookId).spineOrnaments.top),46);
  await page.selectOption('#spine-ornament-top','10');await page.locator('#spine-ornament-pair').click();
  assert.deepEqual(await page.evaluate(()=>effectiveSpineOrnaments(bookContent)),{top:10,bottom:11,flipBottom:false});
  await page.selectOption('#spine-ornament-top','-2');await page.selectOption('#spine-ornament-bottom','-1');
  await page.reload();await page.waitForFunction(()=>loaded);assert.deepEqual(await page.evaluate(()=>effectiveSpineOrnaments(bookContent)),{top:-2,bottom:-1,flipBottom:false});
  await page.evaluate(()=>{$('#shelf').close();closedEdge='front';updateControls();$('.book-options').open=true;$('.content-editor').open=true;refreshContentEditor();});
  await page.selectOption('#spine-ornament-bank','1');await page.locator('[data-ornament="35"]').click();
  await page.screenshot({path:path.join(output,'history-picker.png')});
  assert.equal(await page.evaluate(()=>effectiveSpineOrnaments(bookContent).top),35);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({atlas,editor:true,pairedEnds:true,persistence:true,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
