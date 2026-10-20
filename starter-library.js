'use strict';
// Read-only bundled text stays outside localStorage. Only user edits/copies are
// saved there, so full novels don't consume the browser's shelf quota.
const starterLibrary=new Map();
async function loadStarterLibrary(){
  const response=await fetch('assets/starter-novels.json?v=2');
  if(!response.ok)throw new Error('Starter library could not be loaded');
  const novels=await response.json(),p=document.createElement('canvas').getContext('2d');
  p.font='12px Georgia';
  for(const novel of novels){
    const leaves=[],chapters=[],pages={};let lastChapter='';
    for(const [index,text] of novel.textPages.entries()){
      const heading=text.match(/(?:^|\n)[ \t]*(?:CHAPTER|Chapter)[ \t]+([IVXLCDM]+|\d+)[ \t]*(?:\n|$)/);
      const section=heading&&heading[1]!==lastChapter;
      if(section){chapters.push({index:leaves.length,page:index,title:'Chapter '+heading[1]});lastChapter=heading[1];}
      pages[index]={role:section?'section':'body',tocLabel:section?'Chapter '+heading[1]:'',novel:true,font:'serif',title:'',eyebrow:novel.name,body:text,sourcePage:index+1};
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
    // Preserve the former base text for any edits/bookmarks on old numbering.
    const old={},tocPages=Math.max(1,Math.ceil(chapters.length/9)),start=1+tocPages;
    old[0]={role:'title',title:novel.name+'\n'+novel.author,font:'serif',body:'',eyebrow:''};
    for(let i=1;i<=tocPages;i++)old[i]={role:'contents',font:'serif'};
    leaves.forEach((body,i)=>old[start+i]={role:'body',novel:true,font:'serif',title:'',eyebrow:novel.name,body});
    for(const chapter of chapters)Object.assign(old[start+chapter.index],{role:'section',tocLabel:chapter.title});
    let count=start+leaves.length;if(count%2)old[count++]={role:'body',novel:true,body:'',title:''};
    starterLibrary.set(novel.id+'-legacy',{...common,starterId:novel.id+'-legacy',edition:1,pageCount:count,pages:old,legacy:true});
  }
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
