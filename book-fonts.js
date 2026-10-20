'use strict';
const bookFonts=new Map();
const fontId=name=>name.toLowerCase().replace(/\.(ttf|otf)$/,'').replace(/[^a-z0-9]+/g,'-');
const bookFontFamily=()=>bookFonts.get(bookContent.bookFont)?.family?'"'+bookFonts.get(bookContent.bookFont).family+'", Georgia, serif':'Georgia, serif';
const hasBookFont=()=>!!bookContent.bookFont&&bookContent.bookFont!=='original';
async function registerBookFont(entry,buffer=null){
  const face=new FontFace(entry.family,buffer||'url("'+entry.url+'")');
  await face.load();document.fonts.add(face);bookFonts.set(entry.id,{...entry,face});
}
function fontDatabase(){
  return new Promise((resolve,reject)=>{const request=indexedDB.open('pixel-book-fonts-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function loadBookFonts(){
  const publicFonts=await fetch('assets/fonts/manifest.json').then(r=>r.json());
  const entries=[...publicFonts];
  await Promise.allSettled(entries.map(entry=>registerBookFont(entry)));
  try{
    const db=await fontDatabase(),files=await new Promise((resolve,reject)=>{const request=db.transaction('files').objectStore('files').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();
    await Promise.allSettled(files.map(entry=>registerBookFont(entry,entry.buffer)));
  }catch{/* Font imports can still work for the session if storage is unavailable. */}
  syncBookFontControls();
}
function syncBookFontControls(){
  for(const id of ['book-font','reading-font']){
    const select=document.getElementById(id),value=bookContent.bookFont||'original';
    if(select.dataset.fontCount!==String(bookFonts.size)){
      select.replaceChildren(new Option('Original page fonts','original'));
      for(const font of [...bookFonts.values()].sort((a,b)=>a.label.localeCompare(b.label))){const option=new Option(font.label,font.id);option.style.fontFamily='"'+font.family+'"';select.append(option);}
      select.dataset.fontCount=String(bookFonts.size);
    }
    if(value!=='original'&&!bookFonts.has(value)&&!select.querySelector('option[value="'+CSS.escape(value)+'"]'))select.append(new Option('Missing font — add its file',value));
    select.value=value;
  }
  const article=document.querySelector('#reading-text');if(article)article.style.fontFamily=bookFontFamily();
}
async function chooseBookFont(id){
  if(id!=='original'&&!bookFonts.has(id))return;
  bookContent.bookFont=id;setBookResolution();persistBookContent();
  const saved=savedBooks.find(book=>book.id===activeBookId);
  if(saved){saved.bookFont=id;localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}
  syncBookFontControls();textures.clear();shadedTextures.clear();draw();
  if(document.querySelector('#reading-view').open)renderReadingPage();
}
for(const id of ['book-font','reading-font'])document.getElementById(id).onchange=e=>chooseBookFont(e.target.value);
document.getElementById('add-fonts').onclick=()=>document.getElementById('font-files').click();
document.getElementById('font-files').onchange=async event=>{
  const files=[...event.target.files];let added=0,sessionOnly=false;const failed=[];
  for(const file of files){
    if(!/\.(ttf|otf)$/i.test(file.name)){failed.push(file.name);continue;}
    try{
      const id=fontId(file.name),entry={id,label:file.name.replace(/\.(ttf|otf)$/i,''),family:'PBFont-'+id,buffer:await file.arrayBuffer()};
      await registerBookFont(entry,entry.buffer);added++;
      try{const db=await fontDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(entry);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{sessionOnly=true;}
    }catch{failed.push(file.name);}
  }
  syncBookFontControls();if(hasBookFont()){textures.clear();shadedTextures.clear();draw();}
  document.querySelector('#status').textContent=added+' font'+(added===1?'':'s')+' added '+(sessionOnly?'for this session.':'privately on this device.')+(failed.length?' Unsupported: '+failed.join(', '):'');
  event.target.value='';
};
