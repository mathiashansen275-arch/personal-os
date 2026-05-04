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
      #closeModal{width:54px!important;height:54px!important;font-size:28px!important;line-height:1!important;border-radius:14px!important}
      #todoView .panel{padding-top:12px!important}
      #todoView .todoLayout{align-items:start!important}
      #todoView .todoSide{padding-top:14px!important}
      #todoView .todoMain{padding-top:14px!important}
      #todoView .todoMain .panelHead{margin-top:0!important;margin-bottom:8px!important;align-items:center!important}
      #todoView .todoMain .panelTitle{line-height:1!important;margin:0!important}
      #todoView .todoMain .table th{padding-top:8px!important;padding-bottom:8px!important}
      #todoView .todoMain .table td{padding-top:8px!important;padding-bottom:8px!important}
      #todoView .taskPill{min-height:36px!important;height:36px!important;padding-top:7px!important;padding-bottom:7px!important}
      #todoView textarea.taskPill{min-height:36px!important}
      #todoView .cellSelect{height:36px!important}
      #todoView .taskCheck{width:20px!important;height:20px!important}
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
    setTimeout(applyAll,50);
    setTimeout(applyAll,300);
    setTimeout(applyAll,950);
    setInterval(applyAll,1500);
  }).catch(()=>{
    applyAll();
    setInterval(applyAll,1500);
  });
})();
