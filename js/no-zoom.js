// Disable pinch-zoom and double-tap zoom (iOS Safari ignores maximum-scale).
(function(){
  var st=document.createElement('style');
  st.textContent='html,body{touch-action:pan-x pan-y}';
  document.head.appendChild(st);
  ['gesturestart','gesturechange','gestureend'].forEach(function(n){
    document.addEventListener(n,function(e){e.preventDefault()},{passive:false});
  });
})();
