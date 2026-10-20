'use strict';
const spineOrnamentNames=[
  'Branching fleur','Gothic wing','Thorned rose','Oak and acorn','Compass diamond',
  'Moon and stars','Sun rosette','Laurel knot','Moth flourish','Ivy trefoil',
  'Arrowhead','Arrow fletching','Key bow','Key teeth','Crossed quills',
  'Shell scroll','Wave scroll','Feather sprig','Snow rosette','Fern spiral',
  'Leaf crown','Thorned heart','Hourglass','Grapevine','Diamond knot',
  'Egyptian lotus','Papyrus fan','Winged sun','Greek anthemion','Ionic volutes',
  'Acanthus scroll','Laurel rosette','Byzantine rosette','Insular knot','Triple spiral',
  'Gothic quatrefoil','Gothic trefoil','Eight-point rosette','Split-palmette arabesque','Tulip arabesque',
  'Renaissance candelabrum','Strapwork knot','Baroque S-scrolls','Rocaille shell','Urn and swags',
  'Whiplash iris','Deco fan','Ruyi cloud','Wave fan','Ribbon bow'
];
const ornamentPlateCache=new Map(),ornamentBoundsCache=new Map();
function defaultSpineOrnaments(book){
  const key=(book.starterId||'').replace(/-legacy$/,''),themes={
    dracula:[1,2],frankenstein:[12,13], 'dorian-gray':[7,21], 'peter-pan':[10,11],
    'divine-comedy':[32,27], 'time-machine':[46,22], 'common-sense':[28,14],
    'secret-garden':[45,19], 'romeo-juliet':[21,2], 'inferno-dore':[32,22]
  };
  const pair=themes[key]||[0,17];return{top:pair[0],bottom:pair[1],flipBottom:![10,12].includes(pair[0])};
}
function effectiveSpineOrnaments(book){
  const original=book.spineOrnaments||defaultSpineOrnaments(book),fallback=defaultSpineOrnaments(book);
  const valid=value=>Number.isInteger(value)&&value>=-2&&value<spineOrnamentNames.length;
  return{top:valid(original.top)?original.top:fallback.top,bottom:valid(original.bottom)?original.bottom:fallback.bottom,flipBottom:original.flipBottom!==false};
}
function assignSpineOrnaments(){
  let changed=false;
  for(const book of savedBooks)if(!book.spineOrnaments){book.spineOrnaments=defaultSpineOrnaments(book);changed=true;}
  if(!bookContent.spineOrnaments)bookContent.spineOrnaments=structuredClone(savedBooks.find(b=>b.id===activeBookId)?.spineOrnaments||defaultSpineOrnaments(bookContent));
  if(changed)localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));persistBookContent();
}
function ornamentPlate(index,palette){
  const set=index<25?'ornaments':'historyOrnaments',key=set+':'+palette.metal;
  if(!ornamentPlateCache.has(key))ornamentPlateCache.set(key,tintCoverSprite(baseAssets[set],'symbols',palette));
  return ornamentPlateCache.get(key);
}
function ornamentBounds(index){
  if(ornamentBoundsCache.has(index))return ornamentBoundsCache.get(index);
  const source=baseAssets[index<25?'ornaments':'historyOrnaments'],cell=index%25;
  const x=Math.round(cell%5*source.width/5),y=Math.round(Math.floor(cell/5)*source.height/5),right=Math.round((cell%5+1)*source.width/5),bottom=Math.round((Math.floor(cell/5)+1)*source.height/5);
  const p=spriteSurface(source.width,source.height).getContext('2d');p.drawImage(source,0,0);const data=p.getImageData(x,y,right-x,bottom-y).data;
  let left=right-x,top=bottom-y,r=0,b=0;
  for(let Y=0;Y<bottom-y;Y++)for(let X=0;X<right-x;X++)if(data[(Y*(right-x)+X)*4+3]>100){left=Math.min(left,X);top=Math.min(top,Y);r=Math.max(r,X+1);b=Math.max(b,Y+1);}
  const bounds={x:x+left,y:y+top,w:Math.max(1,r-left),h:Math.max(1,b-top)};ornamentBoundsCache.set(index,bounds);return bounds;
}
function drawSpineOrnament(p,index,x,y,w,h,palette,flip=false){
  if(index===-2)return true;if(index<0||index>=spineOrnamentNames.length)return false;
  const plate=ornamentPlate(index,palette),b=ornamentBounds(index),scale=Math.min(w/b.w,h/b.h),width=b.w*scale,height=b.h*scale;
  p.save();p.imageSmoothingEnabled=false;p.translate(x+w/2,y+h/2);if(flip)p.rotate(Math.PI);
  p.drawImage(plate,b.x,b.y,b.w,b.h,-width/2,-height/2,width,height);p.restore();return true;
}
function syncSpineOrnamentEditor(){
  if(!baseAssets.ornaments)return;
  const options=effectiveSpineOrnaments(bookContent),end=$('#spine-ornament-end').value,bank=Number($('#spine-ornament-bank').value);
  $('#spine-ornament-top').value=String(options.top);$('#spine-ornament-bottom').value=String(options.bottom);$('#spine-ornament-flip').checked=options.flipBottom;
  document.querySelectorAll('.ornament-choice').forEach(button=>{
    const index=Number(button.dataset.ornament);button.hidden=Math.floor(index/25)!==bank;
    button.setAttribute('aria-pressed',String(index===options[end]));
    const c=button.querySelector('canvas'),p=c.getContext('2d');p.clearRect(0,0,c.width,c.height);drawSpineOrnament(p,index,3,3,42,42,bookContent.palette);
  });
}
function commitSpineOrnaments(options){
  bookContent.spineOrnaments=options;
  const saved=savedBooks.find(b=>b.id===activeBookId);if(saved){saved.spineOrnaments=structuredClone(options);localStorage.setItem('keepers-book-shelf-v1',JSON.stringify(savedBooks));}
  persistBookContent();closedMaterialCache.clear();closedSceneKey='';spineTitleCache=null;syncSpineOrnamentEditor();draw();
}
function initSpineOrnamentPicker(){
  for(const end of ['top','bottom']){
    const select=$('#spine-ornament-'+end);select.append(new Option('Original flourish','-1'),new Option('None','-2'));
    spineOrnamentNames.forEach((name,index)=>select.append(new Option((index>=25?'History · ':'')+name,String(index))));
    select.onchange=()=>{const options=effectiveSpineOrnaments(bookContent);options[end]=Number(select.value);$('#spine-ornament-end').value=end;$('#spine-ornament-bank').value=options[end]>=25?'1':'0';commitSpineOrnaments(options);};
  }
  const grid=$('#spine-ornament-grid');spineOrnamentNames.forEach((name,index)=>{
    const button=document.createElement('button');button.type='button';button.className='ornament-choice';button.dataset.ornament=index;button.title=name;button.setAttribute('aria-label',name);
    const c=document.createElement('canvas');c.width=c.height=48;c.setAttribute('aria-hidden','true');button.append(c);grid.append(button);
    button.onclick=()=>{const options=effectiveSpineOrnaments(bookContent);options[$('#spine-ornament-end').value]=index;commitSpineOrnaments(options);};
  });
  $('#spine-ornament-end').onchange=$('#spine-ornament-bank').onchange=syncSpineOrnamentEditor;
  $('#spine-ornament-flip').onchange=e=>commitSpineOrnaments({...effectiveSpineOrnaments(bookContent),flipBottom:e.target.checked});
  $('#spine-ornament-pair').onclick=()=>{const options=effectiveSpineOrnaments(bookContent);options.bottom=({10:11,12:13,11:10,13:12})[options.top]??options.top;options.flipBottom=![10,11,12,13].includes(options.top);commitSpineOrnaments(options);};
}
