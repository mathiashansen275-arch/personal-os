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
        .aiCostBadge{position:absolute!important;top:102px!important;right:24px!important;z-index:40!important}
      `;
      document.head.appendChild(style);
    }
    const app=document.querySelector('.app');
    const badge=document.getElementById('aiCostBadge');
    if(app&&badge&&badge.parentElement!==app)app.appendChild(badge);
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
