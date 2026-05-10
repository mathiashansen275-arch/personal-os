// Personal OS: block manual schedule editing; AI/tools remain able to change state.
(function(){
  function protect(e){
    const target=e.target&&e.target.closest&&e.target.closest('#scheduleView .event');
    if(!target)return;
    if(e.target.closest('.posAgentDetails'))return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  }
  ['click','dblclick','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend'].forEach(type=>document.addEventListener(type,protect,true));
})();
