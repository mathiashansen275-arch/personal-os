// DeepSeek assistant loader with stable progress stats patch.
(function(){
  const BASE_ASSISTANT='https://raw.githubusercontent.com/mathiashansen275-arch/personal-os/f533b1b48ed069abda8766ed7fbce19d50a92d7f/assistant.js';
  function patch(code){
    const replacement=`function updateTodoStats(){try{var today=todayKey(),stats=loadJson(STATS_KEY,{}),snap=snapshotToday();stats[today]=snap;var tDate=new Date(today+'T00:00:00');Object.keys(stats).forEach(function(k){var d=new Date(k+'T00:00:00');if(d>tDate)stats[k]={done:0,total:0,pct:0}});saveJsonLocal(STATS_KEY,stats);var side=document.querySelector('#todoView .todoSide');if(!side)return;var currentDay=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];Array.from(side.querySelectorAll('.todoDay')).forEach(function(card){var label=((card.querySelector('.todoDayTop span')||{}).textContent||card.textContent||'').trim();var isToday=/^Today/i.test(label)||new RegExp('^'+currentDay+'\\\\b','i').test(label);var p=isToday?snap.pct:0;var top=card.querySelector('.todoDayTop'),fill=card.querySelector('.todoBarFill');if(top){var spans=top.querySelectorAll('span');if(spans[1])spans[1].textContent=p+'%'}if(fill)fill.style.width=p+'%'});var title=Array.from(side.querySelectorAll('.todoChartTitle')).find(function(x){return /Next 7 days|This week/i.test(x.textContent||'')});if(title){title.textContent='This week';var chart=title.parentElement&&title.parentElement.querySelector('.barChart');if(chart)chart.innerHTML=DAYS.map(function(day){var p=day===currentDay?snap.pct:0;return '<div class="chartCol"><div class="chartBar" style="height:'+Math.max(2,p)+'%"></div><div class="chartLabel">'+day.slice(0,3)+'</div></div>'}).join('')}}catch(e){}}`;
    return code.replace(/function updateTodoStats\(\)\{[\s\S]*?\nfunction addMsg\(/, replacement+'\nfunction addMsg(');
  }
  fetch(BASE_ASSISTANT,{cache:'no-store'})
    .then(r=>r.text())
    .then(code=>(0,eval)(patch(code)))
    .catch(()=>{});
})();
