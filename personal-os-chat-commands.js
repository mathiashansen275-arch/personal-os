(function(){
  function say(text,who){
    var box=document.getElementById('aiChatMessages');
    if(!box)return;
    var d=document.createElement('div');
    d.className='aiMsg '+(who||'assistant');
    d.textContent=text;
    box.appendChild(d);
    box.scrollTop=box.scrollHeight;
  }
  function run(){
    var input=document.getElementById('aiChatInput');
    if(!input)return false;
    var text=(input.value||'').trim();
    if(!text)return false;
    var lower=text.toLowerCase();
    var number=(lower.match(/(\d+)\s*(m|min|minute|minutes)/)||[])[1];
    var wantsMove=lower.indexOf('move')>=0||lower.indexOf('shift')>=0||lower.indexOf('push')>=0;
    var wantsNext=lower.indexOf('next')>=0||lower.indexOf('upcoming')>=0;
    var wantsLater=lower.indexOf('future')>=0||lower.indexOf('later')>=0||lower.indexOf('forward')>=0;
    if(wantsMove&&wantsNext&&wantsLater&&number&&typeof window.personalOSShiftNextScheduledTask==='function'){
      input.value='';
      say(text,'user');
      var minutes=Number(number)||5;
      var n=window.personalOSShiftNextScheduledTask(minutes);
      say(n?'Moved the next generated task and the following generated tasks '+minutes+' minutes later.':'No upcoming generated task found.','assistant');
      return true;
    }
    return false;
  }
  function install(){
    var send=document.getElementById('aiChatSend');
    var input=document.getElementById('aiChatInput');
    if(send&&!send.dataset.posCommands){send.dataset.posCommands='1';send.addEventListener('click',function(e){if(run()){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}},true)}
    if(input&&!input.dataset.posCommands){input.dataset.posCommands='1';input.addEventListener('keydown',function(e){if(e.key==='Enter'&&run()){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}},true)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,700);
})();
