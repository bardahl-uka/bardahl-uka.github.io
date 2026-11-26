(function(){
  function init(){
    var input=document.getElementById('reportDate');
    var output=document.getElementById('reportDateDisplay');
    if(!input||!output)return;
    function update(){
      var parts=(input.value||'').split('-').map(Number);
      if(parts.length===3&&parts.every(Number.isFinite)){
        output.textContent=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(parts[0],parts[1]-1,parts[2])));
      }else output.textContent='Выбрать дату';
    }
    input.addEventListener('change',update);
    input.addEventListener('input',update);
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
