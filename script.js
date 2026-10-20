'use strict';

// The page artwork and its writing share one offscreen viewport. Each viewport
// is mapped onto a spine-anchored chain, including during a turn.
const canvas = document.querySelector('#book');
const ctx = canvas.getContext('2d');
const W = 1000, H = 680, SEGMENTS = 30, PAGE_W = 400, PAGE_H = 350;
const CX = 500, TOP = 168, BOTTOM = 560;
const BOARD_SEAM=464,SPINE_END=560;
let pageCount=28;
const spreadCount=()=>Math.ceil(pageCount/2)+1;
const $ = selector => document.querySelector(selector);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => { t=clamp(t); return t*t*(3-2*t); };
const sine = t => (1-Math.cos(Math.PI*clamp(t)))/2;
const assets = {};
const baseAssets = {};
const contentKey='keepers-book-content-v1';
const coverSymbolNames=['Fleur-de-lis','Compass rose','Crescent moon','Star compass','Key','Feather',
  'Raven','Lantern','Oak leaf','Thorned rose','River wave','Mountain','All-seeing eye','Open hand','Sun','Bell',
  'Knotwork','Hourglass','Moth','Fish','Crown','Anchor','Quill & ink','Acorn','Shell','Diamond sigil',
  'Antlers','Laurel wreath','Autumn tree','Moon & star','North star','Clover','Dragon','Wheat sheaf','Stag','Gilded butterfly'];
const bookContent=loadBookContent();
pageCount=clamp(Number(bookContent.pageCount)||28,8,4096);
let bookName=bookContent.name||'The Keeper’s Book',activeBookId=localStorage.getItem('keepers-book-active')||'';
let savedBooks=loadBookShelf(),editMode=false,selectedPageImage=-1,pixelMode='art',drawingState=null;
const textures = new Map();
const shadedTextures = new Map();
const userImages=new Map();
let editorMode='',editorPageList='',selectedEditPage=null;
let itemHits = [], inspection = null, itemDrag = null;
let spread = 0, motion = null, raf = 0, drag = null, autoTimer = 0;
let loaded = false, autoDirection = 1;
let closedEdge=null,coverMotion=null,closedFlipMotion=null;
let spineView=false,spineMotion=null;
let bookTableMode=false;
let queuedTurns=[];
let chapterJourney=null;
const turnDestination=()=>motion?.toSpread??spread+(motion?.direction||0);
const turningDistance=()=>motion?turnDestination()-spread:0;
let tocHitAreas=[],highlightedToc=-1,jumpTimer=0;
let PIXEL_SCALE=.64;
// Keep the illustrated journal pixelated; full-text novels use a higher
// resolution framebuffer and page textures so serif glyphs remain readable.
canvas.width=Math.round(W*PIXEL_SCALE);canvas.height=Math.round(H*PIXEL_SCALE);
ctx.setTransform(PIXEL_SCALE,0,0,PIXEL_SCALE,0,0);

async function load() {
  const loading=$('#loading');
  if(location.protocol==='file:') {
    document.body.classList.add('file-open');
    loading.replaceChildren(
      document.createTextNode('This book was opened as a local file, so the browser blocked its sprite images. '),
      Object.assign(document.createElement('a'),{href:'http://localhost:4173/',textContent:'Open the working version at localhost'})
    );
    loading.classList.add('load-error');
    return;
  }
  try {
    await openArtDatabase();
    await loadBookFonts();
    await loadStarterLibrary();
    seedStarterBooks();
    migrateDefaultBookFont();
    migrateStarterEditions();pageCount=bookContent.pageCount;setBookResolution();
    await Promise.all(Object.entries({
      board:'inside-board-v3.png',binding:'open-spine-v3.png',stack:'page-stack-v2.png',leather:'leather-stack-v2.png',
      a:'page-a-v2.png', b:'page-b-v2.png', c:'page-c-v2.png',
      front:'outside-board-v3.png',closedSpine:'closed-spine-v3.png',
      feather:'feather-keepsake.png',spine:'spine-v1.png',symbols:'cover-symbols.png',ornaments:'spine-ornaments-v2.png',historyOrnaments:'spine-ornaments-history-v1.png'
    }).map(async ([key,file]) => {
      const img = new Image(); img.src = 'assets/'+file;
      await img.decode(); assets[key] = img;
    }));
    for(const key of ['a','b','c'])assets[key]=clearDarkPageFringe(assets[key]);
    assets.leather = edgeTexture(assets.leather);
    Object.assign(baseAssets,assets);
    assignSpineOrnaments();
    $('#outside-color').value=bookContent.palette.outside;
    $('#inside-color').value=bookContent.palette.inside;
    $('#metal-color').value=bookContent.palette.metal;
    applyBookPalette(false);
    resetSessionInserts();restoreEdgeBookmarks();
    loaded = true;
    $('#book-name').value=bookName;
    loading.hidden = true;
    closedEdge='front';updateControls(); draw();renderShelf();$('#shelf').showModal();
  } catch(error) {
    loading.replaceChildren(
      document.createTextNode(`A book sprite could not be loaded (${error.message}). `),
      Object.assign(document.createElement('a'),{href:'http://localhost:4173/',textContent:'Open the served version'})
    );
    loading.classList.add('load-error');
    console.error(error);
  }
}

function clearDarkPageFringe(image) {
  // The generated paper atlas has stray opaque near-black pixels just inside
  // either transparent edge. Clear those edge pixels before the tile is
  // stretched into the page viewport; keep the warm torn-paper ink intact.
  const surface=document.createElement('canvas');surface.width=image.width;surface.height=image.height;
  const p=surface.getContext('2d',{willReadFrequently:true});p.drawImage(image,0,0);
  const frame=p.getImageData(0,0,image.width,image.height),data=frame.data;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++) {
    // The page renderer crops 5px from the left and 28px from the right
    // before stretching this atlas. Clear a wider fringe than the crop so
    // stray black pixels do not survive on the exposed page edge.
    if(x>=40&&x<image.width-40)continue;
    const i=(y*image.width+x)*4;
    if(data[i+3]>24&&data[i]<48&&data[i+1]<48&&data[i+2]<52)data[i+3]=0;
  }
  p.putImageData(frame,0,0);return surface;
}

function edgeTexture(image) {
  // Remove transparent padding along each strip column before stretching it
  // between the page chain and the cover. This preserves the painted layers
  // without exposing the cover lining through the strip's curved silhouette.
  const original=document.createElement('canvas');
  original.width=image.width;original.height=image.height;
  const source=original.getContext('2d');source.drawImage(image,0,0);
  const pixels=source.getImageData(0,0,image.width,image.height).data;
  const result=document.createElement('canvas');result.width=image.width;result.height=96;
  const out=result.getContext('2d');out.imageSmoothingEnabled=false;
  out.fillStyle='#713440';out.fillRect(0,0,result.width,result.height);
  for(let x=0;x<image.width;x++) {
    let first=-1,last=-1;
    for(let y=0;y<image.height;y++) if(pixels[(y*image.width+x)*4+3]>220){if(first<0)first=y;last=y;}
    if(last>first)out.drawImage(original,x,first,1,last-first+1,x,0,1,96);
  }
  return result;
}

const entries = [
  ['THE KEEPER’S BOOK','A record of\nsmall wonders','Take the road that bends\ntoward the river.\n\nBring a little salt.\nLeave a little light.'],
  ['CONTENTS','Between\nthese pages','01  The road\n03  Field notes\n07  The reedbeds\n11  Pack & provisions\n17  The old mill\n23  Unfinished business'],
  ['FIELD NOTES','The sunken\nroad','The old road does not end\nat the water. It simply\nforgets to rise.\n\nI tied a red thread to the\nlast tree. It was gone\nwhen I looked back.'],
  ['IN THE MARGIN','Listen\nbefore dusk','The reeds hum before\nthe fog arrives.\n\nNo shadow crosses\nthe water twice.\n\nThe road knows your name.'],
  ['MARSHLANDS','Blue\nlanterns','Three lights above\nthe black water.\n\nOne for the ferryman.\nOne for the lost.\n\nThe third was following me.'],
  ['A SMALL DISCOVERY','The mill\nkey','Found beneath a stone\nwhere nothing should grow.\n\nIron. Cold to the touch.\n\nThe teeth do not match\nany lock I have seen.'],
  ['FIELD KIT','What\nremains','Salted pear .......... 2\nBlue match ........... 1\nMill key ............. 1\nUnfamiliar coin ...... ?'],
  ['INVENTORY NOTE','Useful,\nnot precious','The best tools are the\nones you forget you carry.\n\nKeep one dry match.\n\nNever spend the coin.'],
  ['CARTOGRAPHY','The\nreedbeds','North is only a guess.\n\nFollow the bent willow.\nPass the broken bridge.\nStop before the bells.'],
  ['OLD CUSTOMS','Leave\nsomething','A little bread at the gate.\nA name upon the water.\n\nDo not take back\nwhat you have given.'],
  ['THE OLD MILL','No grain\nin the wheel','The wheel turns at night.\nThere is no river here.\n\nSomething is keeping\ncount of every turn.'],
  ['MILL RECORD','A hand\nnot mine','Seven marks on the wall.\nSix names in the ledger.\n\nThe last page\nhas been torn away.'],
  ['RECOLLECTION','A familiar\nvoice','It called from the reeds.\n\nI did not answer.\n\nI almost did.'],
  ['MARGIN / 07','Remember\nthe way','Every page remembers\nthe hand that turned it.\n\nPerhaps the road does too.']
];

function loadBookContent() {
  try {
    const saved=JSON.parse(localStorage.getItem(contentKey)||'{}');
return {insertMounts:saved.insertMounts||[],pageFormat:saved.pageFormat,spineOrnaments:saved.spineOrnaments,bookFont:saved.bookFont||DEFAULT_BOOK_FONT,starterId:saved.starterId||null,edition:saved.edition,sourcePageCount:saved.sourcePageCount,name:saved.name||'The Keeper’s Book',pageCount:saved.pageCount||28,pages:saved.pages||{},edgeBookmarks:Array.isArray(saved.edgeBookmarks)?saved.edgeBookmarks:[],covers:{front:{},back:{},...(saved.covers||{})},palette:{outside:'#9b382d',inside:'#c85e68',metal:'gold',...(saved.palette||{})}};
  } catch { return {name:'The Keeper’s Book',pageCount:28,pages:{},covers:{front:{},back:{}},palette:{outside:'#9b382d',inside:'#c85e68',metal:'gold'}}; }
}

const materialMasks=new WeakMap();
function liningRegion(source,data){
  const w=source.width,h=source.height,region=new Uint8Array(w*h),queue=new Uint32Array(w*h);
  const fabric=i=>{const n=i*4,r=data[n],g=data[n+1],b=data[n+2];return data[n+3]>80&&r>g*1.2&&b>g*1.01&&b>r*.36&&r>25;};
  const seed=Math.floor(h*.45)*w+Math.floor(w*.60);let head=0,tail=0;
  if(fabric(seed)){region[seed]=1;queue[tail++]=seed;}
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!region[j]&&fabric(j)){region[j]=1;queue[tail++]=j;}}
  // Fill the quilt's darker stitches inside its traced silhouette. The row
  // extents follow the sloped fabric edge instead of an axis-aligned inset.
  for(let y=0;y<h;y++){let a=w,b=-1;for(let x=0;x<w;x++)if(region[y*w+x]){a=Math.min(a,x);b=x;}if(b>=a)region.fill(1,y*w+a,y*w+b+1);}
  return region;
}

function spriteSurface(width,height) {
  const surface=document.createElement('canvas');surface.width=width;surface.height=height;return surface;
}

function mirroredSprite(source) {
  const surface=spriteSurface(source.width,source.height),p=surface.getContext('2d');
  p.translate(source.width,0);p.scale(-1,1);p.drawImage(source,0,0);return surface;
}

function assembledCover(board,binding) {
  const surface=spriteSurface(1024,565),p=surface.getContext('2d');
  p.imageSmoothingEnabled=false;
  p.drawImage(board,0,0,BOARD_SEAM,565);
  p.drawImage(binding,BOARD_SEAM,0,SPINE_END-BOARD_SEAM,565);
  p.drawImage(mirroredSprite(board),SPINE_END,0,1024-SPINE_END,565);return surface;
}

function coverMaterialMask(source,kind,data) {
  if(materialMasks.has(source))return materialMasks.get(source);
  const mask=new Uint8Array(source.width*source.height*2);
  const fabric=kind==='board'?liningRegion(source,data):null;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++) {
    const pixel=y*source.width+x,i=pixel*4,u=x/source.width,v=y/source.height;
    const r=data[i],g=data[i+1],b=data[i+2];
    let lining=0,metal=0;
    if(kind==='board')lining=fabric[pixel];
    if(kind==='binding')lining=smooth((y-58)/12)*smooth((485-y)/14);
    const corner=kind==='board'?u<.35&&(v<.25||v>.70):kind==='outside'?u>.77&&(v<.23||v>.76):false;
    // Hardware is identified only inside the corner guards, not by applying
    // a gold threshold to every warm highlight in the leather or lining.
    if(corner)metal=smooth((g/Math.max(1,r)-.57)/.16)*smooth((b/Math.max(1,r)-.30)/.24);
    if(kind==='symbols')metal=1;
    if(kind==='spine'||kind==='binding'&&(v<.14||v>.81)) {
      metal=Math.max(metal,smooth((g/Math.max(1,r)-.52)/.24)*smooth((.84-b/Math.max(1,g))/.22)*smooth((r-65)/55));
    }
    mask[pixel*2]=Math.round(lining*(1-metal)*255);mask[pixel*2+1]=Math.round(metal*255);
  }
  materialMasks.set(source,mask);return mask;
}

function tintCoverSprite(source,kind,palette,hardwareOnly=false) {
  const surface=document.createElement('canvas');surface.width=source.width;surface.height=source.height;
  const p=surface.getContext('2d',{willReadFrequently:true});p.drawImage(source,0,0);
  const frame=p.getImageData(0,0,surface.width,surface.height),data=frame.data;
  const mask=coverMaterialMask(source,kind,data);
  const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const outside=rgb(palette.outside),inside=rgb(palette.inside),metal=rgb(palette.metal==='silver'?'#c4cfd8':'#d7af60');
  const luminance=color=>color[0]*.2126+color[1]*.7152+color[2]*.0722;
  const outsideReference=luminance([155,56,45]),insideReference=luminance([200,94,104]);
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],alpha=data[i+3];if(alpha===0)continue;
    const pixel=i/4,liningWeight=mask[pixel*2]/255,metalWeight=mask[pixel*2+1]/255;
    if(hardwareOnly)data[i+3]=Math.round(alpha*metalWeight);
    const l=luminance([r,g,b]);
    for(let c=0;c<3;c++) {
      const leather=palette.outside==='#9b382d'?data[i+c]:outside[c]*l/outsideReference;
      const fabric=palette.inside==='#c85e68'?data[i+c]:inside[c]*l/insideReference;
      const plated=metal[c]*l/180;
      data[i+c]=clamp(mix(mix(leather,fabric,liningWeight),plated,metalWeight),0,255);
    }
  }
  p.putImageData(frame,0,0);return surface;
}

function applyBookPalette(redraw=true) {
  if(!baseAssets.board)return;
  const palette=bookContent.palette;
  assets.board=tintCoverSprite(baseAssets.board,'board',palette);
  assets.binding=tintCoverSprite(baseAssets.binding,'binding',palette);
  assets.frame=assembledCover(assets.board,assets.binding);
  assets.insideFront=assets.board;assets.insideBack=mirroredSprite(assets.board);
  assets.front=tintCoverSprite(baseAssets.front,'outside',palette);assets.back=mirroredSprite(assets.front);
  assets.closedSpine=tintCoverSprite(baseAssets.closedSpine,'leather',palette);
  assets.spine=tintCoverSprite(baseAssets.spine,'spine',palette);
  assets.symbols=tintCoverSprite(baseAssets.symbols,'symbols',palette);
  // Paper edges keep their warm natural color when the covers are recolored.
  assets.leather=baseAssets.leather;
  const guards=tintCoverSprite(baseAssets.board,'board',palette,true);
  const empty=spriteSurface(128,565);assets.hardware=assembledCover(guards,empty);
  textures.clear();shadedTextures.clear();
  if(redraw)draw();
}

function loadBookShelf() {
  try { const shelf=JSON.parse(localStorage.getItem('keepers-book-shelf-v1')||'[]');return Array.isArray(shelf)?shelf:[]; }
  catch { return []; }
}

function persistBookContent() {
  try { bookContent.name=bookName;bookContent.pageCount=pageCount;localStorage.setItem(contentKey,JSON.stringify(bookContent)); }
  catch { $('#status').textContent='This browser could not save the book edits.'; }
}

function coverContent(edge) {
  return bookContent.covers[edge]||(bookContent.covers[edge]={});
}

const paperSheets=new Map(),paperBottoms=new WeakMap();
function paperSurface(number) {
  const key=((number%6)+6)%6;
  if(paperSheets.has(key))return paperSheets.get(key);
  const surface=document.createElement('canvas');surface.width=PAGE_W;surface.height=PAGE_H;
  const p=surface.getContext('2d');p.imageSmoothingEnabled=false;
  p.fillStyle='#f6e9b5';p.fillRect(number%2!==0?16:0,12,PAGE_W-16,PAGE_H-24);
  const tile=assets[['a','b','c'][((number%3)+3)%3]];
  p.save();if(number%2===0){p.translate(PAGE_W,0);p.scale(-1,1);}
  p.drawImage(tile,5,8,tile.width-28,tile.height-16,0,0,PAGE_W,PAGE_H);p.restore();
  paperSheets.set(key,surface);return surface;
}
function paperBottomV(number,side,u) {
  const surface=paperSurface(number);
  if(!paperBottoms.has(surface)) {
    const pixels=surface.getContext('2d').getImageData(0,0,PAGE_W,PAGE_H).data,profile=[];
    for(let x=0;x<PAGE_W;x++) {
      let y=PAGE_H-1;while(y>=0&&pixels[(y*PAGE_W+x)*4+3]<180)y--;
      profile[x]=(y>=0?y+1:PAGE_H-12)/PAGE_H;
    }
    paperBottoms.set(surface,profile);
  }
  const column=Math.round(clamp(side<0?1-u:u)*(PAGE_W-1));
  return paperBottoms.get(surface)[column];
}
function viewport(number) {
  const blank = $('#blank').checked;
  const hand=$('#hand').value;
  const entry = entries[number%entries.length],custom=bookPage(number);
  const key = number+':'+blank+':'+hand+':'+$('#margin-note').value+':'+JSON.stringify(custom);
  if(textures.has(key)) return textures.get(key);
  const surface = document.createElement('canvas');
  const resolution=custom.novel||hasBookFont()?2:1;
  surface.width = PAGE_W*resolution; surface.height = PAGE_H*resolution;surface.pageViewport=true;
  const p = surface.getContext('2d');
  adaptPageTextContext(p);
  p.scale(resolution,resolution);
  p.imageSmoothingEnabled = false;
  // The binding edge is straight and continuous; only the three exposed
  // parchment edges retain the tile's torn silhouette.
  p.drawImage(paperSurface(number),0,0);
  const paperTints={ivory:'rgba(255,247,218,.12)',aged:'rgba(202,147,82,.13)'};
  if(paperTints[custom.paper]){p.save();p.globalCompositeOperation='source-atop';p.fillStyle=paperTints[custom.paper];p.fillRect(0,0,PAGE_W,PAGE_H);p.restore();}
  if(!blank) {
    const font=hasBookFont()?'book':custom.font||'pixel',inkColor=custom.ink||'#5b3e2d';
    const role=pageRole(number),title=custom.title??entry[1];
    if(custom.novel&&custom.titlePage){
      drawSourceTitle(p,custom.titlePage);
    }else if(custom.novel&&custom.tocRows){
      drawSourceContents(p,number);
    }else if(custom.novel){
      let bodyTop=drawSourceFigures(p,custom),body=custom.body||'';
      if(custom.chapterOpening&&body.startsWith(custom.chapterOpening)){
        p.save();p.font='18px '+bookFontFamily();p.fillStyle=inkColor;p.textAlign='center';p.textBaseline='top';p.fillText(custom.chapterOpening,200,38,304);p.restore();
        body=body.slice(custom.chapterOpening.length).trim();bodyTop=Math.max(bodyTop,77);
      }
      const layout=layoutBookBody(custom,p);
      p.fillStyle=custom.ink||'#302019';p.font=layout.size+'px '+bookFontFamily();p.textBaseline='top';
      layout.lines.forEach((line,i)=>p.fillText(line,layout.x??45,layout.top+i*layout.lineHeight));
      drawPageNumber(p,number,custom.pageNumberPlacement||'bottom-center',hand);
    } else if(role==='contents') {
      p.fillStyle=inkColor;ink(p,'CONTENTS',45,31,1.05,hand);
      drawPageText(p,'Between these pages',45,63,304,font==='pixel'?'serif':font,20,inkColor,25);
      p.fillStyle='#ae9160';p.fillRect(45,111,304,1);
      const chapters=sectionPages(),perPage=9,start=Math.max(0,(number-1)*perPage);
      chapters.slice(start,start+perPage).forEach((chapter,index)=>{
        const row=index+start,folio=automaticFolio(chapter.page);
        const label=String(folio).padStart(2,'0')+'  '+chapter.label;
        const y=136+index*21;
        if(highlightedToc===row){p.fillStyle='rgba(158,112,61,.18)';p.fillRect(38,y-3,326,19);}
        p.fillStyle=inkColor;ink(p,label,45,y,1.75,hand);
        tocHitAreas.push({page:number,row,target:chapter.page,x:38,y:y-4,w:326,h:20});
      });
      drawPageNumber(p,number,custom.pageNumberPlacement||'bottom-center',hand);
    } else {
      if(role!=='title'){
        p.fillStyle=font==='pixel'?'#81583c':inkColor;ink(p,custom.eyebrow??entry[0],45,31,1.05,hand);
      }
      if(font==='pixel'){
        p.fillStyle=inkColor;title.split('\n').forEach((line,i)=>ink(p,line,45,role==='title'?94+i*36:63+i*31,3,hand));
      } else drawPageText(p,title,45,role==='title'?100:61,304,font,role==='title'?25:19,inkColor,role==='title'?34:26);
      if(role!=='title'){
        p.fillStyle = '#ae9160'; p.fillRect(45,131,304,1);
        p.fillStyle=font==='pixel'?(custom.ink|| (hand==='grudge'?'#733c32':'#5b3e2d')):inkColor;
        if(font==='pixel') (custom.body??entry[2]).split('\n').forEach((line,i)=>{
          p.save();p.translate(45,151+i*20);p.rotate((hand==='wanderer'?.012:hand==='grudge'?-.009:.003)*Math.sin(i*4+number));ink(p,line,0,0,2,hand);p.restore();
        });
        else drawPageText(p,custom.body??entry[2],45,151,304,font,12,inkColor,18);
        drawPageNumber(p,number,custom.pageNumberPlacement||'bottom-center',hand);
        drawDoodle(p,number,hand);
      }
    }
    if(number%2===0&&$('#margin-note').value) {
      p.fillStyle='#8b4b34';ink(p,$('#margin-note').value.slice(0,32),45,307,1.2,hand);
    }
  }
  paintUserArtwork(p,number,custom);
  if(editMode&&!blank) {
    p.save();p.strokeStyle='rgba(139,92,48,.72)';p.lineWidth=1;p.setLineDash([3,3]);
    p.strokeRect(38,54,324,72);p.strokeRect(38,144,324,150);p.restore();
  }
  if(textures.size>=24)textures.delete(textures.keys().next().value);
  textures.set(key,surface); return surface;
}

