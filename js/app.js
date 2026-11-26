const SUPABASE_URL="https://tbkzbypuxrgqwpledwuk.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_L0SBuwAZcRRah4vFoeEzbg_PryMDaJ0";
const BRANCH_2_MASTERS=["Данилов","Агеев","Шумуляев","Титов","Тюрин","Белоусов","Романов"];
const MASTERS=["Мануйлов","Басаров","Ударцев","Омеленчук","Драгункин","Шатаев","Овчинников","Новолодский","Афанасьев","Гость"];
MASTERS.push(...BRANCH_2_MASTERS);
const MANAGER="Менеджер", LEADER="Руководитель", SERVICES=["АКПП","Антифриз","Халдекс"];
let queueBranch=1,statsBranch='all',queueLoadVersion=0;
let db=null,me="",role="",isManager=false,isLeader=false,profile=null,snapshot=null,polling=null,selectedServices=[],positionEditorOpen=false;
const $=id=>document.getElementById(id);
function toast(msg){$("toast").textContent=msg;$("toast").style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>$("toast").style.display="none",3200)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function connect(){if(!window.supabase){$("notice").textContent="Не загрузилась библиотека Supabase. Проверьте интернет и обновите страницу.";return false}if(!db)db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return true}
// Refresh an expired access token once before retrying a failed read.
let sessionRefreshPromise=null;
function isExpiredJwtError(error){return /(?:jwt\s+expired|token\s+(?:has\s+)?expired|invalid\s+jwt)/i.test(String(error?.message||error||''))}
async function refreshExpiredSession(){
 if(!db)return false;
 if(!sessionRefreshPromise)sessionRefreshPromise=(async()=>{
  try{const {data,error}=await db.auth.refreshSession();return !error&&!!data?.session?.access_token}
  catch(e){return false}
 })().finally(()=>{sessionRefreshPromise=null});
 return sessionRefreshPromise;
}
async function getProfile(){let {data:{user},error:userError}=await db.auth.getUser();if(userError&&isExpiredJwtError(userError)&&await refreshExpiredSession())({data:{user},error:userError}=await db.auth.getUser());if(userError)throw new Error('Не удалось проверить сессию: '+userError.message);if(!user)throw new Error('Сессия не найдена. Войдите снова.');const r=await db.from('user_profiles').select('user_id,display_name,role,must_change_password,email,branch_id,queue_branch_id,is_active,deleted_at').eq('user_id',user.id).single();if(r.error)throw new Error('Профиль не настроен. Администратор должен добавить вашу учётную запись в user_profiles.');if(r.data.is_active===false||r.data.deleted_at){await db.auth.signOut();throw new Error('Доступ к BARDAHL отключён. Обратитесь к руководителю.')}return r.data}
async function login(){if(!await connect())return;const email=$("loginEmail").value.trim(),password=$("loginPassword").value;if(!email||!password)return toast('Введите логин/email и пароль');const b=$('loginBtn');b.disabled=true;b.textContent='Проверяем…';try{const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;profile=await getProfile();if(profile.must_change_password){$('loginCard').classList.add('hidden');$('passwordChangeCard').classList.remove('hidden');$('newPassword').focus();return}await bootApp(profile)}catch(e){toast('Не удалось войти: '+(e.message||String(e)))}finally{b.disabled=false;b.textContent='Войти'}}
async function changeFirstPassword(){const p=$('newPassword').value,c=$('confirmPassword').value;if(p.length<10)return toast('Пароль должен содержать не менее 10 символов');if(p!==c)return toast('Пароли не совпадают');const b=$('changePasswordBtn');b.disabled=true;try{const {error}=await db.auth.updateUser({password:p});if(error)throw error;const r=await db.rpc('complete_password_change');if(r.error)throw r.error;profile.must_change_password=false;$('passwordChangeCard').classList.add('hidden');$('newPassword').value='';$('confirmPassword').value='';toast('Пароль изменён');await bootApp(profile)}catch(e){toast('Не удалось сменить пароль: '+e.message)}finally{b.disabled=false}}
async function bootApp(p){continuityReady=false;profile=p;const savedContinuity=readContinuity(p.user_id);queueBranch=p.role==='manager'?p.branch_id:(p.queue_branch_id||p.branch_id||1);if(p.role==='leader'){try{const saved=Number(localStorage.getItem('bardahl-leader-branch-'+p.user_id));if(BRANCHES[saved])queueBranch=saved}catch(e){}}statsBranch=String(queueBranch);if(p.role==='leader'){try{const saved=localStorage.getItem('bardahl-leader-stats-'+p.user_id);if(saved==='all'||BRANCHES[Number(saved)])statsBranch=saved}catch(e){}}setupBranchControls(p);me=p.display_name;role=p.role;isManager=role==='manager';isLeader=role==='leader';document.body.classList.toggle('is-leader',isLeader);if(!['master','manager','leader'].includes(role))throw new Error('Для аккаунта назначена неизвестная роль');setReportDateToToday();$('exportCsv').classList.toggle('hidden',role==='master'||role==='leader');$('exportCsv').style.display=(role==='master'||role==='leader')?'none':'';$('backup').classList.toggle('hidden',role==='leader');$('backup').style.display=role==='leader'?'none':'';if(role==='master'||isManager||isLeader){const r=await db.rpc('ensure_daily_reset');if(r.error)throw r.error}
$('notice').classList.add('hidden');$('loginCard').classList.add('hidden');$('passwordChangeCard').classList.add('hidden');$('app').classList.remove('hidden');$('tabOrders').classList.toggle('hidden',role==='manager');$('tabOrders').style.setProperty('display',role==='manager'?'none':'','important');$('tabQueue').classList.toggle('hidden',false);$('tabEmployees').classList.toggle('hidden',!isLeader);$('tabEmployees').style.setProperty('display',isLeader?'':'none','important');$('logoutBtn').classList.remove('hidden');if(isLeader){$('tabOrders').textContent='📊 Статистика';$('orderEntrySection').classList.add('hidden');$('orderHistorySection').classList.remove('hidden');$('restoreBtn').classList.add('hidden');$('reportsHeading').textContent='Статистика работ мастеров';$('workReport').classList.add('hidden');$('masterDailyServices').classList.add('hidden');$('leaderStats').classList.remove('hidden');switchPage('queue',false)}else{$('tabOrders').textContent='🧾 Учёт работ';$('orderEntrySection').classList.remove('hidden');$('orderHistorySection').classList.remove('hidden');$('restoreBtn').classList.remove('hidden');$('reportsHeading').textContent='Отчёты';$('workReport').classList.remove('hidden');$('masterDailyServices').classList.toggle('hidden',isManager);switchPage('queue',false)}if(isLeader){const roster=await db.from('user_profiles').select('display_name,branch_id,role').eq('role','master').eq('is_active',true).is('deleted_at',null);if(roster.error)throw roster.error;leaderRoster=roster.data||[]}await loadAll();if(!isManager){try{await loadWorkOrders()}catch(e){toast('Заказы не загрузились: '+e.message);if(isLeader){$('leaderStats').classList.remove('hidden');$('leaderStats').textContent='Не удалось загрузить статистику: '+e.message}}}if(polling)clearInterval(polling);let refreshing=false,lastAccessCheck=0;polling=setInterval(async()=>{if(refreshing||!me||document.hidden)return;refreshing=true;try{if(Date.now()-lastAccessCheck>10000){lastAccessCheck=Date.now();const freshProfile=await getProfile();if(freshProfile.user_id!==profile.user_id||freshProfile.is_active===false)throw new Error('Доступ к аккаунту отозван')}await loadAll();if(!isManager)await loadWorkOrders()}catch(e){if(/доступ к (?:аккаунту )?(?:отключён|отозван)/i.test(e.message||'')){await logout();toast('Доступ к BARDAHL отключён руководителем')}else if(isExpiredJwtError(e)&&await refreshExpiredSession()){await loadAll();if(!isManager)await loadWorkOrders()}else toast('Не удалось обновить данные: '+e.message)}finally{refreshing=false}},3000);refreshWorkDayIfNeeded();restoreContinuityAfterBoot(savedContinuity)}
let restoringSession=false;
async function restoreSession(){
 if(restoringSession||(me&&continuityReady))return;
 restoringSession=true;
 try{
  if(!await connect())return;
  const {data,error}=await db.auth.getSession();
  if(error)throw error;
  if(!data?.session){$('notice').classList.add('hidden');return}
  const restoredProfile=await getProfile();
  if(restoredProfile.must_change_password){profile=restoredProfile;$('loginCard').classList.add('hidden');$('passwordChangeCard').classList.remove('hidden')}
  else await bootApp(restoredProfile);
 }catch(e){
  // A temporary connection or profile error must never log out an otherwise valid user.
  $('notice').classList.remove('hidden');
  $('notice').textContent='Не удалось восстановить данные. Проверьте соединение: '+(e.message||String(e));
 }finally{restoringSession=false}
}
window.addEventListener('online',()=>{if(!continuityReady&&!restoringSession)restoreSession()});
const BRANCHES={1:{name:'Металлургов',box_count:8},2:{name:'КШТ',box_count:4}};
let changingBranch=false,leaderRoster=[];
function branchLabel(id){return BRANCHES[id]?.name||'Филиал '+id}
function queueCapacity(){return BRANCHES[queueBranch]?.box_count||0}
function rankingMasters(){return [...new Set([...leaderRoster.filter(p=>Number(p.branch_id)===Number(statsBranch)).map(p=>p.display_name),...workOrders.map(o=>o.master)])].filter(n=>n&&normalizeWorkMaster(n)!==normalizeWorkMaster('Гость'))}
function setupBranchControls(p){
 let box=$('branchControls');if(!box){box=document.createElement('div');box.id='branchControls';box.className='card';$('app').prepend(box)}box.replaceChildren();syncJoinBranchControl(p);if(p.role!=='leader'){box.classList.add('hidden');return}
 box.classList.remove('hidden');const title=document.createElement('strong');title.textContent=branchLabel(queueBranch);box.append(title);
 if(p.role==='manager')return;
 const label=document.createElement('label');label.textContent='Филиал';label.htmlFor='queueBranchSelect';const select=document.createElement('select');select.id='queueBranchSelect';
 for(const id of [1,2]){const option=document.createElement('option');option.value=String(id);option.textContent=branchLabel(id);select.append(option)}select.value=String(queueBranch);select.disabled=changingBranch;select.onchange=()=>selectAppBranch(Number(select.value));box.append(label,select);
}
async function selectAppBranch(id){
 if(isLeader){
  if(!BRANCHES[id]||id===queueBranch)return;
  queueBranch=id;snapshot=null;queueLoadVersion++;leaderSelectedMaster=null;
  try{localStorage.setItem('bardahl-leader-branch-'+profile.user_id,String(id))}catch(e){}
  setupBranchControls(profile);$('queue').replaceChildren();drawWorkReport();await loadAll();return;
 }

 if(changingBranch||id===queueBranch)return;if(!BRANCHES[id])return;
 if(workCart.length||editingOrderId){toast('Сначала сохраните или отмените редактирование заказа');syncJoinBranchControl(profile);return}
 const positioned=snapshot?.members.some(m=>m.user_id===profile.user_id&&m.position!=null);
 if(role==='master'&&positioned&&!confirm('При смене филиала ваше текущее место освободится. Перейти в '+branchLabel(id)+'?')){syncJoinBranchControl(profile);return}
 changingBranch=true;setupBranchControls(profile);
 try{const r=await db.rpc('set_queue_branch',{p_branch_id:id});if(r.error)throw r.error;
  profile.queue_branch_id=id;queueBranch=id;statsBranch=String(id);queueLoadVersion++;orderLoadVersion++;snapshot=null;leaderSelectedMaster=null;workOrders=[];selectedServices=[];positionEditorOpen=false;
  $('queue').replaceChildren();$('myPanel').replaceChildren();$('boxSelect').value='';$('positionSelect').value='';
  setupBranchControls(profile);await loadAll();if(!isManager)await loadWorkOrders();toast('Выбран филиал '+branchLabel(id));
 }catch(e){toast('Не удалось выбрать филиал: '+e.message)}finally{changingBranch=false;setupBranchControls(profile)}
}
async function queueRpc(name,args={}){
 const specs={enter_queue:['enter',{name:args.p_name}],assign_position:['assign',{name:args.p_name,box:args.p_box,position:args.p_position}],leave_queue:['leave',{name:args.p_name}],record_services:['record',{name:args.p_name,services:args.p_services}],delete_queue_service_for_user:['delete_log',{name:args.p_actor,id:args.p_id}],manager_remove_queue_member:['remove_master',{master:args.p_master}],manager_reset_circles:['reset_circles',{name:args.p_manager}]};
 const spec=specs[name];if(!spec)throw Error('Неизвестная операция очереди');return db.rpc('branch_queue_action',{p_action:spec[0],p_payload:spec[1],p_branch_id:queueBranch});
}
async function loadAll(retriedAfterRefresh=false){
 if(!db||!me)return;const actor=me,branch=queueBranch,version=++queueLoadVersion;
 try{if(!isLeader){const reset=await db.rpc('ensure_daily_reset');if(reset.error)throw reset.error;if(reset.data?.branch_id&&Number(reset.data.branch_id)!==branch){profile.queue_branch_id=Number(reset.data.branch_id);queueBranch=Number(reset.data.branch_id);statsBranch=String(queueBranch);snapshot=null;setupBranchControls(profile);return}}const results=await Promise.all([
  db.from('queue_state').select('*').eq('id',branch).single(),
  db.from('queue_members').select('*').eq('branch_id',branch).order('position',{ascending:true,nullsFirst:false}),
  db.from('queue_service_log').select('*').eq('branch_id',branch).order('created_at',{ascending:false}).limit(500)
 ]);for(const r of results)if(r.error)throw r.error;
 if(me!==actor||queueBranch!==branch||version!==queueLoadVersion)return;
 snapshot={state:results[0].data,members:results[1].data,services:results[2].data};render();
 }catch(e){if(me!==actor||queueBranch!==branch||version!==queueLoadVersion)return;if(!retriedAfterRefresh&&isExpiredJwtError(e)&&await refreshExpiredSession()){if(me===actor&&queueBranch===branch)await loadAll(true);return}toast('Ошибка загрузки: '+e.message)}
}
function panelHtml(m,round){
 const canEdit=role==='master'&&m.user_id===profile.user_id&&!!m.position;
 const selected=selectedServices;
 const serviceButtons=SERVICES.map(s=>{const kind=s==='АКПП'?'akpp':s==='Антифриз'?'antifriz':'haldex';return '<button type="button" class="service-btn service-choice '+kind+' '+(selected.includes(s)?'done-service':'')+'" title="Выбрать услугу" data-action="toggle-service" data-service="'+esc(s)+'" '+(!canEdit?'disabled':'')+'><span class="chip-symbol">'+serviceCardIcon(kind)+'</span><span class="choice-copy" aria-hidden="true">'+esc(s)+'</span></button>'}).join('');
 return '<div class="master-panel"><div class="service-actions">'+serviceButtons+'</div><button type="button" id="saveServicesBtn" class="primary" style="width:100%;margin-top:12px" '+(!canEdit||selected.length===0?'disabled':'')+'>Сохранить услуги</button></div>';
}
function serviceIcon(s){return s==='АКПП'?'service-akpp.png':s==='Антифриз'?'service-antifriz.png':'service-haldex.png'}
// Monochrome service pictograms, matching the approved rectangular cards.
function serviceCardIcon(kind){
 const images={akpp:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAABSCAYAAADnwNxmAAAHIUlEQVR4nM2ce4hXRRTHP7/ddd31kVZiSYUVvShXC1PbEnqYlab0DrJIrH/yAWFaihRBUWDmfxb0JAiTyv4oUUgxKikzEcWUzJQ2spet9rBlfbQ7/TFz3dn7m5k7987cn37hMveeuXNmzp07M2fOOfdWhBCUiDOB4cB5wGBDfh3Qrc6PqOMo8DOwGzhQRqMaSuA5CVgF1Efi9y9wMfBLJH7UxWIEtAICWEM8gQEGIHt+QyyGsYR+BvgyEi8bxiMfajAqEcb0PODFCG3Jg0pQ4QhClzoTWtAJ9CtaOHQie83zvn+A/4AOZIMbgb7AIa0ddcjx24B5ptfRDIwGtuRrrkRoT7sKtyGXqqJoAI458ncCI4owDpnIBjny1hMmMMg3owJ8bMm/rCjjEKEfcuTdGMA3jVuQw8OE04swDBH6Ogv92QCeNkyz0FuKMAsReryFvimApw2rYzIrY0w3B/C0odFCL7T6xFRDTwS6HXlzkauLfmyAMKFj6tdZOGqhu96qcSp9FZiCXNPHAz+ECG1bQzsCeOaFq65Olc5EzglXAu8D54YI3WmhHwzgaYNt7Lp6ephKh2q07yHs9bYJN9RCD8FAC922fus4op0vgjCh91no/QN42nCKhf6Fo0yTSg8C2+lRmUeV0dOjA3jacHOBMvpE24Icji8A28sQen4ATxvmFijTpdIzkDp8P2ABhL3eKwLK5sUlBtrvGWWSmX1/OiNE6LWOvHcC+KbxnoX+RkY529pe6n46yKTjUUcf5PbThmXAbFM7QtVQ145qcSBvsL8xnbgFBpiDZR0v20YW2ts23i3AjqJMY2w4nnfkhdiql1jobQQIDHF6GsrpbRvP4Lki1tZysCPvyQL8brXQPyjAqwqxehpgL3C+gd5F/s3+PuAsAz3KihDTiHCDhV5k320S+J4CfIyIKfSPjrxrcvB52EJfmYOHE7HNRfdZ6I/m4DHTQJuYsx1NVJuKNiaZMcd0gtBZ11Q+71geBPyFdPFOBi5CWk26gIZaGgZthoAsFJm8hqj0JeReeiVyW1kP5VhDh1noPq948mC+QU5cRWfrRK5RGu2J42dCiLKOtaI3tpdYV/oYLsz4UAhRqt37Jnr3VAsyYsGFWFYXXa7l2vltQKk9nRw7LE/dhhh1DlS8HlfXrep6Sdk9naA1x72FnOwGnKbSxDK7EWkVnQ/lhFSlcSj7luOIolsjFaWxwGaN1gQshZPPl5XnAWVhs4E2D04+of+uRSW1EvpI9i0A/FpqKxR8x/RU5KTQjXwFO4B2lXYoPt3qaESGNOrOtf3AOR71/OTZniBkCf0HPSpdXuhrtK/QvxWsKxdcQsfcibR73hdzIrPCNqZjb718vIvgjiyIBpPQJgvIU8jXdZ2D1xpgIdLAfn8qz+bLLhPbgEtTtFXAIJMKt8mhGg405PmojktqqIIihJhu4SmEEC+benqs4+mZxtzVHk+9liEZacxIXe/wXafHqHSpIW+jgZbGLs96YkGPh3lTpaeqtDkttC104mvk5PZYwUb4PJiYSCbEhSqdBvypzpvTS9aCkhrhspQm8F3WfJA49xYjh9ZyevzUVT3tCnItG5+lrs8O4KW/3stUmqw8/dNCDw6oKBTLUtchKmnaIa9bT/bUcpeVtZn4VDtvst3kia7U9QPa+X5daFfQegzYgtWhulcnqLSo2biPgfagSvfqQttCmbMQI24svfWcpdI7C/JbTXWU09vAVcAWXejpBSsoWk5HWueerNK0YpEHJp1iE/TWvV1ewSuQuvcUQ94jno1wWUVsysu1nrxzwXci26ZSU4S97ycFux1573ryiAJfoZPYaZsb1QdbHXmrDHWVhkQjm+W8C77KyL8QFVbsgEsV1Tcyd6fyxhH5u5Ckp0M1sXRDQ5CeN2w+78JIhA71IfkGwb5uoKU9k+k4UFNcaBASp3wM81ARp/sUqifHGE75ezFPjhXwn8gmIkOIlzvu8fVZ7VTpQaoFDtlk6EhWijbgaXrcRd8CIISYlMOMM9JxzycRzDwzMur3PUaocpdrtDmK1lSHPVBNx1TkDx1ecdxzfaE+6Q3bhJhX1e2rUj0qItnF3d6A/HFDFj7yrEwQFuBms3uPJJ/1JVmKTYaJ9jrMUX4hOBxQ1uZ8GGOhZ/HRP7lIvsDdWsZ+ui+yx58rUPYuC/2CnHwSe5i+c2xT6YEyjQiLkML7fuM8z5GXd6+fBLe/RU/w3ABkPFlNIhHagT3AHZjjtBuR3pEJhrwEeX1cW5A7w+S/C0OAz5PMihDiO9QTOImRDqUIQkUI0Ur5P2YJRayPYACpkdXaEJ8Xs2Mz1ANiT8RPWrKwDhmEFxX67B31FYqA9ZQgMFRvOCr0+H9OFHYhQzVi/jakF7Livcch17xm5NJSj3xQycNKfEaN2nUd1UthvVamDmmXPoY0/R5GOghtnyZHx/8nYmQwWJcx2gAAAABJRU5ErkJggg==',haldex:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAuCAYAAABH2WXrAAAFXElEQVR4nO2bTYgcRRTHf9s7u+Mwu/mQEFckiCheJKAHAyKokMgimos5aIKC6MWDmIMnzSGCB7OKehH04EkMBok3P07JwZuHiFFziQE/4leWNW5Wx3GS3ekcql76TaV7prqrZ61D/tDUdHVV9et/v36v3quaiTRNiRSzwJPAoj2/BEwBfWDNlk2gDST2vAt8tO6SemIiUrJvBc5U7HsOmKtRltqQ/N8CFOCDgL431CZFzYiV7KnA/o1apKgZUQqFsc8aTwFngRbQAzoYW70KnAf2A0+r9qvjF7E8YrXZXwF3qfOJEe3bwD/qvAlcrFuoUMRqRnojrifAtDq/2bner1ecehAr2UVkpfZYw7yQWVu/vA4yBSNWsrue7cTnuC/nmmaXgK+DE7vsOtQoESvZvnKJGYlSk13ESvYoBykQ+V2yp92GMSBWsn3l+tuWLad+skZZakOsZPuS9YotH3Dqo9RsHdTch/Hu+pNsYEJnKbuYAGIR+KKG+98NzGPI6QALtv4osCdg3CkyJ7uA0fwO8GLAmBqbgZuA34FNGM569r4JsBXDVRf44YosaZruS6vh+zRNCThezhlTrn1aUSbBZjvO80PuUfWogi/TNCUBDld8u7eFqAZwcMi1duDYksjKG+ehgHHfrthvB3CPm4h6CaPyPcynISakifnU+wyS1GA8SZ9QByfPtSHn2taAcXWw9SPZQkXCYC5mBcPVPLDT1s1rsj8BXvW44aPAdvt7XNm1UMctU8e8YKfqogQMvrxbPNq/jkkvACxpsh8hCxISBp1jS/3ezvgRakaatsxTBneaWAbn1e9ngXfJluQE02Rark3WFleDVuyxDCxhvO1Z4DRwCjhZIMR3ZEmiUYcPOp7tiiDz77zgSMh+A3+Zn8uR6x2ypJhu21O/P1Ptk7rm2ZtqGkcQGn4Pi0DF7v5XYjzhKUgJXAf5pi0vYuzdJEZwcZh/AO/njOMbXvvCN+tXhL5TashMZa3EeGKWdJ9jwOdkJhfgRoxFmMNwuAu4w15rabI/Bl7wuPHDwGNOXd2rIqFkJ06pIYpRxrnLOLrPLs++Yjp/08Ls8Oz8YE7dFs++6wXRxDxnKM9cxgnnfSnP5LSTCcZ1mNWjBXWtrTV7G/4OzEVsC8ctjJOcHdKmil/QL+89e3j3DXWQEiDEltCSRFQz55qYqDJky66skARX19XI+zFOYFUJI/PsBnA98KFqLw5j45CbNDAvQ485Cnkk1QUJTA7Yowz+Ur8PA29hnq9L5gta9ljEZCX32vqk4XT2yeS9hjE5ADPAnyPaV4kyh33+Phg2G1kOGFcr1RMe7feRkd3XZD8OHOLqyLFJNr1ZJSMaBiOqOhEaQXacUiPE5OnxjmIcoOargZmZzWKmyXp219NkTwLflrz5uNb+Qmc38lx5ZIcEJlq59lAu534iIZt0l8UpwgTfO+RaqMOVcH0l59rXAeMeweySLYsTwHG9UrPblpJYkdWHLllEKZ/IGUbbah+0MeZrEkPMEVv/C2YlpCpmyBThXkxovhE4HjCmxhxwO/ArRs5zZF9jn8xBNlAvN9a9ft8Qll3cQKbd0SC2+bHAdZAT5G+u3GnrZ5z66IiGeMn+qaDeTXidLqiPErGSXTQbcRNUkgBzZ0Wh8/SxIFaylzzbifwuuVHu/YuV7CK4YXwRqdd2RJVAkVzHbLmGIVqmn25KIMrnii01Ogq7C+rdbFyUu1qj1ADKr4C7/y6L8rli1WxXM3+2ZYJxhhcwL+QSZk7ubsaJ8rmiFIqrNXubc56300kj9H+UY0GUnxvFQY0vyqycrxtizY0A/Eu13UsngTvrFaUeXAajwWXTrCzmzAAAAABJRU5ErkJggg==',antifriz:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAABDCAYAAADTXyaSAAAFcElEQVR4nN2aa4hWRRjHf+d1vWUf7EJXQsvUIrohFouRGXRPFCWoDbJN2A9CfajMwj4IgkIlhaixhGVi64dcApHQNqJIu9BaVtIFrQxpia7aBWvdnD7MnNdn550558y57Pr6h+E855mZ53Lm9syciZRSePAGcJN4vwz4wtDfAROBSORLQROB732CPWgBOoEpwC/ABcC/hj4LOAbsBdYCn3mlKKV8ycYNjjxf+f4Eua7U5dCXhrtdsmoeP09z8I4GfO2RGcvNQLfsPQGyY2wGXrKZPoeOOXgPmOfNgvck2vmOHAbtAnbmqCdxP/CEZESeMXQe8ENBZZGHfwXwaUHZNk4F/gZ/C/UBu4Hfcgh/FX8Xeo7ynQH4KyZ8LSSRWkCgh8FdMlROD/AoMACMBf5Ad/8BYLLJ92E00J9lBgrB+476CzPWlbNoUvrTU/8hpVRqC/0InJ3hy0ocAsYH1vGNNxfOQK9NNjYDbb4xBLCGcGcg3JmZgeV/9fCnQfIYChk7RXAx8E1gHZdtR4FRvhaSFTYGKgvF+pLkjAT3tL1M0N3AAnRcVRVmoj/gnIA6X3lzUma1mPdaxpmqKH5WSrU4bLLTJk/9hhbqE/RTgp4b8PWK4Ez0WNiUUm6bh98ivZ5qe2vSltLbITuuV+4Wsm2NsVi2kOyXswQ9P8eXLgvvoKOECRZ/rKf8+bFDq62Mt83z6XLsKoQRwAEGbxU+8ZRtjdchOU1/C0wCLjR0U6EFWGfxLmLoFtXSUUM7cNKghnu73bSoAUeG24gyUSP7gUZToAaMGyJdrw+FkkgpNRvYWrUeQVc6g8brUC9mg1SVHkFX6VAURwovliz4CNqJu3CH+htMftGjsgbUrGdZWGqeW4BLrbwIaDf0YyXrrTviOikNwW5ghXg/J2O9OwXdDewoaEd9g9dWIMQ/LML6JYL/lif0j9MeUXad4BdBKV3tQ0GfLuhZ6AlgtlV+nuFfKXgHHXL/y2NM3i4XmbQBHeDGaHGUtZeEbkeZnwR9CHjYyAo5rxtkQIhDrwi63crrDzXAYLSg7djyIAGHNHELDQQovxd/dLE/QI6ET/+NhJ44mYE4J8cA7FLuwb7SNViVf9Cv8sj5OIdNhRya7DEkTl9LRarRoT0p9R/JYVO9y/kOHXyIgH0pZaYC1wGfW/wP0OffV1n8Mdb7KnJMCrFDIVsI++R/GXoaVsC7Vt4u9B87iVbgsMX7Eh0uKeDaAFsaYZq3PbBpX1D6L7QPMzzdyE6LEmRMV3pxDkE92m6nmgD1lKRvWbI+ENF22cEpwLMp+c9UoLPuyIjAenGk4GrVFSZvqSNPYnGCjGtM3rmBdtXHUEdAP+10jIU+pVRvwlhJS2OM7A5HXtAYCv2xG+O2jIb2xopEGlBKrc9Y/828Di0IrFgX4EnbE8pJrEyQkcuevNH2ftyL3jj07HVLRjmP45/tLkffxgpC7FBIxR3oSxAurAk1wKDTwdtLY/SQijzTtn0PTq7sIVG7hDy9bc0pA8gX+nSgr4W1obvLcpHnauks19LkxvA9I3ce8HuAXcBxh0YF1tvJ8Y2e/Lt2iVVuq0N2RON/p/EOHd0efjJUekyVBROUnsolpqvkKdk+mLlDKbW6oB31pg7dPtg4YL0vBz5KqdMFXI2+fQX+P9tByNvl0nC7oO3/t4sEPbdkvbljuTRMQ995UMCDVt5aw38Zfc+nVMQOhVyQzYq0wPK+CnTWHbJnp7KxxDwXVqyHSCk1ifzHTycatkVKqX1U0JeHCzXcx7dNixrwz3AbUSZqmAvcJwtqVP/DeCjR47q81MyoH2M9P6xmlIONMPia83ayb51PREQweKd6K/riebMtsvE5IAD/AyijpT1om8AHAAAAAElFTkSuQmCC'};
 return '<img alt="" draggable="false" style="display:block;width:100%;height:100%;object-fit:contain" src="'+(images[kind]||images.akpp)+'">';
}
function queueServiceIcon(kind){return serviceCardIcon(kind);}
function render(){
 if($('leaderQueues'))$('leaderQueues').classList.add('hidden');
 if(!snapshot)return;
 const round=snapshot.state.round_number,members=snapshot.members,mine=members.find(m=>m.user_id===profile.user_id);
 const ordered=members.filter(m=>m.position!==null&&m.position!==undefined&&m.box!==null&&m.box!==undefined).slice().sort((a,b)=>Number(a.position)-Number(b.position)||Number(a.box)-Number(b.box));
 $('countPill').textContent=ordered.length;
 $('managerActions').classList.toggle('hidden',!isManager);$('queueActionHead').classList.toggle('hidden',!isManager);document.body.dataset.bardahlRole=isManager?'manager':'master';if(!isManager&&document.body.getAttribute('data-bg-style')==='kittens'){document.body.setAttribute('data-bg-style','classic');try{localStorage.setItem('bardahl-bg-choice','classic')}catch(e){}}document.querySelectorAll('.bardahl-theme-option[data-style="kittens"]').forEach(b=>{b.hidden=!isManager;b.classList.toggle('hidden',!isManager)});
 $('queue').innerHTML=ordered.length?ordered.map(m=>{const logs=snapshot.services.filter(x=>x.user_id?x.user_id===m.user_id:x.master_name===m.name).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||Number(a.id)-Number(b.id));const cells=Array.from({length:6},(_,i)=>{const log=logs[i]||null;const service=log?log.service:'';const mayRemove=log&&(isManager||(m.user_id===profile.user_id&&role==='master'));const kind=service==='АКПП'?'akpp':service==='Антифриз'?'antifriz':'haldex';const tm=log&&log.created_at?new Date(log.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Almaty'}):'';return '<td>'+(log?'<div class="service-chip '+kind+'" title="'+esc(service)+'"><span class="chip-symbol">'+queueServiceIcon(kind)+'</span><span class="chip-copy"><span>'+esc(service)+'</span><small>'+esc(tm)+'</small></span>'+(mayRemove?'<button type="button" class="service-remove" data-action="remove-service" data-log-id="'+esc(log.id)+'" title="Убрать услугу" aria-label="Убрать услугу '+esc(service)+'">×</button>':'')+'</div>':'<div class="empty-service-slot">–</div>')+'</td>'}).join('');return '<tr class="'+(m.user_id===profile.user_id?'mine':'')+'"><td><div class="queue-position-number">№'+Number(m.position)+'</div><div class="queue-name-mini">'+esc(m.name)+'</div></td><td><div class="queue-box-number">№ '+Number(m.box)+'</div></td>'+cells+(isManager?'<td class="queue-action-cell"><button type="button" class="remove-master-btn" data-action="remove-master" data-master="'+esc(m.name)+'" aria-label="Освободить место в очереди" title="Убрать место">✕</button></td>':'')+'</tr>' }).join(''):'<tr><td class="queue-empty" colspan="9">Пока нет занятых мест в очереди.</td></tr>';
 const member=!!mine,positioned=!!(mine&&mine.position!==null&&mine.position!==undefined&&mine.box!==null&&mine.box!==undefined);
 $('positionCard').classList.toggle('hidden',role!=='master'||(member&&positioned&&!positionEditorOpen));
 if(role==='master'&&!positioned)positionEditorOpen=true;
 $('positionChooser').classList.toggle('hidden',role!=='master'||positioned&&!positionEditorOpen);
 $('queueTableCard').classList.toggle('hidden',role==='master'&&!positioned);
 $('positionHelp').textContent='Выберите свободный бокс и позицию, затем подтвердите вход в очередь.';
 $('joinBtn').textContent=positioned?'Сохранить место':'Встать в очередь';
 $('leaveBtn').classList.toggle('hidden',role==='manager'||role==='leader'||!member);$('leaveBtn').style.setProperty('display',(role==='manager'||role==='leader'||!member)?'none':'','important');
 $('myPanelCard').classList.toggle('hidden',role!=='master'||!positioned);
 $('myPanelTitle').textContent='Выберите услугу';
 $('myPanel').innerHTML=positioned?panelHtml(mine,round):'';
 const boxSel=$('boxSelect');
 const oldBox=boxSel.value;
 const occupiedBoxes=new Set(members.filter(m=>m.box!==null&&m.box!==undefined&&m.user_id!==profile.user_id).map(m=>Number(m.box)));
 boxSel.innerHTML='<option value="">— Выберите бокс —</option>'+Array.from({length:queueCapacity()},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(occupiedBoxes.has(n)?'disabled ':'')+'>Бокс № '+n+(occupiedBoxes.has(n)?' · занят':'')+'</option>').join('');
 const wantedBox=(mine&&mine.box!=null&&positionEditorOpen&&!oldBox)?String(mine.box):oldBox;
 if(wantedBox)boxSel.value=wantedBox;
 if(!boxSel.value&&positionEditorOpen&&mine&&mine.box)boxSel.value=String(mine.box);
 const oldPosition=$('positionSelect').value;
 const selectedBox=Number(boxSel.value||0),ownPos=mine&&mine.position?Number(mine.position):null;
 const occupied=new Set(members.filter(m=>m.position!==null&&m.position!==undefined).map(m=>Number(m.position)));
 $('positionSelect').innerHTML='<option value="">'+'— Выберите позицию —'+'</option>'+Array.from({length:queueCapacity()},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(!selectedBox?'disabled ':'')+(occupied.has(n)&&n!==ownPos?'disabled ':'')+(n===ownPos?'selected':'')+'>Позиция № '+n+(occupied.has(n)&&n!==ownPos?' · занято':'')+'</option>').join('');
 if(oldPosition && [...$('positionSelect').options].some(o=>o.value===oldPosition&&!o.disabled))$('positionSelect').value=oldPosition;
}
async function joinQueue(){if(role!=='master')return toast('Встать в очередь может только мастер');const mine=snapshot&&snapshot.members.find(m=>m.user_id===profile.user_id);if(!positionEditorOpen&&!(mine&&mine.position!==null&&mine.position!==undefined)){positionEditorOpen=true;render();return}const box=Number($('boxSelect').value),pos=Number($('positionSelect').value);if(!box||box<1||box>queueCapacity())return toast('Выберите бокс от 1 до '+queueCapacity());if(!pos||pos<1||pos>queueCapacity())return toast('Выберите позицию от 1 до '+queueCapacity());if(snapshot&&snapshot.members.some(m=>m.user_id!==profile.user_id&&Number(m.box)===box))return toast('Этот бокс уже занят');if(snapshot&&snapshot.members.some(m=>m.user_id!==profile.user_id&&Number(m.position)===pos))return toast('Эта позиция уже занята');try{if(!snapshot||!snapshot.members.some(m=>m.user_id===profile.user_id)){const enter=await queueRpc('enter_queue',{p_name:me});if(enter.error)throw enter.error;await loadAll()}const r=await queueRpc('assign_position',{p_name:me,p_box:box,p_position:pos});if(r.error)throw r.error;toast('Вы в боксе №'+box+', позиция №'+pos);positionEditorOpen=false;selectedServices=[];await loadAll()}catch(e){toast('Не удалось встать в очередь: '+e.message)}}
async function saveServices(){if(!selectedServices.length)return toast('Выберите хотя бы одну услугу');const btn=$('saveServicesBtn');if(btn){btn.disabled=true;btn.textContent='Сохраняем…'}try{if(!db)throw new Error('Нет соединения с базой. Обновите страницу и войдите снова.');const chosen=[...selectedServices];const r=await queueRpc('record_services',{p_name:me,p_services:chosen});if(r.error)throw r.error;await loadAll();const check=await db.from('queue_service_log').select('id,service,round_number').eq('master_name',me).order('created_at',{ascending:false}).limit(100);if(check.error)throw check.error;const saved=check.data||[];const missing=chosen.filter(s=>!saved.some(x=>x.service===s));if(missing.length)throw new Error('База не подтвердила запись услуг: '+missing.join(', ')+'. Проверьте, что обновлённый setup.sql выполнен в Supabase → SQL Editor.');selectedServices=[];render();toast('Сохранено: '+chosen.join(', ')+'. Таблица обновлена у всех.')}catch(e){toast('Ошибка сохранения: '+(e.message||String(e)));render()}finally{const b=$('saveServicesBtn');if(b&&selectedServices.length===0){b.disabled=true;b.textContent='Сохранить услуги'}}}
function toggleService(service){if(!SERVICES.includes(service))return;selectedServices=selectedServices.includes(service)?selectedServices.filter(s=>s!==service):[...selectedServices,service];render()}
async function removeServiceLog(logId,button){
 if(!me)return toast('Сначала войдите в приложение');
 if(!logId||!/^\d+$/.test(String(logId)))return toast('Не удалось определить услугу');
 if(!confirm('Убрать эту услугу из таблицы?'))return;
 if(button){button.disabled=true;button.textContent='…'}
 try{
  const r=await queueRpc('delete_queue_service_for_user',{p_actor:me,p_id:Number(logId)});
  if(r.error)throw r.error;
  await loadAll();
  toast('Услуга удалена из таблицы');
 }catch(e){
  toast('Не удалось убрать услугу: '+(e.message||String(e)));
  if(button){button.disabled=false;button.textContent='×'}
 }
}
async function removeMasterFromQueue(name,button){
 if(!isManager)return toast('Убирать мастеров из очереди может только менеджер');
 if(!name||!snapshot?.members.some(m=>m.name===name))return toast('Мастер уже отсутствует в очереди');
 if(!confirm('Убрать мастера «'+name+'» из очереди? Его позиция освободится. История услуг и заказы сохранятся.'))return;
 if(button){button.disabled=true;button.textContent='Убираем…'}
 try{const r=await queueRpc('manager_remove_queue_member',{p_master:name});if(r.error)throw r.error;await loadAll();toast('Мастер «'+name+'» убран из очереди')}catch(e){toast('Не удалось убрать мастера: '+(e.message||String(e)))}finally{if(button){button.disabled=false;button.textContent='✕ Убрать'}}
}
async function resetCircles(){if(!isManager)return toast('Сброс доступен только менеджеру');if(!confirm('Сбросить отметки кругов и начать очередь заново? Мастера и их позиции сохранятся.'))return;const b=$('resetCirclesBtn');if(b){b.disabled=true;b.textContent='Сбрасываем…'}try{const r=await queueRpc('manager_reset_circles',{p_manager:me});if(r.error)throw r.error;selectedServices=[];await loadAll();toast('Очередь сброшена. Мастера и позиции сохранены.')}catch(e){toast('Не удалось сбросить очередь: '+(e.message||String(e)))}finally{if(b){b.disabled=false;b.textContent='Сбросить очередь'}}}
async function leaveQueue(){if(!confirm('Выйти из очереди и освободить своё место?'))return;try{const r=await queueRpc('leave_queue',{p_name:me});if(r.error)throw r.error;toast('Вы вышли из очереди');selectedServices=[];positionEditorOpen=false;await loadAll()}catch(e){toast('Не удалось выйти: '+e.message)}}
async function logout(){clearContinuityForCurrentUser();resetNewUiState();orderLoadVersion++;workCart=[];editingOrderId=null;leaderSelectedMaster=null;$('orderCar').value='';$('orderDate').value=workToday();$('saveOrder').textContent='Сохранить заказ';$('cancelEdit').classList.add('hidden');drawWorkCart();if(polling)clearInterval(polling);polling=null;try{if(db)await db.auth.signOut()}catch(e){}me='';role='';isManager=false;isLeader=false;document.body.classList.remove('is-leader');profile=null;snapshot=null;workOrders=[];selectedServices=[];positionEditorOpen=false;$("app").classList.add('hidden');$("passwordChangeCard").classList.add('hidden');$("loginCard").classList.remove('hidden');$("loginEmail").value='';$("loginPassword").value='';}
$("loginBtn").addEventListener('click',login);$("changePasswordBtn").addEventListener('click',changeFirstPassword);$("loginPassword").addEventListener('keydown',e=>{if(e.key==='Enter')login()});$('boxSelect').addEventListener('change',render);$("joinBtn").addEventListener('click',joinQueue);$("leaveBtn").addEventListener('click',leaveQueue);$("logoutBtn").addEventListener('click',logout);$("resetCirclesBtn").addEventListener('click',resetCircles);$("queue").addEventListener('click',e=>{const b=e.target.closest('button[data-action="remove-service"]');if(b){removeServiceLog(b.dataset.logId,b);return}const rm=e.target.closest('button[data-action="remove-master"]');if(rm)removeMasterFromQueue(rm.dataset.master,rm)});
$("myPanel").addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b&&b.dataset.action==='toggle-service'){toggleService(b.dataset.service);return}if(e.target.closest('#saveServicesBtn'))saveServices()});// Shared cloud order book — stored in the same Supabase project as the queue.
// WORK_CATALOG (прайс услуг) находится в index.html
let workCart=[],workOrders=[],editingOrderId=null,leaderPeriodValue="day",leaderSelectedMaster=null;

// Restore the visible screen and an unfinished order after iOS closes the web-app process.
const CONTINUITY_PREFIX='bardahl-continuity-v1:';
const DRAFT_MAX_AGE_MS=7*24*60*60*1000;
let continuityReady=false,continuitySaveTimer=null;
function continuityKey(userId){return CONTINUITY_PREFIX+String(userId)}
function readContinuity(userId){
 if(!userId)return null;
 try{const raw=localStorage.getItem(continuityKey(userId));const data=raw?JSON.parse(raw):null;
  return data&&data.version===1&&typeof data.updatedAt==='number'?data:null;
 }catch(e){return null}
}
function currentContinuityDraft(){
 if(role!=='master')return null;
 const car=$('orderCar').value.trim(),comment=$('workComment').value;
 if(!car&&!comment&&!workCart.length&&!editingOrderId)return null;
 return {car,comment,master:$('orderMaster').value,date:$('orderDate').value,
  editingOrderId:editingOrderId||null,
  items:workCart.map(it=>({name:String(it.name||''),price:Number(it.price)||0,
   ...(it.quantity?{quantity:Number(it.quantity)}:{}),...(it.isCustomSto?{isCustomSto:true}:{})})),
  savedAt:Date.now()};
}
function saveContinuity(){
 if(!continuityReady||!profile?.user_id)return;
 try{const data={version:1,updatedAt:Date.now(),page:$('ordersPage').classList.contains('hidden')?'queue':'orders',
   scrollY:Math.max(0,Math.round(window.scrollY||0)),
   draft:currentContinuityDraft()};
  localStorage.setItem(continuityKey(profile.user_id),JSON.stringify(data));
 }catch(e){/* Private browsing or quota restrictions must not break the application. */}
}
function scheduleContinuitySave(){
 if(!continuityReady)return;
 clearTimeout(continuitySaveTimer);
 continuitySaveTimer=setTimeout(saveContinuity,120);
}
function clearContinuityForCurrentUser(){
 clearTimeout(continuitySaveTimer);continuityReady=false;
 if(profile?.user_id){try{localStorage.removeItem(continuityKey(profile.user_id))}catch(e){}}
}
function restoreContinuityAfterBoot(saved){
 // Restore the page and unfinished order, but never restore an old report date.
 // A fresh login/session must always start with the current calendar day in Kazakhstan.
 const draft=saved?.draft;
 if(role==='master'&&draft&&Number.isFinite(draft.savedAt)&&Date.now()-draft.savedAt>=0&&Date.now()-draft.savedAt<DRAFT_MAX_AGE_MS){
  const savedEditId=typeof draft.editingOrderId==='string'?draft.editingOrderId:null;
  const original=savedEditId?workOrders.find(o=>o.id===savedEditId):null;
  // Never accidentally create a duplicate new order from an expired edit draft.
  if(!savedEditId||(original&&canModifyWorkOrder(original))){
   editingOrderId=savedEditId;
   $('orderCar').value=typeof draft.car==='string'?draft.car.slice(0,300):'';
   $('orderMaster').value=typeof draft.master==='string'?draft.master.slice(0,200):'';
   if(typeof draft.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(draft.date))$('orderDate').value=draft.date;
   workCart=Array.isArray(draft.items)?draft.items.slice(0,150).filter(it=>it&&typeof it.name==='string'&&Number.isFinite(Number(it.price))&&Number(it.price)>=0).map(it=>({name:it.name.slice(0,300),price:Number(it.price),...(it.quantity?{quantity:Number(it.quantity)}:{}),...(it.isCustomSto?{isCustomSto:true}:{})})):[];
   if(savedEditId){$('workComment').value='';$('workComment').classList.add('hidden');$('savedComment').textContent=original.comment?'Комментарий (не редактируется): '+original.comment:'Комментарий не был добавлен';$('savedComment').classList.remove('hidden');$('saveOrder').textContent='Сохранить изменения';$('cancelEdit').classList.remove('hidden')}
   else{$('workComment').value=typeof draft.comment==='string'?draft.comment.slice(0,2000):''}
   drawWorkCart();
  }
 }
 const page=saved?.page==='orders'&&!isManager?'orders':'queue';
 switchPage(page,false);
 const y=saved&&Number.isFinite(saved.scrollY)?Math.max(0,saved.scrollY):0;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  window.scrollTo(0,y);
  continuityReady=true;
 }));
}
window.addEventListener('scroll',scheduleContinuitySave,{passive:true});
window.addEventListener('pagehide',saveContinuity);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveContinuity();else refreshWorkDayIfNeeded()});
$('orderEntrySection').addEventListener('input',scheduleContinuitySave);
$('orderEntrySection').addEventListener('change',scheduleContinuitySave);
$('reportDate').addEventListener('change',scheduleContinuitySave);

