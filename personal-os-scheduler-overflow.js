// Personal OS scheduler overflow: after the normal scheduler runs, place remaining timed tasks into following weeks.
(function(){
  const STATE_KEY='personalOS.schedule.v5';
  const TASKS_KEY='personalOS.tasks.v1';
  const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const originalUpdate=window.personalOSUpdateSchedule;
  if(typeof originalUpdate!=='function'||window.__posSchedulerOverflowReady)return;
  window.__posSchedulerOverflowReady=true;

  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function mins(s){s=String(s||'00:00');return Number(s.slice(0,2))*60+Number(s.slice(3,5))}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function monday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function getState(){const s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function saveState(s){write(STATE_KEY,s);try{window.state=s}catch(e){}try{state=s}catch(e){}}
  function getTasks(){const a=read(TASKS_KEY,[]);return Array.isArray(a)?a:[]}
  function saveTasks(a){write(TASKS_KEY,a);try{window.tasks=a}catch(e){}try{tasks=a}catch(e){}}
  function currentMonday(){try{if(window.currentMonday instanceof Date)return new Date(window.currentMonday)}catch(e){}return monday(new Date())}
  function parseDays(text){
    const s=String(text||'').toLowerCase(),found=[],add=i=>{if(!found.includes(i))found.push(i)};
    const map=[['monday','mon',0],['tuesday','tue',1],['tuesday','tues',1],['wednesday','wed',2],['thursday','thu',3],['thursday','thur',3],['thursday','thurs',3],['friday','fri',4],['saturday','sat',5],['sunday','sun',6]];
    if(/\btoday\b/.test(s))add((new Date().getDay()+6)%7);
    if(/\btomorrow\b/.test(s))add(((new Date().getDay()+6)%7+1)%7);
    map.forEach(([full,short,idx])=>{if(new RegExp('\\b('+full+'|'+short+')\\b').test(s))add(idx)});
    return found;
  }
  function parseRange(text){const m=String(text||'').match(/\b(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})\b/);if(!m)return null;const s=Number(m[1])*60+Number(m[2]),e=Number(m[3])*60+Number(m[4]);return e>s?{start:s,end:e}:null}
  function taskMinutes(text){
    const s=String(text||'').toLowerCase(),range=parseRange(s);if(range)return range.end-range.start;
    const p=s.match(/\(([^)]*)\)/),r=p?p[1]:s;let total=0;
    const h=r.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const m=r.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    if(h)total+=Math.round(Number(h[1])*60);if(m)total+=Number(m[1]);if(!total&&p&&/^\d+$/.test(r.trim()))total=Number(r.trim());
    return total||null;
  }
  function cleanTitle(text){return String(text||'').replace(/\([^)]*\)/g,'').replace(/\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow)\b/ig,'').replace(/\b\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}\b/g,'').replace(/\s+/g,' ').trim()}
  function shortTitle(text){const s=cleanTitle(text)||'Task';if(s.length<=25)return s;const words=s.split(/\s+/);let out='';for(const w of words){const test=(out?out+' ':'')+w;if(test.length>25)break;out=test}return out||s.slice(0,25)}
  function typeFromText(text){return /(agency|client|sop|strategy|business|vinted|product|research|sales|marketing|money|work|shift|tok|commentary|meta)/i.test(String(text||''))?'business':'personal'}
  function eventIntervals(dayIndex){
    const out=[],day=[...document.querySelectorAll('#scheduleView .day')][dayIndex];if(!day)return out;
    day.querySelectorAll('.event').forEach(el=>{const txt=(el.querySelector('.time')||{}).textContent||'',title=(el.querySelector('.title')||{}).textContent||'';const m=txt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(m)out.push({start:mins(m[1]),end:mins(m[2]),title})});
    return out;
  }
  function isSchoolTitle(t){return /\b2i\b|HL|SL|TOK|CAS|bio|psy|daA|enB|maAI|diagram|class|relationships|school/i.test(String(t||''))}
  function isProtectedTitle(t){return /morning routine|evening routine|wind down|\bwork\b|trip/i.test(String(t||''))||isSchoolTitle(t)}
  function merge(list){const a=list.filter(x=>x.end>x.start).sort((x,y)=>x.start-y.start),out=[];for(const x of a){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({...x})}return out}
  function subtract(base,busy){let free=[base];for(const b of merge(busy)){const next=[];for(const f of free){if(b.end<=f.start||b.start>=f.end)next.push(f);else{if(b.start>f.start)next.push({start:f.start,end:b.start});if(b.end<f.end)next.push({start:b.end,end:f.end})}}free=next}return free.filter(f=>f.end-f.start>=45)}
  function freeFor(date,dayIndex,state,reserved){
    const busy=[];
    const school=eventIntervals(dayIndex).filter(b=>isSchoolTitle(b.title));
    if(school.length)busy.push({start:Math.min(...school.map(x=>x.start)),end:Math.max(...school.map(x=>x.end))});
    eventIntervals(dayIndex).filter(b=>isProtectedTitle(b.title)).forEach(b=>busy.push({start:b.start,end:b.end}));
    (state.custom||[]).forEach(c=>{if(c.date===date)busy.push({start:mins(c.start),end:mins(c.end)})});
    (reserved[date]||[]).forEach(r=>busy.push(r));
    return subtract({start:405,end:1350},busy);
  }
  function firstFit(minutes,startDate,startDayIndex,state,reserved,allowedDays){
    for(let offset=0;offset<35;offset++){
      const d=addDays(startDate,offset),date=ymd(d),di=(startDayIndex+offset)%7;
      if(allowedDays&&allowedDays.length&&!allowedDays.includes(di))continue;
      const free=freeFor(date,di,state,reserved);
      for(const f of free){if(f.end-f.start>=minutes)return{date,dayIndex:di,start:f.start,end:f.start+minutes}}
    }
    return null;
  }
  function overflow(){
    const state=getState(),tasks=getTasks(),reserved={};
    const visibleStart=currentMonday(),startDate=addDays(visibleStart,7),startDayIndex=0;
    const remaining=tasks.map((t,i)=>({task:t,id:t.id||('task-'+i),idx:i,text:String(t.text||t.title||'').trim(),minutes:taskMinutes(t.text||t.title||''),days:parseDays(t.text||t.title||''),title:shortTitle(t.text||t.title||''),type:typeFromText(t.text||t.title||'')})).filter(x=>x.text&&x.text.toLowerCase()!=='new task'&&!x.task.done&&!x.task.assigned&&x.minutes!=null).sort((a,b)=>a.idx-b.idx);
    let made=0;
    for(const item of remaining){
      const slot=firstFit(Math.max(45,item.minutes),startDate,startDayIndex,state,reserved,item.days);
      if(!slot)continue;
      reserved[slot.date]=reserved[slot.date]||[];reserved[slot.date].push({start:slot.start,end:slot.end});
      state.custom.push({id:'ai-next-'+Date.now()+'-'+made,date:slot.date,start:hm(slot.start),end:hm(slot.end),title:item.title,type:item.type,source:'custom',aiCreated:true,aiDetails:true,aiGrouped:false,taskIds:[item.id],taskTexts:[item.text]});
      item.task.assigned=true;item.task.day=DAY_LABELS[item.days.length?item.days[0]:slot.dayIndex]+' next week';
      made++;
    }
    if(made){saveState(state);saveTasks(tasks)}
    return made;
  }
  window.personalOSUpdateSchedule=function(){
    const madeOriginal=Number(originalUpdate.apply(this,arguments)||0);
    const madeOverflow=overflow();
    if(madeOverflow){try{if(typeof render==='function')render()}catch(e){}try{if(typeof renderTasks==='function')renderTasks()}catch(e){}setTimeout(()=>{try{if(typeof window.personalOSInjectDetails==='function')window.personalOSInjectDetails()}catch(e){}},0)}
    return madeOriginal+madeOverflow;
  };
})();
