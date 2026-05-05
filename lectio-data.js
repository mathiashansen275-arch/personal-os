// Loads the newest stable Personal OS layer, then applies the <=30 minute one-line schedule rule.
// UI patch version: newest-stable-v3
(function(){
  const PREV_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/d2a40cecc5c56e305d5811448b767de99ded090f/lectio-data.js';

  function injectThirtyMinuteRuleCss(){
    let s=document.getElementById('assistant-thirty-minute-one-line-rule');
    if(!s){
      s=document.createElement('style');
      s.id='assistant-thirty-minute-one-line-rule';
      document.head.appendChild(s);
    }
    s.textContent=`
      #scheduleView .event.aiOneLineSmall{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;text-align:left!important;padding-top:2px!important;padding-bottom:2px!important}
      #scheduleView .event.aiOneLineSmall .time{display:block!important;width:100%!important;max-width:100%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-align:left!important;font-size:12px!important;line-height:1!important;font-weight:850!important;padding-right:0!important}
      #scheduleView .event.aiOneLineSmall .title{display:none!important}
      #scheduleView .event.homework .time,#scheduleView .event.wind .time{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #scheduleView .event.homework .title,#scheduleView .event.wind .title{display:none!important}
    `;
    document.head.appendChild(s);
  }

  function parseTime(txt){
    const m=String(txt||'').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if(!m)return null;
    return {start:Number(m[1])*60+Number(m[2]),end:Number(m[3])*60+Number(m[4]),raw:m[0]};
  }

  function cleanTitle(text){
    return String(text||'')
      .replace(/^\s*2i\s+/i,'')
      .replace(/^\s*available block\s*$/i,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function normalizeSmallOneLineBlocks(){
    injectThirtyMinuteRuleCss();
    document.querySelectorAll('#scheduleView .event').forEach(el=>{
      const timeEl=el.querySelector('.time');
      const titleEl=el.querySelector('.title');
      if(!timeEl)return;
      if(!el.dataset.oneLineBaseTime)el.dataset.oneLineBaseTime=timeEl.textContent;
      if(titleEl && !el.dataset.oneLineBaseTitle)el.dataset.oneLineBaseTitle=titleEl.textContent;
      const t=parseTime(timeEl.textContent)||parseTime(el.dataset.oneLineBaseTime);
      if(!t)return;
      const dur=t.end-t.start;
      const title=cleanTitle(el.dataset.oneLineBaseTitle || (titleEl&&titleEl.textContent) || '');
      if(dur<=30 && title){
        const label=t.raw+' '+title;
        timeEl.textContent=label;
        el.classList.add('aiOneLineSmall');
        if(titleEl)titleEl.style.display='none';
      }
      if(el.classList.contains('homework')){
        const homeworkTitle=cleanTitle(title || (titleEl&&titleEl.textContent) || 'Homework');
        if(titleEl){
          titleEl.textContent=homeworkTitle;
          titleEl.style.display='none';
          el.dataset.aiFullTitle=homeworkTitle;
          el.dataset.oneLineBaseTitle=homeworkTitle;
        }
        if(!/\bHW\b/i.test(timeEl.textContent) && homeworkTitle){
          const tt=parseTime(timeEl.textContent);
          if(tt)timeEl.textContent=tt.raw+' '+homeworkTitle;
        }
      }
      if(el.classList.contains('wind')){
        const tt=parseTime(timeEl.textContent);
        if(tt)timeEl.textContent=tt.raw+' Wind down';
        if(titleEl)titleEl.style.display='none';
      }
    });
  }

  function startPatch(){
    normalizeSmallOneLineBlocks();
    setTimeout(normalizeSmallOneLineBlocks,50);
    setTimeout(normalizeSmallOneLineBlocks,300);
    setTimeout(normalizeSmallOneLineBlocks,900);
    setInterval(normalizeSmallOneLineBlocks,1000);
  }

  fetch(PREV_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);startPatch();})
    .catch(()=>startPatch());
})();
