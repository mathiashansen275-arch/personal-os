// Personal OS: block manual schedule editing; AI/tools remain able to change state.
// Also keeps the to-do day assignment automatic without breaking table layout.
(function(){
  const TASKS_KEY='personalOS.tasks.v1';
  const HISTORY_KEY='personalOS.dailyProgress.v1';
  const ROLLOVER_KEY='personalOS.dailyProgress.lastDate';
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  function ensureStyle(){
    if(document.getElementById('pos-disable-block-edit-style'))return;
    const s=document.createElement('style');
    s.id='pos-disable-block-edit-style';
    s.textContent='#scheduleView .event{cursor:default!important}#scheduleView .event:hover{transform:none!important;filter:none!important;box-shadow:inherit!important}#scheduleView .event .posAgentDetails{cursor:pointer!important}#todoView select.posHiddenDaySelect{display:none!important;visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(s);
  }
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function pad(n){return String(n).padStart(2,'0')}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function dayName(d){return DAYS[(d.getDay()+6)%7]}
  function dayShort(d){return dayName(d).slice(0,3)}
  function getTasks(){const a=read(TASKS_KEY,[]);return Array.isArray(a)?a:[]}
  function saveTasks(a){write(TASKS_KEY,a);try{window.tasks=a}catch(e){}try{tasks=a}catch(e){}}
  function taskBelongsToDate(task,date,todayMeansDate){
    const day=clean(task&&task.day).toLowerCase();
    if(!day)return false;
    const name=dayName(date).toLowerCase();
    const short=dayShort(date).toLowerCase();
    if(/\btoday\b/.test(day)&&ymd(date)===ymd(todayMeansDate||new Date()))return true;
    return day.includes(name)||new RegExp('\\b'+short+'\\b').test(day);
  }
  function snapshotDate(date,todayMeansDate){
    const tasks=getTasks().filter(t=>t&&clean(t.text||t.title)&&taskBelongsToDate(t,date,todayMeansDate||date));
    const total=tasks.length;
    const done=tasks.filter(t=>!!t.done).length;
    const percent=total?Math.round(done*100/total):0;
    const history=read(HISTORY_KEY,{});
    history[ymd(date)]={date:ymd(date),day:dayName(date),total,done,percent,taskIds:tasks.map(t=>t.id).filter(Boolean),taskTexts:tasks.map(t=>t.text||t.title||'').filter(Boolean),savedAt:new Date().toISOString()};
    write(HISTORY_KEY,history);
    return history[ymd(date)];
  }
  function removeCompletedForDate(date,todayMeansDate){
    const before=getTasks();
    const after=before.filter(t=>!(t&&t.done&&taskBelongsToDate(t,date,todayMeansDate||date)));
    if(after.length!==before.length)saveTasks(after);
    return after.length!==before.length;
  }
  function runRollover(){
    const today=ymd(new Date());
    let last=localStorage.getItem(ROLLOVER_KEY);
    if(!last){localStorage.setItem(ROLLOVER_KEY,today);snapshotDate(new Date(),new Date());return false}
    if(last>=today){snapshotDate(new Date(),new Date());return false}
    let changed=false;
    let cursor=new Date(last+'T00:00:00');
    while(ymd(cursor)<today){
      snapshotDate(cursor,cursor);
      changed=removeCompletedForDate(cursor,cursor)||changed;
      cursor=addDays(cursor,1);
    }
    localStorage.setItem(ROLLOVER_KEY,today);
    snapshotDate(new Date(),new Date());
    if(changed){try{if(typeof renderTasks==='function')renderTasks()}catch(e){}try{if(typeof renderProductivity==='function')renderProductivity()}catch(e){}}
    return changed;
  }
  function isDaySelect(select){
    const values=Array.from(select.options||[]).map(o=>clean(o.textContent||o.value).toLowerCase());
    return values.includes('today')&&values.includes('monday')&&values.includes('tuesday')&&values.includes('later');
  }
  function hideDaySelectorsSafely(){
    document.querySelectorAll('#todoView #taskBody select,#taskBody select').forEach(select=>{
      if(!isDaySelect(select))return;
      select.classList.add('posHiddenDaySelect');
      select.tabIndex=-1;
      select.setAttribute('aria-hidden','true');
    });
  }
  function protect(e){
    const target=e.target&&e.target.closest&&e.target.closest('#scheduleView .event');
    if(!target)return;
    if(e.target.closest('.posAgentDetails'))return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  }
  function tick(){
    window.personalOSDayProgressVersion='auto-day-rollover-v2';
    ensureStyle();
    hideDaySelectorsSafely();
    runRollover();
  }
  ensureStyle();
  ['click','dblclick','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend'].forEach(type=>document.addEventListener(type,protect,true));
  document.addEventListener('change',function(e){
    if(e.target&&e.target.matches&&e.target.matches('#todoView .taskCheck,#taskBody .taskCheck,input[type=checkbox]'))setTimeout(function(){snapshotDate(new Date(),new Date())},0);
  },true);
  tick();
  setInterval(tick,1000);
})();
