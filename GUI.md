## Junie Prompt: YoBASIC UI Dialog Library (Event → SUB/FUNCTION, Browser-only, Node no-op)

### Goal

Add an optional **UI/dialog library** to `basic.js` (YoBASIC) that enables **event-driven GUI apps in the browser**, while being **ignored / no-op in Node**. Students should be able to build Visual BASIC–style GUI programs where DOM events (click/change/input/submit, etc.) directly call BASIC `SUB`s or `FUNCTION`s, without any polling loop in BASIC.

The UI system must support:

* **Prefabricated HTML view files** stored in the pseudo-filesystem (VFS), and user-authored views
* Template preprocessing via existing `RENDER$` (Blade-ish directives, `{{ }}`, embedded BASIC tags, etc.)
* An optional “UI runtime” DOM root + modal manager + Windows 95-ish CSS theme (can ship with basic.js but should be optional)

### Constraints / Design Requirements

1. **Browser-only behavior**

    * In browser: UI renders, events bind, handlers execute.
    * In Node: UI functions are safe no-ops (return 0/empty string), no crashes, program runs normally.

2. **Event-driven, no polling**

    * BASIC program should be able to *finish* after registering handlers and still respond to UI events.
    * The interpreter must remain “alive” in memory to service callbacks.
    * No requirement for a BASIC event loop.

3. **Plays nicely with IDE wrapper**

    * IDE wrapper can have its own JS event handlers; YoBASIC UI must not globally block or hijack the DOM.
    * UI should render under a dedicated root element and use scoped event listeners.

4. **Safe re-entrancy**

    * Prevent overlapping interpreter re-entry if multiple events fire quickly.
    * Use a simple JS-side “run lock” + queue (microtask) so BASIC handlers execute sequentially.

5. **Simple student-facing API**

    * A small UI module with a few easy calls: show dialog from view, bind events to SUB/FUNCTION by name, set/get control values, close dialog.

---

## Deliverables

1. UI module implemented (browser + node).
2. Optional UI runtime DOM root + modal manager + CSS theme.
3. Examples (BASIC programs + HTML views) demonstrating:

    * Simple button click calling a BASIC SUB
    * Form submit mapping to a BASIC FUNCTION or SUB
    * Reading/writing values with UI calls
4. Docs: `docs/ui.md` with API reference + a “first GUI app” tutorial.

---

## V1 Spec (Implement This)

### A) UI Module API (BASIC-facing)

Implement these callable members (via existing `module.member(args)` host dispatch):

#### Capability

* `UI.AVAILABLE%()`
  Returns `1` in browser where DOM is available, else `0`.

#### Dialog Lifecycle

* `UI.SHOW%(viewPath$, vars@, options@)` → `dialogId%`

    * Loads `viewPath$` from VFS (string)
    * Runs it through `RENDER$` with `vars@` (dictionary) as variables
    * Injects into a modal window (or root container if options specify non-modal)
    * Returns integer id

* `UI.CLOSE%(dialogId%)` → `ok%`

#### Control Interaction

* `UI.SET_TEXT%(dialogId%, selector$, text$)` → `ok%`
* `UI.GET_TEXT$(dialogId%, selector$)` → `text$`
* `UI.SET_VALUE%(dialogId%, selector$, value$)` → `ok%`
* `UI.GET_VALUE$(dialogId%, selector$)` → `value$`
* `UI.SET_HTML%(dialogId%, selector$, html$)` → `ok%` (use carefully; docs should warn)
* `UI.FOCUS%(dialogId%, selector$)` → `ok%`

Selectors are standard CSS selectors, scoped inside the dialog root.

#### Event Binding (VB-style)

* `UI.ON%(dialogId%, event$, selector$, handlerName$)` → `ok%`

    * `event$`: `"click"`, `"change"`, `"input"`, `"submit"`, `"keydown"`, etc.
    * `selector$`: CSS selector (e.g. `"#saveBtn"`). Support `"*"` for dialog root.
    * `handlerName$`: name of BASIC `SUB` or `FUNCTION` to call.
    * When event fires, call the BASIC handler with a small argument set.

**Handler argument convention (keep it simple):**

* Call handler with **one dictionary argument** `evt@` containing:

    * `evt@["dialogId%"]`
    * `evt@["type$"]`
    * `evt@["selector$"]` (the selector used to bind)
    * `evt@["targetId$"]` (DOM id if present, else "")
    * `evt@["value$"]` (for input/select/textarea; else "")
    * `evt@["key$"]` and `evt@["keyCode%"]` if keyboard event; else ""
    * `evt@["preventDefault%"]` (initially 0; if handler sets to 1, JS should call `event.preventDefault()`)

If BASIC handler is a FUNCTION and returns integer truthy value, treat it as `preventDefault` too (nice VB-ish behavior). Document clearly.

#### Cleanup

* `UI.OFF%(dialogId%, event$, selector$, handlerName$)` → `ok%` (optional in V1 but recommended)
* When `UI.CLOSE%` is called, automatically detach all listeners for that dialog.

