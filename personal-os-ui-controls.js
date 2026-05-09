// Personal OS UI controls only: hide cloud buttons, restore week nav, place schedule icon.
(function(){
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function monday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function currentMondaySafe(){try{if(currentMonday instanceof Date)return new Date(currentMonday)}catch(e){}try{if(window.currentMonday instanceof Date)return new Date(window.currentMonday)}catch(e){}return monday(new Date())}
  function setMonday(d){try{currentMonday=d}catch(e){}try{window.currentMonday=d}catch(e){}try{if(typeof render==='function')render()}catch(e){}}
  function toastMsg(msg){try{if(typeof toast==='function'){toast(msg);return}}catch(e){}console.log(msg)}
  function style(){
    if(document.getElementById('pos-ui-controls-style'))return;
    const s=document.createElement('style');
    s.id='pos-ui-controls-style';
    s.textContent='#posCloudControls,#posCloudUpload,#posCloudDownload{display:none!important;visibility:hidden!important;pointer-events:none!important}body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today,body:not(.aiScheduleActive) #posWeekNav{display:none!important}body.aiScheduleActive #prev,body.aiScheduleActive #next,body.aiScheduleActive #today{display:inline-flex!important;visibility:visible!important;pointer-events:auto!important}body.aiScheduleActive #posWeekNav{display:flex!important}#posWeekNav{gap:8px;align-items:center;margin-left:auto}#posWeekNav button{height:40px;border-radius:10px;border:1px solid #202946;background:#050711;color:#fff;font-weight:1000;font-size:12px;padding:0 13px;letter-spacing:.06em;cursor:pointer;pointer-events:auto}#todoView .panelHead #posAllocateTasks{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:34px!important;height:32px!important;margin-left:8px!important;vertical-align:middle!important;border-radius:9px!important;border:1px solid #26314f!important;background:linear-gradient(180deg,#111a38,#070912)!important;color:#fff!important;font-weight:1000!important;font-size:17px!important;line-height:1!important;padding:0!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;top:-1px!important}#todoView .panelTitle{display:inline-flex!important;align-items:center!important;vertical-align:middle!important}';
    document.head.appendChild(s);
  }
  function scheduleActive(){const a=document.querySelector('.tab.active');const v=document.getElementById('scheduleView');document.body.classList.toggle('aiScheduleActive',!!((a&&/schedule/i.test(a.textContent||''))||(v&&v.offsetParent!==null)))}
  function weekNav(){
    if(document.getElementById('prev')&&document.getElementById('next')&&document.getElementById('today'))return;
    if(document.getElementById('posWeekNav'))return;
    const top=document.querySelector('.topbar')||document.querySelector('.nav')||document.body;
    const w=document.createElement('div');
    w.id='posWeekNav';
    w.innerHTML='<button id="posPrevWeek" type="button">← WEEK</button><button id="posTodayWeek" type="button">TODAY</button><button id="posNextWeek" type="button">WEEK →</button>';
    top.appendChild(w);
    document.getElementById('posPrevWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(addDays(currentMondaySafe(),-7))};
    document.getElementById('posTodayWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(monday(new Date()))};
    document.getElementById('posNextWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(addDays(currentMondaySafe(),7))};
  }
  function icon(){
    const title=[...document.querySelectorAll('#todoView .panelTitle')].find(el=>/to do list/i.test(el.textContent||''));
    if(!title)return;
    let b=document.getElementById('posAllocateTasks');
    if(!b){
      b=document.createElement('button');
      b.id='posAllocateTasks';
      b.type='button';
      b.title='Schedule tasks';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();if(typeof window.personalOSUpdateSchedule==='function'){const n=window.personalOSUpdateSchedule();toastMsg(n?'Updated schedule: '+n+' block'+(n===1?'':'s'):'No free time found for those tasks')}else toastMsg('Schedule allocator is not ready yet')};
      title.insertAdjacentElement('afterend',b);
    }
    b.textContent='↻';
  }
  function tick(){style();document.querySelectorAll('#posCloudControls,#posCloudUpload,#posCloudDownload').forEach(x=>x.remove());scheduleActive();weekNav();icon()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,700);
})();
