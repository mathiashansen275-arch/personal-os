// Loads the newest stable Personal OS layer, then applies stable no-overlap layout and locked AI task blocks.
// UI patch version: newest-stable-v11
(function(){
  const BASE_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  const STATE_KEY='personalOS.schedule.v5';
  const PX=1.22;
  const GAP_PX=5;
  let appliedHash='';
  let raf=0;

  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  const TODAY=ymd(new Date());

  function cleanupInvalidTaskBlocks(){
    try{
      const state=JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};
      if(!Array.isArray(state.custom))return;
      const before=state.custom.length;
      state.custom=state.custom.filter(b=>{
        const type=String(b.type||'').toLowerCase();
        const title=String(b.title||'').toLowerCase();
        if(type==='school'||type==='routine'||type==='evening'||type==='wind'||type==='work')return true;
        if(/morning routine|evening routine|wind down/.test(title))return true;
        if(b.date===TODAY)return false;
        const s=String(b.start||'00:00');
        const mins=Number(s.slice(0,2))*60+Number(s.slice(3,5));
        return mins>=14*60+45;
      });
      state.custom.forEach(b=>{
        const title=String(b.title||'').toLowerCase();
        if(/evening routine|wind down/.test(title)&&b.start&&b.end){
          const sm=Number(String(b.start).slice(0,2))*60+Number(String(b.start).slice(3,5));
          b.end=String(Math.floor((sm+30)/60)).padStart(2,'0')+':'+String((sm+30)%60).padStart(2,'0');
        }
      });
      if(state.custom.length!==before)localStorage.setItem(STATE_KEY,JSON.stringify(state));
    }catch(e){}
  }

  function injectCss(){
    let s=document.getElementById('assistant-stable-v11-fixes');
    if(!s){s=document.createElement('style');s.id='assistant-stable-v11-fixes';document.head.appendChild(s)}
    s.textContent=`
      #addBlock{display:none!important}
      #revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
      #scheduleView .event.aiLockedGenerated{cursor:default!important}
      #scheduleView .event.aiLockedGenerated .aiDetailShow{pointer-events:auto!important}
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
      .aiDetailFloat{font-size:13.5px!important;line-height:1.35!important;max-width:420px!important}
      .aiDetailFloat div{font-size:13.5px!important}
      .aiDetailFloatTitle{font-size:13px!important;font-weight:900!important}
      #aiCostBadge,.aiCostBadge{position:absolute!important;top:114px!important;right:24px!important;left:auto!important;bottom:auto!important;transform:none!important;z-index:40!important;display:flex!important}
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
  function looksGenerated(el){const title=cleanTitle((el.querySelector('.title')||{}).textContent||'');return el.classList.contains('aiNeedsDetails')||el.querySelector('.aiDetailShow')||/grouped tasks| pt\. \d+$/i.test(title)||(el.classList.contains('personal')&&!/buy lisa|tok commentary/i.test(title))||(el.classList.contains('business')&&!/work/i.test(title))}

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

  function ensureDetailButton(el){
    let btn=el.querySelector('.aiDetailShow');
    if(!btn){
      btn=document.createElement('button');
      btn.className='aiDetailShow';
      btn.textContent='DETAILS';
      btn.onclick=function(ev){ev.stopPropagation();showSyntheticDetails(el,btn)};
      el.appendChild(btn);
    }
    return btn;
  }

  function showSyntheticDetails(el,btn){
    const old=document.getElementById('aiDetailFloat');
    if(old){old.remove();if(btn&&btn.textContent==='HIDE'){btn.textContent='DETAILS';return}}
    document.querySelectorAll('.aiDetailShow').forEach(b=>b.textContent='DETAILS');
    const box=document.createElement('div');
    box.id='aiDetailFloat';box.className='aiDetailFloat';
    const title=document.createElement('div');title.className='aiDetailFloatTitle';title.textContent='Full task';box.appendChild(title);
    const txt=(el.dataset.aiFullTitle||el.dataset.stableBaseTitle||((el.querySelector('.title')||{}).textContent)||'Task details').trim();
    const details=(el.dataset.aiTaskTexts||txt).split('||').filter(Boolean);
    details.forEach(x=>{const d=document.createElement('div');d.textContent='• '+x;box.appendChild(d)});
    document.body.appendChild(box);
    const r=el.getBoundingClientRect();box.style.left=Math.min(window.innerWidth-430,Math.max(8,r.left+6))+'px';box.style.top=Math.min(window.innerHeight-180,Math.max(8,r.bottom+6))+'px';
    if(btn)btn.textContent='HIDE';
  }

  function markDetails(el){
    const title=el.querySelector('.title'),time=el.querySelector('.time');
    if(!title){el.classList.remove('aiNeedsDetails');return}
    const full=cleanTitle(el.dataset.aiFullTitle||el.dataset.stableBaseTitle||title.textContent||'');
    const protectedType=el.classList.contains('school')||el.classList.contains('homework')||el.classList.contains('wind');
    const protectedTitle=/^(morning routine|evening routine|wind down)$/i.test(full);
    const grouped=/grouped tasks/i.test(full)||/ & /.test(full)||el.dataset.aiTaskTexts;
    const needs=!!full&&!protectedType&&!protectedTitle&&(grouped||!textFits(title,full,86));
    if(needs)ensureDetailButton(el);
    el.classList.toggle('aiNeedsDetails',needs);
    const btn=el.querySelector('.aiDetailShow');
    if(btn&&!needs)btn.textContent='DETAILS';
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
    rows.sort((a,b)=>a.t.start-b.t.start || a.t.end-b.t.end);
    let lastEnd=0;
    let lastBottomPx=-GAP_PX;
    rows.forEach(r=>{
      const el=r.el,time=el.querySelector('.time'),titleEl=el.querySelector('.title');
      let start=Math.max(r.t.start,lastEnd);
      let end=r.t.end;
      let duration=end-r.t.start;
      if(el.classList.contains('wind'))duration=30;
      if(duration<1)duration=1;
      end=start+duration;
      lastEnd=end;
      let title=cleanTitle(el.dataset.stableBaseTitle||(titleEl&&titleEl.textContent)||'');
      if(titleEl&&!el.dataset.stableBaseTitle)el.dataset.stableBaseTitle=title;
      if(el.classList.contains('wind'))title='Wind down';
      if(el.classList.contains('homework'))title=cleanTitle(title||'Homework');
      const oneLine=end-start<=30||el.classList.contains('homework')||el.classList.contains('wind');
      const newTimeText=oneLine?(hm(start)+'-'+hm(end)+' '+title):String(el.dataset.stableBaseTime).replace(r.t.raw,hm(start)+'-'+hm(end));
      if(time.textContent!==newTimeText)time.textContent=newTimeText;
      const baseTop=parseFloat(el.dataset.stableBaseTop||'0')||0;
      const naturalTop=baseTop+(start-r.t.start)*PX;
      const shiftedTop=Math.max(naturalTop,lastBottomPx+GAP_PX);
      const newTop=shiftedTop+'px';
      if(el.style.top!==newTop)el.style.top=newTop;
      const newHeight=(duration*PX)+'px';
      const baseHeight=parseFloat(el.dataset.stableBaseHeight||'0')||0;
      if(baseHeight && (el.classList.contains('wind')||start!==r.t.start||shiftedTop!==naturalTop) && el.style.height!==newHeight)el.style.height=newHeight;
      lastBottomPx=shiftedTop+duration*PX;
      el.classList.toggle('aiOneLineSmall',oneLine);
      el.classList.toggle('aiTallBlock',end-start>45&&!el.classList.contains('homework')&&!el.classList.contains('wind'));
      el.classList.toggle('aiLockedGenerated',looksGenerated(el));
      if(titleEl){titleEl.textContent=title;titleEl.style.fontWeight='800';if(oneLine)titleEl.style.display='none';}
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

  function closeDetails(){const f=document.getElementById('aiDetailFloat');if(f){f.remove();document.querySelectorAll('.aiDetailShow').forEach(b=>b.textContent='DETAILS')}}
  function domHash(){return Array.from(document.querySelectorAll('#scheduleView .event')).map(el=>[(el.querySelector('.time')||{}).textContent,(el.querySelector('.title')||{}).textContent,el.className,el.style.top,el.style.height].join('|')).join('~')+'::'+Array.from(document.querySelectorAll('#todoView input[type=checkbox]')).map(cb=>cb.checked?'1':'0').join('')}
  function apply(force){injectCss();applyNav();placeCost();const h=domHash();if(force||h!==appliedHash){document.querySelectorAll('#scheduleView .day').forEach(normalizeDay);appliedHash=domHash();}hardProgressZeroFuture()}
  function schedule(force){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply(force)})}
  function loadAssistant(){if(document.getElementById('aiChatButton'))return;const s=document.createElement('script');s.src='./assistant.js?v='+Date.now();s.async=false;document.head.appendChild(s)}

  cleanupInvalidTaskBlocks();injectCss();
  document.addEventListener('click',function(e){const ev=e.target&&e.target.closest&&e.target.closest('#scheduleView .event.aiLockedGenerated');if(ev&&!e.target.closest('.aiDetailShow')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}},true);
  document.addEventListener('dblclick',function(e){const ev=e.target&&e.target.closest&&e.target.closest('#scheduleView .event.aiLockedGenerated');if(ev){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}},true);
  window.addEventListener('scroll',closeDetails,true);
  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{(0,eval)(code);loadAssistant();cleanupInvalidTaskBlocks();try{if(typeof render==='function')render()}catch(e){}schedule(true);setTimeout(()=>{loadAssistant();schedule(true);placeCost()},100);setTimeout(()=>{loadAssistant();schedule(true);placeCost()},500);setTimeout(()=>{loadAssistant();placeCost()},1200);const root=document.getElementById('scheduleView')||document.body;new MutationObserver(()=>schedule(false)).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});setInterval(()=>{loadAssistant();applyNav();placeCost();hardProgressZeroFuture()},300)}).catch(()=>{loadAssistant();schedule(true);setInterval(()=>{loadAssistant();applyNav();placeCost();hardProgressZeroFuture()},300)});
})();
