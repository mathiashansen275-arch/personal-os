// Loads the latest stable to-do/schedule layer, then applies final to-do behavior fixes.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/4512f9bdfa9353599566ce6f51851ec42e1f8392/lectio-data.js';

  function hideTodoDuringPatch(){
    if(document.getElementById('todo-no-flash'))return;
    const s=document.createElement('style');
    s.id='todo-no-flash';
    s.textContent='#todoView .panel{opacity:0!important}';
    document.head.appendChild(s);
  }
  hideTodoDuringPatch();

  function showTodoAfterPatch(){
    document.querySelectorAll('#todo-no-flash').forEach(x=>x.remove());
    if(!document.getElementById('todo-ready')){
      const s=document.createElement('style');
      s.id='todo-ready';
      s.textContent='#todoView .panel{opacity:1!important}';
      document.head.appendChild(s);
    }
  }

  function isDefaultTaskText(v){
    const s=String(v||'').trim().toLowerCase();
    return !s || s==='new task';
  }

  function forceNewTasksToSelectDay(){
    if(typeof tasks!=='undefined' && Array.isArray(tasks)){
      let changed=false;
      tasks.forEach(t=>{
        if(isDefaultTaskText(t.text) && t.day!==''){
          t.day='';
          changed=true;
        }
      });
      if(changed){
        try{localStorage.setItem('personalOS.tasks.v1',JSON.stringify(tasks))}catch(e){}
      }
    }

    document.querySelectorAll('#todoView .todoRow').forEach(row=>{
      const input=row.querySelector('.taskPill');
      const select=row.querySelector('.cellSelect');
      if(!input||!select)return;
      if(isDefaultTaskText(input.value)){
        select.value='';
        select.classList.add('selectPlaceholder');
      }else{
        select.classList.remove('selectPlaceholder');
      }
    });
  }

  function resizeTaskPill(el){
    el.style.width='min(782px, calc(100% - 44px))';
    el.style.maxWidth='min(782px, calc(100% - 44px))';
    el.style.height='40px';
    const needed=Math.max(40,Math.min(68,el.scrollHeight));
    if(needed>44)el.style.height=needed+'px';
  }

  function upgradeTaskTextareas(){
    document.querySelectorAll('#todoView input.taskPill').forEach(input=>{
      const row=input.closest('.todoRow');
      const ta=document.createElement('textarea');
      ta.className=input.className;
      ta.value=input.value||'';
      ta.setAttribute('rows','1');
      ta.setAttribute('spellcheck','false');
      input.replaceWith(ta);
      resizeTaskPill(ta);
      ta.addEventListener('input',()=>{
        resizeTaskPill(ta);
        if(row&&typeof tasks!=='undefined'&&Array.isArray(tasks)){
          const t=tasks.find(x=>x.id===row.dataset.id);
          if(t)t.text=ta.value;
        }
      });
      ta.addEventListener('change',()=>{
        if(typeof tasks!=='undefined'&&Array.isArray(tasks)){
          const t=row?tasks.find(x=>x.id===row.dataset.id):null;
          if(t){
            t.text=ta.value;
            if(isDefaultTaskText(t.text))t.day='';
            else if(!t.day)t.day='Today';
          }
          try{localStorage.setItem('personalOS.tasks.v1',JSON.stringify(tasks))}catch(e){}
        }
        if(typeof renderTasks==='function')renderTasks();
        if(typeof renderProductivity==='function')renderProductivity();
      });
      ta.addEventListener('dragstart',e=>e.preventDefault(),true);
      ta.addEventListener('mousedown',e=>e.stopPropagation(),true);
    });
    document.querySelectorAll('#todoView textarea.taskPill').forEach(resizeTaskPill);
  }

  function applyDragHandleOnly(){
    document.querySelectorAll('#todo-drag-handle-only').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='todo-drag-handle-only';
    s.textContent=`
      #todoView .todoMain .table{table-layout:fixed!important;width:100%!important}
      #todoView .todoMain .table th:nth-child(1),#todoView .todoMain .table td:nth-child(1){width:60px!important;min-width:60px!important;max-width:60px!important}
      #todoView .todoMain .table th:nth-child(3),#todoView .todoMain .table td:nth-child(3){width:170px!important;min-width:170px!important;max-width:170px!important}
      #todoView .todoMain .table th:nth-child(4),#todoView .todoMain .table td:nth-child(4){width:112px!important;min-width:112px!important;max-width:112px!important}
      #todoView .cellSelect{width:150px!important;min-width:150px!important;max-width:150px!important;display:block!important;padding-left:14px!important;padding-right:28px!important}
      #todoView .todoMain .taskText{width:100%!important;max-width:none!important;display:flex!important;align-items:center!important;gap:10px!important;overflow:visible!important}
      #todoView .taskPill{cursor:text!important;user-select:text!important;-webkit-user-drag:none!important;font-size:16px!important;font-weight:580!important;letter-spacing:.005em!important;width:min(782px,calc(100% - 44px))!important;max-width:min(782px,calc(100% - 44px))!important;min-width:280px!important;white-space:normal!important;line-height:20px!important;resize:none!important;overflow:hidden!important;box-sizing:border-box!important;vertical-align:middle!important;padding-top:9px!important;padding-bottom:9px!important}
      #todoView textarea.taskPill{font-family:inherit!important;display:block!important;min-height:40px!important;border-radius:20px!important}
      #todoView .todoRow td{vertical-align:middle!important}
      .todoDayTop{font-size:13px!important}
      .dragCell{cursor:grab!important;user-select:none!important;flex:0 0 24px!important}
      .dragCell:active{cursor:grabbing!important}
      .selectPlaceholder{color:#8f86aa!important}
    `;
    document.head.appendChild(s);

    upgradeTaskTextareas();
    document.querySelectorAll('#todoView .todoRow').forEach(row=>{
      row.draggable=false;
      const handle=row.querySelector('.dragCell');
      const input=row.querySelector('.taskPill');
      if(input){
        input.draggable=false;
        input.addEventListener('dragstart',e=>e.preventDefault(),true);
        input.addEventListener('mousedown',e=>e.stopPropagation(),true);
      }
      if(handle){
        handle.draggable=true;
        handle.addEventListener('dragstart',e=>{
          const r=handle.closest('.todoRow');
          if(!r)return;
          e.dataTransfer.setData('text/plain',r.dataset.id||'');
          r.classList.add('dragging');
        },true);
        handle.addEventListener('dragend',()=>{
          const r=handle.closest('.todoRow');
          if(r)r.classList.remove('dragging');
        },true);
      }
    });
    showTodoAfterPatch();
  }

  function patchTasks(){
    const apply=()=>{forceNewTasksToSelectDay();applyDragHandleOnly()};
    const oldRender=window.renderTasks || (typeof renderTasks==='function' ? renderTasks : null);
    if(typeof oldRender==='function'&&!window.__newTaskSelectDayPatched){
      window.__newTaskSelectDayPatched=true;
      renderTasks=function(){
        if(typeof tasks!=='undefined' && Array.isArray(tasks)){
          tasks.forEach(t=>{if(isDefaultTaskText(t.text))t.day=''});
        }
        const out=oldRender.apply(this,arguments);
        setTimeout(apply,0);
        return out;
      };
      window.renderTasks=renderTasks;
    }

    const oldSave=window.saveTasks || (typeof saveTasks==='function' ? saveTasks : null);
    if(typeof oldSave==='function'&&!window.__newTaskSavePatched){
      window.__newTaskSavePatched=true;
      saveTasks=function(){
        if(typeof tasks!=='undefined' && Array.isArray(tasks)){
          tasks.forEach(t=>{if(isDefaultTaskText(t.text))t.day=''});
        }
        return oldSave.apply(this,arguments);
      };
      window.saveTasks=saveTasks;
    }

    setTimeout(()=>{try{renderTasks()}catch(e){apply()}},50);
    setInterval(apply,700);
  }

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    setTimeout(patchTasks,900);
  }).catch(()=>setTimeout(patchTasks,900));
})();
