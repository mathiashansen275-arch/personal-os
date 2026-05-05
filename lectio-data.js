// Loads the newest stable Personal OS layer, then applies stable small-block layout without jitter.
// UI patch version: newest-stable-v5
(function(){
  const BASE_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  const STATE_KEY='personalOS.schedule.v5';
  const STATS_KEY='personalOS.todoStats.v2';
  const PX=1.22;
  let appliedHash='';
  let raf=0;

  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  const TODAY=ymd(new Date());

  function cleanupTodayTaskBlocks(){
    try{
      const state=JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};
      if(!Array.isArray(state.custom))return;
      const before=state.custom.length;
      state.custom=state.custom.filter(b=>{
        if(b.date!==TODAY)return true;
        const type=String(b.type||'').toLowerCase();
        const title=String(b.title||'').toLowerCase();
        if(type==='school'||type==='routine'||type==='evening'||type==='wind'||type==='work')return true;
        if(/morning routine|evening routine|wind down/.test(title))return true;
        return false;
      });
      if(state.custom.length!==before)localStorage.setItem(STATE_KEY,JSON.stringify(state));
    }catch(e){}
  }

  function injectCss(){
    let s=document.getElementById('assistant-stable-v5-fixes');
    if(!s){s=document.createElement('style');s.id='assistant-stable-v5-fixes';document.head.appendChild(s)}
    s.textContent=`
      #revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
      #scheduleView .event .aiDetailShow{display:none!important}
      #scheduleView .event.aiNeedsDetails .aiDetailShow{display:inline-flex!important;position:absolute!important;right:8px!important;top:4px!important;height:20px!important;min-height:20px!important;line-height:18px!important;width:auto!important;min-width:0!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important}
      #scheduleView .event .time{font-weight:850!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{font-weight:800!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiOneLineSmall{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important;padding-top:1px!important;padding-bottom:1px!important}
      #scheduleView .event.aiOneLineSmall .time{display:block!important;width:100%!important;max-width:100%!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;font-size:11.5px!important;line-height:1!important;font-weight:850!important;padding-right:0!important;letter-spacing:-.015em!important}
      #scheduleView .event.aiOneLineSmall .title{display:none!important}
      #scheduleView .event.aiTallBlock{display:block!important;text-align:left!important}
      #scheduleView .event.homework .title,#scheduleView .event.wind .title{display:none!important}
      #scheduleView .event.homework .time,#scheduleView .event.wind .time{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;font-size:11.5px!important;letter-spacing:-.015em!important;line-height:1!important}
      #aiCostBadge,.aiCostBadge{position:absolute!important;top:114px!important;right:24px!important;left:auto!important;bottom:auto!important;transform:none!important;z-index:40!important}
      .app{position:relative!important}
    `;
    document.head.appendChild(s);
  }

  function activeTabId(){const active=document.querySelector('.tab.active');return active&&active.getAttribute('data-tab')||''}
  function applyNav(){document.body.classList.toggle('aiScheduleActive',activeTabId()==='scheduleView')}
  function placeCost(){const app=document.querySelector('.app'),badge=document.getElementById('aiCostBadge')||document.querySelector('.aiCostBadge');if(app&&badge&&badge.parentElement!==app)app.appendChild(badge)}
  function parseTime(txt){const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);return m?{start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),raw:m[0]}:null}
  function hm(x){return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')}
  function cleanTitle(text){return String(text||'').replace(/^\s*2i\s+/i,'').replace(/^\s*available block\s*$/i,'').replace(/\s+/g,' ').trim()}
  function isAvailable(el){const title=cleanTitle((el.querySelector('.title')||{}).textContent||'');return /^available block$/i.test(title)||el.classList.contains('aiFreeHidden')||((el.classList.contains('focus')||el.classList.contains('deep'))&&!el.classList.contains('business')&&!el.classList.contains('personal'))}

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

  function markDetails(el){
    const btn=el.querySelector('.aiDetailShow'),title=el.querySelector('.title'),time=el.querySelector('.time');
    if(!btn||!title){el.classList.remove('aiNeedsDetails');return}
    const full=cleanTitle(el.dataset.aiFullTitle||title.textContent||'');
    const protectedType=el.classList.contains('school')||el.classList.contains('homework')||el.classList.contains('wind');
    const protectedTitle=/^(morning routine|evening routine|wind down)$/i.test(full);
    const needs=!!full&&!protectedType&&!protectedTitle&&!textFits(title,full,86);
    el.classList.toggle('aiNeedsDetails',needs);
    if(!needs)btn.textContent='DETAILS';
    if(time)time.style.paddingRight=needs?'82px':'';
  }

  function normalizeDay(day){
    Array.from(day.querySelectorAll('.event')).forEach(el=>{if(el.classList.contains('break')||el.classList.contains('aiBreakHidden')||isAvailable(el))el.remove()});
    const rows=[];
    day.querySelectorAll('.event').forEach(el=>{
      const time=el.querySelector('.time');
      if(!time)return;
      if(!el.dataset.stableBaseTime)el.dataset.stableBaseTime=time.textContent;
      if(!el.dataset.stableBaseTop)el.dataset.stableBaseTop=el.style.top||'0px';
      if(!el.dataset.stableBaseHeight)el.dataset.stableBaseHeight=el.style.height||'0px';
      const t=parseTime(el.dataset.stableBaseTime);
      if(t)rows.push({el,t});
    });
    const windEnds=rows.filter(r=>r.el.classList.contains('wind')).map(r=>r.t.end).sort((a,b)=>a-b);
    rows.forEach(r=>{
      const el=r.el,time=el.querySelector('.time'),titleEl=el.querySelector('.title');
      const shift=windEnds.filter(end=>end<=r.t.start).length*5;
      const start=r.t.start+shift;
      const end=r.t.end+shift+(el.classList.contains('wind')?5:0);
      const dur=end-start;
      let title=cleanTitle(el.dataset.stableBaseTitle||(titleEl&&titleEl.textContent)||'');
      if(titleEl&&!el.dataset.stableBaseTitle)el.dataset.stableBaseTitle=title;
      if(el.classList.contains('wind'))title='Wind down';
      if(el.classList.contains('homework'))title=cleanTitle(title||'Homework');
      const newTimeText=(dur<=30||el.classList.contains('homework')||el.classList.contains('wind'))?(hm(start)+'-'+hm(end)+' '+title):String(el.dataset.stableBaseTime).replace(r.t.raw,hm(start)+'-'+hm(end));
      if(time.textContent!==newTimeText)time.textContent=newTimeText;
      const newTop=((parseFloat(el.dataset.stableBaseTop||'0')||0)+shift*PX)+'px';
      if(el.style.top!==newTop)el.style.top=newTop;
      if(el.classList.contains('wind')){
        const baseHeight=parseFloat(el.dataset.stableBaseHeight||'0')||0;
        if(baseHeight){const h=(baseHeight+5*PX)+'px';if(el.style.height!==h)el.style.height=h;}
      }
      el.classList.toggle('aiOneLineSmall',dur<=30||el.classList.contains('homework')||el.classList.contains('wind'));
      el.classList.toggle('aiTallBlock',dur>45&&!el.classList.contains('homework')&&!el.classList.contains('wind'));
      if(titleEl){titleEl.textContent=title;titleEl.style.fontWeight='800';if(dur<=30||el.classList.contains('homework')||el.classList.contains('wind'))titleEl.style.display='none';}
      if(time){time.style.fontWeight='850';time.style.textAlign='left';}
      markDetails(el);
    });
  }

  function hardProgressZeroFuture(){
    const side=document.querySelector('#todoView .todoSide');if(!side)return;
    const today=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const real=rows.filter(r=>{const i=r.querySelector('input[type=text],textarea,[contenteditable=true]');const txt=((i&&('value'in i?i.value:i.textContent))||'').trim().toLowerCase();return txt&&txt!=='new task'});
    const pct=real.length?Math.round(real.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length/real.length*100):0;
    side.querySelectorAll('.todoDay').forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      const isToday=/^Today/i.test(label)||new RegExp('^'+today+'\\b','i').test(label);
      const p=isToday?pct:0;
      const top=card.querySelector('.todoDayTop'),fill=card.querySelector('.todoBarFill');
      if(top){const spans=top.querySelectorAll('span');if(spans[1]&&spans[1].textContent!==p+'%')spans[1].textContent=p+'%'}
      if(fill&&fill.style.width!==p+'%')fill.style.width=p+'%';
    });
  }

  function domHash(){
    return Array.from(document.querySelectorAll('#scheduleView .event')).map(el=>[(el.querySelector('.time')||{}).textContent,(el.querySelector('.title')||{}).textContent,el.className,el.style.top,el.style.height].join('|')).join('~')+'::'+Array.from(document.querySelectorAll('#todoView input[type=checkbox]')).map(cb=>cb.checked?'1':'0').join('');
  }

  function apply(force){
    injectCss();applyNav();placeCost();
    const h=domHash();
    if(force||h!==appliedHash){document.querySelectorAll('#scheduleView .day').forEach(normalizeDay);appliedHash=domHash();}
    hardProgressZeroFuture();
  }

  function schedule(force){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply(force)})}

  cleanupTodayTaskBlocks();
  injectCss();
  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{
    (0,eval)(code);
    cleanupTodayTaskBlocks();
    try{if(typeof render==='function')render()}catch(e){}
    schedule(true);setTimeout(()=>schedule(true),100);setTimeout(()=>schedule(true),500);
    const root=document.getElementById('scheduleView')||document.body;
    new MutationObserver(()=>schedule(false)).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});
    setInterval(()=>{applyNav();placeCost();hardProgressZeroFuture()},300);
  }).catch(()=>{schedule(true);setInterval(()=>{applyNav();placeCost();hardProgressZeroFuture()},300)});
})();
