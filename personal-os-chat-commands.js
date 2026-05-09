(function(){
  var STATE_KEY='personalOS.schedule.v5';
  function pad(n){return String(n).padStart(2,'0')}
  function hm(m){return pad(Math.floor(m/60))+':'+pad(Math.round(m%60))}
  function mins(s){s=String(s||'00:00');return Number(s.slice(0,2))*60+Number(s.slice(3,5))}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'')||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function stateObj(){var s=read(STATE_KEY,{custom:[]});if(!Array.isArray(s.custom))s.custom=[];return s}
  function saveStateObj(s){write(STATE_KEY,s);try{window.state=s}catch(e){}try{state=s}catch(e){}try{if(typeof render==='function')render()}catch(e){}}
  function say(text,who){var box=document.getElementById('aiChatMessages');if(!box)return;var d=document.createElement('div');d.className='aiMsg '+(who||'assistant');d.textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight}
  function todayDate(){return ymd(new Date())}
  function parseClock(text){var m=String(text||'').match(/\b(?:after|from|past)\s*(\d{1,2})(?::(\d{2}))?\b/i);if(!m)return null;var h=Number(m[1]),mi=Number(m[2]||0);if(h<6)h+=12;return h*60+mi}
  function upcomingBlocks(){var s=stateObj(),today=todayDate(),now=new Date(),n=now.getHours()*60+now.getMinutes();return (s.custom||[]).filter(function(c){return c&&c.aiCreated&&(c.date>today||(c.date===today&&mins(c.end)>n))}).sort(function(a,b){return String(a.date).localeCompare(String(b.date))||mins(a.start)-mins(b.start)})}
  function removeAfterToday(cutoff){var s=stateObj(),before=s.custom.length,today=todayDate();s.custom=s.custom.filter(function(c){return !(c&&c.aiCreated&&c.date===today&&mins(c.start)>=cutoff)});saveStateObj(s);return before-s.custom.length}
  function removeAllAfterToday(cutoff){var s=stateObj(),before=s.custom.length,today=todayDate();s.custom=s.custom.filter(function(c){return !(c&&c.aiCreated&&c.date===today&&mins(c.end)>cutoff)});saveStateObj(s);return before-s.custom.length}
  function shiftNext(minutes){if(typeof window.personalOSShiftNextScheduledTask==='function')return window.personalOSShiftNextScheduledTask(minutes);var s=stateObj(),blocks=upcomingBlocks();if(!blocks.length)return 0;var first=blocks[0],start=false,n=0;blocks.forEach(function(c){if(c.id===first.id)start=true;if(start){c.start=hm(mins(c.start)+minutes);c.end=hm(mins(c.end)+minutes);n++}});saveStateObj(s);return n}
  function resizeNext(delta){var s=stateObj(),blocks=upcomingBlocks();if(!blocks.length)return 0;blocks[0].end=hm(Math.max(mins(blocks[0].start)+45,mins(blocks[0].end)+delta));for(var i=1;i<blocks.length;i++){if(blocks[i].date===blocks[i-1].date&&mins(blocks[i].start)<mins(blocks[i-1].end)){var dur=mins(blocks[i].end)-mins(blocks[i].start);blocks[i].start=blocks[i-1].end;blocks[i].end=hm(mins(blocks[i].start)+dur)}}saveStateObj(s);return blocks.length}
  function run(){
    var input=document.getElementById('aiChatInput');if(!input)return false;
    var text=(input.value||'').trim();if(!text)return false;
    var lower=text.toLowerCase();
    var handled=false,msg='';
    var minuteMatch=(lower.match(/(\d+)\s*(m|min|minute|minutes)/)||[])[1];
    if((lower.indexOf('remove')>=0||lower.indexOf('delete')>=0)&&lower.indexOf('after')>=0&&(lower.indexOf('today')>=0||lower.indexOf('tonight')>=0)){
      var cutoff=parseClock(lower);
      if(cutoff!=null){var removed=removeAllAfterToday(cutoff);handled=true;msg=removed?'Removed '+removed+' generated task block'+(removed===1?'':'s')+' after '+hm(cutoff)+' today.':'No generated task blocks found after '+hm(cutoff)+' today.'}
    }
    if(!handled&&(lower.indexOf('move')>=0||lower.indexOf('shift')>=0||lower.indexOf('push')>=0)&&(lower.indexOf('next')>=0||lower.indexOf('upcoming')>=0)&&(lower.indexOf('future')>=0||lower.indexOf('later')>=0||lower.indexOf('forward')>=0)&&minuteMatch){
      var minutes=Number(minuteMatch)||5;var n=shiftNext(minutes);handled=true;msg=n?'Moved the next generated task and following generated tasks '+minutes+' minutes later.':'No upcoming generated task found.';
    }
    if(!handled&&(lower.indexOf('shorten')>=0||lower.indexOf('make')>=0&&lower.indexOf('shorter')>=0)&&(lower.indexOf('next')>=0||lower.indexOf('upcoming')>=0)&&minuteMatch){
      var by=Number(minuteMatch)||5;var ns=resizeNext(-by);handled=true;msg=ns?'Shortened the next generated task by '+by+' minutes and pulled following generated blocks forward if needed.':'No upcoming generated task found.';
    }
    if(!handled&&(lower.indexOf('lengthen')>=0||lower.indexOf('extend')>=0||lower.indexOf('longer')>=0)&&(lower.indexOf('next')>=0||lower.indexOf('upcoming')>=0)&&minuteMatch){
      var add=Number(minuteMatch)||5;var nl=resizeNext(add);handled=true;msg=nl?'Extended the next generated task by '+add+' minutes and moved following generated blocks if needed.':'No upcoming generated task found.';
    }
    if(!handled&&(lower.indexOf('schedule')>=0||lower.indexOf('allocate')>=0||lower.indexOf('delegate')>=0)&&lower.indexOf('task')>=0&&typeof window.personalOSUpdateSchedule==='function'){
      var made=window.personalOSUpdateSchedule();handled=true;msg=made?'Scheduled '+made+' generated task block'+(made===1?'':'s')+'.':'No free time found for those tasks.';
    }
    if(handled){input.value='';say(text,'user');say(msg,'assistant');return true}
    return false;
  }
  function install(){var send=document.getElementById('aiChatSend'),input=document.getElementById('aiChatInput');if(send&&!send.dataset.posCommands){send.dataset.posCommands='1';send.addEventListener('click',function(e){if(run()){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}},true)}if(input&&!input.dataset.posCommands){input.dataset.posCommands='1';input.addEventListener('keydown',function(e){if(e.key==='Enter'&&run()){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}},true)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();setInterval(install,700);
})();
