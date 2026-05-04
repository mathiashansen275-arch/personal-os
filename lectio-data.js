// Loader for the latest stable schedule/to-do layer plus the DeepSeek assistant.
(function(){
  const STABLE_LAYER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/ff7e25cc7c0ae552cacb2430c963bc932934a3f0/lectio-data.js';
  function add(src){
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    document.head.appendChild(s);
    return s;
  }
  const stable=add(STABLE_LAYER_URL);
  stable.onload=function(){add('./assistant.js?v='+Date.now())};
  stable.onerror=function(){add('./assistant.js?v='+Date.now())};
})();
