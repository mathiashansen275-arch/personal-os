// Loads the latest stable to-do/schedule layer, then disables dragging from inside task text pills.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/4512f9bdfa9353599566ce6f51851ec42e1f8392/lectio-data.js';

  function applyDragHandleOnly(){
    document.querySelectorAll('#todo-drag-handle-only').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='todo-drag-handle-only';
    s.textContent=`
      .taskPill{cursor:text!important;user-select:text!important;-webkit-user-drag:none!important}
      .dragCell{cursor:grab!important;user-select:none!important}
      .dragCell:active{cursor:grabbing!important}
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

  function patchRenderTasks(){
    const old=window.renderTasks || (typeof renderTasks==='function' ? renderTasks : null);
    if(typeof old==='function'&&!window.__dragHandleOnlyPatched){
      window.__dragHandleOnlyPatched=true;
      renderTasks=function(){const out=old.apply(this,arguments);setTimeout(applyDragHandleOnly,0);return out};
      window.renderTasks=renderTasks;
      setTimeout(()=>{try{renderTasks()}catch(e){applyDragHandleOnly()}},50);
    }
    applyDragHandleOnly();
    setInterval(applyDragHandleOnly,1000);
  }

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    setTimeout(patchRenderTasks,800);
  }).catch(()=>setTimeout(patchRenderTasks,800));
})();