const moneyWork=n=>`${Number(n||0).toLocaleString('ru-RU')} ₸`;
const makeWorkId=()=> (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,8));
function workToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day}
// A report date from yesterday must never silently become the date of a new order.
// Keep the manual date selector for intentional backdated orders during the current day.
let lastObservedWorkDay=workToday();
function setReportDateToToday(refreshUi=false){
 const today=workToday();
 lastObservedWorkDay=today;
 $('reportDate').value=today;
 $('leaderDate').value=today;
 if(!editingOrderId)$('orderDate').value=today; // Do not alter the original date of an edited order.
 mainHistoryState.date=today;
 for(const state of branchHistoryStates.values())state.date=today;
 syncMasterMonthLabel();
 if(refreshUi&&profile?.user_id){
  $('reportDate').dispatchEvent(new Event('change',{bubbles:true}));
  $('leaderDate').dispatchEvent(new Event('change',{bubbles:true}));
 }else{
  // Refresh the visible date label without reloading data during login.
  $('reportDate').dispatchEvent(new Event('input',{bubbles:true}));
 }
}
function refreshWorkDayIfNeeded(){
 if(workToday()!==lastObservedWorkDay)setReportDateToToday(true);
}
// On iOS an installed web app may sleep through midnight without being restarted.
window.addEventListener('focus',refreshWorkDayIfNeeded);
window.addEventListener('pageshow',refreshWorkDayIfNeeded);
setInterval(()=>{if(!document.hidden)refreshWorkDayIfNeeded()},30000);
async function employeeRequest(action,payload={}){if(!isLeader)throw new Error('Раздел доступен только руководителю');const {data,error}=await db.functions.invoke('manage-employees',{body:{action,...payload}});if(error)throw new Error(error.message||'Ошибка запроса к серверу');if(data?.error)throw new Error(data.error);return data||{}}
function employeeBranchName(id){return Number(id)===2?'КШТ':'Металлургов'}
async function loadEmployees(){if(!isLeader)return;const root=$('employeesList');root.innerHTML='<div class="small">Загружаем сотрудников…</div>';try{const data=await employeeRequest('list');renderEmployees(data.employees||[])}catch(e){root.textContent='Не удалось загрузить список: '+(e.message||String(e))}}
let employeesCache=[],employeesBranchFilter='all';
try{const saved=localStorage.getItem('employeesBranchFilter');if(['all','1','2'].includes(saved))employeesBranchFilter=saved}catch(e){}
function syncEmployeeBranchButtons(){document.querySelectorAll('#employeeBranchButtons .leader-period-btn').forEach(b=>b.classList.toggle('selected',b.dataset.branch===employeesBranchFilter))}
function renderEmployees(list){if(Array.isArray(list))employeesCache=list;const items=employeesCache.filter(i=>!i.deleted_at&&(employeesBranchFilter==='all'||Number(i.branch_id)===Number(employeesBranchFilter)));const root=$('employeesList');root.replaceChildren();syncEmployeeBranchButtons();if($('employeesCount'))$('employeesCount').textContent=items.length;if(!items.length){const empty=document.createElement('div');empty.className='employee-empty';empty.textContent=employeesBranchFilter==='all'?'Пока нет добавленных мастеров.':'В филиале «'+employeeBranchName(employeesBranchFilter)+'» пока нет мастеров.';root.append(empty);return}for(const item of items){const row=document.createElement('div');row.className='employee-row';const main=document.createElement('div');main.className='employee-main';const name=document.createElement('div');name.className='employee-name';name.textContent=item.display_name||'Без имени';const meta=document.createElement('div');meta.className='employee-meta';meta.textContent=(item.email||'')+' · '+employeeBranchName(item.branch_id);const status=document.createElement('span');status.className='employee-status'+(item.deleted_at?' deleted':item.is_active?'':' blocked');status.textContent=item.deleted_at?'Удалён (архив)':item.is_active?'Активен':'Заблокирован';main.append(name,meta,status);const actions=document.createElement('div');actions.className='employee-actions';if(!item.deleted_at){const toggle=document.createElement('button');toggle.type='button';toggle.className=item.is_active?'secondary':'green';toggle.textContent=item.is_active?'Заблокировать':'Разблокировать';toggle.addEventListener('click',()=>changeEmployeeStatus(item,item.is_active?'block':'unblock',toggle));actions.append(toggle);const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Удалить';del.addEventListener('click',()=>changeEmployeeStatus(item,'delete',del));actions.append(del)}row.append(main,actions);root.append(row)}}
async function changeEmployeeStatus(item,action,button){const verb=action==='block'?'заблокировать':action==='unblock'?'разблокировать':'архивировать';const warning=action==='delete'?'Сотрудник потеряет доступ, но его заказы и статистика останутся в истории. Физическое удаление данных не выполняется.':'Изменить доступ сотрудника?';if(!confirm((action==='delete'?'Архивировать':'Вы действительно хотите '+verb)+' «'+item.display_name+'»?\n'+warning))return;button.disabled=true;try{await employeeRequest(action,{user_id:item.user_id});toast(action==='delete'?'Сотрудник архивирован':action==='block'?'Сотрудник заблокирован':'Доступ восстановлен');await loadEmployees();const r=await db.from('user_profiles').select('display_name,branch_id,role').eq('role','master').eq('is_active',true).is('deleted_at',null);if(!r.error)leaderRoster=r.data||[]}catch(e){toast('Не удалось изменить сотрудника: '+(e.message||String(e)));button.disabled=false}}
async function createEmployee(){if(!isLeader)return;const display_name=$('employeeName').value.trim(),email=$('employeeEmail').value.trim().toLowerCase(),password=$('employeeTempPassword').value,branch_id=Number($('employeeBranch').value);if(display_name.length<2)return toast('Введите имя сотрудника');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Проверьте электронную почту');if(password.length<10)return toast('Временный пароль должен содержать не менее 10 символов');const button=$('createEmployeeBtn');button.disabled=true;button.textContent='Создаём…';try{await employeeRequest('create',{display_name,email,password,branch_id});$('employeeName').value='';$('employeeEmail').value='';$('employeeTempPassword').value='';toast('Мастер добавлен. Передайте ему почту и временный пароль.');await loadEmployees();const r=await db.from('user_profiles').select('display_name,branch_id,role').eq('role','master').eq('is_active',true).is('deleted_at',null);if(!r.error)leaderRoster=r.data||[]}catch(e){toast('Не удалось добавить мастера: '+(e.message||String(e)))}finally{button.disabled=false;button.textContent='Добавить мастера'}}
document.querySelectorAll('#employeeBranchButtons .leader-period-btn').forEach(b=>b.addEventListener('click',()=>{employeesBranchFilter=b.dataset.branch;try{localStorage.setItem('employeesBranchFilter',employeesBranchFilter)}catch(e){}if(employeesBranchFilter!=='all')$('employeeBranch').value=employeesBranchFilter;renderEmployees()}));
$('createEmployeeBtn').addEventListener('click',createEmployee);$('refreshEmployeesBtn').addEventListener('click',loadEmployees);$('tabEmployees').addEventListener('click',()=>switchPage('employees'));
function switchPage(page,remember=true){if(isManager)page='queue';if(page==='employees'&&!isLeader)page='queue';const q=page==='queue',e=page==='employees',o=!q&&!e;if($('branchControls'))$('branchControls').classList.toggle('hidden',role!=='leader'||!q);$('queuePage').classList.toggle('hidden',!q);$('ordersPage').classList.toggle('hidden',!o);$('employeesPage').classList.toggle('hidden',!e);$('tabQueue').className=q?'primary':'secondary';$('tabOrders').className=o?'primary':'secondary';$('tabEmployees').className=e?'primary':'secondary';if(o){if(!isLeader)drawWorkCart();drawWorkReport();drawWorkOrders()}if(e)loadEmployees();if(remember)scheduleContinuitySave()}
function initWorkForm(){
 const carList=$('carSuggestions');[...carList.options].sort((a,b)=>a.value.localeCompare(b.value,'ru',{sensitivity:'base'})).forEach(op=>carList.appendChild(op));
 const root=$('workChecklist');root.replaceChildren();
 for(const [name] of WORK_CATALOG){
  const row=document.createElement('div');row.className='work-check-row';
  const label=document.createElement('label');label.className='work-check-label';
  const check=document.createElement('input');check.type='checkbox';check.className='work-check';check.dataset.name=name;
  const title=document.createElement('span');title.textContent=name;label.append(check,title);
  row.append(label);root.append(row);
 }
}
function resetWorkChecklist(){document.querySelectorAll('#workChecklist .work-check').forEach(check=>{check.checked=false})}
function drawWorkCart(){
 const root=$('workCart');root.replaceChildren();
 if(!workCart.length)root.innerHTML='<div class="empty-orders">Услуги ещё не добавлены</div>';
 workCart.forEach((it,i)=>{
  const row=document.createElement('div');row.className='item';row.style.cssText='display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap';
  const name=it.isCustomSto?document.createElement('input'):document.createElement('div');
  if(it.isCustomSto){name.type='text';name.placeholder='Название услуги СТО';name.value=it.name||'';name.setAttribute('aria-label','Название услуги СТО');name.addEventListener('input',()=>{it.name=name.value;scheduleContinuitySave()});}
  else name.textContent=it.name;
  name.style.cssText='flex:1;min-width:110px;font-size:13px';
  const quantityLimits=it.name==='Шприцовка'?24:it.name==='Замена масла в редукторе'?2:0;
  if(quantityLimits){
   const qty=document.createElement('select');qty.setAttribute('aria-label','Количество: '+it.name);
   qty.style.cssText='width:64px!important;min-width:64px!important;padding:10px 5px!important;background:#ffd21a;color:#111;font-weight:700;border-radius:10px';
   for(let n=1;n<=quantityLimits;n++){const opt=document.createElement('option');opt.value=String(n);opt.textContent=String(n);qty.append(opt)}
   const current=Number(it.quantity)||1;qty.value=String(Math.max(1,Math.min(quantityLimits,current)));
   it.quantity=Number(qty.value);
   qty.addEventListener('change',()=>{const prev=Number(it.quantity)||1;const unit=it.name==='Шприцовка'?(WORK_CATALOG.find(x=>x[0]==='Шприцовка')||[0,150])[1]:(Number(it.price)||2000)/prev;it.quantity=Number(qty.value);it.price=Math.round(unit*it.quantity);drawWorkCart()});
   row.append(name,qty);
  }
  const price=document.createElement('input');price.type='number';price.min='0';price.step='1';price.inputMode='decimal';price.value=it.price;price.style.cssText='width:100px!important;min-width:85px!important';price.setAttribute('aria-label','Цена: '+it.name);
  price.addEventListener('input',()=>{const v=Number(price.value);if(Number.isFinite(v)&&v>=0){it.price=v;updateWorkTotal()}});
  price.addEventListener('change',()=>{const v=Number(price.value);if(!Number.isFinite(v)||v<0){price.value=it.price;toast('Укажите корректную сумму');return}it.price=Math.round(v);price.value=it.price;updateWorkTotal()});
  const del=document.createElement('button');del.className='danger';del.type='button';del.textContent='✕';del.setAttribute('aria-label','Удалить '+it.name);del.style.cssText='width:38px;min-width:38px;padding:8px';del.onclick=()=>{workCart.splice(i,1);drawWorkCart()};
  if(!quantityLimits)row.append(name);row.append(price,del);root.append(row);
 });updateWorkTotal();
}
function updateWorkTotal(){$('workCartTotal').textContent='Итого: '+moneyWork(workCart.reduce((a,x)=>a+Number(x.price||0),0));scheduleContinuitySave()}
function addSelectedCatalogWork(){
 const additions=[];
 for(const check of document.querySelectorAll('#workChecklist .work-check:checked')){
  const name=check.dataset.name;
  if(name==='Услуга СТО')additions.push({name:'',price:0,isCustomSto:true});
  else {const item=WORK_CATALOG.find(x=>x[0]===name);if(item)additions.push({name,price:item[1]});}
 }
 if(!additions.length)return toast('Отметьте нужные услуги');
 workCart.push(...additions);resetWorkChecklist();drawWorkCart();$('workCatalogPanel').classList.add('hidden');$('toggleWorkCatalog').textContent='Услуги+';toast('Услуги добавлены в заказ');
}
$('toggleWorkCatalog').addEventListener('click',()=>{const panel=$('workCatalogPanel');panel.classList.toggle('hidden');$('toggleWorkCatalog').textContent=panel.classList.contains('hidden')?'Услуги+':'− Скрыть список услуг'});
$('addCatalogWork').addEventListener('click',addSelectedCatalogWork);
let orderLoadVersion=0;
async function loadWorkOrders(){
 if(!db)return;
 const version=++orderLoadVersion,actor=me,actorRole=role,branch=statsBranch,rows=[],pageSize=500;
 for(let from=0;;from+=pageSize){
   let query=db.from('work_orders').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+pageSize-1);
   if(actorRole==='master')query=query.eq('user_id',profile.user_id);else if(actorRole!=='leader')query=query.eq('master_name','__no_user__');
   const r=await query;if(r.error)throw r.error;
   if(version!==orderLoadVersion||me!==actor||role!==actorRole||statsBranch!==branch)return;
   const batch=r.data||[];rows.push(...batch);if(batch.length<pageSize)break;
 }
 workOrders=rows.map(o=>({id:o.id,userId:o.user_id,car:o.car||'',master:o.master_name||'',branchId:o.branch_id||1,date:o.order_date||'',items:Array.isArray(o.items)?o.items:[],total:Number(o.total)||0,comment:o.comment||'',createdAt:o.created_at}));
 const renderKey=actorRole+'|'+profile.user_id+'|'+workToday()+'|'+JSON.stringify(workOrders);if(renderKey===lastOrdersRenderKey)return;lastOrdersRenderKey=renderKey;
 drawWorkReport();drawWorkOrders();
}
let savingOrder=false;
async function saveWorkOrder(){refreshWorkDayIfNeeded();if(savingOrder)return;savingOrder=true;$('saveOrder').disabled=true;try{if(isManager||isLeader)return toast('Нет доступа к оформлению заказов');const car=$('orderCar').value.trim();if(!car||!workCart.length)return toast('Укажите автомобиль и добавьте хотя бы одну услугу');if(workCart.some(x=>!String(x.name||'').trim()||!Number.isFinite(Number(x.price))||Number(x.price)<=0))return toast('Укажите название и стоимость каждой услуги');if(!db)return toast('Нет соединения с общей базой');const selectedWorkDate=editingOrderId?$('orderDate').value:($('reportDate').value||workToday());if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedWorkDate)||!Number.isFinite(Date.parse(selectedWorkDate+'T12:00:00'))||new Date(selectedWorkDate+'T12:00:00').toISOString().slice(0,10)!==selectedWorkDate||selectedWorkDate>workToday())return toast('Выберите корректную дату работ, не позднее сегодняшней');const payload={car,master_name:(isLeader?$('orderMaster').value:me)||null,queue_service:null,order_date:selectedWorkDate,items:workCart.map(x=>({name:x.name,price:Number(x.price),...(x.quantity?{quantity:Number(x.quantity)}:{}),...(x.isCustomSto?{isCustomSto:true}:{})})),total:workCart.reduce((a,x)=>a+Number(x.price||0),0),updated_at:new Date().toISOString()};if(!editingOrderId){payload.branch_id=queueBranch;payload.comment=$('workComment').value.trim();}let r;if(editingOrderId){const original=workOrders.find(o=>o.id===editingOrderId);if(!canModifyWorkOrder(original))return toast('12 часов истекли или заказ принадлежит другому мастеру');r=await db.from('work_orders').update(payload).eq('id',editingOrderId).eq('user_id',profile.user_id).gte('created_at',new Date(Date.now()-WORK_EDIT_WINDOW_MS).toISOString());}else r=await db.from('work_orders').insert(payload);if(r.error)return toast('Ошибка сохранения заказа: '+r.error.message);editingOrderId=null;workCart=[];$('workComment').value='';$('workComment').classList.remove('hidden');$('savedComment').classList.add('hidden');$('orderCar').value='';$('orderMaster').value='';$('orderDate').value=workToday();resetWorkChecklist();$('workCatalogPanel').classList.add('hidden');$('toggleWorkCatalog').textContent='Услуги+';$('saveOrder').textContent='Сохранить заказ';$('cancelEdit').classList.add('hidden');drawWorkCart();saveContinuity();toast('Заказ сохранён');try{await loadWorkOrders()}catch(e){toast('Заказ сохранён, но список не обновлён: '+e.message)}}catch(e){toast('Не удалось сохранить или обновить заказ: '+e.message)}finally{savingOrder=false;$('saveOrder').disabled=false}}
function periodBoundsFor(date,period){
 if(period==='month'){const [yy,mm]=date.slice(0,7).split('-').map(Number);return {from:`${yy}-${String(mm).padStart(2,'0')}-01`,to:`${yy}-${String(mm).padStart(2,'0')}-${String(new Date(yy,mm,0).getDate()).padStart(2,'0')}`,label:'За месяц'}}
 if(period==='year')return {from:date.slice(0,4)+'-01-01',to:date.slice(0,4)+'-12-31',label:'За год'};
 return {from:date,to:date,label:'За день'};
}
function normalizeWorkMaster(value){return String(value||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru')}
function workItemCount(it){if(it.name!=='Шприцовка'&&it.name!=='Замена масла в редукторе')return 1;const q=Number(it.quantity);const max=it.name==='Шприцовка'?24:2;return Number.isInteger(q)&&q>=1&&q<=max?q:1}
function orderServiceCount(o){return (Array.isArray(o.items)?o.items:[]).reduce((n,it)=>n+workItemCount(it),0)}
function orderSum(o){return Number(o.total)||((Array.isArray(o.items)?o.items:[]).reduce((n,it)=>n+(Number(it.price)||0),0))}
function summarizeServices(orders){const map=new Map();orders.forEach(o=>(Array.isArray(o.items)?o.items:[]).forEach(it=>{const name=String(it.name||'Услуга без названия');map.set(name,(map.get(name)||0)+workItemCount(it))}));return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru'))}
function appendPeriodSummary(root,orders,label){
 const count=orders.reduce((n,o)=>n+orderServiceCount(o),0),sum=orders.reduce((n,o)=>n+orderSum(o),0);
 const box=document.createElement('div');box.className='leader-period-summary';
 const h=document.createElement('h3');h.textContent=label;box.append(h);
 const stats=document.createElement('div');stats.className='stats';stats.innerHTML=`<div class="stat"><span>Услуг</span><strong>${count}</strong></div><div class="stat"><span>Заказов</span><strong>${orders.length}</strong></div><div class="stat"><span>Сумма</span><strong style="font-size:15px">${esc(moneyWork(sum))}</strong></div>`;box.append(stats);root.append(box);
}
function computeMasterRecords(orders){
 const daily=new Map(),monthly=new Map();
 for(const o of orders){if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date||''))continue;const sum=orderSum(o);daily.set(o.date,(daily.get(o.date)||0)+sum);const m=o.date.slice(0,7);monthly.set(m,(monthly.get(m)||0)+sum)}
 const best=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
 return {day:best(daily),month:best(monthly)};
}
function recordPeriodLabel(key,month){if(!key)return '—';if(!month)return key.split('-').reverse().join('.');const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))}
function renderRecordPair(target,records,showNames=false){if(!target)return;target.replaceChildren();for(const [label,entry,month] of [['Лучший день',records.day,false],['Лучший месяц',records.month,true]]){const tile=document.createElement('div');tile.className='record-tile';const title=document.createElement('span');title.className='record-label';title.textContent=label;const amount=document.createElement('strong');amount.textContent=entry?moneyWork(entry.amount):'—';const date=document.createElement('small');date.textContent=entry?recordPeriodLabel(entry.key,month):'Нет заказов';tile.append(title,amount,date);if(showNames&&entry){const name=document.createElement('div');name.className='record-master';name.textContent=entry.master;tile.append(name)}target.append(tile)}}
// Ordinary totals include every saved order. Only personal records exclude these October orders.
function countsForDailyStats(o){return !(String(o.date||'')==='2026-11-12' && normalizeWorkMaster(o.master)==='агеев')}
function countsForLeader(o){return true}
function countsForPersonalRecord(o){const master=normalizeWorkMaster(o.master),date=String(o.date||'');return !((date.startsWith('2026-10')&&(master==='драгункин'||master==='овчинников'))||(date==='2026-11-12'&&master==='агеев'))}
function leaderBestRecords(orders){
 const masters=new Map();
 for(const o of orders){
  const key=normalizeWorkMaster(o.master);
  if(!key)continue;
  if(!masters.has(key))masters.set(key,{name:o.master,orders:[]});
  masters.get(key).orders.push(o);
 }
 const all=[];
 for(const [masterKey,m] of masters){
  // October 2026: Dragunkin and Ovchinnikov count toward best MONTH,
  // but not best DAY. From November onward both records include them.
  const eligibleDailyOrders=m.orders.filter(o=>!(
   (masterKey==='драгункин'||masterKey==='овчинников') &&
   String(o.date||'').startsWith('2026-10')
  ) && !(masterKey==='агеев' && String(o.date||'')==='2026-11-12'));
  const day=computeMasterRecords(eligibleDailyOrders).day;
  const month=computeMasterRecords(m.orders).month;
  if(day)all.push({kind:'day',key:day[0],amount:day[1],master:m.name});
  if(month)all.push({kind:'month',key:month[0],amount:month[1],master:m.name});
 }
 const best=kind=>all.filter(r=>r.kind===kind).sort((a,b)=>b.amount-a.amount||a.master.localeCompare(b.master,'ru'))[0]||null;
 return {day:best('day'),month:best('month')};
}
function drawPersonalWorkReport(){
 const date=$('reportDate').value||workToday(),month=date.slice(0,7),year=date.slice(0,4),root=$('workReport');root.replaceChildren();
 const masterDaily=$('masterDailyServices'),masterDailyList=$('masterDailyServicesList');
 if(!isLeader){
   const own=workOrders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(me));
   const personalDay=computeMasterRecords(own.filter(o=>countsForPersonalRecord(o)&&countsForDailyStats(o)));
   const personalMonth=computeMasterRecords(own);
   const personal={day:personalDay.day,month:personalMonth.month};
   renderRecordPair($('masterRecords'),{day:personal.day?{key:personal.day[0],amount:personal.day[1]}:null,month:personal.month?{key:personal.month[0],amount:personal.month[1]}:null});
   const monthlyOrders=workOrders.filter(o=>o.date.startsWith(month));
   const activeDays=new Set(monthlyOrders.map(o=>o.date).filter(Boolean)).size;
   const monthlyTotal=monthlyOrders.reduce((sum,o)=>sum+orderSum(o),0);
   const averageNode=$('masterMonthAverage');if(averageNode)averageNode.textContent=activeDays?moneyWork(Math.round(monthlyTotal/activeDays)):moneyWork(0);
   const groups=[['День',workOrders.filter(o=>o.date===date&&countsForDailyStats(o))],['Месяц',workOrders.filter(o=>o.date.startsWith(month))],['Год',workOrders.filter(o=>o.date.startsWith(year))]];
   groups.forEach(([label,list])=>{const box=document.createElement('div');box.className='stat';const serviceCount=list.reduce((n,o)=>n+orderServiceCount(o),0),sum=list.reduce((n,o)=>n+orderSum(o),0);box.innerHTML=`<span>${label}</span><div>${list.length} Авто</div><strong>${serviceCount}</strong><span>услуг</span><div style="margin-top:5px;color:var(--yellow);font-size:12px;font-weight:800">${esc(moneyWork(sum))}</div>`;root.append(box)});
   if(masterDailyList){masterDailyList.replaceChildren();const daily=workOrders.filter(o=>o.date===date&&countsForDailyStats(o)),services=summarizeServices(daily);if(!services.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='За выбранную дату выполненных услуг нет';masterDailyList.append(empty)}else services.forEach(([name,count])=>{const row=document.createElement('div');row.className='daily-service-row';row.innerHTML=`<span>${esc(name)}</span><strong class="service-count-badge">${count}</strong>`;masterDailyList.append(row)})}
 }
 const leaderOrders=workOrders.filter(countsForLeader);
 const leaderRecordBox=$('leaderRecords');if(leaderRecordBox){leaderRecordBox.classList.toggle('hidden',!isLeader);if(isLeader){leaderRecordBox.replaceChildren();const heading=document.createElement('div');heading.className='record-heading';heading.textContent='🏆 Рекорды среди мастеров · за всё время';const pair=document.createElement('div');pair.className='record-pair';leaderRecordBox.append(heading,pair);renderRecordPair(pair,leaderBestRecords(workOrders),true)}}
 const lr=$('leaderStats');if(!lr)return;lr.classList.toggle('hidden',!isLeader);$('leaderControls').classList.toggle('hidden',!isLeader);$('masterReportControls').classList.toggle('hidden',isLeader);if(!isLeader)return;lr.replaceChildren();
 const referenceDate=$('leaderDate').value||workToday();
 const periods=['day','month','year'].map(period=>{const b=periodBoundsFor(referenceDate,period);return {...b,orders:leaderOrders.filter(o=>o.date>=b.from&&o.date<=b.to&&(period!=='day'||countsForDailyStats(o)))}});
 // Show all three periods together, using the selected date as the reference.
 if(leaderSelectedMaster){
   const back=document.createElement('button');back.type='button';back.className='secondary leader-back';back.textContent='← Назад ко всем мастерам';back.onclick=()=>{leaderSelectedMaster=null;drawWorkReport()};lr.append(back);
   const title=document.createElement('h3');title.textContent='Статистика мастера: '+leaderSelectedMaster;lr.append(title);
   periods.forEach(period=>appendPeriodSummary(lr,period.orders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster)),period.label));
   const daily=periods[0].orders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster)),services=summarizeServices(daily);
   const sh=document.createElement('h3');sh.style.marginTop='18px';sh.textContent='Выполненные услуги за день';lr.append(sh);
   if(!services.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='За выбранную дату выполненных услуг нет';lr.append(empty)}
   else services.forEach(([name,count])=>{const line=document.createElement('div');line.className='leader-service-row';line.innerHTML=`<span>${esc(name)}</span><strong class="service-count-badge">${count}</strong>`;lr.append(line)});
   const bounds=periodBoundsFor(referenceDate,'month');
   const prev=new Date(bounds.from+'T12:00:00');prev.setDate(0);
   const prevMonth=periodBoundsFor([prev.getFullYear(),String(prev.getMonth()+1).padStart(2,'0'),'01'].join('-'),'month');
   const current=leaderOrders.filter(o=>o.date>=bounds.from&&o.date<=bounds.to&&normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster));
   const previous=leaderOrders.filter(o=>o.date>=prevMonth.from&&o.date<=prevMonth.to&&normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster));
   const dynamics=document.createElement('div');dynamics.className='leader-dynamics';
   const heading=document.createElement('h3');heading.textContent='Динамика мастера: месяц к месяцу';dynamics.append(heading);
   const metrics=[['Сумма работ',current.reduce((n,o)=>n+orderSum(o),0),previous.reduce((n,o)=>n+orderSum(o),0),true],['Заказы',current.length,previous.length,false],['Услуги',current.reduce((n,o)=>n+orderServiceCount(o),0),previous.reduce((n,o)=>n+orderServiceCount(o),0),false]];
   metrics.forEach(([label,now,old,isMoney])=>{const item=document.createElement('div');item.className='leader-dynamic-item';const change=old?((now-old)/old*100):null;const value=isMoney?moneyWork(now):String(now);const oldValue=isMoney?moneyWork(old):String(old);const diff=change===null?'нет базы для сравнения':(change>0?'+':'')+change.toFixed(1)+'%';item.textContent=label+': '+value+' (прошлый месяц: '+oldValue+') · '+diff;dynamics.append(item)});
   lr.append(dynamics);
   // Read-only order history for the selected master on the leader-selected date.
   const history=leaderOrders.filter(o=>o.date===referenceDate&&normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster)).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
   const historyTitle=document.createElement('h3');historyTitle.className='leader-section';historyTitle.textContent='История заказов за '+referenceDate+' ('+history.length+')';lr.append(historyTitle);
   const historySearch=document.createElement('input');historySearch.type='search';historySearch.placeholder='Поиск по автомобилю, услуге или комментарию';historySearch.setAttribute('aria-label','Поиск по истории заказов');historySearch.style.cssText='width:100%;margin:8px 0 12px;padding:12px;border-radius:10px;border:1px solid #555;background:#161819;color:inherit;font:inherit';lr.append(historySearch);
   const historyList=document.createElement('div');lr.append(historyList);
   function renderMasterHistory(){
     historyList.replaceChildren();const q=historySearch.value.trim().toLocaleLowerCase('ru');
     const found=history.filter(o=>[o.car,o.date,o.comment,...(Array.isArray(o.items)?o.items:[]).map(it=>it.name)].join(' ').toLocaleLowerCase('ru').includes(q));
     if(!found.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='За выбранный день заказы не найдены';historyList.append(empty);return}
     found.forEach(o=>{const card=document.createElement('article');card.className='work-order';const heading=document.createElement('h3');heading.textContent=o.car||'Автомобиль не указан';const meta=document.createElement('div');meta.className='meta';meta.textContent=o.date+' · '+branchLabel(o.branchId)+' · '+o.master+' · '+orderServiceCount(o)+' услуг(и)';const details=document.createElement('div');details.className='detail';details.style.whiteSpace='pre-wrap';details.textContent=(Array.isArray(o.items)?o.items:[]).map(it=>String(it.name||'Услуга')+(workItemCount(it)>1?' × '+workItemCount(it):'')+' — '+moneyWork(it.price)).join('\n');const sum=document.createElement('div');sum.className='sum';sum.textContent='Итого: '+moneyWork(orderSum(o));card.append(heading,meta,details);if(o.comment){const note=document.createElement('div');note.className='detail';note.style.whiteSpace='pre-wrap';note.textContent='Комментарий: '+o.comment;card.append(note)}card.append(sum);historyList.append(card)})
   }
   historySearch.addEventListener('input',renderMasterHistory);renderMasterHistory();
   return;
 }
 const selectedPeriod=periods.find(p=>p.from===periodBoundsFor(referenceDate,leaderPeriodValue).from&&p.to===periodBoundsFor(referenceDate,leaderPeriodValue).to)||periods[0];
 $('leaderPeriodButtons').querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('selected',button.dataset.period===leaderPeriodValue));
 const list=selectedPeriod.orders, totalServices=list.reduce((n,o)=>n+orderServiceCount(o),0),totalSum=list.reduce((n,o)=>n+orderSum(o),0);

 const kpis=document.createElement('div');kpis.className='leader-kpis';
 [['Сумма работ',moneyWork(totalSum)],['Услуг',String(totalServices)],['Заказов',String(list.length)]].forEach(([label,value])=>{const box=document.createElement('div');box.className='leader-kpi';const t=document.createElement('span');t.textContent=label;const v=document.createElement('strong');v.textContent=value;box.append(t,v);kpis.append(box)});lr.append(kpis);
 const compareDate=new Date(selectedPeriod.from+'T12:00:00'),prevTo=new Date(compareDate);prevTo.setDate(prevTo.getDate()-1);
 const prevKey=[prevTo.getFullYear(),String(prevTo.getMonth()+1).padStart(2,'0'),String(prevTo.getDate()).padStart(2,'0')].join('-');
 const previous=periodBoundsFor(prevKey,leaderPeriodValue),prevOrders=leaderOrders.filter(o=>o.date>=previous.from&&o.date<=previous.to),prevSum=prevOrders.reduce((n,o)=>n+orderSum(o),0);
 const comparison=document.createElement('div');comparison.className='leader-note';
 comparison.textContent='Сравнение с прошлым периодом: '+(prevSum?((totalSum-prevSum)>=0?'+':'')+Math.round((totalSum-prevSum)/prevSum*100)+'% по сумме работ':'нет базы для сравнения');lr.append(comparison);
 const graphTitle=document.createElement('h3');graphTitle.className='leader-section';graphTitle.textContent='Динамика суммы работ';lr.append(graphTitle);
 const buckets=new Map();
 list.forEach(o=>{const key=leaderPeriodValue==='year'?o.date.slice(0,7):o.date;buckets.set(key,(buckets.get(key)||0)+orderSum(o))});
 const keys=[];
 if(leaderPeriodValue==='day'){keys.push(selectedPeriod.from)}
 else if(leaderPeriodValue==='month'){const [y,m]=selectedPeriod.from.split('-').map(Number);for(let d=1;d<=new Date(y,m,0).getDate();d++)keys.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`)}
 else {for(let m=1;m<=12;m++)keys.push(`${referenceDate.slice(0,4)}-${String(m).padStart(2,'0')}`)}
 const max=Math.max(1,...keys.map(k=>buckets.get(k)||0)),chart=document.createElement('div');chart.className='leader-chart';
 keys.forEach((key,i)=>{const value=buckets.get(key)||0,col=document.createElement('div');col.className='leader-chart-col';col.title=key+' — '+moneyWork(value);const bb=document.createElement('div');bb.className='leader-chart-barbox';const bar=document.createElement('div');bar.className='leader-chart-bar';bar.style.height=(value?Math.max(2,value/max*100):0)+'%';bb.append(bar);const lab=document.createElement('div');lab.textContent=leaderPeriodValue==='year'?String(i+1):leaderPeriodValue==='month'?String(i+1):'День';col.append(bb,lab);chart.append(col)});lr.append(chart);
 const title=document.createElement('h3');title.className='leader-section';title.textContent='Рейтинг мастеров';lr.append(title);
 const namedMasters=rankingMasters();
 const ranked=namedMasters.map(name=>{const orders=list.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(name));return {name,orders:orders.length,services:orders.reduce((n,o)=>n+orderServiceCount(o),0),sum:orders.reduce((n,o)=>n+orderSum(o),0)}}).sort((a,b)=>b.sum-a.sum||b.services-a.services||a.name.localeCompare(b.name,'ru'));
 const highest=Math.max(1,...ranked.map(r=>r.sum));
 ranked.forEach((r,i)=>{const row=document.createElement('div');row.className='leader-rank';const num=document.createElement('div');num.className='leader-rank-number';num.textContent=i+1;const body=document.createElement('div');body.className='leader-rank-body';const head=document.createElement('div');head.className='leader-rank-head';const btn=document.createElement('button');btn.type='button';btn.textContent=r.name;btn.onclick=()=>{leaderSelectedMaster=r.name;drawWorkReport()};const amount=document.createElement('strong');amount.textContent=moneyWork(r.sum);head.append(btn,amount);const track=document.createElement('div');track.className='leader-rank-track';const fill=document.createElement('div');fill.className='leader-rank-fill';fill.style.width=(r.sum/highest*100)+'%';track.append(fill);const meta=document.createElement('div');meta.className='leader-rank-meta';meta.textContent=r.services+' услуг · '+r.orders+' заказов';body.append(head,track,meta);row.append(num,body);lr.append(row)});
 const guestOrders=list.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster('Гость'));
 if(guestOrders.length){const note=document.createElement('div');note.className='leader-note';note.textContent='Заказы «Гость»: '+guestOrders.length+' — включены в общие итоги, но не в рейтинг мастеров.';lr.append(note)}
 const pdfButton=document.createElement('button');pdfButton.type='button';pdfButton.className='secondary';pdfButton.style.marginTop='12px';pdfButton.style.width='100%';pdfButton.textContent='PDF-отчёт руководителя';
 pdfButton.onclick=()=>{const report=window.open('','_blank');if(!report){toast('Разрешите открытие окна для PDF-отчёта');return}const returnUrl=window.location.href;const escPdf=v=>String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));const rows=ranked.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+escPdf(r.name)+'</td><td>'+r.services+'</td><td>'+r.orders+'</td><td>'+escPdf(moneyWork(r.sum))+'</td></tr>').join('');report.document.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>BARDAHL — отчёт руководителя</title><style>body{font:14px Arial,sans-serif;color:#111;padding:24px}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #aaa;padding:9px;text-align:left}th{background:#eee}p{line-height:1.6}@media print{.report-actions{display:none!important}}.report-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;margin-bottom:16px}.report-actions button{padding:12px 18px;border:0;border-radius:9px;background:#243b59;color:white;font-size:15px;cursor:pointer}</style><style id="bardahl-personal-background-css">body[data-bg-style="custom"]{background-image:var(--bardahl-personal-background,none)!important;background-size:cover!important;background-position:center top!important;background-repeat:no-repeat!important;background-attachment:scroll!important}</style></head><body><h1>BARDAHL — статистика мастеров</h1><p>Филиалы: '+escPdf((statsBranch==='all'?'Оба филиала':branchLabel(Number(statsBranch))))+'</p><p>Период: '+escPdf(selectedPeriod.from)+' — '+escPdf(selectedPeriod.to)+'</p><p>Сумма работ: '+escPdf(moneyWork(totalSum))+'<br>Заказов: '+list.length+'<br>Услуг: '+totalServices+'</p><h2>Рейтинг мастеров</h2><table><thead><tr><th>№</th><th>Мастер</th><th>Услуг</th><th>Заказов</th><th>Сумма работ</th></tr></thead><tbody>'+rows+'</tbody></table><p>Отчёт сформирован на основе сохранённых заказов BARDAHL.</p><div class="report-actions"><button id="back-to-app" type="button">← Вернуться в приложение</button><button id="save-report-pdf" type="button">Сохранить PDF</button></div></body></html>');report.document.close();const backButton=report.document.getElementById('back-to-app');backButton.onclick=()=>{try{report.close()}catch(e){}setTimeout(()=>{if(!report.closed)report.location.replace(returnUrl)},120)};const saveButton=report.document.getElementById('save-report-pdf');saveButton.onclick=async()=>{const original=saveButton.textContent;saveButton.disabled=true;saveButton.textContent='Создаётся PDF…';try{
// Offline PDF writer: each A4 page is drawn on canvas with native Cyrillic font.
const W=1240,H=1754,margin=65;const pages=[];let canvas,ctx,y;
function page(){canvas=report.document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';y=margin;pages.push(canvas)}
function line(txt,size=24,bold=false,extra=14){ctx.font=(bold?'bold ':'')+size+'px Arial,sans-serif';ctx.fillStyle='#111';ctx.fillText(String(txt),margin,y);y+=size+extra}
function rule(){ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(W-margin,y);ctx.stroke()}
function newIfNeeded(h){if(y+h>H-margin)page()}
function row(cells,header=false){const widths=[55,350,155,160,390],he=55;newIfNeeded(he+12);if(header){ctx.fillStyle='#eee';ctx.fillRect(margin,y-31,W-2*margin,he)}ctx.strokeStyle='#bbb';ctx.strokeRect(margin,y-31,W-2*margin,he);let x=margin;for(let i=0;i<cells.length;i++){if(i){ctx.beginPath();ctx.moveTo(x,y-31);ctx.lineTo(x,y+he-31);ctx.stroke()}ctx.font=(header?'bold ':'')+'21px Arial,sans-serif';ctx.fillStyle='#111';let t=String(cells[i]);const max=widths[i]-15;while(t.length>1&&ctx.measureText(t).width>max)t=t.slice(0,-2)+'…';ctx.fillText(t,x+8,y+3);x+=widths[i]}y+=he}
page();line('BARDAHL — статистика мастеров',40,true,35);line('Филиалы: '+((statsBranch==='all'?'Оба филиала':branchLabel(Number(statsBranch)))));line('Период: '+selectedPeriod.from+' — '+selectedPeriod.to,27,false,23);line('Сумма работ: '+moneyWork(totalSum),28,false,16);line('Заказов: '+list.length,28,false,16);line('Услуг: '+totalServices,28,false,38);line('Рейтинг мастеров',30,true,35);
row(['№','Мастер','Услуг','Заказов','Сумма работ'],true);ranked.forEach((r,i)=>row([i+1,r.name,r.services,r.orders,moneyWork(r.sum)]));newIfNeeded(80);y+=35;line('Отчёт сформирован на основе сохранённых заказов BARDAHL.',22);
const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;function add(b){chunks.push(b);length+=b.length}function str(t){add(encoder.encode(t))}function obj(n,content){offsets[n]=length;str(n+' 0 obj\n'+content+'\nendobj\n')}
const imgs=pages.map(c=>{const data=c.toDataURL('image/jpeg',0.86).split(',')[1];const binary=atob(data);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes});
const count=2+pages.length*3;str('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');const kids=pages.map((_,i)=>(3+i*3)+' 0 R').join(' ');obj(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+pages.length+' >>');
for(let i=0;i<pages.length;i++){const p=3+i*3,im=p+1,stream=p+2;obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 '+im+' 0 R >> >> /Contents '+stream+' 0 R >>');offsets[im]=length;str(im+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+imgs[i].length+' >>\nstream\n');add(imgs[i]);str('\nendstream\nendobj\n');const cmd='q 595 0 0 842 0 0 cm /Im0 Do Q\n';obj(stream,'<< /Length '+encoder.encode(cmd).length+' >>\nstream\n'+cmd+'endstream')}
const xref=length;str('xref\n0 '+(count+1)+'\n0000000000 65535 f \n');for(let i=1;i<=count;i++)str(String(offsets[i]).padStart(10,'0')+' 00000 n \n');str('trailer\n<< /Size '+(count+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
const blob=new Blob(chunks,{type:'application/pdf'}),filename='BARDAHL-report-'+selectedPeriod.from+'-'+selectedPeriod.to+'.pdf';
const url=report.URL.createObjectURL(blob);const isIOS=/iPad|iPhone|iPod/.test(report.navigator.userAgent)||(/Macintosh/.test(report.navigator.userAgent)&&report.navigator.maxTouchPoints>1);
if(isIOS){const opened=report.open(url,'_blank');if(!opened){report.location.href=url}else{report.alert('PDF открыт. Нажмите «Поделиться» и выберите «Сохранить в Файлы».')}}else{const a=report.document.createElement('a');a.href=url;a.download=filename;report.document.body.appendChild(a);a.click();a.remove()}report.setTimeout(()=>report.URL.revokeObjectURL(url),180000);
}catch(err){report.alert('Не удалось сохранить PDF: '+(err.message||err))}finally{saveButton.disabled=false;saveButton.textContent=original}};report.focus()};lr.append(pdfButton);
 const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='secondary';exportButton.style.marginTop='16px';exportButton.style.width='100%';exportButton.textContent='Скачать рейтинг (Excel / CSV)';
 exportButton.onclick=()=>{const rows=[['Место','Мастер','Услуг','Заказов','Сумма (₸)'],...ranked.map((r,i)=>[i+1,r.name,r.services,r.orders,r.sum])];const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');downloadWork('bardahl-masters-'+statsBranch+'-'+leaderPeriodValue+'-'+referenceDate+'.csv',csv,'text/csv;charset=utf-8')};lr.append(exportButton);
}

function drawBranchReport(branchId,sourceOrders,branchRecords,branchStats){
 const workOrders=sourceOrders.filter(o=>branchId==='all'||Number(o.branchId)===Number(branchId)),statsBranch=String(branchId);
 let leaderSelectedMaster=leaderMasterByBranch[branchId]||null;
 const scoped={leaderRecords:branchRecords,leaderStats:branchStats,workReport:document.createElement('div')};
 const $=id=>scoped[id]||document.getElementById(id);
 const rankingMasters=()=>[...new Set([...leaderRoster.filter(p=>branchId==='all'||Number(p.branch_id)===Number(branchId)).map(p=>p.display_name),...workOrders.map(o=>o.master)])].filter(n=>n&&normalizeWorkMaster(n)!==normalizeWorkMaster('Гость'));

 const date=$('reportDate').value||workToday(),month=date.slice(0,7),year=date.slice(0,4),root=$('workReport');root.replaceChildren();
 const masterDaily=$('masterDailyServices'),masterDailyList=$('masterDailyServicesList');
 if(!isLeader){
   const own=workOrders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(me));
   const personalDay=computeMasterRecords(own.filter(o=>countsForPersonalRecord(o)&&countsForDailyStats(o)));
   const personalMonth=computeMasterRecords(own);
   const personal={day:personalDay.day,month:personalMonth.month};
   renderRecordPair($('masterRecords'),{day:personal.day?{key:personal.day[0],amount:personal.day[1]}:null,month:personal.month?{key:personal.month[0],amount:personal.month[1]}:null});
   const monthlyOrders=workOrders.filter(o=>o.date.startsWith(month));
   const activeDays=new Set(monthlyOrders.map(o=>o.date).filter(Boolean)).size;
   const monthlyTotal=monthlyOrders.reduce((sum,o)=>sum+orderSum(o),0);
   const averageNode=$('masterMonthAverage');if(averageNode)averageNode.textContent=activeDays?moneyWork(Math.round(monthlyTotal/activeDays)):moneyWork(0);
   const groups=[['День',workOrders.filter(o=>o.date===date&&countsForDailyStats(o))],['Месяц',workOrders.filter(o=>o.date.startsWith(month))],['Год',workOrders.filter(o=>o.date.startsWith(year))]];
   groups.forEach(([label,list])=>{const box=document.createElement('div');box.className='stat';const serviceCount=list.reduce((n,o)=>n+orderServiceCount(o),0),sum=list.reduce((n,o)=>n+orderSum(o),0);box.innerHTML=`<span>${label}</span><div>${list.length} Авто</div><strong>${serviceCount}</strong><span>услуг</span><div style="margin-top:5px;color:var(--yellow);font-size:12px;font-weight:800">${esc(moneyWork(sum))}</div>`;root.append(box)});
   if(masterDailyList){masterDailyList.replaceChildren();const daily=workOrders.filter(o=>o.date===date&&countsForDailyStats(o)),services=summarizeServices(daily);if(!services.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='За выбранную дату выполненных услуг нет';masterDailyList.append(empty)}else services.forEach(([name,count])=>{const row=document.createElement('div');row.className='daily-service-row';row.innerHTML=`<span>${esc(name)}</span><strong class="service-count-badge">${count}</strong>`;masterDailyList.append(row)})}
 }
 const leaderOrders=workOrders.filter(countsForLeader);
 const leaderRecordBox=$('leaderRecords');if(leaderRecordBox){leaderRecordBox.classList.toggle('hidden',!isLeader);if(isLeader){leaderRecordBox.replaceChildren();const heading=document.createElement('div');heading.className='record-heading';heading.textContent='🏆 Рекорды среди мастеров · за всё время';const pair=document.createElement('div');pair.className='record-pair';leaderRecordBox.append(heading,pair);renderRecordPair(pair,leaderBestRecords(workOrders),true)}}
 const lr=$('leaderStats');if(!lr)return;lr.classList.toggle('hidden',!isLeader);$('leaderControls').classList.toggle('hidden',!isLeader);$('masterReportControls').classList.toggle('hidden',isLeader);if(!isLeader)return;lr.replaceChildren();
 const referenceDate=$('leaderDate').value||workToday();
 const periods=['day','month','year'].map(period=>{const b=periodBoundsFor(referenceDate,period);return {...b,orders:leaderOrders.filter(o=>o.date>=b.from&&o.date<=b.to&&(period!=='day'||countsForDailyStats(o)))}});
 // Show all three periods together, using the selected date as the reference.
 if(leaderSelectedMaster){
   const back=document.createElement('button');back.type='button';back.className='secondary leader-back';back.textContent='← Назад ко всем мастерам';back.onclick=()=>{leaderMasterByBranch[branchId]=null;drawWorkReport();drawWorkOrders()};lr.append(back);
   const title=document.createElement('h3');title.textContent='Статистика мастера: '+leaderSelectedMaster;lr.append(title);
   periods.forEach(period=>appendPeriodSummary(lr,period.orders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster)),period.label));
   const daily=periods[0].orders.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster)),services=summarizeServices(daily);
   const sh=document.createElement('h3');sh.style.marginTop='18px';sh.textContent='Выполненные услуги за день';lr.append(sh);
   if(!services.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='За выбранную дату выполненных услуг нет';lr.append(empty)}
   else services.forEach(([name,count])=>{const line=document.createElement('div');line.className='leader-service-row';line.innerHTML=`<span>${esc(name)}</span><strong class="service-count-badge">${count}</strong>`;lr.append(line)});
   const bounds=periodBoundsFor(referenceDate,'month');
   const prev=new Date(bounds.from+'T12:00:00');prev.setDate(0);
   const prevMonth=periodBoundsFor([prev.getFullYear(),String(prev.getMonth()+1).padStart(2,'0'),'01'].join('-'),'month');
   const current=leaderOrders.filter(o=>o.date>=bounds.from&&o.date<=bounds.to&&normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster));
   const previous=leaderOrders.filter(o=>o.date>=prevMonth.from&&o.date<=prevMonth.to&&normalizeWorkMaster(o.master)===normalizeWorkMaster(leaderSelectedMaster));
   const dynamics=document.createElement('div');dynamics.className='leader-dynamics';
   const heading=document.createElement('h3');heading.textContent='Динамика мастера: месяц к месяцу';dynamics.append(heading);
   const metrics=[['Сумма работ',current.reduce((n,o)=>n+orderSum(o),0),previous.reduce((n,o)=>n+orderSum(o),0),true],['Заказы',current.length,previous.length,false],['Услуги',current.reduce((n,o)=>n+orderServiceCount(o),0),previous.reduce((n,o)=>n+orderServiceCount(o),0),false]];
   metrics.forEach(([label,now,old,isMoney])=>{const item=document.createElement('div');item.className='leader-dynamic-item';const change=old?((now-old)/old*100):null;const value=isMoney?moneyWork(now):String(now);const oldValue=isMoney?moneyWork(old):String(old);const diff=change===null?'нет базы для сравнения':(change>0?'+':'')+change.toFixed(1)+'%';item.textContent=label+': '+value+' (прошлый месяц: '+oldValue+') · '+diff;dynamics.append(item)});
   lr.append(dynamics);
   // История выбранного мастера выводится в общем нижнем разделе без дублирования.
   return;
 }
 const selectedPeriod=periods.find(p=>p.from===periodBoundsFor(referenceDate,leaderPeriodValue).from&&p.to===periodBoundsFor(referenceDate,leaderPeriodValue).to)||periods[0];
 $('leaderPeriodButtons').querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('selected',button.dataset.period===leaderPeriodValue));
 const list=selectedPeriod.orders, totalServices=list.reduce((n,o)=>n+orderServiceCount(o),0),totalSum=list.reduce((n,o)=>n+orderSum(o),0);

 const kpis=document.createElement('div');kpis.className='leader-kpis';
 [['Сумма работ',moneyWork(totalSum)],['Услуг',String(totalServices)],['Заказов',String(list.length)]].forEach(([label,value])=>{const box=document.createElement('div');box.className='leader-kpi';const t=document.createElement('span');t.textContent=label;const v=document.createElement('strong');v.textContent=value;box.append(t,v);kpis.append(box)});lr.append(kpis);
 const compareDate=new Date(selectedPeriod.from+'T12:00:00'),prevTo=new Date(compareDate);prevTo.setDate(prevTo.getDate()-1);
 const prevKey=[prevTo.getFullYear(),String(prevTo.getMonth()+1).padStart(2,'0'),String(prevTo.getDate()).padStart(2,'0')].join('-');
 const previous=periodBoundsFor(prevKey,leaderPeriodValue),prevOrders=leaderOrders.filter(o=>o.date>=previous.from&&o.date<=previous.to),prevSum=prevOrders.reduce((n,o)=>n+orderSum(o),0);
 const comparison=document.createElement('div');comparison.className='leader-note';
 comparison.textContent='Сравнение с прошлым периодом: '+(prevSum?((totalSum-prevSum)>=0?'+':'')+Math.round((totalSum-prevSum)/prevSum*100)+'% по сумме работ':'нет базы для сравнения');lr.append(comparison);
 const graphTitle=document.createElement('h3');graphTitle.className='leader-section';graphTitle.textContent='Динамика суммы работ';lr.append(graphTitle);
 const buckets=new Map();
 list.forEach(o=>{const key=leaderPeriodValue==='year'?o.date.slice(0,7):o.date;buckets.set(key,(buckets.get(key)||0)+orderSum(o))});
 const keys=[];
 if(leaderPeriodValue==='day'){keys.push(selectedPeriod.from)}
 else if(leaderPeriodValue==='month'){const [y,m]=selectedPeriod.from.split('-').map(Number);for(let d=1;d<=new Date(y,m,0).getDate();d++)keys.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`)}
 else {for(let m=1;m<=12;m++)keys.push(`${referenceDate.slice(0,4)}-${String(m).padStart(2,'0')}`)}
 const max=Math.max(1,...keys.map(k=>buckets.get(k)||0)),chart=document.createElement('div');chart.className='leader-chart';
 keys.forEach((key,i)=>{const value=buckets.get(key)||0,col=document.createElement('div');col.className='leader-chart-col';col.title=key+' — '+moneyWork(value);const bb=document.createElement('div');bb.className='leader-chart-barbox';const bar=document.createElement('div');bar.className='leader-chart-bar';bar.style.height=(value?Math.max(2,value/max*100):0)+'%';bb.append(bar);const lab=document.createElement('div');lab.textContent=leaderPeriodValue==='year'?String(i+1):leaderPeriodValue==='month'?String(i+1):'День';col.append(bb,lab);chart.append(col)});lr.append(chart);
 const title=document.createElement('h3');title.className='leader-section';title.textContent='Рейтинг мастеров';lr.append(title);
 const namedMasters=rankingMasters();
 const ranked=namedMasters.map(name=>{const orders=list.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster(name));return {name,orders:orders.length,services:orders.reduce((n,o)=>n+orderServiceCount(o),0),sum:orders.reduce((n,o)=>n+orderSum(o),0)}}).sort((a,b)=>b.sum-a.sum||b.services-a.services||a.name.localeCompare(b.name,'ru'));
 const highest=Math.max(1,...ranked.map(r=>r.sum));
 ranked.forEach((r,i)=>{const row=document.createElement('div');row.className='leader-rank';const num=document.createElement('div');num.className='leader-rank-number';num.textContent=i+1;const body=document.createElement('div');body.className='leader-rank-body';const head=document.createElement('div');head.className='leader-rank-head';const btn=document.createElement('button');btn.type='button';btn.textContent=r.name;btn.onclick=()=>{leaderMasterByBranch[branchId]=r.name;drawWorkReport();drawWorkOrders()};const amount=document.createElement('strong');amount.textContent=moneyWork(r.sum);head.append(btn,amount);const track=document.createElement('div');track.className='leader-rank-track';const fill=document.createElement('div');fill.className='leader-rank-fill';fill.style.width=(r.sum/highest*100)+'%';track.append(fill);const meta=document.createElement('div');meta.className='leader-rank-meta';meta.textContent=r.services+' услуг · '+r.orders+' заказов';body.append(head,track,meta);row.append(num,body);lr.append(row)});
 const guestOrders=list.filter(o=>normalizeWorkMaster(o.master)===normalizeWorkMaster('Гость'));
 if(guestOrders.length){const note=document.createElement('div');note.className='leader-note';note.textContent='Заказы «Гость»: '+guestOrders.length+' — включены в общие итоги, но не в рейтинг мастеров.';lr.append(note)}
 const pdfButton=document.createElement('button');pdfButton.type='button';pdfButton.className='secondary';pdfButton.style.marginTop='12px';pdfButton.style.width='100%';pdfButton.textContent='PDF-отчёт руководителя';
 pdfButton.onclick=()=>{const report=window.open('','_blank');if(!report){toast('Разрешите открытие окна для PDF-отчёта');return}const returnUrl=window.location.href;const escPdf=v=>String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));const rows=ranked.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+escPdf(r.name)+'</td><td>'+r.services+'</td><td>'+r.orders+'</td><td>'+escPdf(moneyWork(r.sum))+'</td></tr>').join('');report.document.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>BARDAHL — отчёт руководителя</title><style>body{font:14px Arial,sans-serif;color:#111;padding:24px}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #aaa;padding:9px;text-align:left}th{background:#eee}p{line-height:1.6}@media print{.report-actions{display:none!important}}.report-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;margin-bottom:16px}.report-actions button{padding:12px 18px;border:0;border-radius:9px;background:#243b59;color:white;font-size:15px;cursor:pointer}</style><style id="bardahl-personal-background-css">body[data-bg-style="custom"]{background-image:var(--bardahl-personal-background,none)!important;background-size:cover!important;background-position:center top!important;background-repeat:no-repeat!important;background-attachment:scroll!important}</style></head><body><h1>BARDAHL — статистика мастеров</h1><p>Филиалы: '+escPdf((statsBranch==='all'?'Оба филиала':branchLabel(Number(statsBranch))))+'</p><p>Период: '+escPdf(selectedPeriod.from)+' — '+escPdf(selectedPeriod.to)+'</p><p>Сумма работ: '+escPdf(moneyWork(totalSum))+'<br>Заказов: '+list.length+'<br>Услуг: '+totalServices+'</p><h2>Рейтинг мастеров</h2><table><thead><tr><th>№</th><th>Мастер</th><th>Услуг</th><th>Заказов</th><th>Сумма работ</th></tr></thead><tbody>'+rows+'</tbody></table><p>Отчёт сформирован на основе сохранённых заказов BARDAHL.</p><div class="report-actions"><button id="back-to-app" type="button">← Вернуться в приложение</button><button id="save-report-pdf" type="button">Сохранить PDF</button></div></body></html>');report.document.close();const backButton=report.document.getElementById('back-to-app');backButton.onclick=()=>{try{report.close()}catch(e){}setTimeout(()=>{if(!report.closed)report.location.replace(returnUrl)},120)};const saveButton=report.document.getElementById('save-report-pdf');saveButton.onclick=async()=>{const original=saveButton.textContent;saveButton.disabled=true;saveButton.textContent='Создаётся PDF…';try{
// Offline PDF writer: each A4 page is drawn on canvas with native Cyrillic font.
const W=1240,H=1754,margin=65;const pages=[];let canvas,ctx,y;
function page(){canvas=report.document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';y=margin;pages.push(canvas)}
function line(txt,size=24,bold=false,extra=14){ctx.font=(bold?'bold ':'')+size+'px Arial,sans-serif';ctx.fillStyle='#111';ctx.fillText(String(txt),margin,y);y+=size+extra}
function rule(){ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(W-margin,y);ctx.stroke()}
function newIfNeeded(h){if(y+h>H-margin)page()}
function row(cells,header=false){const widths=[55,350,155,160,390],he=55;newIfNeeded(he+12);if(header){ctx.fillStyle='#eee';ctx.fillRect(margin,y-31,W-2*margin,he)}ctx.strokeStyle='#bbb';ctx.strokeRect(margin,y-31,W-2*margin,he);let x=margin;for(let i=0;i<cells.length;i++){if(i){ctx.beginPath();ctx.moveTo(x,y-31);ctx.lineTo(x,y+he-31);ctx.stroke()}ctx.font=(header?'bold ':'')+'21px Arial,sans-serif';ctx.fillStyle='#111';let t=String(cells[i]);const max=widths[i]-15;while(t.length>1&&ctx.measureText(t).width>max)t=t.slice(0,-2)+'…';ctx.fillText(t,x+8,y+3);x+=widths[i]}y+=he}
page();line('BARDAHL — статистика мастеров',40,true,35);line('Филиалы: '+((statsBranch==='all'?'Оба филиала':branchLabel(Number(statsBranch)))));line('Период: '+selectedPeriod.from+' — '+selectedPeriod.to,27,false,23);line('Сумма работ: '+moneyWork(totalSum),28,false,16);line('Заказов: '+list.length,28,false,16);line('Услуг: '+totalServices,28,false,38);line('Рейтинг мастеров',30,true,35);
row(['№','Мастер','Услуг','Заказов','Сумма работ'],true);ranked.forEach((r,i)=>row([i+1,r.name,r.services,r.orders,moneyWork(r.sum)]));newIfNeeded(80);y+=35;line('Отчёт сформирован на основе сохранённых заказов BARDAHL.',22);
const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;function add(b){chunks.push(b);length+=b.length}function str(t){add(encoder.encode(t))}function obj(n,content){offsets[n]=length;str(n+' 0 obj\n'+content+'\nendobj\n')}
const imgs=pages.map(c=>{const data=c.toDataURL('image/jpeg',0.86).split(',')[1];const binary=atob(data);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes});
const count=2+pages.length*3;str('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');const kids=pages.map((_,i)=>(3+i*3)+' 0 R').join(' ');obj(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+pages.length+' >>');
for(let i=0;i<pages.length;i++){const p=3+i*3,im=p+1,stream=p+2;obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 '+im+' 0 R >> >> /Contents '+stream+' 0 R >>');offsets[im]=length;str(im+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+imgs[i].length+' >>\nstream\n');add(imgs[i]);str('\nendstream\nendobj\n');const cmd='q 595 0 0 842 0 0 cm /Im0 Do Q\n';obj(stream,'<< /Length '+encoder.encode(cmd).length+' >>\nstream\n'+cmd+'endstream')}
const xref=length;str('xref\n0 '+(count+1)+'\n0000000000 65535 f \n');for(let i=1;i<=count;i++)str(String(offsets[i]).padStart(10,'0')+' 00000 n \n');str('trailer\n<< /Size '+(count+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
const blob=new Blob(chunks,{type:'application/pdf'}),filename='BARDAHL-report-'+branchId+'-'+selectedPeriod.from+'-'+selectedPeriod.to+'.pdf';
const url=report.URL.createObjectURL(blob);const isIOS=/iPad|iPhone|iPod/.test(report.navigator.userAgent)||(/Macintosh/.test(report.navigator.userAgent)&&report.navigator.maxTouchPoints>1);
if(isIOS){const opened=report.open(url,'_blank');if(!opened){report.location.href=url}else{report.alert('PDF открыт. Нажмите «Поделиться» и выберите «Сохранить в Файлы».')}}else{const a=report.document.createElement('a');a.href=url;a.download=filename;report.document.body.appendChild(a);a.click();a.remove()}report.setTimeout(()=>report.URL.revokeObjectURL(url),180000);
}catch(err){report.alert('Не удалось сохранить PDF: '+(err.message||err))}finally{saveButton.disabled=false;saveButton.textContent=original}};report.focus()};lr.append(pdfButton);
 const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='secondary';exportButton.style.marginTop='16px';exportButton.style.width='100%';exportButton.textContent='Скачать рейтинг (Excel / CSV)';
 exportButton.onclick=()=>{const rows=[['Место','Мастер','Услуг','Заказов','Сумма (₸)'],...ranked.map((r,i)=>[i+1,r.name,r.services,r.orders,r.sum])];const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');downloadWork('bardahl-masters-'+statsBranch+'-'+leaderPeriodValue+'-'+referenceDate+'.csv',csv,'text/csv;charset=utf-8')};lr.append(exportButton);
}

// Editing and deletion are permitted only for the authenticated author's orders
// during the first 12 hours after the original database creation timestamp.
const WORK_EDIT_WINDOW_MS=12*60*60*1000;
function canModifyWorkOrder(o){
 if(!o||role!=='master'||!profile||!o.userId||o.userId!==profile.user_id)return false;
 const created=Date.parse(o.createdAt||'');
 return Number.isFinite(created)&&Date.now()>=created&&Date.now()-created<WORK_EDIT_WINDOW_MS;
}
function editWorkOrder(id){if(isManager||isLeader)return toast('Нет доступа к оформлению заказов');const o=workOrders.find(x=>x.id===id);if(!canModifyWorkOrder(o))return toast('Редактирование доступно только для своих заказов в течение 12 часов');editingOrderId=id;$('workComment').value='';$('workComment').classList.add('hidden');$('savedComment').textContent=o.comment?'Комментарий (не редактируется): '+o.comment:'Комментарий не был добавлен';$('savedComment').classList.remove('hidden');$('orderCar').value=o.car;$('orderMaster').value=o.master;$('orderDate').value=o.date;workCart=o.items.map(i=>({...i}));$('saveOrder').textContent='Сохранить изменения';$('cancelEdit').classList.remove('hidden');drawWorkCart();switchPage('orders');scheduleContinuitySave();window.scrollTo({top:0,behavior:'smooth'})}
async function deleteWorkOrder(id){if(isManager||isLeader)return toast('Нет доступа к оформлению заказов');const o=workOrders.find(x=>x.id===id);if(!canModifyWorkOrder(o))return toast('Удаление доступно только для своих заказов в течение 12 часов');if(!confirm(`Удалить заказ «${o.car}» на ${moneyWork(o.total)}?`))return;const r=await db.from('work_orders').delete().eq('id',id).eq('user_id',profile.user_id).gte('created_at',new Date(Date.now()-WORK_EDIT_WINDOW_MS).toISOString());if(r.error)return toast('Не удалось удалить: '+r.error.message);await loadWorkOrders();toast('Заказ удалён')}
function startOrderFromQueue(master){if(isManager||isLeader)return;editingOrderId=null;workCart=[];$('workComment').value='';$('workComment').classList.remove('hidden');$('savedComment').classList.add('hidden');$('orderCar').value='';$('orderMaster').value=master;$('orderDate').value=workToday();$('saveOrder').textContent='Сохранить заказ';$('cancelEdit').classList.add('hidden');drawWorkCart();switchPage('orders');scheduleContinuitySave();$('orderCar').focus()}
function downloadWork(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('saveOrder').addEventListener('click',saveWorkOrder);$('cancelEdit').addEventListener('click',()=>{editingOrderId=null;workCart=[];$('workComment').value='';$('workComment').classList.remove('hidden');$('savedComment').classList.add('hidden');$('saveOrder').textContent='Сохранить заказ';$('cancelEdit').classList.add('hidden');$('orderCar').value='';$('orderDate').value=workToday();drawWorkCart();scheduleContinuitySave()});$('reportDate').value=workToday();$('leaderDate').value=workToday();function syncMasterMonthLabel(){const date=$('reportDate').value||workToday();const [y,m]=date.split('-').map(Number);$('masterMonthLabel').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));}
function shiftMasterMonth(delta){const date=$('reportDate').value||workToday();const [y,m,d]=date.split('-').map(Number);const target=new Date(Date.UTC(y,m-1+delta,1));const yy=target.getUTCFullYear(),mm=target.getUTCMonth()+1;const day=Math.min(d,new Date(Date.UTC(yy,mm,0)).getUTCDate());$('reportDate').value=String(yy).padStart(4,'0')+'-'+String(mm).padStart(2,'0')+'-'+String(day).padStart(2,'0');// Keep the month navigation at the same viewport position while reports/history rerender.
 const anchor=$('masterMonthLabel');
 const before=anchor.getBoundingClientRect().top;
 $('reportDate').dispatchEvent(new Event('change',{bubbles:true}));
 const after=anchor.getBoundingClientRect().top;
 if(Number.isFinite(before)&&Number.isFinite(after)&&Math.abs(after-before)>0.5){
   window.scrollBy({top:after-before,left:0,behavior:'instant'});
 }
}
$('masterMonthPrev').addEventListener('click',()=>shiftMasterMonth(-1));$('masterMonthNext').addEventListener('click',()=>shiftMasterMonth(1));syncMasterMonthLabel();
$('reportDate').addEventListener('change',()=>{syncMasterMonthLabel();drawWorkReport();syncAllOrderHistoryDates($('reportDate').value,'master')});$('leaderDate').addEventListener('change',()=>{drawWorkReport();syncAllOrderHistoryDates($('leaderDate').value,'leader')});$('leaderPeriodButtons').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(!b)return;leaderPeriodValue=b.dataset.period;drawWorkReport()});$('orderSearch').addEventListener('input',onMainHistorySearchInput);$('tabQueue').addEventListener('click',()=>switchPage('queue'));$('tabOrders').addEventListener('click',()=>switchPage('orders'));

