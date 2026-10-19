const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const root=path.resolve(__dirname,'..'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'book-pickup-profile-'));
  const app=await electron.launch({executablePath:process.env.BOOK_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.BOOK_QA_EXE?['--user-data-dir='+profile]:[root,'--user-data-dir='+profile]});
  try{
    const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide();});
    await page.waitForFunction(()=>document.querySelector('#loading')?.hidden,null,{timeout:15000,polling:100});
    const results=await page.evaluate(()=>{
      const results=[];pageCount=28;closedEdge=null;coverMotion=null;
      for(const item of allInserts())Object.assign(itemState(item),{taped:false,pageNumber:99999,outside:false});
      const s=itemState(keepsakes[0]);
      for(const direction of [-1,1])for(const [u,v,rotation] of [[.64,.82,-.07],[.25,.25,1.35]]){
        spread=direction===1?0:1;const number=direction===1?0:1;
        Object.assign(s,{pageNumber:number,u,v,rotation,back:false});
        for(const progress of [0,.001,.01,.04,.1,.2]){
          motion={direction,progress};draw();const visible=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          s.pageNumber=99999;draw();const empty=ctx.getImageData(0,0,canvas.width,canvas.height).data;s.pageNumber=number;
          let pixels=0;for(let i=0;i<visible.length;i+=4)if(Math.max(Math.abs(visible[i]-empty[i]),Math.abs(visible[i+1]-empty[i+1]),Math.abs(visible[i+2]-empty[i+2]))>18)pixels++;
          results.push({direction,u,v,rotation,progress,pixels});
        }
      }
      const coverLandings=[];
      for(const direction of [1,-1]){
        spread=direction===1?0:spreadCount()-1;
        const source=direction===1?0:pageCount-1,facing=direction===1?-1:pageCount;
        Object.assign(s,{pageNumber:source,back:false,taped:false,outside:false});
        motion={direction,progress:1};finish(true);
        if(s.pageNumber!==facing)throw new Error('Loose photo did not land on its facing inside cover');
        if(itemHits.some(h=>h.item===keepsakes[0]))throw new Error('Loose photo shows through the leaf covering its inside cover');
        motion={direction:-direction,progress:1};finish(true);
        if(s.pageNumber!==facing||!itemHits.some(h=>h.item===keepsakes[0]))throw new Error('Returning leaf did not uncover the deposited photo');
        coverLandings.push({direction,source,facing,back:s.back,uncovered:true});
      }
      return {samples:results,coverLandings};
    });
    console.log(JSON.stringify(results));
    if(process.env.BOOK_ASSERT_PICKUP==='1')for(let i=0;i<results.samples.length;i+=6){const base=results.samples[i].pixels;for(const r of results.samples.slice(i+1,i+4))if(r.pixels<base*.65)throw new Error('Insert vanished at pickup: '+JSON.stringify(r));}
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