function drawPageText(p,text,x,y,width,font,size,color,lineHeight) {
  const family=font==='book'?bookFontFamily():font==='serif'?'Georgia,serif':'ui-monospace,monospace';
  p.save();p.fillStyle=color;p.font=`${font==='serif'?'italic ':''}${size}px ${family}`;p.textBaseline='top';
  let line='',lineY=y;
  for(const paragraph of String(text).split('\n')) {
    if(!paragraph){lineY+=lineHeight;continue;}
    for(const word of paragraph.split(/\s+/)) {
      const test=line?`${line} ${word}`:word;
      if(line&&p.measureText(test).width>width){p.fillText(line,x,lineY,width);lineY+=lineHeight;line=word;}
      else line=test;
    }
    if(line){p.fillText(line,x,lineY,width);lineY+=lineHeight;line='';}
  }
  p.restore();
}

function drawPageNumber(p,number,placement,hand) {
  if(number>=readingPageCount())return;
  if(pageRole(number)==='title'||pageRole(number)==='contents')return;
  const locations={'bottom-center':[188,326],'top-left':[25,20],'top-right':[350,20],'bottom-left':[25,326],'bottom-right':[350,326]};
  const [x,y]=locations[placement]||locations['bottom-center'],custom=bookPage(number);
  p.save();p.fillStyle=custom.ink||'#5b3e2d';
  if(hasBookFont()||custom.novel||custom.font&&custom.font!=='pixel'){
    const family=hasBookFont()||custom.novel?bookFontFamily():custom.font==='serif'?'Georgia,serif':'ui-monospace,monospace';
    p.font=(custom.font==='serif'&&!custom.novel&&!hasBookFont()?'italic ':'')+'12px '+family;p.textBaseline='top';
    p.textAlign=placement.includes('center')?'center':placement.includes('right')?'right':'left';
    p.fillText(String(automaticFolio(number)),placement.includes('center')?PAGE_W/2:x,y);
  }else ink(p,String(automaticFolio(number)),x,y,1.2,hand);
  p.restore();
}

function registerTocAreas(page,chain,side) {
  if(pageRole(page)!=='contents')return;
  if(bookPage(page).tocRows){
    for(const row of sourceContentsLayout(page)){
      const corners=[[row.x,row.y],[row.x+row.w,row.y],[row.x+row.w,row.y+row.h],[row.x,row.y+row.h]].map(([x,y])=>project(sampleChain(chain,side<0?1-x/PAGE_W:x/PAGE_W),y/PAGE_H));
      const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
      tocHitAreas.push({page,row:page*100+row.index,target:row.target,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)});
    }
    return;
  }
  const chapters=sectionPages(),start=Math.max(0,(page-1)*9);
  chapters.slice(start,start+9).forEach((chapter,index)=>{
    const y=(136+index*21)/PAGE_H,v=y+10/PAGE_H,a=38/PAGE_W,b=364/PAGE_W;
    const ua=side<0?1-b:a,ub=side<0?1-a:b;
    const pa=project(sampleChain(chain,ua),v),pb=project(sampleChain(chain,ub),v);
    tocHitAreas.push({row:start+index,target:chapter.page,x:Math.min(pa.x,pb.x),y:Math.min(pa.y,pb.y)-10,w:Math.abs(pb.x-pa.x),h:20});
  });
}

function navigateToChapter(target) {
  chapterJourney=null;
  stopAuto();if(raf)cancelAnimationFrame(raf);target=clamp(target,0,pageCount-1);
  const destination=Math.ceil(target/2);
  closedEdge=null;coverMotion=null;spineView=false;spineMotion=null;motion=null;drag=null;queuedTurns=[];
  if(spread===destination){updateControls();draw();return;}
  const direction=destination>spread?1:-1;
  // Show a few complete bundle turns, including departure and arrival, instead
  // of teleporting near the chapter then squeezing eight turns into 78ms each.
  const distance=Math.abs(destination-spread),start=spread;
  const route=distance<=6?Array.from({length:distance},(_,i)=>start+direction*(i+1)):
    [start+direction,...[.25,.5,.75].map(t=>start+direction*Math.round(distance*t)),destination-direction,destination];
  chapterJourney={route:[...new Set(route)],index:0,destination};advanceChapterJourney();
}
function advanceChapterJourney(){
  const journey=chapterJourney;if(!journey)return;
  if(journey.index>=journey.route.length){chapterJourney=null;return;}
  const toSpread=journey.route[journey.index++],direction=Math.sign(toSpread-spread);
  for(const number of [spread*2-1,spread*2,toSpread*2-1,toSpread*2])if(number>=0&&number<pageCount)viewport(number);
  if(!begin(direction,true)){chapterJourney=null;return;}
  motion.toSpread=toSpread;motion.riffle=true;
  if(Math.abs(toSpread-spread)>1)motion.gutterContacts=[];
  const edge=journey.index===1||journey.index===journey.route.length;
  settle(true,matchMedia('(prefers-reduced-motion: reduce)').matches?100:edge?330:240);
}

const defaultSections={2:'The road',4:'Field notes',8:'The reedbeds',12:'Pack & provisions',18:'The old mill',24:'Unfinished business'};
function bookPage(number){return bookContent.pages[number]||starterLibrary.get(bookContent.starterId)?.pages[number]||{};}
function pageRole(number){const custom=bookPage(number);return custom.role||(number===0?'title':number===1?'contents':defaultSections[number]?'section':'body');}
function automaticFolio(number){if(bookContent.sourcePageCount)return number+1;let count=0;for(let i=0;i<=number;i++)if(pageRole(i)!=='title'&&pageRole(i)!=='contents')count++;return count;}
function sectionPages(){
  const source=starterLibrary.get(bookContent.starterId)?.contents;
  if(source){
    if(Object.values(bookContent.pages).some(p=>p.tocRows)){
      const rows=[];for(let n=0;n<readingPageCount();n++)for(const row of bookPage(n).tocRows||[]){
        const known=source.find(c=>c.page===row.target&&(c.sourceLabel===row.label||c.label===row.label));
        const entry={page:row.target,label:known?.label||row.label};if(!rows.some(c=>c.page===entry.page&&c.label===entry.label))rows.push(entry);
      }return rows;
    }
    return source.map(c=>({...c,label:bookContent.pages[c.page]?.tocLabel||c.label}));
  }
  return Array.from({length:pageCount},(_,page)=>({page,role:pageRole(page),label:bookPage(page).tocLabel||(bookPage(page).title||entries[page%entries.length][1]).replace(/\n/g,' ')})).filter(x=>x.role==='section');
}

function getUserImage(source,number) {
  if(!source)return null;
  if(source.startsWith('book-art:')){
    if(!artUrls.has(source)){resolveArtAsset(source).then(()=>{textures.clear();draw();if(typeof refreshWorkshopPreview==='function')refreshWorkshopPreview();}).catch(error=>{$('#status').textContent=error.message;});return null;}
    source=artUrls.get(source);
  }
  let image=userImages.get(source);
  if(!image){image=new Image();userImages.set(source,image);image.onload=()=>{textures.clear();draw();if(typeof refreshWorkshopPreview==='function')refreshWorkshopPreview();};image.src=source;}
  return image.complete&&image.naturalWidth?image:null;
}

function paintUserArtwork(p,number,custom) {
  for(const imageData of custom.images||[]) {
    const image=getUserImage(imageData.src,number);
    if(image){p.save();if(imageData.polygon?.length>=3){p.beginPath();imageData.polygon.forEach((point,i)=>i?p.lineTo(point.x,point.y):p.moveTo(point.x,point.y));p.closePath();p.clip();}const sx=bookWidthScale(),fit=Math.min(imageData.w*sx/image.naturalWidth,imageData.h/image.naturalHeight),w=image.naturalWidth*fit/sx,h=image.naturalHeight*fit;p.drawImage(image,imageData.x+(imageData.w-w)/2,imageData.y+(imageData.h-h)/2,w,h);p.restore();}
  }
  const drawing=getUserImage(custom.art,number);
  if(drawing)p.drawImage(drawing,0,0,PAGE_W,PAGE_H);
}

function drawDoodle(p,number,hand) {
  p.save();p.translate(300,281);p.rotate(hand==='wanderer'?-.12:.08);
  p.strokeStyle='#8a5837';p.fillStyle='#8a5837';p.lineWidth=1.5;
  if(number%3===0) {
    p.strokeRect(-18,-9,28,19);p.beginPath();p.moveTo(9,0);p.lineTo(35,0);p.lineTo(35,8);p.moveTo(29,0);p.lineTo(29,6);p.stroke();
  } else if(number%3===1) {
    p.beginPath();p.moveTo(-22,13);p.lineTo(-8,-15);p.lineTo(7,7);p.lineTo(20,-8);p.lineTo(34,14);p.stroke();
    p.beginPath();p.arc(28,-16,5,0,Math.PI*2);p.stroke();
  } else {
    p.beginPath();p.arc(0,0,18,0,Math.PI*2);p.moveTo(-12,9);p.lineTo(10,-11);p.lineTo(5,5);p.closePath();p.stroke();
  }
  ink(p,number%3===0?'key':number%3===1?'north?':'coin',-23,29,.9,hand);
  if(hand==='grudge'){p.beginPath();p.moveTo(-30,2);p.lineTo(40,-12);p.stroke();}
  p.restore();
}

function litViewport(number,chain,side,turnShade=0) {
  const base=viewport(number);
  if(!shadedTextures.has(number)) {
    const c=document.createElement('canvas');c.width=base.width;c.height=base.height;c.pageViewport=true;if(shadedTextures.size>=24)shadedTextures.delete(shadedTextures.keys().next().value);shadedTextures.set(number,c);
  }
  const surface=shadedTextures.get(number),p=surface.getContext('2d');
  p.setTransform(base.width/PAGE_W,0,0,base.height/PAGE_H,0,0);
  p.clearRect(0,0,PAGE_W,PAGE_H);p.drawImage(base,0,0,PAGE_W,PAGE_H);
  const light=p.createLinearGradient(0,0,PAGE_W,0);
  const slope=Math.atan2(Math.abs(chain[1].z-chain[0].z),Math.abs(chain[1].x-chain[0].x));
  for(let i=0;i<=30;i++) {
    const distance=side<0?1-i/30:i/30;
    const alpha=clamp((.24+.14*clamp(slope/(Math.PI/6)))*Math.exp(-distance*13)+.04*distance*distance+turnShade,0,.52);
    light.addColorStop(i/30,`rgba(63,22,40,${alpha})`);
  }
  p.globalCompositeOperation='source-atop';p.fillStyle=light;p.fillRect(0,0,PAGE_W,PAGE_H);p.globalCompositeOperation='source-over';
  return surface;
}

const pageElevation=z=>z*1.7/(1+Math.max(0,z)/145);
const elevationZ=e=>145*e/(246.5-e);
const pageBlockDepth=amount=>{
  const leaves=pageCount/2;
  // The displayed top leaf is not a stack beneath itself. One landed leaf
  // has no underlying block; the second leaf introduces the first layer.
  return 34*clamp((clamp(amount)*leaves-1)/(leaves-1))*pageThickness();
};
const bindingRoll=amount=>.10+.55*smooth(clamp(amount)/.25)+.35*smooth((clamp(amount)-.70)/.30);
const bindingRadius=amount=>.24+.10*smooth(amount);
const bindingRise=(amount,u)=>{
  const t=clamp(u/bindingRadius(amount));
  return mix(smooth(t),Math.sin(Math.PI/2*t),bindingRoll(amount));
};
const bindingHingeDepth=amount=>{const near=Math.min(clamp(amount),1-clamp(amount));return pageBlockDepth(near)*.22+7*(1-smooth(near/.18));};
const layerDepth=(amount,u)=>mix(bindingHingeDepth(amount),pageBlockDepth(amount),bindingRise(amount,u));

// One shared profile controls both the leaf and the block underneath it. The
// stack sits on the board; adding pages raises its surface rather than pushing
// a separate side strip down through the corner hardware.
function resting(side, amount) {
  const chain=[{x:0,z:elevationZ(bindingHingeDepth(amount)),u:0}];
  let x=0;
  for(let i=0;i<SEGMENTS;i++) {
    const u=(i+1)/SEGMENTS;
    const thin=1-smooth(clamp(amount)/.18);
    // A few leaves drape over the binding lip and settle onto the board;
    // they are not a miniature rigid copy of the full page block.
    const lift=mix(8*bindingRise(amount,u),1.8*smooth(u/.2),thin);
    const z=elevationZ(layerDepth(amount,u)+lift);
    const dz=z-chain.at(-1).z,segment=PAGE_W/SEGMENTS;
    x+=Math.sqrt(Math.max(segment*segment*.25,segment*segment-dz*dz));
    // At a full block the endpaper rolls down into the hinge, with a steep
    // binding tangent that eases into the flat leaf, rather than a flat seam.
    // Zero horizontal tangent at the hinge, then unit tangent at the flat
    // leaf. Unlike a quarter-circle parametrization, this joins C1 smoothly.
    const radius=bindingRadius(amount),t=clamp(u/radius);
    const rolledX=u<radius?PAGE_W*radius*t*t*(2-t):PAGE_W*u;
    chain.push({x:side*mix(x,rolledX,bindingRoll(amount)),z,u});
  }
  // Equal material distances must occupy equal texture widths. The former
  // spline parameter sped up near the binding, locally magnifying lettering.
  const distances=[0];for(let i=1;i<chain.length;i++)distances.push(distances[i-1]+Math.hypot(chain[i].x-chain[i-1].x,chain[i].z-chain[i-1].z));
  const total=distances.at(-1);let index=0;
  return Array.from({length:SEGMENTS+1},(_,i)=>{
    const distance=total*i/SEGMENTS;while(index<SEGMENTS-1&&distances[index+1]<distance)index++;
    const t=(distance-distances[index])/(distances[index+1]-distances[index]||1);
    return{x:mix(chain[index].x,chain[index+1].x,t),z:mix(chain[index].z,chain[index+1].z,t),u:i/SEGMENTS,profileU:mix(chain[index].u,chain[index+1].u,t)};
  });
}

function turnChain(direction,progress) {
  const sourceSide=direction, targetSide=-direction;
  const sourceAmount=sourceSide<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
  const targetSpread=motion?.direction===direction?turnDestination():spread+direction;
  const targetAmount=targetSide<0?targetSpread/(spreadCount()-1):1-targetSpread/(spreadCount()-1);
  const from=resting(sourceSide,clamp(sourceAmount));
  const to=resting(targetSide,clamp(targetAmount));
  const theta=turnAngle(progress);
  // A curved chain peels away from its resting profile, traverses the spine,
  // then blends into the opposite stack in the last 35 percent of the turn.
  const startBlend=smooth(progress/.35),endBlend=smooth((progress-.65)/.35);
  const chain=[];let x=0,z= mix(from[0].z,to[0].z,progress);
  chain.push({x:0,z,u:0});
  for(let i=0;i<SEGMENTS;i++) {
    const u=(i+.5)/SEGMENTS;
    // The free edge lags behind the hinge. A broad C-shaped curl remains
    // visible at the upright position instead of collapsing into a flat line.
    const flex=.85*Math.sin(2*Math.PI*u)*Math.sin(theta);
    const a=theta+flex;
    x+=direction*Math.cos(a)*PAGE_W/SEGMENTS;
    z+=Math.sin(a)*PAGE_W/SEGMENTS;
    const index=i+1;
    chain.push({x:mix(mix(from[index].x,x,startBlend),to[index].x,endBlend),
      z:mix(mix(from[index].z,z,startBlend),to[index].z,endBlend),u:index/SEGMENTS});
  }
  return chain;
}

function turnAngle(progress) {
  // 15-degree peel, upright at halfway, through 160 degrees before settling.
  // C1 Hermite spans keep angular velocity continuous across these landmarks.
  const t=sine(progress),knots=[0,.5,.85,1],values=[15,90,160,180],slopes=[100,190,160,0];
  let i=t<.5?0:t<.85?1:2;
  const h=knots[i+1]-knots[i],u=(t-knots[i])/h;
  const angle=(2*u*u*u-3*u*u+1)*values[i]+(u*u*u-2*u*u+u)*h*slopes[i]
    +(-2*u*u*u+3*u*u)*values[i+1]+(u*u*u-u*u)*h*slopes[i+1];
  return angle*Math.PI/180;
}

function pagePerspective(v) {
  const depth=1/.87-1,scale=1/(1+depth*(1-v));
  return {scale,vertical:v*scale,hinge:scale*(1+depth*.5)};
}

function project(point,v) {
  // A homography foreshortens both the far-edge width and the texture rows.
  // The depth scale is shared by the paper and all of its underlying edges.
  const state=bookState();
  const elevation=pageElevation(point.z),perspective=pagePerspective(v);
  return {x:CX+state.shift*perspective.hinge+point.x*perspective.scale*bookWidthScale(),
    y:mix(TOP-elevation*.55,BOTTOM-elevation,perspective.vertical)-state.rise};
}

const openSpineScale=()=>{const ratio=ClosedBooks3D.thickness(pageCount)/ClosedBooks3D.thickness(28);return clamp(ratio<=1?ratio:Math.sqrt(ratio),.4,2);};
function bookState() {
  const fraction=clamp((spread+turningDistance()*sine(motion?.progress||0))/(spreadCount()-1));
  const coverShift=Math.sin((fraction-.5)*Math.PI)*7;
  const halfSpine=(512-BOARD_SEAM)/1024*940*openSpineScale();
  // At the first/last spread the text block attaches at the corresponding
  // edge of the flexible spine, rather than always at its center.
  const shift=(2*fraction-1)*halfSpine*.975+coverShift*Math.pow(BOARD_SEAM/512,3);
  return {fraction,rise:Math.sin(Math.PI*fraction)*17,shift,coverShift};
}

function coverPoint(x,y) {
  const s=bookState(),nearSpine=Math.pow(1-Math.abs(x-512)/512,3);
  const half=SPINE_END-512,relative=x-512,scale=openSpineScale();
  // Resize the flexible binding, translating rigid boards with its seams.
  // This is shared by artwork, hardware, cover hinges and inside inserts.
  const mapped=Math.abs(relative)<=half?relative*scale:Math.sign(relative)*(half*scale+(Math.abs(relative)-half)*bookWidthScale());
  const dx=mapped/1024*940;
  const point={x:CX+dx*(1-.05*(1-y/565))+s.coverShift*nearSpine,y:134+y/565*490-s.rise*nearSpine};
  if(x>BOARD_SEAM&&x<SPINE_END) {
    // A flexible spine between two rigid boards. The cubic bow has zero
    // slope at either seam, so neither end tears away from the cover edge.
    const u=(x-BOARD_SEAM)/(SPINE_END-BOARD_SEAM),v=y/565,bow=16*u*u*(1-u)*(1-u);
    point.x+=(1-2*s.fraction)*7*bow*Math.sin(Math.PI*v);
    point.y+=bow*(2+smooth((v-.75)/.25)*(5+pageThickness()*3));
  }
  return point;
}

function cover(rect={x:0,y:0,w:1024,h:565},texture=assets.frame) {
  ctx.save();
  const outline=[];
  for(let i=0;i<=30;i++)outline.push(coverPoint(rect.x+rect.w*i/30,rect.y));
  for(let i=30;i>=0;i--)outline.push(coverPoint(rect.x+rect.w*i/30,rect.y+rect.h));
  path(outline);ctx.clip();
  const rows=rect.h>100&&rect.x<SPINE_END&&rect.x+rect.w>BOARD_SEAM?8:1;
  for(let row=0;row<rows;row++)for(let i=0;i<30;i++) {
    const x0=rect.x+rect.w*i/30,x1=rect.x+rect.w*(i+1)/30;
    const y0=rect.y+rect.h*row/rows,y1=rect.y+rect.h*(row+1)/rows;
    quad(texture,[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],
      [coverPoint(x0,y0),coverPoint(x1,y0),coverPoint(x1,y1),coverPoint(x0,y1)]);
  }
  ctx.restore();
}

function path(points) {
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
}

// Affine texture mapping per triangle. Both page text and paper use these UVs.
function triangle(image,src,dst,target=ctx) {
  const ctx=target;
  const [s0,s1,s2]=src,[d0,d1,d2]=dst;
  const det=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);
  const area=(d1.x-d0.x)*(d2.y-d0.y)-(d1.y-d0.y)*(d2.x-d0.x);
  if(Math.abs(area)<.015) return;
  const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/det;
  const c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/det;
  const e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/det;
  const b=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/det;
  const d=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/det;
  const f=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/det;
  ctx.save();
  // Expand along edge normals rather than centroid rays. Skinny triangles
  // need a true horizontal overlap or their antialiased edges form stripes.
  const sign=Math.sign(area);
  const normals=dst.map((p,i)=>{const q=dst[(i+1)%3],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1;return{x:sign*dy/l,y:-sign*dx/l};});
  const clip=dst.map((p,i)=>{const a=normals[(i+2)%3],b=normals[i],den=Math.max(.001,1+a.x*b.x+a.y*b.y);return{x:p.x+(a.x+b.x)*.65/den,y:p.y+(a.y+b.y)*.65/den};});
  ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);clip.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
  ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,0,0);ctx.restore();
}

function quad(image,uv,points,target=ctx) {
  triangle(image,[uv[0],uv[1],uv[2]],[points[0],points[1],points[2]],target);
  triangle(image,[uv[0],uv[2],uv[3]],[points[0],points[2],points[3]],target);
}

