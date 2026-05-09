// Personal OS scheduler override: strict task allocation rules.
(function(){
  const STATE_KEY='personalOS.schedule.v5';
  const TASKS_KEY='personalOS.tasks.v1';
  const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function mins(s){s=String(s||'00:00');return Number(s.slice(0,2))*60+Number(s.slice(3,5))}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function monday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()+d.getSeconds()/60}
  function nextFive(){const n=nowMin();let x=Math.ceil(n/5)*5;if(x<=n)x+=5;return x}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function toastMsg(msg){try{if(typeof toast==='function'){toast(msg);return}}catch(e){}console.log(msg)}
  function currentMonday(){try{if(window.currentMonday instanceof Date)return new Date(window.currentMonday)}catch(e){}return monday(new Date())}
  function setStateObj(s){write(STATE_KEY,s);try{window.state=s}catch(e){}try{state=s}catch(e){}}
  function getStateObj(){const s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function getTasks(){const arr=read(TASKS_KEY,[]);return Array.isArray(arr)?arr:[]}
  function saveTasks(arr){write(TASKS_KEY,arr);try{window.tasks=arr}catch(e){}try{tasks=arr}catch(e){}}
  function syncTasksFromDom(arr){try{document.querySelectorAll('#todoView .todoRow').forEach(row=>{const id=row.dataset&&row.dataset.id;const t=arr.find(x=>x&&x.id===id);if(!t)return;const text=row.querySelector('.taskPill,.taskTextInput,input[type=text],textarea');const cb=row.querySelector('.taskCheck,input[type=checkbox]');const day=row.querySelector('.cellSelect,select');if(text)t.text=text.value||text.textContent||t.text||'';if(cb)t.done=!!cb.checked;if(day)t.day=day.value||t.day||''})}catch(e){}}
  function parseRange(text){const m=String(text||'').match(/\b(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})\b/);if(!m)return null;const s=Number(m[1])*60+Number(m[2]),e=Number(m[3])*60+Number(m[4]);return e>s?{start:s,end:e}:null}
  function parseDays(text){
    const s=String(text||'').toLowerCase();
    const found=[];
    const add=i=>{if(!found.includes(i))found.push(i)};
    const map=[['monday','mon',0],['tuesday','tue',1],['tuesday','tues',1],['wednesday','wed',2],['thursday','thu',3],['thursday','thur',3],['thursday','thurs',3],['friday','fri',4],['saturday','sat',5],['sunday','sun',6]];
    if(/\btoday\b/.test(s))add((new Date().getDay()+6)%7);
    if(/\btomorrow\b/.test(s))add(((new Date().getDay()+6)%7+1)%7);
    map.forEach(([full,short,idx])=>{if(new RegExp('\\b('+full+'|'+short+')\\b').test(s))add(idx)});
    return found;
  }
  function taskMinutes(text){
    const s=String(text||'').toLowerCase();
    const range=parseRange(s);if(range)return range.end-range.start;
    const p=s.match(/\(([^)]*)\)/);const r=p?p[1]:s;
    let total=0;
    const h=r.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const m=r.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    if(h)total+=Math.round(Number(h[1])*60);
    if(m)total+=Number(m[1]);
    if(!total&&p&&/^\d+$/.test(r.trim()))total=Number(r.trim());
    return total||null;
  }
  function cleanTitle(text){return String(text||'').replace(/\([^)]*\)/g,'').replace(/\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow)\b/ig,'').replace(/\b\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}\b/g,'').replace(/\s+/g,' ').trim()}
  function shortTitle(text){const s=cleanTitle(text)||'Task';if(s.length<=25)return s;const words=s.split(/\s+/);let out='';for(const w of words){const test=(out?out+' ':'')+w;if(test.length>25)break;out=test}return out||s.slice(0,25)}
  function typeFromText(text){return /(agency|client|sop|strategy|business|vinted|product|research|sales|marketing|money|work|shift|tok|commentary|meta)/i.test(String(text||''))?'business':'personal'}
  function weekDays(){const m=currentMonday();return [0,1,2,3,4,5,6].map(i=>({date:ymd(addDays(m,i)),dayIndex:i,label:DAY_LABELS[i]}))}
  function currentWeekVisible(){return ymd(currentMonday())===ymd(monday(new Date()))}
  function eventIntervals(dayIndex){const out=[];const day=[...document.querySelectorAll('#scheduleView .day')][dayIndex];if(!day)return out;day.querySelectorAll('.event').forEach(el=>{const txt=(el.querySelector('.time')||{}).textContent||'';const title=(el.querySelector('.title')||{}).textContent||'';const m=txt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(m)out.push({start:mins(m[1]),end:mins(m[2]),title})});return out}
  function isSchoolTitle(t){return /\b2i\b|HL|SL|TOK|CAS|bio|psy|daA|enB|maAI|diagram|class|relationships|school/i.test(String(t||''))}
  function isProtectedTitle(t){return /morning routine|evening routine|wind down|\bwork\b|trip/i.test(String(t||''))||isSchoolTitle(t)}
  function protectedSpanForDay(dayIndex){const intervals=eventIntervals(dayIndex).filter(b=>isSchoolTitle(b.title));if(!intervals.length)return null;return {start:Math.min(...intervals.map(x=>x.start)),end:Math.max(...intervals.map(x=>x.end))}}
  function merge(list){const a=list.filter(x=>x.end>x.start).sort((x,y)=>x.start-y.start),out=[];for(const x of a){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({...x})}return out}
  function subtract(base,busy){let free=[base];for(const b of merge(busy)){const next=[];for(const f of free){if(b.end<=f.start||b.start>=f.end)next.push(f);else{if(b.start>f.start)next.push({start:f.start,end:b.start});if(b.end<f.end)next.push({start:b.end,end:f.end})}}free=next}return free.filter(f=>f.end-f.start>=45)}
  function freeForDay(day,state,reserved){const todayIdx=(new Date().getDay()+6)%7;let start=405,end=1350;if(currentWeekVisible()){if(day.dayIndex<todayIdx)return[];if(day.dayIndex===todayIdx)start=Math.max(start,nextFive())}const busy=[];const schoolSpan=protectedSpanForDay(day.dayIndex);if(schoolSpan)busy.push(schoolSpan);eventIntervals(day.dayIndex).filter(b=>isProtectedTitle(b.title)).forEach(b=>busy.push({start:b.start,end:b.end}));(state.custom||[]).forEach(c=>{if(c.date!==day.date)return;if(!c.aiCreated)busy.push({start:mins(c.start),end:mins(c.end)})});(reserved||[]).forEach(r=>busy.push(r));return subtract({start,end},busy)}
  function taskItems(tasks){return tasks.map((t,i)=>{const text=String(t.text||t.title||'').trim();const minutes=taskMinutes(text);const days=parseDays(text);return {task:t,id:t.id||('task-'+i),idx:i,text,done:!!t.done,minutes,days,range:parseRange(text),title:shortTitle(text),type:typeFromText(text)}}).filter(x=>x.text&&x.text.toLowerCase()!=='new task'&&!x.done&&x.minutes!=null)}
  function groupTasks(items){const out=[];for(let i=0;i<items.length;i++){let group=[items[i]],minutes=items[i].minutes;if(minutes<45){while(i+1<items.length&&minutes<45){i++;group.push(items[i]);minutes+=items[i].minutes}}out.push({items:group,minutes:Math.max(45,minutes),title:group.length===1?group[0].title:'Grouped tasks',type:group.some(x=>x.type==='business')?'business':'personal'})}return out}
  function allocateGroup(group,startDay,state,reserved){let remaining=group.minutes;const parts=[];const days=weekDays();for(let di=startDay;di<7&&remaining>0;di++){const date=days[di].date;const free=freeForDay(days[di],state,reserved[date]);for(const f of free){if(remaining<=0)break;let chunk=Math.min(remaining,f.end-f.start);if(chunk<45&&remaining>45)continue;if(chunk<45)break;parts.push({day:days[di],start:f.start,end:f.start+chunk});reserved[date]=reserved[date]||[];reserved[date].push({start:f.start,end:f.start+chunk});remaining-=chunk}}return parts}
  function pLabel(i){const today=(new Date().getDay()+6)%7;return i===today?'Today':DAY_LABELS[i]}
  function allocate(){
    const state=getStateObj();let tasks=getTasks();syncTasksFromDom(tasks);
    const released={};(state.custom||[]).forEach(c=>{if(c.aiCreated)(c.taskIds||[]).forEach(id=>released[id]=1)});tasks.forEach(t=>{if(released[t.id])t.assigned=false});state.custom=(state.custom||[]).filter(c=>!c.aiCreated);
    const items=taskItems(tasks).sort((a,b)=>a.idx-b.idx);
    if(!items.length){setStateObj(state);saveTasks(tasks);try{if(typeof render==='function')render()}catch(e){}toastMsg('No timed tasks to schedule');return 0}
    const todayIdx=(new Date().getDay()+6)%7;const plans=[];
    const noDay=[];
    items.forEach(item=>{
      if(item.days.length){
        item.days.forEach(di=>{let use=di;if(currentWeekVisible()&&use<todayIdx)use=todayIdx;plans.push({items:[item],minutes:Math.max(45,item.minutes),title:item.title,type:item.type,startDay:use,fixedDay:item.range?use:null,fixedRange:item.range||null})});
      }else noDay.push(item);
    });
    const buckets={};noDay.forEach(item=>{let di=todayIdx;(buckets[di]=buckets[di]||[]).push(item)});
    Object.keys(buckets).map(Number).sort((a,b)=>a-b).forEach(di=>{groupTasks(buckets[di]).forEach(g=>{g.startDay=di;plans.push(g)})});
    const reserved={};let made=0;
    for(const plan of plans){
      let parts=[];
      if(plan.fixedRange!=null&&plan.fixedDay!=null){const day=weekDays()[plan.fixedDay];const free=freeForDay(day,state,reserved[day.date]);const ok=free.some(f=>plan.fixedRange.start>=f.start&&plan.fixedRange.end<=f.end);if(ok){parts=[{day,start:plan.fixedRange.start,end:plan.fixedRange.end}];reserved[day.date]=reserved[day.date]||[];reserved[day.date].push({start:plan.fixedRange.start,end:plan.fixedRange.end})}}
      else parts=allocateGroup(plan,plan.startDay||todayIdx,state,reserved);
      if(!parts.length)continue;
      const texts=plan.items.map(x=>x.text),ids=plan.items.map(x=>x.id);
      parts.forEach((p,idx)=>{state.custom.push({id:'ai-'+Date.now()+'-'+made+'-'+idx,date:p.day.date,start:hm(p.start),end:hm(p.end),title:plan.title+(parts.length>1?' pt. '+(idx+1):''),type:plan.type||'personal',source:'custom',aiCreated:true,aiDetails:true,aiGrouped:plan.items.length>1,taskIds:ids,taskTexts:texts});made++});
      plan.items.forEach(x=>{x.task.assigned=true;x.task.day=plan.items.length===1&&x.days.length>1?x.days.map(pLabel).join(', '):pLabel(parts[0].day.dayIndex)})
    }
    setStateObj(state);saveTasks(tasks);try{if(typeof render==='function')render()}catch(e){}try{if(typeof renderTasks==='function')renderTasks()}catch(e){}setTimeout(()=>{try{if(typeof window.personalOSInjectDetails==='function')window.personalOSInjectDetails()}catch(e){}try{if(typeof injectDetails==='function')injectDetails()}catch(e){}},0);toastMsg(made?'Created '+made+' scheduled block'+(made===1?'':'s'):'No free time found for timed tasks');return made
  }
  function shiftFromNext(minutes){const state=getStateObj();const today=ymd(new Date()),n=nowMin();const blocks=(state.custom||[]).filter(c=>c.aiCreated&&c.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date))||mins(a.start)-mins(b.start));const startIndex=blocks.findIndex(c=>c.date>today||mins(c.end)>n);if(startIndex<0)return 0;for(let i=startIndex;i<blocks.length;i++){blocks[i].start=hm(mins(blocks[i].start)+minutes);blocks[i].end=hm(mins(blocks[i].end)+minutes)}setStateObj(state);try{if(typeof render==='function')render()}catch(e){}return blocks.length-startIndex}
  window.personalOSUpdateSchedule=allocate;window.personalOSShiftNextScheduledTask=shiftFromNext;if(window.__posSchedulerOverrideReady)return;window.__posSchedulerOverrideReady=true;
})();
