// Loads the latest synced Lectio data from the last generated snapshot, then applies live time-progress styling.
(function(){
  const DATA_URL = 'https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/179ba3a09d3b58a407428ecde3910bd14fd04bdc/lectio-data.js';

  function injectProgressStyles(){
    if(document.getElementById('time-progress-styles')) return;
    const s=document.createElement('style');
    s.id='time-progress-styles';
    s.textContent=`
      :root{--line:#151827;--muted:#778096}
      body,.app{background:#020307!important}
      .topbar,.panel{border-color:#182033!important;background:linear-gradient(180deg,#080b12,#030409)!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important}
      .calendar{border-color:#151827!important;background:#020307!important}.timecol,.day{background:#030409!important;border-right-color:#151827!important}.head{background:#050711!important;border-bottom-color:#151827!important}.todayCol .head{color:#c7d2ff!important;box-shadow:inset 0 2px 0 #445dff!important}.grid{background:linear-gradient(to bottom,rgba(255,255,255,.035) 1px,transparent 1px) 0 0/100% calc(60 * var(--px))!important}.tlabel{text-shadow:0 0 8px rgba(90,120,255,.45)!important}
      button,.badge,.tab,.cellInput,.cellSelect,.noteArea,input,select,.checkline{border-color:#202946!important;background:#050711!important}.tab.active,.addBtn,.primary{border-color:#384bff!important;background:linear-gradient(180deg,#111a38,#070912)!important}.revertBtn,.synced{border-color:#126949!important;background:rgba(16,194,119,.06)!important}.table{background:#05070c!important;border-color:#161d2d!important}.table th{background:#080b13!important}.table th,.table td{border-color:#161d2d!important}
      .panelHead .muted{display:none!important}
      .event{isolation:isolate;transition:filter .45s ease,box-shadow .45s ease,transform .2s ease,opacity .45s ease!important}
      .event .time,.event .title{position:relative;z-index:3}.event::before,.event::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;transition:opacity .55s ease,height .9s linear}.event::before{background:#000;opacity:.18}.event::after{height:var(--time-progress,0%);bottom:auto;background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.045));mix-blend-mode:screen;opacity:0}.event.time-future{filter:saturate(.9) brightness(.89);opacity:.94}.event.time-future::before{opacity:.16}.event.time-past{filter:saturate(1.15) brightness(1.08);opacity:1}.event.time-past::before{opacity:0}.event.time-past::after{height:100%;opacity:.16}.event.time-current{filter:saturate(1.28) brightness(1.16);transform:translateY(-1px);box-shadow:0 0 0 1px rgba(255,255,255,.14),0 0 20px rgba(100,140,255,.22),0 10px 24px rgba(0,0,0,.42)!important}.event.time-current::before{opacity:.04}.event.time-current::after{opacity:.68}.event.time-current::marker{display:none}
      .event.time-current:has(.title)::before{box-shadow:inset 0 0 14px rgba(255,255,255,.055)}
      .event.time-current .time::after{content:""!important}
    `;
    document.head.appendChild(s);
  }

  function toMin(t){const p=String(t||'').slice(0,5).split(':').map(Number);return p[0]*60+p[1]}
  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function classify(el){
    const date=el.dataset.date,start=toMin(el.dataset.start),end=toMin(el.dataset.end),now=new Date(),today=ymd(now),nowMin=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
    let p=0,cls='time-future';
    if(date<today){p=100;cls='time-past'}
    else if(date>today){p=0;cls='time-future'}
    else if(nowMin>=end){p=100;cls='time-past'}
    else if(nowMin<start){p=0;cls='time-future'}
    else{p=Math.max(0,Math.min(100,((nowMin-start)/(end-start))*100));cls='time-current'}
    el.classList.remove('time-past','time-current','time-future');el.classList.add(cls);el.style.setProperty('--time-progress',p.toFixed(1)+'%');
    const time=el.querySelector('.time'); if(time) delete time.dataset.progress;
  }
  function refreshProgress(){document.querySelectorAll('.event[data-date][data-start][data-end]').forEach(classify)}
  function patchEventRenderer(){
    if(window.__timeProgressPatched) return; window.__timeProgressPatched=true;
    const old=window.eventEl || (typeof eventEl==='function' ? eventEl : null);
    if(typeof old==='function'){
      eventEl=function(e){const el=old(e);el.dataset.date=e.date;el.dataset.start=e.start;el.dataset.end=e.end;setTimeout(()=>classify(el),0);return el};
      window.eventEl=eventEl;
    }
    const oldRender=window.render || (typeof render==='function' ? render : null);
    if(typeof oldRender==='function'){
      render=function(){const out=oldRender.apply(this,arguments);setTimeout(refreshProgress,0);return out};
      window.render=render;
    }
    setInterval(refreshProgress,30000);
    setTimeout(refreshProgress,100);
  }
  function applyPatch(){injectProgressStyles();patchEventRenderer();setTimeout(refreshProgress,300)}

  fetch(DATA_URL,{cache:'no-store'}).then(r=>r.text()).then(code=>{(0,eval)(code);applyPatch();if(typeof useData==='function')useData(window.LECTIO_DATA,'lectio')}).catch(()=>{window.LECTIO_DATA=window.LECTIO_DATA||{school:[],homework:[]};applyPatch();if(typeof useData==='function')useData(window.LECTIO_DATA,'fallback')});
})();
