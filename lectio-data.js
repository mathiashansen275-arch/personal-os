// Loads the v3 Personal OS layer, then applies schedule text/detail positioning fixes.
// UI patch version: details-fix-v4
(function(){
  const PREV_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/6d9b1856212b0cac9507d3897cba6ab9e3368f0b/lectio-data.js';
  let lockedDetailLeft='';
  let lockedDetailTop='';

  function injectV4Style(){
    let style=document.getElementById('assistant-details-fix-v4');
    if(!style){
      style=document.createElement('style');
      style.id='assistant-details-fix-v4';
      document.head.appendChild(style);
    }
    style.textContent=`
      #scheduleView .event{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event .time{display:block!important;text-align:left!important;align-self:stretch!important;line-height:1.05!important}
      #scheduleView .event .title{display:block!important;text-align:left!important;align-self:stretch!important;font-weight:850!important;line-height:1.12!important}
      #scheduleView .event.homework .time,#scheduleView .event.homework .title{font-size:12px!important;text-align:left!important}
      #scheduleView .event.aiCompact .time{font-size:12px!important;text-align:left!important;display:block!important;width:100%!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.aiHasDetails .time{padding-right:82px!important;box-sizing:border-box!important}
      #scheduleView .event.aiHasDetails .title{padding-right:0!important;box-sizing:border-box!important}
      #scheduleView .event .aiDetailShow{position:absolute!important;right:8px!important;top:4px!important;height:20px!important;min-height:20px!important;line-height:18px!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important}
      #scheduleView .event.small .aiDetailShow{top:3px!important;height:18px!important;min-height:18px!important;line-height:16px!important;font-size:10.5px!important;padding:0 8px!important}
      .aiDetailFloat{position:fixed!important;z-index:120!important;max-width:360px!important;font-size:13.5px!important;line-height:1.35!important;background:#100b1b!important;border:1px solid #7f52ff!important;border-radius:10px!important;padding:10px 12px!important;box-shadow:0 14px 38px rgba(0,0,0,.48)!important;color:#f7f3ff!important;pointer-events:auto!important;transform:none!important}
      .aiDetailFloat div{font-size:13.5px!important}
      .aiDetailFloatTitle{font-size:13.5px!important;font-weight:850!important;margin-bottom:4px!important}
    `;
    document.head.appendChild(style);
  }

  function markDetailButtons(){
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const has=!!el.querySelector('.aiDetailShow');
      el.classList.toggle('aiHasDetails',has);
      const title=el.querySelector('.title');
      const time=el.querySelector('.time');
      if(title){title.style.textAlign='left';title.style.fontWeight='850'}
      if(time)time.style.textAlign='left';
    });
  }

  function lockDetailFloat(){
    const box=document.getElementById('aiDetailFloat');
    if(!box)return;
    const r=box.getBoundingClientRect();
    lockedDetailLeft=Math.round(r.left)+'px';
    lockedDetailTop=Math.round(r.top)+'px';
    box.style.position='fixed';
    box.style.left=lockedDetailLeft;
    box.style.top=lockedDetailTop;
  }

  function restoreLockedDetailFloat(){
    const box=document.getElementById('aiDetailFloat');
    if(!box || !lockedDetailLeft || !lockedDetailTop)return;
    box.style.position='fixed';
    box.style.left=lockedDetailLeft;
    box.style.top=lockedDetailTop;
  }

  function afterDetailsClick(e){
    if(!e.target.closest || !e.target.closest('.aiDetailShow'))return;
    lockedDetailLeft='';
    lockedDetailTop='';
    setTimeout(lockDetailFloat,0);
    setTimeout(lockDetailFloat,40);
    setTimeout(lockDetailFloat,120);
  }

  function applyV4(){
    injectV4Style();
    markDetailButtons();
    restoreLockedDetailFloat();
  }

  document.addEventListener('click',afterDetailsClick,true);
  window.addEventListener('scroll',function(){setTimeout(restoreLockedDetailFloat,0)},true);
  window.addEventListener('resize',function(){lockedDetailLeft='';lockedDetailTop='';setTimeout(lockDetailFloat,0)});

  function startV4(){
    applyV4();
    setTimeout(applyV4,0);
    setTimeout(applyV4,50);
    setTimeout(applyV4,250);
    setInterval(applyV4,60);
  }

  fetch(PREV_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);startV4();})
    .catch(()=>startV4());
})();
