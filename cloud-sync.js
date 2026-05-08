// Personal OS cloud sync scaffold for Supabase auth + shared storage.
// This file is intentionally isolated. Existing app behavior is unchanged until index.html loads it
// and Vercel/Supabase environment values are configured.
(function(){
  const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const STORAGE_PREFIX = 'personalOS.';
  const SESSION_KEY = STORAGE_PREFIX + 'cloudSessionStartedAt.v1';

  function env(name){
    if(window.PERSONAL_OS_CONFIG && window.PERSONAL_OS_CONFIG[name]) return window.PERSONAL_OS_CONFIG[name];
    return '';
  }

  function isExpired(){
    const raw = Number(localStorage.getItem(SESSION_KEY) || 0);
    return !raw || Date.now() - raw > SESSION_MAX_AGE_MS;
  }

  function markSession(){
    localStorage.setItem(SESSION_KEY, String(Date.now()));
  }

  async function loadSupabase(){
    if(window.supabase) return window.supabase;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.supabase;
  }

  function showLogin(client, allowedEmail){
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;padding:24px;';
    wrap.innerHTML = '<form id="posLogin" style="width:min(420px,100%);border:1px solid #49306c;border-radius:18px;background:#070710;padding:22px;display:flex;flex-direction:column;gap:12px;"><h1 style="margin:0 0 6px;font-size:26px;">Personal OS</h1><p style="margin:0 0 8px;color:#b8a7dc;line-height:1.35;">Log in to sync your private OS across devices.</p><input id="posEmail" type="email" placeholder="Email" autocomplete="email" required style="height:44px;border-radius:10px;border:1px solid #352456;background:#090812;color:#fff;padding:0 12px;font-weight:800;"><input id="posPassword" type="password" placeholder="Password" autocomplete="current-password" required style="height:44px;border-radius:10px;border:1px solid #352456;background:#090812;color:#fff;padding:0 12px;font-weight:800;"><button style="height:46px;border-radius:11px;border:1px solid #7f52ff;background:#482096;color:#fff;font-weight:1000;cursor:pointer;">LOG IN</button><div id="posLoginMsg" style="min-height:20px;color:#ff8f9a;font-size:13px;"></div></form>';
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
      const {error} = await client.auth.signInWithPassword({email,password});
      if(error){ msg.textContent = error.message; return; }
      markSession();
      location.reload();
    };
  }

  async function init(){
    const url = env('SUPABASE_URL');
    const anon = env('SUPABASE_ANON_KEY');
    const allowedEmail = env('ALLOWED_EMAIL');
    if(!url || !anon) return;

    const supabaseLib = await loadSupabase();
    const client = supabaseLib.createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.personalOSCloud = { client };

    const {data:{session}} = await client.auth.getSession();
    if(!session || isExpired()){
      if(session) await client.auth.signOut();
      showLogin(client, allowedEmail);
      return;
    }
    markSession();
  }

  init().catch(()=>{});
})();
