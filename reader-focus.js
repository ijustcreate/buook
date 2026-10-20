'use strict';
// Magnify the physical page without repagination, reflow or non-uniform scale.
let bookFocusSide=null,bookFocusId=null;
const focusControls=document.createElement('div');focusControls.id='reader-focus-controls';focusControls.hidden=true;focusControls.innerHTML='<button id="reader-focus-other">Other page</button><button id="reader-focus-fit">Fit spread ×</button>';document.body.append(focusControls);
const focusOpen=document.createElement('button');focusOpen.id='reader-focus-open';focusOpen.textContent='Page close-up';focusOpen.title='Magnify the current page · Z';$('#reader-type-slot').append(focusOpen);
function setBookFocus(side){
  if(side!==null&&(closed3DActive()||motion||coverMotion||inspection||!loaded))return;
  bookFocusSide=side;bookFocusId=activeBookId;focusControls.hidden=side===null;
  if($('#reader-tools-panel').matches(':popover-open'))$('#reader-tools-panel').hidePopover();
  setBookResolution();syncBookFocusView();draw();
}
function syncBookFocusView(){
  const stage=$('.book-stage');
  if(bookFocusId!==activeBookId||closed3DActive()){const changed=bookFocusSide!==null;bookFocusSide=null;focusControls.hidden=true;if(changed)setBookResolution();}
  if(bookFocusSide===null){for(const key of ['width','left','top'])if(!coverMotion)stage.style.removeProperty(key);return;}
  if(motion||coverMotion)return;
  let number=bookFocusSide<0?spread*2-1:spread*2;
  if(number<0||number>=readingPageCount()){bookFocusSide=-bookFocusSide;number=bookFocusSide<0?spread*2-1:spread*2;}
  const amount=bookFocusSide<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1),chain=resting(bookFocusSide,amount);
  const corners=[...chain.map(p=>project(p,0)),...chain.map(p=>project(p,1))],xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const width=Math.min((innerWidth-36)*W/(right-left),(innerHeight-120)*W/(bottom-top));
  stage.style.width=width+'px';stage.style.left=(innerWidth/2-((left+right)/2-W*.5)*width/W)+'px';stage.style.top=(innerHeight/2-((top+bottom)/2-H*.55)*width/W)+'px';
  $('#reader-focus-other').disabled=spread===0||spread===spreadCount()-1;
}
focusOpen.onclick=()=>setBookFocus(visibleReaderPage()%2?-1:1);
$('#reader-focus-fit').onclick=()=>setBookFocus(null);$('#reader-focus-other').onclick=()=>setBookFocus(-bookFocusSide);
window.addEventListener('resize',syncBookFocusView);
document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,[contenteditable=true]')||event.ctrlKey||event.metaKey||document.querySelector('dialog[open],:popover-open'))return;if(event.key.toLowerCase()==='z'){event.preventDefault();setBookFocus(bookFocusSide===null?(visibleReaderPage()%2?-1:1):null);}if(event.key==='Escape'&&bookFocusSide!==null)setBookFocus(null);});
for(const id of ['close-book','spine-view','book-table','shelf-open'])$('#'+id).addEventListener('click',()=>{if(bookFocusSide!==null)setBookFocus(null);},true);
