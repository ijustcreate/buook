'use strict';
// Read-only bundled text stays outside localStorage. Only user edits/copies are
// saved there, so full novels don't consume the browser's shelf quota.
const starterLibrary=new Map();
const sourceIllustrations=new Map();
let sourceInkTreatments={};
function refineSourceFigure(figure){
  if(figure.recipe?.version===3)return figure;
  const upgrade=sourceInkTreatments[figure.originalSrc||figure.src];if(!upgrade)return figure;
  const useOriginal=!!figure.originalSrc&&figure.src===figure.originalSrc;
  Object.assign(figure,upgrade,{src:useOriginal?upgrade.originalSrc:upgrade.processedSrc});return figure;
}
async function loadStarterLibrary(){
  const designResponse=await fetch('assets/book-designs.json?v=2');if(!designResponse.ok)throw new Error('Book design metadata could not be loaded');
  const designs=await designResponse.json();
  sourceInkTreatments=await fetch('assets/book-illustration-treatments.json?v=1').then(r=>r.json());
  const compositions=await fetch('assets/book-composition.json?v=1').then(r=>r.json());
  const responses=await Promise.all(['assets/starter-novels.json?v=2','assets/classic-library.json?v=1','assets/inferno-dore.json?v=1'].map(url=>fetch(url)));
  if(responses.some(response=>!response.ok))throw new Error('Starter library could not be loaded');
  const novels=(await Promise.all(responses.map(response=>response.json()))).flat(),p=document.createElement('canvas').getContext('2d');
  p.font='12px Georgia';
  for(const novel of novels){
    if(novel.design)designs[novel.id]=novel.design;
    const leaves=[],chapters=[],pages={};let lastChapter='';
    for(const [index,text] of novel.textPages.entries()){
      const marker=novel.chapters?.find(chapter=>chapter.page===index);
      const heading=!novel.chapters&&text.match(/(?:^|\n)[ \t]*(?:CHAPTER|Chapter)[ \t]+([IVXLCDM]+|\d+)[ \t]*(?:\n|$)/);
      const section=heading&&heading[1]!==lastChapter;
      if(section){chapters.push({index:leaves.length,page:index,title:'Chapter '+heading[1]});lastChapter=heading[1];}
      pages[index]={role:marker||section?'section':'body',tocLabel:marker?.title||(section?'Chapter '+heading[1]:''),novel:true,preserveLines:!!novel.preserveLines,font:'serif',title:'',eyebrow:novel.name,body:text,sourcePage:index+1};
      if(novel.chapters)continue;
      if(!text)continue;
      let lines=[],line='';
      for(const word of text.split(/\s+/)){
        const next=line?line+' '+word:word;
        if(line&&p.measureText(next).width>304){lines.push(line);line=word;}else line=next;
      }
      if(line)lines.push(line);
      for(let i=0;i<lines.length;i+=18)leaves.push(lines.slice(i,i+18).join('\n'));
    }
    const common={name:novel.name,covers:{front:{title:novel.name,font:'serif'},back:{}},palette:{outside:novel.outside,inside:'#b59b62',metal:'gold'}};
    const pageCount=Math.ceil(novel.sourcePages/2)*2;
    if(pageCount>novel.sourcePages)pages[novel.sourcePages]={role:'body',novel:true,font:'serif',body:'',title:'',padding:true};
    starterLibrary.set(novel.id,{...common,id:'starter-'+novel.id,starterId:novel.id,edition:2,pageCount,sourcePageCount:novel.sourcePages,pages});
    const design=designs[novel.id];
    if(design){
      starterLibrary.get(novel.id).format=design.format;
      if(design.contents.length)starterLibrary.get(novel.id).contents=design.contents;
      for(const [number,data] of Object.entries(design.pages))Object.assign(pages[number],data);
    }
    for(const [number,data] of Object.entries(compositions[novel.id]?.pages||{}))if(pages[number])Object.assign(pages[number],data);
    for(const page of Object.values(pages))for(const figure of page.sourceFigures||[])refineSourceFigure(figure);
    if(novel.chapters)continue;
    // Preserve the former base text for any edits/bookmarks on old numbering.
    const old={},tocPages=Math.max(1,Math.ceil(chapters.length/9)),start=1+tocPages;
    old[0]={role:'title',title:novel.name+'\n'+novel.author,font:'serif',body:'',eyebrow:''};
    for(let i=1;i<=tocPages;i++)old[i]={role:'contents',font:'serif'};
    leaves.forEach((body,i)=>old[start+i]={role:'body',novel:true,font:'serif',title:'',eyebrow:novel.name,body});
    for(const chapter of chapters)Object.assign(old[start+chapter.index],{role:'section',tocLabel:chapter.title});
    let count=start+leaves.length;if(count%2)old[count++]={role:'body',novel:true,body:'',title:''};
    starterLibrary.set(novel.id+'-legacy',{...common,starterId:novel.id+'-legacy',edition:1,pageCount:count,pages:old,legacy:true});
  }
  const figures=Object.values(designs).flatMap(design=>Object.values(design.pages).flatMap(page=>page.sourceFigures||[]));
  await Promise.all(figures.filter(figure=>!figure.lazy).map(async figure=>{const img=new Image();img.src=figure.src;await img.decode();sourceIllustrations.set(figure.src,img);}));
}
function getSourceIllustration(src){
  let image=sourceIllustrations.get(src);
  if(!image){image=new Image();sourceIllustrations.set(src,image);image.onload=()=>{textures.clear();shadedTextures.clear();draw();if(typeof refreshWorkshopPreview==='function')refreshWorkshopPreview();};image.src=src;}
  return image.complete&&image.naturalWidth?image:null;
}
function migrateStarterEditions(){
  let changed=false;
  for(const book of [...savedBooks]){
    const current=starterLibrary.get(book.starterId);if(!current||current.legacy||book.edition===2)continue;
    const active=activeBookId===book.id,edits=active?bookContent.pages:book.pages,marks=active?bookContent.edgeBookmarks:book.edgeBookmarks;
    if(active){book.palette=structuredClone(bookContent.palette);book.covers=structuredClone(bookContent.covers);book.name=bookContent.name;}
    if(Object.keys(edits||{}).length||(marks||[]).length)savedBooks.push({...structuredClone(book),id:crypto.randomUUID(),name:book.name+' (previous pagination)',starterId:book.starterId+'-legacy',pages:structuredClone(edits||{}),edgeBookmarks:structuredClone(marks||[])});
    Object.assign(book,{edition:2,pageCount:current.pageCount,sourcePageCount:current.sourcePageCount,pages:{},edgeBookmarks:[]});changed=true;
    if(active){Object.assign(bookContent,{edition:2,pageCount:current.pageCount,sourcePageCount:current.sourcePageCount,pages:{},edgeBookmarks:[]});pageCount=current.pageCount;}
  }
  if(changed){localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));persistBookContent();}
}
