const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const root=path.resolve(__dirname,'..'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'book-stack-profile-'));
  const output=path.join(os.tmpdir(),process.argv[2]||'book-stack-edges');await fs.mkdir(output,{recursive:true});
  const app=await electron.launch({executablePath:process.env.BOOK_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.BOOK_QA_EXE?['--user-data-dir='+profile]:[root,'--user-data-dir='+profile]});
  try{
    const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide();});
    await page.waitForFunction(()=>document.querySelector('#loading')?.hidden,null,{timeout:15000,polling:100});
    const results=await page.evaluate(()=>{
      const results=[];motion=null;closedEdge=null;coverMotion=null;
      for(const pages of [8,28,56])for(const side of [-1,1])for(const leaves of [1,2,pages/2]){
        pageCount=pages;const total=pages/2,amount=leaves/total;spread=side<0?leaves:total-leaves;
        const number=side<0?spread*2-1:spread*2,chain=resting(side,amount),quads=[],original=quad;
        quad=(image,uv,points,target)=>{quads.push({image,points});return original(image,uv,points,target);};
        try{ctx.clearRect(0,0,W,H);stacks(chain,side,amount,number);}finally{quad=original;}
        const paper=quads.filter(q=>q.image===assets.stack),leather=quads.filter(q=>q.image===assets.leather);
        let seamError=0,cornerError=0;
        if(leaves>1){
          const bottom=paper.slice(6);
          if(bottom.length!==SEGMENTS)throw new Error('Bottom ribbon is not using the shared paper texture');
          for(let i=0;i<SEGMENTS;i++){
            const a=project(chain[i],paperBottomV(number,side,chain[i].u));
            const b=project(chain[i+1],paperBottomV(number,side,chain[i+1].u));
            seamError=Math.max(seamError,Math.hypot(a.x-bottom[i].points[0].x,a.y-bottom[i].points[0].y),Math.hypot(b.x-bottom[i].points[1].x,b.y-bottom[i].points[1].y));
          }
          const fore=paper[5].points[2],corner=bottom.at(-1).points[2];cornerError=Math.hypot(fore.x-corner.x,fore.y-corner.y);
        }
        results.push({pages,side,leaves,depth:pageBlockDepth(amount),paperQuads:paper.length,leatherQuads:leather.length,seamError,cornerError});
      }
      return results;
    });
    for(const r of results){assert.equal(r.leatherQuads,0);assert(r.seamError<.001&&r.cornerError<.001);if(r.leaves===1){assert.equal(r.depth,0);assert.equal(r.paperQuads,0);}else assert(r.depth>0&&r.paperQuads>0);}
    for(const [label,spreadIndex] of [['first-left',1],['second-left',2],['first-right',13],['second-right',12]]){
      const png=await page.evaluate(index=>{pageCount=28;spread=index;motion=null;draw();return canvas.toDataURL('image/png');},spreadIndex);
      await fs.writeFile(path.join(output,label+'.png'),Buffer.from(png.split(',')[1],'base64'));
    }
    console.log(JSON.stringify({output,results}));
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
