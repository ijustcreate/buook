const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-workshop-'));page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{
 await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
 const source=await page.evaluate(()=>{
  openSavedBook('starter-dorian-gray');spread=2;closedEdge=null;draw();updateControls();
  const rows=bookPage(3).tocRows;if(rows[1].label!=='Chapter I'||rows[1].folio==='I')throw new Error('Chapter numeral lost');
  if(bookPage(4).chapterOpening!=='Preface'||!bookPage(4).body.includes('\n\n'))throw new Error('Preface semantics lost');
  return{rows:rows.length,chapter:rows[1],contentsFont:sourceContentsLayout(3)[0].size,paragraphs:bookPage(4).body.split('\n\n').length};
 });
 await page.screenshot({path:path.join(output,'dorian-contents-preface.png')});
 await require('./reader-shell-test-tools.cjs')(page,'#edit-pages-open');await page.locator('#edit-pages-open').click();await page.selectOption('#edit-page','4');
 assert.equal(await page.locator('#workshop-type').inputValue(),'chapter');
 await page.locator('#edit-title').fill('Preface · edited');await page.locator('#edit-body').fill('First paragraph.\n\nSecond paragraph.');
 assert.equal(await page.evaluate(()=>bookPage(4).chapterOpening),'Preface · edited');
 await page.locator('#workshop-undo').click();assert.equal(await page.evaluate(()=>bookPage(4).chapterOpening),'Preface');
 await page.selectOption('#edit-page','3');assert.equal(await page.locator('#workshop-type').inputValue(),'contents');
 await page.getByLabel('Entry 2 label',{exact:true}).fill('Chapter I · edited');
 await page.getByLabel('Entry 2 destination page',{exact:true}).fill('9');assert.equal(await page.evaluate(()=>bookPage(3).tocRows[1].target),8);
 assert(await page.evaluate(()=>sectionPages().some(c=>c.page===8&&c.label==='Chapter I · edited')));
 await page.screenshot({path:path.join(output,'linked-contents-editor.png')});
 await page.locator('#workshop-undo').click();await page.selectOption('#edit-page','0');
 assert.equal(await page.locator('#workshop-type').inputValue(),'title');await page.locator('#workshop-author').fill('Oscar Wilde · local copy');
 await page.locator('#workshop-close').click();await page.reload();await page.waitForFunction(()=>loaded);assert.equal(await page.evaluate(()=>bookPage(0).titlePage.author),'Oscar Wilde · local copy');
 await page.evaluate(()=>$('#shelf').close());await page.setViewportSize({width:420,height:850});await require('./reader-shell-test-tools.cjs')(page,'#edit-pages-open');await page.locator('#edit-pages-open').click();assert(await page.locator('#page-workshop').evaluate(e=>e.scrollWidth<=e.clientWidth+2));
 await page.screenshot({path:path.join(output,'mobile-workshop.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({source,semanticEditing:true,undo:true,persistence:true,mobile:true,errors,output}));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
