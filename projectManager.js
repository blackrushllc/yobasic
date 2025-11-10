// ProjectManager for YoBASIC Phase 3 (minimal implementation)
// - Local projects under projects/<Name>/...
// - Loads Modules as resident BasicInterpreter instances
// - Scans Menus to add toolbar buttons and dropdown menus
// - Provides Build (publish to shared)
(function(global){
  'use strict';

  const PM = {
    vfs: null,
    currentProjectName: null,
    currentManifest: null,
    currentProjectModules: Object.create(null), // { modulename: BasicInterpreter }
    currentMenus: [], // DOM cleanup records
    currentToolbarButtons: [],

    init(vfs){
      this.vfs = vfs;
    },

    getCurrentProjectName(){ return this.currentProjectName; },

    // --- New/Open/Close ---
    async newProjectPrompt(){
      const name = (global.prompt('New Project Name (1–16 chars, A–Z 0–9 space _ -):','MyProject')||'').trim();
      if (!name) return;
      if (!/^[A-Za-z0-9 _-]{1,16}$/.test(name)){ alert('Invalid name.'); return; }
      await this.createProjectScaffold(name);
      await this.openProject(name);
    },

    async openProjectPrompt(){
      const names = this.listProjectNames();
      if (!names.length){ alert('No projects found. Use File → New Project first.'); return; }
      const choice = global.prompt('Open which project?\n' + names.join('\n'), names[0]);
      if (!choice) return;
      await this.openProject(choice.trim());
    },

    closeProject(){
      // Remove dynamic menus/buttons
      for (const el of this.currentMenus){ try{ el.remove(); }catch(_){} }
      this.currentMenus = [];
      for (const btn of this.currentToolbarButtons){ try{ btn.remove(); }catch(_){} }
      this.currentToolbarButtons = [];
      // Clear modules
      this.currentProjectModules = Object.create(null);
      this.currentManifest = null;
      this.currentProjectName = null;
    },

    // --- Scaffold ---
    async createProjectScaffold(name){
      const now = new Date().toISOString();
      const root = `projects/${name}`;
      const manifest = {
        name, version: 1, created_at: now, updated_at: now,
        systemMenus: 'on', systemButtons: 'on'
      };
      const writeText = (path, content)=>{
        const kind = path.toLowerCase().endsWith('.bas') ? 'program' : 'data';
        this.vfs.writeFile(path, content, kind);
      };
      this.vfs.writeFile(`${root}/project.json`, JSON.stringify(manifest, null, 2), 'data');
      // Menus examples
      const menuFiles = [
        ['Menus/First/DO_THIS.BAS', 'PRINT "DO_THIS from First menu"'],
        ['Menus/First/DO_THAT.BAS', 'PRINT "DO_THAT from First menu"'],
        ['Menus/First/OTHER_THING.BAS', 'PRINT "OTHER_THING from First menu"'],
        ['Menus/Second/DO_THIS.BAS', 'PRINT "DO_THIS from Second menu"'],
        ['Menus/Second/DO_THAT.BAS', 'PRINT "DO_THAT from Second menu"'],
        ['Menus/Third/OTHER_THING1.BAS', 'PRINT "OTHER_THING1 from Third menu"'],
        ['Menus/Third/OTHER_THING2.BAS', 'PRINT "OTHER_THING2 from Third menu"'],
        ['Menus/Third/OTHER_THING3.BAS', 'PRINT "OTHER_THING3 from Third menu"'],
        ['Menus/EXPORT.BAS', 'PRINTLN "Export tapped"']
      ];
      menuFiles.forEach(([p, c])=>writeText(`${root}/${p}`, c+"\n"));
      // Modules
      writeText(`${root}/Modules/FUNCTIONS.BAS`, [
        "' Example module",
        'FUNCTION MyFunc$(A$)',
        '  MyFunc$ = "From FUNCTIONS.MyFunc$: " + A$',
        'END FUNCTION'
      ].join('\n') + '\n');
      writeText(`${root}/Modules/MODULE2.BAS`, [
        "' Example module",
        'FUNCTION MyFuncFromModule2$(A$)',
        '  MyFuncFromModule2$ = "From MODULE2.MyFuncFromModule2$: " + A$',
        'END FUNCTION'
      ].join('\n') + '\n');
      writeText(`${root}/Modules/MODULE3.BAS`, [
        "' Example module",
        'SUB about_button1_click()',
        '  PRINTLN "about_button1_click invoked"',
        'END SUB'
      ].join('\n') + '\n');
      // Views
      const aboutHtml = '<div><h3>About This Project</h3><p>Project Views not fully implemented yet.</p><button id="about_button1" class="btn btn-primary btn-sm">Click me</button></div>';
      writeText(`${root}/Views/ABOUT.html`, aboutHtml);
      writeText(`${root}/Views/TODO.html`, '<div><h3>TODO</h3><p>Project Views not fully implemented yet.</p></div>');
    },

    listProjectNames(){
      const all = this.vfs.listFiles();
      const set = new Set();
      for (const f of all){
        const n = f.name;
        if (n.toLowerCase().startsWith('projects/')){
          const rest = n.slice(9);
          const idx = rest.indexOf('/');
          if (idx > 0){ set.add(rest.slice(0, idx)); }
        }
      }
      return Array.from(set.values()).sort();
    },

    async openProject(name){
      this.closeProject();
      // Load manifest
      const mf = this.vfs.getFile(`projects/${name}/project.json`);
      if (!mf){ alert('project.json not found'); return; }
      try{ this.currentManifest = JSON.parse(mf.content||'{}'); }catch(_){ this.currentManifest = { name }; }
      this.currentProjectName = name;
      // Load modules
      await this._loadModules();
      // Build menus and toolbar
      this._mountMenusAndToolbar();
      // Announce
      if (global.term && global.term.echo){ global.term.echo(`[Project opened] ${name}`); }
    },

    async _loadModules(){
      this.currentProjectModules = Object.create(null);
      const prefix = `projects/${this.currentProjectName}/Modules/`;
      const files = this.vfs.listFiles().filter(f=>f.name.toLowerCase().startsWith(prefix.toLowerCase()) && f.name.toLowerCase().endsWith('.bas'));
      for (const f of files){
        const src = f.content || '';
        const bi = new global.BasicInterpreter({ debug: false, autoEcho: true, vfs: this.vfs,
          hostReadFile: (p)=>PM._hostReadFileRelative(p),
          hostExtern: (name, args)=>PM._hostExtern(name, args),
          hostCallModule: (m, mem, args)=>PM.callModule(m, mem, args)
        });
        // Run once to register functions/subs
        try{ bi.runProgram(src); }catch(e){ console.warn('[ProjectModule] load error', f.name, e); }
        const moduleName = PM._toModuleName(f.name);
        this.currentProjectModules[moduleName] = bi;
      }
    },

    _toModuleName(full){
      const base = full.split('/').pop() || '';
      return base.replace(/\.bas$/i, '').toLowerCase();
    },

    // Convert a filename like "PRINT_NOW.BAS" (or a relative path) to a nice label "Print Now"
    _fileToLabel(fileOrName){
      const s = String(fileOrName||'');
      // take last path segment if a path was provided
      const base = s.split('/').pop() || s;
      // strip extension
      const noExt = base.replace(/\.[A-Za-z0-9]+$/,'');
      // underscores/hyphens to spaces
      const spaced = noExt.replace(/[_-]+/g, ' ').trim();
      return PM._titleCase(spaced || noExt);
    },

    // Simple Title Case helper: first letter of each word uppercased, others lowercased
    _titleCase(str){
      const s = String(str||'').toLowerCase();
      return s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase())
              .replace(/\s+/g,' ')
              .trim();
    },

    callModule(moduleName, memberName, args){
      const mod = String(moduleName||'').toLowerCase();
      const mem = String(memberName||'').toUpperCase();
      const bi = this.currentProjectModules[mod];
      if (!bi) throw new Error('Unknown module: ' + moduleName);
      // function/sub lookup is case-insensitive; funcs keys are uppercased
      if (!bi.funcs || !bi.funcs[mem]) throw new Error(`Unknown member ${memberName} on module ${moduleName}`);
      try{ return bi._callUserFunction(mem, args || []); }
      catch(e){ throw e; }
    },

    // Call any SUB/FUNC by name (search all modules), return first found result
    callAny(memberName, args){
      const mem = String(memberName||'').toUpperCase();
      for (const [modName, bi] of Object.entries(this.currentProjectModules)){
        if (bi && bi.funcs && bi.funcs[mem]){
          try{ return bi._callUserFunction(mem, args||[]); }catch(e){ throw e; }
        }
      }
      return undefined;
    },

    // --- UI mounting ---
    _mountMenusAndToolbar(){
      const name = this.currentProjectName;
      const prefix = `projects/${name}/Menus/`;
      const files = this.vfs.listFiles().filter(f=>f.name.toLowerCase().startsWith(prefix.toLowerCase()) && f.name.toLowerCase().endsWith('.bas'));
      const groups = {}; // menuName -> [{path,label}]
      const topButtons = []; // [{path,label}]
      for (const f of files){
        const rel = f.name.slice(prefix.length);
        const parts = rel.split('/');
        if (parts.length === 1){
          topButtons.push({ path: f.name, label: this._fileToLabel(parts[0]) });
        } else {
          const menu = parts[0];
          const file = parts.slice(1).join('/');
          if (!file) continue;
          const label = this._fileToLabel(file);
          if (!groups[menu]) groups[menu] = [];
          groups[menu].push({ path: f.name, label });
        }
      }
      // Toolbar buttons
      const toolbar = document.querySelector('.toolbar');
      if (toolbar){
        for (const b of topButtons){
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-outline-info btn-sm';
          btn.textContent = b.label;
          btn.addEventListener('click', ()=>PM.runMenuProgram(b.path));
          toolbar.insertBefore(btn, document.getElementById('btn-settings'));
          this.currentToolbarButtons.push(btn);
        }
      }
      // Top-level menus
      const navUl = document.querySelector('#navbarContent .navbar-nav');
      if (navUl){
        Object.keys(groups).forEach(menuName=>{
          const nice = PM._titleCase(menuName);
          const li = document.createElement('li'); li.className = 'nav-item dropdown';
          const a = document.createElement('a');
          a.className = 'nav-link dropdown-toggle'; a.href = '#'; a.setAttribute('role','button'); a.setAttribute('data-bs-toggle','dropdown');
          a.textContent = nice;
          const ul = document.createElement('ul'); ul.className = 'dropdown-menu';
          (groups[menuName]||[]).forEach(item=>{
            const it = document.createElement('a'); it.className = 'dropdown-item'; it.href = '#'; it.textContent = item.label;
            it.addEventListener('click', (e)=>{ e.preventDefault(); PM.runMenuProgram(item.path); });
            const li2 = document.createElement('li'); li2.appendChild(it); ul.appendChild(li2);
          });
          li.appendChild(a); li.appendChild(ul);
          navUl.appendChild(li);
          this.currentMenus.push(li);
        });
      }
    },

    async runMenuProgram(fullPath){
      try{
        const file = this.vfs.getFile(fullPath);
        if (!file){ alert('Program not found: ' + fullPath); return; }
        const code = file.content || '';
        // Reuse the main interpreter for simplicity
        const term = global.term || null;
        const bi = new global.BasicInterpreter({ term, autoEcho: true, debug: false, vfs: this.vfs,
          hostReadFile: (p)=>PM._hostReadFileRelative(p),
          hostExtern: (name, args)=>PM._hostExtern(name, args),
          hostCallModule: (m, mem, args)=>PM.callModule(m, mem, args)
        });
        bi.setTerm(term);
        const out = bi.runProgram(code);
        if (term && out && out.length){ out.forEach(l=>{ if (l && l.length) term.echo(l); }); }
      }catch(e){ console.error(e); alert(String(e && e.message ? e.message : e)); }
    },

    // --- Host helpers ---
    _hostReadFileRelative(path){
      const p = String(path||'');
      const absPrefixes = ['projects/','shared/','examples/','data/','/'];
      const isAbs = absPrefixes.some(pre=>p.toLowerCase().startsWith(pre));
      if (isAbs){
        const f = this.vfs.getFile(p);
        return f && f.content ? f.content : '';
      }
      if (this.currentProjectName){
        const full = `projects/${this.currentProjectName}/${p}`;
        const f = this.vfs.getFile(full);
        return f && f.content ? f.content : '';
      }
      return '';
    },

    _hostExtern(name, args){
      const fn = global.YoBasicHost && global.YoBasicHost[name];
      if (typeof fn === 'function'){
        const res = fn.apply(global.YoBasicHost, args||[]);
        return (typeof res === 'string') ? res : '';
      }
      return '';
    },

    // --- Build/Publish ---
    async buildCurrent(){
      if (!this.currentProjectName){ alert('No project is open.'); return; }
      const me = global.Identity && global.Identity.getCurrentUser && global.Identity.getCurrentUser();
      if (!me){ alert('You must be logged in to publish projects. Use Identity → Log In.'); return; }
      const base = `projects/${this.currentProjectName}/`;
      const files = this.vfs.listFiles().filter(f=>f.name.toLowerCase().startsWith(base.toLowerCase()));
      // Upsert each file into shared namespace
      for (const f of files){
        const pathRest = f.name.slice(('projects/'+this.currentProjectName+'/').length);
        const sharedFull = `shared/${me.username}/projects/${this.currentProjectName}/${pathRest}`;
        await this.vfs.writeFileAsync(sharedFull, f.content, f.kind);
      }
      // Update updated_at
      try{
        const mf = this.vfs.getFile(`projects/${this.currentProjectName}/project.json`);
        if (mf){
          const j = JSON.parse(mf.content||'{}'); j.updated_at = new Date().toISOString();
          this.vfs.writeFile(`projects/${this.currentProjectName}/project.json`, JSON.stringify(j, null, 2), 'data');
        }
      }catch(_){ }
      // Show share URL (use prompt for easy copy)
      const url = `${location.origin}${location.pathname}?sharedProject=${encodeURIComponent(me.username)}/${encodeURIComponent(this.currentProjectName)}`;
      global.prompt('Build complete! Copy this URL to share your project:', url);
    }
  };

  global.ProjectManager = PM;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
