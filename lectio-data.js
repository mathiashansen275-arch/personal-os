// Loads the newest stable Personal OS layer, then applies today's cleanup and stable one-line UI rules.
// UI patch version: newest-stable-v4
(function(){
  const PREV_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/f533b1b48ed069abda8766ed7fbce19d50a92d7f/lectio-data.js';
  const STATE_KEY='personalOS.schedule.v5';
  const PX=1.22;

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
    let s=document.getElementById('assistant-stable-v4-fixes');
    if(!s){s=document.createElement('style');s.id='assistant-stable-v4-fixes';document.head.appendChild(s)}
    s.textContent=`
      #scheduleView .event.aiOneLineSmall{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important;padding-top:1px!important;padding-bottom:1px!important}
      #scheduleView .event.aiOneLineSmall .time{display:block!important;width:100%!important;max-width:100%!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;font-size:11.5px!important;line-height:1!important;font-weight:850!important;padding-right:0!important;letter-spacing:-.01em!important}
      #scheduleView .event.aiOneLineSmall .title{display:none!important}
      #scheduleView .event.homework .title,#scheduleView .event.wind .title{display:none!important}
      #scheduleView .event.homework .time,#scheduleView .event.wind .time{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;font-size:11.5px!important;letter-spacing:-.01em!important}
      #scheduleView .event.break,#scheduleView .event.aiBreakHidden,#scheduleView .event.aiFreeHidden,#scheduleView .event.focus:not(.business):not(.personal),#scheduleView .event.deep:not(.business):not(.personal){display:none!important}
    `;
    document.head.appendChild(s);
  }

  function parseTime(txt){
    const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    return {start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),raw:m[0]};
  }

  function cleanTitle(text){return String(text||'').replace(/^\s*2i\s+/i,'').replace(/^\s*available block\s*$/i,'').replace(/\s+/g,' ').trim()}

  function removeAvailableAndNormalize(){
    injectCss();
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const titleEl=el.querySelector('.title');
      const timeEl=el.querySelector('.time');
      const title=cleanTitle(titleEl&&titleEl.textContent||'');
      if(/^available block$/i.test(title)||el.classList.contains('aiFreeHidden')||((el.classList.contains('focus')||el.classList.contains('deep'))&&!el.classList.contains('business')&&!el.classList.contains('personal'))){el.remove();return}
      if(!timeEl)return;
      if(!el.dataset.v4BaseTime)el.dataset.v4BaseTime=timeEl.textContent;
      if(titleEl&&!el.dataset.v4BaseTitle)el.dataset.v4BaseTitle=titleEl.textContent;
      const t=parseTime(timeEl.textContent)||parseTime(el.dataset.v4BaseTime);
      if(!t)return;
      let labelTitle=cleanTitle(el.dataset.v4BaseTitle||title);
      if(el.classList.contains('wind'))labelTitle='Wind down';
      if(el.classList.contains('homework'))labelTitle=cleanTitle(labelTitle||'Homework');
      if(t.end-t.start<=30 && labelTitle){
        timeEl.textContent=t.raw+' '+labelTitle;
        el.classList.add('aiOneLineSmall');
        if(titleEl)titleEl.style.display='none';
      }
      if(el.classList.contains('homework')&&labelTitle){
        timeEl.textContent=t.raw+' '+labelTitle;
        el.classList.add('aiOneLineSmall');
        if(titleEl){titleEl.textContent=labelTitle;titleEl.style.display='none'}
      }
      if(el.classList.contains('wind')){
        timeEl.textContent=t.raw+' Wind down';
        el.classList.add('aiOneLineSmall');
        if(titleEl)titleEl.style.display='none';
      }
    });
  }

  function hardProgressZeroFuture(){
    const side=document.querySelector('#todoView .todoSide');
    if(!side)return;
    const today=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const rows=Array.from(document.querySelectorAll('#todoView tbody tr,#todoView .todoRow')).filter(r=>r.querySelector('input[type=checkbox]'));
    const real=rows.filter(r=>{const i=r.querySelector('input[type=text],textarea,[contenteditable=true]');const txt=((i&&('value'in i?i.value:i.textContent))||'').trim().toLowerCase();return txt&&txt!=='new task'});
    const pct=real.length?Math.round(real.filter(r=>{const cb=r.querySelector('input[type=checkbox]');return cb&&cb.checked}).length/real.length*100):0;
    side.querySelectorAll('.todoDay').forEach(card=>{
      const label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();
      const isToday=/^Today/i.test(label)||new RegExp('^'+today+'\\b','i').test(label);
      const p=isToday?pct:0;
      const top=card.querySelector('.todoDayTop'),fill=card.querySelector('.todoBarFill');
      if(top){const spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=p+'%'}
      if(fill)fill.style.width=p+'%';
    });
  }

  function apply(){removeAvailableAndNormalize();hardProgressZeroFuture()}

  cleanupTodayTaskBlocks();
  injectCss();
  fetch(PREV_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);cleanupTodayTaskBlocks();try{if(typeof render==='function')render()}catch(e){};apply();setTimeout(apply,50);setTimeout(apply,300);setTimeout(apply,900);setInterval(apply,250);})
    .catch(()=>{apply();setInterval(apply,250)});
})();
