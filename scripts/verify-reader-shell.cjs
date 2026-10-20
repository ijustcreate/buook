const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-shell-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-shell-profile-')):null;
const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
if(profile)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setSize(1920,1040);}});
const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1920,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{if(!profile)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);await page.evaluate(()=>{openSavedBook('starter-dracula');spread=6;draw();updateControls();});
 const before=await page.locator('.book-stage').boundingBox();assert.ok(before.width>1500);assert.equal(await page.locator('.library-toolbar button:visible').count(),4);
 await page.screenshot({path:path.join(output,'reading-large.png')});await page.click('#reader-tools-open');await page.waitForSelector('#reader-tools-panel:popover-open');
 const after=await page.locator('.book-stage').boundingBox();assert.deepEqual(after,before);await page.selectOption('#book-font','alagard');
 await page.screenshot({path:path.join(output,'floating-typography.png')});await page.click('#reader-tab-book');assert(await page.locator('#book-name').isVisible());
 const position=await page.evaluate(()=>spread);await page.locator('#reader-tab-book').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>spread),position);assert(await page.locator('#edit-pages-open').isVisible());
 await page.click('#edit-pages-open');assert(await page.locator('#page-workshop').isVisible());assert.equal(await page.locator('#reader-tools-panel').evaluate(e=>e.matches(':popover-open')),false);await page.click('#workshop-close');
 await page.click('#reader-tools-open');await page.keyboard.press('Escape');assert.equal(await page.locator('#reader-tools-panel').evaluate(e=>e.matches(':popover-open')),false);
 await page.click('#reader-tools-open');await page.mouse.click(12,Math.floor((await page.viewportSize())?.height/2||450));assert.equal(await page.locator('#reader-tools-panel').evaluate(e=>e.matches(':popover-open')),false);
 await page.click('#reader-jump-open');await page.fill('#go-page','20');await page.keyboard.press('Enter');await page.waitForFunction(()=>!motion&&!chapterJourney&&spread===10);assert.equal(await page.locator('#reader-page-jump').evaluate(e=>e.matches(':popover-open')),false);
 if(!profile){await page.setViewportSize({width:390,height:844});await page.click('#reader-tools-open');const r=await page.locator('#reader-tools-panel').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390);await page.click('#reader-tab-read');assert(await page.locator('#book-font').isVisible());await page.screenshot({path:path.join(output,'mobile-tools.png')});await page.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({stage:before,compactToolbar:true,stableBookSize:true,keyboardTabs:true,escape:true,outsideClose:true,jump:true,mobile:!profile,errors,output}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
