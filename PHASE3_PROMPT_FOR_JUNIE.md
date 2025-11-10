## IDE FRAMEWORK PHASE 3 PROMPT FOR JUNIE – Projects, Menus, Modules, Views & Build

You’re working on the YoBASIC BASIC playground at `https://yobasic.com/basic`.

We already have:

* A JavaScript BASIC interpreter (`basic.js`) driving:

    * A CLI / output panel.
    * A simple editor at the top.
* An 80’s-style menu bar with:

    * File / Tools / Help.
    * File → New / Open / Save / Save As (wired to a Virtual File System).
    * Help → About (modal).
* A **Virtual File System (VFS)** with multiple providers:

    * Local (localStorage) for:

        * Root (scratch `.BAS` files).
        * `data/` (BASIC data files via OPEN/PRINT#/INPUT#/CLOSE/EOF).
    * Supabase for:

        * `examples/` (read-only).
        * `shared/<username>/...` (public read, owner write, via `shared_files` table with RLS).
* Identity system using Supabase:

    * “Create Identity” / “Log In” → username/password → Supabase `auth.users` + `profiles.username`.
    * Logged-in users get a `shared/<username>/` folder in the VFS.

The UI has a toolbar with buttons for Run, Debug toggle, Clear, Login/Logout, and an unused **Build** button.

Now we want **Phase 3**: add **Projects** with menus, modules, views, and build/publish.

---

## 1. Overall Concept

Add a new VFS “namespace”:

* `projects/<ProjectName>/...`

Projects live **locally** (localStorage) and organize code + views as:

* `projects/<Name>/project.json` – project manifest.
* `projects/<Name>/Menus/...` – menu definitions + toolbar buttons (as BASIC programs).
* `projects/<Name>/Modules/...` – BASIC “modules” that are loaded once and remain resident.
* `projects/<Name>/Views/...` – HTML view templates (for now, mostly stubs).

When a project is **Open**, it’s also considered **Running**:

* Its Menus and toolbar buttons appear in the UI.
* Its Modules are loaded into resident interpreter instances.
* Its Views become available (we’ll mostly stub behavior this phase).

When a project is **Closed**, we:

* Remove those dynamic menus and buttons from the UI.
* Tear down module instances.

Finally, the **Build** button will:

* Take the current project tree from local VFS (`projects/<Name>/...`),
* Publish it into the user’s Supabase `shared/<username>/projects/<Name>/...`,
* And provide a shareable URL so other users can open that project as a shared project.

---

## 2. Project Storage in the VFS

### 2.1. Naming & structure

* Project name:

    * 1–16 chars, `[A-Za-z0-9 _-]` (spaces allowed).
    * Internally used directly as `<ProjectName>` in VFS paths.
* VFS keys:

    * `projects/<ProjectName>/project.json`
    * `projects/<ProjectName>/Menus/First/DO_THIS.BAS`
    * `projects/<ProjectName>/Modules/FUNCTIONS.BAS`
    * `projects/<ProjectName>/Views/ABOUT.html`
* They are stored in the **local** VFS provider (localStorage).

### 2.2. Manifest (project.json)

We **do not** need to manually list menus or modules in the manifest; those are inferred from the directory tree. The manifest is mostly for metadata and settings.

For now, define `project.json` as a simple JSON text file like:

```json
{
  "name": "MyProject",
  "version": 1,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z",
  "systemMenus": "on",
  "systemButtons": "on"
}
```

* `systemMenus` and `systemButtons`:

    * Strings `"on"`/`"off"` (we won’t fully implement them yet; just read and respect them where easy).
    * For this phase, it’s fine if they’re just stored and not fully enforced in the UI.
* The user can open/edit this file like any other file; we’ll trust them not to break it.

We’ll also need a small JS helper to:

* Load and parse `project.json`.
* Update `updated_at` as needed.
* But we don’t need a separate GUI form for it yet.

---

## 3. File Menu: New Project / Open Project / Close Project

### 3.1. File → New Project

When the user chooses **New Project**:

1. Prompt for a **project name**:

    * Validate: 1–16 chars, `[A-Za-z0-9 _-]`.
    * If invalid or cancelled, abort.
2. Create the project structure in VFS:

    * `projects/<Name>/project.json` with default metadata/settings.
    * `projects/<Name>/Menus/First/DO_THIS.BAS`
    * `projects/<Name>/Menus/First/DO_THAT.BAS`
    * `projects/<Name>/Menus/First/OTHER_THING.BAS`
    * `projects/<Name>/Menus/Second/DO_THIS.BAS`
    * `projects/<Name>/Menus/Second/DO_THAT.BAS`
    * `projects/<Name>/Menus/Third/OTHER_THING1.BAS`
    * `projects/<Name>/Menus/Third/OTHER_THING2.BAS`
    * `projects/<Name>/Menus/Third/OTHER_THING3.BAS`
    * `projects/<Name>/Modules/FUNCTIONS.BAS` with a small example function/sub.
    * `projects/<Name>/Modules/MODULE2.BAS` with a small example function/sub.
    * `projects/<Name>/Modules/MODULE3.BAS` with a small example function/sub.
    * `projects/<Name>/Views/ABOUT.html` as a stub (copy of existing Help→About modal HTML plus a notice).
    * `projects/<Name>/Views/TODO.html` as a stub (copy of existing Help→About modal HTML plus a notice).
3. Automatically **Open** (and therefore “run”) this new project (see section 4).

Example contents (feel free to tweak BASIC syntax to match our interpreter):

* `DO_THIS.BAS`:

  ```basic
  PRINT "DO_THIS from First menu"
  ```

* `DO_THAT.BAS`:

  ```basic
  PRINT "DO_THAT from First menu"
  ```

(etc)

* `FUNCTIONS.BAS`:

  ```basic
  ' Example module
  FUNCTION MyFunc$(A$)
    MyFunc$ = "From FUNCTIONS.MyFunc$: " + A$
  END FUNCTION
  ```

* `MODULE2.BAS`:

  ```basic
  ' Example module
  FUNCTION MyFuncFromModule2$(A$)
    MyFunc$ = "From MODULE2.MyFunc$: " + A$
  END FUNCTION
  ```

(etc)


* Views/ABOUT.html: copy current About dialog HTML and add text like “Project Views not fully implemented yet”.
* Views/TODO.html: copy current About dialog HTML and add text like “Project Views not fully implemented yet”.

### 3.2. File → Open Project

When the user chooses **Open Project**:

1. Show a modal listing all existing projects:

    * Scan VFS keys for `projects/<ProjectName>/project.json` and collect distinct `<ProjectName>`.
    * Display as a simple list with creation/updated dates if available.
2. When a project `<Name>` is selected and confirmed:

    * Call the **Open Project** routine (see section 4).

### 3.3. File → Close Project

When **Close Project** is selected:

* If a project is currently open:

    * Remove its dynamic menus and toolbar buttons.
    * Clear module instances.
    * Clear any “currentProjectName” state.
* Do not destroy its files; they remain in local VFS.

---

## 4. Opening / Running a Project

We need a small “Project Manager” module in JS that keeps track of:

* `currentProjectName: string | null`
* `currentProjectManifest: ProjectManifest | null`
* `currentProjectModules: { [moduleName: string]: BasicInterpreterInstance }`
* `currentProjectMenus: ...` (enough info to unregister/menu-entries later)
* `currentProjectViews: ...` (for later phases; minimal now)

### 4.1. Open Project steps

When opening `projects/<Name>`:

1. Load `project.json` via VFS and parse it.
2. Load all modules under `projects/<Name>/Modules/`.
3. Load menus under `projects/<Name>/Menus/` and register them in the menu bar / toolbar.
4. Optionally, load Views under `projects/<Name>/Views/` into a registry (we’ll use them in a basic way now, more later).

Set `currentProjectName` and supporting state.

On Close:

* Reverse these operations:

    * Unregister menus/buttons.
    * Clear module interpreters.

---

## 5. Dynamic Menus from `Menus/`

### 5.1. Directory mapping

For an open project `<Name>`, under `projects/<Name>/Menus/` we can have:

* **Top-level toolbar button programs** (no subfolder):

    * e.g. `projects/<Name>/Menus/EXPORT.BAS`.
* **Top-level menu folders**:

    * Each subfolder is a menu:

        * `projects/<Name>/Menus/Print/...` → “Print” menu.
        * `projects/<Name>/Menus/Report/...` → “Report” menu.
    * Each file inside is a menu item:

        * `PRINT_NOW.BAS` → menu item label from filename.

#### File→Label conversion

Given a filename `PRINT_NOW.BAS`:

* Strip extension → `PRINT_NOW`.
* Replace `_` and `-` with spaces → `PRINT NOW`.
* Title case → `Print Now`.

Top-level menu folder name `Print` → “Print” (with first letter uppercase).

### 5.2. Toolbar buttons vs drop-down menus

* Files directly under `Menus/` (no subfolder):

    * Represent **toolbar buttons**.
    * They appear alongside existing Run/Build/etc buttons.
    * For now:

        * Use the label derived from filename as the button text.
        * Style like other toolbar buttons (same CSS class).
    * Clicking a button runs the corresponding BASIC program:

        * `projects/<Name>/Menus/EXPORT.BAS`, etc.

* Folders under `Menus/`:

    * Represent **top-level menus** in the menu bar.
    * Their contents (files) are drop-down items.

### 5.3. Hotkey derivation

We must compute hotkeys (Alt-letters, underlined letters) dynamically while respecting the *existing* static menus:

* Static menus:

    * File → F
    * Tools → T
    * Help → H

#### Top-level menu hotkeys

Algorithm:

1. Maintain a set `usedTopMenuHotkeys` initialized with `{ 'f', 't', 'h' }`.
2. For each project menu in insertion order (e.g. `Print`, `Report`, ...):

    * For the menu label (e.g. “Print”):

        * Iterate through each letter in order (case-insensitive), ignoring spaces/punctuation.
        * For the first letter `c` not in `usedTopMenuHotkeys`, assign that as the hotkey.
        * Add `c` to `usedTopMenuHotkeys`.
    * If no such letter exists, the menu has no hotkey.
3. Integrate into the existing keyboard handlers:

    * Alt+<hotkey> triggers that menu.

#### Drop-down item hotkeys

Per top-level menu:

1. Maintain `usedItemHotkeys` set for that menu.
2. For each item label (e.g. “Print Now”, “Preview”, “Download”):

    * Same process:

        * Scan letters in order.
        * First unused letter in `usedItemHotkeys` becomes the item hotkey.
3. When the menu is open:

    * Pressing that letter jumps/activates that item.

### 5.4. Running a menu item program

When a menu item or toolbar button is selected:

1. Determine `fullPath`:

    * Top-level button: `projects/<Name>/Menus/EXPORT.BAS`.
    * Drop-down item: `projects/<Name>/Menus/Print/PRINT_NOW.BAS`.
2. Use the VFS to read the file content.
3. Maintain a cache of compiled/interpreted programs per `fullPath`:

    * If cached but the source has changed (hash or timestamp), recompile/re-parse.
4. Run this program as a **script** in the BASIC interpreter:

    * It should have access to:

        * The CLI (PRINT etc).
        * File I/O via existing VFS.
        * The project modules for dotted calls (see next section).

---

## 6. Modules: Resident BASIC Libraries

### 6.1. Loading modules

On project open:

1. Scan `projects/<Name>/Modules/` for `.BAS` files.
2. For each file `FUNCTIONS.BAS`:

    * Derive module name: lowercase of filename without extension → `functions`.
3. For each module:

    * Create a new `BasicInterpreterInstance`.
    * Load its source.
    * “Run” the script once:

        * Execute top-level code.
        * Register any `SUB`s and `FUNCTION`s in that interpreter.
    * Store the instance in `currentProjectModules[moduleName]`.

### 6.2. Cross-module calls with `moduleName.FuncName`

We want code like:

```basic
B$ = functions.MyFunc(A$)
```

to work from menu programs (and from other modules).

This requires updates to the BASIC engine:

1. **Parser extension**:

    * Currently, function calls likely use syntax like `IDENT '(' args ')'`.
    * Extend grammar to support dotted calls:

        * `IDENT '.' IDENT '(' args ')'`.
    * Represent this internally as something like:

        * A call node with `moduleName` + `functionName` + args.
    * Keep plain `IDENT()` calls working as before.

2. **Runtime dispatch**:

    * When evaluating a call:

        * If no `moduleName`, use existing behavior (call local/subroutine or built-in function).
        * If there *is* a `moduleName`:

            * Lowercase both `moduleName` and `functionName`.
            * Look up `moduleName` in the `currentProjectModules` registry.
            * If not found: runtime error, e.g. `Unknown module: MODULE`.
            * If found:

                * Use a new API on the module interpreter instance, something like:

                  ```js
                  moduleInstance.callFunction(functionName, argsArray) → value
                  ```

                  and/or

                  ```js
                  moduleInstance.callSub(subName, argsArray)
                  ```
                * That API should:

                    * Not re-run the whole script.
                    * Only run the specified SUB/FUNCTION with the given args.
                    * Return the function’s value, or nothing for SUB.

3. **Case-insensitivity**:

    * Ensure module and function names are matched case-insensitively, consistent with the rest of the BASIC engine.

We do **not** need complex namespacing yet; just `moduleName.functionName`.

---

## 7. Views: HTML Templates + Event Handlers

Views are HTML files under:

* `projects/<Name>/Views/`

For now, we’ll:

* Use them to define modal dialog content.
* Support a **convention-based event binding**:

    * Element IDs in the view map to SUB/FUNCTIONs in modules by name.

### 7.1. View files

Example:

* `projects/<Name>/Views/ABOUT.html` – content similar to Help→About.

We’ll define “view name” from filename:

* File `ABOUT.html` → view name `"about"` (lowercase base name).

### 7.2. Modal loading (basic behavior)

For this phase:

* Implement a simple helper to:

    * Load a view’s HTML from VFS.
    * Create a modal DOM element (reuse the same modal styling used by Help→About).
    * Inject the HTML into the modal body.
    * Show the modal.

You can expose this as a JS function like:

```js
openProjectView(viewName: string): void
```

and eventually call it from BASIC or menu scripts later.

### 7.3. Event handler convention

Event binding convention:

* Suppose a view file is `ABOUT.html` → `viewName = "about"`.

* Inside the view HTML, there might be:

  ```html
  <button id="about_button1">Click me</button>
  ```

* For any such element, we attempt to bind events by name:

    * On `click`, we look for a BASIC SUB/FUNCTION named:

        * `about_button1_click`

* Search order:

    * Search all modules in `currentProjectModules` for a SUB/FUNCTION with that name (case-insensitive).
    * If found, event handler calls that SUB or FUNCTION with no args (or a simple arg list if you choose to support it later).
    * If not found, ignore or log a warning (no crash).

Implementation detail:

* When we load a view:

    * After injecting HTML:

        * Query all elements with an `id` attribute.
        * For each id `X`:

            * Build handler name: `X + "_click"` (lowercase).
            * Attach a click event listener that:

                * Looks up `handlerName` in modules.
                * If found, invoke via `moduleInstance.callSub(handlerName, [])` (or `callFunction`, depending how the module defines it).
* We don’t enforce that IDs must follow a naming convention; we just **use the IDs as-is** with the `_click` suffix.

We don’t yet need to map non-click events (change, input, etc.). Click is enough for this phase.

Error handling:

* For now:

    * Log to console if a handler is missing, but don’t crash.
    * Later we can show nicer errors inside the CLI.

---

## 8. Build Button: Publish Project to Shared Supabase

We already have:

* Supabase tables:

    * `shared_files` with:

        * `owner_id`, `owner_name`, `path`, `kind`, `content`, timestamps.
* Shared VFS provider that:

    * Reads from/writes to `shared/<username>/<path>`.

For projects, we will:

* Publish `projects/<Name>/...` into shared namespace under:

    * `shared/<username>/projects/<Name>/...`

### 8.1. Build flow

When the user clicks **Build**:

1. Check there is a current project `<Name>`; if not, show a message and abort.

2. Check the user is logged in:

    * If not, show a modal:

        * “You must be logged in to publish projects. Use Identity → Create Identity or Log In.”
    * Abort.

3. Gather all local project files:

    * List all VFS keys starting with `projects/<Name>/`.
    * For each key:

        * Read content from local VFS.

4. For each such local file `projects/<Name>/<restOfPath>`:

    * Construct shared VFS name:

        * `shared/<username>/projects/<Name>/<restOfPath>`
        * (Note: avoid duplicate `projects/<Name>` prefix; the idea is that `path` in `shared_files` is `projects/<Name>/...`).
    * Use the existing Supabase shared provider to **upsert** the file into `shared_files`.

5. Update the project manifest’s `updated_at` locally (optional but nice).

6. Once all writes are successful, generate a shareable URL, e.g.:

    * `https://yobasic.com/basic?sharedProject=<username>/<Name>`

7. Show a small modal:

   > Build complete!
   > Share this URL to open the project:
   > `https://yobasic.com/basic?sharedProject=erik_olson/MyProject`

### 8.2. Loading a shared project via URL

On page load:

1. Parse `location.search` for `sharedProject=<ownerName>/<ProjectName>`.
2. If present:

    * Use the shared provider (Supabase) to query `shared_files` for rows where:

        * `owner_name = <ownerName>` AND
        * `path` LIKE `'projects/<ProjectName>/%'`.
    * For each row:

        * Recreate a **local** VFS file:

            * `projects/<ProjectName>/<restOfPath>` with the same content.
    * Then call the **Open Project** routine on `<ProjectName>`.
3. Treat this project as:

    * Read-only from the Supabase side: only `<ownerName>` can publish updates.
    * But the viewer can:

        * Open the project.
        * Run it.
        * Use File → Save As… to copy specific files to their own Root or Projects (we can add explicit “Fork project” later).

For now, it’s enough that the project loads and runs with dynamic menus + modules.

---

## 9. Deletion (Future Detail)

We will eventually need:

* The ability to delete project files from local VFS (and re-Build).
* We don’t have to implement a full file manager UI in this phase, but keep in mind:

    * The VFS should support a `deleteFile(name)` method if it doesn’t already.
    * Future UI can expose deletion for project files/menus/modules/views.

For now, a TODO comment is sufficient.

---

## 10. Implementation Order (For You, Junie)

Please implement in roughly this order:

1. **Project namespace & manifest:**

    * Add support for `projects/<Name>/` in local VFS.
    * Implement File → New Project / Open Project / Close Project.
    * Create starter project.json and example Menus/Modules/Views files.

2. **Dynamic Menus & Toolbar buttons:**

    * Scan `Menus/` tree and:

        * Create toolbar buttons from top-level `.BAS` files.
        * Create top-level menus and items from subfolders and their `.BAS` files.
    * Implement hotkey derivation and integrate with existing keyboard handlers.
    * Wire item/button activation to run the corresponding BASIC program.

3. **Module system & dotted calls:**

    * Load `Modules/` into resident interpreter instances on project open.
    * Extend BASIC parser to support `moduleName.funcName(...)` calls.
    * Implement cross-module call dispatch in the runtime.

4. **Views + event handler convention:**

    * Load HTML views from `Views/`.
    * Implement a helper to open views in modals.
    * Implement event binding:

        * Element `id = X` → look for BASIC handler `X_click` in modules and attach to click events.

5. **Build & Publish:**

    * Implement Build button:

        * Dump `projects/<Name>/...` to Supabase shared namespace.
        * Generate and display share URL.
    * On page load:

        * If `sharedProject` query param exists, fetch shared project files from Supabase, hydrate local `projects/<Name>/...`, and auto-open the project.

Please keep the new code organized into clearly named modules (e.g., `projectManager.js`, `menusProject.js`, `modulesProject.js`, `viewsProject.js`, or similar), and keep changes to the BASIC interpreter localized where possible.

---

When this is done, I should be able to:

* Create a new project.
* See its dynamic menus and toolbar buttons appear and run example BASIC programs.
* Create modules and call `moduleName.FuncName()` from menu scripts.
* Load simple HTML views and have clicks on buttons invoke BASIC SUBs in modules via the `id_click` naming convention.
* Click Build to publish the project to my `shared/<username>/projects/<Name>/...` namespace and share a URL that opens the project for others.

---

Below is an **addendum**

---

## 🔧 ADDENDUM TO PHASE 3 – Host Bridge, READFILE$, and View Invocation

We need to clarify **how BASIC code invokes Views** and, more generally, how BASIC calls out to “host” features (DOM, modals, etc.) without hard-wiring that into `basic.js`.

### 11. Host Bridge Concept

We want `basic.js` to remain as generic as possible (no direct DOM / VFS / Projects knowledge). Instead, introduce a **host bridge**:

* A small JS singleton (or module) that `basic.js` can call into.
* For this project, call it: `YoBasicHost`.
* `YoBasicHost` is responsible for:

    * Reading project files (views, etc.) from the VFS.
    * Showing modals and binding events.
    * Potentially later: doing DOM manipulation, extra utilities, etc.

`basic.js` will expose **two built-in functions** that delegate to host callbacks:

1. `READFILE$(path$)`
2. `EXTERN(name$, arg1$, arg2$, ...)`

These are the *only* YoBASIC-specific hooks we add to the BASIC core. The host (our page) wires them up to `YoBasicHost`. In other environments, they can be wired differently or left unimplemented.

---

### 12. New BASIC Built-ins

#### 12.1. `READFILE$(path$)`

A BASIC function that returns the contents of a file as a string.

Usage example in BASIC:

```basic
html$ = READFILE$("Views/about.html")
```

Resolution rules:

* If `path$` is **absolute** (starts with `projects/`, `shared/`, `examples/`, `data/`, or `/` if you choose to treat that specially), treat it as a **full VFS path** and read directly.
* If `path$` is **relative** (doesn’t start with one of the above prefixes):

    * If a project `<CurrentProjectName>` is open:

        * Resolve it relative to that project:
          `projects/<CurrentProjectName>/<path$>`

            * e.g. `READFILE$("Views/about.html")`
              → `projects/<CurrentProjectName>/Views/about.html`
    * If no project is open:

        * For now, either:

            * Treat relative to Root, or
            * Return an error / empty string.
        * Add a comment in code explaining the chosen behavior.

Implementation:

* In `basic.js`, add a built-in function `READFILE$` that:

    * Calls a host-provided callback, e.g. `hostReadFile(path: string): string`.
    * If the host callback is not provided or throws, raise a BASIC runtime error.
* In the YoBASIC page, pass a host implementation that:

    * Uses the existing VFS + project manager to resolve the file and return its content as text.

#### 12.2. `EXTERN(name$, arg1$, arg2$, ...)`

A BASIC function for calling **host methods** that are outside the BASIC runtime’s scope (DOM, modals, etc.).

Usage example:

```basic
html$ = READFILE$("Views/about.html")
EXTERN("showModal", html$)
```

Semantics:

* First parameter `name$` is the method name on the host bridge.
* Remaining parameters are arguments passed as strings (for now).
* `EXTERN` may:

    * Return a string (if the host method returns something), or
    * Return `""` if nothing is returned.
* For now we can allow both:

    * Many calls (like `showModal`) will ignore the return value.
    * Others could be used in expressions if needed later.

Implementation:

* In `basic.js`, add a built-in function `EXTERN`:

    * It calls a host-provided callback, e.g.:

      ```js
      hostExtern(methodName: string, args: string[]): string
      ```
    * If the host callback is not provided or the method is unknown, raise a BASIC runtime error (or return `""` and log; choose a consistent behavior and document it).
* In the YoBASIC page, implement `hostExtern` by delegating into `YoBasicHost`:

  ```js
  const YoBasicHost = {
    showModal(html) { /* ... */ },
    // future: focusElement(id), setTitle(text), etc.
  };

  function hostExtern(methodName, args) {
    const fn = YoBasicHost[methodName];
    if (typeof fn !== 'function') {
      console.warn('Unknown host method', methodName);
      return "";
    }
    const result = fn(...args);
    return typeof result === 'string' ? result : "";
  }
  ```

---

### 13. View Invocation via BASIC

Tie this into the **Views** story from Phase 3.

Recall:

* Views are HTML files under `projects/<Name>/Views/`.
* For example: `projects/MyProject/Views/about.html`.

Now define a recommended pattern:

**BASIC code in a menu or module:**

```basic
html$ = READFILE$("Views/about.html")
EXTERN("showModal", html$)
```

Host side (`YoBasicHost.showModal`):

1. Take the HTML string.

2. Create or reuse a modal container with the same styling as the existing Help→About dialog.

3. Inject the HTML as the modal content.

4. **After** the DOM is ready, attach event handlers using the convention:

    * For every element with an `id`:

        * Let `id = X` (e.g. `"about_button1"`).
        * Compute handler name: `X + "_click"` → `"about_button1_click"`.
        * On `click`:

            * Search all project modules for a SUB/FUNC named `about_button1_click`.
            * If found:

                * Invoke via the module interpreter’s `callSub` / `callFunction`.
            * If not:

                * Quietly ignore or log a warning (no crash).

5. Show the modal.

This keeps the **View invocation** in BASIC very simple (READFILE$ + EXTERN) and leaves all DOM and event plumbing in the host layer.

---

### 14. Host Wiring in `basic.js`

To keep `basic.js` generic:

* Adjust the interpreter’s constructor (or initialization) to accept an optional **host config** object, e.g.:

  ```js
  const basic = new BasicInterpreter({
    hostReadFile: (path) => { ... },
    hostExtern: (name, args) => { ... }
  });
  ```

* The built-ins `READFILE$` and `EXTERN` will:

    * Use `this.hostReadFile` / `this.hostExtern` if provided.
    * If missing:

        * Either throw a BASIC error like `Host function not available`
        * Or return `""` and log; decide & document.

On the YoBASIC page:

* For the **project modules** and **menu script** interpreters, you **must** pass in these host functions so they can:

    * Use `READFILE$` to load views relative to the current project.
    * Use `EXTERN` to call host functions like `showModal`.

On other pages where you may reuse `basic.js`, you can:

* Omit host functions (they’ll just not support EXTERN/READFILE$), or
* Wire them to different host logic (e.g., Node.js, CLI environment, etc.).

---

### 15. Summary of Changes for You, Junie (Addendum)

1. Add `READFILE$` and `EXTERN` built-ins to the BASIC interpreter, implemented via host callbacks (`hostReadFile`, `hostExtern`).
2. Implement a `YoBasicHost` JS object in the YoBASIC page.
3. Implement `hostReadFile` to:

    * Resolve relative paths against the current project root (`projects/<CurrentProjectName>/...`).
    * Use the existing VFS to read file contents.
4. Implement `hostExtern` to:

    * Look up and call `YoBasicHost[methodName]` with string args.
5. Implement `YoBasicHost.showModal(html)` to:

    * Display the HTML in a modal.
    * Attach click handlers based on `id + "_click"` naming convention, calling BASIC module SUBs/FUNCTIONs where defined.
6. Update the Phase 3 view examples so they demonstrate:

   ```basic
   html$ = READFILE$("Views/about.html")
   EXTERN("showModal", html$)
   ```

   as the canonical way to open a view.

That’s it for the addendum. This gives us a clean, generic BASIC core plus a flexible host bridge, and a clear pattern for views & other GUI-ish extensions going forward.

