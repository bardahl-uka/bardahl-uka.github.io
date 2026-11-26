(function(){
 function init(){
  var page=document.getElementById('queuePage'),card=document.getElementById('queueTableCard');
  if(!page||!card)return;
  var heading=card.querySelector('h2');if(!heading)return;
  var wrap=document.getElementById('bardahl-opacity-control');
  if(!wrap){wrap=document.createElement('label');wrap.id='bardahl-opacity-control';wrap.innerHTML='<input id="bardahl-opacity-range" type="range" min="20" max="100" step="5" value="100" aria-label="Прозрачность вкладки Очередь"><output id="bardahl-opacity-value">100%</output>';heading.appendChild(wrap)}
  var range=wrap.querySelector('input'),out=wrap.querySelector('output');
  var saved=100;try{saved=Number(localStorage.getItem('bardahl-queue-opacity')||100)}catch(e){}
  if(!Number.isFinite(saved))saved=100;
  var current=Math.max(20,Math.min(100,Math.round(saved/5)*5));
  function bg(el,r,g,b,alpha){el.style.setProperty('background','rgba('+r+','+g+','+b+','+alpha+')','important');el.style.setProperty('background-image','none','important')}
  function paint(){
   var a=current/100;
   // Only Queue page; do not fade text, icons, background art or other tabs.
   page.querySelectorAll('.card').forEach(function(el){bg(el,21,25,29,a)});
   var title=card.querySelector('h2');if(title){var kittens=document.body.dataset.bgStyle==='kittens';bg(title,kittens?16:21,kittens?4:25,kittens?37:29,a)}
   page.querySelectorAll('.master-panel,.stat,.empty').forEach(function(el){bg(el,23,27,31,a)});
   page.querySelectorAll('.queue-table th,.queue-table td').forEach(function(el){
    var mine=el.parentElement&&el.parentElement.classList.contains('mine');
    bg(el,mine?34:23,mine?33:28,mine?22:32,a);
   });
   page.querySelectorAll('.queue-table,.queue-table thead,.queue-table tbody,.queue-table tr,.table-wrap').forEach(function(el){el.style.setProperty('background','transparent','important')});
   page.querySelectorAll('.empty-service-slot').forEach(function(el){bg(el,28,34,38,a)});
   page.querySelectorAll('.service-chip,.service-btn.service-choice').forEach(function(el){
    var kind=el.classList.contains('haldex')?[0,83,45]:el.classList.contains('antifriz')?[106,16,27]:[32,56,69];
    bg(el,kind[0],kind[1],kind[2],a);
   });
  }
  function update(v){current=window.matchMedia('(max-width:700px)').matches?20:Math.max(20,Math.min(100,Number(v)||100));range.value=String(current);out.textContent=current+'%';paint();var clock=document.querySelector('.bardahl-desktop-clock');if(clock){clock.style.setProperty('background','rgba(8,11,14,'+(current/100)+')','important');}try{localStorage.setItem('bardahl-queue-opacity',String(current))}catch(e){}}
  range.addEventListener('input',function(){update(range.value)});
  range.addEventListener('change',function(){update(range.value)});
  window.addEventListener('resize',function(){update(window.matchMedia('(max-width:700px)').matches?20:range.value)});
  var queued=false;
  new MutationObserver(function(records){if(queued||!records.some(function(r){return r.type==='childList'}))return;queued=true;requestAnimationFrame(function(){queued=false;paint()})}).observe(page,{subtree:true,childList:true});
  update(current);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