// At a shared screen pixel, larger page-v is nearer the reading camera.
// Rasterize the actual projected sheet, including overlapping curl strips,
// rather than assuming a card drawn last must be in front of every strip.
let turningSheetDepth=null;
let turningSheetU=null;
const insertLayer=document.createElement('canvas');
const insertLayerContext=insertLayer.getContext('2d',{willReadFrequently:true});
function rasterDepthTriangle(points,depths,buffer,us=null,uBuffer=null) {
  const width=canvas.width,height=canvas.height;
  const a=points[0],b=points[1],c=points[2];
  const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(det)<.0001)return;
  const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
  const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
    const px=x+.5,py=y+.5;
    const u=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/det;
    const v=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/det,w=1-u-v;
    if(u<-.002||v<-.002||w<-.002)continue;
    const depth=u*depths[0]+v*depths[1]+w*depths[2],index=y*width+x;
    if(depth>buffer[index]){buffer[index]=depth;if(uBuffer)uBuffer[index]=u*us[0]+v*us[1]+w*us[2];}
  }
}
function rasterDepthQuad(points,depths,buffer,us=null,uBuffer=null) {
  const transform=ctx.getTransform();
  const p=points.map(p=>({x:transform.a*p.x+transform.c*p.y+transform.e,y:transform.b*p.x+transform.d*p.y+transform.f}));
  rasterDepthTriangle([p[0],p[1],p[2]],[depths[0],depths[1],depths[2]],buffer,us&&[us[0],us[1],us[2]],uBuffer);
  rasterDepthTriangle([p[0],p[2],p[3]],[depths[0],depths[2],depths[3]],buffer,us&&[us[0],us[2],us[3]],uBuffer);
}
function buildTurningSheetDepth(chain) {
  const buffer=new Float32Array(canvas.width*canvas.height);buffer.fill(-Infinity);
  turningSheetU=new Float32Array(buffer.length);turningSheetU.fill(NaN);
  for(let i=0;i<SEGMENTS;i++)for(let row=0;row<6;row++) {
    const v0=row/6,v1=(row+1)/6;
    rasterDepthQuad([project(chain[i],v0),project(chain[i+1],v0),project(chain[i+1],v1),project(chain[i],v1)],[v0,v0,v1,v1],buffer,[chain[i].u,chain[i+1].u,chain[i+1].u,chain[i].u],turningSheetU);
  }
  return buffer;
}

function mesh(chain,texture,side,extraShade=0,backTexture=null) {
  ctx.save();
  const silhouette=[...chain.map(p=>project(p,0)),...chain.slice().reverse().map(p=>project(p,1))];
  if(backTexture) {
    // A curled sheet projects overlapping front/back strips. An outline clip
    // cancels those opposite windings and cuts holes through the paper.
    // Build the union from consistently wound strip quads instead.
    ctx.beginPath();
    for(let i=0;i<SEGMENTS;i++) {
      const points=[project(chain[i],0),project(chain[i+1],0),project(chain[i+1],1),project(chain[i],1)];
      let area=0;points.forEach((p,j)=>{const q=points[(j+1)%4];area+=p.x*q.y-q.x*p.y;});
      if(area<0)points.reverse();
      ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
    }
    ctx.clip();
  } else {path(silhouette);ctx.clip();}
  // The silhouette includes the slanted hinge. A vertical half-book clip
  // would cut the binding edge off a correctly foreshortened resting leaf.
  for(let i=0;i<SEGMENTS;i++) {
    const a=chain[i],b=chain[i+1];
    const points=[project(a,0),project(b,0),project(b,1),project(a,1)];
    const isBack=backTexture&&(b.x-a.x)*side<0;
    const faceSide=isBack?-side:side,face=isBack?backTexture:texture;
    const tw=face.width,th=face.height;
    const u0=(faceSide<0?1-a.u:a.u)*tw,u1=(faceSide<0?1-b.u:b.u)*tw;
    const rows=backTexture||face.pageViewport||texture.width===PAGE_W&&texture.height===PAGE_H?6:1;
    ctx.imageSmoothingEnabled=face.width>PAGE_W&&!!face.pageViewport;
    for(let row=0;row<rows;row++){
      const v0=row/rows,v1=(row+1)/rows;
      quad(face,[{x:u0,y:v0*th},{x:u1,y:v0*th},{x:u1,y:v1*th},{x:u0,y:v1*th}],
        [project(a,v0),project(b,v0),project(b,v1),project(a,v1)]);
    }
  }
  if(extraShade>0) {
    const outline=[...chain.map(p=>project(p,0)),...chain.slice().reverse().map(p=>project(p,1))];
    ctx.fillStyle=`rgba(63,22,40,${extraShade})`;path(outline);ctx.fill();
  }
  ctx.restore();
}

function stacks(chain,side,amount,number=side>0?0:1) {
  const load=clamp(amount),depth=pageBlockDepth(load),state=bookState();
  if(depth<.0001)return;
  const foreEdge=side*(depth*.30+Math.max(0,side*(state.coverShift-state.shift)));
  const upper=(p,v)=>project(p,v*paperBottomV(number,side,p.u));
  const lower=(p,v)=>{
    const edgeV=v*paperBottomV(number,side,p.u),point=upper(p,v),perspective=pagePerspective(edgeV);
    return {x:point.x+foreEdge*p.u*perspective.scale,y:point.y+layerDepth(load,p.profileU??p.u)*mix(.55,1,perspective.vertical)};
  };
  // Surface leaves are contained inside the common block, not painted across
  // its front face. All layers use the same projected depth and outer corner.
  const leafCount=Math.min(5,Math.ceil(Math.max(0,load*pageCount/2-1)));
  for(let k=leafCount;k>=1;k--) {
    const fraction=k/(leafCount+1);
    const under=chain.map(p=>({...p,x:p.x+foreEdge*fraction*p.u,
      z:elevationZ(pageElevation(p.z)-layerDepth(load,p.profileU??p.u)*fraction)}));
    mesh(under,paperSurface(number+side*2*k),side,.05);
  }
  // The vertical fore-edge and bottom ribbon meet at the exact same point.
  // Keep the strip's painted curl out of its UV range; the spline supplies
  // the curl, while the flat painted rows supply the individual page layers.
  const edge=chain.at(-1),texture=assets.stack;
  // The sprite's dark end caps are not page layers. Crop them out on both
  // faces, and share the exact same UV column along their common corner.
  const stackUV={left:texture.width*.08,right:texture.width*.92,top:texture.height*.10,bottom:texture.height*.90};
  // Clip the two faces as one continuous L-shaped surface. Triangle overlap
  // must cover the shared corner, but never extend beyond the outer outline.
  ctx.save();path([...chain.map(p=>upper(p,1)),upper(edge,0),lower(edge,0),...chain.slice().reverse().map(p=>lower(p,1))]);ctx.clip();
  for(let row=0;row<6;row++){
    const v0=row/6,v1=(row+1)/6,u0=mix(stackUV.left,stackUV.right,v0),u1=mix(stackUV.left,stackUV.right,v1);
    ctx.fillStyle='#ad7d3d';path([upper(edge,v0),upper(edge,v1),lower(edge,v1),lower(edge,v0)]);ctx.fill();
    quad(assets.stack,[{x:u0,y:stackUV.top},{x:u1,y:stackUV.top},{x:u1,y:stackUV.bottom},{x:u0,y:stackUV.bottom}],
      [upper(edge,v0),upper(edge,v1),lower(edge,v1),lower(edge,v0)]);
  }
  for(let i=0;i<SEGMENTS;i++) {
    const a=chain[i],b=chain[i+1],pa=upper(a,1),pb=upper(b,1);
    const lowerA=lower(a,1),lowerB=lower(b,1);
    const u0=mix(stackUV.left,stackUV.right,a.u),u1=mix(stackUV.left,stackUV.right,b.u);
    ctx.fillStyle='#ad7d3d';path([pa,pb,lowerB,lowerA]);ctx.fill();
    quad(assets.stack,[{x:u0,y:stackUV.top},{x:u1,y:stackUV.top},{x:u1,y:stackUV.bottom},{x:u0,y:stackUV.bottom}],
      [pa,pb,lowerB,lowerA]);
  }
  ctx.restore();
}

function castShadow(turning,receiving) {
  const targetSide=-motion.direction;
  const receiverSide=Math.sign(receiving.at(-1).x);
  const fade=receiverSide===targetSide?smooth((motion.progress-.5)/.13):1-smooth(motion.progress/.5);
  if(fade===0)return;
  const alphas=[];
  for(let i=0;i<SEGMENTS;i++) {
    const a=receiving[i],b=receiving[i+1];
    // Trace the turning chain in screen space to locate the shadow's footprint.
    let closest=null;
    for(let j=0;j<SEGMENTS;j++) {
      const a0=turning[j],b0=turning[j+1];
      if(a.x<Math.min(a0.x,b0.x)||a.x>Math.max(a0.x,b0.x))continue;
      const u=(a.x-a0.x)/(b0.x-a0.x||1e-6);
      const candidate={x:a.x,z:mix(a0.z,b0.z,u)};
      if(!closest||candidate.z>closest.z)closest=candidate;
    }
    if(!closest){alphas.push(0);continue;}
    const gap=Math.abs(closest.z-a.z);
    alphas.push(.38*Math.exp(-gap/95)*fade);
  }
  // One gradient over the chain avoids a visible seam at every shadow segment.
  const gradient=ctx.createLinearGradient(project(receiving[0],0).x,0,project(receiving.at(-1),0).x,0);
  alphas.forEach((a,i)=>gradient.addColorStop(i/SEGMENTS,`rgba(62,21,35,${a})`));
  gradient.addColorStop(1,`rgba(62,21,35,${alphas.at(-1)||0})`);
  path([...receiving.map(p=>project(p,0)),...receiving.slice().reverse().map(p=>project(p,1))]);ctx.fillStyle=gradient;ctx.fill();
}

function draw() {
  if(!loaded)return;
  updateBookResponse();
  tocHitAreas=[];
  turningSheetDepth=null;
  ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;
  if(motion?.gutterContacts?.length)updateGutterContacts();
  if(coverMotion?.bridge){coverMotion.bridge.draw();return;}
  if(closed3DActive()){drawClosed3D();return;}
  if(spineView&&!spineMotion){drawSpineView();return;}
  ctx.save();ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=12;
  ctx.beginPath();ctx.ellipse(500,587,(closedEdge?220:430)*bookWidthScale(),27,0,0,Math.PI*2);ctx.fill();ctx.restore();
  const spineAmount=spineMotion?mix(spineMotion.from,spineMotion.to,sine(spineMotion.progress)):0;
  ctx.save();
  if(spineMotion){const squash=1-.96*spineAmount;ctx.translate(CX,0);ctx.scale(squash,1);ctx.translate(-CX,0);}
  if(coverMotion||closedEdge){drawCoverScene();ctx.restore();if(spineMotion)drawSpineOverlay(spineAmount);return;}
  // Keep the cover a separate sprite. No finished open-book image is used.
  cover();itemHits=[];
  const p=motion?motion.progress:0;
  const fractional=spread+turningDistance()*sine(p);
  const left=resting(-1,clamp(fractional/(spreadCount()-1)));
  const right=resting(1,clamp(1-fractional/(spreadCount()-1)));
  let leftNumber=spread*2-1,rightNumber=spread*2;
  if(motion) {
    if(motion.direction===1) rightNumber=turnDestination()*2;
    else leftNumber=turnDestination()*2-1;
  }
  // Draw a board only where its cover lining is exposed. The opposite side is
  // already occupied by live paper; showing the full board beneath it leaks
  // its pink lining through the torn lower edge of the page.
  if(leftNumber<0)drawInside(-1);
  if(rightNumber>=pageCount)drawInside(1);
  if(leftNumber<0)restingItems(resting(-1,1),-1,-1,'over');
  if(rightNumber>=pageCount)restingItems(resting(1,1),pageCount,1,'over');
  if(leftNumber>=0)stacks(left,-1,clamp(fractional/(spreadCount()-1)),leftNumber);
  if(rightNumber<pageCount)stacks(right,1,clamp(1-fractional/(spreadCount()-1)),rightNumber);
  paintHiddenEdgeBookmarks(left,right,leftNumber,rightNumber);
  if(leftNumber>=0){restingItems(left,leftNumber,-1,'under');mesh(left,litViewport(leftNumber,left,-1),-1);registerTocAreas(leftNumber,left,-1);restingItems(left,leftNumber,-1,'over');}
  if(rightNumber<pageCount){restingItems(right,rightNumber,1,'under');mesh(right,litViewport(rightNumber,right,1),1);registerTocAreas(rightNumber,right,1);restingItems(right,rightNumber,1,'over');}
  if(motion) {
    const chain=turnChain(motion.direction,p);
    castShadow(chain,left);castShadow(chain,right);
    const frontNumber=motion.direction===1?spread*2:spread*2-1;
    const backNumber=motion.direction===1?turnDestination()*2-1:turnDestination()*2;
    if(Math.abs(turningDistance())===1&&(itemsOnPage(frontNumber).length||itemsOnPage(backNumber).length))turningSheetDepth=buildTurningSheetDepth(chain);
    const shade=.065*Math.sin(Math.PI*p);
    turningItems(chain,'under');
    mesh(chain,litViewport(frontNumber,chain,motion.direction,shade),motion.direction,0,
      litViewport(backNumber,chain,-motion.direction,shade));
    // The parchment sprite owns its torn alpha edge. An extra straight
    // outline here fills transparent pixels with a conspicuous pale seam.
    turningItems(chain,'over');
  }
  // Cover's lower rim encloses the page stack, but must not cover the inside
  // board's own corner guard. Those guards are already part of the inside-
  // cover sprite and meet its bottom rail cleanly when left untouched.
  if(leftNumber<0)cover({x:512,y:530,w:512,h:35});
  else if(rightNumber>=pageCount)cover({x:0,y:530,w:512,h:35});
  else cover({x:0,y:530,w:1024,h:35});
  // The lower cover rail overlaps the inside-board corner artwork. Restore
  // the clipped corner guards after the page block and rail have been drawn.
  if(leftNumber<0)redrawInsideCorner(-1);
  if(rightNumber>=pageCount)redrawInsideCorner(1);
  // The binding cap belongs behind the page fans. It was already drawn with
  // the spine; repainting any rectangle here cuts square ends into the fans.
  paintFloatingInserts();
  paintInspectionShadow();
  ctx.restore();
  if(spineMotion)drawSpineOverlay(spineAmount);
  if(typeof paintArtRegion==='function')paintArtRegion();
}

function paintFloatingInserts() {
  for(const item of allInserts()) {
    const state=itemState(item);
    if(!state.outside||itemDrag?.item===item||inspection?.item===item)continue;
    paintItem(item,state.back,{x:state.outsideX,y:state.outsideY},1,state.rotation,true,null,null,null);
  }
  // Dragged cards deliberately render after the paper, clasps, and cover lip:
  // the hand is holding them above the book, even while crossing its spine.
  if(itemDrag) {
    const state=itemState(itemDrag.item);
    if(state.outside)paintItem(itemDrag.item,state.back,{x:itemDrag.x,y:itemDrag.y},1,state.rotation,false,itemDrag.pageNumber,null,null);
    else {
      const side=state.pageNumber%2===0?1:-1;
      const amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
      paintPageItem(itemDrag.item,resting(side,amount),side,state.pageNumber);
    }
  }
}

function drawSpineOverlay(amount=1) {
  ctx.save();ctx.globalAlpha=amount;
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#080b0c');shade.addColorStop(.52,'#111719');shade.addColorStop(1,'#080b0c');
  ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  drawSpineView();ctx.restore();
}

const opaqueBoundsCache=new WeakMap();
let spineTitleCache=null;

function opaqueBounds(source) {
  if(opaqueBoundsCache.has(source))return opaqueBoundsCache.get(source);
  const surface=spriteSurface(source.width,source.height),p=surface.getContext('2d');p.drawImage(source,0,0);
  const pixels=p.getImageData(0,0,source.width,source.height).data;
  let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>180){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const bounds={left,top,right:right+1,bottom:bottom+1};opaqueBoundsCache.set(source,bounds);return bounds;
}

function titledSpine(source=assets.spine,name=bookName,palette=bookContent.palette,ornaments=effectiveSpineOrnaments(bookContent)) {
  const title=name.trim()||'Untitled book';
  const ornamentKey=JSON.stringify(ornaments);
  if(spineTitleCache?.source===source&&spineTitleCache.title===title&&spineTitleCache.ornamentKey===ornamentKey)return spineTitleCache.texture;
  const texture=spriteSurface(260,source.height),p=texture.getContext('2d');
  p.imageSmoothingEnabled=false;p.drawImage(source,380,0,260,source.height,0,0,260,texture.height);
  const original=spriteSurface(texture.width,texture.height);original.getContext('2d').drawImage(texture,0,0);
  // Retain the two end bands. Rebuild the entire middle as one continuous
  // leather panel, removing the two internal raised bands and old dividers.
  p.clearRect(0,300,260,890);
  p.save();p.beginPath();p.rect(0,300,260,890);p.clip();
  for(let y=300;y<1190;y+=56)p.drawImage(original,0,130,260,56,0,y,260,56);
  p.beginPath();p.rect(47,300,166,890);p.clip();
  for(let y=300;y<1190;y+=96)for(let x=47;x<213;x+=82)p.drawImage(original,94,95,82,96,x,y,82,96);
  p.restore();
  p.strokeStyle=palette.metal==='silver'?'#dce6ee':'#f0cd82';p.globalAlpha=.50;p.lineWidth=3;
  p.beginPath();p.moveTo(43,317);p.lineTo(43,1173);p.moveTo(217,317);p.lineTo(217,1173);p.stroke();p.globalAlpha=1;
  // Extract the existing emblem with its dark pixel outline. The surrounding
  // leather remains transparent, so it can be moved to both end panels.
  const icon=spriteSurface(100,134),ip=icon.getContext('2d');ip.drawImage(original,82,336,100,134,0,0,100,134);
  const frame=ip.getImageData(0,0,100,134),mask=materialMasks.get(baseAssets.spine);
  for(let y=0;y<134;y++)for(let x=0;x<100;x++){
    let marked=false;
    for(let dy=-3;dy<=3&&!marked;dy++)for(let dx=-3;dx<=3;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=100||yy<0||yy>=134)continue;
      if(mask[((336+yy)*baseAssets.spine.width+380+82+xx)*2+1]>100){marked=true;break;}
    }
    if(!marked)frame.data[(y*100+x)*4+3]=0;
  }
  ip.putImageData(frame,0,0);
  if(!drawSpineOrnament(p,ornaments.top,80,84,100,134,palette))p.drawImage(icon,80,84);
  if(!drawSpineOrnament(p,ornaments.bottom,80,1272,100,134,palette,ornaments.flipBottom)){p.save();p.translate(130,1339);if(ornaments.flipBottom)p.rotate(Math.PI);p.drawImage(icon,-50,-67);p.restore();}
  p.save();p.translate(130,745);p.rotate(-Math.PI/2);p.textAlign='center';p.textBaseline='middle';
  let size=110;
  do {p.font=`bold ${size}px Georgia`;if(p.measureText(title).width<=800)break;size--;}while(size>18);
  p.strokeStyle=coverInk(.24,palette.outside);p.lineWidth=4;p.lineJoin='round';p.fillStyle=palette.metal==='silver'?'#dce6ee':'#f0cd82';
  p.strokeText(title,0,0,800);p.fillText(title,0,0,800);
  p.restore();spineTitleCache={source,title,ornamentKey,texture};return texture;
}

function drawSpineView() {
  // The spine, board, and bevel share one camera and the same hinge vertices.
  const height=430,width=310,depth=ClosedBooks3D.thickness(pageCount),yaw=.43,pitch=.055,focal=1400;
  const spine=titledSpine(),spineUV=opaqueBounds(spine),boardUV=opaqueBounds(assets.front);
  const camera=(x,y,z)=>{
    const horizontal=x*Math.sin(yaw)+z*Math.cos(yaw),distance=-x*Math.cos(yaw)+z*Math.sin(yaw);
    const vertical=(y-height/2)*Math.cos(pitch)+distance*Math.sin(pitch);
    const forward=distance*Math.cos(pitch)-(y-height/2)*Math.sin(pitch),scale=focal/(focal-forward);
    return {x:horizontal*scale,y:vertical*scale};
  };
  const spinePoint=(u,v)=>camera(-depth*.22*Math.sin(Math.PI*u),v*height,-depth*.5*Math.cos(Math.PI*u));
  const board=[camera(0,0,depth/2),camera(width,0,depth/2),camera(width,height,depth/2),camera(0,height,depth/2)];
  const silhouette=[...board];for(let i=0;i<=18;i++){silhouette.push(spinePoint(i/18,0),spinePoint(i/18,1));}
  const minX=Math.min(...silhouette.map(p=>p.x)),maxX=Math.max(...silhouette.map(p=>p.x));
  const minY=Math.min(...silhouette.map(p=>p.y)),maxY=Math.max(...silhouette.map(p=>p.y));
  const scale=430/(maxY-minY),offsetX=CX-(minX+maxX)*scale/2,offsetY=116-minY*scale;
  const screen=p=>({x:p.x*scale+offsetX,y:p.y*scale+offsetY}),face=board.map(screen);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.42)';ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=13;
  ctx.beginPath();ctx.ellipse(CX,558,(maxX-minX)*scale*.61,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // Both boards belong to the same camera. The far board is mostly hidden by
  // the front board and spine, but its head/tail edges complete the binding.
  const farBoard=[camera(0,0,-depth/2),camera(width,0,-depth/2),camera(width,height,-depth/2),camera(0,height,-depth/2)].map(screen);
  const farUV=opaqueBounds(assets.back);
  quad(assets.back,[{x:farUV.left,y:farUV.top},{x:farUV.right,y:farUV.top},
    {x:farUV.right,y:farUV.bottom},{x:farUV.left,y:farUV.bottom}],farBoard);
  // A board has a narrow leather bevel, not a second cover-sized backing slab.
  const bevel=[camera(0,0,depth/2-5),camera(width,0,depth/2-5),board[1],board[0]].map(screen);
  ctx.fillStyle=coverInk(.55);path(bevel);ctx.fill();
  quad(assets.front,[{x:boardUV.left,y:boardUV.top},{x:boardUV.right,y:boardUV.top},
    {x:boardUV.right,y:boardUV.bottom},{x:boardUV.left,y:boardUV.bottom}],face);
  paintCoverCustomization('front',face);
  for(let row=0;row<8;row++)for(let column=0;column<18;column++) {
    const u0=column/18,u1=(column+1)/18,v0=row/8,v1=(row+1)/8;
    const points=[spinePoint(u0,v0),spinePoint(u1,v0),spinePoint(u1,v1),spinePoint(u0,v1)].map(screen);
    const x0=mix(spineUV.left,spineUV.right,u0),x1=mix(spineUV.left,spineUV.right,u1);
    const y0=mix(spineUV.top,spineUV.bottom,v0),y1=mix(spineUV.top,spineUV.bottom,v1);
    quad(spine,[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],points);
    const shade=.14*(1-Math.sin(Math.PI*(u0+u1)/2));
    ctx.fillStyle=`rgba(0,0,0,${shade})`;path(points);ctx.fill();
  }
  ctx.fillStyle='#c8ad7c';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText(`SPINE VIEW · ${pageCount} PAGES`,CX,82);
  ctx.restore();
}