function safeCsvCell(value){const s=String(value??'');return /^[\s]*[=+@-]/.test(s)?"'"+s:s}
$('exportCsv').onclick=()=>{if(role==='master')return;const rows=[['Дата','Автомобиль / госномер','Мастер','Услуги','Комментарий','Сумма, KZT'],...workOrders.map(o=>[o.date,o.car,o.master,o.items.map(i=>`${i.name} (${i.price})`).join('; '),o.comment,o.total])],csv='\ufeff'+rows.map(row=>row.map(v=>'"'+safeCsvCell(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');downloadWork(`bardahl-orders-${workToday()}.csv`,csv,'text/csv;charset=utf-8')};
$('backup').onclick=()=>downloadWork(`bardahl-backup-${workToday()}.json`,JSON.stringify({app:'BARDAHL',version:3,exportedAt:new Date().toISOString(),orders:workOrders},null,2),'application/json;charset=utf-8');
$('restoreBtn').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!db)throw Error('Нет соединения с общей базой');if(role!=='master')throw Error('Восстановление доступно только мастеру');if(isManager)throw Error('Менеджеру доступна только очередь. Восстановление заказов доступно мастеру для своих заказов.');const data=JSON.parse(await file.text()),items=Array.isArray(data)?data:data.orders;if(!Array.isArray(items))throw Error('Файл резервной копии не содержит список заказов');if(!confirm(`Восстановить до ${items.length} заказов для мастера ${me}? Заказы с именем другого мастера будут пропущены, а старые заказы без мастера будут записаны на вас.`))return;let imported=0,skipped=0,foreign=0,duplicates=0,invalid=0;for(const o of items){if(!o||!o.car||!Array.isArray(o.items)||!o.items.length||o.items.some(i=>!i||!String(i.name||'').trim()||!Number.isFinite(Number(i.price))||Number(i.price)<=0)){skipped++;continue}const backupMaster=String(o.master||o.master_name||'').trim();if(backupMaster&&backupMaster.toLocaleLowerCase('ru')!==String(me).trim().toLocaleLowerCase('ru')){skipped++;foreign++;continue}const payload={branch_id:queueBranch,car:String(o.car),master_name:me,queue_service:null,order_date:String(o.date||o.order_date||workToday()),items:o.items.map(i=>({name:String(i.name||''),price:Number(i.price)||0,...(i.quantity?{quantity:Number(i.quantity)}:{}),...(i.isCustomSto?{isCustomSto:true}:{})})),total:Number(o.total)||o.items.reduce((a,i)=>a+(Number(i.price)||0),0),comment:String(o.comment||'').slice(0,2000),updated_at:new Date().toISOString()};if(o.id){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id)){skipped++;continue}payload.id=o.id}payload.total=payload.items.reduce((sum,i)=>sum+i.price,0);const r=await db.from('work_orders').insert(payload);if(r.error){if(r.error.code==='23505'){skipped++;duplicates++;continue}throw r.error}imported++}await loadWorkOrders();alert(`Восстановление завершено.\nИмпортировано: ${imported}\nПропущено: ${skipped}\nДругой мастер: ${foreign}\nДубликаты: ${duplicates}\nНеверный формат или ID: ${skipped-foreign-duplicates}`)}catch(err){toast('Не удалось импортировать: '+(err.message||String(err)))}finally{e.target.value=''}};

