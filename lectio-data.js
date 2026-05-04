// Loads the last known-good Personal OS layer, then loads the DeepSeek assistant.
(function(){
  const GOOD_WRAPPER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/50bd59a53b151fd3deac3b2bbd34521945c4ce16/lectio-data.js';
  function loadAssistant(){
    const s=document.createElement('script');
    s.src='./assistant.js?v='+Date.now();
    s.async=false;
    document.head.appendChild(s);
  }
  fetch(GOOD_WRAPPER_URL,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>{(0,eval)(code);setTimeout(loadAssistant,1200);})
    .catch(()=>setTimeout(loadAssistant,1200));
})();
