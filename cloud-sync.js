// Personal OS cloud sync: Supabase email/password auth + shared localStorage keys.
// Loads only when /api/config has SUPABASE_URL and SUPABASE_ANON_KEY configured.
(function(){
  const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_KEY = 'personalOS.cloudSessionStartedAt.v1';
  const TASK_DIRTY_KEY = 'personalOS.tasksDirty.v1';
  const SYNC_KEYS = [
    'personalOS.tasks.v1',
    'personalOS.schedule.v5',
    'personalOS.productivity.v1',
    'personalOS.todoStats.v2',
    'personalOS.lastCompletedTaskCleanupDate.v1'
  ];
  const originalSetItem = localStorage.setItem.bind(localStorage);
  let client = null;
  let userId = null;
  let applyingRemote = false;
  let syncing = false;
  let polling = false;
  let flushingTasks = false;
  let lastLocalWriteAt = 0;
  let taskFlushTimer = 0;
  const remoteUpdatedAt = {};

  function isSyncKey(key){ return SYNC_KEYS.includes(String(key)); }
  function sessionExpired(){
    const started = Number(localStorage.getItem(SESSION_KEY) || 0);
    return !started || Date.now() - started > SESSION_MAX_AGE_MS;
  }
  function markSession(){ originalSetItem(SESSION_KEY, String(Date.now())); }
  function markTasksDirty(){ originalSetItem(TASK_DIRTY_KEY, String(Date.now())); }
  function clearTasksDirty(){ try{ localStorage.removeItem(TASK_DIRTY_KEY); }catch(e){} }
  function hardReload(){ setTimeout(()=>location.reload(), 80); }
  function rerender(){
    try{ if(typeof render === 'function') render(); }catch(e){}
    try{ if(typeof renderTasks === 'function') renderTasks(); }catch(e){}
    try{ if(typeof renderProductivity === 'function') renderProductivity(); }catch(e){}
  }
  function liveTasks(){
    try{ if(Array.isArray(tasks)) return tasks; }catch(e){}
    try{ if(Array.isArray(window.tasks)) return window.tasks; }catch(e){}
    return null;
  }
  function storedTasks(){
    try{
      const parsed = JSON.parse(localStorage.getItem('personalOS.tasks.v1') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){ return []; }
  }
  function setLiveTasks(arr){
    try{ window.tasks = arr; }catch(e){}
    try{ tasks = arr; }catch(e){}
  }
  function applyRemoteValue(key, value){
    applyingRemote = true;
    try{
      originalSetItem(key, JSON.stringify(value));
      if(key === 'personalOS.tasks.v1' && Array.isArray(value)){
        setLiveTasks(value);
        clearTasksDirty();
      }
      if(key === 'personalOS.schedule.v5' && value && typeof value === 'object'){
        try{ window.state = value; }catch(e){}
        try{ state = value; }catch(e){}
      }
    }finally{ applyingRemote = false; }
  }
  function toastMsg(msg){
    try{ if(typeof toast === 'function'){ toast(msg); return; } }catch(e){}
    let el=document.getElementById('posCloudToast');
    if(!el){
      el=document.createElement('div');
      el.id='posCloudToast';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:100000;background:#090812;color:#fff;border:1px solid #7f52ff;border-radius:12px;padding:12px 14px;font-weight:900;box-shadow:0 12px 34px rgba(0,0,0,.55)';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.remove(),2600);
  }

  async function getConfig(){
    try{
      const r = await fetch('/api/config', {cache:'no-store'});
      if(!r.ok) return {};
      return await r.json();
    }catch(e){ return {}; }
  }

  async function loadSupabase(){
    if(window.supabase) return window.supabase;
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.supabase;
  }

  function showLogin(allowedEmail){
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;padding:24px;';
    wrap.innerHTML = '<form id="posLogin" style="width:min(420px,100%);border:1px solid #49306c;border-radius:18px;background:#070710;padding:22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 0 60px rgba(155,108,255,.18)"><h1 style="margin:0 0 6px;font-size:26px;">Personal OS</h1><p style="margin:0 0 8px;color:#b8a7dc;line-height:1.35;">Log in to sync your private OS across devices. You will stay signed in for 30 days.</p><input id="posEmail" type="email" placeholder="Email" autocomplete="email" required style="height:44px;border-radius:10px;border:1px solid #352456;background:#090812;color:#fff;padding:0 12px;font-weight:800;"><input id="posPassword" type="password" placeholder="Password" autocomplete="current-password" required style="height:44px;border-radius:10px;border:1px solid #352456;background:#090812;color:#fff;padding:0 12px;font-weight:800;"><button style="height:46px;border-radius:11px;border:1px solid #7f52ff;background:#482096;color:#fff;font-weight:1000;cursor:pointer;">LOG IN</button><div id="posLoginMsg" style="min-height:20px;color:#ff8f9a;font-size:13px;"></div></form>';
    document.body.appendChild(wrap);
    document.getElementById('posLogin').onsubmit = async e => {
      e.preventDefault();
      const email = document.getElementById('posEmail').value.trim();
      const password = document.getElementById('posPassword').value;
      const msg = document.getElementById('posLoginMsg');
      if(allowedEmail && email.toLowerCase() !== allowedEmail.toLowerCase()){
        msg.textContent = 'This email is not allowed.';
        return;
      }
      msg.textContent = 'Logging in...';
      const {data,error} = await client.auth.signInWithPassword({email,password});
      if(error){ msg.textContent = error.message; return; }
      if(allowedEmail && data.user && data.user.email && data.user.email.toLowerCase() !== allowedEmail.toLowerCase()){
        await client.auth.signOut();
        msg.textContent = 'This email is not allowed.';
        return;
      }
      markSession();
      hardReload();
    };
  }

  async function pullKey(key, force){
    const {data,error} = await client
      .from('user_kv')
      .select('value,updated_at')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();
    if(error) throw error;
    if(!data || data.value == null) return false;
    const remoteValue = JSON.stringify(data.value);
    const localValue = localStorage.getItem(key);
    if(remoteValue === localValue){
      remoteUpdatedAt[key] = data.updated_at || remoteUpdatedAt[key] || String(Date.now());
      return false;
    }
    if(!force && data.updated_at && remoteUpdatedAt[key] === data.updated_at) return false;
    remoteUpdatedAt[key] = data.updated_at || String(Date.now());
    applyRemoteValue(key, data.value);
    return true;
  }

  async function pushKey(key){
    if(!client || !userId || !isSyncKey(key) || applyingRemote) return false;
    let parsed = null;
    try{ parsed = JSON.parse(localStorage.getItem(key) || 'null'); }catch(e){ throw e; }
    const updatedAt = new Date().toISOString();
    const {data,error} = await client.from('user_kv').upsert({
      user_id: userId,
      key,
      value: parsed,
      updated_at: updatedAt
    }, {onConflict:'user_id,key'}).select('updated_at').maybeSingle();
    if(error) throw error;
    remoteUpdatedAt[key] = (data && data.updated_at) || updatedAt;
    if(key === 'personalOS.tasks.v1') clearTasksDirty();
    return true;
  }

  function visibleTasksSnapshot(){
    const live = liveTasks();
    const arr = (Array.isArray(live) ? live : storedTasks()).slice();
    const byId = new Map(arr.filter(Boolean).map(t=>[t.id,t]));
    let changed = false;
    document.querySelectorAll('#todoView .todoRow').forEach(row=>{
      const id = row.dataset && row.dataset.id;
      if(!id) return;
      let task = byId.get(id);
      if(!task){
        task = {id, done:false, text:'', day:'', area:'Personal', createdAt:new Date().toISOString()};
        arr.push(task);
        byId.set(id, task);
        changed = true;
      }
      const textEl = row.querySelector('.taskPill,.taskTextInput');
      const checkEl = row.querySelector('.taskCheck');
      const dayEl = row.querySelector('.cellSelect');
      if(textEl && task.text !== textEl.value){ task.text = textEl.value; changed = true; }
      if(checkEl && !!task.done !== !!checkEl.checked){
        task.done = !!checkEl.checked;
        if(task.done && !task.completedAt) task.completedAt = new Date().toISOString();
        if(!task.done && task.completedAt) delete task.completedAt;
        changed = true;
      }
      if(dayEl && task.day !== dayEl.value){ task.day = dayEl.value; changed = true; }
    });
    return {tasks:arr, changed};
  }

  function captureVisibleTasks(){
    const snap = visibleTasksSnapshot();
    if(!snap.tasks.length) return false;
    setLiveTasks(snap.tasks);
    const serialized = JSON.stringify(snap.tasks);
    if(serialized !== localStorage.getItem('personalOS.tasks.v1')){
      originalSetItem('personalOS.tasks.v1', serialized);
      markTasksDirty();
      return true;
    }
    return snap.changed;
  }

  async function flushTasksToCloud(){
    if(applyingRemote || flushingTasks) return false;
    flushingTasks = true;
    try{
      const changed = captureVisibleTasks();
      if(!changed && !localStorage.getItem(TASK_DIRTY_KEY)) return false;
      lastLocalWriteAt = Date.now();
      await pushKey('personalOS.tasks.v1');
      return true;
    }catch(e){
      console.error('Personal OS task flush failed', e);
      return false;
    }finally{
      flushingTasks = false;
    }
  }

  function scheduleTaskFlush(){
    lastLocalWriteAt = Date.now();
    markTasksDirty();
    captureVisibleTasks();
    clearTimeout(taskFlushTimer);
    taskFlushTimer = setTimeout(flushTasksToCloud, 450);
  }

  async function pushAllLocal(){
    if(!client || !userId){ toastMsg('Cloud sync is not ready yet'); return; }
    if(syncing){ toastMsg('Cloud sync is already running'); return; }
    syncing = true;
    try{
      await flushTasksToCloud();
      let uploaded = 0;
      for(const key of SYNC_KEYS){
        if(localStorage.getItem(key) != null && await pushKey(key)) uploaded++;
      }
      toastMsg(uploaded ? 'Uploaded '+uploaded+' keys to cloud' : 'Nothing local to upload');
    }catch(e){
      console.error('Personal OS cloud upload failed', e);
      toastMsg('Upload failed: '+(e && e.message ? e.message : 'check console'));
    }finally{ syncing = false; }
  }

  async function pullAllRemote(){
    if(!client || !userId){ toastMsg('Cloud sync is not ready yet'); return; }
    if(syncing){ toastMsg('Cloud sync is already running'); return; }
    syncing = true;
    try{
      clearTasksDirty();
      let downloaded = 0;
      for(const key of SYNC_KEYS){
        if(await pullKey(key, true)) downloaded++;
      }
      if(downloaded){
        toastMsg('Downloaded '+downloaded+' cloud keys. Reloading...');
        hardReload();
      }else{
        toastMsg('No cloud data found to download');
      }
    }catch(e){
      console.error('Personal OS cloud download failed', e);
      toastMsg('Download failed: '+(e && e.message ? e.message : 'check console'));
    }finally{ syncing = false; }
  }

  async function pollRemote(){
    await flushTasksToCloud();
    if(!client || !userId || syncing || polling || Date.now() - lastLocalWriteAt < 9000) return;
    polling = true;
    try{
      let changed = 0;
      for(const key of SYNC_KEYS){
        if(key === 'personalOS.tasks.v1' && localStorage.getItem(TASK_DIRTY_KEY)) continue;
        if(await pullKey(key, false)) changed++;
      }
      if(changed) rerender();
    }catch(e){
      console.error('Personal OS cloud polling failed', e);
    }finally{ polling = false; }
  }

  async function initialSync(){
    captureVisibleTasks();
    if(localStorage.getItem(TASK_DIRTY_KEY) && localStorage.getItem('personalOS.tasks.v1') != null){
      await pushKey('personalOS.tasks.v1');
    }else if(localStorage.getItem('personalOS.tasks.v1') == null){
      await pullKey('personalOS.tasks.v1', true);
    }else{
      await pullKey('personalOS.tasks.v1', false);
    }
    for(const key of SYNC_KEYS){
      if(key === 'personalOS.tasks.v1') continue;
      if(localStorage.getItem(key) == null) await pullKey(key, true);
      else await pullKey(key, false);
    }
    rerender();
  }

  function patchLocalStorageWrites(){
    localStorage.setItem = function(key, value){
      originalSetItem(key, value);
      if(isSyncKey(key)){
        if(!applyingRemote) lastLocalWriteAt = Date.now();
        if(key === 'personalOS.tasks.v1' && !applyingRemote) markTasksDirty();
        pushKey(key).catch(e=>console.error('Personal OS cloud auto-sync failed', e));
      }
    };
  }

  function installTaskFlushHandlers(){
    document.addEventListener('input', e=>{
      if(e.target && e.target.closest && e.target.closest('#todoView .taskPill,#todoView .taskTextInput')) scheduleTaskFlush();
    }, true);
    document.addEventListener('change', e=>{
      if(e.target && e.target.closest && e.target.closest('#todoView .taskCheck,#todoView .cellSelect,#todoView .taskPill,#todoView .taskTextInput')) scheduleTaskFlush();
    }, true);
    document.addEventListener('click', e=>{
      if(e.target && e.target.closest && e.target.closest('#addTask,#todoView .danger')) setTimeout(scheduleTaskFlush, 160);
    }, true);
    window.addEventListener('pagehide', ()=>{ captureVisibleTasks(); }, true);
    window.addEventListener('beforeunload', ()=>{ captureVisibleTasks(); }, true);
    document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushTasksToCloud(); }, true);
    setInterval(flushTasksToCloud, 2500);
  }

  function installCloudControls(){
    if(document.getElementById('posCloudUpload')) return;

    const wrap=document.createElement('div');
    wrap.id='posCloudControls';
    wrap.style.cssText=[
      'position:fixed',
      'right:18px',
      'top:82px',
      'z-index:1000000',
      'display:flex',
      'gap:8px',
      'pointer-events:auto'
    ].join(';');

    function absorb(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    function protectButton(btn, action){
      let lastRun = 0;
      function run(e){
        absorb(e);
        const now = Date.now();
        if(now - lastRun < 700) return;
        lastRun = now;
        action();
      }
      btn.addEventListener('pointerdown', absorb, true);
      btn.addEventListener('touchstart', absorb, true);
      btn.addEventListener('mousedown', absorb, true);
      btn.addEventListener('pointerup', run, true);
      btn.addEventListener('touchend', run, true);
      btn.addEventListener('click', run, true);
    }

    const up=document.createElement('button');
    up.id='posCloudUpload';
    up.type='button';
    up.textContent='UPLOAD THIS DEVICE';
    up.title='Make this device the cloud source of truth';
    up.style.cssText='height:40px;border-radius:10px;border:1px solid #136b51;background:#062015;color:#bfffdc;font-weight:1000;font-size:12px;padding:0 12px;letter-spacing:.06em;pointer-events:auto;cursor:pointer;touch-action:manipulation;';
    protectButton(up, pushAllLocal);

    const down=document.createElement('button');
    down.id='posCloudDownload';
    down.type='button';
    down.textContent='DOWNLOAD CLOUD';
    down.title='Replace this device with cloud data';
    down.style.cssText='height:40px;border-radius:10px;border:1px solid #49306c;background:#090812;color:#fff;font-weight:1000;font-size:12px;padding:0 12px;letter-spacing:.06em;pointer-events:auto;cursor:pointer;touch-action:manipulation;';
    protectButton(down, pullAllRemote);

    wrap.appendChild(up);
    wrap.appendChild(down);
    document.body.appendChild(wrap);
  }

  function subscribeRealtime(){
    client.channel('personal-os-user-kv-'+userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_kv',
        filter: 'user_id=eq.'+userId
      }, payload => {
        const row = payload.new;
        if(!row || !isSyncKey(row.key)) return;
        if(row.key === 'personalOS.tasks.v1' && localStorage.getItem(TASK_DIRTY_KEY)) return;
        const remoteValue = JSON.stringify(row.value);
        if(remoteValue === localStorage.getItem(row.key)){
          remoteUpdatedAt[row.key] = row.updated_at || remoteUpdatedAt[row.key] || String(Date.now());
          return;
        }
        remoteUpdatedAt[row.key] = row.updated_at || String(Date.now());
        applyRemoteValue(row.key, row.value);
        rerender();
      })
      .subscribe();
  }

  async function init(){
    const config = await getConfig();
    if(!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;
    const supabaseLib = await loadSupabase();
    client = supabaseLib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.personalOSCloud = {client, syncKeys: SYNC_KEYS, pushAllLocal, pullAllRemote, pollRemote, flushTasksToCloud};

    const {data:{session}} = await client.auth.getSession();
    if(!session || sessionExpired()){
      if(session) await client.auth.signOut();
      showLogin(config.ALLOWED_EMAIL || '');
      return;
    }
    userId = session.user.id;
    if(config.ALLOWED_EMAIL && session.user.email && session.user.email.toLowerCase() !== config.ALLOWED_EMAIL.toLowerCase()){
      await client.auth.signOut();
      showLogin(config.ALLOWED_EMAIL);
      return;
    }
    markSession();
    patchLocalStorageWrites();
    installTaskFlushHandlers();
    await initialSync();
    subscribeRealtime();
    installCloudControls();
    setInterval(installCloudControls, 1200);
    setInterval(pollRemote, 3500);
  }

  init().catch(e=>console.error('Personal OS cloud init failed', e));
})();
