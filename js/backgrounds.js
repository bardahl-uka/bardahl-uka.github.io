(function(){
 var header=document.querySelector('header');if(!header)return;
 var picker=document.createElement('div');picker.id='bardahl-bg-picker';
 var btn=document.createElement('button');btn.type='button';btn.id='bardahl-palette-button';btn.setAttribute('aria-label','Выбрать фон');btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');btn.title='Выбрать фон';btn.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.3a2.2 2.2 0 0 0 1.7-3.6 1.8 1.8 0 0 1 1.4-2.9H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/><circle cx="17" cy="11.5" r="1"/></svg>';
 var menu=document.createElement('div');menu.id='bardahl-palette-menu';menu.setAttribute('role','menu');menu.hidden=true;
 var isMobileThemeMenu=window.matchMedia && window.matchMedia('(max-width:700px)').matches;
 var choices=isMobileThemeMenu
   ? [['classic','Classic'],['mobile1','Service']]
   : [['classic','Classic'],['photo1','Bardahl Oils'],['kittens','Kittens'],['photo4','Service']];
 var selected='classic';try{selected=localStorage.getItem('bardahl-bg-choice')||'classic'}catch(e){}
 if(!choices.some(function(c){return c[0]===selected}) && selected!=='custom')selected='classic';
 function close(){menu.hidden=true;btn.setAttribute('aria-expanded','false')}
 function apply(v){if(v==='kittens' && document.body.dataset.bardahlRole==='master')v='classic';selected=v;document.body.setAttribute('data-bg-style',v);if(v==='custom'){loadPersonalBackground()}else{document.body.style.removeProperty('--bardahl-personal-background')}Array.prototype.forEach.call(menu.querySelectorAll('button'),function(b){var active=b.dataset.style===v;b.setAttribute('aria-checked',String(active));b.classList.toggle('active',active)});try{localStorage.setItem('bardahl-bg-choice',v)}catch(e){}}
 choices.forEach(function(c){var option=document.createElement('button');option.type='button';option.className='bardahl-theme-option';option.dataset.style=c[0];option.setAttribute('role','menuitemradio');option.innerHTML='<span class="bardahl-theme-dot" aria-hidden="true"></span><span class="bardahl-theme-swatch swatch-'+c[0]+'" aria-hidden="true"></span><span>'+c[1]+'</span>';option.addEventListener('click',function(){apply(c[0]);close()});menu.appendChild(option)});
 // Background image belongs to this browser installation, not to a Supabase account or branch.
 // IndexedDB is local to the browser profile and website origin; nothing is uploaded.
 function accountKey(){return 'bardahl-personal-bg:local-device'}
 function openBgStore(){return new Promise(function(resolve,reject){
   if(!window.indexedDB){reject(new Error('Хранилище изображений недоступно'));return}
   var request=indexedDB.open('bardahl-personal-backgrounds',1);
   request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images')};
   request.onsuccess=function(){resolve(request.result)};request.onerror=function(){reject(request.error)};
 })}
 async function saveImage(blob){
   var key=accountKey();if(!key)throw new Error('Войдите в аккаунт BARDAHL и повторите попытку');
   var db=await openBgStore();try{await new Promise(function(resolve,reject){
     var tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,key);
     tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)};
   })}finally{db.close()}
 }
 async function readImage(){
   var key=accountKey();if(!key)return null;
   var db=await openBgStore();try{return await new Promise(function(resolve,reject){
     var tx=db.transaction('images','readonly');var req=tx.objectStore('images').get(key);
     req.onsuccess=function(){resolve(req.result||null)};req.onerror=function(){reject(req.error)};
   })}finally{db.close()}
 }
 async function deleteImage(){
   var key=accountKey();if(!key)return;
   var db=await openBgStore();try{await new Promise(function(resolve,reject){
     var tx=db.transaction('images','readwrite');tx.objectStore('images').delete(key);
     tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)};
   })}finally{db.close()}
 }
 var bgUrl=null;
 async function loadPersonalBackground(){
   try{var blob=await readImage();if(selected!=='custom')return;
     if(!blob){apply('classic');return}
     if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=URL.createObjectURL(blob);
     document.body.style.setProperty('--bardahl-personal-background','url("'+bgUrl+'")');
   }catch(e){console.warn('Не удалось восстановить личный фон',e);if(selected==='custom')apply('classic')}
 }
 function compressImage(file){return new Promise(function(resolve,reject){
   if(!file.type.startsWith('image/')){reject(new Error('Выберите изображение'));return}
   if(file.size>25*1024*1024){reject(new Error('Изображение слишком большое (максимум 25 МБ)'));return}
   var url=URL.createObjectURL(file),img=new Image();
   img.onload=function(){try{
     var scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
     var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
     canvas.toBlob(function(blob){URL.revokeObjectURL(url);if(blob)resolve(blob);else reject(new Error('Не удалось обработать изображение'))},'image/jpeg',0.8);
   }catch(e){URL.revokeObjectURL(url);reject(e)}};
   img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Не удалось открыть изображение'))};img.src=url;
 })}
 var upload=document.createElement('button');upload.type='button';upload.className='bardahl-theme-option';
 upload.textContent='＋ Загрузить своё фото';menu.appendChild(upload);
 var fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='image/*';fileInput.hidden=true;picker.appendChild(fileInput);
 upload.addEventListener('click',function(){fileInput.click()});
 fileInput.addEventListener('change',async function(){
   var file=fileInput.files&&fileInput.files[0];fileInput.value='';if(!file)return;
   try{upload.disabled=true;upload.textContent='Обработка фото…';var blob=await compressImage(file);await saveImage(blob);apply('custom');close()}
   catch(e){alert('Не удалось установить фон: '+(e.message||e))}
   finally{upload.disabled=false;upload.textContent='＋ Загрузить своё фото'}
 });
 var remove=document.createElement('button');remove.type='button';remove.className='bardahl-theme-option';remove.textContent='Удалить своё фото';menu.appendChild(remove);
 remove.addEventListener('click',async function(){try{await deleteImage();apply('classic');close()}catch(e){alert('Не удалось удалить фото: '+(e.message||e))}});

 btn.addEventListener('click',function(e){e.stopPropagation();var opening=menu.hidden;menu.hidden=!opening;btn.setAttribute('aria-expanded',String(opening))});
 picker.appendChild(btn);picker.appendChild(menu);
 var clock=header.querySelector('.bardahl-desktop-clock');
 if(clock){var tools=document.createElement('div');tools.className='bardahl-header-tools';header.appendChild(tools);tools.appendChild(picker);tools.appendChild(clock)}
 else header.appendChild(picker);
 apply(selected);
 if(selected==='custom'){setTimeout(function(){if(selected==='custom'&&!document.body.style.getPropertyValue('--bardahl-personal-background'))loadPersonalBackground()},900)}
 document.addEventListener('click',function(e){if(!picker.contains(e.target))close()});document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
})();
