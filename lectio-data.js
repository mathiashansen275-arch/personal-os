// Loads the latest stable to-do/schedule layer, immediately hides old to-do UI, then brightens blue schedule blocks without blinking.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/5d487999a2ddc2729ba69cc573e0679244ff3ec9/lectio-data.js';

  function hideOldTodoImmediately(){
    if(document.getElementById('todo-no-flash'))return;
    const s=document.createElement('style');
    s.id='todo-no-flash';
    s.textContent='#todoView .panel{opacity:0!important;visibility:hidden!important}';
    document.head.appendChild(s);
  }
  hideOldTodoImmediately();

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

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    setTimeout(applyBlueBrightnessFix,950);
    setInterval(applyBlueBrightnessFix,5000);
  }).catch(()=>{
    setTimeout(applyBlueBrightnessFix,950);
    setInterval(applyBlueBrightnessFix,5000);
  });
})();