function drawInside(side) {
  // The exposed lining is the same board already used beneath the paper.
  // Reuse that plane instead of swapping in a second framed cover image.
  cover({x:side<0?0:512,y:0,w:512,h:565});
}

function pageThickness() {
  // Page-count thickness is bounded: the minimum book still has a visible
  // leaf block, while the maximum grows substantially without doubling the
  // cover geometry or causing the lower corners to protrude.
  return .34+((Math.min(pageCount,56)-8)/48)*1.18+Math.log1p(Math.max(0,pageCount-56)/160)*.12;
}

function redrawInsideCorner(side) {
  cover({x:side<0?0:912,y:400,w:112,h:165},assets.hardware);
}

function closedBookLayers(points,amount) {
  const visibility=smooth((amount-.72)/.28);
  const depth=(12+22*pageThickness())*visibility;
  const farBoard=points.map(p=>({x:p.x,y:p.y+depth+5*visibility}));
  // The page block is seated between two parallel boards. Its lower edge is
  // the same line as the upper edge, translated in depth, never a wedge.
  const a=points[3].x<points[2].x?points[3]:points[2];
  const b=points[3].x<points[2].x?points[2]:points[3];
  const inset=Math.min(.08,12/Math.max(1,b.x-a.x));
  const left={x:mix(a.x,b.x,inset),y:mix(a.y,b.y,inset)-2*visibility};
  const right={x:mix(a.x,b.x,1-inset),y:mix(a.y,b.y,1-inset)-2*visibility};
  return {visibility,depth,farBoard,paper:[left,right,{x:right.x,y:right.y+depth},{x:left.x,y:left.y+depth}]};
}

function drawCoverScene() {
  const edge=coverMotion?coverMotion.edge:closedFlipMotion?(closedFlipMotion.progress<.5?closedFlipMotion.from:closedFlipMotion.to):closedEdge;
  const amount=coverMotion?coverMotion.amount:1;
  const depthAlpha=smooth((amount-.72)/.28),closedLift=20*depthAlpha;
  const side=edge==='front'?-1:1,receiving=-side;
  ctx.save();
  if(closedFlipMotion){const squash=Math.max(.025,Math.abs(Math.cos(Math.PI*closedFlipMotion.progress)));ctx.translate(CX,0);ctx.scale(squash,1);ctx.translate(-CX,0);}
  const seam=side<0?BOARD_SEAM:SPINE_END,targetSeam=side<0?SPINE_END:BOARD_SEAM;
  const targetOuter=side<0?1024:0;
  const closedCenter=(coverPoint(targetSeam,565).x+coverPoint(targetOuter,565).x)/2;
  itemHits=[];ctx.save();ctx.translate((CX-closedCenter)*amount,-closedLift);
  ctx.save();ctx.globalAlpha=1-smooth((amount-.95)/.05);
  cover({x:receiving<0?0:512,y:0,w:512,h:565});drawInside(receiving);
  cover({x:BOARD_SEAM,y:0,w:SPINE_END-BOARD_SEAM,h:565});
  const coverPage=edge==='front'?-1:pageCount;
  restingItems(resting(receiving,1),coverPage,receiving,'over');
  const chain=resting(receiving,1),number=edge==='front'?0:pageCount-1;
  stacks(chain,receiving,1);mesh(chain,litViewport(number,chain,receiving),receiving);
  if(amount<.95)restingItems(chain,number,receiving,'over');
  ctx.restore();
  const angle=Math.PI*amount,lift=115*Math.sin(angle),hinge=mix(seam,targetSeam,amount);
  const hingeTop=coverPoint(hinge,0),hingeBottom=coverPoint(hinge,565);
  const openOuter=side<0?0:1024;
  const topWidth=Math.abs(coverPoint(openOuter,0).x-coverPoint(seam,0).x);
  const bottomWidth=Math.abs(coverPoint(openOuter,565).x-coverPoint(seam,565).x);
  const points=[hingeTop,{x:hingeTop.x+side*topWidth*Math.cos(angle),y:134-lift},
    {x:hingeBottom.x+side*bottomWidth*Math.cos(angle),y:624-lift},hingeBottom];
  const layers=closedBookLayers(points,amount);
  if(depthAlpha>0) {
    ctx.save();ctx.globalAlpha=depthAlpha;
    const farImage=edge==='front'?assets.back:assets.front,bounds=opaqueBounds(farImage);
    quad(farImage,[{x:bounds.left,y:bounds.top},{x:bounds.right,y:bounds.top},
      {x:bounds.right,y:bounds.bottom},{x:bounds.left,y:bounds.bottom}],layers.farBoard);
    ctx.fillStyle='#d9a45d';path(layers.paper);ctx.fill();
    const paperBounds=opaqueBounds(assets.stack),paperInset=assets.stack.width*.018;
    quad(assets.stack,[{x:paperBounds.left+paperInset,y:paperBounds.top+3},{x:paperBounds.right-paperInset,y:paperBounds.top+3},
      {x:paperBounds.right-paperInset,y:paperBounds.bottom-3},{x:paperBounds.left+paperInset,y:paperBounds.bottom-3}],
      layers.paper);
    ctx.restore();
  }
  const outside=amount>=.5,faceSide=outside?-side:side;
  const image=outside?(edge==='front'?assets.front:assets.back):(edge==='front'?assets.insideFront:assets.insideBack);
  const bounds=outside?opaqueBounds(image):{left:0,top:0,right:image.width,bottom:image.height};
  const minU=bounds.left,maxU=bounds.right;
  const u0=faceSide<0?maxU:minU,u1=faceSide<0?minU:maxU;
  if(outside) {
    const width=(10+pageCount*.15)*smooth((amount-.5)/.5),spine=assets.closedSpine;
    const top={x:points[0].x+side*width,y:points[0].y},bottom={x:points[3].x+side*width,y:points[3].y};
    quad(spine,[{x:side<0?0:spine.width,y:0},{x:side<0?spine.width:0,y:0},
      {x:side<0?spine.width:0,y:spine.height},{x:side<0?0:spine.width,y:spine.height}],
      [top,points[0],points[3],bottom]);
  }
  quad(image,[{x:u0,y:bounds.top},{x:u1,y:bounds.top},{x:u1,y:bounds.bottom},{x:u0,y:bounds.bottom}],points);
  if(outside)paintCoverCustomization(edge,points);
  ctx.restore();
  ctx.restore();
}

function bilerp(points,u,v) {
  const top={x:mix(points[0].x,points[1].x,u),y:mix(points[0].y,points[1].y,u)};
  const bottom={x:mix(points[3].x,points[2].x,u),y:mix(points[3].y,points[2].y,u)};
  return {x:mix(top.x,bottom.x,v),y:mix(top.y,bottom.y,v)};
}

function metalInk(){return bookContent.palette.metal==='silver'?'#dce6ee':'#f0cd82';}
function coverInk(shade=1,color=bookContent.palette.outside) {
  return `rgb(${[1,3,5].map(index=>Math.round(clamp(parseInt(color.slice(index,index+2),16)*shade,0,255))).join(',')})`;
}

function paintCoverCustomization(edge,points) {
  const cover=coverContent(edge),placement=cover.placement||'center';
  const title=String(cover.title||'').trim();
  const symbol=Number.isInteger(cover.symbol)?cover.symbol:-1;
  const titleV=placement==='top'?.25:placement==='bottom'?.76:.46;
  if(symbol>=0&&symbol<36) {
    const cell=assets.symbols.width/6,col=symbol%6,row=Math.floor(symbol/6),pad=cell*.045;
    const u0=.34,u1=.66,v0=title? (placement==='center'?.67:.47):.34,v1=title? v0+.25:.66;
    quad(assets.symbols,[{x:col*cell+pad,y:row*cell+pad},{x:(col+1)*cell-pad,y:row*cell+pad},
      {x:(col+1)*cell-pad,y:(row+1)*cell-pad},{x:col*cell+pad,y:(row+1)*cell-pad}],
      [bilerp(points,u0,v0),bilerp(points,u1,v0),bilerp(points,u1,v1),bilerp(points,u0,v1)]);
  }
  if(!title)return;
  const lettering=document.createElement('canvas');lettering.width=400;lettering.height=84;
  const pen=lettering.getContext('2d');
  const families={serif:'Georgia, serif',pixel:'monospace',script:'cursive'};
  let size=cover.font==='pixel'?31:cover.font==='script'?36:34;
  pen.textAlign='center';pen.textBaseline='middle';
  do {pen.font=`${size}px ${families[cover.font]||families.serif}`;if(pen.measureText(title).width<=370)break;size--;} while(size>14);
  pen.lineJoin='round';pen.strokeStyle='rgba(46,21,23,.95)';pen.lineWidth=4;pen.strokeText(title,200,43,370);
  pen.fillStyle=metalInk();pen.shadowColor=bookContent.palette.metal==='silver'?'#414a55':'#6d351e';pen.shadowBlur=4;pen.fillText(title,200,43,370);
  const v0=titleV-.085,v1=titleV+.085,u0=.13,u1=.87;
  quad(lettering,[{x:0,y:0},{x:400,y:0},{x:400,y:84},{x:0,y:84}],
    [bilerp(points,u0,v0),bilerp(points,u1,v0),bilerp(points,u1,v1),bilerp(points,u0,v1)]);
}

function animateCover(edge,closing,sourceScene=null) {
  if(motion||coverMotion||closedFlipMotion||spineMotion||inspection||!loaded)return false;
  return startCoverBridge(edge,closing,sourceScene);
}

function flipClosedBook() {
  if(!closedEdge||coverMotion||closedFlipMotion||spineView||spineMotion)return false;
  if(closed3DActive()){
    closedEdge=closedEdge==='front'?'back':'front';spread=closedEdge==='front'?0:spreadCount()-1;
    updateControls();draw();return true;
  }
  const from=closedEdge,to=from==='front'?'back':'front',start=performance.now(),duration=460;
  closedFlipMotion={from,to,progress:0};updateControls();
  const frame=now=>{
    if(!closedFlipMotion)return;
    closedFlipMotion.progress=clamp((now-start)/duration);draw();
    if(closedFlipMotion.progress<1)raf=requestAnimationFrame(frame);
    else{closedEdge=to;spread=to==='front'?0:spreadCount()-1;closedFlipMotion=null;raf=0;updateControls();draw();}
  };
  raf=requestAnimationFrame(frame);return true;
}

function animateSpineView() {
  if(motion||coverMotion||closedFlipMotion||spineMotion||inspection||!loaded)return false;
  stopAuto();
  const from=spineView?1:0,to=1-from,start=performance.now(),duration=520;
  spineMotion={from,to,progress:0};updateControls();
  const frame=now=>{
    if(!spineMotion)return;
    spineMotion.progress=clamp((now-start)/duration);draw();
    if(spineMotion.progress<1)raf=requestAnimationFrame(frame);
    else{spineView=to===1;spineMotion=null;raf=0;updateControls();draw();}
  };
  raf=requestAnimationFrame(frame);return true;
}

const keepsakes = [
  {sheet:0,title:'The ferryman’s pass',front:'A passage across the blackwater. The ink is still damp.',back:'On the reverse: “One passenger. No return promised.”',type:'pass'},
  {sheet:3,title:'A rubbing of the mill key',front:'Graphite pressed into paper. The teeth form an unfamiliar pattern.',back:'“Try the door beneath the wheel.” Someone underlined it twice.',type:'key'},
  {sheet:6,title:'A pressed reed',front:'A reed from the bank where the lanterns appeared.',back:'A small note: “It kept its colour after the water went black.”',type:'reed'},
  {sheet:9,title:'The ferryman’s second pass',front:'The same seal, but a different hand.',back:'“You have already crossed.”',type:'pass'},
  {sheet:12,title:'The last key rubbing',front:'The teeth match the marks in the old ledger.',back:'“Bring back what you borrowed.”',type:'key'},
  {sheet:13,title:'A feather from the northbank',front:'A soft russet feather, bent as if it rode the river wind.',back:'The quill is dark on this side, with a pale mark near its tip.',type:'feather'}
];
const customInserts=[];
let nextInsertId=1;
const allInserts=()=>[...keepsakes,...customInserts];
const itemTextures=new Map();
const itemMounts=new Map(keepsakes.map(item=>[item.sheet,{
  taped:false,anchorPage:null,frontPage:item.sheet*2,pageNumber:item.sheet*2,
  back:false,under:false,outside:false,outsideX:500,outsideY:130,u:.64,v:.82,rotation:-.07
}]));
const mountedTextures=new Map();
function itemState(item){return motion?.gutterContacts?.find(contact=>contact.item===item)?.pose||itemMounts.get(item.sheet);}
function resetSessionInserts(){
  for(const state of itemMounts.values())Object.assign(state,{outside:false,pageNumber:99999,taped:false,anchorPage:null});
  if(!bookContent.starterId)for(const item of keepsakes)Object.assign(itemMounts.get(item.sheet),{frontPage:item.sheet*2,pageNumber:item.sheet*2,back:false,under:false,u:.64,v:.82,rotation:-.07});
}
function itemsOnPage(number) {
  if(number < -1 || number > pageCount)return [];
  return allInserts().filter(item=>{
    const state=itemState(item);
    return state.taped?state.anchorPage===number:!state.outside&&state.pageNumber===number;
  });
}
function sheetItem(number){return itemsOnPage(number)[0];}

function itemPose(item,number) {
  const state=itemState(item),back=!!state.back;
  // Loose cards rest on the exposed face. They are carried by the turning
  // surface, not tucked underneath it or offset after landing.
  return {u:clamp(state.u,.08,.94),v:state.v,rotation:state.rotation,back,under:false};
}

function itemTexture(item,back) {
  const key=item.sheet+':'+back;if(itemTextures.has(key))return itemTextures.get(key);
  const c=document.createElement('canvas');c.width=180;c.height=136;
  const p=c.getContext('2d');p.imageSmoothingEnabled=false;
  if(item.type!=='feather')p.drawImage(assets.c,0,0,c.width,c.height);
  p.fillStyle='#6e402b';p.strokeStyle='#79422d';p.lineWidth=2;
  p.font='bold 11px monospace';
  if(item.type==='feather') {
    p.save();p.translate(90,68);if(back)p.scale(-1,1);p.rotate(.08);
    p.drawImage(assets.feather,-61,-61,122,122);p.restore();
  } else if(back) {
    ink(p,'FOR THE KEEPER',20,23,1.1);
    const lines=item.back.replace(/[“”]/g,'').split(' ');let line='',y=49;
    p.font='italic 12px Georgia';
    lines.forEach(word=>{if((line+word).length>23){ink(p,line,20,y,1);line='';y+=14;}line+=word+' ';});ink(p,line,20,y,1);
    p.strokeStyle='#914a38';p.beginPath();p.moveTo(23,112);p.lineTo(142,106);p.stroke();
  } else if(item.type==='pass') {
    ink(p,'BLACKWATER FERRY',18,23,1);ink(p,'ONE PASSAGE',18,40,1);
    p.strokeRect(17,15,145,100);p.beginPath();p.moveTo(32,80);p.lineTo(130,80);p.lineTo(111,94);p.lineTo(48,94);p.closePath();p.stroke();
    p.beginPath();p.moveTo(80,80);p.lineTo(80,48);p.lineTo(105,72);p.lineTo(80,72);p.stroke();
    p.fillStyle='#913e38';p.fillRect(127,85,25,23);p.fillStyle='#e2ad66';ink(p,'VII',131,92,1);
  } else if(item.type==='note') {
    ink(p,'LOOSE NOTE',18,23,1.1);p.strokeStyle='#8c633e';p.strokeRect(14,13,150,108);
    p.beginPath();p.moveTo(24,54);p.lineTo(149,54);p.moveTo(24,70);p.lineTo(128,70);p.moveTo(24,86);p.lineTo(140,86);p.stroke();
    ink(p,'?',142,108,1.4);
  } else if(item.type==='key') {
    ink(p,'MILL / RUBBING',18,23,1.1);p.strokeStyle='#554738';p.lineWidth=4;
    p.beginPath();p.arc(48,67,15,0,Math.PI*2);p.moveTo(62,67);p.lineTo(142,67);p.lineTo(142,86);p.moveTo(128,68);p.lineTo(128,80);p.stroke();
    ink(p,'the door below',31,105,1);
  } else {
    ink(p,'BANK / NORTH',20,23,1.1);p.strokeStyle='#596344';p.lineWidth=3;
    p.beginPath();p.moveTo(61,115);p.lineTo(104,37);p.moveTo(76,89);p.lineTo(46,72);p.moveTo(88,66);p.lineTo(124,57);p.stroke();
    p.fillStyle='#7e6440';for(let i=0;i<6;i++)p.fillRect(98+i,34+i*4,10,8);
  }
  itemTextures.set(key,c);return c;
}

function insertTapeLayout(item){
  const bounds=opaqueBounds(itemTexture(item,false)),left=14+bounds.left,right=14+bounds.right,top=14+bounds.top,bottom=14+bounds.bottom,cx=(left+right)/2,cy=(top+bottom)/2;
  const mode=Math.abs(item.sheet)%3;
  if(item.type==='feather')return[{x:cx-9,y:cy-20,angle:.24,length:Math.min(58,right-left+24)},{x:cx+5,y:cy+25,angle:-.18,length:Math.min(52,right-left+20)}];
  if(mode===0)return[{x:left+3,y:cy-15,angle:-.14,length:37},{x:right-3,y:cy+15,angle:.18,length:37}];
  if(mode===1)return[{x:cx-30,y:top+3,angle:.85,length:40},{x:cx+30,y:bottom-3,angle:.85,length:40}];
  return[{x:left+10,y:top+10,angle:-.7,length:42},{x:right-10,y:bottom-10,angle:-.7,length:42}];
}
function mountedTexture(item,back=false,tapedOverride=null) {
  const taped=tapedOverride??itemState(item).taped,key=item.sheet+':'+back+':'+taped;
  if(mountedTextures.has(key))return mountedTextures.get(key);
  const c=document.createElement('canvas');c.width=208;c.height=164;
  const p=c.getContext('2d');p.imageSmoothingEnabled=false;
  p.drawImage(itemTexture(item,back),14,14,180,136);
  if(taped)for(const strip of insertTapeLayout(item)){
    p.save();p.translate(strip.x,strip.y);p.rotate(strip.angle);const half=strip.length/2;
    p.beginPath();p.moveTo(-half,-6);p.lineTo(-half+3,-7);p.lineTo(half-2,-6);p.lineTo(half,-3);p.lineTo(half-2,0);p.lineTo(half,4);p.lineTo(half-3,7);p.lineTo(-half+1,6);p.lineTo(-half,3);p.lineTo(-half+2,0);p.closePath();
    p.shadowColor='#48301744';p.shadowBlur=1;p.shadowOffsetY=1;p.fillStyle='rgba(233,211,158,.57)';p.fill();p.shadowColor='transparent';
    p.strokeStyle='rgba(255,247,211,.5)';p.lineWidth=1;p.stroke();p.fillStyle='rgba(255,249,224,.2)';p.fillRect(-half+3,-4,strip.length-6,2);
    p.strokeStyle='rgba(129,100,57,.15)';p.beginPath();p.moveTo(-half+4,3);p.lineTo(half-4,4);p.stroke();p.restore();
  }
  mountedTextures.set(key,c);return c;
}

function sampleChain(chain,u) {
  const f=clamp(u)*SEGMENTS,i=Math.min(SEGMENTS-1,Math.floor(f)),t=f-i;
  return {x:mix(chain[i].x,chain[i+1].x,t),z:mix(chain[i].z,chain[i+1].z,t),u};
}

function paintItem(item,back,position,scale=1,rotation=-.08,hit=false,pageNumber=null,underY=null,side=null) {
  if(Math.abs(scale)<.003)return;
  const itemSize=item.type==='feather'?3:1,width=128*itemSize,height=96*itemSize;
  ctx.save();
  if(side!==null) {
    ctx.beginPath();ctx.rect(side>0?CX:0,TOP-90,side>0?W-CX:CX,H+180);ctx.clip();
  }
  ctx.translate(position.x,position.y);ctx.rotate(rotation);ctx.scale(scale,1);
  ctx.shadowColor='#28101688';ctx.shadowOffsetY=4;ctx.shadowBlur=5;
  ctx.drawImage(itemTexture(item,back),-width/2,-height/2,width,height);ctx.restore();
  if(hit) {
    const cs=Math.cos(rotation),sn=Math.sin(rotation);
    const polygon=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]]
      .map(([x,y])=>({x:position.x+(x*cs-y*sn)*scale,y:position.y+(x*sn+y*cs)*scale}));
    itemHits.push({item,back,pageNumber,underY,side,x:position.x,y:position.y,w:width*Math.abs(scale),h:height,xpoly:polygon,polygon});
  }
}

function sampleItemChain(chain,u) {
  if(u>=0&&u<=1)return sampleChain(chain,u);
  const a=u<0?chain[0]:chain[SEGMENTS-1],b=u<0?chain[1]:chain[SEGMENTS];
  const t=(u-a.u)/(b.u-a.u);
  return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),u};
}

function insertSurfacePoint(chain,side,number,u,v) {
  if(number===-1||number===pageCount) {
    const x=side<0?BOARD_SEAM-u*(BOARD_SEAM-40):SPINE_END+u*(984-SPINE_END);
    return coverPoint(x,55+v*450);
  }
  return project(sampleItemChain(chain,u),v);
}
function rigidInsertPoint(chain,side,number,pose,rx,ry,width) {
  const v=pose.v+ry/PAGE_H;
  if(number===-1||number===pageCount)return insertSurfacePoint(chain,side,number,pose.u+side*rx/PAGE_W,v);
  const anchor=sampleItemChain(chain,pose.u),span=width/(2*PAGE_W);
  const a=sampleItemChain(chain,pose.u-span),b=sampleItemChain(chain,pose.u+span),length=Math.hypot(b.x-a.x,b.z-a.z)||1;
  return project({x:anchor.x+side*rx*(b.x-a.x)/length,z:anchor.z+side*rx*(b.z-a.z)/length},v);
}

