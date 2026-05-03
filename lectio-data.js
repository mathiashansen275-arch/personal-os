// Loads the latest synced Lectio data from the last generated snapshot, then applies live time-progress styling and to-do upgrades.
(function(){
  const DATA_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/179ba3a09d3b58a407428ecde3910bd14fd04bdc/lectio-data.js';

  function injectProgressStyles(){
    document.querySelectorAll('#time-progress-styles,#time-progress-styles-v2,#time-progress-styles-v3,#time-progress-styles-v4,#time-progress-styles-v5,#todo-upgrade-styles').forEach(x=>x.remove());
    const s=document.createElement('style');
    s.id='time-progress-styles-v5';
    s.textContent=`
      :root{--line:#151827;--muted:#778096}
      body,.app{background:#020307!important}
      .topbar,.panel{border-color:#182033!important;background:linear-gradient(180deg,#080b12,#030409)!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important}
      .calendar{border-color:#151827!important;background:#020307!important}.timecol,.day{background:#030409!important;border-right-color:#151827!important}.head{background:#050711!important;border-bottom-color:#151827!important}.todayCol .head{color:#c7d2ff!important;box-shadow:inset 0 2px 0 #445dff!important}.grid{background:linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px) 0 0/100% calc(60 * var(--px))!important}.tlabel{text-shadow:0 0 8px rgba(90,120,255,.45)!important}
      button,.badge,.cellInput,.cellSelect,.noteArea,input,select,.checkline{border-color:#202946!important;background:#050711!important}.tab{border-color:#171d30!important;background:#050711!important}.tab.active{border-color:#20283f!important;color:#fff!important;background:linear-gradient(180deg,#090d18,#04060c)!important;box-shadow:0 0 0 1px rgba(0,0,0,.55) inset!important}.addBtn,.primary{border-color:#26314f!important;background:linear-gradient(180deg,#111a38,#070912)!important}.revertBtn,.synced{border-color:#126949!important;background:rgba(16,194,119,.06)!important}.table{background:#05070c!important;border-color:#161d2d!important}.table th{background:#080b13!important}.table th,.table td{border-color:#161d2d!important}
      .panelHead .muted{display:none!important}
      .event{isolation:isolate;transition:filter .08s ease,box-shadow .08s ease,transform .08s ease,opacity .08s ease!important}
      .event .time,.event .title{position:relative;z-index:4}.event::before,.event::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;transition:opacity .08s ease,height .08s linear}.event::before{background:#000;opacity:0}.event::after{height:var(--time-progress,0%);bottom:auto;background:linear-gradient(180deg,rgba(255,0,170,.18),rgba(255,0,170,.08));mix-blend-mode:screen;opacity:0}
      .event.time-neutral{filter:none!important;opacity:1!important}.event.time-neutral::before{opacity:0!important}.event.time-neutral::after{opacity:0!important}
      .event.time-future{filter:saturate(.58) brightness(.52)!important;opacity:.82!important}.event.time-future::before{opacity:.46!important}
      .event.time-past{filter:saturate(1.15) brightness(1.08)!important;opacity:1!important}.event.time-past::before{opacity:0!important}.event.time-past::after{height:100%;opacity:.16!important}
      .event.time-current{filter:saturate(1.35) brightness(1.16)!important;opacity:1!important;transform:translateY(-1px);box-shadow:0 0 0 1px rgba(255,90,220,.20),0 0 22px rgba(255,0,170,.18),0 10px 26px rgba(0,0,0,.48)!important}.event.time-current::before{opacity:.08!important}.event.time-current::after{opacity:.62!important}.event.time-current::marker{display:none}
      .event.time-current:has(.title)::before{box-shadow:inset 0 0 18px rgba(255,0,170,.055)}
      .event.time-current .time::after{content:""!important}
      .event.break,.event.time-neutral.break,.event.time-future.break,.event.time-past.break,.event.time-current.break{background:linear-gradient(180deg,rgba(27,18,48,.95),rgba(18,12,34,.98))!important;border-color:#7a55c8!important;color:#d8c9ff!important;text-shadow:none!important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)!important;filter:none!important;opacity:1!important}
      .event.break .time,.event.break .title{color:#d8c9ff!important;text-shadow:0 1px 2px rgba(0,0,0,.9)!important;filter:none!important;font-weight:1000!important}
      .event.break::before{opacity:0!important}.event.break::after{display:none!important;opacity:0!important}
      .liveProgressFill{position:absolute;left:0;right:0;top:0;height:var(--time-progress,0%);pointer-events:none;z-index:2;background:linear-gradient(180deg,rgba(255,0,170,.22),rgba(255,0,170,.08));mix-blend-mode:screen;opacity:.5;transition:height .08s linear}
      .event.break .liveProgressFill{display:block!important;background:linear-gradient(180deg,rgba(190,155,255,.34),rgba(150,105,235,.18))!important;opacity:.9!important;mix-blend-mode:screen!important}
      .event:not(.time-current) .liveProgressFill{display:none!important}
      .event.break.time-current{box-shadow:0 0 0 1px rgba(216,201,255,.18),0 0 16px rgba(122,85,200,.2),inset 0 0 0 1px rgba(0,0,0,.25)!important}
    `;
    const t=document.createElement('style');
    t.id='todo-upgrade-styles';
    t.textContent=`
      #todoView .panel{padding:18px!important}.todoLayout{display:grid;grid-template-columns:310px 1fr;gap:18px;align-items:start}.todoSide{border:1px solid #171d30;border-radius:18px;background:linear-gradient(180deg,#080b13,#04060b);padding:16px;position:sticky;top:14px}.todoSideTitle{font-size:18px;font-weight:1000;margin-bottom:12px}.todoDay{margin:12px 0}.todoDayTop{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:1000;color:#c8bdf0;letter-spacing:.04em}.todoBar{height:9px;border:1px solid #1d2743;background:#03050a;border-radius:999px;overflow:hidden;margin-top:6px}.todoBarFill{height:100%;background:linear-gradient(90deg,#49ff9f,#8f6cff);border-radius:999px}.todoChart{margin-top:18px}.todoChartTitle{font-size:13px;font-weight:1000;color:#fff;margin-bottom:8px}.barChart{height:130px;border-left:1px solid #28324f;border-bottom:1px solid #28324f;display:flex;align-items:end;gap:8px;padding:8px 8px 0 8px;background:linear-gradient(to top,rgba(255,255,255,.035) 1px,transparent 1px) 0 0/100% 25%}.chartCol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}.chartBar{width:100%;max-width:22px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#8f6cff,#26314f);min-height:2px}.chartLabel{font-size:10px;color:#9ca6c5;font-weight:900;margin-top:5px}.todoMain .table th:nth-child(1){width:58px}.todoMain .table th:nth-child(2){width:auto}.todoMain .table th:nth-child(3){width:160px}.todoMain .table th:nth-child(4){width:112px}.dragCell{width:34px;color:#64708f;font-weight:1000;cursor:grab;user-select:none;display:inline-block}.todoRow.dragging{opacity:.42}.todoRow.dropAbove{box-shadow:inset 0 2px 0 #8f6cff}.taskPill{display:inline-block;width:auto!important;max-width:min(720px,70vw);min-width:12ch;height:40px;border-radius:999px!important;padding:0 16px!important;background:#050711!important;border-color:#202946!important}.doneRow .taskPill{text-decoration:line-through;color:#777085!important}.todoMain table{table-layout:auto}.todoMain .taskText{white-space:nowrap}.todoMain .panelHead{margin-bottom:14px}@media(max-width:1000px){.todoLayout{grid-template-columns:1fr}.todoSide{position:static}}
    `;
    document.head.appendChild(s);
    document.head.appendChild(t);
  }

  function toMin(t){const p=String(t||'').slice(0,5).split(':').map(Number);return p[0]*60+p[1]}
  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function isCurrentVisibleDay(el,now){const today=ymd(now);if(el.dataset.date)return el.dataset.date===today;return !!el.closest('.todayCol')}
  function classify(el){
    const start=toMin(el.dataset.start),end=toMin(el.dataset.end),now=new Date(),nowMin=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
    let p=0,cls='time-neutral';
    if(!isCurrentVisibleDay(el,now)){p=0;cls='time-neutral'}else if(nowMin>=end){p=100;cls='time-past'}else if(nowMin<start){p=0;cls='time-future'}else{p=Math.max(0,Math.min(100,((nowMin-start)/(end-start))*100));cls='time-current'}
    el.classList.remove('time-past','time-current','time-future','time-neutral');el.classList.add(cls);el.style.setProperty('--time-progress',p.toFixed(1)+'%');
    let fill=el.querySelector(':scope > .liveProgressFill');
    if(cls==='time-current'){if(!fill){fill=document.createElement('div');fill.className='liveProgressFill';el.insertBefore(fill,el.firstChild)}fill.style.height=p.toFixed(1)+'%'}else if(fill){fill.remove()}
    const time=el.querySelector('.time'); if(time) delete time.dataset.progress;
  }
  function refreshProgress(){document.querySelectorAll('.event[data-start][data-end]').forEach(classify)}
  function patchEventRenderer(){
    const old=window.eventEl || (typeof eventEl==='function' ? eventEl : null);
    if(typeof old==='function'&&!window.__timeProgressPatchedV5){window.__timeProgressPatchedV5=true;eventEl=function(e){const el=old(e);el.dataset.date=e.date||el.dataset.date||'';el.dataset.start=e.start;el.dataset.end=e.end;setTimeout(()=>classify(el),0);return el};window.eventEl=eventEl}
    const oldRender=window.render || (typeof render==='function' ? render : null);
    if(typeof oldRender&&!window.__timeProgressRenderPatchedV5){window.__timeProgressRenderPatchedV5=true;render=function(){const out=oldRender.apply(this,arguments);setTimeout(refreshProgress,0);return out};window.render=render}
    setInterval(refreshProgress,15000);setTimeout(refreshProgress,100);
  }

  function patchTodo(){
    if(window.__todoUpgradePatched) return;
    window.__todoUpgradePatched=true;
    const days=['Today','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Later'];
    const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function pct(list){return list.length?Math.round(list.filter(t=>t.done).length/list.length*100):0}
    function esc2(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
    function ensureDates(){const now=new Date().toISOString();tasks.forEach(t=>{if(!t.createdAt)t.createdAt=now;if(t.done&&!t.completedAt)t.completedAt=now;if(!t.done&&t.completedAt)delete t.completedAt})}
    function dayHtml(){return days.map(d=>{const list=tasks.filter(t=>(t.day||'Today')===d),p=pct(list);return `<div class="todoDay"><div class="todoDayTop"><span>${d}</span><span>${p}%</span></div><div class="todoBar"><div class="todoBarFill" style="width:${p}%"></div></div></div>`}).join('')}
    function weeklyHtml(){return weekdays.map(d=>{const p=pct(tasks.filter(t=>(t.day||'Today')===d));return `<div class="chartCol"><div class="chartBar" style="height:${Math.max(2,p)}%"></div><div class="chartLabel">${d.slice(0,3)}</div></div>`}).join('')}
    function monthKey(dt){const d=new Date(dt||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
    function monthHtml(){const now=new Date(),months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:monthKey(d),label:monthNames[d.getMonth()]})}return months.map(m=>{const list=tasks.filter(t=>monthKey(t.completedAt||t.createdAt||Date.now())===m.key),p=pct(list);return `<div class="chartCol"><div class="chartBar" style="height:${Math.max(2,p)}%"></div><div class="chartLabel">${m.label}</div></div>`}).join('')}
    function saveTasks2(){ensureDates();localStorage.setItem('personalOS.tasks.v1',JSON.stringify(tasks));renderTasks();if(typeof renderProductivity==='function')renderProductivity()}
    window.saveTasks=saveTasks2;
    saveTasks=saveTasks2;
    window.renderTasks=renderTasks=function(){
      ensureDates();
      const panel=document.querySelector('#todoView .panel'); if(!panel)return;
      panel.innerHTML=`<div class="todoLayout"><aside class="todoSide"><div class="todoSideTitle">Daily progress</div>${dayHtml()}<div class="todoChart"><div class="todoChartTitle">Weekly completion</div><div class="barChart">${weeklyHtml()}</div></div><div class="todoChart"><div class="todoChartTitle">Month by month</div><div class="barChart">${monthHtml()}</div></div></aside><main class="todoMain"><div class="panelHead"><div><div class="panelTitle">To do list</div></div><button class="addBtn" id="addTask">+ TASK</button></div><table class="table"><thead><tr><th style="width:56px">Done</th><th>Task text</th><th style="width:150px">Day</th><th style="width:110px"></th></tr></thead><tbody id="taskBody"></tbody></table></main></div>`;
      const body=document.getElementById('taskBody');
      tasks.forEach(t=>{
        const tr=document.createElement('tr');tr.className='todoRow '+(t.done?'doneRow':'');tr.draggable=true;tr.dataset.id=t.id;
        const w=Math.max(12,Math.min(52,String(t.text||'').length+3));
        tr.innerHTML=`<td><input class="taskCheck" type="checkbox" ${t.done?'checked':''}></td><td class="taskText"><span class="dragCell" title="Drag to reorder">⋮⋮</span><input class="cellInput taskPill" style="width:${w}ch!important" value="${esc2(t.text||'')}"></td><td><select class="cellSelect">${days.map(d=>`<option>${d}</option>`).join('')}</select></td><td><button class="tinyBtn danger">DELETE</button></td>`;
        const check=tr.querySelector('.taskCheck'),text=tr.querySelector('.taskPill'),day=tr.querySelector('.cellSelect'),del=tr.querySelector('.danger');
        day.value=t.day||'Today';
        check.onchange=()=>{t.done=check.checked;if(t.done)t.completedAt=new Date().toISOString();else delete t.completedAt;saveTasks2()};
        text.oninput=()=>{text.style.width=Math.max(12,Math.min(52,text.value.length+3))+'ch'};
        text.onchange=()=>{t.text=text.value;saveTasks2()};
        day.onchange=()=>{t.day=day.value;saveTasks2()};
        del.onclick=()=>{tasks=tasks.filter(x=>x.id!==t.id);saveTasks2()};
        tr.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',t.id);tr.classList.add('dragging')});
        tr.addEventListener('dragend',()=>tr.classList.remove('dragging'));
        tr.addEventListener('dragover',e=>{e.preventDefault();tr.classList.add('dropAbove')});
        tr.addEventListener('dragleave',()=>tr.classList.remove('dropAbove'));
        tr.addEventListener('drop',e=>{e.preventDefault();tr.classList.remove('dropAbove');const from=e.dataTransfer.getData('text/plain'),to=t.id;if(!from||from===to)return;const moving=tasks.find(x=>x.id===from);tasks=tasks.filter(x=>x.id!==from);const idx=tasks.findIndex(x=>x.id===to);tasks.splice(idx,0,moving);saveTasks2()});
        body.appendChild(tr);
      });
      const add=document.getElementById('addTask');
      if(add)add.onclick=()=>{tasks.push({id:(typeof uid==='function'?uid():'t'+Date.now()),done:false,text:'New task',day:'Today',area:'Personal',createdAt:new Date().toISOString()});saveTasks2()};
    };
    renderTasks();
  }

  function applyPatch(){injectProgressStyles();patchEventRenderer();setTimeout(refreshProgress,300);setTimeout(patchTodo,350)}

  fetch(DATA_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{(0,eval)(code);applyPatch();if(typeof useData==='function')useData(window.LECTIO_DATA,'lectio')}).catch(()=>{window.LECTIO_DATA=window.LECTIO_DATA||{school:[],homework:[]};applyPatch();if(typeof useData==='function')useData(window.LECTIO_DATA,'fallback')});
})();
