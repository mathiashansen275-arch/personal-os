// Loads the latest stable to-do/schedule layer, then applies final visual tweaks.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/6421c1c6e5db32787edc6a9329f4073632861d93/lectio-data.js';

  function applyFinalTweaks(){
    document.querySelectorAll('#todo-final-tweaks').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='todo-final-tweaks';
    s.textContent=`
      .todoSide{border-color:#2b2351!important;background:linear-gradient(180deg,rgba(29,20,54,.94),rgba(9,7,20,.97))!important;box-shadow:0 0 0 1px rgba(155,108,255,.12) inset,0 18px 40px rgba(0,0,0,.34)!important}
      .todoToday{border-color:rgba(155,108,255,.52)!important;background:linear-gradient(180deg,rgba(92,52,170,.24),rgba(20,14,42,.80))!important}
      .todoToday .todoDayTop{color:#efe6ff!important}
      .todoBarFill{background:linear-gradient(90deg,#7a55c8,#b875ff)!important}
      .todoMain{border-color:#201a39!important;background:linear-gradient(180deg,rgba(11,9,22,.92),rgba(4,5,10,.96))!important}
      .todoMain .panelHead{margin-bottom:4px!important}
      .todoMain .panelTitle{line-height:1.05!important}
      .todoMain .table th{padding-top:10px!important;padding-bottom:10px!important}
      .chartBar{background:linear-gradient(180deg,#b875ff,#4b367f)!important}
    `;
    document.head.appendChild(s);
  }

  function renameTaskHeader(){
    document.querySelectorAll('#todoView th').forEach(th=>{
      if((th.textContent||'').trim().toLowerCase()==='task text') th.textContent='Task';
    });
  }

  function patchRenderTasks(){
    const apply=()=>{applyFinalTweaks();renameTaskHeader()};
    apply();
    const old=window.renderTasks || (typeof renderTasks==='function' ? renderTasks : null);
    if(typeof old==='function'&&!window.__todoFinalTweaksPatched){
      window.__todoFinalTweaksPatched=true;
      renderTasks=function(){const out=old.apply(this,arguments);setTimeout(apply,0);return out};
      window.renderTasks=renderTasks;
      setTimeout(()=>{try{renderTasks()}catch(e){apply()}},50);
    }
    setInterval(apply,1000);
  }

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    setTimeout(patchRenderTasks,650);
  }).catch(()=>{
    applyFinalTweaks();
    setTimeout(patchRenderTasks,650);
  });
})();
