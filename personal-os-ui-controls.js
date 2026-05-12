// Personal OS UI controls only: hide cloud buttons, restore week nav, place schedule icon.
(function(){
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function monday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
  function currentMondaySafe(){try{if(currentMonday instanceof Date)return new Date(currentMonday)}catch(e){}try{if(window.currentMonday instanceof Date)return new Date(window.currentMonday)}catch(e){}return monday(new Date())}
  function setMonday(d){try{currentMonday=d}catch(e){}try{window.currentMonday=d}catch(e){}try{if(typeof render==='function')render()}catch(e){}}
  function toastMsg(msg){try{if(typeof toast==='function'){toast(msg);return}}catch(e){}console.log(msg)}
  function style(){
    if(document.getElementById('pos-ui-controls-style'))return;
    const s=document.createElement('style');
    s.id='pos-ui-controls-style';
    s.textContent='#posCloudControls,#posCloudUpload,#posCloudDownload{display:none!important;visibility:hidden!important;pointer-events:none!important}body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today,body:not(.aiScheduleActive) #posWeekNav{display:none!important}body.aiScheduleActive #prev,body.aiScheduleActive #next,body.aiScheduleActive #today{display:inline-flex!important;visibility:visible!important;pointer-events:auto!important}body.aiScheduleActive #posWeekNav{display:flex!important}#posWeekNav{gap:8px;align-items:center;margin-left:auto}#posWeekNav button{height:40px;border-radius:10px;border:1px solid #202946;background:#050711;color:#fff;font-weight:1000;font-size:12px;padding:0 13px;letter-spacing:.06em;cursor:pointer;pointer-events:auto}#todoView .panelHead #posAllocateTasks{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:34px!important;height:32px!important;margin-left:8px!important;vertical-align:middle!important;border-radius:9px!important;border:1px solid #26314f!important;background:linear-gradient(180deg,#111a38,#070912)!important;color:#fff!important;font-weight:1000!important;font-size:17px!important;line-height:1!important;padding:0!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;top:-1px!important}#todoView .panelTitle{display:inline-flex!important;align-items:center!important;vertical-align:middle!important}';
    document.head.appendChild(s);
  }
  function scheduleActive(){const a=document.querySelector('.tab.active');const v=document.getElementById('scheduleView');document.body.classList.toggle('aiScheduleActive',!!((a&&/schedule/i.test(a.textContent||''))||(v&&v.offsetParent!==null)))}
  function weekNav(){
    if(document.getElementById('prev')&&document.getElementById('next')&&document.getElementById('today'))return;
    if(document.getElementById('posWeekNav'))return;
    const top=document.querySelector('.topbar')||document.querySelector('.nav')||document.body;
    const w=document.createElement('div');
    w.id='posWeekNav';
    w.innerHTML='<button id="posPrevWeek" type="button">← WEEK</button><button id="posTodayWeek" type="button">TODAY</button><button id="posNextWeek" type="button">WEEK →</button>';
    top.appendChild(w);
    document.getElementById('posPrevWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(addDays(currentMondaySafe(),-7))};
    document.getElementById('posTodayWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(monday(new Date()))};
    document.getElementById('posNextWeek').onclick=e=>{e.preventDefault();e.stopPropagation();setMonday(addDays(currentMondaySafe(),7))};
  }
  function icon(){
    const title=[...document.querySelectorAll('#todoView .panelTitle')].find(el=>/to do list/i.test(el.textContent||''));
    if(!title)return;
    let b=document.getElementById('posAllocateTasks');
    if(!b){
      b=document.createElement('button');
      b.id='posAllocateTasks';
      b.type='button';
      b.title='Schedule tasks';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();if(typeof window.personalOSUpdateSchedule==='function'){const n=window.personalOSUpdateSchedule();toastMsg(n?'Updated schedule: '+n+' block'+(n===1?'':'s'):'No free time found for those tasks')}else toastMsg('Schedule allocator is not ready yet')};
      title.insertAdjacentElement('afterend',b);
    }
    b.textContent='↻';
  }
  function tick(){style();document.querySelectorAll('#posCloudControls,#posCloudUpload,#posCloudDownload').forEach(x=>x.remove());scheduleActive();weekNav();icon()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,700);
})();

// Early chat capture: explicit past reflow commands must not be blocked by the AI layer.
(function(){
  const STATE_KEY='personalOS.schedule.v5';
  const UNDO_KEY='personalOS.schedule.undo.v1';
  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(m%60)}
  function mins(s){const m=String(s||'00:00').match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function stateObj(){const s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function saveState(s){write(STATE_KEY,s);try{window.state=s}catch(e){}try{state=s}catch(e){}try{if(typeof render==='function')render()}catch(e){}setTimeout(()=>{try{if(typeof window.personalOSInjectDetails==='function')window.personalOSInjectDetails()}catch(e){}},0)}
  function snap(){write(UNDO_KEY,{state:stateObj(),savedAt:new Date().toISOString()})}
  function say(text){const box=document.getElementById('aiChatMessages');if(!box)return;const d=document.createElement('div');d.className='aiMsg assistant';d.textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight}
  function parseTime(text){let m=text.match(/\b(?:at|to|from|start(?:ing)?(?:\s+at)?|first\s+(?:one\s+)?(?:is\s+)?at)\s+(\d{1,2})(?:[.:](\d{2}))?\b/i);if(!m)m=text.match(/\b(\d{1,2})[.:](\d{2})\b/);return m?Number(m[1])*60+Number(m[2]||0):null}
  function moveTodaySequence(text){
    if(!/\b(move|shift|put|start|starting)\b/i.test(text)||!/\b(all|tasks|first)\b/i.test(text))return null;
    const start=parseTime(text);if(start==null)return null;
    const s=stateObj(),date=ymd(new Date());
    const blocks=(s.custom||[]).filter(b=>b&&b.aiCreated&&!b.aiDone&&b.date===date).sort((a,b)=>mins(a.start)-mins(b.start));
    if(!blocks.length)return 'I could not find generated tasks for today to move.';
    snap();let cursor=start;
    blocks.forEach(b=>{const dur=Math.max(15,mins(b.end)-mins(b.start));b.start=hm(cursor);b.end=hm(cursor+dur);cursor+=dur});
    saveState(s);
    return 'Moved today\'s generated tasks so the first starts at '+hm(start)+'. Past times are allowed because you explicitly requested it.';
  }
  function intercept(e){const input=document.getElementById('aiChatInput');if(!input)return;const text=(input.value||'').trim();if(!text)return;const result=moveTodaySequence(text);if(!result)return;input.value='';e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();const box=document.getElementById('aiChatMessages');if(box){const u=document.createElement('div');u.className='aiMsg user';u.textContent=text;box.appendChild(u)}say(result)}
  function install(){window.personalOSEarlyPastReflowVersion='early-past-reflow-v1';const b=document.getElementById('aiChatSend');if(b&&!b.dataset.earlyPastReflow){b.dataset.earlyPastReflow='1';b.addEventListener('click',intercept,true)}const i=document.getElementById('aiChatInput');if(i&&!i.dataset.earlyPastReflow){i.dataset.earlyPastReflow='1';i.addEventListener('keydown',e=>{if(e.key==='Enter')intercept(e)},true)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,500);
})();
