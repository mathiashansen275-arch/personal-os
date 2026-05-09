// Personal OS UI controls: hide manual cloud buttons, restore week nav, add task allocator.
(function(){
  const STATE_KEY='personalOS.schedule.v5';
  const TASKS_KEY='personalOS.tasks.v1';
  const AUTO_SOURCE='posAutoAlloc';

  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function mins(s){s=String(s||'00:00');return Number(s.slice(0,2))*60+Number(s.slice(3,5))}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDaysLocal(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function mondayOf(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function readJson(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'')||fallback}catch(e){return fallback}}
  function writeJson(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function toastMsg(msg){try{if(typeof toast==='function'){toast(msg);return}}catch(e){};console.log(msg)}
  function currentWeekMonday(){
    try{if(currentMonday instanceof Date)return new Date(currentMonday)}catch(e){}
    try{if(window.currentMonday instanceof Date)return new Date(window.currentMonday)}catch(e){}
    return mondayOf(new Date());
  }
  function setWeekMonday(d){
    try{currentMonday=d}catch(e){}
    try{window.currentMonday=d}catch(e){}
    try{if(typeof render==='function')render()}catch(e){}
  }
  function switchWeek(delta){setWeekMonday(addDaysLocal(currentWeekMonday(),delta*7))}
  function goToday(){setWeekMonday(mondayOf(new Date()))}

  function ensureStyle(){
    if(document.getElementById('pos-ui-controls-style'))return;
    const s=document.createElement('style');
    s.id='pos-ui-controls-style';
    s.textContent=`
      #posCloudControls,#posCloudUpload,#posCloudDownload{display:none!important;visibility:hidden!important;pointer-events:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today,body:not(.aiScheduleActive) #posWeekNav{display:none!important}
      body.aiScheduleActive #prev,body.aiScheduleActive #next,body.aiScheduleActive #today{display:inline-flex!important;visibility:visible!important;pointer-events:auto!important}
      body.aiScheduleActive #posWeekNav{display:flex!important}
      #posWeekNav{gap:8px;align-items:center;margin-left:auto}
      #posWeekNav button{height:40px;border-radius:10px;border:1px solid #202946;background:#050711;color:#fff;font-weight:1000;font-size:12px;padding:0 13px;letter-spacing:.06em;cursor:pointer;pointer-events:auto}
      #posAllocateTasks{width:52px;height:42px;margin-left:12px;border-radius:11px;border:1px solid #26314f;background:linear-gradient(180deg,#111a38,#070912);color:#fff;font-weight:1000;font-size:23px;line-height:1;padding:0;cursor:pointer;pointer-events:auto}
    `;
    document.head.appendChild(s);
  }

  function updateScheduleClass(){
    const active=document.querySelector('.tab.active');
    const isSchedule=(active&&/schedule/i.test(active.textContent||'')) || (document.getElementById('scheduleView')&&document.getElementById('scheduleView').offsetParent!==null);
    document.body.classList.toggle('aiScheduleActive',!!isSchedule);
  }

  function installFallbackWeekNav(){
    if(document.getElementById('prev')&&document.getElementById('next')&&document.getElementById('today'))return;
    if(document.getElementById('posWeekNav'))return;
    const top=document.querySelector('.topbar')||document.querySelector('.nav')||document.body;
    const wrap=document.createElement('div');
    wrap.id='posWeekNav';
    wrap.innerHTML='<button id="posPrevWeek" type="button">← WEEK</button><button id="posTodayWeek" type="button">TODAY</button><button id="posNextWeek" type="button">WEEK →</button>';
    top.appendChild(wrap);
    document.getElementById('posPrevWeek').onclick=e=>{e.preventDefault();e.stopPropagation();switchWeek(-1)};
    document.getElementById('posTodayWeek').onclick=e=>{e.preventDefault();e.stopPropagation();goToday()};
    document.getElementById('posNextWeek').onclick=e=>{e.preventDefault();e.stopPropagation();switchWeek(1)};
  }

  function visibleIntervalsForDay(dayIndex){
    const out=[];
    const days=[...document.querySelectorAll('#scheduleView .day')];
    const day=days[dayIndex];
    if(day){
      day.querySelectorAll('.event').forEach(el=>{
        const time=(el.querySelector('.time')||{}).textContent||'';
        const m=String(time).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if(m)out.push([mins(m[1]),mins(m[2])]);
      });
    }
    return out;
  }

  function taskDuration(text){
    const s=String(text||'').toLowerCase();
    let m=s.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)\b/);
    if(m)return Math.max(20,Math.min(180,Math.round(Number(m[1])*60)));
    m=s.match(/(\d+)\s*(?:minutes|minute|mins|min)\b/);
    if(m)return Math.max(15,Math.min(180,Number(m[1])));
    return 45;
  }

  function firstFit(intervals,duration){
    const workStart=7*60, workEnd=22*60+30, gap=10;
    const sorted=intervals.slice().sort((a,b)=>a[0]-b[0]);
    let cursor=workStart;
    for(const [s,e] of sorted){
      if(cursor+duration<=s-gap)return [cursor,cursor+duration];
      cursor=Math.max(cursor,e+gap);
    }
    if(cursor+duration<=workEnd)return [cursor,cursor+duration];
    return null;
  }

  function allocateTasksIntoWeek(){
    const tasks=readJson(TASKS_KEY,[]).filter(t=>t&&!t.done&&String(t.text||'').trim()&&String(t.text||'').trim().toLowerCase()!=='new task');
    if(!tasks.length){toastMsg('No unfinished tasks to allocate');return 0}
    const state=readJson(STATE_KEY,{custom:[]});
    state.custom=Array.isArray(state.custom)?state.custom.filter(b=>b&&b.source!==AUTO_SOURCE):[];
    const monday=currentWeekMonday();
    const intervals=[0,1,2,3,4,5,6].map(i=>visibleIntervalsForDay(i));
    let added=0;
    for(const task of tasks){
      const duration=taskDuration(task.text);
      let placed=null,dayIndex=0;
      for(let i=0;i<7;i++){
        const fit=firstFit(intervals[i],duration);
        if(fit){placed=fit;dayIndex=i;break}
      }
      if(!placed)continue;
      intervals[dayIndex].push(placed);
      state.custom.push({
        id:'auto-'+Date.now()+'-'+added,
        date:ymd(addDaysLocal(monday,dayIndex)),
        start:hm(placed[0]),
        end:hm(placed[1]),
        title:String(task.text||'Task'),
        type:'personalTime',
        source:AUTO_SOURCE,
        taskTexts:[String(task.text||'Task')],
        bg:'rgba(83,55,23,.72)',
        border:'#ffb454',
        textColor:'#ffd9a0'
      });
      added++;
    }
    writeJson(STATE_KEY,state);
    try{window.state=state}catch(e){}
    try{if(typeof render==='function')render()}catch(e){}
    toastMsg(added?'Allocated '+added+' tasks into schedule':'No free schedule space found');
    return added;
  }

  function runAllocator(){
    if(window.personalOSUpdateSchedule&&window.personalOSUpdateSchedule!==allocateTasksIntoWeek){
      return window.personalOSUpdateSchedule();
    }
    return allocateTasksIntoWeek();
  }

  function installAllocateButton(){
    const title=[...document.querySelectorAll('#todoView .panelTitle')].find(el=>/to do list/i.test(el.textContent||''));
    if(!title)return;
    let btn=document.getElementById('posAllocateTasks');
    if(!btn){
      btn=document.createElement('button');
      btn.id='posAllocateTasks';
      btn.type='button';
      btn.title='Schedule tasks';
      btn.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        runAllocator();
      };
      title.insertAdjacentElement('afterend',btn);
    }
    btn.textContent='↻';
  }

  function removeCloudButtons(){
    document.querySelectorAll('#posCloudControls,#posCloudUpload,#posCloudDownload').forEach(el=>el.remove());
  }

  window.personalOSUpdateSchedule=window.personalOSUpdateSchedule||allocateTasksIntoWeek;

  function tick(){
    ensureStyle();
    removeCloudButtons();
    updateScheduleClass();
    installFallbackWeekNav();
    installAllocateButton();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,700);
})();
