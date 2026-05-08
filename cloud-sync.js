// Personal OS cloud sync: Supabase email/password auth + shared localStorage keys.
// Loads only when /api/config has SUPABASE_URL and SUPABASE_ANON_KEY configured.
(function(){
  const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_KEY = 'personalOS.cloudSessionStartedAt.v1';
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

  function isSyncKey(key){ return SYNC_KEYS.includes(String(key)); }
  function sessionExpired(){
    const started = Number(localStorage.getItem(SESSION_KEY) || 0);
    return !started || Date.now() - started > SESSION_MAX_AGE_MS;
  }
  function markSession(){ originalSetItem(SESSION_KEY, String(Date.now())); }
  function hardReload(){ setTimeout(()=>location.reload(), 80); }
  function rerender(){
    try{ if(typeof render === 'function') render(); }catch(e){}
    try{ if(typeof renderTasks === 'function') renderTasks(); }catch(e){}
    try{ if(typeof renderProductivity === 'function') renderProductivity(); }catch(e){}
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

  async function pullKey(key){
    const {data,error} = await client
      .from('user_kv')
      .select('value,updated_at')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();
    if(error || !data || data.value == null) return false;
    applyingRemote = true;
    try{ originalSetItem(key, JSON.stringify(data.value)); }
    finally{ applyingRemote = false; }
    return true;
  }

  async function pushKey(key){
    if(!client || !userId || !isSyncKey(key) || applyingRemote) return;
    let parsed = null;
    try{ parsed = JSON.parse(localStorage.getItem(key) || 'null'); }catch(e){ return; }
    await client.from('user_kv').upsert({
      user_id: userId,
      key,
      value: parsed,
      updated_at: new Date().toISOString()
    }, {onConflict:'user_id,key'});
  }

  async function pushAllLocal(){
    if(!client || !userId || syncing) return;
    syncing = true;
    try{
      for(const key of SYNC_KEYS){
        if(localStorage.getItem(key) != null) await pushKey(key);
      }
      toastMsg('Uploaded this device to cloud');
    }finally{ syncing = false; }
  }

  async function pullAllRemote(){
    if(!client || !userId || syncing) return;
    syncing = true;
    try{
      for(const key of SYNC_KEYS) await pullKey(key);
      rerender();
      toastMsg('Downloaded cloud data');
    }finally{ syncing = false; }
  }

  async function initialSync(){
    for(const key of SYNC_KEYS){
      const localExists = localStorage.getItem(key) != null;
      const hadRemote = await pullKey(key);
      if(!hadRemote && localExists) await pushKey(key);
    }
    rerender();
  }

  function patchLocalStorageWrites(){
    localStorage.setItem = function(key, value){
      originalSetItem(key, value);
      if(isSyncKey(key)) pushKey(key);
    };
  }

  function installCloudControls(){
    if(document.getElementById('posCloudUpload')) return;
    const nav=document.querySelector('.nav') || document.querySelector('.topbar') || document.body;
    const up=document.createElement('button');
    up.id='posCloudUpload';
    up.type='button';
    up.textContent='UPLOAD THIS DEVICE';
    up.title='Make this device the cloud source of truth';
    up.style.cssText='height:40px;border-radius:10px;border:1px solid #136b51;background:rgba(16,194,119,.08);color:#bfffdc;font-weight:1000;font-size:12px;padding:0 12px;letter-spacing:.06em';
    up.onclick=e=>{e.preventDefault();e.stopPropagation();pushAllLocal();};
    const down=document.createElement('button');
    down.id='posCloudDownload';
    down.type='button';
    down.textContent='DOWNLOAD CLOUD';
    down.title='Replace this device with cloud data';
    down.style.cssText='height:40px;border-radius:10px;border:1px solid #49306c;background:#090812;color:#fff;font-weight:1000;font-size:12px;padding:0 12px;letter-spacing:.06em';
    down.onclick=e=>{e.preventDefault();e.stopPropagation();pullAllRemote();};
    nav.insertBefore(down, nav.firstChild);
    nav.insertBefore(up, nav.firstChild);
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
        applyingRemote = true;
        try{ originalSetItem(row.key, JSON.stringify(row.value)); }
        finally{ applyingRemote = false; }
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
    window.personalOSCloud = {client, syncKeys: SYNC_KEYS, pushAllLocal, pullAllRemote};

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
    await initialSync();
    subscribeRealtime();
    installCloudControls();
    setInterval(installCloudControls, 1200);
  }

  init().catch(()=>{});
})();
