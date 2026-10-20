'use strict';
// Binary uploads live outside localStorage. Page JSON contains content hashes,
// source-page polygons and reversible treatment choices, never image payloads.
let artDatabasePromise;const artUrls=new Map(),artPending=new Map();
function openArtDatabase(){
  return artDatabasePromise||=(new Promise((resolve,reject)=>{
    const request=indexedDB.open('pixel-book-art',1);request.onupgradeneeded=()=>request.result.createObjectStore('assets',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }));
}
async function saveArtBlob(blob,metadata={}){
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''),id='book-art:'+hash,db=await openArtDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put({id,blob,bytes:blob.size,...metadata});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return id;
}
async function resolveArtAsset(id){
  if(artUrls.has(id))return artUrls.get(id);if(artPending.has(id))return artPending.get(id);
  const promise=(async()=>{const db=await openArtDatabase(),record=await new Promise((resolve,reject)=>{const q=db.transaction('assets').objectStore('assets').get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});if(!record)throw new Error('Local illustration asset is missing');const url=URL.createObjectURL(record.blob);artUrls.set(id,url);return url;})();
  artPending.set(id,promise);try{return await promise;}finally{artPending.delete(id);}
}
function canvasArtBlob(c){return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Image encoding failed')),'image/webp',.90));}
async function decodeBookArt(blob){
  if(blob.size>30*1024*1024)throw new Error('Choose an image under 30 MB.');const image=await createImageBitmap(blob);if(image.width*image.height>36000000){image.close();throw new Error('Choose an image under 36 megapixels.');}return image;
}
async function renderBookArt(blob,{treatment='pixel-ink',removeWhite=true,smooth=true,width=300,height=240}={}){
  const image=await decodeBookArt(blob),scale=Math.min(1,width/image.width,height/image.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));
  const p=c.getContext('2d',{willReadFrequently:true});p.imageSmoothingEnabled=smooth;p.imageSmoothingQuality='high';p.drawImage(image,0,0,c.width,c.height);image.close();
  const pixels=p.getImageData(0,0,c.width,c.height),d=pixels.data;
  if(removeWhite){
    const border=[];for(let x=0;x<c.width;x++)for(const y of [0,c.height-1]){const i=(y*c.width+x)*4;border.push(Math.min(d[i],d[i+1],d[i+2]));}for(let y=0;y<c.height;y++)for(const x of [0,c.width-1]){const i=(y*c.width+x)*4;border.push(Math.min(d[i],d[i+1],d[i+2]));}border.sort((a,b)=>a-b);const whiteCutoff=Math.max(208,Math.min(240,border[Math.floor(border.length*.9)]-8));
    // Flood only edge-connected paper. Enclosed white eyes/highlights survive.
    const visited=new Uint8Array(c.width*c.height),queue=new Int32Array(visited.length);let head=0,tail=0;
    const add=i=>{if(i<0||i>=visited.length||visited[i])return;visited[i]=1;const j=i*4;if(d[j+3]<8||Math.min(d[j],d[j+1],d[j+2])>whiteCutoff&&Math.max(d[j],d[j+1],d[j+2])-Math.min(d[j],d[j+1],d[j+2])<32)queue[tail++]=i;};
    for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}for(let y=0;y<c.height;y++){add(y*c.width);add(y*c.width+c.width-1);}
    while(head<tail){const i=queue[head++];d[i*4+3]=0;if(i%c.width)add(i-1);if(i%c.width<c.width-1)add(i+1);add(i-c.width);add(i+c.width);}
  }
  if(treatment!=='original')for(let i=0;i<d.length;i+=4){
    const l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,level=Math.round(Math.pow(Math.max(0,Math.min(1,(l-.12)/.76)),.9)*7)/7;
    d[i]=Math.round(37+level*209);d[i+1]=Math.round(25+level*202);d[i+2]=Math.round(19+level*158);
  }
  p.putImageData(pixels,0,0);return{blob:await canvasArtBlob(c),width:c.width,height:c.height,recipe:{version:2,treatment,removeWhite,smooth,width:c.width,height:c.height}};
}