function paintPageItem(item,chain,side,number,{faceOnly=false,hit=false,occlude=false}={}) {
  const pose=itemPose(item,number),itemSize=item.type==='feather'?3:1,
    width=128*208/180*itemSize,height=96*164/136*itemSize;
  const state=itemState(item);
  if(state.edgeMark&&side!==(state.edgeMark.page%2===0?1:-1)){pose.back=!pose.back;pose.rotation=-pose.rotation;}
  const front=mountedTexture(item,pose.back,state.edgeMark&&pose.back?false:null),reverse=faceOnly?null:mountedTexture(item,!pose.back,state.edgeMark&&!pose.back?false:null);
  const cs=Math.cos(pose.rotation),sn=Math.sin(pose.rotation);
  // A loose photograph is a stiff card, not another piece of the flexible
  // leaf. One tangent plane prevents its front/back strips folding through
  // each other and cancelling to nothing at the curl's inflection.
  const rigid=!state.taped&&number>=0&&number<pageCount;
  const anchor=sampleItemChain(chain,pose.u),span=width/(2*PAGE_W);
  const tangentA=sampleItemChain(chain,pose.u-span),tangentB=sampleItemChain(chain,pose.u+span);
  const tangentLength=Math.hypot(tangentB.x-tangentA.x,tangentB.z-tangentA.z)||1;
  const tangent={x:(tangentB.x-tangentA.x)/tangentLength,z:(tangentB.z-tangentA.z)/tangentLength};
  const masked=occlude&&turningSheetDepth&&motion.progress>0&&motion.progress<1;
  let target=ctx,cardDepth=null,cardU=null;
  const bounds=[],hitTriangles=[];
  if(masked) {
    if(insertLayer.width!==canvas.width||insertLayer.height!==canvas.height){insertLayer.width=canvas.width;insertLayer.height=canvas.height;}
    target=insertLayerContext;target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,insertLayer.width,insertLayer.height);
    target.setTransform(ctx.getTransform());target.imageSmoothingEnabled=false;
    cardDepth=new Float32Array(canvas.width*canvas.height);cardDepth.fill(-Infinity);
    cardU=new Float32Array(cardDepth.length);cardU.fill(NaN);
  }
  const locate=(x,y)=>{
    const rx=x*cs-y*sn,ry=x*sn+y*cs;
    const u=pose.u+side*rx/PAGE_W,v=pose.v+ry/PAGE_H;
    if(rigid)return project({x:anchor.x+side*rx*tangent.x,z:anchor.z+side*rx*tangent.z},v);
    return insertSurfacePoint(chain,side,number,u,v);
  };
  for(let i=0;i<12;i++)for(let row=0;row<4;row++) {
    const x0=(i/12-.5)*width,x1=((i+1)/12-.5)*width;
    const y0=(row/4-.5)*height,y1=((row+1)/4-.5)*height;
    const centerU=pose.u+side*(((x0+x1)*.5)*cs-((y0+y1)*.5)*sn)/PAGE_W;
    const a=sampleItemChain(chain,centerU-.001),b=sampleItemChain(chain,centerU+.001);
    const turnedOver=(rigid?tangent.x:b.x-a.x)*side<0;
    // Tape belongs to one face of the sheet and disappears with that face.
    // A loose card turns with the sheet and shows its own reverse instead.
    if(faceOnly&&turnedOver)continue;
    const image=turnedOver?reverse:front;
    const u0=turnedOver?1-i/12:i/12,u1=turnedOver?1-(i+1)/12:(i+1)/12;
    const points=[locate(x0,y0),locate(x1,y0),locate(x1,y1),locate(x0,y1)];
    const uv=[{x:u0*image.width,y:row/4*image.height},{x:u1*image.width,y:row/4*image.height},
      {x:u1*image.width,y:(row+1)/4*image.height},{x:u0*image.width,y:(row+1)/4*image.height}];
    quad(image,uv,points,target);
    if(hit)for(const indices of [[0,1,2],[0,2,3]])hitTriangles.push({image,uv:indices.map(i=>uv[i]),points:indices.map(i=>points[i])});
    if(masked) {
      const depths=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>pose.v+(x*sn+y*cs)/PAGE_H);
      const us=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>pose.u+side*(x*cs-y*sn)/PAGE_W);
      rasterDepthQuad(points,depths,cardDepth,us,cardU);bounds.push(...points);
    }
  }
  if(rigid&&(!faceOnly||tangent.x*side>=0)) {
    const corners=[[-width/2+10,-height/2+10],[width/2-10,-height/2+10],[width/2-10,height/2-10],[-width/2+10,height/2-10]].map(([x,y])=>locate(x,y));
    // Retain a hairline edge through the genuinely edge-on instant, rather
    // than letting all textured triangles fall below the rasterizer cutoff.
    if(Math.abs(tangent.x)<.12){target.save();target.strokeStyle='#b77a42';target.lineWidth=1;target.beginPath();target.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(p=>target.lineTo(p.x,p.y));target.closePath();target.stroke();target.restore();}
  }
  if(masked&&bounds.length) {
    const transform=ctx.getTransform(),pixels=bounds.map(p=>({x:transform.a*p.x+transform.c*p.y+transform.e,y:transform.b*p.x+transform.d*p.y+transform.f}));
    const x=Math.max(0,Math.floor(Math.min(...pixels.map(p=>p.x)))-2),y=Math.max(0,Math.floor(Math.min(...pixels.map(p=>p.y)))-2);
    const width=Math.min(canvas.width-x,Math.ceil(Math.max(...pixels.map(p=>p.x)))+2-x),height=Math.min(canvas.height-y,Math.ceil(Math.max(...pixels.map(p=>p.y)))+2-y);
    if(width>0&&height>0) {
      const image=target.getImageData(x,y,width,height),data=image.data;
      const hiddenFace=rigid&&tangent.x*side<0&&motion.progress<1;
      for(let py=0;py<height;py++)for(let px=0;px<width;px++) {
        const index=(y+py)*canvas.width+x+px,paper=turningSheetDepth[index],card=cardDepth[index];
        const sameContactPatch=Math.abs(turningSheetU[index]-cardU[index])<span;
        if(Number.isFinite(paper)&&(hiddenFace||!sameContactPatch&&paper>card+.002))data[(py*width+px)*4+3]=0;
      }
      target.putImageData(image,x,y);
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(insertLayer,x,y,width,height,x,y,width,height);ctx.restore();
    }
  }
  if(hit) {
    const polygon=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([x,y])=>locate(x,y));
    const xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y),{x,y}=locate(0,0);
    itemHits.push({item,back:pose.back,pageNumber:number,underY:null,side,x,y,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),polygon,hitTriangles,bookmark:!!state.edgeMark});
  }
}

function restingItems(chain,number,side,layer='over') {
  for(const item of itemsOnPage(number)) {
    const pose=itemPose(item,number),state=itemState(item);
    if(itemDrag?.item===item||inspection?.item===item)continue;
    if((layer==='under')!==pose.under)continue;
    paintPageItem(item,chain,side,number,{faceOnly:state.taped,hit:!motion&&!coverMotion});
  }
}

function turningItems(chain,layer='over') {
  if(Math.abs(turningDistance())>1)return;
  if(layer==='under')return;
  const sourceNumber=motion.direction===1?spread*2:spread*2-1;
  const destination=sourceNumber+motion.direction;
  const items=[...new Set([...itemsOnPage(sourceNumber),...itemsOnPage(destination)])];
  for(const item of items) {
    const state=itemState(item);
    if(state.taped||state.edgeMark) {
      const number=state.edgeMark?.page??state.anchorPage,side=number===sourceNumber?motion.direction:-motion.direction;
      paintPageItem(item,chain,side,number,{faceOnly:!state.edgeMark,occlude:true});continue;
    }
    if(state.pageNumber===sourceNumber) {
      // Until it lands, even a loose card occupies only the source face.
      // The opaque reverse of the leaf must not reveal the photo behind it.
      paintPageItem(item,chain,motion.direction,sourceNumber,{faceOnly:true,occlude:true});
    } else if(state.pageNumber===destination) {
      paintPageItem(item,chain,-motion.direction,destination,{faceOnly:true,occlude:true});
    }
  }
}

const insertAlphaCache=new WeakMap();
function opaqueInsertHit(hit,point) {
  if(!hit.hitTriangles)return true;
  for(const tri of hit.hitTriangles){
    const [a,b,c]=tri.points,det=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(det)<.001)continue;
    const s=((point.x-a.x)*(c.y-a.y)-(point.y-a.y)*(c.x-a.x))/det;
    const t=((b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x))/det;
    if(s<0||t<0||s+t>1)continue;
    let alpha=insertAlphaCache.get(tri.image);
    if(!alpha){const p=spriteSurface(tri.image.width,tri.image.height).getContext('2d');p.drawImage(tri.image,0,0);alpha=p.getImageData(0,0,tri.image.width,tri.image.height).data;insertAlphaCache.set(tri.image,alpha);}
    const [A,B,C]=tri.uv,x=Math.floor(A.x+s*(B.x-A.x)+t*(C.x-A.x)),y=Math.floor(A.y+s*(B.y-A.y)+t*(C.y-A.y));
    if(x>=0&&x<tri.image.width&&y>=0&&y<tri.image.height&&alpha[(y*tri.image.width+x)*4+3]>=64)return true;
  }return false;
}

function rememberEdgeBookmark(item) {
  const state=itemState(item);delete state.edgeMark;
  if(!state.outside&&Number.isInteger(state.pageNumber)){
    const size=item.type==='feather'?3:1,texture=mountedTexture(item,state.back),bounds=opaqueBounds(texture);
    const w=128*208/180*size*(bounds.right-bounds.left)/texture.width,h=96*164/136*size*(bounds.bottom-bounds.top)/texture.height;
    const hx=(w*Math.abs(Math.cos(state.rotation))+h*Math.abs(Math.sin(state.rotation)))/2/PAGE_W;
    const hy=(h*Math.abs(Math.cos(state.rotation))+w*Math.abs(Math.sin(state.rotation)))/2/PAGE_H;
    const candidates=[['top',hy-state.v],['bottom',state.v+hy-1],[state.pageNumber%2?'left':'right',state.u+hx-1]].sort((a,b)=>b[1]-a[1]);
    if(candidates[0][1]>.015)state.edgeMark={page:state.pageNumber,edge:candidates[0][0],along:candidates[0][0]==='top'||candidates[0][0]==='bottom'?state.u:state.v,
      overhang:candidates[0][1],depthFraction:clamp((Math.floor(state.pageNumber/2)+.5)/(pageCount/2)),u:state.u,v:state.v,rotation:state.rotation};
  }
  persistEdgeBookmarks();
}
function persistEdgeBookmarks() {
  bookContent.edgeBookmarks=allInserts().filter(item=>itemMounts.get(item.sheet)?.edgeMark).map(item=>({item:{...item},state:{...itemMounts.get(item.sheet)}}));
  persistInsertMounts();
}
function persistInsertMounts(){
  bookContent.edgeBookmarks=allInserts().filter(item=>itemMounts.get(item.sheet)?.edgeMark).map(item=>({item:{...item},state:{...itemMounts.get(item.sheet)}}));
  bookContent.insertMounts=allInserts().filter(item=>{const s=itemMounts.get(item.sheet);return s&&(s.outside||s.pageNumber!==99999);}).map(item=>({item:{...item},state:{...itemMounts.get(item.sheet)}}));
  const book=savedBooks.find(b=>b.id===activeBookId);if(book){book.insertMounts=structuredClone(bookContent.insertMounts);book.edgeBookmarks=structuredClone(bookContent.edgeBookmarks||[]);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}
  persistBookContent();
}
function restoreEdgeBookmarks() {
  for(const entry of bookContent.insertMounts||[]){
    if(!entry.item||!entry.state||!Number.isInteger(entry.item.sheet))continue;
    if(![entry.state.u,entry.state.v,entry.state.rotation].every(Number.isFinite))continue;
    let item=allInserts().find(item=>item.sheet===entry.item.sheet);
    if(!item){item={...entry.item};customInserts.push(item);nextInsertId=Math.max(nextInsertId,item.sheet-999);}
    itemMounts.set(item.sheet,{...entry.state});
  }
  for(const state of itemMounts.values())if(state.edgeMark){delete state.edgeMark;state.outside=false;state.pageNumber=99999;}
  for(const entry of bookContent.edgeBookmarks||[]){
    if(!entry.item||!entry.state?.edgeMark||!Number.isInteger(entry.item.sheet))continue;
    const state=entry.state;if(!['top','bottom','left','right'].includes(state.edgeMark.edge)||![state.u,state.v,state.rotation,state.edgeMark.page].every(Number.isFinite))continue;
    let item=allInserts().find(item=>item.sheet===entry.item.sheet);
    if(!item){item={...entry.item};customInserts.push(item);nextInsertId=Math.max(nextInsertId,item.sheet-999);}
    itemMounts.set(item.sheet,{...state,outside:false,pageNumber:clamp(state.edgeMark.page,-1,pageCount),edgeMark:{...state.edgeMark,page:clamp(state.edgeMark.page,-1,pageCount)}});
  }
  mountedTextures.clear();
}
function polygonContains(point,polygon) {
  let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
function paintHiddenEdgeBookmarks(left,right,leftNumber,rightNumber) {
  const outline=chain=>[...chain.map(p=>project(p,0)),...chain.slice().reverse().map(p=>project(p,1))];
  const pages=[];if(leftNumber>=0)pages.push(outline(left));if(rightNumber<pageCount)pages.push(outline(right));
  const source=motion?(motion.direction===1?spread*2:spread*2-1):null;
  for(const item of allInserts()){
    const state=itemState(item),mark=state.edgeMark;if(!mark||itemDrag?.item===item||inspection?.item===item)continue;
    const number=mark.page;
    if(number===leftNumber||number===rightNumber||motion&&(number===source||number===source+motion.direction))continue;
    const side=number<spread*2?-1:1,leaves=pageCount/2,leaf=Math.floor(number/2);
    const fraction=number<0||number>=pageCount?0:side<0?clamp((leaf+.5)/Math.max(1,spread)):clamp((leaves-leaf-.5)/Math.max(1,leaves-spread));
    const top=side<0?left:right;
    const fractional=spread+turningDistance()*sine(motion?.progress||0),load=side<0?fractional/(spreadCount()-1):1-fractional/(spreadCount()-1);
    const depth=pageBlockDepth(load),book=bookState(),fore=side*(depth*.30+Math.max(0,side*(book.coverShift-book.shift)));
    const chain=top.map(p=>({...p,x:p.x+fore*(1-fraction)*p.u,z:elevationZ(pageElevation(p.z)-layerDepth(load,p.u)*(1-fraction))}));
    const support=outline(chain),start=itemHits.length;
    ctx.save();ctx.beginPath();ctx.rect(-W,-H,W*3,H*3);support.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip('evenodd');
    paintPageItem(item,chain,side,number,{hit:!motion&&!coverMotion});ctx.restore();
    for(const hit of itemHits.slice(start)){hit.hiddenMark=true;hit.visibleAt=point=>!polygonContains(point,support)&&!pages.some(polygon=>polygonContains(point,polygon));}
  }
}
function itemHit(point) {
  const contains=(polygon)=>{
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i],b=polygon[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1));
      if(Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<8)return true;
    }
    return inside;
  };
  return itemHits.slice().reverse().find(h=>Math.abs(point.x-h.x)<h.w/2+8&&Math.abs(point.y-h.y)<h.h/2+8
    &&(!h.polygon||contains(h.polygon))
    &&opaqueInsertHit(h,point)
    &&(!h.visibleAt||h.visibleAt(point))
    &&(h.underY===null||point.y>h.underY+1));
}

function prepareGutterContacts() {
  const direction=motion.direction,receiving=direction===1?spread*2-1:spread*2;
  const contacts=[];
  for(const item of allInserts()){
    const state=itemMounts.get(item.sheet);if(state.taped||state.edgeMark)continue;
    const side=state.pageNumber%2===0?1:-1,amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
    const chain=resting(side,amount),center=state.outside?{x:state.outsideX,y:state.outsideY}:insertSurfacePoint(chain,side,state.pageNumber,state.u,state.v);
    if(!state.outside&&![spread*2-1,spread*2].includes(state.pageNumber))continue;
    const texture=mountedTexture(item,state.back),b=opaqueBounds(texture),size=item.type==='feather'?3:1;
    const w=128*208/180*size*(b.right-b.left)/texture.width,h=96*164/136*size*(b.bottom-b.top)/texture.height;
    const half=(w*Math.abs(Math.cos(state.rotation))+h*Math.abs(Math.sin(state.rotation)))/2;
    const hinge=CX+bookState().shift*pagePerspective(state.v||.5).hinge;
    if(center.y<TOP-25||center.y>BOTTOM+15||center.x-half>=hinge-3||center.x+half<=hinge+3)continue;
    const support=resting(-direction,-direction<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1));
    let u=0,v=state.v||.5;
    for(let i=0;i<10;i++){
      const p=insertSurfacePoint(support,-direction,receiving,u,v),a=insertSurfacePoint(support,-direction,receiving,u+.001,v),b=insertSurfacePoint(support,-direction,receiving,u,v+.001);
      const ax=(a.x-p.x)/.001,ay=(a.y-p.y)/.001,bx=(b.x-p.x)/.001,by=(b.y-p.y)/.001,det=ax*by-ay*bx;
      if(Math.abs(det)<.001)break;u+=((center.x-p.x)*by-(center.y-p.y)*bx)/det;v+=(ax*(center.y-p.y)-ay*(center.x-p.x))/det;
    }
    contacts.push({item,initialU:u,half,pose:{...state,outside:false,under:false,pageNumber:receiving,u,v:clamp(v,.04,.96)}});
  }
  motion.gutterContacts=contacts;
}
function updateGutterContacts() {
  const d=motion.direction;
  for(const contact of motion.gutterContacts){
    const amount=-d<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1),support=resting(-d,amount);
    const anchor=sampleItemChain(support,contact.initialU),height=anchor.z+3;
    let center=anchor.x;
    // Sweep the actual sheet cross-section against the card's two edges. A
    // steep sheet face pushes laterally; a nearly flat leaf is not a wall.
    const steps=Math.max(1,Math.ceil(motion.progress*36));
    for(let n=0;n<=steps;n++){
      const chain=turnChain(d,motion.progress*n/steps);
      for(let i=1;i<chain.length;i++){
        const a=chain[i-1],b=chain[i],dz=b.z-a.z,dx=b.x-a.x;
        if(Math.abs(dz)/Math.hypot(dx,dz)<.32||height<Math.min(a.z,b.z)||height>Math.max(a.z,b.z))continue;
        const x=mix(a.x,b.x,(height-a.z)/dz);
        if(x<center-contact.half-3||x>center+contact.half+3)continue;
        center=d>0?Math.min(center,x-contact.half-2):Math.max(center,x+contact.half+2);
      }
    }
    let lo=-.4,hi=1.25;
    for(let i=0;i<20;i++){const u=(lo+hi)/2;if(sampleItemChain(support,u).x*(-d)<center*(-d))lo=u;else hi=u;}
    contact.pose.u=(lo+hi)/2;
  }
}

function refreshKeepsakes() {
  const container=$('.keepsakes');container.replaceChildren();
  if(closedEdge||coverMotion)return;
  for(const number of [spread*2-1,spread*2]) {
    for(const item of itemsOnPage(number)) {
      const state=itemState(item),pose=itemPose(item,number);
      const button=document.createElement('button');button.textContent='Inspect: '+item.title+(state.taped?' · taped':pose.under?' · tucked':'');
      button.disabled=!!motion;button.onclick=()=>openItem(item,pose.back,number);container.append(button);
    }
  }
}

