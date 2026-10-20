'use strict';
// Quiet, local paper sounds: no downloads, tracks or recurring sound loop.
const bookFeel={context:null,noise:null,lastSound:-Infinity,sound:localStorage.getItem('pixel-book-page-sounds-v1')!=='off',movement:localStorage.getItem('pixel-book-page-movement-v1')!=='off'};
function unlockBookAudio(){
  if(!bookFeel.sound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!bookFeel.context)bookFeel.context=new Audio();if(bookFeel.context.state==='suspended')bookFeel.context.resume().catch(()=>{});}catch{}
}
document.addEventListener('pointerdown',unlockBookAudio,{capture:true,passive:true});
document.addEventListener('keydown',event=>{if(['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key))unlockBookAudio();},{capture:true});
function playPaperSound(fast=false){
  const audio=bookFeel.context;if(!bookFeel.sound||!audio)return;
  if(audio.state==='suspended'){audio.resume().then(()=>playPaperSound(fast)).catch(()=>{});return;}if(audio.state!=='running')return;
  const now=audio.currentTime;if(now-bookFeel.lastSound<.12)return;bookFeel.lastSound=now;
  if(!bookFeel.noise){const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.6),audio.sampleRate),data=buffer.getChannelData(0);let seed=7491;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}bookFeel.noise=buffer;}
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),highpass=audio.createBiquadFilter(),gain=audio.createGain(),duration=fast?.25:.18;
  source.buffer=bookFeel.noise;source.playbackRate.value=fast?.82:1.04;filter.type='lowpass';filter.Q.value=.4;filter.frequency.setValueAtTime(fast?1500:2900,now);filter.frequency.exponentialRampToValueAtTime(fast?500:1300,now+duration);
  highpass.type='highpass';highpass.frequency.value=fast?180:650;highpass.Q.value=.4;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(fast?.026:.032,now+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.gain.linearRampToValueAtTime(0,now+duration+.02);
  source.connect(filter).connect(highpass).connect(gain).connect(audio.destination);source.start(now);source.stop(now+duration+.03);source.onended=()=>{source.disconnect();filter.disconnect();highpass.disconnect();gain.disconnect();};
}
function updateBookResponse(){
  const stage=document.querySelector('.book-stage');
  if(!motion||!bookFeel.movement||matchMedia('(prefers-reduced-motion: reduce)').matches){stage.style.removeProperty('transform');return;}
  const p=motion.progress,envelope=Math.sin(Math.PI*p),sign=motion.direction;
  stage.style.transform=`translate3d(${sign*.42*envelope*Math.sin(p*Math.PI*3)}px,${.26*envelope*Math.sin(p*Math.PI*2)}px,0) rotate(${sign*.025*envelope*Math.sin(p*Math.PI*2)}deg)`;
}
function initBookFeelControls(){
  for(const [key,labelText,storage] of [['sound','Quiet page sounds','pixel-book-page-sounds-v1'],['movement','Subtle book movement','pixel-book-page-movement-v1']]){
    const label=document.createElement('label'),input=document.createElement('input');label.className='check';input.type='checkbox';input.id='book-feel-'+key;input.checked=bookFeel[key];label.append(input,document.createTextNode(labelText));document.querySelector('.options').append(label);
    input.onchange=()=>{bookFeel[key]=input.checked;localStorage.setItem(storage,input.checked?'on':'off');if(key==='sound'&&input.checked)unlockBookAudio();updateBookResponse();};
  }
}
