'use strict';
// The page workshop edits semantic book content, not a catch-all note form.
// Source editions remain immutable; overrides and undo snapshots are local.
const workshopUndo=new Map();let workshopSyncing=false,workshopBook='';
const workshop=document.createElement('dialog');workshop.id='page-workshop';workshop.setAttribute('aria-labelledby','workshop-heading');
workshop.innerHTML=`<header class="workshop-header"><div><small>THE BOOKBINDER'S WORKSHOP</small><h2 id="workshop-heading">Edit pages</h2><p id="workshop-book"></p></div><button id="workshop-close" type="button">Back to book ×</button></header>
<div class="workshop-layout"><aside class="workshop-navigation"><label>Find a page<input id="workshop-search" type="search" placeholder="Chapter, contents, page…"></label><label id="workshop-page-slot">Page</label><div id="workshop-outline"></div><p class="save-hint">PDF pagination stays fixed. Changes affect this local copy, never the source PDF.</p></aside>
<section class="workshop-preview"><div class="workshop-preview-bar"><button id="workshop-previous" aria-label="Edit previous page">←</button><output id="workshop-folio"></output><button id="workshop-next" aria-label="Edit next page">→</button></div><canvas id="workshop-canvas" width="800" height="700" aria-label="Live flat-page print preview"></canvas><p id="workshop-warning" role="status"></p><p class="save-hint">Live print preview · book-wide body size · no fit-to-fill stretching</p></section>
<section class="workshop-inspector"><label>Page composition<select id="workshop-type"><option value="prose">Prose / body text</option><option value="chapter">Chapter or front-matter opening</option><option value="title">Title and author</option><option value="contents">Linked contents</option><option value="verse">Verse / dialogue</option><option value="illustration">Illustrated page</option><option value="blank">Intentional blank</option></select></label>
<div class="workshop-tabs" role="tablist" aria-label="Page editing tools"><button role="tab" aria-selected="true" data-workshop-tab="content">Content</button><button role="tab" aria-selected="false" data-workshop-tab="layout">Typography</button><button role="tab" aria-selected="false" data-workshop-tab="media">Illustrations</button></div>
<div id="workshop-content" role="tabpanel"><label id="workshop-author-label">Author / subtitle<input id="workshop-author"></label><div id="workshop-contents"><p>Each row links to a physical PDF page. The printed folio can differ.</p><div id="workshop-rows"></div><button id="workshop-add-row" type="button">Add contents entry</button></div></div><div id="workshop-layout" role="tabpanel" hidden><p class="save-hint">Body size is shared across this edition. Choose the book font in the main toolbar. Sparse pages retain their whitespace.</p></div><div id="workshop-media" role="tabpanel" hidden><h3>Source illustrations</h3><div id="workshop-source-art"></div><h3>Your images & drawing</h3></div>
<footer class="workshop-footer"><button id="workshop-undo" type="button">Undo this page</button><button id="workshop-reset" type="button">Restore source…</button><output id="workshop-saved" role="status">Saved locally</output></footer></section></div>`;
document.body.append(workshop);
const workshopOpenButton=document.createElement('button');workshopOpenButton.id='edit-pages-open';workshopOpenButton.textContent='Edit pages';workshopOpenButton.type='button';$('.library-toolbar').append(workshopOpenButton);
// Reuse image/pixel editing engines, while replacing the complete editor shell,
// page navigation, content model, field routing and preview from the old UI.
$('#workshop-page-slot').append($('#edit-page'));
$('#workshop-content').append($('#page-edit-controls'));$('#page-edit-controls').hidden=false;
for(const id of ['page-font','page-ink','page-paper','page-number-position'])$('#workshop-layout').append($('#'+id).closest('label'));
for(const node of [$('#page-image-file').closest('label'),$('.image-library'),$('.pixel-editor')])$('#workshop-media').append(node);
$('#edit-mode').closest('label').hidden=true;
for(const id of ['page-role','toc-label','edit-eyebrow'])$('#'+id).closest('label').hidden=true;
$('#edit-title').maxLength=180;$('#edit-title').placeholder='Heading or title';$('#edit-body').removeAttribute('maxlength');$('#edit-body').rows=12;
$('#edit-title').closest('label').firstChild.textContent='Heading / title ';
$('#edit-body').closest('label').firstChild.textContent='Text · blank lines separate paragraphs ';
$('#insert-text').closest('label').hidden=true;
$('#page-edit-controls .save-hint').textContent='Changes save automatically to this local book. Undo restores the page as it was when you opened the workshop.';

