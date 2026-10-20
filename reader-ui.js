'use strict';
const readingPageCount=()=>bookContent.sourcePageCount||pageCount;
function setBookResolution(){
  PIXEL_SCALE=bookContent.starterId||hasBookFont()?1.5:.64;
  canvas.width=Math.round(W*PIXEL_SCALE);canvas.height=Math.round(H*PIXEL_SCALE);
  ctx.setTransform(PIXEL_SCALE,0,0,PIXEL_SCALE,0,0);
  canvas.classList.toggle('clear-type',!!bookContent.starterId||hasBookFont());
  textures.clear();shadedTextures.clear();
}
function layoutNovelText(text,p){
  const words=String(text).trim().split(/\s+/).filter(Boolean);
  for(let size=14;size>=4;size-=.25){
    p.font=size+'px '+bookFontFamily();const lines=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>304){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);
    const metrics=p.measureText('Agjy'),lineHeight=Math.max(size*1.4,metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent+2);
    if(lines.length*lineHeight<=274||size===4)return{size,lineHeight,lines};
  }
}
let readerPage=0,readerKey='',preferredReaderPage=null;
const visibleReaderPage=()=>{
  const first=Math.min(Math.max(0,spread*2-1),readingPageCount()-1),last=Math.min(spread*2,readingPageCount()-1);
  return preferredReaderPage!==null&&preferredReaderPage>=first&&preferredReaderPage<=last?preferredReaderPage:first;
};
function updateReaderControls(){
  $('#go-page').max=readingPageCount();
  if(document.activeElement!==$('#go-page'))$('#go-page').value=visibleReaderPage()+1;
  $('#reader-book-name').textContent=bookName;
  $('#contents-open').disabled=!!motion||!!coverMotion;
  if($('#reading-view').open&&readerKey!==bookName+':'+readerPage+':'+JSON.stringify(bookPage(readerPage)))renderReadingPage();
}
function jumpToReaderPage(value){
  if(!Number.isFinite(value))return;
  const target=clamp(Math.round(value)-1,0,readingPageCount()-1);
  preferredReaderPage=target;
  if($('#reading-view').open){readerPage=target;renderReadingPage();}
  if(closed3DActive()){
    closedBooks3D.selected=closedBooks3D.models.find(m=>m.id===current3DBook().id)||closedBooks3D.selected;
    bookReturnScene=captureClosedScene();bookReturnScene.openTarget=target;open3DBook(target);
  }else navigateToChapter(target);
  $('#go-page').value=target+1;
}
function showContents(){
  stopAuto();const list=$('#contents-list');list.replaceChildren();
  $('#contents-book-name').textContent=bookName;
  const chapters=sectionPages();let volume=1;
  chapters.forEach((chapter,index)=>{
    if(index&&chapter.label==='Chapter I')volume++;
    const button=document.createElement('button');button.type='button';
    const label=bookContent.starterId?.startsWith('frankenstein')?'Volume '+volume+' · '+chapter.label:chapter.label;
    const title=document.createElement('span'),folio=document.createElement('small');title.textContent=label;folio.textContent='Page '+(chapter.page+1);
    button.append(title,folio);button.onclick=()=>{$('#contents-dialog').close();jumpToReaderPage(chapter.page+1);};list.append(button);
  });
  if(!chapters.length)list.textContent='No chapter markers yet. Use Go to page to jump anywhere.';
  $('#contents-dialog').showModal();
}
function renderReadingPage(){
  syncBookFontControls();
  readerPage=clamp(readerPage,0,readingPageCount()-1);const data=bookPage(readerPage),base=entries[readerPage%entries.length];
  const article=$('#reading-text');article.replaceChildren();
  if(!data.novel){const h=document.createElement('h3');h.textContent=data.title??base[1];article.append(h);}
  if(pageRole(readerPage)==='contents'&&!data.novel){
    sectionPages().forEach(chapter=>{const b=document.createElement('button');b.textContent=chapter.label+' — '+(chapter.page+1);b.onclick=()=>{readerPage=chapter.page;renderReadingPage();};article.append(b);});
  }else{
    const text=data.body??base[2];
    for(const paragraph of String(text).split(/\n\s*\n/)){
      const p=document.createElement('p');p.textContent=paragraph.replace(/\s*\n\s*/g,' ');if(p.textContent.trim())article.append(p);
    }
    if(!article.textContent.trim()){const p=document.createElement('p');p.textContent='This source page is blank.';article.append(p);}
  }
  $('#reading-title').textContent=bookName;$('#reading-folio').textContent='Page '+(readerPage+1)+' of '+readingPageCount();
  $('#reading-previous').disabled=readerPage===0;$('#reading-next').disabled=readerPage===readingPageCount()-1;
  readerKey=bookName+':'+readerPage+':'+JSON.stringify(data);article.scrollTop=0;
}
$('#contents-open').onclick=showContents;
$('#contents-close').onclick=()=>$('#contents-dialog').close();
$('#read-text').onclick=()=>{stopAuto();readerPage=visibleReaderPage();renderReadingPage();$('#reading-view').showModal();};
$('#reading-close').onclick=()=>$('#reading-view').close();
$('#reading-view').addEventListener('close',()=>jumpToReaderPage(readerPage+1));
$('#reading-previous').onclick=()=>{readerPage--;renderReadingPage();};
$('#reading-next').onclick=()=>{readerPage++;renderReadingPage();};
$('#reading-view').addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowRight'&&readerPage<readingPageCount()-1){e.preventDefault();readerPage++;renderReadingPage();}if(e.key==='ArrowLeft'&&readerPage>0){e.preventDefault();readerPage--;renderReadingPage();}});
$('#reading-size').value=clamp(Number(localStorage.getItem('pixel-book-reading-size'))||22,18,34);
function applyReadingSize(){const size=Number($('#reading-size').value);$('#reading-text').style.fontSize=size+'px';$('#reading-size-value').textContent=size+' px';localStorage.setItem('pixel-book-reading-size',size);}
$('#reading-size').oninput=applyReadingSize;applyReadingSize();
$('#go-page').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToReaderPage(Number(e.target.value));}});
