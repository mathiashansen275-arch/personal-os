// Loads the last known-good Personal OS layer, then loads the DeepSeek assistant.
(function(){
  const GOOD_WRAPPER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';

  function applyAssistantPositionOverrides(){
    if(!document.getElementById('assistant-position-overrides')){
      const style=document.createElement('style');
      style.id='assistant-position-overrides';
      style.textContent=`
        .app{position:relative!important}
        .aiChatButton{left:13px!important}
        .aiCostBadge{position:absolute!important;top:136px!important;right:24px!important;z-index:40!important}
        .aiChatHeader{border-bottom:none!important;font-weight:650!important}
        #aiChatInput,.aiChatInput input{font-weight:500!important;letter-spacing:0!important}
        #aiChatInput::placeholder{font-weight:650!important;opacity:.72!important}
        .aiMsg{font-weight:500!important;letter-spacing:0!important;max-width:100%!important;align-self:stretch!important;box-sizing:border-box!important}
        .aiChatInput button{font-weight:900!important}
        .aiSuggestions{display:flex;flex-wrap:wrap;gap:8px;padding:14px 14px 0 14px!important;border-top:none!important;order:0!important}
        .aiSuggest{height:34px;border-radius:999px;border:1px solid #49306c;background:#090812;color:#fff;font-weight:800;font-size:12px;letter-spacing:0;padding:0 12px}
        .aiSuggest:hover{border-color:#9b6cff;background:#120d20}
        .event.business{background:rgba(48,64,24,.72)!important;border-color:#9caf55!important;color:#dbe8a6!important}
        .event.business .time,.event.business .title{color:#dbe8a6!important}
        .event.personal{background:rgba(76,0,45,.58)!important;border-color:#ff45d6!important;color:#ff69e2!important}
        .event.personal .time,.event.personal .title{color:#ff69e2!important}
        .event.focus .title,.event.deep .title{font-size:0!important}
        .event.focus .title::after,.event.deep .title::after{content:'Available block';font-size:14px!important}
        .event.small.focus .title::after,.event.small.deep .title::after{font-size:11px!important}
      `;
      document.head.appendChild(style);
    }
    const app=document.querySelector('.app');
    const badge=document.getElementById('aiCostBadge');
    if(app&&badge&&badge.parentElement!==app)app.appendChild(badge);

    const box=document.getElementById('aiChatMessages');
    const input=document.getElementById('aiChatInput');
    if(box&&input&&!document.getElementById('aiSuggestions')){
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
  fetch(GOOD_WRAPPER_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);setTimeout(loadAssistant,1200);})
    .catch(()=>setTimeout(loadAssistant,1200));
})();
