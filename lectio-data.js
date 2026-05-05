// Loads the v3 Personal OS layer, then applies stable schedule/progress UI fixes.
// UI patch version: details-fix-v5
(function(){
  const PREV_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/6d9b1856212b0cac9507d3897cba6ab9e3368f0b/lectio-data.js';
  const STATS_KEY='personalOS.todoStats.v2';
  let lockedDetailLeft='';
  let lockedDetailTop='';
  let lastSignature='';
  let ticking=false;

  function injectV5Style(){
    let style=document.getElementById('assistant-details-fix-v5');
    if(!style){
      style=document.createElement('style');
      style.id='assistant-details-fix-v5';
      document.head.appendChild(style);
    }
    style.textContent=`
      #scheduleView .event{display:block!important;text-align:left!important;align-items:initial!important;justify-content:initial!important;overflow:hidden!important}
      #scheduleView .event .time{display:block!important;text-align:left!important;line-height:1.05!important;font-weight:850!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event .title{display:block!important;text-align:left!important;font-weight:800!important;line-height:1.12!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
      #scheduleView .event.aiShortBlock{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important}
      #scheduleView .event.aiTallBlock{display:block!important;justify-content:initial!important;align-items:initial!important}
      #scheduleView .event.aiCompact{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;padding-top:2px!important;padding-bottom:2px!important}
      #scheduleView .event.aiCompact .time{font-size:12px!important;text-align:left!important;display:block!important;width:100%!important;line-height:1!important;font-weight:850!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.homework .time,#scheduleView .event.homework .title{font-size:12px!important;text-align:left!important;font-weight:800!important}
      #scheduleView .event.aiHasDetails .time{padding-right:82px!important;box-sizing:border-box!important}
      #scheduleView .event.aiHasDetails .title{padding-right:0!important;box-sizing:border-box!important}
      #scheduleView .event .aiDetailShow{position:absolute!important;right:8px!important;top:4px!important;height:20px!important;min-height:20px!important;line-height:18px!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.04em!important;z-index:5!important;margin:0!important;transform:none!important}
      #scheduleView .event.small .aiDetailShow,#scheduleView .event.aiCompact .aiDetailShow{top:3px!important;height:18px!important;min-height:18px!important;line-height:16px!important;font-size:10.5px!important;padding:0 8px!important}
      .aiDetailFloat{position:fixed!important;z-index:120!important;max-width:360px!important;font-size:13.5px!important;line-height:1.35!important;background:#100b1b!important;border:1px solid #7f52ff!important;border-radius:10px!important;padding:10px 12px!important;box-shadow:0 14px 38px rgba(0,0,0,.48)!important;color:#f7f3ff!important;pointer-events:auto!important;transform:none!important}
      .aiDetailFloat div{font-size:13.5px!important}
      .aiDetailFloatTitle{font-size:13.5px!important;font-weight:850!important;margin-bottom:4px!important}
    `;
    document.head.appendChild(style);
  }

  function minutesFromEvent(el){
    const txt=(el.querySelector('.time')||{}).textContent||'';
    const m=txt.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    return Number(m[3])*60+Number(m[4])-(Number(m[1])*60+Number(m[2]));
  }

  function normalizeScheduleBlocks(){
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const dur=minutesFromEvent(el);
      el.classList.toggle('aiShortBlock',!!dur && dur<=45);
      el.classList.toggle('aiTallBlock',!!dur && dur>45);
      const has=!!el.querySelector('.aiDetailShow');
      el.classList.toggle('aiHasDetails',has);
      const title=el.querySelector('.title');
      const time=el.querySelector('.time');
      if(title){
        title.style.textAlign='left';
        title.style.fontWeight='800';
      }
      if(time){
        time.style.textAlign='left';
        time.style.fontWeight='850';
      }
    });
  }

  function lockDetailFloat(){
    const box=document.getElementById('aiDetailFloat');
    if(!box)return;
    const r=box.getBoundingClientRect();
    if(!lockedDetailLeft)lockedDetailLeft=Math.round(r.left)+'px';
    if(!lockedDetailTop)lockedDetailTop=Math.round(r.top)+'px';
    box.style.position='fixed';
    box.style.left=lockedDetailLeft;
    box.style.top=lockedDetailTop;
  }

  function restoreLockedDetailFloat(){
    const box=document.getElementById('aiDetailFloat');
    if(!box || !lockedDetailLeft || !lockedDetailTop)return;
    box.style.position='fixed';
    box.style.left=lockedDetailLeft;
    box.style.top=lockedDetailTop;
  }

  function afterDetailsClick(e){
    if(!e.target.closest || !e.target.closest('.aiDetailShow'))return;
    lockedDetailLeft='';
    lockedDetailTop='';
    setTimeout(lockDetailFloat,0);
    setTimeout(lockDetailFloat,80);
  }

  function todayName(){
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  }

  function isoDateForUpcomingDay(dayName){
    const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const wanted=names.indexOf(dayName);
    if(wanted<0)return '';
    const d=new Date();
    const diff=(wanted-d.getDay()+7)%7;
    d.setDate(d.getDate()+diff);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
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

  function stableProgressFix(){
    const side=document.querySelector('#todoView .todoSide');
    if(!side)return;
    const today=todayName();
    const todayPct=currentTaskCompletionPct();
    let stats={};
    try{stats=JSON.parse(localStorage.getItem(STATS_KEY)||'{}')||{}}catch(e){}
    Array.from(side.querySelectorAll('.todoDay')).forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      const day=(label.match(/Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i)||[])[0];
      let pct=0;
      if(/^Today$/i.test(day||'') || new RegExp('^'+today+'$','i').test(day||'')){
        pct=todayPct;
      }else{
        const dateKey=isoDateForUpcomingDay(day||'');
        const rec=dateKey?stats[dateKey]:null;
        pct=rec&&typeof rec.pct==='number'?rec.pct:0;
        const now=new Date();
        const d=dateKey?new Date(dateKey+'T00:00:00'):null;
        if(d && d>new Date(now.getFullYear(),now.getMonth(),now.getDate()))pct=0;
      }
      const top=card.querySelector('.todoDayTop');
      const fill=card.querySelector('.todoBarFill');
      if(top){const spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=pct+'%'}
      if(fill)fill.style.width=pct+'%';
    });
  }

  function signature(){
    const events=Array.from(document.querySelectorAll('#scheduleView .event')).map(el=>{
      const time=(el.querySelector('.time')||{}).textContent||'';
      const title=(el.querySelector('.title')||{}).textContent||'';
      const details=el.querySelector('.aiDetailShow')?'1':'0';
      return time+'|'+title+'|'+details;
    }).join('~');
    const checks=Array.from(document.querySelectorAll('#todoView input[type=checkbox]')).map(cb=>cb.checked?'1':'0').join('');
    return events+'::'+checks;
  }

  function applyV5(force){
    injectV5Style();
    const sig=signature();
    if(force || sig!==lastSignature){
      normalizeScheduleBlocks();
      stableProgressFix();
      lastSignature=sig;
    }else{
      restoreLockedDetailFloat();
    }
  }

  function scheduleApply(force){
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      applyV5(force);
    });
  }

  document.addEventListener('click',function(e){afterDetailsClick(e);setTimeout(function(){scheduleApply(true)},0)},true);
  document.addEventListener('change',function(){setTimeout(function(){scheduleApply(true)},0)},true);
  window.addEventListener('scroll',function(){restoreLockedDetailFloat()},true);
  window.addEventListener('resize',function(){lockedDetailLeft='';lockedDetailTop='';setTimeout(lockDetailFloat,0);scheduleApply(true)});

  function startV5(){
    scheduleApply(true);
    setTimeout(function(){scheduleApply(true)},0);
    setTimeout(function(){scheduleApply(true)},100);
    setTimeout(function(){scheduleApply(true)},350);
    const mo=new MutationObserver(function(){scheduleApply(false)});
    mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});
    setInterval(function(){scheduleApply(false)},750);
  }

  fetch(PREV_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);startV5();})
    .catch(()=>startV5());
})();
