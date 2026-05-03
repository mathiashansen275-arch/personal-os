// Loads the latest stable to-do/schedule layer, then applies final to-do behavior fixes.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/4512f9bdfa9353599566ce6f51851ec42e1f8392/lectio-data.js';

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
      }
    });
  }

  function applyDragHandleOnly(){
    document.querySelectorAll('#todo-drag-handle-only').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='todo-drag-handle-only';
    s.textContent=`
      .taskPill{cursor:text!important;user-select:text!important;-webkit-user-drag:none!important;font-size:15.5px!important;font-weight:650!important;letter-spacing:.01em!important}
      .dragCell{cursor:grab!important;user-select:none!important}
      .dragCell:active{cursor:grabbing!important}
      .selectPlaceholder{color:#8f86aa!important}
    `;
    document.head.appendChild(s);

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
