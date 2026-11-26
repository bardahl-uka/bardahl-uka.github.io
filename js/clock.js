(function(){
 var h=document.querySelector('header');if(!h)return;
 var el=document.createElement('div');el.className='bardahl-desktop-clock';el.setAttribute('aria-label','Местное время компьютера');
 el.innerHTML='<strong class="clock-time">--:--</strong><small class="clock-date"></small>';h.appendChild(el);
 function tick(){var d=new Date();try{el.querySelector('.clock-time').textContent=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false}).format(d);el.querySelector('.clock-date').textContent=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}catch(e){el.querySelector('.clock-time').textContent=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}}
 tick();setInterval(tick,15000);
})();
