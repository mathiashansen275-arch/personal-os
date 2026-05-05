// Loads stable Personal OS, then applies schedule polish: exact 4px adjacency gap, Wednesday work/evening fit, static blocks, brighter past/progress, and toggle details.
// UI patch version: newest-stable-v14
(function(){
  const BASE_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  const STATE_KEY='personalOS.schedule.v5';
  const PX=1.22;
  const GAP_PX=4;
  let raf=0, lastHash='';

  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function mins(s){s=String(s||'00:00');return Number(s.slice(0,2))*60+Number(s.slice(3,5))}
  function ptime(txt){const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);return m?{start:+m[1]*60+ +m[2],end:+m[3]*60+ +m[4],raw:m[0]}:null}
  function clean(t){return String(t||'').replace(/^\s*2i\s+/i,'').replace(/^\s*available block\s*$/i,'').replace(/\s+/g,' ').trim()}
  function today(){return ymd(new Date())}
  function wedDate(d){const x=new Date(String(d||'')+'T00:00:00');return !isNaN(x)&&x.getDay()===3}

  function cleanupState(){
    try{
      const st=JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};
      if(!Array.isArray(st.custom))return;
      const before=st.custom.length;
      st.custom=st.custom.filter(b=>{
        const type=String(b.type||'').toLowerCase(), title=String(b.title||'').toLowerCase();
        if(type==='school'||type==='routine'||type==='evening'||type==='wind'||type==='work')return true;
        if(/morning routine|evening routine|wind down/.test(title))return true;
        if(b.date===today())return false;
        return mins(b.start)>=14*60+45;
      });
      st.custom.forEach(b=>{
        const title=String(b.title||'').toLowerCase();
        if(/wind down/.test(title)&&b.start)b.end=hm(mins(b.start)+30);
        if(/evening routine/.test(title)&&wedDate(b.date)){b.start='21:20';b.end='22:30'}
        if(/\bwork\b/.test(title)&&wedDate(b.date))b.end='21:20';
      });
      if(st.custom.length!==before)localStorage.setItem(STATE_KEY,JSON.stringify(st));
    }catch(e){}
  }

  function css(){
    let s=document.getElementById('assistant-stable-v14-fixes');
    if(!s){s=document.createElement('style');s.id='assistant-stable-v14-fixes';document.head.appendChild(s)}
    s.textContent=`
      #addBlock,#revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event,#scheduleView .event:hover{transition:none!important;animation:none!important;transform:none!important;filter:none!important;box-shadow:none!important}
      #scheduleView .event.past,#scheduleView .event.dimmed,#scheduleView .event.completed,#scheduleView .event[style*="opacity"]{opacity:.78!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
      #scheduleView .event.aiLockedGenerated{cursor:default!important}
      #scheduleView .event .aiDetailShow{display:none!important}
      #scheduleView .event.aiNeedsDetails .aiDetailShow{display:inline-flex!important;position:absolute!important;right:8px!important;top:4px!important;height:20px!important;line-height:18px!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important;pointer-events:auto!important}
      #scheduleView .event .time{font-weight:850!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{font-weight:800!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiOneLineSmall{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important;padding-top:1px!important;padding-bottom:1px!important}
      #scheduleView .event.aiOneLineSmall .time{display:block!important;width:100%!important;max-width:100%!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;font-size:11.5px!important;line-height:1!important;font-weight:850!important;padding-right:0!important;letter-spacing:-.015em!important}
      #scheduleView .event.aiOneLineSmall .title{display:none!important}
      #scheduleView .event.homework .title,#scheduleView .event.wind .title{display:none!important}
      #scheduleView .event.homework .time,#scheduleView .event.wind .time{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;font-size:11.5px!important;letter-spacing:-.015em!important;line-height:1!important}
      .aiDetailFloat{font-size:15.5px!important;line-height:1.35!important;max-width:440px!important}
      .aiDetailFloat div{font-size:15.5px!important}
      .aiDetailFloatTitle{font-size:15px!important;font-weight:900!important}
      #aiCostBadge,.aiCostBadge{position:absolute!important;top:114px!important;right:24px!important;left:auto!important;bottom:auto!important;transform:none!important;z-index:40!important;display:flex!important}
      .app{position:relative!important}
    `;
  }

  function activeTab(){const a=document.querySelector('.tab.active');return a&&a.getAttribute('data-tab')||''}
  function nav(){document.body.classList.toggle('aiScheduleActive',activeTab()==='scheduleView')}
  function cost(){const app=document.querySelector('.app'), b=document.getElementById('aiCostBadge')||document.querySelector('.aiCostBadge');if(app&&b&&b.parentElement!==app)app.appendChild(b)}
  function available(el){const title=clean((el.querySelector('.title')||{}).textContent||'');return /^available block$/i.test(title)||el.classList.contains('aiFreeHidden')||((el.classList.contains('focus')||el.classList.contains('deep'))&&!el.classList.contains('business')&&!el.classList.contains('personal'))}
  function generated(el){const title=clean((el.querySelector('.title')||{}).textContent||'');return el.classList.contains('aiNeedsDetails')||el.querySelector('.aiDetailShow')||/grouped tasks| pt\. \d+$/i.test(title)||(el.classList.contains('personal')&&!/buy lisa|tok commentary/i.test(title))||(el.classList.contains('business')&&!/work/i.test(title))}
  function wedCol(day){const wrap=day.closest('.dayWrap')||day.parentElement||day;return /wed/i.test(wrap.textContent||'')}

  function fits(node,text,reserve){
    if(!node||!text)return true;
    const p=document.createElement('span'), cs=getComputedStyle(node);
    p.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:'+cs.font+';letter-spacing:'+cs.letterSpacing+';left:-9999px;top:-9999px';
    p.textContent=text;document.body.appendChild(p);
    const ok=p.getBoundingClientRect().width<=Math.max(0,node.getBoundingClientRect().width-(reserve||0)-2);p.remove();return ok;
  }

  function closeDetails(){const f=document.getElementById('aiDetailFloat');if(f){f.remove();document.querySelectorAll('.aiDetailShow').forEach(b=>b.textContent='DETAILS')}}
  function detailId(el){if(!el.dataset.aiDetailId)el.dataset.aiDetailId='d'+Math.random().toString(36).slice(2);return el.dataset.aiDetailId}
  function details(el,btn){
    const id=detailId(el), old=document.getElementById('aiDetailFloat');
    if(old&&old.dataset.forEl===id){closeDetails();return}
    if(old)old.remove();
    document.querySelectorAll('.aiDetailShow').forEach(b=>b.textContent='DETAILS');
    const box=document.createElement('div');box.id='aiDetailFloat';box.className='aiDetailFloat';box.dataset.forEl=id;
    const h=document.createElement('div');h.className='aiDetailFloatTitle';h.textContent='Full task';box.appendChild(h);
    const txt=(el.dataset.aiTaskTexts||el.dataset.aiFullTitle||el.dataset.stableBaseTitle||((el.querySelector('.title')||{}).textContent)||'Task details').trim();
    txt.split('||').filter(Boolean).forEach(x=>{const d=document.createElement('div');d.textContent='• '+x;box.appendChild(d)});
    document.body.appendChild(box);
    const r=el.getBoundingClientRect();box.style.left=Math.min(window.innerWidth-450,Math.max(8,r.left+6))+'px';box.style.top=Math.min(window.innerHeight-190,Math.max(8,r.bottom+6))+'px';
    if(btn)btn.textContent='DETAILS';
  }
  function ensureBtn(el){let b=el.querySelector('.aiDetailShow');if(!b){b=document.createElement('button');b.className='aiDetailShow';el.appendChild(b)}b.textContent='DETAILS';b.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation();details(el,b)};return b}
  function markDetails(el){
    const title=el.querySelector('.title'), time=el.querySelector('.time'); if(!title)return;
    const full=clean(el.dataset.aiFullTitle||el.dataset.stableBaseTitle||title.textContent||'');
    const protectedType=el.classList.contains('school')||el.classList.contains('homework')||el.classList.contains('wind');
    const protectedTitle=/^(morning routine|evening routine|wind down)$/i.test(full);
    const grouped=/grouped tasks/i.test(full)||/ & /.test(full)||el.dataset.aiTaskTexts;
    const need=!!full&&!protectedType&&!protectedTitle&&(grouped||!fits(title,full,86));
    if(need)ensureBtn(el); else {const b=el.querySelector('.aiDetailShow');if(b)b.remove()}
    el.classList.toggle('aiNeedsDetails',need);
    if(time)time.style.paddingRight=need?'82px':'';
  }

  function normalizeDay(day){
    Array.from(day.querySelectorAll('.event')).forEach(el=>{if(el.classList.contains('break')||el.classList.contains('aiBreakHidden')||available(el))el.remove()});
    const rows=[]; const isWed=wedCol(day);
    day.querySelectorAll('.event').forEach(el=>{const time=el.querySelector('.time');if(!time)return;if(!el.dataset.stableBaseTime)el.dataset.stableBaseTime=time.textContent;if(!el.dataset.stableBaseTop)el.dataset.stableBaseTop=el.style.top||'0px';if(!el.dataset.stableBaseHeight)el.dataset.stableBaseHeight=el.style.height||'0px';const t=ptime(el.dataset.stableBaseTime);if(t)rows.push({el,t})});
    rows.sort((a,b)=>a.t.start-b.t.start||a.t.end-b.t.end);
    let prevEnd=0, prevBottom=-GAP_PX;
    rows.forEach(r=>{
      const el=r.el, time=el.querySelector('.time'), titleEl=el.querySelector('.title');
      let start=Math.max(r.t.start,prevEnd), end=r.t.end, title=clean(el.dataset.stableBaseTitle||(titleEl&&titleEl.textContent)||'');
      if(titleEl&&!el.dataset.stableBaseTitle)el.dataset.stableBaseTitle=title;
      if(el.classList.contains('wind')){title='Wind down';end=r.t.start+30;}
      if(/evening routine/i.test(title)&&isWed){start=Math.max(21*60+20,prevEnd);end=22*60+30;}
      if(/\bwork\b/i.test(title)&&isWed)end=21*60+20;
      let duration=Math.max(1,end-(/evening routine/i.test(title)&&isWed?start:r.t.start));
      if(!(/evening routine/i.test(title)&&isWed))end=start+duration;
      if(el.classList.contains('homework'))title=clean(title||'Homework');
      const oneLine=end-start<=30||el.classList.contains('homework')||el.classList.contains('wind');
      const label=oneLine?(hm(start)+'-'+hm(end)+' '+title):String(el.dataset.stableBaseTime).replace(r.t.raw,hm(start)+'-'+hm(end));
      if(time&&time.textContent!==label)time.textContent=label;
      const baseTop=parseFloat(el.dataset.stableBaseTop||'0')||0;
      const naturalTop=baseTop+(start-r.t.start)*PX;
      const naturalBottom=baseTop+(end-r.t.start)*PX;
      let top=naturalTop;
      if(prevEnd>0 && Math.abs(start-prevEnd)<=1)top=prevBottom+GAP_PX;
      else top=Math.max(naturalTop,prevBottom+GAP_PX);
      let height=Math.max(12,naturalBottom-top);
      const topPx=top+'px', heightPx=height+'px';
      if(el.style.top!==topPx)el.style.top=topPx;
      if(el.style.height!==heightPx)el.style.height=heightPx;
      prevEnd=end; prevBottom=top+height;
      el.classList.toggle('aiOneLineSmall',oneLine);
      el.classList.toggle('aiTallBlock',end-start>45&&!el.classList.contains('homework')&&!el.classList.contains('wind'));
      el.classList.toggle('aiLockedGenerated',generated(el));
      if(titleEl){titleEl.textContent=title;titleEl.style.fontWeight='800';if(oneLine)titleEl.style.display='none';}
      if(time){time.style.fontWeight='850';time.style.textAlign='left';}
      markDetails(el);
    });
  }

  function progress(){
    const side=document.querySelector('#todoView .todoSide');if(!side)return;
    const todayName=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const real=rows.filter(r=>{const i=r.querySelector('input[type=text],textarea,[contenteditable=true]');const txt=((i&&('value'in i?i.value:i.textContent))||'').trim().toLowerCase();return txt&&txt!=='new task'});
    const pct=real.length?Math.round(real.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length/real.length*100):0;
    side.querySelectorAll('.todoDay').forEach(card=>{const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();const p=(/^Today/i.test(label)||new RegExp('^'+todayName+'\\b','i').test(label))?pct:0;const top=card.querySelector('.todoDayTop'),fill=card.querySelector('.todoBarFill');if(top){const spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=p+'%'}if(fill)fill.style.width=p+'%'});
  }

  function hash(){return Array.from(document.querySelectorAll('#scheduleView .event')).map(el=>[(el.querySelector('.time')||{}).textContent,(el.querySelector('.title')||{}).textContent,el.className,el.style.top,el.style.height].join('|')).join('~')}
  function apply(force){css();nav();cost();const h=hash();if(force||h!==lastHash){document.querySelectorAll('#scheduleView .day').forEach(normalizeDay);lastHash=hash()}document.querySelectorAll('#scheduleView .event').forEach(markDetails);progress()}
  function schedule(force){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply(force)})}
  function loadAssistant(){if(document.getElementById('aiChatButton'))return;const s=document.createElement('script');s.src='./assistant.js?v='+Date.now();s.async=false;document.head.appendChild(s)}

  cleanupState();css();
  document.addEventListener('click',e=>{const btn=e.target&&e.target.closest&&e.target.closest('#scheduleView .aiDetailShow');if(btn){const el=btn.closest('.event');if(el){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation();details(el,btn);return}}const ev=e.target&&e.target.closest&&e.target.closest('#scheduleView .event.aiLockedGenerated');if(ev){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}},true);
  document.addEventListener('dblclick',e=>{const ev=e.target&&e.target.closest&&e.target.closest('#scheduleView .event.aiLockedGenerated');if(ev){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}},true);
  window.addEventListener('scroll',closeDetails,true);
  fetch(BASE_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{(0,eval)(code);loadAssistant();cleanupState();try{if(typeof render==='function')render()}catch(e){}schedule(true);setTimeout(()=>{loadAssistant();schedule(true);cost()},100);setTimeout(()=>{loadAssistant();schedule(true);cost()},500);setTimeout(()=>{loadAssistant();cost()},1200);new MutationObserver(()=>schedule(false)).observe(document.getElementById('scheduleView')||document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});setInterval(()=>{loadAssistant();nav();cost();progress();document.querySelectorAll('#scheduleView .event').forEach(markDetails)},300)}).catch(()=>{loadAssistant();schedule(true);setInterval(()=>{loadAssistant();nav();cost();progress();document.querySelectorAll('#scheduleView .event').forEach(markDetails)},300)});
})();
