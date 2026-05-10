// Personal OS scheduler override: strict visible to-do order allocation rules.
(function(){
  const VERSION='visible-dom-priority-v3';
  const STATE_KEY='personalOS.schedule.v5';
  const TASKS_KEY='personalOS.tasks.v1';
  const DAY_LABELS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const DAY_WORDS=[['monday','mon',0],['tuesday','tue',1],['tuesday','tues',1],['wednesday','wed',2],['thursday','thu',3],['thursday','thur',3],['thursday','thurs',3],['friday','fri',4],['saturday','sat',5],['sunday','sun',6]];
  let lastVisibleRows=[];

  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function mins(s){s=String(s||'00:00');const m=s.match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function monday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function scheduleMonday(){return monday(new Date())}
  function todayIndex(){return (new Date().getDay()+6)%7}
  function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()+d.getSeconds()/60}
  function nextFive(){const n=nowMin();let x=Math.ceil(n/5)*5;if(x<=n)x+=5;return x}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function toastMsg(msg){try{if(typeof toast==='function'){toast(msg);return}}catch(e){}console.log(msg)}
  function exposeState(s){try{window.state=s}catch(e){}try{state=s}catch(e){}}
  function setStateObj(s){write(STATE_KEY,s);exposeState(s)}
  function getStateObj(){const s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function getTasks(){const arr=read(TASKS_KEY,[]);return Array.isArray(arr)?arr:[]}
  function saveTasks(arr){write(TASKS_KEY,arr);try{window.tasks=arr}catch(e){}try{tasks=arr}catch(e){}}
  function uniq(arr){return arr.filter((x,i,a)=>x&&a.indexOf(x)===i)}
  function cleanText(s){return String(s||'').replace(/\s+/g,' ').trim()}

  function getVisibleTaskRows(){
    const rows=[];
    const seen=new Set();
    ['#todoView #taskBody tr','#taskBody tr','#todoView .todoRow'].forEach(sel=>{
      document.querySelectorAll(sel).forEach(row=>{
        if(seen.has(row))return;
        if(!row.querySelector('.taskTextInput,.taskPill,textarea,input.cellInput,input[type=text]'))return;
        seen.add(row);
        rows.push(row);
      });
    });
    return rows;
  }
  function rowText(row){
    const el=row.querySelector('.taskTextInput,.taskPill,textarea,input.cellInput:not([type=checkbox]),input[type=text]');
    return cleanText(el?String(el.value!=null?el.value:el.textContent||''):'');
  }
  function rowDone(row){
    const cb=row.querySelector('.taskCheck,input[type=checkbox]');
    return !!(cb&&cb.checked);
  }
  function rowDay(row){
    const el=row.querySelector('.cellSelect,select');
    return cleanText(el?String(el.value||''):'');
  }
  function exactTaskMatch(tasks,text,used){
    return tasks.find(t=>t&&!used.has(t)&&cleanText(t.text||t.title||'')===text)||null;
  }
  function extractVisibleTasks(tasks){
    const rows=getVisibleTaskRows();
    const used=new Set();
    lastVisibleRows=[];
    rows.forEach((row,order)=>{
      const id=(row.dataset&&row.dataset.id)||row.getAttribute('data-id')||'';
      const text=rowText(row);
      if(!text)return;
      const done=rowDone(row);
      const day=rowDay(row);
      let task=null;
      if(id)task=tasks.find(t=>t&&t.id===id)||null;
      if(!task)task=exactTaskMatch(tasks,text,used);
      if(!task&&tasks[order]&&!used.has(tasks[order]))task=tasks[order];
      if(!task){
        task={id:id||('visible-'+Date.now()+'-'+order),done:false,text,day:'',area:'Personal',createdAt:new Date().toISOString()};
        tasks.push(task);
      }
      used.add(task);
      if(id&&!task.id)task.id=id;
      task.text=text;
      task.done=done;
      if(day||task.day!=null)task.day=day;
      lastVisibleRows.push({order,row,task,id:task.id||id||('task-'+order),text,done,day});
    });
    return lastVisibleRows;
  }

  function parseExactRange(text){
    const m=String(text||'').match(/\b(\d{1,2})(?:[.:](\d{2}))?\s*-\s*(\d{1,2})(?:[.:](\d{2}))?\b/);
    if(!m)return null;
    const start=Number(m[1])*60+Number(m[2]||0);
    const end=Number(m[3])*60+Number(m[4]||0);
    return end>start?{start,end}:null;
  }
  function parseDays(text){
    const s=String(text||'').toLowerCase(),found=[];
    function add(i){if(!found.includes(i))found.push(i)}
    if(/\btoday\b/.test(s))add(todayIndex());
    if(/\btomorrow\b/.test(s))add((todayIndex()+1)%7);
    DAY_WORDS.forEach(([full,short,idx])=>{if(new RegExp('\\b('+full+'|'+short+')\\b').test(s))add(idx)});
    return found;
  }
  function parseDuration(text){
    const raw=String(text||'');
    const range=parseExactRange(raw);
    if(range)return range.end-range.start;
    const parens=[...raw.matchAll(/\(([^)]*)\)/g)].map(m=>m[1]).join(' ');
    const target=(parens||raw).toLowerCase();
    let total=0;
    const hourMatches=[...target.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/g)];
    const minMatches=[...target.matchAll(/(\d+)\s*(m|min|mins|minute|minutes)\b/g)];
    hourMatches.forEach(m=>{total+=Math.round(Number(m[1])*60)});
    minMatches.forEach(m=>{total+=Number(m[1])});
    if(!total&&parens&&/^\s*\d+\s*$/.test(parens))total=Number(parens.trim());
    return total||null;
  }
  function cleanTitle(text){
    return cleanText(String(text||'')
      .replace(/\([^)]*\)/g,'')
      .replace(/\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow)\b/ig,'')
      .replace(/\b\d{1,2}(?:[.:]\d{2})?\s*-\s*\d{1,2}(?:[.:]\d{2})?\b/g,''));
  }
  function shortTitle(text){const s=cleanTitle(text)||'Task';if(s.length<=25)return s;const words=s.split(/\s+/);let out='';for(const w of words){const test=(out?out+' ':'')+w;if(test.length>25)break;out=test}return out||s.slice(0,25)}
  function typeFromText(text){return /(agency|client|sop|strategy|business|vinted|product|research|sales|marketing|money|work|shift|tok|commentary|meta|cro)/i.test(String(text||''))?'business':'personal'}

  function buildTimedItems(visibleRows){
    return visibleRows.map((r,i)=>{
      const text=r.text;
      const minutes=parseDuration(text);
      const days=parseDays(text);
      const range=parseExactRange(text);
      return {order:r.order,task:r.task,id:r.id||('task-'+i),text,done:!!r.done,minutes,remaining:minutes||0,days,range,title:shortTitle(text),type:typeFromText(text)};
    }).filter(x=>x.text&&x.text.toLowerCase()!=='new task'&&!x.done&&x.minutes!=null);
  }
  function makePlan(entries,minutes,base,opts){
    opts=opts||{};
    const texts=uniq(entries.map(e=>e.item.text));
    const ids=uniq(entries.map(e=>e.item.id));
    return {entries,items:entries.map(e=>e.item),taskTexts:texts,taskIds:ids,minutes,title:opts.title||base.title,type:entries.some(e=>e.item.type==='business')?'business':base.type,days:opts.days||[],range:opts.range||null,grouped:entries.length>1};
  }
  function buildPlansStrictVisibleOrder(items){
    const plans=[];
    for(let i=0;i<items.length;i++){
      const item=items[i];
      if(item.remaining<=0)continue;
      const dayList=item.days.length?item.days:[null];
      if(item.days.length||item.range){
        dayList.forEach(di=>plans.push(makePlan([{item,minutes:item.minutes}],item.minutes,item,{days:di==null?[]:[di],range:item.range,title:item.title})));
        item.remaining=0;
        continue;
      }
      if(item.remaining>=45){
        const minutes=item.remaining;
        plans.push(makePlan([{item,minutes}],minutes,item,{title:item.title}));
        item.remaining=0;
        continue;
      }
      const entries=[{item,minutes:item.remaining}];
      let total=item.remaining;
      item.remaining=0;
      let j=i+1;
      while(total<45&&j<items.length){
        const next=items[j];
        if(next.remaining>0&&!next.days.length&&!next.range){
          const take=Math.min(next.remaining,45-total);
          entries.push({item:next,minutes:take});
          next.remaining-=take;
          total+=take;
        }
        j++;
      }
      plans.push(makePlan(entries,Math.max(45,total),item,{title:entries.length>1?'Grouped tasks':item.title}));
    }
    return plans;
  }

  function eventIntervalsFromDom(dayIndex){
    const out=[];
    const day=[...document.querySelectorAll('#scheduleView .day')][dayIndex];
    if(!day)return out;
    day.querySelectorAll('.event').forEach(el=>{
      const txt=(el.querySelector('.time')||{}).textContent||'';
      const title=(el.querySelector('.title')||{}).textContent||'';
      const m=txt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if(m)out.push({start:mins(m[1]),end:mins(m[2]),title,type:[...el.classList].join(' '),source:''});
    });
    return out;
  }
  function blocksForDate(date,dayIndex){
    try{
      if(typeof blocksFor==='function'){
        const d=new Date(date+'T00:00:00');
        const w=typeof isoWeek==='function'?isoWeek(d):1;
        return (blocksFor(d,dayIndex,w)||[]).map(b=>({start:mins(b.start),end:mins(b.end),title:b.title||'',type:b.type||'',source:b.source||'',aiCreated:!!b.aiCreated}));
      }
    }catch(e){}
    return eventIntervalsFromDom(dayIndex);
  }
  function isSchoolBlock(b){return /school/i.test(b.type||'')||/\b2i\b|HL|SL|TOK|CAS|bio|psy|daA|enB|maAI|diagram|class|relationships|school/i.test(String(b.title||''))}
  function isProtectedBlock(b){
    if(b.aiCreated)return false;
    if(b.source==='custom')return true;
    if(isSchoolBlock(b))return true;
    return /routine|evening|wind|work|trip/i.test(String((b.type||'')+' '+(b.title||'')));
  }
  function merge(list){const a=list.filter(x=>x.end>x.start).sort((x,y)=>x.start-y.start),out=[];for(const x of a){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({start:x.start,end:x.end})}return out}
  function subtract(base,busy){let free=[base];for(const b of merge(busy)){const next=[];for(const f of free){if(b.end<=f.start||b.start>=f.end)next.push(f);else{if(b.start>f.start)next.push({start:f.start,end:b.start});if(b.end<f.end)next.push({start:b.end,end:f.end})}}free=next}return free.filter(f=>f.end-f.start>=45)}
  function getProtectedIntervals(date,dayIndex,state,reserved){
    const busy=[];
    const blocks=blocksForDate(date,dayIndex);
    const school=blocks.filter(isSchoolBlock);
    if(school.length)busy.push({start:Math.min(...school.map(x=>x.start)),end:Math.max(...school.map(x=>x.end))});
    blocks.filter(b=>!isSchoolBlock(b)&&isProtectedBlock(b)).forEach(b=>busy.push({start:b.start,end:b.end}));
    (state.custom||[]).forEach(c=>{if(c.date===date&&!c.aiCreated)busy.push({start:mins(c.start),end:mins(c.end)})});
    (reserved[date]||[]).forEach(r=>busy.push(r));
    return busy;
  }
  function freeFor(date,dayIndex,state,reserved){
    const today=ymd(new Date());
    let start=405,end=1350;
    if(date<today)return [];
    if(date===today){if(dayIndex<todayIndex())return[];start=Math.max(start,nextFive())}
    return subtract({start,end},getProtectedIntervals(date,dayIndex,state,reserved));
  }
  function reserve(reserved,slot){reserved[slot.date]=reserved[slot.date]||[];reserved[slot.date].push({start:slot.start,end:slot.end})}
  function unreserve(reserved,parts){parts.forEach(p=>{reserved[p.date]=(reserved[p.date]||[]).filter(r=>!(r.start===p.start&&r.end===p.end))})}
  function baseDateForDay(dayIndex){const start=scheduleMonday();let add=dayIndex;if(dayIndex<todayIndex())add+=7;return addDays(start,add)}
  function findExactSlot(dayIndex,range,state,reserved){
    const d=baseDateForDay(dayIndex);
    for(let w=0;w<52;w++){
      const date=ymd(addDays(d,w*7));
      const free=freeFor(date,dayIndex,state,reserved);
      if(free.some(f=>range.start>=f.start&&range.end<=f.end))return{date,dayIndex,start:range.start,end:range.end};
    }
    return null;
  }
  function chooseChunk(remain,available){
    if(available<45)return 0;
    if(remain<=available)return remain>=45?remain:0;
    let chunk=available;
    const leftover=remain-chunk;
    if(leftover>0&&leftover<45)chunk=remain-45;
    return chunk>=45&&chunk<=available?chunk:0;
  }
  function findChronologicalChunks(minutes,state,reserved,allowedDay){
    let remain=minutes;
    const parts=[];
    const start=scheduleMonday();
    for(let offset=0;offset<364&&remain>0;offset++){
      const d=addDays(start,offset),date=ymd(d),di=(d.getDay()+6)%7;
      if(allowedDay!=null&&di!==allowedDay)continue;
      const free=freeFor(date,di,state,reserved);
      for(const f of free){
        if(remain<=0)break;
        const chunk=chooseChunk(remain,f.end-f.start);
        if(!chunk)continue;
        const part={date,dayIndex:di,start:f.start,end:f.start+chunk};
        parts.push(part);
        reserve(reserved,part);
        remain-=chunk;
      }
    }
    if(remain===0)return parts;
    unreserve(reserved,parts);
    return [];
  }
  function placePlan(plan,state,reserved){
    if(plan.range&&plan.days.length){
      const slot=findExactSlot(plan.days[0],plan.range,state,reserved);
      if(!slot)return [];
      reserve(reserved,slot);
      return [slot];
    }
    if(plan.days.length)return findChronologicalChunks(plan.minutes,state,reserved,plan.days[0]);
    return findChronologicalChunks(plan.minutes,state,reserved,null);
  }

  function pLabel(i,date){return date===ymd(new Date())?'Today':DAY_LABELS[i]}
  function addBlock(state,plan,slot,idx,total,made){
    const title=plan.title+(total>1?' pt. '+idx:'');
    state.custom.push({id:'ai-'+Date.now()+'-'+made+'-'+idx,date:slot.date,start:hm(slot.start),end:hm(slot.end),title,type:plan.type||'personal',source:'custom',aiCreated:true,aiDetails:true,aiGrouped:!!plan.grouped,taskIds:plan.taskIds,taskTexts:plan.taskTexts});
  }
  function markTaskDays(plan,parts){
    const labels=uniq(parts.map(p=>pLabel(p.dayIndex,p.date)));
    plan.items.forEach(item=>{
      const current=item.task.__posScheduledLabels||[];
      item.task.__posScheduledLabels=uniq(current.concat(labels));
      item.task.assigned=true;
      item.task.day=item.task.__posScheduledLabels.join(', ');
    });
  }
  function cleanupTempTaskFields(tasks){tasks.forEach(t=>{try{delete t.__posScheduledLabels}catch(e){}})}

  function allocate(){
    const state=getStateObj();
    const tasks=getTasks();
    extractVisibleTasks(tasks);
    const released={};
    (state.custom||[]).forEach(c=>{if(c.aiCreated)(c.taskIds||[]).forEach(id=>released[id]=1)});
    tasks.forEach(t=>{if(released[t.id])t.assigned=false;try{delete t.__posScheduledLabels}catch(e){}});
    state.custom=(state.custom||[]).filter(c=>!c.aiCreated);
    exposeState(state);
    const items=buildTimedItems(lastVisibleRows);
    if(!items.length){setStateObj(state);cleanupTempTaskFields(tasks);saveTasks(tasks);try{if(typeof render==='function')render()}catch(e){}toastMsg('No timed tasks to schedule');return 0}
    const plans=buildPlansStrictVisibleOrder(items);
    const reserved={};
    let made=0;
    for(const plan of plans){
      const parts=placePlan(plan,state,reserved);
      if(!parts.length)continue;
      parts.forEach((slot,i)=>addBlock(state,plan,slot,i+1,parts.length,made++));
      markTaskDays(plan,parts);
    }
    cleanupTempTaskFields(tasks);
    setStateObj(state);
    saveTasks(tasks);
    try{if(typeof render==='function')render()}catch(e){}
    try{if(typeof renderTasks==='function')renderTasks()}catch(e){}
    setTimeout(()=>{try{if(typeof window.personalOSInjectDetails==='function')window.personalOSInjectDetails()}catch(e){}},0);
    toastMsg(made?'Created '+made+' scheduled block'+(made===1?'':'s'):'No free time found for timed tasks');
    return made;
  }
  function shiftFromNext(minutes){const state=getStateObj();const today=ymd(new Date()),n=nowMin();const blocks=(state.custom||[]).filter(c=>c.aiCreated&&c.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date))||mins(a.start)-mins(b.start));const startIndex=blocks.findIndex(c=>c.date>today||mins(c.end)>n);if(startIndex<0)return 0;for(let i=startIndex;i<blocks.length;i++){blocks[i].start=hm(mins(blocks[i].start)+minutes);blocks[i].end=hm(mins(blocks[i].end)+minutes)}setStateObj(state);try{if(typeof render==='function')render()}catch(e){}return blocks.length-startIndex}
  function assertBinding(){
    window.personalOSSchedulerVersion=VERSION;
    window.personalOSReliableScheduleTasks=allocate;
    window.personalOSUpdateSchedule=allocate;
    window.personalOSShiftNextScheduledTask=shiftFromNext;
    window.__posSchedulerOverrideReady=true;
  }
  assertBinding();
  setInterval(assertBinding,500);
})();
