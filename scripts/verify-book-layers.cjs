const { _electron: electron } = require('playwright');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), process.argv[2] || 'book-layers-qa');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'book-layers-profile-'));
  const app = await electron.launch({
    executablePath: process.env.BOOK_QA_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: process.env.BOOK_QA_EXE ? ['--user-data-dir=' + profile] : [root, '--user-data-dir=' + profile]
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => { const window=BrowserWindow.getAllWindows()[0];window.webContents.setBackgroundThrottling(false);window.hide(); });
    console.log('Renderer opened');
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden || document.querySelector('#loading')?.classList.contains('load-error'), null, { timeout: 15000, polling: 100 });
    const loadError=await page.locator('#loading').evaluate(element=>element.hidden?'':element.textContent);
    if(loadError)throw new Error(loadError);
    const capture=async name=>{
      const png=await page.evaluate(()=>document.querySelector('#book').toDataURL('image/png'));
      await fs.writeFile(path.join(output,name+'.png'),Buffer.from(png.split(',')[1],'base64'));
    };
    for (const pages of [8, 28, 56]) {
      for (const position of ['first', 'middle', 'last']) {
        const geometry = await page.evaluate(({ pages, position }) => {
          pageCount = pages; motion = null; closedEdge = null; coverMotion = null;
          spread = position === 'first' ? 0 : position === 'last' ? spreadCount() - 1 : Math.floor(spreadCount() / 2);
          updateControls(); draw();
          const side = position === 'last' ? -1 : 1;
          const chain = resting(side, 1);
          const edge=project(chain.at(-1),1),baseY=edge.y+layerDepth(1,1);
          if(Math.abs(baseY-(552-bookState().rise))>.001)throw new Error('The stack has left the cover plane');
          if(position!=='middle'){
            const seam=position==='first'?BOARD_SEAM:SPINE_END;
            if(Math.abs(project(chain[0],.5).x-coverPoint(seam,565/2).x)>.001)throw new Error('The page hinge does not reach the spine edge');
          }
          return { pages, position, hinge: project(chain[0], 1), edge, baseY };
        }, { pages, position });
        await capture(`${pages}-${position}`);
        console.log(JSON.stringify(geometry));
      }
    }
    for (const direction of [-1, 1]) {
      for (const progress of [.05, .5, .95]) {
        await page.evaluate(({ direction, progress }) => {
          pageCount = 28; spread = direction === 1 ? 0 : spreadCount() - 1;
          motion = { direction, progress }; draw();
        }, { direction, progress });
        await capture(`turn-${direction}-${progress}`);
      }
    }
    for (const [name, outside, inside, metal] of [
      ['rose', '#9b382d', '#c85e68', 'gold'],
      ['sage', '#31594c', '#587a62', 'gold'],
      ['slate', '#34466a', '#59688a', 'silver'],
      ['parchment', '#65402e', '#b59b62', 'silver']
    ]) {
      const paletteResult=await page.evaluate(({outside,inside,metal})=>{
        pageCount=28;spread=0;motion=null;closedEdge=null;spineView=false;
        bookContent.palette={outside,inside,metal};applyBookPalette();
        const material=assets.board.getContext('2d').getImageData(170,160,200,200).data;
        let redPixels=0;for(let i=0;i<material.length;i+=4)if(material[i]>material[i+1]*1.15)redPixels++;
        if(inside==='#587a62'&&redPixels)throw new Error('Rose pixels remain in the sage lining');
        if(assets.leather!==baseAssets.leather)throw new Error('The cover palette changed the paper edges');
        return {outside,inside,metal,redPixels};
      },{outside,inside,metal});
      console.log(JSON.stringify({palette:paletteResult}));
      await capture('palette-'+name);
      for(const edge of ['front','back']){
        await page.evaluate(edge=>{closedEdge=edge;draw();},edge);
        await capture(`closed-${name}-${edge}`);
      }
      await page.evaluate(()=>{closedEdge=null;spineView=true;draw();});
      await capture('spine-'+name);
    }
    for(const pages of [8,56]){
      await page.evaluate(pages=>{pageCount=pages;spineView=true;closedEdge=null;bookName='An unusually long archive title';draw();},pages);
      await capture(`spine-${pages}-long-title`);
    }
    for(const edge of ['front','back'])for(const amount of [0,.25,.5,.75,1]){
      await page.evaluate(({edge,amount})=>{
        pageCount=28;spineView=false;spread=edge==='front'?0:spreadCount()-1;motion=null;closedEdge=null;
        coverMotion={edge,amount};draw();coverMotion=null;
      },{edge,amount});
      await capture(`cover-${edge}-${amount}`);
    }
    const interactions=await page.evaluate(()=>{
      const request=window.requestAnimationFrame,callbacks=[];
      window.requestAnimationFrame=callback=>{callbacks.push(callback);return callbacks.length;};
      const drain=()=>{let steps=0;while(callbacks.length){if(++steps>100)throw new Error('Animation failed to settle');callbacks.shift()(performance.now()+10000);}};
      try{
        pageCount=28;spread=0;motion=null;coverMotion=null;closedEdge=null;spineView=false;queuedTurns=[];
        begin(1);begin(1);begin(1);drain();if(spread!==3)throw new Error('Rapid turns were lost');
        begin(-1);begin(-1);drain();if(spread!==1)throw new Error('Reverse turns were lost');
        spread=0;animateCover('front',true);drain();if(closedEdge!=='front')throw new Error('Front cover did not close');
        flipClosedBook();drain();if(closedEdge!=='back'||spread!==spreadCount()-1)throw new Error('Closed-book flip did not select the back spread');
        animateCover('back',false);drain();if(closedEdge||spread!==spreadCount()-1)throw new Error('Back cover did not reopen to the last page');
        return {rapidTurns:true,closing:true,flipAndReopen:true};
      }finally{window.requestAnimationFrame=request;}
    });
    console.log(JSON.stringify({interactions}));
    await page.evaluate(()=>{
      closedEdge=null;spineView=false;spread=0;bookName='Palette persistence check';
      $('#book-name').value=bookName;
      $('#outside-color').value='#31594c';$('#inside-color').value='#587a62';$('#metal-color').value='silver';
      $('#inside-color').dispatchEvent(new Event('change'));
      const saved=JSON.parse(localStorage.getItem(contentKey));
      if(saved.palette.inside!=='#587a62'||saved.palette.outside!=='#31594c'||saved.palette.metal!=='silver')throw new Error('Palette controls did not persist their selection');
      saveBook(true);const book=savedBooks.at(-1);
      if(book.palette.inside!=='#587a62')throw new Error('Shelf save omitted the palette');
      renderShelf();if(!$('#shelf-books .shelf-spine').style.getPropertyValue('--shelf-leather'))throw new Error('Shelf preview omitted its cover color');
    });
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#loading')?.hidden,null,{timeout:15000,polling:100});
    const persistence=await page.evaluate(()=>({inside:bookContent.palette.inside,outside:bookContent.palette.outside,metal:bookContent.palette.metal,shelf:savedBooks.length}));
    if(persistence.inside!=='#587a62'||persistence.metal!=='silver'||persistence.shelf<1)throw new Error('Saved palette or shelf did not survive reload');
    console.log(JSON.stringify({persistence}));
    console.log(JSON.stringify({ output, errors }));
    if (errors.length) process.exitCode = 1;
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
