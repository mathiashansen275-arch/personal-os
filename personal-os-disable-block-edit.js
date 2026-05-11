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

// Keep completed scheduled task blocks visible and stripe them.
(function(){
  const TASKS_KEY='personalOS.tasks.v1', STATE_KEY='personalOS.schedule.v5', DONE_KEY='personalOS.doneScheduledBlocks.v1';
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function mins(s){const m=String(s||'00:00').match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
  function pad(n){return String(n).padStart(2,'0')}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function weekStart(){const x=new Date(),day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function tasks(){const a=read(TASKS_KEY,[]);return Array.isArray(a)?a:[]}
  function state(){const s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function saveState(s){write(STATE_KEY,s);try{window.state=s}catch(e){}try{state=s}catch(e){}}
  function gen(b){return !!(b&&(b.aiCreated||b.aiDetails||Array.isArray(b.taskIds)||Array.isArray(b.taskTexts)))}
  function taskDone(id,text){const n=clean(text).toLowerCase();return tasks().some(t=>t&&t.done&&((id&&t.id===id)||(n&&clean(t.text||t.title).toLowerCase()===n)))}
  function blockDone(b){const ids=Array.isArray(b.taskIds)?b.taskIds.filter(Boolean):[], texts=Array.isArray(b.taskTexts)?b.taskTexts.filter(Boolean):[];if(!gen(b))return false;if(ids.length)return ids.every(id=>taskDone(id,''));if(texts.length)return texts.every(t=>taskDone('',t));return false}
  function key(b){return [b.date,b.start,b.end,b.title,(b.taskIds||[]).join(','),(b.taskTexts||[]).join('|')].join('||')}
  function ensureStyle(){if(document.getElementById('pos-done-schedule-style'))return;const s=document.createElement('style');s.id='pos-done-schedule-style';s.textContent='#scheduleView .event.posDoneScheduledBlock{position:absolute!important;filter:brightness(1.08)!important}#scheduleView .event.posDoneScheduledBlock:after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 7px,rgba(255,255,255,0) 7px 15px)!important;mix-blend-mode:screen}';document.head.appendChild(s)}
  function remember(){const s=state(), old=read(DONE_KEY,[]).filter(blockDone), map={};old.concat(s.custom.filter(blockDone)).forEach(b=>map[key(b)]={...b,aiDone:true,aiCreated:true,aiDetails:true});write(DONE_KEY,Object.values(map))}
  function restore(){const saved=read(DONE_KEY,[]).filter(blockDone);write(DONE_KEY,saved);if(!saved.length)return;const s=state(), existing=new Set(s.custom.map(key));let changed=false;saved.forEach(b=>{if(!existing.has(key(b))){s.custom.push({...b,aiDone:true,aiCreated:true,aiDetails:true});changed=true}});if(changed){saveState(s);try{if(typeof render==='function')render()}catch(e){}}}
  function mark(){document.querySelectorAll('#scheduleView .event.posDoneScheduledBlock').forEach(e=>e.classList.remove('posDoneScheduledBlock'));const done=state().custom.filter(blockDone);if(!done.length)return;document.querySelectorAll('#scheduleView .day').forEach((day,i)=>{const date=ymd(addDays(weekStart(),i));day.querySelectorAll('.event').forEach(el=>{const m=((el.querySelector('.time')||{}).textContent||'').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(!m)return;const title=clean((el.querySelector('.title')||{}).textContent||'').toLowerCase();if(done.some(b=>b.date===date&&mins(b.start)===mins(m[1])&&mins(b.end)===mins(m[2])&&title.includes(clean(b.title).toLowerCase().slice(0,18))))el.classList.add('posDoneScheduledBlock')})})}
  function tick(){window.personalOSDoneScheduleVersion='done-zebra-v1';ensureStyle();remember();restore();setTimeout(mark,0)}
  document.addEventListener('change',e=>{if(e.target&&e.target.matches&&e.target.matches('#todoView .taskCheck,#taskBody .taskCheck,input[type=checkbox]'))setTimeout(tick,0)},true);
  tick();setInterval(tick,1000);
})();
