// Loads the latest stable to-do/schedule layer, then applies final visual tweaks and automatic task relevance sorting.
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

  function normalizeTaskDay(v){
    const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today=weekdayNames[new Date().getDay()];
    if(!v||v==='Later'||v===today)return'Today';
    return v;
  }

  function taskDayRank(v){
    const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayIdx=new Date().getDay();
    const d=normalizeTaskDay(v);
    if(d==='Today')return 0;
    const idx=weekdayNames.indexOf(d);
    if(idx<0)return 99;
    const diff=(idx-todayIdx+7)%7;
    return diff===0?0:diff;
  }

  function autoSortTasksByRelevance(){
    if(!Array.isArray(window.tasks)&&!(typeof tasks!=='undefined'&&Array.isArray(tasks)))return false;
    const arr=window.tasks||tasks;
    const before=arr.map(t=>t.id+':' + normalizeTaskDay(t.day)).join('|');
    arr.forEach((t,i)=>{t.__stableOrder=i;t.day=normalizeTaskDay(t.day)});
    arr.sort((a,b)=>taskDayRank(a.day)-taskDayRank(b.day)+(a.__stableOrder-b.__stableOrder)/10000);
    arr.forEach(t=>delete t.__stableOrder);
    const after=arr.map(t=>t.id+':' + normalizeTaskDay(t.day)).join('|');
    if(after!==before){
      try{localStorage.setItem('personalOS.tasks.v1',JSON.stringify(arr))}catch(e){}
      return true;
    }
    return false;
  }

  function patchTaskSorting(){
    if(window.__todoAutoSortPatched)return;
    window.__todoAutoSortPatched=true;
    const oldSave=window.saveTasks || (typeof saveTasks==='function' ? saveTasks : null);
    if(typeof oldSave==='function'){
      saveTasks=function(){autoSortTasksByRelevance();return oldSave.apply(this,arguments)};
      window.saveTasks=saveTasks;
    }
    const oldRender=window.renderTasks || (typeof renderTasks==='function' ? renderTasks : null);
    if(typeof oldRender==='function'){
      renderTasks=function(){autoSortTasksByRelevance();const out=oldRender.apply(this,arguments);setTimeout(()=>{applyFinalTweaks();renameTaskHeader()},0);return out};
      window.renderTasks=renderTasks;
      setTimeout(()=>{try{renderTasks()}catch(e){}},50);
    }
  }

  function patchRenderTasks(){
    const apply=()=>{applyFinalTweaks();renameTaskHeader();patchTaskSorting()};
    apply();
    const old=window.renderTasks || (typeof renderTasks==='function' ? renderTasks : null);
    if(typeof old==='function'&&!window.__todoFinalTweaksPatched){
      window.__todoFinalTweaksPatched=true;
      renderTasks=function(){autoSortTasksByRelevance();const out=old.apply(this,arguments);setTimeout(apply,0);return out};
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
