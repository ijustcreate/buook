const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(os.tmpdir(), process.argv[2] || 'book-insert-transfer');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'book-insert-profile-'));
  const app = await electron.launch({
    executablePath: process.env.BOOK_QA_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: process.env.BOOK_QA_EXE ? ['--user-data-dir=' + profile] : [root, '--user-data-dir=' + profile]
  });
  try {
    const page = await app.firstWindow(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.hide(); });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden, null, { timeout: 15000, polling: 100 });
    await page.evaluate(() => {
      pageCount = 28; spread = 0; motion = null;
      Object.assign(itemState(keepsakes[0]), { taped: false, anchorPage: null, pageNumber: 0, back: false, under: false, outside: false, landedSide: null, u: .25, v: .25, rotation: 1.35 });
      draw();
    });
    const snapshot = async (label, turn = null) => {
      const result = await page.evaluate(turn => {
        motion = turn;
        const item = keepsakes[0], front = mountedTexture(item, false), back = mountedTexture(item, true), original = quad;
        const mapping = {}, faces = new Set(), drawOrder = [], alphas = [], originalMesh = mesh; let count = 0;
        mesh = (...args) => { if (args[4]) drawOrder.push('sheet'); return originalMesh(...args); };
        quad = (image, uv, points, target) => {
          if (image === front || image === back) {
            const face = image === back ? 'back' : 'front'; faces.add(face); count++;
            drawOrder.push('card');
            alphas.push((target||ctx).globalAlpha*ctx.globalAlpha);
            uv.forEach((p, index) => { mapping[`${face}:${p.x.toFixed(5)}:${p.y.toFixed(5)}`] = points[index]; });
          }
          original(image, uv, points, target);
        };
        try { draw(); } finally { quad = original; mesh = originalMesh; }
        return { mapping, faces: [...faces], count, drawOrder, alphas, state: { ...itemState(item) }, png: canvas.toDataURL('image/png') };
      }, turn);
      await fs.writeFile(path.join(output, label + '.png'), Buffer.from(result.png.split(',')[1], 'base64'));
      delete result.png; return result;
    };
    const compare = (a, b, label) => {
      assert.deepEqual(Object.keys(a.mapping).sort(), Object.keys(b.mapping).sort(), label + ': texture faces or UVs changed');
      let maximum = 0;
      for (const key of Object.keys(a.mapping)) maximum = Math.max(maximum, Math.hypot(a.mapping[key].x - b.mapping[key].x, a.mapping[key].y - b.mapping[key].y));
      assert(maximum < .02, `${label}: ${maximum}px geometry jump`);
      return maximum;
    };
    const start = await snapshot('loose-start');
    const lift = await snapshot('loose-forward-0', { direction: 1, progress: 0 });
    const pickupError = compare(start, lift, 'Pickup');
    for (const progress of [.001, .01, .04, .1, .2]) {
      const frame = await snapshot('loose-forward-' + progress, { direction: 1, progress });
      assert(frame.count > 0, 'The loose card is not mapped to the turning surface');
      assert(frame.alphas.every(a=>a===1),'Following card is being faded');
      assert.deepEqual(frame.state, start.state, 'Animation changed the card state before commit');
    }
    const beforeLanding = await snapshot('loose-forward-1', { direction: 1, progress: 1 });
    await page.evaluate(() => finish(true));
    const landed = await snapshot('loose-landed');
    const landingError = compare(beforeLanding, landed, 'Landing');
    assert.equal(beforeLanding.count,0,'Photo shows on the reverse of the turning leaf');
    assert.equal(landed.count,0,'Photo shows through the landed leaf');
    assert.equal(landed.state.pageNumber, -1); assert.equal(landed.state.back, true); assert.equal(landed.state.under, false);
    assert.equal(landed.state.u, start.state.u); assert.equal(landed.state.v, start.state.v);
    assert.equal(landed.state.rotation, -start.state.rotation);
    assert.deepEqual(landed.faces, []);
    const covering = await snapshot('next-sheet-occludes-landed-card', { direction: 1, progress: .65 });
    assert.equal(covering.count,0,'Buried photo resurfaced during an unrelated turn');
    await page.evaluate(() => finish(false));
    for (const progress of [0, .35, .5, .75, 1]) {
      const frame = await snapshot('loose-return-' + progress, { direction: -1, progress });
      assert(frame.count > 0, 'Photo was not drawn on its facing-page support while being uncovered');
      assert(frame.alphas.every(a=>a===1),'Returning card is being faded');
      assert.deepEqual(frame.state,landed.state,'Returning animation prematurely changed ownership');
    }
    const releasedBeforeRest=await snapshot('release-before-rest',{direction:-1,progress:1});
    await page.evaluate(() => finish(true));
    const returned = await snapshot('loose-returned');
    compare(releasedBeforeRest,returned,'Uncover landing');
    assert.equal(returned.state.pageNumber,-1,'Photo did not land on the original facing inside cover');
    assert.deepEqual(returned.state,landed.state,'Uncovering the photo changed its supporting page');
    assert.deepEqual(returned.faces,['back']);
    assert(await page.evaluate(()=>{const s=itemState(keepsakes[0]);return itemHit(insertSurfacePoint(resting(-1,1),-1,-1,s.u,s.v))?.item===keepsakes[0];}),'Uncovered photo is not clickable');
    await snapshot('loose-cancelled-mid-turn', { direction: 1, progress: .65 });
    await page.evaluate(() => finish(false));
    assert.deepEqual((await snapshot('loose-after-cancel')).state, returned.state, 'Cancelled turn changed card ownership');
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) { motion = { direction: 1, progress: 1 }; finish(true); motion = { direction: -1, progress: 1 }; finish(true); }
    });
    assert.deepEqual((await snapshot('loose-20-roundtrips')).state, returned.state, 'Repeated turns accumulated card drift');
    await page.evaluate(() => { motion = { direction: 1, progress: 1 }; finish(true); motion = { direction: 1, progress: 1 }; finish(true); });
    const covered = await snapshot('loose-covered-next-spread');
    assert.equal(covered.state.pageNumber, -1, 'Card teleported onto later leaves'); assert.equal(covered.count, 0, 'Covered insert renders through paper');
    await page.evaluate(() => { motion = { direction: -1, progress: 1 }; finish(true); });
    const uncovered=await snapshot('loose-still-covered');assert.equal(uncovered.state.pageNumber,-1);assert.equal(uncovered.count,0);
    await page.evaluate(() => { motion = { direction: -1, progress: 1 }; finish(true); Object.assign(itemState(keepsakes[0]), { taped: true, anchorPage: 0, pageNumber: 0, landedSide: null, back: false }); mountedTextures.clear(); });
    const taped = await snapshot('taped-start');
    await snapshot('taped-turning', { direction: 1, progress: .35 });
    const tapedBack = await snapshot('taped-away-facing', { direction: 1, progress: 1 });
    assert.equal(tapedBack.count, 0, 'Taped card shows an invented reverse');
    await page.evaluate(() => finish(true));
    const tapedHidden = await snapshot('taped-hidden');
    assert.equal(tapedHidden.state.anchorPage, 0); assert.equal(tapedHidden.state.pageNumber, 0); assert.equal(tapedHidden.count, 0);
    await snapshot('taped-returning', { direction: -1, progress: 1 });
    await page.evaluate(() => finish(true));
    const tapedReturned = await snapshot('taped-returned');
    compare(taped, tapedReturned, 'Taped return'); assert.deepEqual(tapedReturned.state, taped.state);
    await page.evaluate(() => {
      spread = 1;
      Object.assign(itemState(keepsakes[0]), { taped: false, anchorPage: null, pageNumber: 1, landedSide: null, back: false, rotation: .8 });
      mountedTextures.clear();
    });
    await snapshot('mirror-rightward-start');
    await snapshot('mirror-rightward-turn', { direction: -1, progress: .65 });
    const rightBefore = await snapshot('mirror-rightward-before-landing', { direction: -1, progress: 1 });
    await page.evaluate(() => finish(true));
    const rightLanded = await snapshot('mirror-rightward-landed');
    compare(rightBefore, rightLanded, 'Rightward landing');
    assert.equal(rightLanded.state.pageNumber,2);assert.equal(rightLanded.count,0);
    const rightReturn = await snapshot('mirror-stays-right', { direction: 1, progress: .65 });
    const rightPoints = Object.values(rightReturn.mapping);
    assert(rightPoints.length > 0, 'Deposited card stopped following after landing');
    await page.evaluate(() => finish(true));
    const rightStayed = await snapshot('mirror-stayed-right');
    assert.equal(rightStayed.state.pageNumber,2); assert.equal(rightStayed.state.back,true);
    assert.equal(rightStayed.state.rotation,-.8); assert(rightStayed.count > 0);
    const placementErrors = await page.evaluate(() => {
      motion=null;
      const item=keepsakes[0], errors=[];
      Object.assign(itemState(item), {taped:false,landedSide:null});
      for(const index of [0, 4, spreadCount()-1])for(const side of [-1,1])for(const [u,v] of [[.25,.18],[.7,.74]]) {
        spread=index;
        const number=side<0?spread*2-1:spread*2,amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
        const chain=resting(side,amount),target=insertSurfacePoint(chain,side,number,u,v);
        placeLooseItem(item,target);
        const state=itemState(item),actual=insertSurfacePoint(chain,side,number,state.u,state.v);
        if(state.outside||state.pageNumber!==number)throw new Error('Placement selected the wrong surface');
        errors.push(Math.hypot(actual.x-target.x,actual.y-target.y));
      }
      spread=0;
      Object.assign(itemState(item),{pageNumber:0, outside:false, landedSide:null,back:false,u:.5,v:.65,rotation:.25});
      Object.assign(itemState(keepsakes[1]),{pageNumber:0, outside:false, taped:false,landedSide:null,back:false,u:.38,v:.24,rotation:-.2});
      draw(); return errors;
    });
    assert(Math.max(...placementErrors)<.02, 'Drop placement does not invert page perspective');
    const mousePoint=await page.evaluate(() => {
      const s=itemState(keepsakes[0]),p=insertSurfacePoint(resting(1,1),1,0,s.u,s.v),r=canvas.getBoundingClientRect();
      return {x:r.left+p.x*r.width/W,y:r.top+p.y*r.height/H};
    });
    const beforePickup=await snapshot('drag-before-pickup');
    await page.mouse.move(mousePoint.x,mousePoint.y); await page.mouse.down();
    assert(await page.evaluate(()=>itemDrag?.item===keepsakes[0]), 'Mouse did not grab the expected insert');
    compare(beforePickup,await snapshot('drag-picked-up'),'Mouse pickup');
    await page.mouse.move(mousePoint.x+35,mousePoint.y-25,{steps:8});
    const beforeDrop=await snapshot('drag-before-drop');
    await page.mouse.up();
    compare(beforeDrop,await snapshot('drag-dropped'),'Mouse drop');
    for(const progress of [.15,.45,.75,1])await snapshot('two-cards-forward-'+progress,{direction:1,progress});
    await page.evaluate(()=>finish(true));
    await snapshot('two-cards-landed');
    const bothLanded=await page.evaluate(()=>[keepsakes[0],keepsakes[1]].map(item=>({...itemState(item)})));
    assert(bothLanded.every(s=>s.pageNumber===-1&&s.back),'Multiple inserts did not transfer to the facing inside cover');
    const twoCovered=await snapshot('two-cards-beneath-next-leaf',{direction:1,progress:.7});
    assert(twoCovered.drawOrder.lastIndexOf('card')<twoCovered.drawOrder.indexOf('sheet'),'Multiple inserts float above the turning leaf');
    await page.evaluate(()=>finish(true));
    assert.equal((await snapshot('two-cards-covered')).count,0);
    await page.evaluate(()=>{motion={direction:-1,progress:1};finish(true);motion={direction:-1,progress:1};finish(true);});
    await snapshot('two-cards-followed-back');
    assert(await page.evaluate(()=>[keepsakes[0],keepsakes[1]].every(item=>itemState(item).pageNumber===-1&&itemState(item).back)), 'Uncovering changed the loose inserts support');
    await page.evaluate(()=>{
      spread=4;motion=null;
      for(const item of allInserts())Object.assign(itemState(item),{pageNumber:99999,taped:false,outside:false});
      Object.assign(itemState(keepsakes[0]),{pageNumber:7,back:true,u:.64,v:.82,rotation:-.07,landedSide:-1});draw();
    });
    const middleStart=await snapshot('middle-left-start');
    for(const progress of [.001,.01,.04,.1,.2]) {
      const frame=await snapshot('middle-left-follows-'+progress,{direction:-1,progress});
      assert(frame.count>0&&frame.alphas.every(a=>a===1),'Middle-book insert failed to follow at full opacity');
    }
    await page.evaluate(()=>{motion={direction:-1,progress:1};finish(true);});
    const middleLanded=await snapshot('middle-right-landed');assert.equal(middleLanded.state.pageNumber,8);assert.equal(middleLanded.count,0);
    await page.evaluate(()=>{motion={direction:1,progress:1};finish(true);});
    assert((await snapshot('middle-right-uncovered')).count>0);
    await snapshot('middle-right-follows-back',{direction:1,progress:.1});
    await page.evaluate(()=>{motion={direction:1,progress:1};finish(true);});
    const middleBack=await snapshot('middle-left-landed');assert.equal(middleBack.state.pageNumber,7);assert.equal(middleBack.count,0);
    await page.evaluate(()=>{motion={direction:-1,progress:1};finish(true);});
    const middleReturned=await snapshot('middle-left-returned');compare(middleStart,middleReturned,'Middle-book round trip');
    assert.deepEqual(middleReturned.state,middleStart.state,'Interleaved turns changed the loose image pose');
    await page.evaluate(()=>{
      spread=0;motion=null;
      for(const item of allInserts())Object.assign(itemState(item),{pageNumber:99999,taped:false,outside:false,landedSide:null});
      Object.assign(itemState(keepsakes[0]),{pageNumber:0,back:true,u:.5,v:.58,rotation:.4});draw();
    });
    let grabError=0;
    for(const offset of [[28,18],[-28,-18]]) {
      const pickup=await page.evaluate(offset=>{
        const s=itemState(keepsakes[0]),p=rigidInsertPoint(resting(1,1),1,0,s,offset[0],offset[1],128*208/180),r=canvas.getBoundingClientRect();
        return {x:r.left+p.x*r.width/W,y:r.top+p.y*r.height/H};
      },offset);
      await page.mouse.move(pickup.x,pickup.y);await page.mouse.down();
      assert(await page.evaluate(()=>!!itemDrag?.surfaceGrab),'Off-center grab failed');
      for(const [dx,dy] of [[15,-10],[40,-25],[25,15]]) {
        await page.mouse.move(pickup.x+dx,pickup.y+dy,{steps:4});
        const result=await page.evaluate(()=>{
          const s=itemState(keepsakes[0]),g=itemDrag.surfaceGrab,p=rigidInsertPoint(resting(1,1),1,0,s,g.rx,g.ry,128*208/180);
          return {x:p.x,y:p.y,rotation:s.rotation};
        });
        const expected=await page.evaluate(p=>{const r=canvas.getBoundingClientRect();return{x:(p.x-r.left)*W/r.width,y:(p.y-r.top)*H/r.height};},{x:pickup.x+dx,y:pickup.y+dy});
        grabError=Math.max(grabError,Math.hypot(result.x-expected.x,result.y-expected.y));
        assert.equal(result.rotation,.4,'Dragging invented a rotation');
      }
      const held=await snapshot('off-center-held-'+offset[0]);await page.mouse.up();
      compare(held,await snapshot('off-center-released-'+offset[0]),'Off-center drop');
    }
    assert(grabError<.02,'Grabbed point slipped away from the pointer');
    const visibilitySteps=Number(process.env.BOOK_VISIBILITY_STEPS)||24;
    const visibility=await page.evaluate(steps=>{
      const item=keepsakes[0],s=itemState(item),samples=[];
      for(const direction of [1,-1]) {
        spread=direction===1?0:1;
        Object.assign(s,{pageNumber:direction===1?0:1,back:true,u:.64,v:.82,rotation:-.07,landedSide:null});
        for(let i=0;i<=steps;i++) {
          motion={direction,progress:i/steps};draw();
          const visible=ctx.getImageData(0,0,canvas.width,canvas.height).data,number=s.pageNumber;
          const chain=turnChain(direction,i/steps),span=(128*208/180)/(2*PAGE_W),a=sampleItemChain(chain,s.u-span),b=sampleItemChain(chain,s.u+span);
          const hiddenFace=(b.x-a.x)*direction<0&&i<steps;
          let leaking=0;
          if(hiddenFace) {
            const layer=insertLayerContext.getImageData(0,0,canvas.width,canvas.height).data;
            for(let j=0;j<turningSheetDepth.length;j++)if(Number.isFinite(turningSheetDepth[j])&&layer[j*4+3]>0)leaking++;
          }
          s.pageNumber=99999;draw();const hidden=ctx.getImageData(0,0,canvas.width,canvas.height).data;s.pageNumber=number;
          let pixels=0;for(let j=0;j<visible.length;j+=4)if(Math.max(Math.abs(visible[j]-hidden[j]),Math.abs(visible[j+1]-hidden[j+1]),Math.abs(visible[j+2]-hidden[j+2]))>18)pixels++;
          samples.push({direction,progress:i/steps,pixels,hiddenFace,leaking});
        }
      }
      return samples;
    },visibilitySteps);
    const narrowest=visibility.reduce((a,b)=>a.pixels<b.pixels?a:b);
    assert(visibility.filter(s=>s.hiddenFace).length>0,'No back-face coverage tested');
    assert(visibility.every(s=>s.leaking===0),'Card pixels render through the back of the turning sheet');
    assert(visibility.filter(s=>s.progress===0).every(s=>s.pixels>20),'Exposed card disappeared at pickup');
    assert(visibility.filter(s=>s.progress===1).every(s=>s.pixels===0),'Photo flashes through the back at the end of the turn');
    for(const direction of [-1,1]){
      const baseline=visibility.find(s=>s.direction===direction&&s.progress===0).pixels;
      assert(visibility.filter(s=>s.direction===direction&&s.progress>0&&s.progress<=.125).every(s=>s.pixels>=baseline*.65),'Photo disappears during the first visible part of the lift');
    }
    await page.evaluate(t=>{spread=t.direction===1?0:1;itemState(keepsakes[0]).pageNumber=t.direction===1?0:1;},narrowest);
    await snapshot('curl-correctly-occluded',narrowest);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ output, pickupError, landingError, placementError:Math.max(...placementErrors),grabError,narrowest,tested: ['visible first-frame pickup', 'no opacity fading', visibility.length+' pixel-occlusion samples', 'facing-page/inside-cover landing ownership', 'no end-of-turn back-face flash', 'clickable after uncovering', 'cancelled drag', '20 drift-free round trips', 'middle-book carry, land, uncover, carry again', 'taped original-face ownership', 'perspective placement', 'actual mouse pickup/drop', 'multiple inserts', 'off-center drag without rotation or slip'], errors }));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
