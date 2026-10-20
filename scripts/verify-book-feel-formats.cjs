const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-feel-')),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
  const formats=await page.evaluate(()=>{
   const results=[];
   for(const book of savedBooks){openSavedBook(book.id);const f=bookFormat();const model=new ClosedBooks3D({canvas,context:ctx,materials:closedMaterials,changed:()=>{},open:()=>{}});model.setBooks([current3DBook()]);
    if(Math.abs(model.models[0].width/model.models[0].length-f.ratio)>.00001)throw Error('Wrong closed proportions');
    if(book.starterId&&f.mode!=='source')throw Error('Missing automatic source trim');
    const p=document.createElement('canvas').getContext('2d');p.font='12px Georgia';const native=p.measureText('Sample').width;adaptPageTextContext(p);if(Math.abs(p.measureText('Sample').width*bookWidthScale()-native)>.001)throw Error('Text squeeze');
    results.push({name:book.name,mode:f.mode,ratio:f.ratio});
   }
   openSavedBook('starter-inferno-dore');spread=7;updateControls();draw();return results;
  });
  await page.screenshot({path:path.join(output,'portrait-inferno.png')});
  await page.evaluate(()=>{document.querySelector('.book-options').open=true;});
  await page.selectOption('#page-format','custom');await page.fill('#format-width','160');await page.fill('#format-height','240');await page.locator('#format-height').dispatchEvent('change');
  assert.ok(Math.abs(await page.evaluate(()=>bookFormatRatio(bookContent))-2/3)<.001);
  await page.reload();await page.waitForFunction(()=>loaded);assert.equal(await page.evaluate(()=>bookFormat().mode),'custom');
  const journey=await page.evaluate(async()=>{
   openSavedBook('starter-frankenstein');spread=0;closedEdge=null;draw();window.journeyFrames=[];const original=draw;draw=function(){if(motion)journeyFrames.push({from:spread,to:turnDestination(),p:motion.progress,style:document.querySelector('.book-stage').style.transform});original();};
   // Functional pose coverage uses a controlled 60Hz clock; real cadence is
   // measured separately by verify-turn-performance on both browser/desktop.
   const nativeRAF=requestAnimationFrame,queue=[];requestAnimationFrame=cb=>{queue.push(cb);return queue.length;};let tick=performance.now();
   const complete=()=>{let count=0;while(motion||chapterJourney){const cb=queue.shift();if(!cb||++count>1000)throw Error('Journey stalled');cb(tick+=1000/60);}};
   navigateToChapter(201);const first=spread,route=[...chapterJourney.route];complete();
   draw=original;const forward=spread;const frames=journeyFrames;const expected=Math.ceil(201/2);if(first!==0||forward!==expected)throw Error('Incorrect journey endpoint');
   for(const to of route)if(!frames.some(f=>f.to===to&&f.p>.35&&f.p<.65))throw Error('Skipped visible page turn '+JSON.stringify({to,poses:frames.filter(f=>f.to===to).map(f=>f.p)}));
   navigateToChapter(8);complete();requestAnimationFrame=nativeRAF;
   return{first,route,forward,reverse:spread,frames:frames.length};
  });assert.equal(journey.reverse,4);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>{motion={direction:1,progress:.4};updateBookResponse();const result=document.querySelector('.book-stage').style.transform;motion=null;return result;}),'');
  const audio=await page.evaluate(async()=>{
   const result=[];for(const fast of [false,true]){const context=new OfflineAudioContext(1,22050,44100);Object.defineProperty(context,'state',{value:'running'});bookFeel.context=context;bookFeel.noise=null;bookFeel.lastSound=-Infinity;bookFeel.sound=true;playPaperSound(fast);const rendered=await context.startRendering(),data=rendered.getChannelData(0);let peak=0,sum=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}result.push({fast,peak,rms:Math.sqrt(sum/data.length)});}bookFeel.context=null;bookFeel.noise=null;return result;
  });assert.ok(audio.every(a=>a.peak>.001&&a.peak<.035&&a.rms<.01));assert.deepEqual(errors,[]);console.log(JSON.stringify({formats,journey,audio,reducedMotion:true,customPersists:true,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