let pageArtMode=false,artStroke=null,artSelection=null;
function artScreenPoint(number,x,y){
  const side=number%2===0?1:-1,amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
  return project(sampleChain(resting(side,amount),side<0?1-x/PAGE_W:x/PAGE_W),y/PAGE_H);
}
function artPagePoint(number,point){
  let x=200,y=175;
  for(let i=0;i<10;i++){const a=artScreenPoint(number,x,y),b=artScreenPoint(number,x+1,y),c=artScreenPoint(number,x,y+1),ax=b.x-a.x,ay=b.y-a.y,bx=c.x-a.x,by=c.y-a.y,det=ax*by-ay*bx;if(Math.abs(det)<.001)return null;x+=((point.x-a.x)*by-(point.y-a.y)*bx)/det;y+=(ax*(point.y-a.y)-ay*(point.x-a.x))/det;}
  return x>=0&&x<=PAGE_W&&y>=0&&y<=PAGE_H?{x:Math.round(x*10)/10,y:Math.round(y*10)/10}:null;
}
function artPersistPage(number,data){
  bookContent.pages[number]=data;persistBookContent();const saved=savedBooks.find(b=>b.id===activeBookId);if(saved){saved.pages=structuredClone(bookContent.pages);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}textures.clear();shadedTextures.clear();draw();if(typeof refreshWorkshopPreview==='function')refreshWorkshopPreview();
}
function paintArtRegion(){
  if(!pageArtMode||motion||coverMotion)return;const selected=artStroke||artSelection;if(!selected||!editablePages().includes(selected.page))return;
  const points=selected.points.map(p=>artScreenPoint(selected.page,p.x,p.y));if(!points.length)return;
  ctx.save();ctx.strokeStyle='#6a4430';ctx.fillStyle='#d1aa65';ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(!artStroke)ctx.closePath();ctx.stroke();ctx.setLineDash([]);for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();}ctx.restore();
}
function setPageArtMode(on){
  if(on&&(closed3DActive()||motion||coverMotion)){$('#status').textContent='Open a book page before placing art.';return;}
  pageArtMode=on;artStroke=null;$('#page-art-tools').hidden=!on;$('#page-art-toggle').setAttribute('aria-pressed',String(on));canvas.classList.toggle('art-pen',on);
  if(on){const number=visibleReaderPage(),regions=bookPage(number).artRegions||[];artSelection=regions.length?{...regions.at(-1),page:number}:null;$('#page-art-status').textContent='Draw a closed region on either page, then add an image.';}
  draw();
}
async function placeRegionArt(file){
  if(!artSelection)throw new Error('Draw a region on a page first.');
  const decoded=await decodeBookArt(file);decoded.close();
  const selection=structuredClone(artSelection),xs=selection.points.map(p=>p.x),ys=selection.points.map(p=>p.y),box={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  const originalSrc=await saveArtBlob(file,{name:file.name,kind:'original'}),treatment=$('#page-art-treatment').value;
  let src=originalSrc,recipe={version:1,treatment:'original'};
  if(treatment!=='original'){
    const result=await renderBookArt(file,{treatment,removeWhite:$('#page-art-white').checked,smooth:$('#page-art-smooth').checked,width:Math.min(800,box.w*2),height:Math.min(700,box.h*2)});recipe=result.recipe;src=await saveArtBlob(result.blob,{kind:'derivative',originalSrc,recipe});
  }
  const url=await resolveArtAsset(src),img=new Image();img.src=url;await img.decode();const scale=Math.min(box.w/img.width,box.h/img.height),w=img.width*scale,h=img.height*scale;
  const data=structuredClone(bookPage(selection.page));data.images||=[];data.images.push({id:crypto.randomUUID(),src,originalSrc,recipe,alt:file.name||'Page illustration',regionId:selection.id,polygon:selection.points,x:box.x+(box.w-w)/2,y:box.y+(box.h-h)/2,w,h});artPersistPage(selection.page,data);
  $('#page-art-status').textContent='Image saved locally in this page region. Turn the page to see it travel with the paper.';
}
function initPageArtTools(){
  const button=document.createElement('button');button.id='page-art-toggle';button.type='button';button.textContent='Add page art';button.setAttribute('aria-pressed','false');$('.library-toolbar').append(button);button.onclick=()=>setPageArtMode(!pageArtMode);
  const panel=document.createElement('section');panel.id='page-art-tools';panel.hidden=true;panel.setAttribute('aria-label','Page illustration tools');panel.innerHTML=`<button id="page-art-redraw">Draw region</button><button id="page-art-upload">Add JPG / PNG…</button><input id="page-art-file" type="file" accept="image/jpeg,image/png" hidden><label>Treatment <select id="page-art-treatment"><option value="pixel-ink">Pixel ink</option><option value="original">Leave original</option></select></label><label><input id="page-art-white" type="checkbox" checked>Remove white paper</label><label><input id="page-art-smooth" type="checkbox" checked>Smooth first</label><button id="page-art-done">Done</button><p id="page-art-status" role="status"></p>`;document.body.append(panel);
  $('#page-art-upload').onclick=()=>{if(!artSelection){$('#page-art-status').textContent='Draw an area on a page first.';return;}$('#page-art-file').click();};
  $('#page-art-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('#page-art-upload').disabled=true;try{await placeRegionArt(file);}catch(error){$('#page-art-status').textContent=error.message;}finally{e.target.value='';$('#page-art-upload').disabled=false;}};
  $('#page-art-redraw').onclick=()=>{artSelection=null;draw();$('#page-art-status').textContent='Draw a new dotted region.';};$('#page-art-done').onclick=()=>setPageArtMode(false);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])canvas.addEventListener(type,e=>{
    if(!pageArtMode||motion||coverMotion||closed3DActive())return;e.preventDefault();e.stopImmediatePropagation();canvas.style.cursor='';
    if(type==='pointerdown'){
      if(e.button!==0)return;const p=point(e);let hit=null;for(const page of editablePages()){const at=artPagePoint(page,p);if(at){hit={page,points:[at]};break;}}
      if(hit){artStroke=hit;canvas.setPointerCapture(e.pointerId);}draw();
    }else if(type==='pointermove'&&artStroke){const at=artPagePoint(artStroke.page,point(e));if(at&&Math.hypot(at.x-artStroke.points.at(-1).x,at.y-artStroke.points.at(-1).y)>5){artStroke.points.push(at);if(artStroke.points.length>128)artStroke.points=artStroke.points.filter((_,i)=>i%2===0);draw();}}
    else if(type==='pointerup'||type==='pointercancel'){
      if(artStroke&&type!=='pointercancel'){
        const xs=artStroke.points.map(p=>p.x),ys=artStroke.points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
        if(w>15&&h>15&&artStroke.points.length>=3){artSelection={...artStroke,id:crypto.randomUUID()};const data=structuredClone(bookPage(artSelection.page));data.artRegions||=[];data.artRegions.push({id:artSelection.id,points:artSelection.points});artPersistPage(artSelection.page,data);$('#page-art-status').textContent='Region ready · add a JPG or PNG, original or pixel ink.';}else $('#page-art-status').textContent='Draw a larger closed area, at least 16 × 16 page pixels.';
      }
      artStroke=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);draw();
    }
  },true);
  document.addEventListener('keydown',e=>{if(pageArtMode&&e.key==='Escape'){e.preventDefault();setPageArtMode(false);}});
}