function inspectionOrigin(item){
  const hit=itemHits.find(h=>h.item===item),state=itemState(item),r=canvas.getBoundingClientRect();
  if(hit)return{x:r.left+hit.x/W*r.width,y:r.top+hit.y/H*r.height,w:hit.w/W*r.width,h:hit.h/H*r.height,rotation:state.rotation||0};
  const side=Number.isInteger(state.pageNumber)&&state.pageNumber%2?-1:1;
  const q=state.outside?{x:state.outsideX,y:state.outsideY}:insertSurfacePoint(resting(side,side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1)),side,state.pageNumber,state.u,state.v);
  return{x:r.left+q.x/W*r.width,y:r.top+q.y/H*r.height,w:128/W*r.width,h:96/H*r.height,rotation:state.rotation||0};
}
function positionInspection(){
  if(!inspection)return;
  const focus=$('#insert-focus'),r=canvas.getBoundingClientRect(),height=Math.min(530,innerHeight-24);
  const cy=clamp(r.top+r.height*.47,height/2+12,innerHeight-height/2-12);
  const half=Math.min(190,(innerWidth-28)/2);
  focus.style.top=cy+'px';focus.style.left=clamp(r.left+r.width/2,half+14,innerWidth-half-14)+'px';
}
function inspectionTransform(){
  const r=$('#item-art').getBoundingClientRect(),o=inspection.origin;
  return `translate(${o.x-(r.left+r.width/2)}px,${o.y-(r.top+r.height/2)}px) rotate(${o.rotation}rad) scale(${Math.max(.05,o.w/(r.width*312/360))},${Math.max(.05,o.h/(r.height*246/280))})`;
}
function renderInspection(scale=1,back=inspection.back) {
  const taped=itemState(inspection.item).taped;
  const c=$('#item-art'),p=c.getContext('2d');p.clearRect(0,0,c.width,c.height);
  p.imageSmoothingEnabled=false;p.save();p.translate(c.width/2,c.height/2);p.scale(scale,1);
  p.drawImage(mountedTexture(inspection.item,back),-156,-123,312,246);p.restore();
  $('#item-description').textContent=back?inspection.item.back:inspection.item.front;
  $('#flip-item').textContent='Flip ↻';$('#flip-item').hidden=false;
  $('#flip-item').disabled=inspection.animating||inspection.closing||taped;
  $('#tape-item').textContent=taped?'Remove tape':'Tape down';
  $('#tape-item').setAttribute('aria-pressed',String(taped));
  $('#tape-item').disabled=inspection.animating||inspection.closing;
  $('#mount-status').textContent=taped?'Taped · remove tape to flip.':'Click outside or press Esc to put back.';
}
function paintInspectionShadow(){
  if(!inspection)return;
  const r=canvas.getBoundingClientRect(),o=inspection.origin,t=inspection.lift??1;
  const x=mix((o.x-r.left)/r.width*W,W/2,t*.55),y=mix((o.y-r.top)/r.height*H,H*.52,t*.35);
  ctx.save();ctx.beginPath();
  for(const side of [-1,1]){
    const amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1),chain=resting(side,amount);
    const points=[...chain.map(p=>project(p,0)),...chain.slice().reverse().map(p=>project(p,1))];
    ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
  }ctx.clip();ctx.translate(x+12*t,y+20*t);ctx.scale(1,.65);
  const gradient=ctx.createRadialGradient(0,0,5,0,0,180);
  gradient.addColorStop(0,`rgba(28,19,13,${.24*t})`);gradient.addColorStop(.55,`rgba(28,19,13,${.13*t})`);gradient.addColorStop(1,'rgba(28,19,13,0)');
  ctx.fillStyle=gradient;ctx.fillRect(-180,-180,360,360);ctx.restore();
}
function animateInspectionLift(from,to,duration){
  const entry=inspection,start=performance.now();
  function frame(now){if(inspection!==entry)return;const p=clamp((now-start)/duration);entry.lift=mix(from,to,sine(p));draw();if(p<1)requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}
function openItem(item,back,pageNumber=null) {
  if(motion||coverMotion||closedEdge||inspection)return;
  const state=itemState(item);
  if(pageNumber===null)pageNumber=state.taped?state.anchorPage:state.pageNumber;
  stopAuto();inspection={item,back:!!state.back,pageNumber,animating:false,lift:0,origin:inspectionOrigin(item)};
  $('#item-title').textContent=item.title;$('#inspect').showModal();positionInspection();renderInspection();
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:420;
  inspection.originTransform=inspectionTransform();
  $('#item-art').animate([{transform:inspection.originTransform,filter:'drop-shadow(0 2px 2px #0003)'},{transform:'none',filter:'drop-shadow(12px 22px 15px #0005)'}],{duration,easing:'cubic-bezier(.2,.7,.2,1)'});
  animateInspectionLift(0,1,duration);$('#close-item').focus({preventScroll:true});draw();
}
function closeInspection(){
  if(!inspection||inspection.closing||inspection.animating)return;
  inspection.closing=true;renderInspection();const entry=inspection,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:300;
  $('#inspect').classList.add('putting-back');
  const animation=$('#item-art').animate([{transform:'none',filter:'drop-shadow(12px 22px 15px #0005)'},{transform:inspectionTransform(),filter:'drop-shadow(0 2px 2px #0003)'}],{duration,easing:'cubic-bezier(.4,0,.7,1)',fill:'forwards'});
  animateInspectionLift(entry.lift,0,duration);
  animation.finished.then(()=>{if(inspection!==entry)return;$('#inspect').close();animation.cancel();});
}
$('#flip-item').onclick=()=>{
  if(!inspection||inspection.animating||inspection.closing||itemState(inspection.item).taped)return;
  inspection.animating=true;const entry=inspection,start=performance.now(),old=inspection.back,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:440;
  const frame=now=>{
    if(inspection!==entry)return;
    const p=clamp((now-start)/duration),back=p<.5?old:!old;
    renderInspection(Math.max(.006,Math.abs(Math.cos(Math.PI*sine(p)))),back);
    if(p<1)requestAnimationFrame(frame);else{inspection.back=!old;itemState(inspection.item).back=inspection.back;inspection.animating=false;persistInsertMounts();renderInspection();}
  };requestAnimationFrame(frame);
};
$('#tape-item').onclick=()=>{
  if(!inspection||inspection.animating||inspection.closing)return;
  const state=itemState(inspection.item);
  if(state.taped){state.taped=false;state.pageNumber=state.anchorPage;state.frontPage=state.anchorPage;state.anchorPage=null;}
  else{state.taped=true;state.anchorPage=inspection.pageNumber;state.pageNumber=inspection.pageNumber;}
  mountedTextures.clear();rememberEdgeBookmark(inspection.item);refreshKeepsakes();draw();renderInspection();
};
$('#close-item').onclick=closeInspection;
$('#inspect').addEventListener('cancel',e=>{e.preventDefault();closeInspection();});
$('#inspect').addEventListener('close',()=>{inspection=null;$('#inspect').classList.remove('putting-back');refreshKeepsakes();draw();canvas.focus({preventScroll:true});});
$('#inspect').addEventListener('click',e=>{if(e.target===$('#inspect'))closeInspection();});
window.addEventListener('resize',positionInspection);

function editablePages() {
  if(closedEdge)return [];
  if(spread===0)return [0];
  if(spread===spreadCount()-1)return [pageCount-1];
  return [spread*2-1,spread*2].filter(number=>number<pageCount);
}

function loadPageIntoEditor(number) {
  if(!Number.isInteger(number))return;
  const base=entries[number%entries.length],custom=bookPage(number);
  $('#edit-eyebrow').value=custom.eyebrow??base[0];
  $('#edit-title').value=custom.title??base[1];
  $('#edit-body').value=custom.body??base[2];
  $('#page-role').value=pageRole(number);$('#toc-label').value=custom.tocLabel||defaultSections[number]||'';
  $('#page-font').value=custom.font||'pixel';$('#page-ink').value=custom.ink||'#5b3e2d';
  $('#page-paper').value=custom.paper||'cream';$('#page-number-position').value=custom.pageNumberPlacement||'bottom-center';
  selectedEditPage=number;
  selectedPageImage=-1;refreshPageImages();
}

function refreshPageImages(){
  const images=bookPage(selectedEditPage).images||[],list=$('#page-images');
  list.replaceChildren(...images.map((image,index)=>{const button=document.createElement('button');button.type='button';button.textContent=`Image ${index+1}`;button.setAttribute('aria-pressed',String(index===selectedPageImage));button.onclick=()=>{selectedPageImage=index;refreshPageImages();};return button;}));
  $('#edit-image-pixels').disabled=selectedPageImage<0;$('#remove-page-image').disabled=selectedPageImage<0;
}

function currentPage(){return Number.isInteger(selectedEditPage)?(bookContent.pages[selectedEditPage]||(bookContent.pages[selectedEditPage]=structuredClone(bookPage(selectedEditPage)))):null;}
function persistEditedPage(){if(document.querySelector('#page-workshop[open]')){workshopPersist();return;}persistBookContent();textures.clear();draw();}

$('#add-text').onclick=()=>{const text=$('#insert-text').value.trim();if(!text)return;const page=currentPage();if(!page)return;const body=$('#edit-body').value;page.body=body+(body?'\n':'')+text;$('#edit-body').value=page.body;$('#insert-text').value='';saveEditedPage();};
$('#page-image-file').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const source=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
  const image=new Image();image.onload=()=>{const scale=Math.min(1,360/image.width,300/image.height),w=Math.round(image.width*scale),h=Math.round(image.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(image,0,0,w,h);const page=currentPage();if(!page)return;page.images=page.images||[];page.images.push({src:c.toDataURL('image/png'),x:Math.round((PAGE_W-w)/2),y:190,w,h});selectedPageImage=page.images.length-1;persistEditedPage();refreshPageImages();};image.src=source;e.target.value='';
};
$('#remove-page-image').onclick=()=>{const page=currentPage();if(!page||selectedPageImage<0)return;page.images.splice(selectedPageImage,1);selectedPageImage=-1;persistEditedPage();refreshPageImages();};
$('#edit-image-pixels').onclick=async()=>{
  const page=currentPage(),imageData=page?.images?.[selectedPageImage];if(!imageData)return;
  pixelMode='image';const image=new Image();image.onload=()=>{const c=$('#pixel-art');c.width=image.naturalWidth;c.height=image.naturalHeight;const p=c.getContext('2d');p.clearRect(0,0,c.width,c.height);p.drawImage(image,0,0,c.width,c.height);$('.pixel-editor').open=true;};image.src=imageData.src.startsWith('book-art:')?await resolveArtAsset(imageData.src):imageData.src;
};
function editorPoint(event){const c=$('#pixel-art'),rect=c.getBoundingClientRect();return{x:(event.clientX-rect.left)*c.width/rect.width,y:(event.clientY-rect.top)*c.height/rect.height};}
function drawEditorStroke(point){const p=$('#pixel-art').getContext('2d'),size=Number($('#brush-size').value);p.save();p.globalCompositeOperation=$('#eraser').getAttribute('aria-pressed')==='true'?'destination-out':'source-over';p.fillStyle=document.querySelector('input[name="draw-ink"]:checked').value;p.beginPath();p.arc(point.x,point.y,size/2,0,Math.PI*2);p.fill();p.restore();}
$('#pixel-art').onpointerdown=e=>{drawingState=true;e.currentTarget.setPointerCapture(e.pointerId);drawEditorStroke(editorPoint(e));};
$('#pixel-art').onpointermove=e=>{if(drawingState)drawEditorStroke(editorPoint(e));};
$('#pixel-art').onpointerup=$('#pixel-art').onpointercancel=()=>{drawingState=false;};
$('#brush-size').oninput=e=>$('#brush-size-value').textContent=`${e.target.value} px`;
$('#eraser').onclick=e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));};
$('#clear-art').onclick=()=>{const c=$('#pixel-art');c.getContext('2d').clearRect(0,0,c.width,c.height);};
$('#save-art').onclick=async()=>{const page=currentPage();if(!page)return;try{const blob=await new Promise(resolve=>$('#pixel-art').toBlob(resolve,'image/png'));const data=await saveArtBlob(blob,{kind:'pixel-drawing'});if(pixelMode==='image'&&page.images?.[selectedPageImage])page.images[selectedPageImage].src=data;else page.art=data;persistEditedPage();}catch(error){$('#status').textContent='Drawing was not saved: '+error.message;}};

function seedStarterBooks(){
  // Track individual catalog additions, so updates reach existing shelves but
  // previously deleted starters stay deleted. Never overwrite saved book edits.
  let known;try{known=JSON.parse(localStorage.getItem('pixel-book-seeded-catalog-v1'));}catch{}
  const seeded=new Set(Array.isArray(known)?known:localStorage.getItem('pixel-book-starters-v1')?['starter-dracula','starter-frankenstein','starter-keeper']:[]);
  for(const starter of starterLibrary.values())if(!starter.legacy&&!seeded.has(starter.id)){
    if(!savedBooks.some(book=>book.id===starter.id||book.starterId===starter.starterId))savedBooks.push({...starter,pages:{}});
    seeded.add(starter.id);
  }
  if(!seeded.has('starter-keeper')&&!savedBooks.some(book=>book.id==='starter-keeper'))savedBooks.push({id:'starter-keeper',name:'The Keeper’s Book',pageCount:28,pages:{},covers:{front:{},back:{}},palette:{outside:'#65402e',inside:'#c85e68',metal:'gold'}});
  seeded.add('starter-keeper');localStorage.setItem('pixel-book-seeded-catalog-v1',JSON.stringify([...seeded]));
  localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));localStorage.setItem('pixel-book-starters-v1','1');
}
function renderShelf(){
  const container=$('#shelf-books');container.replaceChildren();$('#shelf-empty').hidden=savedBooks.length>0;
  savedBooks.forEach(book=>{
    const button=document.createElement('button');button.type='button';button.className='shelf-spine';
    // Two 2mm boards plus 0.11mm per physical leaf. Unlike the bounded 3D
    // animation model this keeps a 60-page book visibly slimmer than 410 pages.
    const width=clamp((4+Math.ceil(book.pageCount/2)*.11)*1.7,8,160);
    button.style.setProperty('--spine-width',width+'px');button.dataset.bookId=book.id;
    const pages=book.sourcePageCount||book.pageCount;
    button.setAttribute('aria-label',`${book.name}, ${pages} pages`);button.title=`${book.name} · ${pages} pages`;
    // Reuse the exact tinted, titled spine material used by the closed 3D
    // book, including its alpha silhouette, raised bands and ornate ends.
    const format=bookFormat(book);
    const height=clamp(format.heightPt/792*216,138,260);button.style.setProperty('--spine-height',height+'px');
    const texture=closedMaterials(book).spine,spine=document.createElement('canvas');spine.width=texture.width;spine.height=texture.height;spine.setAttribute('aria-hidden','true');
    spine.getContext('2d').drawImage(texture,0,0);
    const count=document.createElement('small');count.textContent=pages;count.title=pages+' pages';count.setAttribute('aria-hidden','true');
    button.append(spine,count);
    button.onclick=()=>openSavedBook(book.id);container.append(button);
  });
}
function escapeText(value){const el=document.createElement('span');el.textContent=value;return el.innerHTML;}
function saveBook(copy=false){
  bookName=$('#book-name').value.trim()||'Untitled book';bookContent.name=bookName;
  let book=!copy&&savedBooks.find(entry=>entry.id===activeBookId);
  // A rename is a new shelf edition, not an in-place replacement. Keep the
  // previous named spine and make the renamed save its own book entry.
  if(book&&book.name!==bookName)book=null;
  if(!book){book={id:crypto.randomUUID(),name:bookName,pageCount,pages:{},covers:{}};savedBooks.push(book);activeBookId=book.id;localStorage.setItem('keepers-book-active',activeBookId);}
  book.insertMounts=structuredClone(bookContent.insertMounts||[]);book.pageFormat=structuredClone(bookContent.pageFormat);book.spineOrnaments=structuredClone(effectiveSpineOrnaments(bookContent));book.bookFont=selectedBookFont();book.edition=bookContent.edition;book.sourcePageCount=bookContent.sourcePageCount;book.starterId=bookContent.starterId;book.name=bookName;book.pageCount=pageCount;book.pages=structuredClone(bookContent.pages);book.covers=structuredClone(bookContent.covers);book.palette={...bookContent.palette};book.edgeBookmarks=structuredClone(bookContent.edgeBookmarks||[]);book.savedAt=Date.now();
  localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));persistBookContent();$('#status').textContent='Saved to your shelf.';renderShelf();
}
function openSavedBook(id,quiet=false){
  chapterJourney=null;
  const book=savedBooks.find(entry=>entry.id===id);if(!book)return;
  bookTableMode=false;
  bookName=book.name;bookContent.pageFormat=structuredClone(book.pageFormat);bookContent.spineOrnaments=structuredClone(effectiveSpineOrnaments(book));bookContent.bookFont=book.bookFont||DEFAULT_BOOK_FONT;bookContent.edition=book.edition;bookContent.sourcePageCount=book.sourcePageCount;bookContent.starterId=book.starterId||null;bookContent.name=book.name;bookContent.pageCount=book.pageCount;pageCount=book.pageCount;setBookResolution();syncBookFontControls();
  bookContent.pages=structuredClone(book.pages||{});bookContent.covers={front:{},back:{},...(book.covers||{})};bookContent.palette={outside:'#9b382d',inside:'#c85e68',metal:'gold',...(book.palette||{})};activeBookId=id;localStorage.setItem('keepers-book-active',id);
  $('#book-name').value=bookName;$('#outside-color').value=bookContent.palette.outside;$('#inside-color').value=bookContent.palette.inside;$('#metal-color').value=bookContent.palette.metal;
  bookContent.insertMounts=structuredClone(book.insertMounts||[]);bookContent.edgeBookmarks=structuredClone(book.edgeBookmarks||[]);resetSessionInserts();restoreEdgeBookmarks();
  syncActivePageFormat();
  applyBookPalette(false);spread=0;closedEdge=null;motion=null;queuedTurns=[];bookReturnScene=null;textures.clear();shadedTextures.clear();if(!quiet){updateControls();draw();}$('#shelf').close();persistBookContent();
}
$('#save-book').onclick=()=>saveBook(false);$('#save-copy').onclick=()=>saveBook(true);
$('#book-name').oninput=()=>{bookName=$('#book-name').value;persistBookContent();draw();};
$('#shelf-open').onclick=()=>{renderShelf();$('#shelf').showModal();};
$('#go-page-button').onclick=()=>jumpToReaderPage(Number($('#go-page').value));
$('#close-shelf').onclick=$('#close-shelf-action').onclick=()=>$('#shelf').close();
let paletteFrame=0;
function updatePaletteFromControls(){
  bookContent.palette.outside=$('#outside-color').value;bookContent.palette.inside=$('#inside-color').value;bookContent.palette.metal=$('#metal-color').value;
  persistBookContent();applyBookPalette();
}
['#outside-color','#inside-color','#metal-color'].forEach(selector=>{
  $(selector).onchange=()=>{cancelAnimationFrame(paletteFrame);paletteFrame=0;updatePaletteFromControls();};
  if(selector!=='#metal-color')$(selector).oninput=()=>{if(!paletteFrame)paletteFrame=requestAnimationFrame(()=>{paletteFrame=0;updatePaletteFromControls();});};
});

function refreshContentEditor() {
  if(document.querySelector('#page-workshop[open]'))return;
  const coverMode=!!closedEdge;
  $('.content-editor').hidden=!coverMode;
  $('#page-editor').hidden=coverMode;$('#cover-editor').hidden=!coverMode;
  if(coverMode) {
    syncSpineOrnamentEditor();
    const mode=`cover:${closedEdge}`,cover=coverContent(closedEdge);
    $('#content-editor-summary').textContent=closedEdge==='front'?'Design the front cover':'Design the back cover';
    $('#editor-context').textContent='Add lettering and a gilded symbol to this cover. Changes appear on the book and save in this browser.';
    if(editorMode!==mode) {
      $('#cover-title').value=cover.title||'';
      $('#cover-font').value=cover.font||'serif';
      $('#cover-placement').value=cover.placement||'center';
      editorMode=mode;
      updateSymbolSelection(Number.isInteger(cover.symbol)?cover.symbol:-1);
    }
    editorPageList='';return;
  }
  const pages=editablePages(),listKey=pages.join(',');
  $('#content-editor-summary').textContent='Write on the visible page';
  $('#editor-context').textContent=pages.length===1?'Edit the page currently open by the cover.':'Choose either visible page and edit its section label, title, and writing. Title and contents pages are excluded from automatic numbering.';
  const select=$('#edit-page');
  if(editorPageList!==listKey) {
    select.replaceChildren(...pages.map(number=>new Option(`Page ${number+1}${pages.length>1?(number%2?' · left':' · right'):''}`,String(number))));
    editorPageList=listKey;
    if(!pages.includes(selectedEditPage))selectedEditPage=pages[0];
    if(Number.isInteger(selectedEditPage))select.value=String(selectedEditPage);
  }
  if(editorMode!=='page'||selectedEditPage!==Number(select.value)) {
    editorMode='page';loadPageIntoEditor(Number(select.value));
  }
}

function updateSymbolSelection(selected) {
  document.querySelectorAll('.symbol-choice').forEach(button=>{
    const active=Number(button.dataset.symbol)===selected;
    button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  });
}

function initSymbolPicker() {
  const picker=$('#cover-symbols');
  coverSymbolNames.forEach((name,index)=>{
    const button=document.createElement('button'),col=index%6,row=Math.floor(index/6);
    button.type='button';button.className='symbol-choice';button.dataset.symbol=String(index);
    button.title=name;button.setAttribute('aria-label',name);
    button.style.backgroundPosition=`${col*20}% ${row*20}%`;
    picker.append(button);
  });
  picker.addEventListener('click',event=>{
    const button=event.target.closest('.symbol-choice');if(!button||!closedEdge)return;
    const selected=Number(button.dataset.symbol);coverContent(closedEdge).symbol=selected;
    persistBookContent();updateSymbolSelection(selected);draw();
  });
  $('#remove-symbol').onclick=()=>{
    if(!closedEdge)return;
    coverContent(closedEdge).symbol=-1;persistBookContent();updateSymbolSelection(-1);draw();
  };
}

function updateControls() {
  updateBookFormatControls();
  if(typeof updateReaderControls==='function')updateReaderControls();
  update3DControls();
  $('#pagination').textContent=bookTableMode?'3D BOOK TABLE':closedEdge?`${closedEdge.toUpperCase()} COVER`:bookContent.sourcePageCount?`${Math.min(Math.max(1,spread*2),readingPageCount())}–${Math.min(spread*2+1,readingPageCount())} / ${readingPageCount()}`:spread===0?'INSIDE FRONT — 1':spread===spreadCount()-1?`${pageCount} — INSIDE BACK`:`${spread*2} — ${Math.min(spread*2+1,pageCount)} / ${pageCount}`;
  $('#position').value=spread;
  $('#position').max=spreadCount()-1;
  $('#page-count').value=readingPageCount();
  $('#page-count').disabled=!!bookContent.sourcePageCount;
  $('#page-count').title=bookContent.sourcePageCount?'Page count follows the source PDF.':'';
  const viewLocked=bookTableMode||spineView||!!spineMotion||!!closedFlipMotion;
  $('#previous').disabled=viewLocked||!!motion||!!coverMotion||closedEdge==='front';
  $('#next').disabled=viewLocked||!!motion||!!coverMotion||closedEdge==='back';
  $('#previous').setAttribute('aria-label',closedEdge==='back'?'Open back cover':spread===0?'Close front cover':'Previous spread');
  $('#next').setAttribute('aria-label',closedEdge==='front'?'Open front cover':spread===spreadCount()-1?'Close back cover':'Next spread');
  $('#close-book').hidden=bookTableMode||!!closedEdge||!!motion||!!coverMotion||(spread!==0&&spread!==spreadCount()-1);
  $('#flip-closed').hidden=bookTableMode||!closedEdge||!!coverMotion||!!closedFlipMotion||spineView||!!spineMotion;
  $('#flip-closed').textContent=closedEdge==='front'?'Flip to back cover':'Flip to front cover';
  $('#spine-view').textContent=spineView?'Return to book':'View spine';
  $('#spine-view').setAttribute('aria-pressed',String(spineView));
  $('#spine-view').disabled=bookTableMode||!!motion||!!coverMotion||!!closedFlipMotion||!!spineMotion||!!inspection;
  refreshContentEditor();
  refreshKeepsakes();
}

function stopAuto() {
  clearTimeout(autoTimer);autoTimer=0;
  $('#autoplay').setAttribute('aria-pressed','false');
}

function finish(commit) {
  const landed=turnDestination(),bundle=Math.abs(turningDistance())>1;
  if(commit) {
    for(const contact of motion.gutterContacts||[])Object.assign(itemMounts.get(contact.item.sheet),contact.pose);
    const source=motion.direction===1?spread*2:spread*2-1,destination=source-motion.direction;
    for(const item of bundle?[]:allInserts()) {
      const state=itemState(item);
      if(state.taped||state.outside||state.edgeMark)continue;
      if(state.pageNumber===source&&!motion.gutterContacts?.some(contact=>contact.item===item)) {
        state.pageNumber=destination;state.back=!state.back;
        // Deposit onto the face that was opposite before this turn, not
        // onto the reverse of the moving leaf. The landed leaf can cover it;
        // turning that leaf back uncovers it on its new supporting page.
        state.under=false;
        state.rotation=-state.rotation;
      }
    }
    spread=landed;
  }
  motion=null;raf=0;updateControls();draw();
  if(chapterJourney){if(commit)advanceChapterJourney();else chapterJourney=null;return;}
  if(queuedTurns.length) {
    const next=queuedTurns.shift();
    if(begin(next,true))settle(true,220);
    else finish(false);
    return;
  }
  if($('#autoplay').getAttribute('aria-pressed')==='true') {
    autoTimer=setTimeout(()=>{
      if(spread===spreadCount()-1&&autoDirection>0)animateCover('back',true);
      else if(spread===0&&autoDirection<0)animateCover('front',true);
      else begin(autoDirection);
    },550);
  }
}

