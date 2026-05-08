// Personal OS loader: preserve existing OS behavior, then enable cloud auth/sync.
(function(){
  const EXISTING_OS='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/1a85bacfe9fe3a4eb654ecc05df1adb61e0c58c9/lectio-data.js';
  function loadScript(src,id){
    return new Promise(function(resolve,reject){
      if(id&&document.getElementById(id)){resolve();return;}
      const s=document.createElement('script');
      if(id)s.id=id;
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  function boot(){
    loadScript(EXISTING_OS,'personal-os-existing-loader').then(function(){
      return loadScript('./cloud-sync.js?v='+Date.now(),'personal-os-cloud-sync');
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