---

### B) Interpreter Host Bridge Needed: “Invoke SUB/FUNCTION by name from JS”

Add a **public method** to the interpreter instance (or a safe internal hook used by UI module) that can execute a BASIC `SUB` or `FUNCTION` by name:

* `interpreter.invokeCallable(name, argsArray)` → return value (for FUNCTION) or null (SUB)
* Must throw a controlled BASIC error if not found / wrong arity.
* Must run in the correct global context (same as if BASIC called it).
* Must allow calling after the main program has “completed” (i.e., do not tear down needed state on program end).

**Important:** Add a small “execution gate” so UI events do not re-enter while the interpreter is mid-execution. Implement a queue in UI module if needed.

---

### C) UI Runtime (Optional but included)

Implement a lightweight runtime that can be present or absent:

* If page already has `<div id="yobasic-ui-root"></div>`, use it.
* Otherwise create it and append to `document.body`.
* Modal manager:

    * Each `UI.SHOW%` creates a dialog container with a title bar + close button.
    * Windows stack + z-index.
    * Drag to move (optional for V1; if too much, skip dragging but keep structure).
* Provide a default Windows 95-ish CSS file:

    * Place under something like `ui/yobasic-ui.css`
    * The UI should still work without the CSS, just look plain.

Do **not** interfere with host page styling; scope classes under `.yobasic-ui` root.

---

### D) Prefab Views + VFS Integration

* `UI.SHOW%` must load `viewPath$` from the VFS (same mechanism BASIC uses for `OPEN ... FOR INPUT`).
* If file missing, raise a BASIC runtime error with a clear message.
* `vars@` is optional; if absent, pass empty dictionary to `RENDER$`.

---

### E) Node Behavior (No-op)

In Node:

* `UI.AVAILABLE%()` returns 0
* `UI.SHOW%()` returns 0
* `UI.ON%()` returns 0
* getters return `""`
* setters return 0
  No crashing, no DOM references, no `window` usage.

---

## File/Code Organization Guidance

* Keep UI module code isolated (e.g. `src/modules/ui.js` or similar), but integrate with your existing module dispatch mechanism (`hostCallModule`).
* Add any small interpreter extensions (invokeCallable) in a minimal, well-commented way.
* Avoid heavy dependencies.

---

## Examples to Add (Required)

### Example 1: Button Click

**BASIC:** `examples/ui_click.bas`

* Shows dialog from `/views/counter.html`
* Binds `click` on `#incBtn` to `Inc_Click`
* Handler increments a global `count%` and sets `#countLabel` text.

**HTML view:** `/views/counter.html`

* Basic layout with label and button.

### Example 2: Form Submit

**BASIC:** `examples/ui_form.bas`

* Shows dialog from `/views/login.html`
* Binds `submit` on `form` to `Login_Submit`
* Reads `#user` and `#pass` values, validates, and either closes or displays an error message.
* Demonstrate `preventDefault` by setting it in `evt@`.

**HTML view:** `/views/login.html`

---

## Docs (Required)

Create `docs/ui.md` containing:

* Concept overview (VB-style event-driven model)
* API reference table
* How to create a view file in VFS
* How handler SUB/FUNCTION receives `evt@`
* Browser vs Node behavior
* Safety notes: return values, preventDefault, scoping, cleanup

---

## Acceptance Criteria

1. In browser, sample programs work and events call BASIC handlers correctly even after the main program ends.
2. Multiple clicks do not crash; handlers run sequentially (no concurrent interpreter execution).
3. Closing a dialog detaches its listeners.
4. In Node, running the same examples does not throw; UI calls no-op cleanly.
5. `UI.SHOW%` uses VFS + `RENDER$` preprocessing.

---

## V2 Parking Lot (Do NOT implement unless easy)

* Dragging windows, resizing, minimize/maximize
* UI controls library (`UI.BUTTON`, `UI.TEXTBOX`, etc.) as higher-level builders
* Data binding
* More complete event payload (mouse position, etc.)
* Async BASIC handlers / promises

---

### Implementation Notes / Hints (for Junie)

* Use event delegation inside each dialog root: attach one listener per event type per dialog, and dispatch by `event.target.closest(selector)`.
* Maintain a `dialogs` map: `{ id -> { rootEl, listeners[], bindings[] } }`.
* Implement a per-interpreter `runQueue`:
    * If `running`, enqueue event
    * Else set `running = true`, run handler, then drain queue
* Treat handler as SUB first; if not found, try FUNCTION (or detect type if your symbol table supports it).
* Disable all event handlers if the BASIC program is cleared
* Allow the user to reset their in-browser pseudo-file system to default contents in both desktop.html file explorer and in the "Reset Defaults" option in index.html
* Generate default system view files (if any) on first load or if the user directs a reset of the file system.
* Store any newly generated system view files in a pseudo sub folder in the user's default file system
* Remember to treat all physical assets (HTML, CSS, etc) as relative paths, as this project may launched from a different directory than the root of the repo.
