'use strict';
// Reparent the existing controls, preserving their handlers and saved state.
// Popovers live in the top layer without changing the book's layout or scale.
const readerTools=document.createElement('section');readerTools.id='reader-tools-panel';readerTools.popover='auto';readerTools.setAttribute('aria-label','Reading and book tools');
readerTools.innerHTML=`<div class="reader-panel-heading"><div><small>YOUR READING ROOM</small><h2>Book tools</h2></div><button id="reader-tools-close" aria-label="Close book tools">×</button></div>
<div class="reader-panel-tabs" role="tablist" aria-label="Book tools"><button role="tab" aria-selected="true" aria-controls="reader-panel-read" id="reader-tab-read" data-reader-tab="read">Reading</button><button role="tab" aria-selected="false" aria-controls="reader-panel-book" id="reader-tab-book" data-reader-tab="book" tabindex="-1">Book</button><button role="tab" aria-selected="false" aria-controls="reader-panel-tools" id="reader-tab-tools" data-reader-tab="tools" tabindex="-1">Create & arrange</button></div>
<section id="reader-panel-read" role="tabpanel" aria-labelledby="reader-tab-read"><h3>Typography</h3><div id="reader-type-slot"></div><h3>Page shape & turning</h3><div id="reader-feel-slot"></div></section>
<section id="reader-panel-book" role="tabpanel" aria-labelledby="reader-tab-book" hidden><h3>This edition</h3><div id="reader-book-slot"></div><h3>Cover & keepsakes</h3><p class="reader-panel-help">Close the book to edit its cover, gilding and spine ornaments.</p></section>
<section id="reader-panel-tools" role="tabpanel" aria-labelledby="reader-tab-tools" hidden><h3>Create on the page</h3><div id="reader-create-slot" class="reader-panel-actions"></div><h3>Book & table controls</h3></section>`;
document.body.append(readerTools);
const toolbar=$('.library-toolbar'),toolsButton=document.createElement('button');toolsButton.id='reader-tools-open';toolsButton.textContent='Tools';toolsButton.setAttribute('popovertarget',readerTools.id);toolsButton.setAttribute('aria-label','Open reading and book tools');toolsButton.setAttribute('aria-expanded','false');
const title=$('#reader-book-name');toolbar.append(title,toolsButton);
for(const node of [$('.font-control'),$('#add-fonts'),$('#font-files'),$('#read-text')])$('#reader-type-slot').append(node);
for(const id of ['edit-pages-open','page-art-toggle'])$('#reader-create-slot').append($('#'+id));
const options=$('.book-options'),controls=$('.reader-tools');options.open=true;controls.open=true;
$('#reader-book-slot').append(options);$('#reader-panel-tools').append(controls);
// Keep appearance and mechanical settings in context, using the same inputs.
for(const id of ['position','speed','autoplay','blank','hand','book-feel-sound','book-feel-movement']){
 const input=$('#'+id);$('#reader-feel-slot').append(input.closest('label')||input);
}
$('#reader-feel-slot').prepend($('.book-format-options'));
const legacy=$('.content-editor');legacy.open=true;$('#reader-panel-book').append(legacy,$('.keepsakes'),$('.margin-note'));
const tabs=[...readerTools.querySelectorAll('[data-reader-tab]')];
function selectReaderTab(button){for(const tab of tabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#reader-panel-'+tab.dataset.readerTab).hidden=!active;}}
for(const button of tabs){button.onclick=()=>selectReaderTab(button);button.onkeydown=event=>{const key=event.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;event.preventDefault();const index=key==='Home'?0:key==='End'?tabs.length-1:(tabs.indexOf(button)+(key==='ArrowRight'?1:tabs.length-1))%tabs.length;selectReaderTab(tabs[index]);tabs[index].focus();};}
readerTools.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight',' '].includes(event.key))event.stopPropagation();});
$('#reader-tools-close').onclick=()=>readerTools.hidePopover();
readerTools.addEventListener('toggle',()=>toolsButton.setAttribute('aria-expanded',String(readerTools.matches(':popover-open'))));
for(const id of ['edit-pages-open','page-art-toggle','read-text','close-book','flip-closed','spine-view','book-table','book-3d-open'])$('#'+id).addEventListener('click',()=>{if(readerTools.matches(':popover-open'))readerTools.hidePopover();});
// Turn the existing page indicator into a compact jump affordance.
const jump=document.createElement('section');jump.id='reader-page-jump';jump.popover='auto';jump.setAttribute('aria-label','Jump to page');jump.append($('.reader-navigation > label'));document.body.append(jump);
const jumpButton=document.createElement('button');jumpButton.id='reader-jump-open';jumpButton.setAttribute('popovertarget',jump.id);jumpButton.setAttribute('aria-label','Jump to page');jumpButton.append($('#pagination'));$('#next').before(jumpButton);
jump.addEventListener('toggle',event=>{if(event.newState==='open'){$('#go-page').focus();$('#go-page').select();}});
$('#go-page').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('#go-page-button').click();}});
$('#go-page-button').addEventListener('click',()=>{if(jump.matches(':popover-open'))jump.hidePopover();});
// A lightweight scrollable inspector rather than a full-screen replacement.
document.body.classList.add('reader-shell');