function settle(commit=true,overrideDuration=null) {
  const start=motion.progress,target=commit?1:0;
  const duration=(overrideDuration??Number($('#speed').value))*Math.abs(target-start),time=performance.now();let previous=time,elapsed=0;
  if(!motion.soundPlayed&&commit){motion.soundPlayed=true;playPaperSound(!!chapterJourney);}
  const frame=now=>{
    if(!motion)return;
    // A stalled frame must not skip straight over the visible upright pose.
    elapsed+=Math.min(34,Math.max(0,now-previous));previous=now;
    const t=clamp(elapsed/Math.max(1,duration));
    motion.progress=mix(start,target,t);draw();
    if(t<1)raf=requestAnimationFrame(frame);else finish(commit);
  };
  raf=requestAnimationFrame(frame);
}

function begin(direction,manual=false) {
  if(!loaded||coverMotion||closedFlipMotion||spineView||spineMotion||inspection)return false;
  if(motion) {
    // Preserve quick repeated button presses instead of ignoring them mid-turn.
    if(queuedTurns.length<24)queuedTurns.push(direction);
    return true;
  }
  if(closedEdge){if((closedEdge==='front'&&direction<0)||(closedEdge==='back'&&direction>0))return false;return animateCover(closedEdge,false);}
  if(spread===0&&direction<0)return animateCover('front',true);
  if(spread===spreadCount()-1&&direction>0)return animateCover('back',true);
  if(spread+direction<0||spread+direction>=spreadCount())return false;
  clearTimeout(autoTimer);autoTimer=0;
  motion={direction,progress:0};prepareGutterContacts();updateControls();
  if(!manual)settle(true);
  return true;
}

$('#next').onclick=()=>begin(1);
$('#previous').onclick=()=>begin(-1);
$('#flip-closed').onclick=flipClosedBook;
$('#spine-view').onclick=animateSpineView;
$('#edit-page').onchange=e=>{selectedEditPage=Number(e.target.value);loadPageIntoEditor(selectedEditPage);};
function saveEditedPage() {
  if(document.querySelector('#page-workshop[open]')){saveWorkshopPage();return;}
  if(!Number.isInteger(selectedEditPage))return;
  const previous=bookPage(selectedEditPage);
  bookContent.pages[selectedEditPage]={...previous,eyebrow:$('#edit-eyebrow').value,title:$('#edit-title').value,body:$('#edit-body').value,
    role:$('#page-role').value,tocLabel:$('#toc-label').value,font:$('#page-font').value,ink:$('#page-ink').value,paper:$('#page-paper').value,pageNumberPlacement:$('#page-number-position').value};
  persistBookContent();textures.clear();draw();
}
['#edit-eyebrow','#edit-title','#edit-body','#toc-label'].forEach(selector=>$(selector).addEventListener('input',saveEditedPage));
['#page-role','#page-font','#page-ink','#page-paper','#page-number-position'].forEach(selector=>$(selector).addEventListener('change',()=>{saveEditedPage();updateControls();}));
$('#edit-mode').onchange=e=>{editMode=e.target.checked;$('#page-edit-controls').hidden=!editMode;textures.clear();draw();};
function saveCoverEditor() {
  if(!closedEdge)return;
  const cover=coverContent(closedEdge);
  cover.title=$('#cover-title').value;cover.font=$('#cover-font').value;cover.placement=$('#cover-placement').value;
  persistBookContent();draw();
}
['#cover-title','#cover-font','#cover-placement'].forEach(selector=>$(selector).addEventListener('input',saveCoverEditor));
['#cover-font','#cover-placement'].forEach(selector=>$(selector).addEventListener('change',saveCoverEditor));
initSymbolPicker();
initSpineOrnamentPicker();
$('#position').oninput=e=>{
  stopAuto();if(raf)cancelAnimationFrame(raf);
  motion=null;coverMotion=null;closedEdge=null;drag=null;queuedTurns=[];chapterJourney=null;spread=Number(e.target.value);updateControls();draw();
};
let pageCountInputTimer=0;
function applyPageCount(input) {
  stopAuto();if(raf)cancelAnimationFrame(raf);
  const requested=Number(input.value);
  pageCount=Number.isFinite(requested)?clamp(Math.round(requested/2)*2,8,4096):28;
  motion=null;coverMotion=null;closedEdge=null;drag=null;queuedTurns=[];chapterJourney=null;
  spread=clamp(spread,0,spreadCount()-1);
  persistBookContent();updateControls();draw();
}
$('#page-count').oninput=e=>{
  // Number inputs can emit an intermediate digit while someone types (e.g.
  // 5 then 6). Debounce the visual rebuild briefly; onchange commits at once.
  clearTimeout(pageCountInputTimer);
  pageCountInputTimer=setTimeout(()=>applyPageCount(e.target),180);
};
$('#page-count').onchange=e=>{clearTimeout(pageCountInputTimer);applyPageCount(e.target);};
$('#close-book').onclick=()=>animateCover(spread===0?'front':'back',true);
$('#blank').onchange=()=>draw();
function refreshContent(){textures.clear();draw();}
$('#hand').onchange=refreshContent;
$('#margin-note').oninput=refreshContent;
$('#autoplay').onclick=()=>{
  const active=$('#autoplay').getAttribute('aria-pressed')==='true';
  if(active)stopAuto();else {autoDirection=spread===spreadCount()-1?-1:1;$('#autoplay').setAttribute('aria-pressed','true');if(!motion)begin(autoDirection);}
};
document.addEventListener('keydown',e=>{
  if(inspection||document.querySelector('#contents-dialog[open],#reading-view[open],#shelf[open]'))return;
  if(['INPUT','SELECT'].includes(e.target.tagName))return;
  if(e.key==='ArrowRight'){e.preventDefault();begin(1);}
  if(e.key==='ArrowLeft'){e.preventDefault();begin(-1);}
});
function point(e) {const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function pageAt(point) {
  const hinge=CX+bookState().shift,side=point.x>hinge?1:-1,number=side>0?spread*2:spread*2-1;
  const atFrontInside=side<0&&spread===0,atBackInside=side>0&&spread===spreadCount()-1;
  const cover=atFrontInside||atBackInside;
  const pageNumber=atFrontInside?-1:atBackInside?pageCount:number;
  if(point.y<TOP-85||point.y>(cover?BOTTOM+60:BOTTOM+18))return null;
  const distance=Math.abs(point.x-hinge);
  if(distance<(cover?24:8)||distance>(cover?472:PAGE_W+18))return null;
  if(!cover&&(pageNumber<0||pageNumber>=pageCount))return null;
  return {side,number:pageNumber,cover};
}
function placeLooseItem(item,point,grab=null) {
  let page=pageAt(point);
  const state=itemState(item),book=bookState();
  delete state.edgeMark;
  const hinge=CX+book.shift;
  if(!page&&point.y>TOP-35&&point.y<BOTTOM+20&&Math.abs(point.x-hinge)<32){
    const side=point.x<hinge?-1:1;page=pageAt({...point,x:hinge+side*36});
  }
  state.under=false;
  if(!page) {
    state.outside=true;state.pageNumber=null;
    state.outsideX=clamp(point.x,68,W-68);state.outsideY=clamp(point.y,72,H-72);
    return true;
  }
  state.outside=false;state.pageNumber=page.number;
  const amount=page.side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1),chain=resting(page.side,amount);
  let u=state.u??.5,v=state.v??.5;
  const width=128*208/180*(item.type==='feather'?3:1),target=grab?grab.pointer:point;
  const locate=(u,v)=>grab?rigidInsertPoint(chain,page.side,page.number,{u,v},grab.rx,grab.ry,width):insertSurfacePoint(chain,page.side,page.number,u,v);
  // Invert the same curved/perspective surface used for drawing. Screen-space
  // division by page width makes a released card jump, especially near the top.
  for(let i=0;i<10;i++) {
    const p=locate(u,v),a=locate(u+.001,v),b=locate(u,v+.001);
    const ax=(a.x-p.x)/.001,ay=(a.y-p.y)/.001,bx=(b.x-p.x)/.001,by=(b.y-p.y)/.001;
    const det=ax*by-ay*bx;if(Math.abs(det)<.001)break;
    const dx=target.x-p.x,dy=target.y-p.y;
    u+=(dx*by-dy*bx)/det;v+=(ax*dy-ay*dx)/det;
  }
  state.u=clamp(u,0,1.12);state.v=clamp(v,-.12,1.12);
  return true;
}

function isDeadSpace(point) {
  return point.y<TOP-38||point.y>BOTTOM+70||point.x<78||point.x>W-78;
}

function createLooseInsert(point) {
  const sheet=1000+nextInsertId++,item={sheet,title:`Loose note ${nextInsertId-1}`,
    front:'A scrap of paper, waiting for a note.',back:'The reverse is blank.',type:'note'};
  customInserts.push(item);
  itemMounts.set(sheet,{taped:false,anchorPage:null,frontPage:null,pageNumber:null,back:false,under:false,
    outside:true,outsideX:clamp(point.x,68,W-68),outsideY:clamp(point.y,72,H-72),u:.5,v:.5,rotation:-.04});
  draw();refreshKeepsakes();$('#status').textContent='Loose insert made. Drag it onto either page; right-click the empty margin to add another.';
}

canvas.addEventListener('contextmenu',e=>{
  const p=point(e);
  if(closed3DActive()){
    e.preventDefault();const hit=closedBooks3D.hit(p);
    if(hit){closedBooks3D.selected=hit;draw();showBookContextMenu(e.clientX,e.clientY);}else hideBookContextMenu();
    return;
  }
  if(!loaded||closedEdge||coverMotion||spineView||spineMotion||motion||!isDeadSpace(p))return;
  e.preventDefault();createLooseInsert(p);
});
function insertPlaneCoordinates(item,number,state,p){
  const side=number%2===0?1:-1,amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
  const chain=resting(side,amount),width=128*208/180*(item.type==='feather'?3:1);
  let rx=0,ry=0;
  for(let i=0;i<8;i++){
    const q=rigidInsertPoint(chain,side,number,state,rx,ry,width),a=rigidInsertPoint(chain,side,number,state,rx+1,ry,width),b=rigidInsertPoint(chain,side,number,state,rx,ry+1,width);
    const ax=a.x-q.x,ay=a.y-q.y,bx=b.x-q.x,by=b.y-q.y,det=ax*by-ay*bx;
    if(Math.abs(det)<.001)break;
    rx+=((p.x-q.x)*by-(p.y-q.y)*bx)/det;ry+=(ax*(p.y-q.y)-ay*(p.x-q.x))/det;
  }
  return {rx,ry};
}
canvas.addEventListener('pointerdown',e=>{
  if(spineView||spineMotion)return;
  if(closedEdge){animateCover(closedEdge,false);return;}
  if(coverMotion)return;
  const p=point(e);
  const bookmarkHit=itemHit(p);if(bookmarkHit?.hiddenMark){navigateToChapter(itemState(bookmarkHit.item).edgeMark.page);return;}
  if((p.y<100||p.y>590)&&!bookmarkHit)return;
  const toc=tocHitAreas.find(area=>p.x>=area.x&&p.x<=area.x+area.w&&p.y>=area.y&&p.y<=area.y+area.h);
  if(toc){navigateToChapter(toc.target);return;}
  const hit=itemHit(p);
  if(hit) {
    const state=itemState(hit.item);
    if(state.taped){openItem(hit.item,hit.back,hit.pageNumber);return;}
    const angle=state.rotation,dx=p.x-hit.x,dy=p.y-hit.y;
    const grabX=dx*Math.cos(angle)+dy*Math.sin(angle),grabY=-dx*Math.sin(angle)+dy*Math.cos(angle);
    let surfaceGrab=null;
    if(!state.outside) {
      const side=hit.pageNumber%2===0?1:-1,amount=side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1);
      const chain=resting(side,amount),width=128*208/180*(hit.item.type==='feather'?3:1);
      let rx=0,ry=0;
      for(let i=0;i<8;i++) {
        const q=rigidInsertPoint(chain,side,hit.pageNumber,state,rx,ry,width),a=rigidInsertPoint(chain,side,hit.pageNumber,state,rx+1,ry,width),b=rigidInsertPoint(chain,side,hit.pageNumber,state,rx,ry+1,width);
        const ax=a.x-q.x,ay=a.y-q.y,bx=b.x-q.x,by=b.y-q.y,det=ax*by-ay*bx;
        if(Math.abs(det)<.001)break;
        rx+=((p.x-q.x)*by-(p.y-q.y)*bx)/det;ry+=(ax*(p.y-q.y)-ay*(p.x-q.x))/det;
      }
      surfaceGrab={rx,ry};
    }
    const width=128*208/180*(hit.item.type==='feather'?3:1),height=96*164/136*(hit.item.type==='feather'?3:1);
    const plane=surfaceGrab||{rx:dx,ry:dy},localX=plane.rx*Math.cos(angle)+plane.ry*Math.sin(angle),localY=-plane.rx*Math.sin(angle)+plane.ry*Math.cos(angle);
    const rotating=e.altKey;
    itemDrag={item:hit.item,pageNumber:hit.pageNumber,startX:p.x,startY:p.y,x:hit.x,y:hit.y,
      grabX,grabY,surfaceGrab,startRotation:angle,rotating,startPointerAngle:Math.atan2(plane.ry,plane.rx),
      localX,localY,inertia:(width*width+height*height)/12,lastPointer:p,moved:false};
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';draw();return;
  }
  if(Math.abs(p.x-CX)<90)return;
  const direction=p.x>CX?1:-1;
  stopAuto();if(!begin(direction,true)||!motion)return;
  drag={x:p.x,direction,moved:false};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(itemDrag) {
    const p=point(e),dx=p.x-itemDrag.startX,dy=p.y-itemDrag.startY;
    if(Math.hypot(dx,dy)>5)itemDrag.moved=true;
    if(itemDrag.rotating){
      const state=itemState(itemDrag.item),plane=state.outside?{rx:p.x-itemDrag.x,ry:p.y-itemDrag.y}:insertPlaneCoordinates(itemDrag.item,itemDrag.pageNumber,state,p);
      const delta=Math.atan2(plane.ry,plane.rx)-itemDrag.startPointerAngle;
      state.rotation=itemDrag.startRotation+Math.atan2(Math.sin(delta),Math.cos(delta));
      canvas.style.cursor='crosshair';draw();return;
    }
    // A uniform rectangular lamina pulled at one material point. Torque and
    // translation share displacement according to distributed inertia. The
    // final pin constraint keeps that material point under the pointer.
    const d=itemDrag,state=itemState(d.item),from=d.lastPointer;
    const steps=Math.max(1,Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)/8));
    for(let i=1;i<=steps;i++){
      const pointer={x:mix(from.x,p.x,i/steps),y:mix(from.y,p.y,i/steps)};
      const c=Math.cos(state.rotation),s=Math.sin(state.rotation),rx=d.localX*c-d.localY*s,ry=d.localX*s+d.localY*c;
      const target=state.outside?{rx:pointer.x-d.x,ry:pointer.y-d.y}:insertPlaneCoordinates(d.item,d.pageNumber,state,pointer);
      state.rotation+=(rx*(target.ry-ry)-ry*(target.rx-rx))/(d.inertia+rx*rx+ry*ry);
      const C=Math.cos(state.rotation),S=Math.sin(state.rotation),grab={rx:d.localX*C-d.localY*S,ry:d.localX*S+d.localY*C,pointer};
      const center={x:pointer.x-grab.rx,y:pointer.y-grab.ry};
      if(placeLooseItem(d.item,center,state.outside?null:grab))d.pageNumber=state.pageNumber;
      d.x=state.outside?state.outsideX:center.x;d.y=state.outside?state.outsideY:center.y;
    }
    d.lastPointer=p;
    canvas.style.cursor='grabbing';draw();return;
  }
  if(!drag||!motion){
    const p=point(e),toc=tocHitAreas.find(area=>p.x>=area.x&&p.x<=area.x+area.w&&p.y>=area.y&&p.y<=area.y+area.h);
    const nextHighlight=toc?.row??-1;
    if(nextHighlight!==highlightedToc){highlightedToc=nextHighlight;if(tocHitAreas.length)draw();}
    canvas.style.cursor=(toc||itemHit(p))?'pointer':'grab';return;
  }
  const p=point(e),delta=(drag.x-p.x)*drag.direction;
  if(Math.abs(delta)>5)drag.moved=true;
  motion.progress=clamp(delta/640);draw();
});
canvas.addEventListener('pointerup',e=>{
  if(itemDrag) {
    const current=itemDrag, moved=current.moved;itemDrag=null;canvas.style.cursor='grab';
    if(moved){rememberEdgeBookmark(current.item);refreshKeepsakes();draw();}
    else if(itemState(current.item).edgeMark)navigateToChapter(itemState(current.item).edgeMark.page);
    else openItem(current.item,itemState(current.item).back,current.pageNumber);
    return;
  }
  if(!drag||!motion)return;
  const commit=!drag.moved||motion.progress>.22;
  drag=null;settle(commit);
});
canvas.addEventListener('pointercancel',()=>{
  if(itemDrag){itemDrag=null;refreshKeepsakes();draw();return;}
  if(drag&&motion){drag=null;settle(false);}
});
// Closed models are isolated from the turning-sheet mesh and insert ownership.
const closedMaterialCache=new Map();
let closedSceneKey='';
let closedSceneSyncing=false;
const current3DBook=()=>({...bookContent,id:activeBookId||'current-unsaved',name:bookName,pageCount});
function closed3DActive(){return loaded&&!coverMotion&&!closedFlipMotion&&!spineMotion&&(bookTableMode||!!closedEdge||spineView);}
function closedMaterials(book) {
  const palette={outside:'#9b382d',inside:'#c85e68',metal:'gold',...book.palette};
  const key=JSON.stringify([book.name,palette,book.covers,book.edgeBookmarks,effectiveSpineOrnaments(book),bookFormatRatio(book)]);
  if(closedMaterialCache.has(key))return closedMaterialCache.get(key);
  const outside=tintCoverSprite(baseAssets.front,'outside',palette);
  const symbols=tintCoverSprite(baseAssets.symbols,'symbols',palette);
  const makeCover=edge=>{
    // Both boards share the same local spine-to-fore-edge orientation. The
    // back mesh reverses its longitudinal winding, not its width: mirroring
    // the sprite again puts its corner guards against the spine.
    const source=outside,bounds=opaqueBounds(source);
    const surface=spriteSurface(400,565),p=surface.getContext('2d');p.imageSmoothingEnabled=false;
    adaptPageTextContext(p,bookFormatRatio(book)/(320/450));
    p.drawImage(source,bounds.left,bounds.top,bounds.right-bounds.left,bounds.bottom-bounds.top,0,0,400,565);
    const cover=book.covers?.[edge]||{},title=String(cover.title||'').trim();
    const placement=cover.placement||'center',v=placement==='top'?.25:placement==='bottom'?.76:.46;
    if(Number.isInteger(cover.symbol)&&cover.symbol>=0&&cover.symbol<36){
      const cell=symbols.width/6,pad=cell*.045,index=cover.symbol;
      p.drawImage(symbols,(index%6)*cell+pad,Math.floor(index/6)*cell+pad,cell-pad*2,cell-pad*2,136,title?(placement==='center'?379:266):192,128,141);
    }
    if(title){let size=34;p.textAlign='center';p.textBaseline='middle';const family={serif:'Georgia',pixel:'monospace',script:'cursive'}[cover.font]||'Georgia';
      do{p.font=`${size}px ${family}`;if(p.measureText(title).width<320)break;size--;}while(size>10);
      p.strokeStyle='#301c19';p.lineWidth=3;p.strokeText(title,200,v*565);p.fillStyle=palette.metal==='silver'?'#dce6ee':'#f0cd82';p.fillText(title,200,v*565);
    }return surface;
  };
  const rawSpine=titledSpine(tintCoverSprite(baseAssets.spine,'spine',palette),book.name||'Untitled book',palette,effectiveSpineOrnaments(book)),sb=opaqueBounds(rawSpine);
  const spine=spriteSurface(sb.right-sb.left,sb.bottom-sb.top);spine.getContext('2d').drawImage(rawSpine,-sb.left,-sb.top);
  const bounds=opaqueBounds(assets.stack);
  const bookmarks=(book.edgeBookmarks||[]).filter(entry=>entry.state?.edgeMark&&entry.item).map(entry=>({
    ...entry.state.edgeMark,u:entry.state.u,v:entry.state.v,rotation:entry.state.rotation,
    size:entry.item.type==='feather'?3:1,front:mountedTexture(entry.item,false,entry.state.taped),back:mountedTexture(entry.item,true,false)}));
  const front=makeCover('front'),back=makeCover('back');
  const result={front,back,profiles:{front:coverSilhouette(front),back:coverSilhouette(back)},spine,paper:assets.stack,leather:coverInk(.6,palette.outside),bookmarks,
    paperUV:{x:bounds.left+18,y:bounds.top+3,w:bounds.right-bounds.left-36,h:bounds.bottom-bounds.top-6}};
  if(closedMaterialCache.size>24)closedMaterialCache.delete(closedMaterialCache.keys().next().value);
  closedMaterialCache.set(key,result);return result;
}
function coverSilhouette(texture){
  const p=texture.getContext('2d'),{width:w,height:h}=texture,data=p.getImageData(0,0,w,h).data;
  const opaque=(x,y)=>data[(y*w+x)*4+3]>=96,points=[];
  // Trace the actual outer alpha contour in angular order. Independently
  // scanned rectangle sides can cross at ornate, asymmetric corner guards.
  for(let i=0;i<192;i++){
    const angle=-Math.PI/2+i*Math.PI*2/192,c=Math.cos(angle),s=Math.sin(angle);
    for(let r=Math.hypot(w,h);r>=0;r--){
      const x=Math.round((w-1)/2+c*r),y=Math.round((h-1)/2+s*r);
      if(x>=0&&x<w&&y>=0&&y<h&&opaque(x,y)){points.push({u:x/(w-1),v:y/(h-1)});break;}
    }
  }
  return points;
}
const closedBooks3D=new ClosedBooks3D({canvas,context:ctx,materials:closedMaterials,changed:()=>{if(!closedSceneSyncing){draw();update3DControls();}},open:page=>open3DBook(page)});
function drawClosed3D() {
  const current=current3DBook(),books=bookTableMode?[current,...savedBooks.filter(book=>book.id!==current.id)]:[current];
  const key=JSON.stringify([bookTableMode,spineView,closedEdge,books.map(book=>[book.id,book.pageCount])]);
  if(key!==closedSceneKey){
    closedSceneKey=key;closedSceneSyncing=true;
    try{closedBooks3D.setBooks(books,bookTableMode,current.id);}finally{closedSceneSyncing=false;}
    if(closedEdge==='back'&&!bookTableMode)closedBooks3D.pitch=-.43;
  }
  for(const model of closedBooks3D.models)model.book=books.find(book=>book.id===model.id)||model.book;
  itemHits=[];closedBooks3D.draw();
}
function update3DControls() {
  const active=closed3DActive();$('#book-3d-controls').hidden=!active;
  $('#book-table').disabled=!!motion||!!coverMotion||!!spineMotion||!!closedFlipMotion;
  $('#book-table').textContent=bookTableMode?'Return to open book':'3D book table';
  if(!active)return;
  for(const id of ['move','turn-left','turn-right','stack','spread','copy'])$('#book-3d-'+id).hidden=!bookTableMode;
  $('#book-3d-orbit').setAttribute('aria-pressed',String(closedBooks3D.mode==='orbit'));
  $('#book-3d-move').setAttribute('aria-pressed',String(closedBooks3D.mode==='move'));
  const selected=closedBooks3D.selected?.book?.name||bookName;
  $('#book-3d-help').textContent=bookTableMode?`${selected} · ${closedBooks3D.mode==='move'?'Drag table books to move or stack.':'Drag to orbit; click a book to select.'} Right-click a book for shelf, table and reading actions. Scroll to zoom.`:'Drag to spin the closed book · scroll to zoom · double-click to open';
}
function open3DBook(targetPage=null) {
  if(!closed3DActive())return;
  const scene=captureClosedScene(),selected=closedBooks3D.selected;
  if(Number.isInteger(targetPage))scene.openTarget=targetPage;
  if(bookTableMode&&selected&&selected.id!==(activeBookId||'current-unsaved'))openSavedBook(selected.id,true);
  animateCover(closedEdge||'front',false,scene);
}

