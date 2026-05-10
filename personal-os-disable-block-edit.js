// Personal OS: block manual schedule editing; AI/tools remain able to change state.
(function(){
  function ensureStyle(){
    if(document.getElementById('pos-disable-block-edit-style'))return;
    const s=document.createElement('style');
    s.id='pos-disable-block-edit-style';
    s.textContent='#scheduleView .event{cursor:default!important}#scheduleView .event:hover{transform:none!important;filter:none!important;box-shadow:inherit!important}#scheduleView .event .posAgentDetails{cursor:pointer!important}';
    document.head.appendChild(s);
  }
  function protect(e){
    const target=e.target&&e.target.closest&&e.target.closest('#scheduleView .event');
    if(!target)return;
    if(e.target.closest('.posAgentDetails'))return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  }
  ensureStyle();
  ['click','dblclick','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend'].forEach(type=>document.addEventListener(type,protect,true));
})();
