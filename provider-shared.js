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
      
      const currentTeam = this.identity.getCurrentTeam ? this.identity.getCurrentTeam() : 'Self';
      if (!currentTeam || currentTeam === 'Self') {
        const { data, error } = await supabase.from('shared_files')
          .select('owner_name')
          .order('owner_name');
        if (error){ console.warn('[YoBASIC] listOwners error', error); return []; }
        const set = new Set();
        (data||[]).forEach(r=>{ if (r.owner_name) set.add(r.owner_name); });
        return Array.from(set.values());
      } else {
        // Team Mode
        const me = this.identity.getCurrentUser ? this.identity.getCurrentUser() : null;
        const myname = me ? me.username : null;
        const isOwner = (myname && myname === currentTeam);

        if (isOwner) {
          // Team owner sees all members who joined the team + themselves
          const { data, error } = await supabase.from('profiles')
            .select('username')
            .or(`team_name.eq.${currentTeam},username.eq.${currentTeam}`)
            .order('username');
          if (error){ console.warn('[YoBASIC] listOwners Team error', error); return []; }
          return (data||[]).map(r => r.username);
        } else {
          // Team members (and guests) only see themselves and the team owner
          const owners = [currentTeam];
          if (myname) owners.push(myname);
          // Deduplicate and sort
          return Array.from(new Set(owners)).sort();
        }
      }
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
      if (!me) throw new Error(`You can’t save to this shared folder. Log in.`);
      
      const supabase = await global.getSupabase();
      if (!supabase) throw new Error('Supabase not configured.');

      const team = this.identity.getCurrentTeam ? this.identity.getCurrentTeam() : 'Self';
      const isTeamOwner = (team !== 'Self' && team === me.username);
      
      let targetOwnerId = me.id;
      let targetOwnerName = me.username;

      if (me.username !== owner) {
        if (isTeamOwner) {
          // Check if 'owner' is in the team
          const { data: profile } = await supabase.from('profiles').select('id, team_name').eq('username', owner).maybeSingle();
          if (!profile || profile.team_name !== team) {
            throw new Error(`User ${owner} is not in your team (${team}).`);
          }
          // "but not edit or delete" -> check if file exists
          const { data: existing } = await supabase.from('shared_files').select('id').eq('owner_name', owner).eq('path', path).maybeSingle();
          if (existing) {
            throw new Error(`You cannot overwrite or edit ${owner}'s existing files. Save with a different name (e.g., feedback_${path}).`);
          }
          targetOwnerId = profile.id;
          targetOwnerName = owner;
        } else {
          throw new Error(`You can’t save to shared/${owner}. Log in as ${owner} or use File → Save As… to save to Root.`);
        }
      }

      const row = {
        owner_id: targetOwnerId,
        owner_name: targetOwnerName,
        path: path,
        kind: kind === 'data' ? 'data' : 'program',
        content: String(content ?? '')
      };
      const { error } = await supabase.from('shared_files').upsert(row, { onConflict: 'owner_id,path' });
      if (error) throw error;
      return {
        name: `shared/${targetOwnerName}/${path}`,
        kind: row.kind,
        readOnly: targetOwnerName !== me.username,
        content: row.content
      };
    }
  }

  global.SupabaseSharedProvider = SupabaseSharedProvider;
  global.__parseSharedFullName = parseFullName; // export for reuse
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
