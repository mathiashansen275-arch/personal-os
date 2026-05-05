// Loads the v5 Personal OS layer, then applies final stable navigation/schedule/progress fixes.
// UI patch version: details-fix-v6
(function(){
  const PREV_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/f47597a0f6bf97b975647c8239fd2deaecab9c82/lectio-data.js';
  const STATS_KEY='personalOS.todoStats.v2';
  let lastProgressSig='';
  let windAdjusted=false;

  function injectV6Style(){
    let style=document.getElementById('assistant-details-fix-v6');
    if(!style){
      style=document.createElement('style');
      style.id='assistant-details-fix-v6';
      document.head.appendChild(style);
    }
    style.textContent=`
      #revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.routine,#scheduleView .event.evening{display:none!important}
      #scheduleView .event{display:block!important;text-align:left!important;overflow:hidden!important}
      #scheduleView .event .time{display:block!important;text-align:left!important;font-weight:850!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{display:block!important;text-align:left!important;font-weight:800!important;line-height:1.12!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiShortBlock{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.aiTallBlock{display:block!important;justify-content:initial!important;align-items:initial!important;text-align:left!important}
      #scheduleView .event.aiCompact{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;padding-top:2px!important;padding-bottom:2px!important;text-align:left!important}
      #scheduleView .event.aiCompact .time{font-size:12px!important;text-align:left!important;display:block!important;width:100%!important;line-height:1!important;font-weight:850!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.homework{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.homework .time,#scheduleView .event.homework .title{font-size:12px!important;text-align:left!important;font-weight:800!important;display:block!important;width:100%!important}
      #scheduleView .event.wind{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.wind .time,#scheduleView .event.wind .title{text-align:left!important}
    `;
    document.head.appendChild(style);
  }

  function activeTabId(){
    const active=document.querySelector('.tab.active');
    return active&&active.getAttribute('data-tab')||'';
  }

  function applyNavVisibility(){
    document.body.classList.toggle('aiScheduleActive',activeTabId()==='scheduleView');
  }

  function parseTimeText(txt){
    const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    const start=Number(m[1])*60+Number(m[2]);
    const end=Number(m[3])*60+Number(m[4]);
    return {start,end,raw:m[0]};
  }

  function hm(mins){
    return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  }

  function normalizeScheduleBlocks(){
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const timeEl=el.querySelector('.time');
      const t=parseTimeText(timeEl&&timeEl.textContent);
      if(el.classList.contains('wind') && timeEl && t && !el.dataset.aiWindExtended){
        const nextEnd=t.end+5;
        timeEl.textContent=timeEl.textContent.replace(t.raw,hm(t.start)+'-'+hm(nextEnd));
        const h=parseFloat(el.style.height||'0');
        if(h)el.style.height=(h+(5*1.22))+'px';
        el.dataset.aiWindExtended='1';
      }
      const dur=t?t.end-t.start:null;
      el.classList.toggle('aiShortBlock',!!dur && dur<=45);
      el.classList.toggle('aiTallBlock',!!dur && dur>45);
      if(timeEl){timeEl.style.textAlign='left';timeEl.style.fontWeight='850'}
      const title=el.querySelector('.title');
      if(title){title.style.textAlign='left';title.style.fontWeight='800'}
    });
    windAdjusted=true;
  }

  function todayStart(){
    const d=new Date();
    return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  }

  function purgeFutureStats(){
    let stats={};
    try{stats=JSON.parse(localStorage.getItem(STATS_KEY)||'{}')||{}}catch(e){}
    let changed=false;
    const today=todayStart();
    Object.keys(stats).forEach(k=>{
      const d=new Date(k+'T00:00:00');
      if(d>today){delete stats[k];changed=true;}
    });
    if(changed)localStorage.setItem(STATS_KEY,JSON.stringify(stats));
  }

  function currentTaskCompletionPct(){
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const realRows=rows.filter(r=>{
      const input=r.querySelector('input[type=text],textarea,[contenteditable=true]');
      const text=((input&&('value' in input?input.value:input.textContent))||'').trim().toLowerCase();
      return text && text!=='new task';
    });
    if(!realRows.length)return 0;
    const done=realRows.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length;
    return Math.round(done/realRows.length*100);
  }

  function todayName(){
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  }

  function hardSetProgress(){
    purgeFutureStats();
    const side=document.querySelector('#todoView .todoSide');
    if(!side)return;
    const today=todayName();
    const todayPct=currentTaskCompletionPct();
    const sig=todayPct+'|'+Array.from(side.querySelectorAll('.todoDay')).map(c=>c.textContent).join('~');
    lastProgressSig=sig;
    Array.from(side.querySelectorAll('.todoDay')).forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      const isToday=/^Today/i.test(label)||new RegExp('^'+today+'\\b','i').test(label);
      const pct=isToday?todayPct:0;
      const top=card.querySelector('.todoDayTop');
      const fill=card.querySelector('.todoBarFill');
      if(top){const spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=pct+'%'}
      if(fill)fill.style.width=pct+'%';
    });
  }

  function removePurpleBreaks(){
    document.querySelectorAll('#scheduleView .event.break,#scheduleView .event.routine,#scheduleView .event.evening,#scheduleView .event.aiBreakHidden').forEach(el=>el.remove());
  }

  function applyV6(){
    injectV6Style();
    applyNavVisibility();
    normalizeScheduleBlocks();
    removePurpleBreaks();
    hardSetProgress();
  }

  document.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.tab'))setTimeout(applyV6,0);
    setTimeout(hardSetProgress,0);
    setTimeout(hardSetProgress,120);
  },true);
  document.addEventListener('change',function(){setTimeout(hardSetProgress,0);setTimeout(hardSetProgress,120)},true);

  function startV6(){
    applyV6();
    setTimeout(applyV6,0);
    setTimeout(applyV6,120);
    setTimeout(applyV6,500);
    const mo=new MutationObserver(function(){applyNavVisibility();removePurpleBreaks();normalizeScheduleBlocks();hardSetProgress();});
    mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    setInterval(applyV6,200);
  }

  fetch(PREV_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);startV6();})
    .catch(()=>startV6());
})();