// The bridge has two geometric stages: move the actual selected 3D model into
// the reading camera, then hinge its board over an exact open-renderer capture.
// Only the already-aligned endpoint materials are blended at the hand-off.
let bookReturnScene=null;
function captureClosedScene() {
  const r=document.querySelector('.book-stage').getBoundingClientRect();
  return {models:closedBooks3D.models.map(m=>({...m,book:structuredClone(m.book)})),selected:closedBooks3D.selected?.id,
    yaw:closedBooks3D.yaw,pitch:closedBooks3D.pitch,roll:closedBooks3D.roll,distance:closedBooks3D.distance,center:{...closedBooks3D.target()},
    table:bookTableMode,spine:spineView,edge:closedEdge,mode:closedBooks3D.mode,rect:{x:r.x,y:r.y,width:r.width}};
}
function defaultClosedScene(edge) {
  const virtual=new ClosedBooks3D({canvas,context:ctx,materials:closedMaterials,changed:()=>{}});
  virtual.setBooks([current3DBook()]);virtual.pitch=edge==='back'?-.43:.43;
  return {models:virtual.models,selected:virtual.selected.id,yaw:virtual.yaw,pitch:virtual.pitch,roll:virtual.roll,distance:virtual.distance,
    center:{...virtual.target()},table:false,spine:false,edge,mode:'orbit'};
}
function restoreClosedScene(scene) {
  bookTableMode=scene.table;spineView=scene.spine;closedEdge=scene.edge;
  Object.assign(closedBooks3D,{models:scene.models.map(m=>({...m})),yaw:scene.yaw,pitch:scene.pitch,roll:scene.roll||0,distance:scene.distance,
    center:{...scene.center},table:scene.table,mode:scene.mode,gesture:null,dragTarget:null});
  closedBooks3D.selected=closedBooks3D.models.find(m=>m.id===scene.selected)||closedBooks3D.models[0];
  for(const model of closedBooks3D.models){const book=model.id===activeBookId?current3DBook():savedBooks.find(b=>b.id===model.id)||model.book;model.book=book;model.width=450*bookFormatRatio(book);}
  const current=current3DBook(),books=bookTableMode?[current,...savedBooks.filter(book=>book.id!==current.id)]:[current];
  closedSceneKey=JSON.stringify([bookTableMode,spineView,closedEdge,books.map(book=>[book.id,book.pageCount])]);
}
function bridgeCoverPose(edge,amount) {
  const side=edge==='front'?-1:1,seam=side<0?BOARD_SEAM:SPINE_END,target=side<0?SPINE_END:BOARD_SEAM,outer=side<0?0:1024;
  const closedCenter=(coverPoint(target,565).x+coverPoint(side<0?1024:0,565).x)/2;
  const angle=Math.PI*amount,lift=115*Math.sin(angle),hinge=mix(seam,target,amount);
  const top=coverPoint(hinge,0),bottom=coverPoint(hinge,565);
  const wt=Math.abs(coverPoint(outer,0).x-coverPoint(seam,0).x),wb=Math.abs(coverPoint(outer,565).x-coverPoint(seam,565).x);
  return {side,points:[top,{x:top.x+side*wt*Math.cos(angle),y:134-lift},{x:bottom.x+side*wb*Math.cos(angle),y:624-lift},bottom],
    source:[coverPoint(seam,0),coverPoint(outer,0),coverPoint(outer,565),coverPoint(seam,565)],
    tx:(CX-closedCenter)*amount,ty:-20*smooth((amount-.72)/.28)};
}
function bridgeBindingPoint(pose,u,v,amount){
  const moving={x:mix(pose.points[0].x,pose.points[3].x,v),y:mix(pose.points[0].y,pose.points[3].y,v)};
  const fixed=coverPoint(pose.side<0?SPINE_END:BOARD_SEAM,565*v);
  const left=pose.side<0?moving:fixed,right=pose.side<0?fixed:moving;
  const a=coverPoint(BOARD_SEAM,565*v),b=coverPoint(SPINE_END,565*v),original=coverPoint(mix(BOARD_SEAM,SPINE_END,u),565*v);
  // The flexible leather shares both board-edge vertices. Its painted endcap
  // and the inner lining deform together instead of leaving a frozen spine.
  const point={x:mix(left.x,right.x,u)+(original.x-mix(a.x,b.x,u))*(1-amount),
    y:mix(left.y,right.y,u)+(original.y-mix(a.y,b.y,u))*(1-amount)};
  if(v>1){
    // The projecting tail folds upward with the hinge, never sweeping its
    // full flat endcap below the supporting table as the board passes upright.
    const base=bridgeBindingPoint(pose,u,1,amount);
    point.y=base.y+(point.y-base.y)*(1-Math.sin(Math.PI*amount));
  }
  return point;
}
// Warp one continuous open-book capture. Splitting a captured board away from
// a stationary paper rectangle left the old binding/shadow behind as a stump.
// Every strip now shares its source and destination seam with its neighbour.
function drawBridgeSurface(bridge,pose,amount,moving=false){
  const side=pose.side,seam=side<0?BOARD_SEAM:SPINE_END,fixed=side<0?SPINE_END:BOARD_SEAM;
  const top=coverPoint(seam,0),bottom=coverPoint(seam,565);
  const at=(y,t)=>{
    const v=(y-top.y)/(bottom.y-top.y),logicalY=v*565;
    const a=coverPoint(seam,logicalY),b=coverPoint(fixed,logicalY);
    if(t==='outer')return{x:side<0?0:W,y};
    return{x:mix(a.x,b.x,t),y};
  };
  const mapped=(p,t)=>{
    const v=(p.y-top.y)/(bottom.y-top.y);
    if(t==='outer'){
      const seamX=coverPoint(seam,v*565).x,outerX=coverPoint(side<0?0:1024,v*565).x;
      const u=(p.x-seamX)/(outerX-seamX),a=bilerp(pose.points,0,v),b=bilerp(pose.points,1,v);
      return{x:mix(a.x,b.x,u),y:mix(a.y,b.y,u)};
    }
    const a=bridgeBindingPoint(pose,side<0?t:1-t,v,amount);
    // Outside the painted binding's height, keep the captured shadow attached
    // without extrapolating the endcap's curved artwork into spikes.
    return a;
  };
  for(let row=0;row<32;row++){
    const y=row*H/32,Y=(row+1)*H/32;
    const strips=moving?[['outer',0]]:Array.from({length:12},(_,i)=>[i/12,(i+1)/12]);
    for(const [t,T] of strips){
      const uv=[at(y,t),at(y,T),at(Y,T),at(Y,t)];
      quad(bridge.paper,uv,[mapped(uv[0],t),mapped(uv[1],T),mapped(uv[2],T),mapped(uv[3],t)]);
    }
    if(!moving){
      const a=at(y,1),b=at(Y,1),x=side<0?W:0;
      quad(bridge.paper,[a,{x,y},{x,y:Y},b],[mapped(a,1),{x,y},{x,y:Y},mapped(b,1)]);
    }
  }
}
function drawBridgeFold(bridge,amount) {
  coverMotion.amount=amount;
  if(amount<=1e-6){ctx.drawImage(bridge.paper,0,0,W,H);return;}
  if(amount>=1-1e-6){drawCoverScene();bridge.drawTabs?.(1);return;}
  const pose=bridgeCoverPose(bridge.edge,amount),{points,source,side}=pose;
  ctx.save();ctx.translate(pose.tx,pose.ty);
  // Keep all exposed paper, writing and keepsakes in their original renderer.
  ctx.save();ctx.globalAlpha*=1-smooth((amount-.8)/.2);
  drawBridgeSurface(bridge,pose,amount);ctx.restore();
  const layers=closedBookLayers(points,amount);
  if(layers.visibility>0){
    ctx.save();ctx.globalAlpha*=layers.visibility;
    const far=bridge.edge==='front'?assets.back:assets.front,b=opaqueBounds(far),pb=opaqueBounds(assets.stack);
    quad(far,[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}],layers.farBoard);
    path(layers.paper);ctx.fillStyle='#d9a45d';ctx.fill();
    quad(assets.stack,[{x:pb.left+18,y:pb.top+3},{x:pb.right-18,y:pb.top+3},{x:pb.right-18,y:pb.bottom-3},{x:pb.left+18,y:pb.bottom-3}],layers.paper);
    ctx.restore();
  }
  if(amount<.5)drawBridgeSurface(bridge,pose,amount,true);
  else {
    const image=bridge.edge==='front'?assets.front:assets.back,b=opaqueBounds(image),u0=side<0?b.left:b.right,u1=side<0?b.right:b.left;
    const width=(10+pageCount*.15)*smooth((amount-.5)/.5),spine=assets.closedSpine;
    quad(spine,[{x:side<0?0:spine.width,y:0},{x:side<0?spine.width:0,y:0},{x:side<0?spine.width:0,y:spine.height},{x:side<0?0:spine.width,y:spine.height}],
      [{x:points[0].x+side*width,y:points[0].y},points[0],points[3],{x:points[3].x+side*width,y:points[3].y}]);
    quad(image,[{x:u0,y:b.top},{x:u1,y:b.top},{x:u1,y:b.bottom},{x:u0,y:b.bottom}],points);
    paintCoverCustomization(bridge.edge,points);
  }
  ctx.restore();
  if(amount>.8)bridge.drawTabs?.(smooth((amount-.8)/.2));
}
function startCoverBridge(edge,closing,sourceScene) {
  const stage=document.querySelector('.book-stage'),originalStyle=stage.style.cssText;
  const startRect=sourceScene?.rect||stage.getBoundingClientRect();
  let scene=sourceScene||(!closing&&closed3DActive()?captureClosedScene():null);
  if(!scene)scene=bookReturnScene?.selected===(activeBookId||'current-unsaved')?bookReturnScene:defaultClosedScene(edge);
  // Read the live cover configuration when returning, without moving its stack.
  scene={...scene,models:scene.models.map(m=>m.id===(activeBookId||'current-unsaved')?{...m,book:current3DBook(),height:ClosedBooks3D.thickness(pageCount),width:m.length*bookFormatRatio(bookContent)}:{...m})};
  if(closing&&!scene.table&&!scene.spine){scene.edge=edge;if((scene.pitch<0)!==(edge==='back'))scene.pitch=-scene.pitch;}
  if(!closing)bookReturnScene=scene;
  const resumeAuto=!closing&&$('#autoplay').getAttribute('aria-pressed')==='true';
  stopAuto();drag=null;closedBooks3D.gesture=null;closedBooks3D.dragTarget=null;
  bookTableMode=false;spineView=false;closedEdge=null;spread=edge==='front'?0:spreadCount()-1;
  draw();const paper=spriteSurface(W,H);paper.getContext('2d').imageSmoothingEnabled=false;paper.getContext('2d').drawImage(canvas,0,0,W,H);
  if(closing)restoreClosedScene(scene);
  updateControls();const endRect=stage.getBoundingClientRect();
  bookTableMode=false;spineView=false;closedEdge=null;
  const virtual=new ClosedBooks3D({canvas,context:ctx,materials:closedMaterials,changed:()=>{}});
  Object.assign(virtual,{models:scene.models.map(m=>({...m})),table:scene.table,mode:scene.mode});
  virtual.selected=virtual.models.find(m=>m.id===scene.selected)||virtual.models[0];
  virtual.placeShelf();
  const selected=virtual.selected,initialAngle=selected.angle,targetCenter=virtual.world(selected,0,selected.height/2,0);
  const project=virtual.project.bind(virtual),targetPose=bridgeCoverPose(edge,1),targetLayers=closedBookLayers(targetPose.points,1);
  const canonical=edge==='front'?targetPose.points:[targetPose.points[1],targetPose.points[0],targetPose.points[3],targetPose.points[2]];
  const bridge={edge,closing,paper,progress:0,virtual,scene,morph:0,align:0,phase:'3d',
    draw(){
      const q=closing?1-this.progress:this.progress;
      if(q>=.45){this.phase='hinge';drawBridgeFold(this,1-sine((q-.45)/.55));return;}
      this.phase='3d';this.align=sine(q/.45);this.morph=smooth(q/.45);
      virtual.yaw=mix(scene.yaw,Math.round(scene.yaw/(Math.PI*2))*Math.PI*2,this.align);
      virtual.pitch=mix(scene.pitch,edge==='back'?-1.2:1.2,this.align);virtual.distance=mix(scene.distance,1050,this.align);
      virtual.roll=mix(scene.roll||0,0,this.align);
      virtual.center={x:mix(scene.center.x,targetCenter.x,this.align),y:mix(scene.center.y,targetCenter.y,this.align),z:mix(scene.center.z,targetCenter.z,this.align)};
      selected.angle=mix(initialAngle,0,this.align);virtual.floorOpacity=1-this.align;virtual.lightStrength=1-this.morph;
      virtual.noSelection=q>0;virtual.faceOpacity=face=>face.model===selected?1:1-this.align;
      const blend=smooth((this.morph-.75)/.25);
      ctx.save();ctx.globalAlpha*=1-blend;virtual.draw();ctx.restore();
      if(blend>0){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=blend;ctx.drawImage(this.closedNative,0,0);ctx.restore();}
    }};
  virtual.project=world=>{
    const base=project(world);if(virtual.projectedModel!==selected||bridge.morph<=0)return base;
    const local=virtual.local(selected,world),u=(local.x+selected.width/2)/selected.width,v=edge==='front'?(local.z+selected.length/2)/selected.length:(selected.length/2-local.z)/selected.length;
    const at=bilerp(canonical,u,v),depth=edge==='front'?(selected.height-local.y)/selected.height:local.y/selected.height;
    return {x:mix(base.x,at.x+targetPose.tx,bridge.morph),y:mix(base.y,at.y+targetPose.ty+depth*(targetLayers.depth+5),bridge.morph),depth:base.depth};
  };
  bridge.drawTabs=alpha=>{
    const oldMorph=bridge.morph,oldAngle=selected.angle;
    bridge.morph=1;selected.angle=0;virtual.yaw=0;virtual.pitch=edge==='back'?-1.2:1.2;virtual.roll=0;virtual.distance=1050;virtual.center=targetCenter;
    virtual.floorOpacity=0;virtual.lightStrength=0;virtual.noSelection=true;virtual.faceOpacity=face=>face.bookmarkPage!==undefined?alpha:0;
    virtual.draw();bridge.morph=oldMorph;selected.angle=oldAngle;
  };
  // Composite the material hand-off as whole premultiplied layers. Individual
  // legacy drawing routines set alpha internally and must not bypass the mix.
  bridge.closedNative=spriteSurface(canvas.width,canvas.height);
  ctx.clearRect(0,0,W,H);coverMotion={edge,amount:1};drawCoverScene();
  bridge.drawTabs(1);
  bridge.closedNative.getContext('2d').drawImage(canvas,0,0);
  coverMotion={edge,amount:closing?0:1,bridge};updateControls();
  document.body.classList.add('book-transitioning');
  const main=document.querySelector('main'),wasInert=main.inert;main.inert=true;
  const place=t=>{stage.style.cssText=originalStyle;Object.assign(stage.style,{position:'fixed',margin:'0',zIndex:'20',
    left:mix(startRect.x,endRect.x,t)+'px',top:mix(startRect.y,endRect.y,t)+'px',width:mix(startRect.width,endRect.width,t)+'px'});};
  place(0);draw();
  const start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?120:Math.max(850,Number($('#speed').value)*1.4+500);
  bridge.start=start;bridge.duration=duration;
  const frame=now=>{
    const t=clamp((now-start)/duration);bridge.progress=t;place(sine(t));draw();
    if(t<1){raf=requestAnimationFrame(frame);return;}
    coverMotion=null;raf=0;if(closing)restoreClosedScene(scene);else {bookTableMode=false;spineView=false;closedEdge=null;}
    stage.style.cssText=originalStyle;main.inert=wasInert;document.body.classList.remove('book-transitioning');updateControls();draw();
    if(!closing&&Number.isInteger(scene.openTarget)){navigateToChapter(scene.openTarget);return;}
    if(resumeAuto){$('#autoplay').setAttribute('aria-pressed','true');autoTimer=setTimeout(()=>begin(autoDirection),550);}
  };raf=requestAnimationFrame(frame);return true;
}
function toggleBookTable(){
  if(motion||coverMotion||spineMotion||closedFlipMotion)return;
  if(bookTableMode){open3DBook();return;}
  stopAuto();bookTableMode=!bookTableMode;spineView=false;closedEdge=null;closedSceneKey='';
  $('#shelf').close();updateControls();draw();update3DControls();
}
$('#book-table').onclick=$('#shelf-table').onclick=toggleBookTable;
$('#book-3d-open').onclick=open3DBook;
$('#book-3d-orbit').onclick=()=>{closedBooks3D.mode='orbit';update3DControls();};
$('#book-3d-move').onclick=()=>{closedBooks3D.mode='move';update3DControls();};
$('#book-3d-reset').onclick=()=>closedBooks3D.reset(closedEdge==='back'&&!bookTableMode);
$('#book-3d-turn-left').onclick=()=>closedBooks3D.rotateBook(Math.PI/12);
$('#book-3d-turn-right').onclick=()=>closedBooks3D.rotateBook(-Math.PI/12);
$('#book-3d-stack').onclick=()=>closedBooks3D.arrange(true);
$('#book-3d-spread').onclick=()=>closedBooks3D.arrange(false);
$('#book-3d-copy').onclick=()=>{saveBook(true);closedSceneKey='';draw();update3DControls();};
const bookContextMenu=document.createElement('div');bookContextMenu.id='book-context-menu';bookContextMenu.hidden=true;bookContextMenu.setAttribute('role','menu');bookContextMenu.setAttribute('aria-label','Book actions');document.body.append(bookContextMenu);
function hideBookContextMenu(){bookContextMenu.hidden=true;}
function showBookContextMenu(x,y){
  const m=closedBooks3D.selected;if(!m)return;
  bookContextMenu.replaceChildren();
  const title=document.createElement('p');title.textContent=m.book.name;bookContextMenu.append(title);
  const action=(label,callback)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.onclick=()=>{hideBookContextMenu();callback();};bookContextMenu.append(b);};
  if(bookTableMode)action(m.shelved?'Move to table':'Move to bookshelf',()=>closedBooks3D.moveSelected(!m.shelved));
  action('Read book',()=>open3DBook());
  action('View cover',()=>{
    const id=m.id;if(id!==activeBookId)openSavedBook(id,true);
    bookTableMode=false;spineView=false;closedEdge='front';closedSceneKey='';updateControls();draw();
  });
  bookContextMenu.hidden=false;bookContextMenu.style.left='0px';bookContextMenu.style.top='0px';
  const r=bookContextMenu.getBoundingClientRect();bookContextMenu.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';bookContextMenu.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';bookContextMenu.querySelector('button')?.focus();
}
document.addEventListener('pointerdown',e=>{if(!bookContextMenu.contains(e.target))hideBookContextMenu();});
document.addEventListener('keydown',e=>{
  if(bookContextMenu.hidden)return;
  if(e.key==='Escape'){hideBookContextMenu();canvas.focus();e.preventDefault();}
  else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();const items=[...bookContextMenu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
    items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  }
});
canvas.addEventListener('keydown',e=>{if(closed3DActive()&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();const r=canvas.getBoundingClientRect();showBookContextMenu(r.x+r.width/2,r.y+r.height/2);}});
for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])canvas.addEventListener(type,event=>{
  if(!closed3DActive())return;
  event.stopImmediatePropagation();event.preventDefault();
  if(type==='pointerdown'){if(event.button!==0)return;closedBooks3D.pointerDown(point(event));canvas.setPointerCapture(event.pointerId);}
  else if(type==='pointermove')closedBooks3D.pointerMove(point(event));
  else {closedBooks3D.pointerUp(type==='pointercancel');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}
},true);
canvas.addEventListener('wheel',event=>{if(closed3DActive()){event.preventDefault();closedBooks3D.zoom(event.deltaY);}},{passive:false});
canvas.addEventListener('dblclick',event=>{if(closed3DActive()){event.preventDefault();open3DBook();}});
document.addEventListener('keydown',event=>{
  if(!closed3DActive()||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName)||document.querySelector('dialog[open]'))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','+','-','q','e'].includes(event.key)){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.key==='Enter')return open3DBook();
    if(event.key==='q'||event.key==='e')closedBooks3D.rotateBook(event.key==='q'?.15:-.15);
    else if(event.key==='+'||event.key==='-')closedBooks3D.zoom(event.key==='+'?-100:100);
    else {closedBooks3D.orbitBy(event.key==='ArrowLeft'?-20:event.key==='ArrowRight'?20:0,event.key==='ArrowUp'?-20:event.key==='ArrowDown'?20:0);draw();}
  }
},true);
load();
