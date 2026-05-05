// Loads the last known-good Personal OS layer, then loads the DeepSeek assistant.
(function(){
  const GOOD_WRAPPER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';

  function injectEarlyVisualOverrides(){
    if(document.getElementById('assistant-early-visual-overrides'))return;
    const style=document.createElement('style');
    style.id='assistant-early-visual-overrides';
    style.textContent=`
      #scheduleView .event.time-past,.event.time-past{opacity:.82!important;filter:brightness(1.30) saturate(1.08)!important}
      #scheduleView .event.time-past::after,.event.time-past::after{display:none!important;opacity:0!important;background:transparent!important}
      #scheduleView .event.time-past .time,#scheduleView .event.time-past .title,.event.time-past .time,.event.time-past .title{opacity:1!important}
      #scheduleView .event.business,.event.business{background:rgba(48,64,24,.72)!important;border-color:#9caf55!important;color:#dbe8a6!important}
      #scheduleView .event.business .time,#scheduleView .event.business .title,.event.business .time,.event.business .title{color:#dbe8a6!important}
      #scheduleView .event.personal,.event.personal{background:rgba(76,0,45,.58)!important;border-color:#ff45d6!important;color:#ff69e2!important}
      #scheduleView .event.personal .time,#scheduleView .event.personal .title,.event.personal .time,.event.personal .title{color:#ff69e2!important}
      #scheduleView .event.focus .title,#scheduleView .event.deep .title,.event.focus .title,.event.deep .title{font-size:0!important}
      #scheduleView .event.focus .title::after,#scheduleView .event.deep .title::after,.event.focus .title::after,.event.deep .title::after{content:'Available block';font-size:14px!important}
      #scheduleView .event.small.focus .title::after,#scheduleView .event.small.deep .title::after,.event.small.focus .title::after,.event.small.deep .title::after{font-size:11px!important}
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
        #scheduleView .event.time-past,.event.time-past{opacity:.82!important;filter:brightness(1.30) saturate(1.08)!important}
        #scheduleView .event.time-past::after,.event.time-past::after{display:none!important;opacity:0!important;background:transparent!important}
        #scheduleView .event.time-past .time,#scheduleView .event.time-past .title,.event.time-past .time,.event.time-past .title{opacity:1!important}
        #scheduleView .event.business,.event.business{background:rgba(48,64,24,.72)!important;border-color:#9caf55!important;color:#dbe8a6!important}
        #scheduleView .event.business .time,#scheduleView .event.business .title,.event.business .time,.event.business .title{color:#dbe8a6!important}
        #scheduleView .event.personal,.event.personal{background:rgba(76,0,45,.58)!important;border-color:#ff45d6!important;color:#ff69e2!important}
        #scheduleView .event.personal .time,#scheduleView .event.personal .title,.event.personal .time,.event.personal .title{color:#ff69e2!important}
        #scheduleView .event.focus .title,#scheduleView .event.deep .title,.event.focus .title,.event.deep .title{font-size:0!important}
        #scheduleView .event.focus .title::after,#scheduleView .event.deep .title::after,.event.focus .title::after,.event.deep .title::after{content:'Available block';font-size:14px!important}
        #scheduleView .event.small.focus .title::after,#scheduleView .event.small.deep .title::after,.event.small.focus .title::after,.event.small.deep .title::after{font-size:11px!important}
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
  }

  function loadAssistant(){
    const s=document.createElement('script');
    s.src='./assistant.js?v='+Date.now();
    s.async=false;
    s.onload=function(){
      applyAssistantPositionOverrides();
      setInterval(applyAssistantPositionOverrides,700);
    };
    document.head.appendChild(s);
  }
  injectEarlyVisualOverrides();
  fetch(GOOD_WRAPPER_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);applyAssistantPositionOverrides();setTimeout(loadAssistant,350);})
    .catch(()=>setTimeout(loadAssistant,350));
})();
