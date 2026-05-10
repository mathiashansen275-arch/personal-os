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
    const s=String(text||'').toLowerCase(),found=[],add=i=>{if(!found.includes(i))found.push(i)};
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
  function eventIntervals(dayIndex){const out=[];const day=[...document.querySelectorAll('#scheduleView .day')][dayIndex];if(!day)return out;day.querySelectorAll('.event').forEach(el=>{const txt=(el.querySelector('.time')||{}).textContent||'';const title=(el.querySelector('.title')||{}).textContent||'';const m=txt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(m)out.push({start:mins(m[1]),end:mins(m[2]),title})});return out}
  function isSchoolTitle(t){return /\b2i\b|HL|SL|TOK|CAS|bio|psy|daA|enB|maAI|diagram|class|relationships|school/i.test(String(t||''))}
  function isProtectedTitle(t){return /morning routine|evening routine|wind down|\bwork\b|trip/i.test(String(t||''))||isSchoolTitle(t)}
  function merge(list){const a=list.filter(x=>x.end>x.start).sort((x,y)=>x.start-y.start),out=[];for(const x of a){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({...x})}return out}
  function subtract(base,busy){let free=[base];for(const b of merge(busy)){const next=[];for(const f of free){if(b.end<=f.start||b.start>=f.end)next.push(f);else{if(b.start>f.start)next.push({start:f.start,end:b.start});if(b.end<f.end)next.push({start:b.end,end:f.end})}}free=next}return free.filter(f=>f.end-f.start>=45)}
  function baseDateForDay(dayIndex){const start=currentMonday();const todayIdx=(new Date().getDay()+6)%7;let add=dayIndex;if(ymd(start)===ymd(monday(new Date()))&&dayIndex<todayIdx)add+=7;return addDays(start,add)}
  function freeFor(date,dayIndex,state,reserved){
    const today=ymd(new Date()),todayIdx=(new Date().getDay()+6)%7;
    let start=405,end=1350;
    if(date<today)return [];
    if(date===today){if(dayIndex<todayIdx)return[];start=Math.max(start,nextFive())}
    const busy=[];
    const school=eventIntervals(dayIndex).filter(b=>isSchoolTitle(b.title));
    if(school.length)busy.push({start:Math.min(...school.map(x=>x.start)),end:Math.max(...school.map(x=>x.end))});
    eventIntervals(dayIndex).filter(b=>isProtectedTitle(b.title)).forEach(b=>busy.push({start:b.start,end:b.end}));
    (state.custom||[]).forEach(c=>{if(c.date===date)busy.push({start:mins(c.start),end:mins(c.end)})});
    (reserved[date]||[]).forEach(r=>busy.push(r));
    return subtract({start,end},busy)
  }
  function findExact(range,dayIndex,state,reserved){
    let d=baseDateForDay(dayIndex);
    for(let w=0;w<10;w++){
      const date=ymd(addDays(d,w*7));
      const free=freeFor(date,dayIndex,state,reserved);
      if(free.some(f=>range.start>=f.start&&range.end<=f.end))return{date,dayIndex,start:range.start,end:range.end};
    }
    return null;
  }
  function findChunks(minutes,allowedDay,state,reserved){
    let remain=minutes,parts=[];
    const start=currentMonday();
    for(let offset=0;offset<70&&remain>0;offset++){
      const d=addDays(start,offset),date=ymd(d),di=offset%7;
      if(allowedDay!=null&&di!==allowedDay)continue;
      const free=freeFor(date,di,state,reserved);
      for(const f of free){
        if(remain<=0)break;
        const chunk=Math.min(remain,f.end-f.start);
        if(chunk<45&&remain>45)continue;
        if(chunk<45)break;
        const part={date,dayIndex:di,start:f.start,end:f.start+chunk};
        parts.push(part);
        reserved[date]=reserved[date]||[];reserved[date].push({start:part.start,end:part.end});
        remain-=chunk;
      }
    }
    return remain===0?parts:[];
  }
  function groupShort(items){const out=[];for(let i=0;i<items.length;i++){let group=[items[i]],minutes=items[i].minutes;if(minutes<45){while(i+1<items.length&&minutes<45&&items[i+1].days.length===0&&!items[i+1].range){i++;group.push(items[i]);minutes+=items[i].minutes}}out.push({items:group,minutes:Math.max(45,minutes),title:group.length===1?group[0].title:'Grouped tasks',type:group.some(x=>x.type==='business')?'business':'personal',days:[],range:null})}return out}
  function pLabel(i,date){const today=ymd(new Date());return date===today?'Today':DAY_LABELS[i]}
  function addBlock(state,plan,slot,idx,total,made){const texts=plan.items.map(x=>x.text),ids=plan.items.map(x=>x.id);state.custom.push({id:'ai-'+Date.now()+'-'+made+'-'+idx,date:slot.date,start:hm(slot.start),end:hm(slot.end),title:plan.title+(total>1?' pt. '+idx:''),type:plan.type||'personal',source:'custom',aiCreated:true,aiDetails:true,aiGrouped:plan.items.length>1,taskIds:ids,taskTexts:texts})}
  function taskItems(tasks){return tasks.map((t,i)=>{const text=String(t.text||t.title||'').trim(),minutes=taskMinutes(text),days=parseDays(text),range=parseRange(text);return{task:t,id:t.id||('task-'+i),idx:i,text,done:!!t.done,minutes,days,range,title:shortTitle(text),type:typeFromText(text)}}).filter(x=>x.text&&x.text.toLowerCase()!=='new task'&&!x.done&&x.minutes!=null)}
  function allocate(){
    const state=getStateObj();let tasks=getTasks();syncTasksFromDom(tasks);
    const released={};(state.custom||[]).forEach(c=>{if(c.aiCreated)(c.taskIds||[]).forEach(id=>released[id]=1)});tasks.forEach(t=>{if(released[t.id])t.assigned=false});
    state.custom=(state.custom||[]).filter(c=>!c.aiCreated);
    const items=taskItems(tasks).sort((a,b)=>a.idx-b.idx);
    if(!items.length){setStateObj(state);saveTasks(tasks);try{if(typeof render==='function')render()}catch(e){}toastMsg('No timed tasks to schedule');return 0}
    const plans=[];
    items.forEach(item=>{
      if(item.days.length){item.days.forEach(di=>plans.push({items:[item],minutes:Math.max(45,item.minutes),title:item.title,type:item.type,days:[di],range:item.range}))}
      else plans.push(item);
    });
    const expanded=[];let buffer=[];
    plans.forEach(p=>{if(p.items){expanded.push(p);return}if(!p.days.length&&!p.range){buffer.push(p);return}expanded.push({items:[p],minutes:Math.max(45,p.minutes),title:p.title,type:p.type,days:p.days,range:p.range})});
    groupShort(buffer).forEach(g=>expanded.push(g));
    const reserved={};let made=0;
    for(const plan of expanded){
      let parts=[];
      if(plan.range&&plan.days&&plan.days.length){for(const di of plan.days){const ex=findExact(plan.range,di,state,reserved);if(ex){reserved[ex.date]=reserved[ex.date]||[];reserved[ex.date].push({start:ex.start,end:ex.end});parts.push(ex)}}}
      else if(plan.days&&plan.days.length){for(const di of plan.days)parts=parts.concat(findChunks(plan.minutes,di,state,reserved))}
      else parts=findChunks(plan.minutes,null,state,reserved);
      if(!parts.length)continue;
      parts.forEach((slot,i)=>addBlock(state,plan,slot,i+1,parts.length,made++));
      plan.items.forEach(x=>{x.task.assigned=true;x.task.day=parts.map(p=>pLabel(p.dayIndex,p.date)).filter((v,i,a)=>a.indexOf(v)===i).join(', ')})
    }
    setStateObj(state);saveTasks(tasks);try{if(typeof render==='function')render()}catch(e){}try{if(typeof renderTasks==='function')renderTasks()}catch(e){}setTimeout(()=>{try{if(typeof window.personalOSInjectDetails==='function')window.personalOSInjectDetails()}catch(e){}},0);toastMsg(made?'Created '+made+' scheduled block'+(made===1?'':'s'):'No free time found for timed tasks');return made
  }
  function shiftFromNext(minutes){const state=getStateObj();const today=ymd(new Date()),n=nowMin();const blocks=(state.custom||[]).filter(c=>c.aiCreated&&c.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date))||mins(a.start)-mins(b.start));const startIndex=blocks.findIndex(c=>c.date>today||mins(c.end)>n);if(startIndex<0)return 0;for(let i=startIndex;i<blocks.length;i++){blocks[i].start=hm(mins(blocks[i].start)+minutes);blocks[i].end=hm(mins(blocks[i].end)+minutes)}setStateObj(state);try{if(typeof render==='function')render()}catch(e){}return blocks.length-startIndex}
  window.personalOSUpdateSchedule=allocate;window.personalOSShiftNextScheduledTask=shiftFromNext;window.__posSchedulerOverrideReady=true;
})();
