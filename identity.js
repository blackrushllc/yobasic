// Identity manager for YoBASIC using Supabase Auth
(function(global){
  'use strict';

  const state = {
    userId: null,
    username: null
  };

  function isLoggedIn(){ return !!state.userId && !!state.username; }
  function getCurrentUser(){ return isLoggedIn() ? { id: state.userId, username: state.username } : null; }

  async function initializeFromSession(){
    const supabase = await global.getSupabase();
    if (!supabase) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user){ state.userId = null; state.username = null; return null; }
    // Fetch profile for username
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (profile && profile.username){ state.userId = user.id; state.username = profile.username; return getCurrentUser(); }
    // if no profile row, treat as logged-out for our UI purposes
    state.userId = null; state.username = null; return null;
  }

  function usernameToEmail(username){ return `${username}@yobasic.com`; }

  function validateEmail(email){
    const e = String(email||'').trim();
    // basic email pattern
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(e)) return 'Please enter a valid email address.';
    return null;
  }

  function validateUsername(username){
    const u = String(username||'').trim();
    if (u.length < 1 || u.length > 15) return 'Username must be 1–15 characters.';
    if (!/^[A-Za-z0-9_]+$/.test(u)) return 'Username can contain letters, numbers, and underscores only.';
    return null;
  }

  async function signup(username, email, password){
    const supabase = await global.getSupabase();
    if (!supabase) throw new Error('Supabase not configured.');
    const uErr = validateUsername(username); if (uErr) throw new Error(uErr);
    const eErr = validateEmail(email); if (eErr) throw new Error(eErr);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;
    const user = data && data.user;
    const session = data && data.session;
    // If email confirmation is required, there will be no session yet
    if (!session){
      return { needsConfirmation: true, email };
    }
    if (!user) throw new Error('No user returned from signUp');
    const { error: pError } = await supabase.from('profiles').insert({ id: user.id, username });
    if (pError) throw pError;
    state.userId = user.id; state.username = username;
    return { user: getCurrentUser(), needsConfirmation: false };
  }

  async function login(identifier, password){
    const supabase = await global.getSupabase();
    if (!supabase) throw new Error('Supabase not configured.');
    const id = String(identifier||'').trim();
    if (!id) throw new Error('Enter your username or email.');
    // Accept either email or username; legacy fallback derives email from username
    const email = id.includes('@') ? id : usernameToEmail(id);
    if (!id.includes('@')){
      const err = validateUsername(id); if (err) throw new Error(err);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = data.user;
    // Fetch or create profile row
    let profileResp = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
    if (profileResp.error) throw profileResp.error;
    let username = profileResp.data && profileResp.data.username;
    if (!username){
      const metaUser = user.user_metadata && user.user_metadata.username;
      username = metaUser || (id.includes('@') ? (email.split('@')[0]) : id);
      const ins = await supabase.from('profiles').insert({ id: user.id, username });
      if (ins.error && !(ins.error && ins.error.code === '23505')){ throw ins.error; }
    }
    state.userId = user.id; state.username = username;
    return getCurrentUser();
  }

  async function logout(){
    const supabase = await global.getSupabase();
    if (supabase){ await supabase.auth.signOut(); }
    state.userId = null; state.username = null;
  }

  global.Identity = { isLoggedIn, getCurrentUser, signup, login, logout, initializeFromSession, validateUsername };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
