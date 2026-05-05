// Loads the last known-good Personal OS layer, then loads the DeepSeek assistant.
(function(){
  const GOOD_WRAPPER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  const STATS_KEY='personalOS.todoStats.v2';

  function injectEarlyVisualOverrides(){
    if(document.getElementById('assistant-early-visual-overrides'))return;
    const style=document.createElement('style');
    style.id='assistant-early-visual-overrides';
    style.textContent=`
      html body #scheduleView .event.time-future:not(.school):not(.homework):not(.trip):not(.wind),html body #scheduleView .day .event.time-future:not(.school):not(.homework):not(.trip):not(.wind){filter:saturate(.78) brightness(.75)!important;opacity:.95!important}
      html body #scheduleView .event.time-future:not(.school):not(.homework):not(.trip):not(.wind)::before,html body #scheduleView .day .event.time-future:not(.school):not(.homework):not(.trip):not(.wind)::before{opacity:.22!important}
      #scheduleView .event.time-past,.event.time-past{opacity:.82!important;filter:brightness(1.30) saturate(1.08)!important}
      #scheduleView .event.time-past::after,.event.time-past::after{display:none!important;opacity:0!important;background:transparent!important}
      #scheduleView .event.time-past .time,#scheduleView .event.time-past .title,.event.time-past .time,.event.time-past .title{opacity:1!important}
      #scheduleView .event.business,.event.business{background:rgba(48,64,24,.72)!important;border-color:#9caf55!important;color:#dbe8a6!important}
      #scheduleView .event.business .time,#scheduleView .event.business .title,.event.business .time,.event.business .title{color:#dbe8a6!important}
      #scheduleView .event.personal,.event.personal{background:rgba(76,0,45,.58)!important;border-color:#ff45d6!important;color:#ff69e2!important}
      #scheduleView .event.personal .time,#scheduleView .event.personal .title,.event.personal .time,.event.personal .title{color:#ff69e2!important}
      #scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden{display:none!important}
      #scheduleView .event .time,#scheduleView .event .title{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;line-height:1.12!important}
      #scheduleView .event.aiCompact .time{font-size:11px!important;line-height:1!important;white-space:nowrap!important}
      #scheduleView .event.aiCompact .title{display:none!important}
      #scheduleView .event.time-current.personal::after{background:linear-gradient(180deg,rgba(255,190,242,.54),rgba(255,105,226,.16))!important;mix-blend-mode:screen!important}
      #scheduleView .event.time-current.business::after{background:linear-gradient(180deg,rgba(232,242,183,.58),rgba(156,175,85,.18))!important;mix-blend-mode:screen!important}
      #scheduleView .event.time-current.work::after{background:linear-gradient(180deg,rgba(255,225,170,.58),rgba(255,170,55,.18))!important;mix-blend-mode:screen!important}
      #scheduleView .event.time-current.school::after,#scheduleView .event.time-current.homework::after{background:linear-gradient(180deg,rgba(190,225,255,.58),rgba(40,170,255,.18))!important;mix-blend-mode:screen!important}
      #scheduleView .event.time-current::after{filter:none!important;opacity:1!important}
      #todoView table tr>*:nth-child(3),#todoView .todoRow>*:nth-child(3),#todoView select:first-of-type,.aiDayColumnHidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function applyAssistantPositionOverrides(){
    injectEarlyVisualOverrides();
    if(!document.getElementById('assistant-position-overrides')){
      const style=document.createElement('style');
      style.id='assistant-position-overrides';
      style.textContent=`
        .app{position:relative!important}
        .aiChatButton{left:13px!important}
        .aiCostBadge{position:absolute!important;top:114px!important;right:24px!important;z-index:40!important}
        .aiChatHeader{border-bottom:1px solid #2b2147!important;font-weight:650!important}
        #aiChatInput,.aiChatInput input{font-weight:500!important;letter-spacing:0!important}
        #aiChatInput::placeholder{font-weight:650!important;opacity:.72!important}
        .aiMsg{font-weight:500!important;letter-spacing:0!important;max-width:100%!important;align-self:stretch!important;box-sizing:border-box!important}
        .aiChatInput button{font-weight:900!important}
        .aiSuggestions{display:flex;flex-wrap:wrap;gap:8px;padding:4px 12px 0 6px!important;border-top:none!important;order:0!important;justify-content:flex-start!important}
        .aiSuggest{height:34px;border-radius:999px;border:1px solid #49306c;background:#090812;color:#fff;font-weight:800;font-size:12.5px!important;letter-spacing:0;padding:0 12px;margin:0!important}
        .aiSuggest:hover{border-color:#9b6cff;background:#120d20}
        .aiChatMessages{scrollbar-width:thin!important;scrollbar-color:#6f45a8 #070710!important}
        .aiChatMessages::-webkit-scrollbar{width:10px!important}
        .aiChatMessages::-webkit-scrollbar-track{background:#070710!important;border-left:1px solid #211733!important}
        .aiChatMessages::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#8f5cff,#352456)!important;border:2px solid #070710!important;border-radius:999px!important}
        .aiChatMessages::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#b990ff,#49306c)!important}
        html body #scheduleView .event.time-future:not(.school):not(.homework):not(.trip):not(.wind),html body #scheduleView .day .event.time-future:not(.school):not(.homework):not(.trip):not(.wind){filter:saturate(.78) brightness(.75)!important;opacity:.95!important}
        html body #scheduleView .event.time-future:not(.school):not(.homework):not(.trip):not(.wind)::before,html body #scheduleView .day .event.time-future:not(.school):not(.homework):not(.trip):not(.wind)::before{opacity:.22!important}
        #scheduleView .event.time-past,.event.time-past{opacity:.82!important;filter:brightness(1.30) saturate(1.08)!important}
        #scheduleView .event.time-past::after,.event.time-past::after{display:none!important;opacity:0!important;background:transparent!important}
        #scheduleView .event.time-past .time,#scheduleView .event.time-past .title,.event.time-past .time,.event.time-past .title{opacity:1!important}
        #scheduleView .event.business,.event.business{background:rgba(48,64,24,.72)!important;border-color:#9caf55!important;color:#dbe8a6!important}
        #scheduleView .event.business .time,#scheduleView .event.business .title,.event.business .time,.event.business .title{color:#dbe8a6!important}
        #scheduleView .event.personal,.event.personal{background:rgba(76,0,45,.58)!important;border-color:#ff45d6!important;color:#ff69e2!important}
        #scheduleView .event.personal .time,#scheduleView .event.personal .title,.event.personal .time,.event.personal .title{color:#ff69e2!important}
        #scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
        #scheduleView .event.break,#scheduleView .event.aiBreakHidden{display:none!important}
        #scheduleView .event .time,#scheduleView .event .title{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;line-height:1.12!important}
        #scheduleView .event.aiCompact .time{font-size:11px!important;line-height:1!important;white-space:nowrap!important}
        #scheduleView .event.aiCompact .title{display:none!important}
        #scheduleView .event.time-current.personal::after{background:linear-gradient(180deg,rgba(255,190,242,.54),rgba(255,105,226,.16))!important;mix-blend-mode:screen!important}
        #scheduleView .event.time-current.business::after{background:linear-gradient(180deg,rgba(232,242,183,.58),rgba(156,175,85,.18))!important;mix-blend-mode:screen!important}
        #scheduleView .event.time-current.work::after{background:linear-gradient(180deg,rgba(255,225,170,.58),rgba(255,170,55,.18))!important;mix-blend-mode:screen!important}
        #scheduleView .event.time-current.school::after,#scheduleView .event.time-current.homework::after{background:linear-gradient(180deg,rgba(190,225,255,.58),rgba(40,170,255,.18))!important;mix-blend-mode:screen!important}
        #scheduleView .event.time-current::after{filter:none!important;opacity:1!important}
        #todoView table tr>*:nth-child(3),#todoView .todoRow>*:nth-child(3),#todoView select:first-of-type,.aiDayColumnHidden{display:none!important}
      `;
      document.head.appendChild(style);
    }
    const app=document.querySelector('.app');
    const badge=document.getElementById('aiCostBadge');
    if(app&&badge&&badge.parentElement!==app)app.appendChild(badge);

    const box=document.getElementById('aiChatMessages');
    const input=document.getElementById('aiChatInput');
    if(box&&input){
      const hasRealChat=!!box.querySelector('.aiMsg');
      if(hasRealChat){
        const existing=document.getElementById('aiSuggestions');
        if(existing)existing.remove();
      }else if(!document.getElementById('aiSuggestions')){
        const wrap=document.createElement('div');
        wrap.id='aiSuggestions';
        wrap.className='aiSuggestions';
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='aiSuggest';
        btn.textContent='🧩 Allocate tasks to available blocks';
        btn.onclick=function(){input.value='Allocate tasks with durations to available blocks today';input.focus()};
        wrap.appendChild(btn);
        box.insertBefore(wrap,box.firstChild);
      }
    }
    applyFinalUiFixes();
  }

  function eventMinutes(el){
    const txt=(el.querySelector('.time')||{}).textContent||'';
    const m=txt.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    return {start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),label:m[0]};
  }

  function shortBlockTitle(title){
    let t=String(title||'').trim().replace(/\s+/g,' ');
    if(!t)return '';
    if(/final questions.*meta/i.test(t))return 'Final questions meta';
    if(/write in group chat.*switch/i.test(t))return 'Switch shifts chat';
    if(/buy tickets.*lisa/i.test(t))return 'Buy Lisa tickets';
    if(/tok commentary/i.test(t))return 'TOK commentary';
    if(/available block/i.test(t))return '';
    if(t.length<=25)return t;
    const words=t.split(' ');
    let out='';
    for(const w of words){
      const next=(out?out+' ':'')+w;
      if(next.length>25)break;
      out=next;
    }
    return out||t.slice(0,25).trim();
  }

  function applyScheduleCleanup(){
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const titleEl=el.querySelector('.title');
      const timeEl=el.querySelector('.time');
      const t=eventMinutes(el);
      const rawTitle=(titleEl&&titleEl.textContent||'').trim();
      const dur=t?t.end-t.start:999;
      const lower=rawTitle.toLowerCase();
      const isAvailable=/^available block$/i.test(rawTitle)||((el.classList.contains('focus')||el.classList.contains('deep'))&&!el.classList.contains('business')&&!el.classList.contains('personal'));
      const isBreak=el.classList.contains('break')||/\bbreak\b/i.test(rawTitle)||(!rawTitle&&dur<=30);
      if(isAvailable){el.classList.add('aiFreeHidden');return}
      if(isBreak){el.classList.add('aiBreakHidden');return}
      if(titleEl){
        if(!el.dataset.aiFullTitle)el.dataset.aiFullTitle=rawTitle;
        const full=el.dataset.aiFullTitle||rawTitle;
        const short=shortBlockTitle(full);
        if(short && short!==rawTitle)titleEl.textContent=short;
        if((full.length>25 || full!==short) && !el.querySelector('.aiDetailShow') && !/^(morning routine|evening routine)$/i.test(full)){
          const btn=document.createElement('button');
          btn.className='aiDetailShow';
          btn.textContent='DETAILS';
          btn.onclick=function(ev){ev.stopPropagation();showSimpleDetails(el,full,btn)};
          el.appendChild(btn);
        }
      }
      if(dur<=30 && timeEl && titleEl && rawTitle){
        if(!el.dataset.aiOriginalTime)el.dataset.aiOriginalTime=timeEl.textContent;
        const short=shortBlockTitle(el.dataset.aiFullTitle||rawTitle);
        timeEl.textContent=el.dataset.aiOriginalTime+' '+short;
        el.classList.add('aiCompact');
      }
    });
  }

  function showSimpleDetails(el,full,btn){
    const old=document.getElementById('aiDetailFloat');
    if(old){old.remove();document.querySelectorAll('.aiDetailShow').forEach(b=>b.textContent='DETAILS');if(btn&&btn.textContent==='HIDE')return}
    const box=document.createElement('div');
    box.id='aiDetailFloat';
    box.className='aiDetailFloat';
    box.innerHTML='<div class="aiDetailFloatTitle">Full task</div><div>• '+String(full).replace(/[<>]/g,'')+'</div>';
    document.body.appendChild(box);
    const r=el.getBoundingClientRect();
    box.style.left=Math.min(window.innerWidth-370,Math.max(8,r.left+6))+'px';
    box.style.top=Math.min(window.innerHeight-180,Math.max(8,r.bottom+6))+'px';
    if(btn)btn.textContent='HIDE';
  }

  function hideDaySelectorHard(){
    document.querySelectorAll('#todoView table').forEach(table=>{
      const headers=Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'));
      let idx=-1;
      headers.forEach((h,i)=>{if(/\bday\b/i.test(h.textContent||''))idx=i});
      if(idx>=0)Array.from(table.querySelectorAll('tr')).forEach(r=>{const c=r.children[idx];if(c)c.classList.add('aiDayColumnHidden')});
    });
    document.querySelectorAll('#todoView select').forEach(sel=>{
      const txt=Array.from(sel.options||[]).map(o=>o.textContent).join(' ');
      if(/Today|Select day|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i.test(txt)){
        sel.classList.add('aiDayColumnHidden');
        const cell=sel.closest('td,th,.cell,.todoCell,div');
        if(cell)cell.classList.add('aiDayColumnHidden');
      }
    });
  }

  function updateProgressFix(){
    const side=document.querySelector('#todoView .todoSide');
    if(!side)return;
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const realRows=rows.filter(r=>((r.querySelector('input[type=text],textarea,[contenteditable=true]')||{}).value||(r.querySelector('[contenteditable=true]')||{}).textContent||'').trim().toLowerCase()!=='new task');
    const total=realRows.length;
    const done=realRows.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length;
    const todayPct=total?Math.round(done/total*100):0;
    let stats={};try{stats=JSON.parse(localStorage.getItem(STATS_KEY)||'{}')||{}}catch(e){}
    const cards=Array.from(side.querySelectorAll('.todoDay'));
    cards.forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      let pct=0;
      if(/^Today/i.test(label))pct=todayPct;
      else{
        const dayName=(label.match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i)||[])[0];
        if(dayName){
          const d=new Date();
          const wanted=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dayName);
          const diff=(wanted-d.getDay()+7)%7;
          d.setDate(d.getDate()+diff);
          const rec=stats[d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')];
          pct=rec&&typeof rec.pct==='number'?rec.pct:0;
        }
      }
      const top=card.querySelector('.todoDayTop');
      const fill=card.querySelector('.todoBarFill');
      if(top){const spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=pct+'%'}
      if(fill)fill.style.width=pct+'%';
    });
  }

  function applyFinalUiFixes(){
    try{hideDaySelectorHard();applyScheduleCleanup();updateProgressFix();}catch(e){}
  }

  function keepOverridesLast(){
    const early=document.getElementById('assistant-early-visual-overrides');
    const final=document.getElementById('assistant-position-overrides');
    if(early&&early.parentNode)document.head.appendChild(early);
    if(final&&final.parentNode)document.head.appendChild(final);
  }

  function loadAssistant(){
    const s=document.createElement('script');
    s.src='./assistant.js?v='+Date.now();
    s.async=false;
    s.onload=function(){
      applyAssistantPositionOverrides();
      keepOverridesLast();
      setInterval(function(){applyAssistantPositionOverrides();keepOverridesLast();applyFinalUiFixes();},500);
    };
    document.head.appendChild(s);
  }
  injectEarlyVisualOverrides();
  setInterval(applyFinalUiFixes,500);
  fetch(GOOD_WRAPPER_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);applyAssistantPositionOverrides();keepOverridesLast();setTimeout(loadAssistant,350);})
    .catch(()=>setTimeout(loadAssistant,350));
})();
