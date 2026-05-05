// Loads the stable Personal OS layer, then applies safe final UI fixes.
// UI patch version: details-fix-v7
(function(){
  const BASE_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/6d9b1856212b0cac9507d3897cba6ab9e3368f0b/lectio-data.js';
  const STATS_KEY='personalOS.todoStats.v2';
  const PX=1.22;
  let applying=false;
  let detailsLocked=false;
  let detailLeft='';
  let detailTop='';

  function todayStart(){
    const d=new Date();
    return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  }

  function purgeFutureStats(){
    let stats={};
    try{stats=JSON.parse(localStorage.getItem(STATS_KEY)||'{}')||{}}catch(e){}
    const today=todayStart();
    let changed=false;
    Object.keys(stats).forEach(k=>{
      const d=new Date(k+'T00:00:00');
      if(d>today){delete stats[k];changed=true;}
    });
    if(changed)localStorage.setItem(STATS_KEY,JSON.stringify(stats));
  }

  function injectEarlyCss(){
    let style=document.getElementById('assistant-details-fix-v7');
    if(!style){
      style=document.createElement('style');
      style.id='assistant-details-fix-v7';
      document.head.appendChild(style);
    }
    style.textContent=`
      #revertWeek{display:none!important}
      body:not(.aiScheduleActive) #prev,body:not(.aiScheduleActive) #next,body:not(.aiScheduleActive) #today{display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden{display:none!important}
      #scheduleView .event .aiDetailShow{display:none!important}
      #scheduleView .event.aiNeedsDetails .aiDetailShow{display:inline-flex!important;position:absolute!important;right:8px!important;top:4px!important;height:20px!important;min-height:20px!important;line-height:18px!important;width:auto!important;min-width:0!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important}
      #scheduleView .event{display:block!important;text-align:left!important;overflow:hidden!important}
      #scheduleView .event .time{display:block!important;text-align:left!important;font-weight:850!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{display:block!important;text-align:left!important;font-weight:800!important;line-height:1.12!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiShortBlock{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.aiTallBlock{display:block!important;justify-content:initial!important;align-items:initial!important;text-align:left!important}
      #scheduleView .event.aiCompact{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;padding-top:2px!important;padding-bottom:2px!important;text-align:left!important}
      #scheduleView .event.aiCompact .time{font-size:12px!important;text-align:left!important;display:block!important;width:100%!important;line-height:1!important;font-weight:850!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.homework,#scheduleView .event.wind{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important}
      #scheduleView .event.homework .time,#scheduleView .event.homework .title{font-size:12px!important;text-align:left!important;font-weight:800!important;display:block!important;width:100%!important}
      .aiDetailFloat{position:fixed!important;z-index:120!important;max-width:360px!important;font-size:13.5px!important;line-height:1.35!important;background:#100b1b!important;border:1px solid #7f52ff!important;border-radius:10px!important;padding:10px 12px!important;box-shadow:0 14px 38px rgba(0,0,0,.48)!important;color:#f7f3ff!important;pointer-events:auto!important;transform:none!important}
      .aiDetailFloat div{font-size:13.5px!important}
      .aiDetailFloatTitle{font-size:13.5px!important;font-weight:850!important;margin-bottom:4px!important}
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
    return {start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),raw:m[0]};
  }

  function hm(mins){
    return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  }

  function textFits(node,text,reserve){
    if(!node || !text)return true;
    const probe=document.createElement('span');
    const cs=getComputedStyle(node);
    probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:'+cs.font+';letter-spacing:'+cs.letterSpacing+';left:-9999px;top:-9999px';
    probe.textContent=text;
    document.body.appendChild(probe);
    const width=probe.getBoundingClientRect().width;
    probe.remove();
    return width <= Math.max(0,node.getBoundingClientRect().width-(reserve||0)-2);
  }

  function normalizeDetails(el){
    const btn=el.querySelector('.aiDetailShow');
    const title=el.querySelector('.title');
    const time=el.querySelector('.time');
    if(!btn || !title){el.classList.remove('aiNeedsDetails');return;}
    const full=(el.dataset.aiFullTitle||title.textContent||'').trim();
    const simple=/^(morning routine|evening routine|wind down)$/i.test(full);
    const isSchool=el.classList.contains('school');
    const t=parseTimeText(time&&time.textContent);
    let needs=false;
    if(full && !simple && !isSchool){
      if(el.classList.contains('aiCompact') && time){
        const label=(el.dataset.aiOriginalTime||t&&hm(t.start)+'-'+hm(t.end)||'').trim();
        needs=!textFits(time,(label?label+' ':'')+full,86);
      }else{
        needs=!textFits(title,full,86);
      }
    }
    el.classList.toggle('aiNeedsDetails',needs);
    btn.textContent=btn.textContent==='HIDE'&&needs?'HIDE':'DETAILS';
  }

  function normalizeDay(day){
    const events=Array.from(day.querySelectorAll('.event')).filter(el=>!el.classList.contains('break')&&!el.classList.contains('aiBreakHidden'));
    const base=[];
    events.forEach(el=>{
      const time=el.querySelector('.time');
      if(time && !el.dataset.aiBaseTime)el.dataset.aiBaseTime=time.textContent;
      if(!el.dataset.aiBaseTop)el.dataset.aiBaseTop=el.style.top||'0px';
      if(!el.dataset.aiBaseHeight)el.dataset.aiBaseHeight=el.style.height||'0px';
      const t=parseTimeText(el.dataset.aiBaseTime||time&&time.textContent);
      if(t)base.push({el,t});
    });
    const winds=base.filter(x=>x.el.classList.contains('wind')).map(x=>x.t.end).sort((a,b)=>a-b);
    base.forEach(x=>{
      const el=x.el;
      const time=el.querySelector('.time');
      const extra=winds.filter(end=>end<=x.t.start).length*5;
      const start=x.t.start+extra;
      const end=x.t.end+extra+(el.classList.contains('wind')?5:0);
      if(time){
        time.textContent=String(el.dataset.aiBaseTime).replace(x.t.raw,hm(start)+'-'+hm(end));
        time.style.textAlign='left';
        time.style.fontWeight='850';
      }
      const baseTop=parseFloat(el.dataset.aiBaseTop||el.style.top||'0')||0;
      const baseHeight=parseFloat(el.dataset.aiBaseHeight||el.style.height||'0')||0;
      el.style.top=(baseTop+extra*PX)+'px';
      if(el.classList.contains('wind') && baseHeight)el.style.height=(baseHeight+5*PX)+'px';
      const dur=end-start;
      el.classList.toggle('aiShortBlock',dur<=45);
      el.classList.toggle('aiTallBlock',dur>45);
      const title=el.querySelector('.title');
      if(title){
        title.style.textAlign='left';
        title.style.fontWeight='800';
      }
      normalizeDetails(el);
    });
  }

  function normalizeSchedule(){
    document.querySelectorAll('#scheduleView .event.break,#scheduleView .event.aiBreakHidden').forEach(el=>el.remove());
    document.querySelectorAll('#scheduleView .day').forEach(normalizeDay);
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

  function lockDetail(){
    const box=document.getElementById('aiDetailFloat');
    if(!box)return;
    if(!detailLeft || !detailTop){
      const r=box.getBoundingClientRect();
      detailLeft=Math.round(r.left)+'px';
      detailTop=Math.round(r.top)+'px';
    }
    box.style.left=detailLeft;
    box.style.top=detailTop;
    box.style.position='fixed';
    detailsLocked=true;
  }

  function restoreDetail(){
    const box=document.getElementById('aiDetailFloat');
    if(box && detailsLocked && detailLeft && detailTop){
      box.style.left=detailLeft;
      box.style.top=detailTop;
      box.style.position='fixed';
    }
  }

  function applyAll(){
    if(applying)return;
    applying=true;
    requestAnimationFrame(function(){
      injectEarlyCss();
      applyNavVisibility();
      normalizeSchedule();
      hardSetProgress();
      restoreDetail();
      applying=false;
    });
  }

  purgeFutureStats();
  injectEarlyCss();
  document.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.tab'))setTimeout(applyAll,0);
    if(e.target.closest&&e.target.closest('.aiDetailShow')){
      detailsLocked=false;detailLeft='';detailTop='';
      setTimeout(lockDetail,0);
      setTimeout(lockDetail,80);
    }
    setTimeout(hardSetProgress,0);
    setTimeout(hardSetProgress,150);
  },true);
  document.addEventListener('change',function(){setTimeout(hardSetProgress,0);setTimeout(hardSetProgress,150)},true);
  window.addEventListener('scroll',restoreDetail,true);
  window.addEventListener('resize',function(){detailsLocked=false;detailLeft='';detailTop='';setTimeout(lockDetail,0);applyAll();});

  function start(){
    applyAll();
    setTimeout(applyAll,0);
    setTimeout(applyAll,120);
    setTimeout(applyAll,500);
    setTimeout(applyAll,1200);
    setInterval(function(){applyNavVisibility();hardSetProgress();restoreDetail();},300);
    setInterval(applyAll,1500);
  }

  fetch(BASE_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);start();})
    .catch(()=>start());
})();
