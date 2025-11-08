// SupabaseSharedProvider: shared/<owner>/... files. Public read, owner write.
(function(global){
  'use strict';

  function parseFullName(fullName){
    const n = String(fullName||'');
    if (!n.toLowerCase().startsWith('shared/')) return null;
    const rest = n.slice(7); // after 'shared/'
    const idx = rest.indexOf('/');
    if (idx === -1) return null;
    const owner = rest.slice(0, idx);
    const path = rest.slice(idx+1);
    if (!owner || !path) return null;
    return { owner, path };
  }

  class SupabaseSharedProvider{
    constructor(identity){
      this.identity = identity || global.Identity;
    }

    async listOwners(){
      const supabase = await global.getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('shared_files')
        .select('owner_name')
        .order('owner_name');
      if (error){ console.warn('[YoBASIC] listOwners error', error); return []; }
      const set = new Set();
      (data||[]).forEach(r=>{ if (r.owner_name) set.add(r.owner_name); });
      return Array.from(set.values());
    }

    async listFilesForOwner(owner){
      const supabase = await global.getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('shared_files')
        .select('owner_name, path, kind, updated_at')
        .eq('owner_name', owner)
        .order('path');
      if (error){ console.warn('[YoBASIC] listFilesForOwner error', error); return []; }
      const me = this.identity && this.identity.getCurrentUser ? this.identity.getCurrentUser() : null;
      const myname = me && me.username;
      return (data||[]).map(row=>({
        name: `shared/${row.owner_name}/${row.path}`,
        kind: row.kind === 'data' ? 'data' : 'program',
        readOnly: row.owner_name !== myname,
        content: '' // lazy
      }));
    }

    async getFile(fullName){
      const parts = parseFullName(fullName);
      if (!parts) return null;
      const { owner, path } = parts;
      const supabase = await global.getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('shared_files')
        .select('owner_name, path, kind, content, updated_at')
        .eq('owner_name', owner)
        .eq('path', path)
        .maybeSingle();
      if (error || !data) return null;
      const me = this.identity && this.identity.getCurrentUser ? this.identity.getCurrentUser() : null;
      const myname = me && me.username;
      return {
        name: `shared/${owner}/${path}`,
        kind: data.kind === 'data' ? 'data' : 'program',
        readOnly: owner !== myname,
        content: data.content || ''
      };
    }

    async writeFile(fullName, content, kind){
      const parts = parseFullName(fullName);
      if (!parts) throw new Error('Invalid shared file path.');
      const { owner, path } = parts;
      const me = this.identity && this.identity.getCurrentUser ? this.identity.getCurrentUser() : null;
      if (!me) throw new Error(`You can’t save to this shared folder. Log in as ${owner} or use File → Save As… to save to Root.`);
      if (me.username !== owner) throw new Error(`You can’t save to shared/${owner}. Log in as ${owner} or save to Root.`);
      const supabase = await global.getSupabase();
      if (!supabase) throw new Error('Supabase not configured.');
      const row = {
        owner_id: me.id,
        owner_name: me.username,
        path: path,
        kind: kind === 'data' ? 'data' : 'program',
        content: String(content ?? '')
      };
      const { error } = await supabase.from('shared_files').upsert(row, { onConflict: 'owner_id,path' });
      if (error) throw error;
      return {
        name: `shared/${owner}/${path}`,
        kind: row.kind,
        readOnly: false,
        content: row.content
      };
    }
  }

  global.SupabaseSharedProvider = SupabaseSharedProvider;
  global.__parseSharedFullName = parseFullName; // export for reuse
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
