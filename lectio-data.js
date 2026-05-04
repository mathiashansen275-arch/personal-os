// Loads the latest stable to-do/schedule layer, prevents old to-do flashes, and applies final UI polish.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/5d487999a2ddc2729ba69cc573e0679244ff3ec9/lectio-data.js';

  function hideOldTodoImmediately(){
    if(document.getElementById('todo-no-flash'))return;
    const s=document.createElement('style');
    s.id='todo-no-flash';
    s.textContent=`
      #todoView .panel:not(:has(.todoLayout)){opacity:0!important;visibility:hidden!important;min-height:760px!important}
      #todoView .panel:has(.todoLayout){opacity:1!important;visibility:visible!important;transition:none!important}
    `;
    document.head.appendChild(s);
  }
  hideOldTodoImmediately();

  function applyUiPolish(){
    if(document.getElementById('final-ui-polish'))return;
    const s=document.createElement('style');
    s.id='final-ui-polish';
    s.textContent=`
      #cancelModal{display:none!important}
      #closeModal{width:48px!important;height:48px!important;font-size:24px!important;line-height:1!important;border-radius:13px!important}
      #todoView .panel{padding-top:12px!important}
      #todoView .todoLayout{align-items:start!important}
      #todoView .todoSide{padding-top:14px!important}
      #todoView .todoMain{padding-top:14px!important}
      #todoView .todoMain .panelHead{margin-top:0!important;margin-bottom:8px!important;align-items:center!important}
      #todoView .todoMain .panelTitle{line-height:1!important;margin:0!important}
      #todoView .todoMain .table{table-layout:fixed!important;width:100%!important}
      #todoView .todoMain .table th{padding-top:8px!important;padding-bottom:8px!important}
      #todoView .todoMain .table td{padding-top:8px!important;padding-bottom:8px!important;vertical-align:middle!important}
      #todoView .todoMain .table th:nth-child(1),#todoView .todoMain .table td:nth-child(1){width:60px!important;min-width:60px!important;max-width:60px!important}
      #todoView .todoMain .table th:nth-child(3),#todoView .todoMain .table td:nth-child(3){width:170px!important;min-width:170px!important;max-width:170px!important}
      #todoView .todoMain .table th:nth-child(4),#todoView .todoMain .table td:nth-child(4){width:112px!important;min-width:112px!important;max-width:112px!important}
      #todoView .todoMain .taskText{width:100%!important;max-width:none!important;display:flex!important;align-items:center!important;gap:10px!important;overflow:visible!important}
      #todoView .taskTextInput,#todoView .taskPill,#todoView input.taskPill,#todoView textarea.taskPill{font-size:16px!important;font-weight:580!important;letter-spacing:.005em!important;width:min(782px,calc(100% - 44px))!important;max-width:min(782px,calc(100% - 44px))!important;min-width:280px!important;min-height:36px!important;height:36px!important;line-height:20px!important;padding-top:7px!important;padding-bottom:7px!important;border-radius:20px!important;box-sizing:border-box!important;transition:none!important;resize:none!important;overflow:hidden!important;white-space:normal!important;font-family:inherit!important;vertical-align:middle!important}
      #todoView textarea.taskPill{display:block!important}
      #todoView .doneRow .taskPill,#todoView .doneRow .taskTextInput,#todoView .doneRow textarea.taskPill{font-weight:580!important}
      #todoView .cellSelect{height:36px!important;font-weight:800!important;width:150px!important;min-width:150px!important;max-width:150px!important;padding-left:14px!important;padding-right:28px!important;transition:none!important}
      #todoView .taskCheck{width:20px!important;height:20px!important}
      #todoView .dragCell{flex:0 0 24px!important}
    `;
    document.head.appendChild(s);
  }

  function patchModalClose(){
    const shade=document.getElementById('modalShade');
    const close=document.getElementById('closeModal');
    if(close&&shade&&!close.__patchedClose){
      close.__patchedClose=true;
      close.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        shade.classList.remove('open');
      },true);
    }
  }

  function applyBlueBrightnessFix(){
    if(document.getElementById('blue-brightness-fix'))return;
    const s=document.createElement('style');
    s.id='blue-brightness-fix';
    s.textContent=`
      #scheduleView .event.school{
        background:rgba(12,38,76,.86)!important;
        border-color:#168cff!important;
        color:#39a3ff!important;
      }
      #scheduleView .event.school .time,
      #scheduleView .event.school .title{color:#39a3ff!important}
      #scheduleView .event.school.time-neutral{
        filter:saturate(1.12) brightness(1.14)!important;
        opacity:1!important;
      }
      #scheduleView .event.school.time-future{
        filter:saturate(1.02) brightness(.90)!important;
        opacity:.96!important;
      }
      #scheduleView .event.school.time-future::before{opacity:.20!important}
      #scheduleView .event.school.time-past{
        filter:saturate(1.24) brightness(1.22)!important;
        opacity:1!important;
      }
      #scheduleView .event.school.time-current{
        filter:saturate(1.42) brightness(1.42)!important;
        box-shadow:0 0 0 1px rgba(57,163,255,.34),0 0 24px rgba(22,140,255,.30),0 10px 26px rgba(0,0,0,.48)!important;
      }
      #scheduleView .event.school.time-current::after,
      #scheduleView .event.school.time-past::after,
      #scheduleView .event.school .liveProgressFill{
        background:linear-gradient(180deg,rgba(57,163,255,.40),rgba(57,163,255,.16))!important;
        mix-blend-mode:screen!important;
      }
      #scheduleView .event.school.time-current::after,
      #scheduleView .event.school.time-current .liveProgressFill{
        height:100%!important;
        opacity:.90!important;
      }
      #scheduleView .event.homework,
      #scheduleView .event.trip{
        filter:brightness(1.12) saturate(1.06)!important;
      }
      #scheduleView .event.homework.time-future,
      #scheduleView .event.trip.time-future{
        filter:saturate(1.02) brightness(.90)!important;
        opacity:.96!important;
      }
    `;
    document.head.appendChild(s);
  }

  function applyAll(){
    hideOldTodoImmediately();
    applyUiPolish();
    patchModalClose();
    applyBlueBrightnessFix();
  }

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    applyAll();
    setTimeout(applyAll,0);
    setTimeout(applyAll,50);
    setTimeout(applyAll,300);
    setTimeout(applyAll,950);
    setInterval(applyAll,1500);
  }).catch(()=>{
    applyAll();
    setInterval(applyAll,1500);
  });
})();
