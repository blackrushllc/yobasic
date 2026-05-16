(function(global){
  'use strict';

  class ServerProvider {
    async getFile(name) {
      if (!name.startsWith('/')) return null;
      try {
        const res = await fetch(name);
        if (!res.ok) return null;
        const content = await res.text();
        return {
          name: name,
          kind: name.endsWith('.bas') ? 'program' : 'data',
          readOnly: true,
          content: content
        };
      } catch (e) {
        console.warn('[VFS] Server fetch failed', name, e);
        return null;
      }
    }
  }

  global.ServerProvider = ServerProvider;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