// Отдельный список поверх поля: открывается по нажатию, фильтруется при вводе.
function initCarPicker(){
 const input=$('orderCar'),list=$('carPickerList');
 const cars=[...$('carSuggestions').options].map(o=>o.value).filter(Boolean);
 let opened=false;
 function close(){opened=false;list.hidden=true;input.setAttribute('aria-expanded','false')}
 function show(){
  const query=input.value.trim().toLocaleLowerCase('ru');
  const found=cars.filter(car=>car.toLocaleLowerCase('ru').includes(query));
  list.replaceChildren();
  if(!found.length){const msg=document.createElement('div');msg.className='car-picker-empty';msg.textContent='Не найдено. Можно ввести название вручную.';list.append(msg)}
  else for(const car of found){const b=document.createElement('button');b.type='button';b.className='car-picker-option';b.textContent=car;b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>{input.value=car;close();input.dispatchEvent(new Event('change',{bubbles:true}))});list.append(b)}
  opened=true;list.hidden=false;input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('focus',show);
 input.addEventListener('click',show);
 input.addEventListener('input',show);
 input.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.car-picker'))close()});
 input.addEventListener('blur',()=>{setTimeout(()=>{if(!list.contains(document.activeElement))close()},160)});
}
initCarPicker();

// Shared history rules: today initially; a new search expands to all time.
let leaderQueueSnapshots={},leaderMasterByBranch={},branchHistoryStates=new Map();
function freshHistoryState(){return {period:'day',date:workToday(),query:''}}
let mainHistoryState=freshHistoryState(),lastOrdersRenderKey='';
function resetNewUiState(){leaderQueueSnapshots={};leaderMasterByBranch={};branchHistoryStates.clear();mainHistoryState=freshHistoryState();lastOrdersRenderKey='';if($('historyPeriod'))$('historyPeriod').value='day';if($('historyDate'))$('historyDate').value=workToday();if($('orderSearch'))$('orderSearch').value=''}
function setHistorySearch(state,value){const query=String(value||'').trim();if(query&&!state.query)state.period='all';if(!query){state.period='day';state.date=workToday()}state.query=query}
function carSearchText(value){
 let s=String(value||'').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е');
 const aliases={'тойота':'toyota','тоета':'toyota','ниссан':'nissan','хендай':'hyundai','хундай':'hyundai','хендэ':'hyundai','киа':'kia','бмв':'bmw','мерседес':'mercedes','лексус':'lexus','фольксваген':'volkswagen','ауди':'audi','мазда':'mazda','хонда':'honda','митсубиси':'mitsubishi','шевроле':'chevrolet','рено':'renault','форд':'ford','пежо':'peugeot','субару':'subaru','шкода':'skoda','лада':'lada','камри':'camry','королла':'corolla','прадо':'prado'};
 for(const [from,to] of Object.entries(aliases))s=s.replaceAll(from,to);
 const same={'а':'a','в':'b','е':'e','к':'k','м':'m','н':'h','о':'o','р':'p','с':'c','т':'t','у':'y','х':'x'};
 return s.replace(/[авекмнорстух]/g,c=>same[c]).replace(/[^\p{L}\p{N}]/gu,'');
}
function historyOrders(orders,state){
 const q=carSearchText(state.query),date=state.date||workToday();
 return orders.filter(o=>{
  if(q&&!carSearchText(o.car).includes(q))return false;
  if(state.period==='day')return o.date===date;
  if(state.period==='month')return String(o.date||'').slice(0,7)===date.slice(0,7);
  if(state.period==='year')return String(o.date||'').slice(0,4)===date.slice(0,4);
  return true;
 }).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(b.id).localeCompare(String(a.id)));
}
function syncAllOrderHistoryDates(date,origin){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return;
 mainHistoryState.date=date;
 for(const state of branchHistoryStates.values())state.date=date;
 if(origin!=='master' && $('reportDate'))$('reportDate').value=date;
 if(origin!=='leader' && $('leaderDate'))$('leaderDate').value=date;
 drawWorkOrders();
 if(isLeader && origin!=='leader')drawWorkReport();
 if(!isLeader && origin!=='master'){syncMasterMonthLabel();drawWorkReport()}
}
function historyDateValue(state){return state.period==='month'?state.date.slice(0,7):state.period==='year'?state.date.slice(0,4):state.date}
function setHistoryDate(state,value){if(state.period==='year'&&/^\d{4}$/.test(value))state.date=value+'-01-01';else if(state.period==='month'&&/^\d{4}-\d{2}$/.test(value))state.date=value+'-01';else if(state.period==='day'&&/^\d{4}-\d{2}-\d{2}$/.test(value))state.date=value;else return false;return true}
function configureHistoryDate(input,state){const type=state.period==='month'?'month':state.period==='year'?'number':'date';if(input.type!==type)input.type=type;input.disabled=state.period==='all';if(state.period==='year'){input.min='1900';input.max='9999';input.step='1'}else{input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step')}if(document.activeElement!==input)input.value=historyDateValue(state)}
function historyHint(state,count){const scope=state.period==='all'?'за всё время':state.period==='day'?'за '+state.date:state.period==='month'?'за '+state.date.slice(0,7):'за '+state.date.slice(0,4)+' год';return (state.query?'Результаты поиска ':'Заказы ')+scope+' · '+count}
function orderHistoryCard(o,editable){
 const card=document.createElement('article');card.className='work-order';
 const title=document.createElement('h3');title.textContent=o.car||'Автомобиль не указан';
 const meta=document.createElement('div');meta.className='meta';meta.textContent=o.date+' · '+branchLabel(o.branchId)+' · '+(o.master||'Мастер не указан')+' · '+orderServiceCount(o)+' услуг(и)';
 const detail=document.createElement('div');detail.className='detail';detail.textContent=(o.items||[]).map(i=>String(i.name||'Услуга')+(workItemCount(i)>1?' × '+workItemCount(i):'')+' — '+moneyWork(i.price)).join(' • ');
 const sum=document.createElement('div');sum.className='sum';sum.textContent='Итого: '+moneyWork(orderSum(o));card.append(title,meta,detail);
 if(o.comment){const note=document.createElement('div');note.className='detail';note.style.whiteSpace='pre-wrap';note.textContent='Комментарий: '+o.comment;card.append(note)}card.append(sum);
 if(editable&&canModifyWorkOrder(o)){const actions=document.createElement('div');actions.className='actions';for(const [name,style,action]of [['Редактировать','secondary',()=>editWorkOrder(o.id)],['Удалить','danger',()=>deleteWorkOrder(o.id)]]){const b=document.createElement('button');b.className=style;b.textContent=name;b.onclick=action;actions.append(b)}card.append(actions)}
 return card;
}
function fillHistoryList(root,list,editable){root.replaceChildren();if(!list.length){const empty=document.createElement('div');empty.className='empty-orders';empty.textContent='Заказы по выбранным условиям не найдены';root.append(empty);return}for(const o of list)root.append(orderHistoryCard(o,editable))}
function makeHistoryPeriodSelect(){const select=document.createElement('select');select.setAttribute('aria-label','Период истории заказов');for(const [value,label]of [['day','День'],['month','Месяц'],['year','Год'],['all','Всё время']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}return select}
function renderOrderHistoryWidget(root,orders,key){
 if(!branchHistoryStates.has(key))branchHistoryStates.set(key,{...freshHistoryState(),date:mainHistoryState.date});const state=branchHistoryStates.get(key);
 const title=document.createElement('h3');title.textContent='История заказов';
 const search=document.createElement('input');search.type='search';search.placeholder='Марка, модель или госномер';search.value=state.query;search.dataset.historyKey=key;search.id='history-search-'+encodeURIComponent(key);search.setAttribute('aria-label','Поиск автомобиля в истории');
 const controls=document.createElement('div');controls.className='history-filter-controls';const period=makeHistoryPeriodSelect();period.value=state.period;
 const date=document.createElement('input');date.setAttribute('aria-label','Дата периода истории');configureHistoryDate(date,state);controls.append(period,date);
 const hint=document.createElement('div');hint.className='small history-scope';const list=document.createElement('div');
 const update=()=>{period.value=state.period;configureHistoryDate(date,state);const found=historyOrders(orders,state);hint.textContent=historyHint(state,found.length);fillHistoryList(list,found,false)};
 search.addEventListener('input',()=>{setHistorySearch(state,search.value);update()});period.addEventListener('change',()=>{state.period=period.value;update()});const applyDate=()=>{if(setHistoryDate(state,date.value)){syncAllOrderHistoryDates(state.date,'history');update()}};date.addEventListener('input',applyDate);date.addEventListener('change',applyDate);root.append(title,search,controls,hint,list);update();
}
function initializeMainHistory(){
 const controls=$('historyControls'),period=makeHistoryPeriodSelect();period.id='historyPeriod';
 const date=document.createElement('input');date.id='historyDate';date.setAttribute('aria-label','Дата периода истории');controls.append(period,date);
 period.addEventListener('change',()=>{mainHistoryState.period=period.value;drawWorkOrders()});const applyDate=()=>{if(setHistoryDate(mainHistoryState,date.value))syncAllOrderHistoryDates(mainHistoryState.date,'history')};date.addEventListener('input',applyDate);date.addEventListener('change',applyDate);
 configureHistoryDate(date,mainHistoryState);
}
function onMainHistorySearchInput(){setHistorySearch(mainHistoryState,$('orderSearch').value);drawWorkOrders()}
function drawWorkOrders(){
 const root=$('orderHistory');if(!root||!profile)return;
 const selectedLeaderMaster=isLeader?(leaderMasterByBranch[statsBranch]||null):null;
 const allowed=isLeader?workOrders.filter(o=>(statsBranch==='all'||Number(o.branchId)===Number(statsBranch))&&(!selectedLeaderMaster||normalizeWorkMaster(o.master)===normalizeWorkMaster(selectedLeaderMaster))):role==='master'?workOrders.filter(o=>o.userId===profile.user_id):[];
 $('historyPeriod').value=mainHistoryState.period;configureHistoryDate($('historyDate'),mainHistoryState);
 const list=historyOrders(allowed,mainHistoryState);$('historyScopeHint').textContent=(selectedLeaderMaster?'Мастер: '+selectedLeaderMaster+' · ':'')+historyHint(mainHistoryState,list.length);fillHistoryList(root,list,role==='master');
}
function drawWorkReport(){
 if(!isLeader)return drawPersonalWorkReport();
 const focused=document.activeElement,key=focused?.dataset?.historyKey,start=focused?.selectionStart,end=focused?.selectionEnd;
 const records=$('leaderRecords'),stats=$('leaderStats');records.replaceChildren();stats.replaceChildren();records.classList.remove('hidden');stats.classList.remove('hidden');
 $('leaderControls').classList.remove('hidden');$('masterReportControls').classList.add('hidden');$('workReport').replaceChildren();
 initializeLeaderStatsFilter();drawBranchReport(statsBranch,workOrders,records,stats);
 if(key){const input=document.getElementById('history-search-'+encodeURIComponent(key));if(input){input.focus({preventScroll:true});if(start!=null&&typeof input.setSelectionRange==='function')input.setSelectionRange(start,end)}}
}
function syncJoinBranchControl(p){
 const chooser=$('positionChooser');if(!chooser)return;
 let label=$('joinBranchLabel'),select=$('joinBranchSelect');
 if(!select){label=document.createElement('label');label.id='joinBranchLabel';label.htmlFor='joinBranchSelect';label.textContent='Филиал';select=document.createElement('select');select.id='joinBranchSelect';
 for(const id of [1,2]){const option=document.createElement('option');option.value=String(id);option.textContent=branchLabel(id);select.append(option)}
 chooser.prepend(label,select);select.addEventListener('change',async()=>{try{await selectAppBranch(Number(select.value))}finally{select.value=String(queueBranch)}})}
 label.classList.toggle('hidden',p.role!=='master');select.classList.toggle('hidden',p.role!=='master');select.value=String(queueBranch);select.disabled=changingBranch;
}
function initializeLeaderStatsFilter(){
 let select=$('leaderStatsBranch');if(!select){
 const row=document.createElement('div');row.className='leader-stats-branch';const label=document.createElement('label');label.htmlFor='leaderStatsBranch';label.textContent='Филиал для статистики';select=document.createElement('select');select.id='leaderStatsBranch';
 for(const [value,name]of [['1','Металлургов'],['2','КШТ'],['all','Оба филиала']]){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option)}
 row.append(label,select);$('leaderControls').prepend(row);
 select.addEventListener('change',()=>{statsBranch=select.value;try{localStorage.setItem('bardahl-leader-stats-'+profile.user_id,statsBranch)}catch(e){}drawWorkReport();drawWorkOrders()});
 }select.value=statsBranch;
}
initializeMainHistory();

initWorkForm();$('orderDate').value=workToday();
restoreSession();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
