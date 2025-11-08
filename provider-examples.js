// SupabaseExamplesProvider: read-only examples from Supabase
(function(global){
  'use strict';

  class SupabaseExamplesProvider{
    constructor(){
      this._cache = null; // map name -> VfsFile
      this._loaded = false;
    }
    async _loadAll(){
      if (this._loaded && this._cache) return this._cache;
      const supabase = await global.getSupabase();
      if (!supabase){ this._loaded = true; this._cache = {}; return this._cache; }
      const { data, error } = await supabase
        .from('examples')
        .select('name, kind, content, updated_at')
        .order('name');
      if (error){ console.warn('[YoBASIC] examples fetch error', error); this._loaded = true; this._cache = {}; return this._cache; }
      const map = {};
      (data||[]).forEach(row=>{
        const f = {
          name: row.name,
          kind: row.kind === 'data' ? 'data' : 'program',
          readOnly: true,
          content: row.content || ''
        };
        map[f.name] = f;
      });
      this._cache = map; this._loaded = true; return map;
    }
    async listFiles(){
      const map = await this._loadAll();
      return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
    }
    async getFile(name){
      const map = await this._loadAll();
      const key = String(name);
      if (map[key]) return JSON.parse(JSON.stringify(map[key]));
      // try single row fetch for miss
      const supabase = await global.getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('examples')
        .select('name, kind, content, updated_at').eq('name', key).maybeSingle();
      if (error || !data) return null;
      const f = { name: data.name, kind: data.kind === 'data'? 'data':'program', readOnly: true, content: data.content||'' };
      // update cache
      this._cache[key] = f;
      return JSON.parse(JSON.stringify(f));
    }
  }

  global.SupabaseExamplesProvider = SupabaseExamplesProvider;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
