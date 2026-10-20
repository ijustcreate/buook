'use strict';
// Read-only bundled text stays outside localStorage. Only user edits/copies are
// saved there, so full novels don't consume the browser's shelf quota.
const starterLibrary=new Map();
async function loadStarterLibrary(){
  const response=await fetch('assets/starter-novels.json');
  if(!response.ok)throw new Error('Starter library could not be loaded');
  const novels=await response.json(),p=document.createElement('canvas').getContext('2d');
  p.font='12px Georgia';
  for(const novel of novels){
    const leaves=[],chapters=[];let lastChapter='';
    for(const text of novel.textPages){
      const heading=text.match(/(?:^|\n)[ \t]*(?:CHAPTER|Chapter)[ \t]+([IVXLCDM]+|\d+)[ \t]*(?:\n|$)/);
      if(heading&&heading[1]!==lastChapter){chapters.push({index:leaves.length,title:'Chapter '+heading[1]});lastChapter=heading[1];}
      let lines=[],line='';
      for(const word of text.split(/\s+/)){
        const next=line?line+' '+word:word;
        if(line&&p.measureText(next).width>304){lines.push(line);line=word;}else line=next;
      }
      if(line)lines.push(line);
      for(let i=0;i<lines.length;i+=18)leaves.push(lines.slice(i,i+18).join('\n'));
    }
    const tocPages=Math.max(1,Math.ceil(chapters.length/9)),start=1+tocPages,pages={};
    pages[0]={role:'title',title:novel.name+'\n'+novel.author,font:'serif',body:'',eyebrow:''};
    for(let i=1;i<=tocPages;i++)pages[i]={role:'contents',font:'serif'};
    leaves.forEach((body,i)=>{pages[start+i]={role:'body',novel:true,font:'serif',title:'',eyebrow:novel.name,body};});
    for(const chapter of chapters)Object.assign(pages[start+chapter.index],{role:'section',tocLabel:chapter.title});
    let pageCount=start+leaves.length;if(pageCount%2){pages[pageCount]={role:'body',novel:true,font:'serif',body:'',title:'',eyebrow:''};pageCount++;}
    starterLibrary.set(novel.id,{id:'starter-'+novel.id,starterId:novel.id,name:novel.name,pageCount,pages,covers:{front:{title:novel.name,font:'serif'},back:{}},palette:{outside:novel.outside,inside:'#b59b62',metal:'gold'},sourcePages:novel.sourcePages});
  }
}
