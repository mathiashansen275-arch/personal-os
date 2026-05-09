// Personal OS UI controls: hide manual cloud buttons, restore week nav, add recovered task allocator.
(function(){
  const STATE_KEY='personalOS.schedule.v5';
  const TASKS_KEY='personalOS.tasks.v1';

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
  function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()+d.getSeconds()/60}

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
      #todoView .panelHead #posAllocateTasks{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:36px!important;height:34px!important;margin-left:8px!important;vertical-align:middle!important;border-radius:9px!important;border:1px solid #26314f!important;background:linear-gradient(180deg,#111a38,#070912)!important;color:#fff!important;font-weight:1000!important;font-size:18px!important;line-height:1!important;padding:0!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;top:0!important}
      #todoView .panelTitle{display:inline-flex!important;align-items:center!important;vertical-align:middle!important}
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

  function syncTaskModelFromDom(tasks){
    try{
      document.querySelectorAll('#todoView .todoRow').forEach(row=>{
        const id=row.dataset&&row.dataset.id;
        const t=tasks.find(x=>x&&x.id===id);
        if(!t)return;
        const textEl=row.querySelector('.taskPill,.taskTextInput,input[type=text],textarea');
        const cb=row.querySelector('.taskCheck,input[type=checkbox]');
        const day=row.querySelector('.cellSelect,select');
        if(textEl)t.text=textEl.value||textEl.textContent||t.text||'';
        if(cb)t.done=!!cb.checked;
        if(day)t.day=day.value||t.day||'';
      });
    }catch(e){}
  }

  function parseRange(text){
    const m=String(text||'').match(/\b(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})\b/);
    if(!m)return null;
    const s=Number(m[1])*60+Number(m[2]),e=Number(m[3])*60+Number(m[4]);
    return e>s?{start:s,end:e}:null;
  }
  function parseDayIndex(text){
    const s=String(text||'').toLowerCase();
    const map={monday:0,mon:0,tuesday:1,tue:1,tues:1,wednesday:2,wed:2,thursday:3,thu:3,thur:3,thurs:3,friday:4,fri:4,saturday:5,sat:5,sunday:6,sun:6};
    if(/\btoday\b/.test(s))return(new Date().getDay()+6)%7;
    if(/\btomorrow\b/.test(s))return((new Date().getDay()+6)%7+1)%7;
    for(const k in map){if(new RegExp('\\b'+k+'\\b').test(s))return map[k]}
    return null;
  }
  function taskMins(text){
    const s=String(text||'').toLowerCase(),range=parseRange(s);
    if(range)return range.end-range.start;
    const p=s.match(/\(([^)]*)\)/),r=p?p[1]:s;
    let m=0;
    const h=r.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const mi=r.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    if(h)m+=Math.round(parseFloat(h[1])*60);
    if(mi)m+=parseInt(mi[1],10);
    if(!m&&p&&/^\d+$/.test(r.trim()))m=parseInt(r,10);
    return m||null;
  }
  function cleanTitle(t){return String(t||'').replace(/\([^)]*\)/g,'').replace(/\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow)\b/ig,'').replace(/\b\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}\b/g,'').replace(/\s+/g,' ').trim()}
  function shortTitle(t){
    let s=cleanTitle(t);
    if(!s)return'Task';
    if(/grandma|grass/i.test(s))s='Grandma grass';
    if(s.length<=25)return s;
    const words=s.split(/\s+/);let out='';
    for(let i=0;i<words.length;i++){const test=(out?out+' ':'')+words[i];if(test.length>25)break;out=test}
    return out||s.slice(0,25).trim();
  }
  function typeFromText(t){return /(agency|client|sop|strategy|business|vinted|product|research|sales|marketing|money|work|shift|tok|commentary|meta)/i.test(String(t||''))?'business':'personal'}

  function getScheduleState(){
    const s=readJson(STATE_KEY,{custom:[]});
    if(!Array.isArray(s.custom))s.custom=[];
    return s;
  }
  function setScheduleState(s){
    writeJson(STATE_KEY,s);
    try{state=s}catch(e){}
    try{window.state=s}catch(e){}
  }
  function visibleWeekData(){
    const monday=currentWeekMonday();
    const out=[];
    for(let i=0;i<7;i++)out.push({date:ymd(addDaysLocal(monday,i)),dayIndex:i});
    return out;
  }
  function currentVisibleWeekIsThisWeek(){return ymd(currentWeekMonday())===ymd(mondayOf(new Date()))}
  function domIntervalsForDay(dayIndex){
    const out=[];
    const day=[...document.querySelectorAll('#scheduleView .day')][dayIndex];
    if(day){
      day.querySelectorAll('.event').forEach(el=>{
        const time=(el.querySelector('.time')||{}).textContent||'';
        const m=String(time).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if(m)out.push({start:mins(m[1]),end:mins(m[2])});
      });
    }
    return out;
  }
  function isProtectedBlock(b){
    const title=String(b.title||'').toLowerCase(),typ=String(b.type||'').toLowerCase();
    return typ==='school'||typ==='work'||typ==='trip'||typ==='wind'||/evening routine|wind down|morning routine/.test(title);
  }
  function hardIntervals(day,stateObj){
    const list=domIntervalsForDay(day.dayIndex);
    (stateObj.custom||[]).forEach(c=>{
      if(c.date===day.date&&(isProtectedBlock(c)||!c.aiCreated))list.push({start:mins(c.start),end:mins(c.end)});
    });
    return list.sort((a,b)=>a.start-b.start);
  }
  function subtract(base,blocks){
    let free=[base];
    blocks.forEach(b=>{
      const next=[];
      free.forEach(f=>{
        if(b.end<=f.start||b.start>=f.end)next.push(f);
        else{
          if(b.start>f.start)next.push({start:f.start,end:b.start});
          if(b.end<f.end)next.push({start:b.end,end:f.end});
        }
      });
      free=next;
    });
    return free.filter(f=>f.end-f.start>=30);
  }
  function freeIntervalsForDay(day,stateObj){
    const todayIdx=(new Date().getDay()+6)%7;
    let start=405,end=1350;
    if(currentVisibleWeekIsThisWeek()){
      if(day.dayIndex<todayIdx)return[];
      if(day.dayIndex===todayIdx)start=Math.max(start,Math.ceil((nowMin()+5)/5)*5);
    }
    return subtract({start:start,end:end},hardIntervals(day,stateObj));
  }
  function findSlot(minutes,startDay,stateObj){
    const days=visibleWeekData();
    for(let di=startDay;di<days.length;di++){
      const free=freeIntervalsForDay(days[di],stateObj);
      for(let i=0;i<free.length;i++){
        if(free[i].end-free[i].start>=minutes)return{date:days[di].date,dayIndex:di,start:free[i].start,end:free[i].start+minutes};
      }
    }
    return null;
  }
  function groupTitle(ts){
    if(ts.length===1)return ts[0].title;
    const s=ts.map(t=>t.title).join(' & ');
    return s.length<=25?s:'Grouped tasks';
  }
  function makeGroups(items){
    const groups=[];let i=0;
    while(i<items.length){
      const g=[items[i]];let sum=items[i].minutes||30;i++;
      while(sum<30&&i<items.length){g.push(items[i]);sum+=items[i].minutes||30;i++}
      groups.push({tasks:g,minutes:Math.max(30,sum),title:groupTitle(g),type:g.some(t=>t.type==='business')?'business':'personal'});
    }
    return groups;
  }
  function taskItems(){
    const tasks=readJson(TASKS_KEY,[]);
    syncTaskModelFromDom(tasks);
    writeJson(TASKS_KEY,tasks);
    return tasks.map((t,i)=>{
      const txt=String(t.text||'');
      return{id:t.id||('task-'+i),idx:i,done:!!t.done,assigned:!!t.assigned,text:txt,minutes:taskMins(txt),dayIndex:parseDayIndex(txt),range:parseRange(txt),title:shortTitle(txt),type:typeFromText(txt)};
    }).filter(t=>{
      const x=t.text.trim().toLowerCase();
      return x&&x!=='new task'&&!t.done&&!t.assigned;
    });
  }
  function explicitActions(items){
    const actions=[],days=visibleWeekData();
    items.forEach(t=>{
      if(t.dayIndex===null||!t.range)return;
      const day=days[t.dayIndex];
      if(!day)return;
      actions.push({taskIds:[t.id],taskTexts:[t.text],date:day.date,start:hm(t.range.start),end:hm(t.range.end),title:t.title,blockType:t.type,force:false});
    });
    return actions;
  }
  function overlaps(a,stateObj){
    return (stateObj.custom||[]).some(c=>c.date===a.date&&mins(a.start)<mins(c.end)&&mins(c.start)<mins(a.end));
  }
  function allocateTasksIntoWeek(){
    const stateObj=getScheduleState();
    const tasks=readJson(TASKS_KEY,[]);
    const released={};
    (stateObj.custom||[]).forEach(c=>{if(c.aiCreated)(c.taskIds||[]).forEach(id=>released[id]=true)});
    tasks.forEach(t=>{if(released[t.id])t.assigned=false});
    stateObj.custom=stateObj.custom.filter(c=>!c.aiCreated);
    writeJson(TASKS_KEY,tasks);

    const items=taskItems();
    if(!items.length){setScheduleState(stateObj);try{if(typeof render==='function')render()}catch(e){};toastMsg('No unscheduled tasks found');return 0}

    const actions=explicitActions(items),explicitIds={};
    actions.forEach(a=>(a.taskIds||[]).forEach(id=>explicitIds[id]=true));
    const remaining=items.filter(t=>!explicitIds[t.id]&&t.minutes);
    const buckets={};
    const todayIdx=(new Date().getDay()+6)%7;
    remaining.forEach(t=>{
      let di=t.dayIndex===null?todayIdx:t.dayIndex;
      if(currentVisibleWeekIsThisWeek()&&di<todayIdx)di=todayIdx;
      (buckets[di]=buckets[di]||[]).push(t);
    });
    Object.keys(buckets).map(Number).sort((a,b)=>a-b).forEach(di=>{
      makeGroups(buckets[di]).forEach(g=>{
        const slot=findSlot(g.minutes,di,stateObj);
        if(!slot)return;
        actions.push({taskIds:g.tasks.map(t=>t.id),taskTexts:g.tasks.map(t=>t.text),date:slot.date,start:hm(slot.start),end:hm(slot.end),title:g.title,blockType:g.type});
        stateObj.custom.push({id:'temp-'+Date.now()+'-'+Math.random(),date:slot.date,start:hm(slot.start),end:hm(slot.end),title:'__RESERVED__',type:g.type,source:'temp'});
      });
    });
    stateObj.custom=stateObj.custom.filter(c=>c.title!=='__RESERVED__');

    let n=0;
    actions.forEach(a=>{
      if(!a.date||!a.start||!a.end||mins(a.end)<=mins(a.start))return;
      if(!a.force&&overlaps(a,stateObj))return;
      const block={
        id:(typeof uid==='function'?uid():'ai-'+Date.now()+'-'+n),
        date:a.date,
        start:a.start,
        end:a.end,
        title:String(a.title||'Grouped tasks').slice(0,25),
        type:a.blockType||'personal',
        source:'custom',
        aiCreated:true,
        aiDetails:true,
        aiGrouped:(a.taskIds||[]).length>1,
        taskIds:a.taskIds||[],
        taskTexts:a.taskTexts||[]
      };
      stateObj.custom.push(block);
      (a.taskIds||[]).forEach(id=>{const t=tasks.find(x=>x.id===id);if(t)t.assigned=true});
      n++;
    });

    setScheduleState(stateObj);
    writeJson(TASKS_KEY,tasks);
    try{if(typeof render==='function')render()}catch(e){}
    try{if(typeof renderTasks==='function')renderTasks()}catch(e){}
    toastMsg(n?'Created '+n+' block'+(n===1?'':'s')+' from your to-do list':'No free time found for those tasks');
    return n;
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
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();allocateTasksIntoWeek()};
      title.insertAdjacentElement('afterend',btn);
    }
    btn.textContent='↻';
  }

  function removeCloudButtons(){document.querySelectorAll('#posCloudControls,#posCloudUpload,#posCloudDownload').forEach(el=>el.remove())}
  window.personalOSUpdateSchedule=allocateTasksIntoWeek;

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
