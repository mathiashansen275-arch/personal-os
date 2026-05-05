// Loads the newest stable Personal OS layer, then connects the local DeepSeek assistant and safe UI fixes.
// UI patch version: newest-stable-v2
(function(){
  const NEWEST_STABLE_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  const STATS_KEY='personalOS.todoStats.v2';
  const PX=1.22;
  let detailsLocked=false,left='',top='';

  function injectEarlyCss(){
    let s=document.getElementById('assistant-safe-fixes-newest-stable');
    if(!s){
      s=document.createElement('style');
      s.id='assistant-safe-fixes-newest-stable';
      document.head.appendChild(s);
    }
    s.textContent=`
      .app{position:relative!important}
      #aiCostBadge,.aiCostBadge{position:absolute!important;top:114px!important;right:24px!important;z-index:40!important;left:auto!important;bottom:auto!important;transform:none!important}
      #revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
      #scheduleView .event .aiDetailShow{display:none!important}
      #scheduleView .event.aiNeedsDetails .aiDetailShow{display:inline-flex!important;position:absolute!important;right:8px!important;top:4px!important;height:20px!important;min-height:20px!important;line-height:18px!important;width:auto!important;min-width:0!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important}
      #scheduleView .event{display:block!important;text-align:left!important;overflow:hidden!important}
      #scheduleView .event .time{display:block!important;text-align:left!important;font-weight:850!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{display:block!important;text-align:left!important;font-weight:800!important;line-height:1.12!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiShortBlock{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.aiTallBlock{display:block!important;text-align:left!important}
      #scheduleView .event.aiCompact{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;padding-top:2px!important;padding-bottom:2px!important;text-align:left!important}
      #scheduleView .event.aiCompact .time{font-size:12px!important;text-align:left!important;display:block!important;width:100%!important;line-height:1!important;font-weight:850!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.homework,#scheduleView .event.wind{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.homework .time,#scheduleView .event.wind .time{font-size:12px!important;text-align:left!important;font-weight:850!important;display:block!important;width:100%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;line-height:1!important}
      #scheduleView .event.homework .title,#scheduleView .event.wind .title{display:none!important}
      .aiDetailFloat{position:fixed!important;z-index:120!important;max-width:360px!important;font-size:13.5px!important;line-height:1.35!important;background:#100b1b!important;border:1px solid #7f52ff!important;border-radius:10px!important;padding:10px 12px!important;box-shadow:0 14px 38px rgba(0,0,0,.48)!important;color:#f7f3ff!important;pointer-events:auto!important;transform:none!important}
      .aiDetailFloat div{font-size:13.5px!important}
      .aiDetailFloatTitle{font-size:13.5px!important;font-weight:850!important;margin-bottom:4px!important}
    `;
    document.head.appendChild(s);
  }

  function activeTabId(){
    const active=document.querySelector('.tab.active');
    return active&&active.getAttribute('data-tab')||'';
  }

  function applyNavVisibility(){
    document.body.classList.toggle('aiScheduleActive',activeTabId()==='scheduleView');
  }

  function placeCostBadge(){
    const app=document.querySelector('.app');
    const badge=document.getElementById('aiCostBadge')||document.querySelector('.aiCostBadge');
    if(app&&badge&&badge.parentElement!==app)app.appendChild(badge);
    if(badge){
      badge.style.position='absolute';
      badge.style.top='114px';
      badge.style.right='24px';
      badge.style.left='auto';
      badge.style.bottom='auto';
      badge.style.transform='none';
      badge.style.zIndex='40';
    }
  }

  function parseTime(txt){
    const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    return {start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),raw:m[0]};
  }

  function hm(x){return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')}

  function cleanHomeworkTitle(txt){
    return String(txt||'').replace(/^\s*2i\s+/i,'').replace(/\s+/g,' ').trim();
  }

  function textFits(node,text,reserve){
    if(!node||!text)return true;
    const p=document.createElement('span');
    const cs=getComputedStyle(node);
    p.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:'+cs.font+';letter-spacing:'+cs.letterSpacing+';left:-9999px;top:-9999px';
    p.textContent=text;
    document.body.appendChild(p);
    const ok=p.getBoundingClientRect().width<=Math.max(0,node.getBoundingClientRect().width-(reserve||0)-2);
    p.remove();
    return ok;
  }

  function isAvailableBlock(el){
    const title=((el.querySelector('.title')||{}).textContent||'').trim();
    return /^available block$/i.test(title)||el.classList.contains('aiFreeHidden')||((el.classList.contains('focus')||el.classList.contains('deep'))&&!el.classList.contains('business')&&!el.classList.contains('personal'));
  }

  function markDetails(el){
    const btn=el.querySelector('.aiDetailShow');
    const title=el.querySelector('.title');
    const time=el.querySelector('.time');
    if(!btn||!title){el.classList.remove('aiNeedsDetails');return;}
    const full=(el.dataset.aiFullTitle||title.textContent||'').trim();
    const protectedTitle=/^(morning routine|evening routine|wind down)$/i.test(full);
    const protectedType=el.classList.contains('school')||el.classList.contains('homework')||el.classList.contains('wind');
    const needs=!!full&&!protectedTitle&&!protectedType&&!textFits(title,full,86);
    el.classList.toggle('aiNeedsDetails',needs);
    if(!needs)btn.textContent='DETAILS';
    if(time)time.style.paddingRight=needs?'82px':'';
  }

  function normalizeDay(day){
    const all=Array.from(day.querySelectorAll('.event'));
    all.forEach(el=>{if(el.classList.contains('break')||el.classList.contains('aiBreakHidden')||isAvailableBlock(el))el.remove();});
    const events=Array.from(day.querySelectorAll('.event')).filter(el=>!isAvailableBlock(el));
    const rows=[];
    events.forEach(el=>{
      const time=el.querySelector('.time');
      if(!time)return;
      if(!el.dataset.safeBaseTime)el.dataset.safeBaseTime=time.textContent;
      if(!el.dataset.safeBaseTop)el.dataset.safeBaseTop=el.style.top||'0px';
      if(!el.dataset.safeBaseHeight)el.dataset.safeBaseHeight=el.style.height||'0px';
      const t=parseTime(el.dataset.safeBaseTime);
      if(t)rows.push({el,t});
    });
    const windEnds=rows.filter(r=>r.el.classList.contains('wind')).map(r=>r.t.end).sort((a,b)=>a-b);
    rows.forEach(r=>{
      const el=r.el,time=el.querySelector('.time'),title=el.querySelector('.title');
      const shift=windEnds.filter(end=>end<=r.t.start).length*5;
      const start=r.t.start+shift;
      const end=r.t.end+shift+(el.classList.contains('wind')?5:0);
      let label=String(el.dataset.safeBaseTime).replace(r.t.raw,hm(start)+'-'+hm(end));
      if(el.classList.contains('wind'))label=hm(start)+'-'+hm(end)+' Wind down';
      if(el.classList.contains('homework')){
        const full=cleanHomeworkTitle(el.dataset.aiFullTitle||title&&title.textContent||'Homework');
        if(title){title.textContent=full;el.dataset.aiFullTitle=full;}
        label=hm(start)+'-'+hm(end)+' '+full;
      }
      time.textContent=label;
      const baseTop=parseFloat(el.dataset.safeBaseTop||'0')||0;
      const baseHeight=parseFloat(el.dataset.safeBaseHeight||'0')||0;
      el.style.top=(baseTop+shift*PX)+'px';
      if(el.classList.contains('wind')&&baseHeight)el.style.height=(baseHeight+5*PX)+'px';
      const dur=end-start;
      el.classList.toggle('aiShortBlock',dur<=45);
      el.classList.toggle('aiTallBlock',dur>45);
      if(time){time.style.textAlign='left';time.style.fontWeight='850';time.style.whiteSpace='nowrap';}
      if(title){title.style.textAlign='left';title.style.fontWeight='800'}
      markDetails(el);
    });
  }

  function normalizeSchedule(){
    document.querySelectorAll('#scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden').forEach(el=>el.remove());
    document.querySelectorAll('#scheduleView .event').forEach(el=>{if(isAvailableBlock(el))el.remove();});
    document.querySelectorAll('#scheduleView .day').forEach(normalizeDay);
  }

  function todayStart(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
  function purgeFutureStats(){
    let stats={};try{stats=JSON.parse(localStorage.getItem(STATS_KEY)||'{}')||{}}catch(e){}
    const today=todayStart();let changed=false;
    Object.keys(stats).forEach(k=>{const d=new Date(k+'T00:00:00');if(d>today){delete stats[k];changed=true}});
    if(changed)localStorage.setItem(STATS_KEY,JSON.stringify(stats));
  }
  function currentPct(){
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const real=rows.filter(r=>{const i=r.querySelector('input[type=text],textarea,[contenteditable=true]');const txt=((i&&('value' in i?i.value:i.textContent))||'').trim().toLowerCase();return txt&&txt!=='new task'});
    if(!real.length)return 0;
    return Math.round(real.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length/real.length*100);
  }
  function todayName(){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]}
  function hardSetProgress(){
    purgeFutureStats();
    const side=document.querySelector('#todoView .todoSide');if(!side)return;
    const name=todayName(),pct=currentPct();
    Array.from(side.querySelectorAll('.todoDay')).forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      const isToday=/^Today/i.test(label)||new RegExp('^'+name+'\\b','i').test(label);
      const p=isToday?pct:0;
      const topEl=card.querySelector('.todoDayTop'),fill=card.querySelector('.todoBarFill');
      if(topEl){const spans=topEl.querySelectorAll('span');if(spans[1])spans[1].textContent=p+'%'}
      if(fill)fill.style.width=p+'%';
    });
  }

  function lockDetail(){
    const box=document.getElementById('aiDetailFloat');if(!box)return;
    if(!left||!top){const r=box.getBoundingClientRect();left=Math.round(r.left)+'px';top=Math.round(r.top)+'px'}
    box.style.position='fixed';box.style.left=left;box.style.top=top;detailsLocked=true;
  }
  function restoreDetail(){const box=document.getElementById('aiDetailFloat');if(box&&detailsLocked){box.style.position='fixed';box.style.left=left;box.style.top=top}}

  function applySafeFixes(){injectEarlyCss();applyNavVisibility();placeCostBadge();normalizeSchedule();hardSetProgress();restoreDetail()}

  function loadLocalAssistant(){
    if(document.getElementById('aiChatButton'))return;
    const s=document.createElement('script');
    s.src='./assistant.js?v='+Date.now();
    s.async=false;
    document.head.appendChild(s);
  }

  purgeFutureStats();
  injectEarlyCss();
  document.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.tab'))setTimeout(applySafeFixes,0);
    if(e.target.closest&&e.target.closest('.aiDetailShow')){detailsLocked=false;left='';top='';setTimeout(lockDetail,0);setTimeout(lockDetail,80)}
    setTimeout(hardSetProgress,0);setTimeout(hardSetProgress,50);setTimeout(hardSetProgress,150);
  },true);
  document.addEventListener('change',function(){setTimeout(hardSetProgress,0);setTimeout(hardSetProgress,50);setTimeout(hardSetProgress,150)},true);
  window.addEventListener('scroll',restoreDetail,true);
  window.addEventListener('resize',function(){detailsLocked=false;left='';top='';applySafeFixes()});

  function bootAfterNewestLayer(){
    loadLocalAssistant();
    applySafeFixes();
    setTimeout(applySafeFixes,100);
    setTimeout(applySafeFixes,400);
    setTimeout(applySafeFixes,1000);
    const side=document.querySelector('#todoView .todoSide');
    if(side)new MutationObserver(hardSetProgress).observe(side,{childList:true,subtree:true,characterData:true});
    setInterval(function(){applyNavVisibility();placeCostBadge();hardSetProgress();restoreDetail()},100);
    setInterval(applySafeFixes,1500);
  }

  fetch(NEWEST_STABLE_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);bootAfterNewestLayer()})
    .catch(()=>{loadLocalAssistant();bootAfterNewestLayer()});
})();
