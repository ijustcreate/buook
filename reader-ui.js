'use strict';
const readingPageCount=()=>bookContent.sourcePageCount||pageCount;
function setBookResolution(){
  PIXEL_SCALE=bookContent.starterId||hasBookFont()?1.5:.64;
  canvas.width=Math.round(W*PIXEL_SCALE);canvas.height=Math.round(H*PIXEL_SCALE);
  ctx.setTransform(PIXEL_SCALE,0,0,PIXEL_SCALE,0,0);
  canvas.classList.toggle('clear-type',!!bookContent.starterId||hasBookFont());
  textures.clear();shadedTextures.clear();
}
function layoutNovelText(text,p,preserveLines=false,height=274){
  const paragraphs=(preserveLines?String(text).trim().split(/\n/):[String(text).trim()]).map(line=>line.trim().split(/\s+/).filter(Boolean));
  function fit(size){
    p.font=size+'px '+bookFontFamily();const lines=[];
    for(const words of paragraphs){let line='';
      for(const word of words){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>304){lines.push(line);line=word;}else line=next;}
      if(line||preserveLines)lines.push(line);
    }
    const metrics=p.measureText('Agjy'),lineHeight=Math.max(size*1.4,metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent+2);
    return{size,lineHeight,lines};
  }
  let low=8,high=56,best=fit(2);
  while(low<=high){const middle=Math.floor((low+high)/2),layout=fit(middle/4);if(layout.lines.length*layout.lineHeight<=height){best=layout;low=middle+1;}else high=middle-1;}
  return best;
}
function sourceContentsLayout(number){
  const p=document.createElement('canvas').getContext('2d'),rows=bookPage(number).tocRows||[];
  for(let size=12;size>=4;size-=.25){
    p.font=size+'px '+bookFontFamily();const result=[];let y=67;
    for(const [index,row] of rows.entries()){
      const lines=[];let line='';const indent=row.depth?10:0;
      for(const word of row.label.split(/\s+/)){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>252-indent){lines.push(line);line=word;}else line=next;}
      if(line)lines.push(line);
      const lineHeight=Math.max(size*1.4,7),h=lines.length*lineHeight+3;
      result.push({...row,index,x:43,y,w:306,h,size,lineHeight,lines,indent});y+=h;
    }
    if(y<=310||size===4)return result;
  }
}
function drawSourceContents(p,number){
  p.save();p.fillStyle='#302019';p.textBaseline='top';p.textAlign='center';p.font='20px '+bookFontFamily();
  p.fillText(bookPage(number).tocTitle||'Contents',200,30,304);
  p.strokeStyle='#a89062';p.beginPath();p.moveTo(45,58);p.lineTo(349,58);p.stroke();
  for(const row of sourceContentsLayout(number)){
    p.font=row.size+'px '+bookFontFamily();p.textAlign='left';row.lines.forEach((line,i)=>p.fillText(line,row.x+row.indent,row.y+i*row.lineHeight));
    p.textAlign='right';p.fillText(row.folio,349,row.y);
    const last=row.lines.at(-1)||'',left=row.x+row.indent+p.measureText(last).width+6,right=339-p.measureText(row.folio).width;
    if(right-left>10){p.save();p.strokeStyle='#ad9570';p.setLineDash([1,3]);p.beginPath();p.moveTo(left,row.y+(row.lines.length-1)*row.lineHeight+row.size*.8);p.lineTo(right,row.y+(row.lines.length-1)*row.lineHeight+row.size*.8);p.stroke();p.restore();}
  }
  p.restore();
}
function drawSourceTitle(p,title){
  p.save();p.fillStyle='#302019';p.textAlign='center';p.textBaseline='top';
  const layout=layoutNovelText(title.title,p,false,85),size=Math.min(27,layout.size*1.85);
  p.font=size+'px '+bookFontFamily();const lines=[];let line='';
  for(const word of title.title.split(/\s+/)){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>280){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  const top=125-lines.length*size*.6;lines.forEach((text,i)=>p.fillText(text,200,top+i*size*1.25,280));
  p.font='15px '+bookFontFamily();p.fillText(title.author,200,top+lines.length*size*1.25+26,280);p.restore();
}
function drawSourceFigures(p,data){
  const figures=data.sourceFigures||[];if(!figures.length)return 38;
  const hasText=!!data.body?.trim(),available=hasText?154:274,slot=available/figures.length;
  figures.forEach((figure,index)=>{
    const image=sourceIllustrations.get(figure.src);if(!image)return;
    const scale=Math.min(304/figure.width,(slot-8)/figure.height),w=figure.width*scale,h=figure.height*scale;
    p.drawImage(image,(400-w)/2,38+index*slot+(slot-h)/2,w,h);
  });
  return hasText?38+available+12:38;
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
    const label=bookContent.starterId?.startsWith('frankenstein')&&!starterLibrary.get(bookContent.starterId)?.contents?'Volume '+volume+' · '+chapter.label:chapter.label;
    const title=document.createElement('span'),folio=document.createElement('small');title.textContent=label;folio.textContent='Page '+(chapter.page+1);
    button.append(title,folio);button.onclick=()=>{$('#contents-dialog').close();jumpToReaderPage(chapter.page+1);};list.append(button);
  });
  if(!chapters.length)list.textContent='No chapter markers yet. Use Go to page to jump anywhere.';
  $('#contents-dialog').showModal();
}
function renderReadingPage(){
  syncBookFontControls();
  readerPage=clamp(readerPage,0,readingPageCount()-1);const data=bookPage(readerPage),base=entries[readerPage%entries.length];
  const article=$('#reading-text');article.replaceChildren();article.classList.toggle('preserve-lines',!!data.preserveLines);
  article.classList.toggle('source-title',!!data.titlePage);
  if(data.titlePage){const title=document.createElement('h2'),author=document.createElement('p');title.textContent=data.titlePage.title;author.textContent=data.titlePage.author;article.append(title,author);}
  for(const figure of data.sourceFigures||[]){const image=document.createElement('img');image.src=figure.src;image.alt=figure.alt;article.append(image);}
  if(!data.novel){const h=document.createElement('h3');h.textContent=data.title??base[1];article.append(h);}
  if(data.tocRows){
    for(const row of data.tocRows){const b=document.createElement('button');b.textContent=row.label+' — '+row.folio;b.onclick=()=>{readerPage=row.target;preferredReaderPage=row.target;renderReadingPage();};article.append(b);}
  }else if(data.titlePage){
    // A title page is a composed title/author block, not duplicated body prose.
  }else if(pageRole(readerPage)==='contents'&&!data.novel){
    sectionPages().forEach(chapter=>{const b=document.createElement('button');b.textContent=chapter.label+' — '+(chapter.page+1);b.onclick=()=>{readerPage=chapter.page;renderReadingPage();};article.append(b);});
  }else{
    const text=data.body??base[2];
    for(const paragraph of String(text).split(/\n\s*\n/)){
      const p=document.createElement('p');p.textContent=data.preserveLines?paragraph.replace(/[^\S\n]+\n/g,'\n'):paragraph.replace(/\s*\n\s*/g,' ');if(p.textContent.trim())article.append(p);
    }
    if(!article.textContent.trim()&&!data.sourceFigures?.length){const p=document.createElement('p');p.textContent='This source page is blank.';article.append(p);}
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
