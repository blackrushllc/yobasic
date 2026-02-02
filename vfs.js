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
      name: 'demo/HELLO.BAS', kind: 'program', readOnly: true, content: [
        'PRINTLN "HELLO, WORLD!"',
        'PRINTLN "WELCOME TO 🌱YoBASIC"',
        'PRINTLN "🌱YoBASIC IS A SUBSET OF THE Basil🌿 PROGRAMMING LANGUAGE"',
        'PRINTLN "FOR LEARNING PROGRAMMING BASICS"',
        'PRINTLN "HAVE A NICE DAY ☀️!"'
      ].join('\n')
    },
    {
      name: 'demo/WHILE.BAS', kind: 'program', readOnly: true, content: [
        'LET I = 0',
        'WHILE I < 3',
        '    PRINTLN "I=#{I}"',
        '    LET I = I + 1',
        'WEND'
      ].join('\n')
    },
    {
      name: 'demo/FORNEXT.BAS', kind: 'program', readOnly: true, content: [
        'FOR I% = 1 to 10',
        '    PRINT I%',
        'NEXT'
      ].join('\n')
    },
    {
      name: 'demo/INPUTNAME.BAS', kind: 'program', readOnly: true, content: [
        'INPUT "What is your name? ", N$',
        'PRINTLN "Hello, #{N$}"'
      ].join('\n')
    },
    {
      // Demonstrates file I/O into data/ folder
      name: 'demo/DATADEMO.BAS', kind: 'program', readOnly: true, content: [
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
      name: 'demo/SELECTCASE.BAS', kind: 'program', readOnly: true, content: [
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
      name: 'demo/UI_CLICK.BAS', kind: 'program', readOnly: true, content: [
        'count% = 0',
        'dlg% = UI.SHOW%("views/counter.html", {}, {"title": "Counter Demo"})',
        'UI.ON%(dlg%, "click", "#incBtn", "Inc_Click")',
        '',
        'SUB Inc_Click(evt@)',
        '  count% = count% + 1',
        '  UI.SET_TEXT%(evt@["DIALOGID%"], "#countLabel", "Count: " + STR(count%))',
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
      name: 'demo/UI_FORM.BAS', kind: 'program', readOnly: true, content: [
        'dlg% = UI.SHOW%("views/login.html", {}, {"title": "Login Demo"})',
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
    },
    {
      name: 'demo/G_MOVE_SPRITE.BAS', kind: 'program', readOnly: true, content: [
        'G.WINDOW 640, 480, "Move Sprite Demo"',
        'G.ASSETS.LOADTEXTURE "PLAYER", "assets/player.png"',
        '',
        'px# = 320 : py# = 240',
        'speed# = 200',
        '',
        'G.RUN "Init", "Update", "Draw"',
        '',
        'SUB Init',
        '  PRINTLN "Game Started!"',
        'END SUB',
        '',
        'SUB Update(dt#)',
        '  IF G.INPUT.KEYDOWN("LEFT") THEN px# = px# - speed# * dt#',
        '  IF G.INPUT.KEYDOWN("RIGHT") THEN px# = px# + speed# * dt#',
        '  IF G.INPUT.KEYDOWN("UP") THEN py# = py# - speed# * dt#',
        '  IF G.INPUT.KEYDOWN("DOWN") THEN py# = py# + speed# * dt#',
        'END SUB',
        '',
        'SUB Draw',
        '  G.DRAW.CLEAR "#003366"',
        '  G.DRAW.SPRITE "PLAYER", px#, py#',
        'END SUB'
      ].join('\n')
    },
    {
      name: 'assets/player.png', kind: 'data', readOnly: true, content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAzCQEq6f9Mj+DABvYmAmS6m6mKqLqaLqbqYqoupupj6mS58SgFv7scv9wAAAABJRU5ErkJggg=='
    }
  ];

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  class VirtualFileSystem{
    constructor(options){
      this.localStorageKey = options && options.localStorageKey || LOCAL_KEY_DEFAULT;
      /** @type {{[name:string]: VfsFile}} */
      this.files = Object.create(null);
      // OPFS root
      this.opfsRoot = null;
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

    async init() {
      if (!global.navigator || !global.navigator.storage || !global.navigator.storage.getDirectory) {
        console.warn('OPFS not supported in this browser.');
        this.loadFromLocalStorage();
        return;
      }
      try {
        this.opfsRoot = await navigator.storage.getDirectory();
        // Load legacy files first (Legacy Layer)
        this.loadFromLocalStorage();
        // Then overlay with OPFS files (User Layer)
        await this._loadFromOpfs();
      } catch (e) {
        console.error('Failed to initialize OPFS', e);
        this.loadFromLocalStorage();
      }
    }

    async _loadFromOpfs() {
      if (!this.opfsRoot) return;
      await this._scanDir(this.opfsRoot, '');
    }

    async _scanDir(dirHandle, path) {
      for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = path ? `${path}/${name}` : name;
        if (handle.kind === 'directory') {
          await this._scanDir(handle, fullPath);
        } else {
          const file = await handle.getFile();
          const content = await this._readFileContent(file);
          this.files[fullPath] = {
            name: fullPath,
            kind: this._inferKind(fullPath),
            readOnly: false,
            content: content
          };
        }
      }
    }

    async _readFileContent(file) {
      const type = file.type;
      if (type.startsWith('image/') || type.startsWith('audio/') || type.startsWith('video/') || 
          ['application/pdf', 'application/zip'].includes(type)) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      } else {
        return await file.text();
      }
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
      // We allow overwriting even if it's readOnly in memory, 
      // because we're creating a user-level override.
      const k = kind || this._inferKind(key);
      const file = { name: key, kind: k, readOnly: false, content: String(content ?? '') };
      this.files[key] = file;
      this.saveToLocalStorage();
      
      // Background save to OPFS
      if (this.opfsRoot) {
        this._writeToOpfs(key, content).catch(console.error);
      }

      return clone(file);
    }

    deleteFile(name){
      const key = String(name);
      const f = this.files[key];
      if (!f) return;
      
      // Background delete from OPFS
      if (this.opfsRoot) {
        this._deleteFromOpfs(key).catch(console.error);
      }

      // Restore system version if it exists, otherwise delete
      const systemOriginal = SYSTEM_EXAMPLES.find(e => e.name === key);
      if (systemOriginal) {
        this.files[key] = clone(systemOriginal);
      } else {
        delete this.files[key];
      }
      
      this.saveToLocalStorage();
    }

    renameFile(oldName, newName) {
      const oldKey = String(oldName);
      const newKey = String(newName);
      const f = this.files[oldKey];
      if (!f) throw new Error('File not found');
      // Cannot rename a system file unless it's an override
      const systemOriginal = SYSTEM_EXAMPLES.find(e => e.name === oldKey);
      if (f.readOnly && systemOriginal) throw new Error('Cannot rename read-only system file');
      
      if (this.files[newKey]) throw new Error('Target file already exists');

      const newFile = clone(f);
      newFile.name = newKey;
      newFile.readOnly = false; // Renamed file is always user-owned
      this.files[newKey] = newFile;
      
      // Restore system version if it was one
      if (systemOriginal) {
        this.files[oldKey] = clone(systemOriginal);
      } else {
        delete this.files[oldKey];
      }

      this.saveToLocalStorage();

      // Background rename in OPFS
      if (this.opfsRoot) {
        this._renameInOpfs(oldKey, newKey).catch(console.error);
      }
    }

    // Async routed operations (Phase 2)
    async getFileAsync(name){
      const n = String(name);
      if (n.toLowerCase().startsWith('examples/')){
        if (this.providers.examples && this.providers.examples.getFile){
          const f = await this.providers.examples.getFile(n);
          if (f) return f;
        }
        // fallback to local seeded entry
        return this.getFile(n);
      } else if (n.toLowerCase().startsWith('demo/')){
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
      
      // Write to memory and LocalStorage
      const file = this.writeFile(n, content, kind);
      
      // Wait for OPFS write
      if (this.opfsRoot) {
        await this._writeToOpfs(n, content);
      }
      
      return file;
    }

    async _writeToOpfs(path, content) {
      if (!this.opfsRoot) return;
      const parts = path.split('/');
      const fileName = parts.pop();
      let currentDir = this.opfsRoot;
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      if (typeof content === 'string' && content.startsWith('data:')) {
        const res = await fetch(content);
        const blob = await res.blob();
        await writable.write(blob);
      } else {
        await writable.write(content);
      }
      await writable.close();
    }

    async _deleteFromOpfs(path) {
      if (!this.opfsRoot) return;
      const parts = path.split('/');
      const fileName = parts.pop();
      let currentDir = this.opfsRoot;
      for (const part of parts) {
        try { currentDir = await currentDir.getDirectoryHandle(part); }
        catch (e) { return; }
      }
      await currentDir.removeEntry(fileName);
    }

    async _renameInOpfs(oldPath, newPath) {
      if (!this.opfsRoot) return;
      // Copy and delete
      const f = this.files[newPath];
      if (f) {
        await this._writeToOpfs(newPath, f.content);
        await this._deleteFromOpfs(oldPath);
      }
    }

    async listByFolderAsync(folder){
      const f = String(folder||'');
      if (f === 'examples'){
        if (this.providers.examples && this.providers.examples.listFiles){
          return await this.providers.examples.listFiles();
        }
        return this.listByFolder('examples');
      }
      if (f === 'demo'){
        return this.listByFolder('demo');
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
        const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB safe limit for LocalStorage
        let currentTotal = 0;

        for (const [name, f] of Object.entries(this.files)){
          if (!f.readOnly){
            // Only save files smaller than 1MB to LocalStorage (Legacy Layer)
            // AND only if they don't exceed the total limit.
            // Larger files will live in OPFS only.
            const size = (f.content || '').length;
            if (size < 1024 * 1024 && (currentTotal + size) < MAX_TOTAL_SIZE) {
              user[name] = { name, kind: f.kind, readOnly: false, content: f.content };
              currentTotal += size;
            }
          }
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
        // (projects/, examples/, shared/, data/, demo/). These may include
        // nested paths like "chapter1/hello.bas".
        for (const f of all){
          const n = String(f.name).toLowerCase();
          if (
            !n.startsWith('projects/') &&
            !n.startsWith('examples/') &&
            !n.startsWith('shared/') &&
            !n.startsWith('data/') &&
            !n.startsWith('demo/')
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
