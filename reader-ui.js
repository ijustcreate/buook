'use strict';
const readingPageCount=()=>bookContent.sourcePageCount||pageCount;
function setBookResolution(){
  PIXEL_SCALE=bookContent.starterId||hasBookFont()?(typeof bookFocusSide!=='undefined'&&bookFocusSide!==null?2:1.5):.64;
  canvas.width=Math.round(W*PIXEL_SCALE);canvas.height=Math.round(H*PIXEL_SCALE);
  ctx.setTransform(PIXEL_SCALE,0,0,PIXEL_SCALE,0,0);
  canvas.classList.toggle('clear-type',!!bookContent.starterId||hasBookFont());
  textures.clear();shadedTextures.clear();
}
const measuredWordWidths=new Map(),bookBodySizes=new Map();
function layoutNovelText(text,p,preserveLines=false,height=282,fixedSize=null,composition=null){
  adaptPageTextContext(p);
  const starts=composition?.paragraphStarts,words=String(text).trim().split(/\s+/).filter(Boolean);
  const paragraphs=starts?.length?[0,...starts.filter(n=>n>0&&n<words.length),words.length].slice(0,-1).map((from,i,all)=>words.slice(from,i+1<all.length?all[i+1]:words.length)):
    (preserveLines?String(text).trim().split(/\n/):String(text).trim().split(/\n\s*\n/)).map(line=>line.trim().split(/\s+/).filter(Boolean));
  const bodyWidth=composition?.width||320;
  function fit(size){
    p.font=size+'px '+bookFontFamily();p.fontKerning='none';const lines=[],indents=[];
    const metricKey=p.font+':'+bookWidthScale();let widths=measuredWordWidths.get(metricKey);if(!widths){widths=new Map();if(measuredWordWidths.size>=64)measuredWordWidths.delete(measuredWordWidths.keys().next().value);measuredWordWidths.set(metricKey,widths);}
    const width=word=>{if(!widths.has(word))widths.set(word,p.measureText(word).width);return widths.get(word);},space=width(' ');
    for(const [index,words] of paragraphs.entries()){
      let line='',indent=!preserveLines&&index?size*1.15/bookWidthScale():0,lineWidth=indent;
      const push=()=>{lines.push(line);indents.push(indent);line='';indent=0;lineWidth=0;};
      for(const word of words){const wordWidth=width(word),next=lineWidth+(line?space:0)+wordWidth;if(line&&next>bodyWidth){push();line=word;lineWidth=wordWidth;}else{line=line?line+' '+word:word;lineWidth=next;}}
      if(line||preserveLines)push();
    }
    const metrics=p.measureText('Agjy'),lineHeight=Math.max(size*(preserveLines?1.24:1.38),metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent+(preserveLines?.5:.8));
    return{size,lineHeight,lines,indents};
  }
  if(fixedSize!==null)return fit(fixedSize);
  let low=8,high=64,best=fit(2);
  while(low<=high){const middle=Math.floor((low+high)/2),layout=fit(middle/4);if(layout.lines.length*layout.lineHeight<=height){best=layout;low=middle+1;}else high=middle-1;}
  return best;
}
function novelBodyRegion(data){
  let text=data.body||'',top=data.sourceFigures?.length&&text.trim()?198:34,removed=0;
  if(data.chapterOpening&&text.startsWith(data.chapterOpening)){removed=data.chapterOpening.split(/\s+/).length;text=text.slice(data.chapterOpening.length).trim();top=Math.max(top,65);}
  const base=starterLibrary.get(bookContent.starterId)?.pages[(data.sourcePage||1)-1];
  const starts=(!base||data.body===base.body)?data.paragraphStarts:null;
  return{text,top,height:316-top,preserveLines:!!data.preserveLines,width:320,paragraphStarts:starts?.map(n=>n-removed).filter(n=>n>0)};
}
function bookBodyFontSize(p){
  const key=JSON.stringify([bookContent.starterId,selectedBookFont(),pageCount,bookContent.pages,bookWidthScale()]);
  if(bookBodySizes.has(key))return bookBodySizes.get(key);
  const regions=[];
  for(let n=0;n<readingPageCount();n++){const data=bookPage(n);if(data.novel&&!data.titlePage&&!data.tocRows&&data.body?.trim())regions.push(novelBodyRegion(data));}
  // Test the densest regions first. This usually rejects a candidate before
  // measuring the rest, but every page is checked before accepting a size.
  regions.sort((a,b)=>(b.text.length+(b.preserveLines?b.text.split('\n').length*90:0))/b.height-(a.text.length+(a.preserveLines?a.text.split('\n').length*90:0))/a.height);
  let low=8,high=56,best=2;
  while(low<=high){const middle=Math.floor((low+high)/2),size=middle/4;
    const fits=regions.every(region=>{const layout=layoutNovelText(region.text,p,region.preserveLines,region.height,size,region);return layout.lines.length*layout.lineHeight<=region.height;});
    if(fits){best=size;low=middle+1;}else high=middle-1;
  }
  if(bookBodySizes.size>=8)bookBodySizes.delete(bookBodySizes.keys().next().value);bookBodySizes.set(key,best);return best;
}
function layoutBookBody(data,p){const region=novelBodyRegion(data),layout=layoutNovelText(region.text,p,region.preserveLines,region.height,bookBodyFontSize(p),region);let x=40;if(region.preserveLines&&bookFormat().centerVerse){const width=Math.max(0,...layout.lines.map(line=>p.measureText(line).width));x=(400-width)/2;}return{...layout,top:region.top,x};}
function sourceContentsLayout(number){
  const p=document.createElement('canvas').getContext('2d'),rows=bookPage(number).tocRows||[];
  adaptPageTextContext(p);
  const columns=rows.length>16?2:1,perColumn=Math.ceil(rows.length/columns),columnWidth=columns===2?145:306;
  for(let size=12;size>=4;size-=.25){
    p.font=size+'px '+bookFontFamily();const result=[];let y=67,maximum=67;
    for(const [index,row] of rows.entries()){
      if(index&&index%perColumn===0)y=67;
      const lines=[];let line='';const indent=row.depth?10:0;
      for(const word of row.label.split(/\s+/)){const next=line?line+' '+word:word;if(line&&p.measureText(next).width>columnWidth-45-indent){lines.push(line);line=word;}else line=next;}
      if(line)lines.push(line);
      const lineHeight=Math.max(size*1.4,7),h=lines.length*lineHeight+3;
      result.push({...row,index,x:43+Math.floor(index/perColumn)*161,y,w:columnWidth,h,size,lineHeight,lines,indent});y+=h;maximum=Math.max(maximum,y);
    }
    if(maximum<=310||size===4)return result;
  }
}
function drawSourceContents(p,number){
  p.save();p.fillStyle='#302019';p.textBaseline='top';p.textAlign='center';p.font='20px '+bookFontFamily();
  p.fillText(bookPage(number).tocTitle||'Contents',200,30,304);
  p.strokeStyle='#a89062';p.beginPath();p.moveTo(45,58);p.lineTo(349,58);p.stroke();
  for(const row of sourceContentsLayout(number)){
    p.font=row.size+'px '+bookFontFamily();p.textAlign='left';row.lines.forEach((line,i)=>p.fillText(line,row.x+row.indent,row.y+i*row.lineHeight));
    const end=row.x+row.w;p.textAlign='right';p.fillText(row.folio,end,row.y);
    const last=row.lines.at(-1)||'',left=row.x+row.indent+p.measureText(last).width+6,right=end-10-p.measureText(row.folio).width;
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
  p.font='15px '+bookFontFamily();String(title.author||'').split('\n').forEach((author,i)=>p.fillText(author,200,top+lines.length*size*1.25+26+i*21,280));p.restore();
}
function drawSourceFigures(p,data){
  const figures=data.sourceFigures||[];if(!figures.length)return 38;
  const hasText=!!novelBodyRegion(data).text.trim(),top=data.chapterOpening?65:34,available=hasText?Math.min(154,316-top-108):316-top,slot=available/figures.length;
  figures.forEach((figure,index)=>{
    const image=getSourceIllustration(figure.src);if(!image)return;
    const scale=Math.min(320*bookWidthScale()/image.naturalWidth,(slot-8)/image.naturalHeight),w=image.naturalWidth*scale/bookWidthScale(),h=image.naturalHeight*scale;
    p.drawImage(image,(400-w)/2,top+index*slot+(slot-h)/2,w,h);
  });
  return hasText?top+available+12:top;
}
let readerPage=0,readerKey='',preferredReaderPage=null;
const visibleReaderPage=()=>{
  if(typeof bookFocusSide!=='undefined'&&bookFocusSide!==null)return clamp(bookFocusSide<0?spread*2-1:spread*2,0,readingPageCount()-1);
  const first=Math.min(Math.max(0,spread*2-1),readingPageCount()-1),last=Math.min(spread*2,readingPageCount()-1);
  return preferredReaderPage!==null&&preferredReaderPage>=first&&preferredReaderPage<=last?preferredReaderPage:first;
};
function updateReaderControls(){
  if(typeof syncBookFocusView==='function')syncBookFocusView();
  $('#go-page').max=readingPageCount();
  if(document.activeElement!==$('#go-page'))$('#go-page').value=visibleReaderPage()+1;
  $('#reader-book-name').textContent=bookShelfMode?'My bookshelf':bookName;
  $('#contents-open').disabled=bookTableMode||!!motion||!!coverMotion;
  $('#read-text').disabled=bookTableMode||!!motion||!!coverMotion;
  const librarySwitch=$('#reader-library-switch');if(librarySwitch){librarySwitch.hidden=!bookTableMode;librarySwitch.textContent=bookShelfMode?'Table view':'Bookshelf';for(const id of ['reader-jump-open','previous','next'])$('#'+id).hidden=bookTableMode;}
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
  for(const figure of data.images||[]){const image=document.createElement('img');image.alt=figure.alt||'Page illustration';if(figure.src.startsWith('book-art:'))resolveArtAsset(figure.src).then(url=>image.src=url).catch(()=>image.alt='Local illustration is unavailable');else image.src=figure.src;article.append(image);}
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
