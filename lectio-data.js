// Loads the latest stable to-do/schedule layer, then applies final visual tweaks and real-time task sorting.
(function(){
  const BASE_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/6421c1c6e5db32787edc6a9329f4073632861d93/lectio-data.js';

  function applyFinalTweaks(){
    document.querySelectorAll('#todo-final-tweaks').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='todo-final-tweaks';
    s.textContent=`
      .todoSide{border-color:#2b2351!important;background:linear-gradient(180deg,rgba(29,20,54,.94),rgba(9,7,20,.97))!important;box-shadow:0 0 0 1px rgba(155,108,255,.12) inset,0 18px 40px rgba(0,0,0,.34)!important}
      .todoToday{border-color:rgba(155,108,255,.52)!important;background:linear-gradient(180deg,rgba(92,52,170,.24),rgba(20,14,42,.80))!important}
      .todoToday .todoDayTop{color:#efe6ff!important}
      .todoBarFill{background:linear-gradient(90deg,#7a55c8,#b875ff)!important}
      .todoMain{border-color:#201a39!important;background:linear-gradient(180deg,rgba(11,9,22,.92),rgba(4,5,10,.96))!important}
      .todoMain .panelHead{margin-bottom:4px!important}
      .todoMain .panelTitle{line-height:1.05!important}
      .todoMain .table th{padding-top:10px!important;padding-bottom:10px!important}
      .chartBar{background:linear-gradient(180deg,#b875ff,#4b367f)!important}
      .selectPlaceholder{color:#8f86aa!important}
    `;
    document.head.appendChild(s);
  }

  const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function todayName(){return weekdayNames[new Date().getDay()]}
  function rollingDays(){const out=['Today'];const now=new Date();for(let i=1;i<7;i++)out.push(weekdayNames[new Date(now.getFullYear(),now.getMonth(),now.getDate()+i).getDay()]);return out}
  function isEmptyTask(t){return !String(t&&t.text||'').trim() || String(t&&t.text||'').trim().toLowerCase()==='new task'}
  function normalizeTaskDay(t){
    const v=typeof t==='string'?t:(t&&t.day);
    if(!v||v==='Later'||v==='Select day')return'';
    if(v===todayName())return'Today';
    return v;
  }
  function taskDayRank(t){
    const d=normalizeTaskDay(t);
    if(!d)return 99;
    if(d==='Today')return 0;
    const todayIdx=new Date().getDay();
    const idx=weekdayNames.indexOf(d);
    if(idx<0)return 99;
    const diff=(idx-todayIdx+7)%7;
    return diff===0?0:diff;
  }
  function pct(list){return list.length?Math.round(list.filter(t=>t.done).length/list.length*100):0}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function monthKey(dt){const d=new Date(dt||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function saveRaw(){try{localStorage.setItem('personalOS.tasks.v1',JSON.stringify(tasks))}catch(e){}}
  function ensureTaskDefaults(){
    const now=new Date().toISOString();
    tasks.forEach(t=>{
      if(!t.createdAt)t.createdAt=now;
      if(isEmptyTask(t)) t.day=''; else t.day=normalizeTaskDay(t)||'Today';
      if(t.done&&!t.completedAt)t.completedAt=now;
      if(!t.done&&t.completedAt)delete t.completedAt;
    });
  }
  function sortTasks(){
    tasks.forEach((t,i)=>t.__order=i);
    tasks.sort((a,b)=>taskDayRank(a)-taskDayRank(b)+(a.__order-b.__order)/10000);
    tasks.forEach(t=>delete t.__order);
  }
  function dayLabel(d){return d==='Today'?'Today ('+todayName().slice(0,3)+')':d}
  function dayHtml(days){return days.map(d=>{const list=tasks.filter(t=>normalizeTaskDay(t)===d),p=pct(list);return `<div class="todoDay ${d==='Today'?'todoToday':''}"><div class="todoDayTop"><span>${dayLabel(d)}</span><span>${p}%</span></div><div class="todoBar"><div class="todoBarFill" style="width:${p}%"></div></div></div>`}).join('')}
  function weeklyHtml(days){return days.map(d=>{const p=pct(tasks.filter(t=>normalizeTaskDay(t)===d));return `<div class="chartCol"><div class="chartBar" style="height:${Math.max(2,p)}%"></div><div class="chartLabel">${d==='Today'?'Today':d.slice(0,3)}</div></div>`}).join('')}
  function monthHtml(){const now=new Date(),months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:monthKey(d),label:monthNames[d.getMonth()]})}return months.map(m=>{const list=tasks.filter(t=>monthKey(t.completedAt||t.createdAt||Date.now())===m.key),p=pct(list);return `<div class="chartCol"><div class="chartBar" style="height:${Math.max(2,p)}%"></div><div class="chartLabel">${m.label}</div></div>`}).join('')}

  function renderTasksFinal(){
    if(typeof tasks==='undefined'||!Array.isArray(tasks))return;
    ensureTaskDefaults();
    sortTasks();
    saveRaw();
    const days=rollingDays();
    const panel=document.querySelector('#todoView .panel'); if(!panel)return;
    panel.innerHTML=`<div class="todoLayout"><aside class="todoSide"><div class="todoSideTitle">Daily progress</div>${dayHtml(days)}<div class="todoChart"><div class="todoChartTitle">Next 7 days</div><div class="barChart">${weeklyHtml(days)}</div></div><div class="todoChart"><div class="todoChartTitle">Month by month</div><div class="barChart">${monthHtml()}</div></div></aside><main class="todoMain"><div class="panelHead"><div><div class="panelTitle">To do list</div></div><button class="addBtn" id="addTask">+ TASK</button></div><table class="table"><thead><tr><th style="width:56px">Done</th><th>Task</th><th style="width:150px">Day</th><th style="width:110px"></th></tr></thead><tbody id="taskBody"></tbody></table></main></div>`;
    const body=document.getElementById('taskBody');
    tasks.forEach(t=>{
      const tr=document.createElement('tr');tr.className='todoRow '+(t.done?'doneRow':'');tr.draggable=true;tr.dataset.id=t.id;
      const w=Math.max(12,Math.min(52,String(t.text||'').length+3));
      const currentDay=normalizeTaskDay(t);
      const options=['',...days].map(d=>`<option value="${d}">${d?dayLabel(d):'Select day'}</option>`).join('');
      tr.innerHTML=`<td><input class="taskCheck" type="checkbox" ${t.done?'checked':''}></td><td class="taskText"><span class="dragCell" title="Drag to reorder">⋮⋮</span><input class="cellInput taskPill" style="width:${w}ch!important" value="${esc(t.text||'')}"></td><td><select class="cellSelect ${currentDay?'':'selectPlaceholder'}">${options}</select></td><td><button class="tinyBtn danger">DELETE</button></td>`;
      const check=tr.querySelector('.taskCheck'),text=tr.querySelector('.taskPill'),day=tr.querySelector('.cellSelect'),del=tr.querySelector('.danger');
      day.value=currentDay;
      check.onchange=()=>{t.done=check.checked;if(t.done)t.completedAt=new Date().toISOString();else delete t.completedAt;renderTasksFinal();if(typeof renderProductivity==='function')renderProductivity()};
      text.oninput=()=>{text.style.width=Math.max(12,Math.min(52,text.value.length+3))+'ch'};
      text.onchange=()=>{t.text=text.value;if(isEmptyTask(t))t.day='';else if(!normalizeTaskDay(t))t.day='Today';renderTasksFinal();if(typeof renderProductivity==='function')renderProductivity()};
      day.onchange=()=>{t.day=day.value;renderTasksFinal();if(typeof renderProductivity==='function')renderProductivity()};
      del.onclick=()=>{tasks=tasks.filter(x=>x.id!==t.id);window.tasks=tasks;renderTasksFinal();if(typeof renderProductivity==='function')renderProductivity()};
      tr.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',t.id);tr.classList.add('dragging')});
      tr.addEventListener('dragend',()=>tr.classList.remove('dragging'));
      tr.addEventListener('dragover',e=>{e.preventDefault();tr.classList.add('dropAbove')});
      tr.addEventListener('dragleave',()=>tr.classList.remove('dropAbove'));
      tr.addEventListener('drop',e=>{e.preventDefault();tr.classList.remove('dropAbove');const from=e.dataTransfer.getData('text/plain'),to=t.id;if(!from||from===to)return;const moving=tasks.find(x=>x.id===from);tasks=tasks.filter(x=>x.id!==from);const idx=tasks.findIndex(x=>x.id===to);tasks.splice(idx,0,moving);window.tasks=tasks;renderTasksFinal()});
      body.appendChild(tr);
    });
    const add=document.getElementById('addTask');
    if(add)add.onclick=()=>{tasks.push({id:(typeof uid==='function'?uid():'t'+Date.now()),done:false,text:'New task',day:'',area:'Personal',createdAt:new Date().toISOString()});renderTasksFinal()};
  }

  function patchFinal(){
    applyFinalTweaks();
    window.renderTasks=renderTasks=renderTasksFinal;
    window.saveTasks=saveTasks=function(){renderTasksFinal();if(typeof renderProductivity==='function')renderProductivity()};
    renderTasksFinal();
  }

  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    setTimeout(patchFinal,700);
  }).catch(()=>setTimeout(patchFinal,700));
})();
