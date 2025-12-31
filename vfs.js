// Virtual File System for the BASIC playground
// - Flat map keyed by full filename string
// - System example programs are readOnly and seeded at startup
// - User files persist to localStorage under key 'yobasic.vfs'
// - Designed so a future backend can be plugged in

(function(global){
  'use strict';

  /**
   * @typedef {'program'|'data'} VfsFileKind
   * @typedef {Object} VfsFile
   * @property {string} name
   * @property {VfsFileKind} kind
   * @property {boolean} readOnly
   * @property {string} content
   */

  const LOCAL_KEY_DEFAULT = 'yobasic.vfs';

  const SYSTEM_EXAMPLES = [
    {
      name: 'examples/HELLO.BAS', kind: 'program', readOnly: true, content: [
        'PRINTLN "HELLO, WORLD!"',
        'PRINTLN "WELCOME TO 🌱YoBASIC"',
        'PRINTLN "🌱YoBASIC IS A SUBSET OF THE Basil🌿 PROGRAMMING LANGUAGE"',
        'PRINTLN "FOR LEARNING PROGRAMMING BASICS"',
        'PRINTLN "HAVE A NICE DAY ☀️!"'
      ].join('\n')
    },
    {
      name: 'examples/WHILE.BAS', kind: 'program', readOnly: true, content: [
        'LET I = 0',
        'WHILE I < 3',
        '    PRINTLN "I=#{I}"',
        '    LET I = I + 1',
        'WEND'
      ].join('\n')
    },
    {
      name: 'examples/FORNEXT.BAS', kind: 'program', readOnly: true, content: [
        'FOR I% = 1 to 10',
        '    PRINT I%',
        'NEXT'
      ].join('\n')
    },
    {
      name: 'examples/INPUTNAME.BAS', kind: 'program', readOnly: true, content: [
        'INPUT "What is your name? ", N$',
        'PRINTLN "Hello, #{N$}"'
      ].join('\n')
    },
    {
      // Demonstrates file I/O into data/ folder
      name: 'examples/DATADEMO.BAS', kind: 'program', readOnly: true, content: [
        'PRINT "Writing sample data file..."',
        'OPEN "data/demo.dat" FOR OUTPUT AS #1',
        'PRINT #1, "Alice,100"',
        'PRINT #1, "Bob,95"',
        'PRINT #1, "Charlie,99"',
        'CLOSE #1',
        'PRINT "Done. Now reading it back:"',
        'OPEN "data/demo.dat" FOR INPUT AS #1',
        'DO',
        '  LINE INPUT #1, L$',
        '  IF L$ = "" THEN BREAK',
        '  PRINT "Read: #{L$}"',
        'LOOP',
        'CLOSE #1',
        'PRINT "Done!"'
      ].join('\n')
    },
    {
      name: 'examples/SELECTCASE.BAS', kind: 'program', readOnly: true, content: [
        'INPUT "Score? ", S%',
        'SELECT CASE S%',
        'CASE IS >= 90',
        '  PRINT "A"',
        'CASE 80 TO 89',
        '  PRINT "B"',
        'CASE 70 TO 79',
        '  PRINT "C"',
        'CASE ELSE',
        '  PRINT "D/F"',
        'END SELECT'
      ].join('\n')
    },
    {
      name: 'examples/UI_CLICK.BAS', kind: 'program', readOnly: true, content: [
        'count% = 0',
        'dlg% = UI.SHOW%("views/counter.html", {"title": "Counter Demo"})',
        'UI.ON%(dlg%, "click", "#incBtn", "Inc_Click")',
        '',
        'SUB Inc_Click(evt@)',
        '  count% = count% + 1',
        '  UI.SET_TEXT%(evt@["DIALOGID%"], "#countLabel", "Count: " + STR$(count%))',
        'END SUB'
      ].join('\n')
    },
    {
      name: 'views/counter.html', kind: 'data', readOnly: true, content: [
        '<h3>Counter Demo</h3>',
        '<p id="countLabel">Count: 0</p>',
        '<button id="incBtn">Increment</button>'
      ].join('\n')
    },
    {
      name: 'examples/UI_FORM.BAS', kind: 'program', readOnly: true, content: [
        'dlg% = UI.SHOW%("views/login.html", {"title": "Login Demo"})',
        'UI.ON%(dlg%, "submit", "form", "Login_Submit")',
        '',
        'SUB Login_Submit(evt@)',
        '  evt@["PREVENTDEFAULT%"] = 1',
        '  user$ = UI.GET_VALUE$(evt@["DIALOGID%"], "#user")',
        '  pass$ = UI.GET_VALUE$(evt@["DIALOGID%"], "#pass")',
        '  IF user$ = "admin" AND pass$ = "1234" THEN',
        '    PRINTLN "Login successful!"',
        '    UI.CLOSE%(evt@["DIALOGID%"])',
        '  ELSE',
        '    UI.SET_TEXT%(evt@["DIALOGID%"], "#err", "Invalid username or password")',
        '  END IF',
        'END SUB'
      ].join('\n')
    },
    {
      name: 'views/login.html', kind: 'data', readOnly: true, content: [
        '<form>',
        '  <div style="margin-bottom:10px">',
        '    <label>Username: <input type="text" id="user"></label>',
        '  </div>',
        '  <div style="margin-bottom:10px">',
        '    <label>Password: <input type="password" id="pass"></label>',
        '  </div>',
        '  <div id="err" style="color:red; margin-bottom:10px"></div>',
        '  <button type="submit">Login</button>',
        '</form>'
      ].join('\n')
    }
  ];

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  class VirtualFileSystem{
    constructor(options){
      this.localStorageKey = options && options.localStorageKey || LOCAL_KEY_DEFAULT;
      /** @type {{[name:string]: VfsFile}} */
      this.files = Object.create(null);
      // Providers for remote sources (Phase 2)
      this.providers = { examples: null, shared: null };
      // Seed with system examples (Phase 1). In Phase 2, UI fetches examples from Supabase.
      // Keep them seeded as a fallback when Supabase is not configured.
      for (const f of SYSTEM_EXAMPLES){
        this.files[f.name] = clone(f);
      }
      // No physical creation for data/ required; files appear when written.
      this._saveScheduled = null;
    }

    // Configure providers
    setProviders(providers){
      this.providers.examples = providers && providers.examples || null;
      this.providers.shared = providers && providers.shared || null;
    }

    // Basic CRUD (synchronous: local only)
    listFiles(){ return Object.values(this.files).sort((a,b)=>a.name.localeCompare(b.name)); }

    getFile(name){
      const key = String(name);
      return this.files[key] ? clone(this.files[key]) : null;
    }

    writeFile(name, content, kind){
      const key = String(name);
      const exists = this.files[key];
      // Enforce readOnly protection for examples (seeded) or any readOnly file
      if (exists && exists.readOnly){
        throw new Error('This file is read-only. Use a different name.');
      }
      const k = kind || this._inferKind(key);
      const file = { name: key, kind: k, readOnly: false, content: String(content ?? '') };
      this.files[key] = file;
      this.saveToLocalStorage();
      return clone(file);
    }

    deleteFile(name){
      const key = String(name);
      const f = this.files[key];
      if (!f) return;
      if (f.readOnly) throw new Error('Cannot delete read-only system file');
      delete this.files[key];
      this.saveToLocalStorage();
    }

    renameFile(oldName, newName) {
      const oldKey = String(oldName);
      const newKey = String(newName);
      const f = this.files[oldKey];
      if (!f) throw new Error('File not found');
      if (f.readOnly) throw new Error('Cannot rename read-only system file');
      if (this.files[newKey]) throw new Error('Target file already exists');

      const newFile = clone(f);
      newFile.name = newKey;
      this.files[newKey] = newFile;
      delete this.files[oldKey];
      this.saveToLocalStorage();
    }

    // Async routed operations (Phase 2)
    async getFileAsync(name){
      const n = String(name);
      if (n.toLowerCase().startsWith('examples/')){
        if (this.providers.examples && this.providers.examples.getFile){
          return await this.providers.examples.getFile(n);
        }
        // fallback to local seeded entry
        return this.getFile(n);
      } else if (n.toLowerCase().startsWith('shared/')){
        if (this.providers.shared && this.providers.shared.getFile){
          return await this.providers.shared.getFile(n);
        }
        return null;
      } else {
        return this.getFile(n);
      }
    }

    async writeFileAsync(name, content, kind){
      const n = String(name);
      if (n.toLowerCase().startsWith('shared/')){
        if (this.providers.shared && this.providers.shared.writeFile){
          return await this.providers.shared.writeFile(n, content, kind || this._inferKind(n));
        }
        throw new Error('Shared provider not available.');
      }
      // examples are read-only; route to local if user tries to save with a non-examples name
      return this.writeFile(n, content, kind);
    }

    async listByFolderAsync(folder){
      const f = String(folder||'');
      if (f === 'examples'){
        if (this.providers.examples && this.providers.examples.listFiles){
          return await this.providers.examples.listFiles();
        }
        return this.listByFolder('examples');
      }
      if (f === 'shared'){
        if (this.providers.shared){
          const owners = await (this.providers.shared.listOwners ? this.providers.shared.listOwners() : []);
          let files = [];
          for (const owner of owners){
            const list = await (this.providers.shared.listFilesForOwner ? this.providers.shared.listFilesForOwner(owner) : []);
            files = files.concat(list);
          }
          return files;
        }
        return [];
      }
      // Root or data (local)
      return this.listByFolder(f);
    }

    // Convenience
    readProgram(name){
      const f = this.getFile(name);
      return f && f.kind === 'program' ? f.content : null;
    }
    writeProgram(name, content){
      return this.writeFile(name, content, 'program');
    }
    readData(name){
      const f = this.getFile(name);
      return f ? f.content : null; // allow reading any file as text
    }
    writeData(name, content){
      return this.writeFile(name, content, 'data');
    }

    // Async convenience
    async readProgramAsync(name){
      const f = await this.getFileAsync(name);
      return f && f.kind === 'program' ? f.content : null;
    }
    async writeProgramAsync(name, content){
      return await this.writeFileAsync(name, content, 'program');
    }
    async readDataAsync(name){
      const f = await this.getFileAsync(name);
      return f ? f.content : null;
    }
    async writeDataAsync(name, content){
      return await this.writeFileAsync(name, content, 'data');
    }

    // Persistence
    loadFromLocalStorage(){
      try{
        const raw = global.localStorage && global.localStorage.getItem(this.localStorageKey);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object'){
          for (const [name, f] of Object.entries(obj)){
            // only merge non-readOnly (user) files; do not persist examples
            if (f && f.readOnly === false){
              this.files[name] = { name, kind: f.kind || this._inferKind(name), readOnly: false, content: String(f.content || '') };
            }
          }
        }
      }catch(e){ /* ignore */ }
    }

    saveToLocalStorage(){
      try{
        // persist only user files (readOnly === false)
        const user = {};
        for (const [name, f] of Object.entries(this.files)){
          if (!f.readOnly){ user[name] = { name, kind: f.kind, readOnly: false, content: f.content }; }
        }
        global.localStorage && global.localStorage.setItem(this.localStorageKey, JSON.stringify(user));
      }catch(e){ /* ignore quota / private mode */ }
    }

    // Helpers
    _inferKind(name){
      const n = String(name).toLowerCase();
      if (n.startsWith('data/')) return 'data';
      if (n.endsWith('.bas') || n.endsWith('.basil')) return 'program';
      return 'program';
    }

    // Utility to get files by virtual folder
    listByFolder(folder){
      const all = this.listFiles();
      const out = [];
      if (!folder || folder === 'Root'){
        // Root contains any files that are not in reserved namespaces
        // (projects/, examples/, shared/, data/). These may include
        // nested paths like "chapter1/hello.bas".
        for (const f of all){
          const n = String(f.name).toLowerCase();
          if (
            !n.startsWith('projects/') &&
            !n.startsWith('examples/') &&
            !n.startsWith('shared/') &&
            !n.startsWith('data/')
          ){
            out.push(f);
          }
        }
        return out;
      }
      const prefix = folder.toLowerCase() + '/';
      for (const f of all){ if (f.name.toLowerCase().startsWith(prefix)) out.push(f); }
      return out;
    }
  }

  // Expose
  global.VirtualFileSystem = VirtualFileSystem;
  // Provide a helper for system examples (read-only list)
  global.__VFS_SYSTEM_EXAMPLES__ = SYSTEM_EXAMPLES.map(e=>({name:e.name, kind:e.kind}));

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