function workshopKind(data){return data.titlePage||data.role==='title'?'title':data.tocRows||data.role==='contents'?'contents':data.chapterOpening||data.role==='section'?'chapter':data.preserveLines?'verse':data.sourceFigures?.length||data.images?.length?'illustration':!data.body?.trim()?'blank':'prose';}
function workshopRemember(number){if(!workshopUndo.has(number))workshopUndo.set(number,{exists:Object.hasOwn(bookContent.pages,number),value:structuredClone(bookContent.pages[number])});}
function workshopPersist(){
  persistBookContent();const saved=savedBooks.find(b=>b.id===activeBookId);if(saved){saved.pages=structuredClone(bookContent.pages);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}
  textures.clear();shadedTextures.clear();draw();refreshWorkshopPreview();$('#workshop-saved').textContent='Saved locally';
}
function workshopSelect(number){
  number=clamp(number,0,readingPageCount()-1);workshopRemember(number);workshopSyncing=true;
  loadPageIntoEditor(number);$('#edit-page').value=String(number);const data=bookPage(number),kind=workshopKind(data);
  $('#workshop-type').value=kind;$('#edit-title').value=data.titlePage?.title||data.chapterOpening||data.title||'';$('#workshop-author').value=data.titlePage?.author||'';
  $('#edit-body').value=data.chapterOpening&&data.body?.startsWith(data.chapterOpening)?data.body.slice(data.chapterOpening.length).trim():data.body||'';
  workshopRenderRows(data.tocRows||[]);workshopRouteFields();workshopRenderSourceArt(data);workshopSyncing=false;refreshWorkshopPreview();
}
function workshopRouteFields(){
  const type=$('#workshop-type').value;
  $('#edit-title').closest('label').hidden=!['title','chapter'].includes(type);$('#workshop-author-label').hidden=type!=='title';$('#workshop-contents').hidden=type!=='contents';$('#edit-body').closest('label').hidden=['title','contents','blank'].includes(type);
  $('#workshop-source-art').closest('div').hidden=false;
}
function workshopRenderRows(rows){
  const list=$('#workshop-rows');list.replaceChildren();
  rows.forEach((row,i)=>{
    const item=document.createElement('div');item.className='workshop-toc-row';
    const label=document.createElement('input'),folio=document.createElement('input'),target=document.createElement('input');
    label.value=row.label;label.setAttribute('aria-label','Entry '+(i+1)+' label');label.placeholder='Chapter I';
    folio.value=row.folio;folio.setAttribute('aria-label','Entry '+(i+1)+' printed folio');folio.title='Printed folio';
    target.type='number';target.min=1;target.max=readingPageCount();target.value=row.target+1;target.setAttribute('aria-label','Entry '+(i+1)+' destination page');target.title='PDF destination page';
    for(const input of [label,folio,target])input.oninput=saveWorkshopPage;
    const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove entry '+(i+1));remove.onclick=()=>{item.remove();saveWorkshopPage();};
    item.append(label,folio,target,remove);list.append(item);
  });
}
function workshopRenderSourceArt(data){
  const list=$('#workshop-source-art');list.replaceChildren();
  for(const [i,figure] of (data.sourceFigures||[]).entries()){
    const frame=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=figure.src;img.alt=figure.alt;caption.textContent=figure.alt;
    const remove=document.createElement('button');remove.type='button';remove.textContent='Hide in this copy';remove.onclick=()=>{workshopRemember(selectedEditPage);const p=currentPage();p.sourceFigures.splice(i,1);workshopPersist();workshopRenderSourceArt(p);};frame.append(img,caption,remove);list.append(frame);
    if(figure.originalSrc&&figure.processedSrc){const toggle=document.createElement('button');toggle.type='button';toggle.textContent=figure.src===figure.originalSrc?'Use pixel ink':'Use original';toggle.onclick=()=>{const page=currentPage(),f=page.sourceFigures[i];f.src=f.src===f.originalSrc?f.processedSrc:f.originalSrc;getSourceIllustration(f.src);workshopPersist();workshopRenderSourceArt(page);};frame.append(toggle);}
  }
  if(!list.childElementCount)list.textContent='No source illustrations on this page. You can add your own image below.';
}
function saveWorkshopPage(){
  if(workshopSyncing||!workshop.open||!Number.isInteger(selectedEditPage))return;
  workshopRemember(selectedEditPage);const data=structuredClone(bookPage(selectedEditPage)),type=$('#workshop-type').value,heading=$('#edit-title').value.trim(),body=$('#edit-body').value;
  Object.assign(data,{novel:true,title:'',eyebrow:'',body,role:type==='title'?'title':type==='contents'?'contents':type==='chapter'?'section':'body',font:$('#page-font').value,ink:$('#page-ink').value,paper:$('#page-paper').value,pageNumberPlacement:$('#page-number-position').value,preserveLines:type==='verse'});
  delete data.titlePage;delete data.tocRows;delete data.chapterOpening;
  if(type==='title')data.titlePage={title:heading,author:$('#workshop-author').value};
  if(type==='chapter'){data.chapterOpening=heading;data.tocLabel=heading;data.body=heading+'\n\n'+body;}
  if(type==='contents'){
    data.tocTitle='Contents';data.tocRows=[...$('#workshop-rows').children].map(row=>{const inputs=row.querySelectorAll('input');return{label:inputs[0].value,folio:inputs[1].value,target:clamp((Number(inputs[2].value)||1)-1,0,readingPageCount()-1),depth:0};});
  }
  if(type==='blank'){data.body='';data.sourceFigures=[];data.images=[];}
  bookContent.pages[selectedEditPage]=data;workshopRouteFields();workshopPersist();
}
function refreshWorkshopPreview(){
  if(!workshop.open||!Number.isInteger(selectedEditPage))return;
  const c=$('#workshop-canvas'),p=c.getContext('2d');p.clearRect(0,0,c.width,c.height);p.imageSmoothingEnabled=false;p.drawImage(viewport(selectedEditPage),0,0,c.width,c.height);
  const data=bookPage(selectedEditPage);$('#workshop-folio').textContent='Page '+(selectedEditPage+1)+' / '+readingPageCount();$('#workshop-previous').disabled=selectedEditPage===0;$('#workshop-next').disabled=selectedEditPage===readingPageCount()-1;
  let warning='';if(data.novel&&!data.tocRows&&!data.titlePage){const layout=layoutBookBody(data,p);if(layout.lines.length*layout.lineHeight>312-layout.top+.1)warning='Text exceeds the available page area. Shorten it or change the book typography.';}
  $('#workshop-warning').textContent=warning;
}
function workshopOutline(){
  const query=$('#workshop-search').value.toLowerCase(),list=$('#workshop-outline');list.replaceChildren();
  for(let n=0;n<readingPageCount();n++){
    const data=bookPage(n),kind=workshopKind(data),label=data.titlePage?.title||data.chapterOpening||data.tocLabel||(kind==='contents'?'Contents':kind==='blank'?'Blank page':'');
    if(!label&&!query)continue;if(query&&!(String(n+1)+' '+label+' '+kind).toLowerCase().includes(query))continue;
    const b=document.createElement('button');b.type='button';b.textContent=(n+1)+' · '+(label||kind);b.onclick=()=>workshopSelect(n);list.append(b);
  }
}
workshopOpenButton.onclick=()=>{
  if(!loaded||motion||coverMotion)return;stopAuto();workshopBook=activeBookId||bookName;workshopUndo.clear();$('#workshop-book').textContent=bookName;
  $('#edit-page').replaceChildren(...Array.from({length:readingPageCount()},(_,i)=>new Option('Page '+(i+1),String(i))));
  editMode=true;$('#edit-mode').checked=true;workshop.showModal();workshopSelect(visibleReaderPage());workshopOutline();
};
$('#edit-page').onchange=e=>workshopSelect(Number(e.target.value));$('#workshop-previous').onclick=()=>workshopSelect(selectedEditPage-1);$('#workshop-next').onclick=()=>workshopSelect(selectedEditPage+1);$('#workshop-search').oninput=workshopOutline;
$('#workshop-close').onclick=()=>workshop.close();workshop.addEventListener('close',()=>{editMode=false;$('#edit-mode').checked=false;editorMode='';editorPageList='';updateControls();});
$('#workshop-author').oninput=saveWorkshopPage;$('#workshop-type').onchange=()=>{saveWorkshopPage();workshopRouteFields();};
$('#workshop-add-row').onclick=()=>{const data=bookPage(selectedEditPage);workshopRenderRows([...(data.tocRows||[]),{label:'New chapter',folio:'',target:selectedEditPage,depth:0}]);saveWorkshopPage();};
$('#workshop-undo').onclick=()=>{const state=workshopUndo.get(selectedEditPage);if(!state)return;if(state.exists)bookContent.pages[selectedEditPage]=structuredClone(state.value);else delete bookContent.pages[selectedEditPage];workshopPersist();workshopSelect(selectedEditPage);};
$('#workshop-reset').onclick=()=>{if(!confirm('Restore this page from the bundled edition? Your other pages stay unchanged. Undo this page can recover the current workshop session’s starting version.'))return;delete bookContent.pages[selectedEditPage];workshopPersist();workshopSelect(selectedEditPage);};
document.querySelectorAll('[data-workshop-tab]').forEach(button=>button.onclick=()=>{for(const b of document.querySelectorAll('[data-workshop-tab]')){const active=b===button;b.setAttribute('aria-selected',String(active));$('#workshop-'+b.dataset.workshopTab).hidden=!active;}});
initPageArtTools();
const imageStyle=document.createElement('label');imageStyle.textContent='Imported image treatment';const imageStyleSelect=document.createElement('select');imageStyleSelect.id='workshop-image-style';imageStyleSelect.append(new Option('Pixel ink · remove white paper','pixel-ink'),new Option('Leave image original','original'));imageStyle.append(imageStyleSelect);$('#workshop-media').prepend(imageStyle);
$('#page-image-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  artSelection={page:selectedEditPage,id:crypto.randomUUID(),points:[{x:45,y:90},{x:349,y:90},{x:349,y:300},{x:45,y:300}]};$('#page-art-treatment').value=imageStyleSelect.value;
  try{await placeRegionArt(file);refreshPageImages();$('#workshop-saved').textContent='Image saved locally';}catch(error){$('#workshop-saved').textContent=error.message;}e.target.value='';
};
