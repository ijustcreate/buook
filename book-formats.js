'use strict';
// Material coordinates remain stable for saved drawings and bookmarks.
const ORIGINAL_PAGE_RATIO=400/392;
function bookFormat(book=bookContent){
  const id=book.starterId,base=starterLibrary.get(id);
  const source=id==='inferno-dore'?{widthPt:553,heightPt:734}:book.format||base?.format;
  const config=book.pageFormat||{},mode=config.mode||(source?'source':'wide');
  const presets={wide:{widthPt:648*ORIGINAL_PAGE_RATIO,heightPt:648},portrait:{widthPt:486,heightPt:648},trade:{widthPt:432,heightPt:648},square:{widthPt:648,heightPt:648}};
  const format=mode==='source'&&source?source:mode==='custom'?{widthPt:Math.max(70,Math.min(400,Number(config.widthMm)||150))*72/25.4,heightPt:Math.max(90,Math.min(500,Number(config.heightMm)||210))*72/25.4}:presets[mode]||presets.wide;
  return{...format,mode,ratio:Math.max(.4,Math.min(1.5,format.widthPt/format.heightPt)),centerVerse:config.centerVerse??['inferno-dore','divine-comedy'].includes(id)};
}
const bookFormatRatio=book=>bookFormat(book).ratio;
let activePageWidthScale=1;
const bookWidthScale=()=>activePageWidthScale;
const syncActivePageFormat=()=>activePageWidthScale=bookFormatRatio(bookContent)/ORIGINAL_PAGE_RATIO;
function adaptPageTextContext(p,scale=bookWidthScale()){
  if(p.pageTextAdapter){p.pageTextScale=scale;return p;}p.pageTextAdapter=true;p.pageTextScale=scale;
  const measure=p.measureText.bind(p);
  p.measureText=text=>{const m=measure(text),s=p.pageTextScale;return new Proxy(m,{get:(target,key)=>{const value=Reflect.get(target,key,target);return ['width','actualBoundingBoxLeft','actualBoundingBoxRight'].includes(key)?value/s:value;}});};
  for(const name of ['fillText','strokeText']){
    const draw=p[name].bind(p);p[name]=(text,x,y,maxWidth)=>{p.save();p.translate(x,y);p.scale(1/p.pageTextScale,1);if(maxWidth===undefined)draw(text,0,0);else draw(text,0,0,maxWidth*p.pageTextScale);p.restore();};
  }
  return p;
}
function updateBookFormatControls(){
  syncActivePageFormat();
  const select=document.querySelector('#page-format');if(!select)return;const f=bookFormat();select.value=f.mode;
  document.querySelector('#page-format-custom').hidden=f.mode!=='custom';
  if(document.activeElement!==document.querySelector('#format-width'))document.querySelector('#format-width').value=Math.round(f.widthPt*25.4/72);
  if(document.activeElement!==document.querySelector('#format-height'))document.querySelector('#format-height').value=Math.round(f.heightPt*25.4/72);
  document.querySelector('#format-verse').checked=f.centerVerse;document.querySelector('#page-format-size').textContent=`${Math.round(f.widthPt*25.4/72)} × ${Math.round(f.heightPt*25.4/72)} mm`;
  for(const id of ['page-format','format-width','format-height','format-verse'])document.querySelector('#'+id).disabled=!!motion||!!coverMotion;
}
function initBookFormatControls(){
  const group=document.createElement('fieldset');group.className='book-format-options';group.innerHTML=`<legend>Page shape</legend><label>Format <select id="page-format"><option value="source">Source PDF proportions</option><option value="wide">Original wide</option><option value="portrait">Portrait · 3:4</option><option value="trade">Trade · 2:3</option><option value="square">Square</option><option value="custom">Custom trim</option></select></label><span id="page-format-size"></span><span id="page-format-custom" hidden><label>Width mm <input id="format-width" type="number" min="70" max="400"></label><label>Height mm <input id="format-height" type="number" min="90" max="500"></label></span><label class="check"><input id="format-verse" type="checkbox">Centre verse column · keep lines left-aligned</label>`;document.querySelector('.options').append(group);
  const apply=()=>{
    if(motion||coverMotion)return;
    bookContent.pageFormat={mode:document.querySelector('#page-format').value,widthMm:Number(document.querySelector('#format-width').value)||150,heightMm:Number(document.querySelector('#format-height').value)||210,centerVerse:document.querySelector('#format-verse').checked};
    const saved=savedBooks.find(b=>b.id===activeBookId);if(saved){saved.pageFormat=structuredClone(bookContent.pageFormat);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}
    persistBookContent();textures.clear();shadedTextures.clear();bookBodySizes.clear();measuredWordWidths.clear();closedMaterialCache.clear();closedSceneKey='';updateControls();draw();
  };
  for(const id of ['page-format','format-width','format-height','format-verse'])document.querySelector('#'+id).onchange=apply;updateBookFormatControls();
}
