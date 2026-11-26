(function(){
 function init(){
   var wrap=document.querySelector('#queueTableCard .table-wrap');
   if(!wrap)return;
   var table=wrap.querySelector('.queue-table');
   if(!table)return;
   var raf=0;
   function apply(){
     raf=0;
     var fixed=table.querySelector('tbody td:nth-child(2)')||table.querySelector('thead th:nth-child(2)');
     if(!fixed)return;
     var boundary=fixed.getBoundingClientRect().right;
     table.querySelectorAll('tr').forEach(function(tr){
       Array.prototype.forEach.call(tr.children,function(cell,i){
         if(i<2)return;
         var r=cell.getBoundingClientRect();
         var hide=Math.max(0,Math.min(r.width,boundary-r.left));
         cell.style.setProperty('--bardahl-hidden-left',hide.toFixed(2)+'px');
       });
     });
   }
   function schedule(){if(raf)return;raf=requestAnimationFrame(apply)}
   wrap.addEventListener('scroll',schedule,{passive:true});
   window.addEventListener('resize',schedule,{passive:true});
   if(window.MutationObserver){
     var observer=new MutationObserver(schedule);
     observer.observe(table,{childList:true,subtree:true});
   }
   schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
})();
