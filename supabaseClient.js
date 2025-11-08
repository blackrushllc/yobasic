// Supabase client initialization for YoBASIC playground
// NOTE: Fill in your Supabase URL and public anon key below (do NOT use service role keys)
// When RLS is enabled, anon key is safe for frontend use.
(function(global){
  'use strict';
  // When bundling as plain scripts, ensure we always return a CLIENT instance
  // from getSupabase(), not the UMD namespace. The UMD build exposes
  // window.supabase.createClient(..) which we use to construct a singleton.

  // Lightweight loader for supabase-js from CDN if not already present
  async function ensureSupabase(){
    // Return existing client if already created
    if (global.__supabase__) return global.__supabase__;

    // Load UMD if needed
    if (!global.supabase || typeof global.supabase.createClient !== 'function'){
      await new Promise((resolve, reject)=>{
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const create = global.supabase && global.supabase.createClient;
    if (typeof create !== 'function') throw new Error('Supabase client library failed to load.');

    // Config (replace with your project values if not already set)
    const SUPABASE_URL = 'https://deggmigeevsdyxqcbpuz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZ2dtaWdlZXZzZHl4cWNicHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NjE1NDgsImV4cCI6MjA3ODEzNzU0OH0.3Cvlflm9zKFWpZtMfSlgBpY8CBP7u_Pfph9A03QdSP0';

    if (SUPABASE_URL.startsWith('%%') || SUPABASE_ANON_KEY.startsWith('%%')){
      console.warn('[YoBASIC] Supabase URL/key not configured. Remote examples/shared will be disabled.');
      return null;
    }

    const client = create(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    // Cache and return the singleton client
    global.__supabase__ = client;
    return client;
  }

  // Expose an async getter and a sync shim (null until ready)
  global.getSupabase = ensureSupabase;
  global.__supabase__ = global.__supabase__ || null;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
