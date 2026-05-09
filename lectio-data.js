// Personal OS loader: preserve current OS wrapper, then enable cloud auth/sync.
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
  function loadExistingOs(){
    return fetch(EXISTING_OS,{cache:'no-store'}).then(function(r){
      if(!r.ok)throw new Error('Failed to load Personal OS wrapper');
      return r.text();
    }).then(function(code){
      (0,eval)(code);
    });
  }
  function boot(){
    loadExistingOs().then(function(){
      return loadScript('./cloud-sync.js?v='+Date.now(),'personal-os-cloud-sync');
    }).then(function(){
      return loadScript('./personal-os-ui-controls.js?v='+Date.now(),'personal-os-ui-controls');
    }).then(function(){
      return loadScript('./personal-os-scheduler-override.js?v='+Date.now(),'personal-os-scheduler-override');
    }).then(function(){
      return loadScript('./personal-os-agent-tools.js?v='+Date.now(),'personal-os-agent-tools');
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
