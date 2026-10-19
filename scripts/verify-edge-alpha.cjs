const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
  const root=path.resolve(__dirname,'..'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'book-edge-profile-'));
  const output=path.join(os.tmpdir(),process.argv[2]||'book-edge-alpha');await fs.mkdir(output,{recursive:true});
  const app=await electron.launch({executablePath:process.env.BOOK_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.BOOK_QA_EXE?['--user-data-dir='+profile]:[root,'--user-data-dir='+profile]});
  try{
    const page=await app.firstWindow();
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide();});
    await page.waitForFunction(()=>document.querySelector('#loading')?.hidden,null,{timeout:15000,polling:100});
    const results=[];
    for(const direction of [-1,1])for(const progress of [.3,.65,.85]){
      const result=await page.evaluate(({direction,progress})=>{
        pageCount=28;spread=direction===1?0:spreadCount()-1;closedEdge=null;coverMotion=null;motion={direction,progress};
        for(const item of allInserts()){const s=itemState(item);s.pageNumber=99999;s.taped=false;s.outside=false;s.landedSide=null;}
        const stroke=ctx.stroke;let unwantedOutlines=0;
        ctx.stroke=function(...args){if(this.strokeStyle==='#ead9a3')unwantedOutlines++;return stroke.apply(this,args);};
        try{draw();}finally{ctx.stroke=stroke;}
        const clean=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const tip=turnChain(direction,progress).at(-1),top=project(tip,0),bottom=project(tip,1);
        ctx.save();ctx.strokeStyle='#ead9a3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(bottom.x,bottom.y);ctx.stroke();ctx.restore();
        const outlined=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let transparentPixels=0;for(let i=3;i<clean.length;i+=4)if(clean[i]===0&&outlined[i]>0)transparentPixels++;
        draw();return {unwantedOutlines,transparentPixels,png:canvas.toDataURL('image/png')};
      },{direction,progress});
      await fs.writeFile(path.join(output,`edge-${direction}-${progress}.png`),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
      assert.equal(result.unwantedOutlines,0,'Turning page draws an opaque edge stroke');results.push({direction,progress,...result});
    }
    assert(results.some(r=>r.transparentPixels>0),'No transparent edge pixels were exercised');
    console.log(JSON.stringify({output,results}));
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
