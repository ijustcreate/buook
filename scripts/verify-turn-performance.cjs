const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const baseline=execFileSync('git',['show','2bfb06b:script.js'],{encoding:'utf8',maxBuffer:4e6});
const functions={mesh:baseline.slice(baseline.indexOf('function mesh('),baseline.indexOf('function stacks(')),stacks:baseline.slice(baseline.indexOf('function stacks('),baseline.indexOf('function castShadow('))};
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-perf-')),profile=process.env.BOOK_QA_EXE?await fs.mkdtemp(path.join(os.tmpdir(),'pixel-book-perf-profile-')):null;
 const browser=profile?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
 if(profile)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.webContents.setBackgroundThrottling(false);});
 const page=profile?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
 try{
  if(!profile)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
  const result=await page.evaluate(async functions=>{
   const optimized={mesh,stacks},old={mesh:eval('('+functions.mesh+')'),stacks:eval('('+functions.stacks+')')};
   const select=version=>{mesh=version.mesh;stacks=version.stacks;};const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
   const visual=[];
   for(const id of ['romeo-and-juliet','frankenstein','inferno-dore']){
    const base=savedBooks.find(b=>b.starterId===id||id==='romeo-and-juliet'&&/Romeo/.test(b.name));if(!base)throw Error('Missing book '+id);
    openSavedBook(base.id);closedEdge=null;spread=id==='frankenstein'?1:7;
    for(const p of [null,.15,.5,.85]){
     motion=p===null?null:{direction:1,progress:p};select(old);draw();const before=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     if(id==='romeo-and-juliet'&&p===.5)window.perfBefore=canvas.toDataURL();
     select(optimized);draw();const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;let changed=0,total=0;
     for(let i=0;i<before.length;i+=4){const delta=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])+Math.abs(before[i+3]-after[i+3]);if(delta>12)changed++;total+=delta;}
     if(id==='romeo-and-juliet'&&p===.5)window.perfAfter=canvas.toDataURL();
     const ratio=changed/(before.length/4);if(p===null&&ratio>.0001)throw Error('Idle appearance changed');if(ratio>.012)throw Error('Excessive visual difference '+id+': '+ratio);
     visual.push({id,progress:p,changedFraction:ratio,meanChannelError:total/before.length});
    }
   }
   motion=null;openSavedBook(savedBooks.find(b=>/Romeo/.test(b.name)).id);spread=3;closedEdge=null;
   for(let n=4;n<10;n++)viewport(n);motion={direction:1,progress:.2};
   async function bench(version,label){select(version);const times=[],gaps=[];let last=performance.now();for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const now=performance.now();gaps.push(now-last);last=now;motion.progress=.04+i*.038;const start=performance.now();draw();times.push(performance.now()-start);}return{label,medianDrawMs:median(times.slice(3)),medianFrameMs:median(gaps.slice(3))};}
   const benchmarks=[];for(const version of [old,optimized,optimized,old])benchmarks.push(await bench(version,version===old?'before':'after'));select(optimized);
   const count={before:0,after:0},readable={before:0,after:0},q=quad;let label='before';quad=(image,...args)=>{count[label]++;if(image.pageViewport)readable[label]++;return q(image,...args);};select(old);draw();label='after';select(optimized);draw();quad=q;if(readable.before!==readable.after)throw Error('Readable page detail changed');
   motion=null;const lighting=litViewport(6,resting(1,.9),1),copy=lighting.toDataURL();litViewport(6,resting(1,.9),1);if(copy!==lighting.toDataURL())throw Error('Cached lighting changed texture');
   // Simulate bad 100ms frame cadence without waiting, using the real clock origin.
   spread=3;begin(1,true);const queue=[],native=requestAnimationFrame;requestAnimationFrame=cb=>{queue.push(cb);return queue.length;};const time=performance.now();settle(true,520);let n=0;
   while(motion&&n<20){const cb=queue.shift();if(!cb)throw Error('Missing scheduled frame');cb(time+(++n)*100+20);}
   requestAnimationFrame=native;if(motion||n>7)throw Error('Slow frames prolonged turn');
   return{visual,benchmarks,quads:count,readableQuads:readable,simulated100msFramesToComplete:n,canvas:[canvas.width,canvas.height]};
  },functions);
  assert.ok(result.quads.after<result.quads.before*.5);for(const side of ['Before','After']){const data=await page.evaluate(side=>window['perf'+side],side);await fs.writeFile(path.join(output,side.toLowerCase()+'.png'),Buffer.from(data.split(',')[1],'base64'));}await page.screenshot({path:path.join(output,'full-quality-pages.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({...result,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
