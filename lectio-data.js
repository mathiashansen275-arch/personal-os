// Loader for the latest stable Personal OS layer plus the DeepSeek assistant.
(function(){
  const STABLE_LAYER_URL='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/5d487999a2ddc2729ba69cc573e0679244ff3ec9/lectio-data.js';
  function load(src,onload){
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    if(onload)s.onload=onload;
    document.head.appendChild(s);
  }
  load(STABLE_LAYER_URL,function(){
    load('./assistant.js?v='+Date.now());
  });
})();
