# YoBASIC UI Library

The YoBASIC UI library enables event-driven GUI applications in the browser. It follows a Visual BASIC-style model where DOM events call BASIC `SUB`s or `FUNCTION`s.

## Concept Overview

Traditional BASIC programs often use a polling loop (e.g., `DO ... LOOP` with `INKEY$`). The UI library introduces an **event-driven model**:
1. You show a dialog from an HTML view file.
2. You bind DOM events (like `click` or `submit`) to BASIC handlers.
3. The interpreter stays alive to service these events even after the main program finishes.

## API Reference

All UI functions are available under the `UI` module (e.g., `UI.SHOW%`).

### Capability
* `UI.AVAILABLE%()`  
  Returns `1` in the browser, `0` in Node.js. Use this for cross-platform safety.

### Dialog Lifecycle
* `UI.SHOW%(viewPath$, vars@, options@)` → `dialogId%`  
  Loads an HTML view from VFS, pre-processes it with `RENDER$`, and displays it in a modal window.  
  `vars@` is an optional dictionary for template variables.  
  `options@` is an optional dictionary (e.g., `{"title": "My Dialog"}`).
* `UI.CLOSE%(dialogId%)` → `ok%`  
  Closes the specified dialog and detaches all its event listeners.

### Control Interaction
* `UI.SET_TEXT%(dialogId%, selector$, text$)` → `ok%`
* `UI.GET_TEXT$(dialogId%, selector$)` → `text$`
* `UI.SET_VALUE%(dialogId%, selector$, value$)` → `ok%` (for input/select/textarea)
* `UI.GET_VALUE$(dialogId%, selector$)` → `value$`
* `UI.SET_HTML%(dialogId%, selector$, html$)` → `ok%` (use with caution)
* `UI.FOCUS%(dialogId%, selector$)` → `ok%`

### Event Binding
* `UI.ON%(dialogId%, event$, selector$, handlerName$)` → `ok%`  
  Binds a DOM event to a BASIC `SUB` or `FUNCTION`.  
  `selector$`: CSS selector or `"*"` for the dialog root.  
  `handlerName$`: Name of the BASIC callable.

## The Event Handler `evt@`

When an event fires, your handler is called with a single dictionary argument `evt@`:

| Key | Type | Description |
|-----|------|-------------|
| `DIALOGID%` | Integer | ID of the dialog that fired the event |
| `TYPE$` | String | Event type (e.g., `"click"`) |
| `SELECTOR$` | String | The selector used for binding |
| `TARGETID$` | String | DOM `id` of the element that triggered the event |
| `VALUE$` | String | `.value` of the target (if applicable) |
| `KEY$` | String | Key pressed (for keyboard events) |
| `KEYCODE%` | Integer | Numeric key code |
| `PREVENTDEFAULT%` | Integer | Set to `1` in handler to call `event.preventDefault()` |

## Your First GUI App

### 1. Create a View (`views/hello.html`)
```html
<div style="text-align:center">
  <h2 id="msg">Hello!</h2>
  <button id="btn">Click Me</button>
</div>
```

### 2. Write the BASIC code
```vb
// Show the dialog
dlg% = UI.SHOW%("views/hello.html", {}, {"title": "My First App"})

// Bind the click event
UI.ON%(dlg%, "click", "#btn", "SayHello")

// The handler
SUB SayHello(evt@)
  UI.SET_TEXT%(evt@["DIALOGID%"], "#msg", "YoBASIC Rules!")
END SUB
```

## Browser vs Node behavior

In **Node.js**, the UI module functions act as safe no-ops:
* `AVAILABLE%()` returns `0`.
* `SHOW%()` returns `0`.
* Setters return `0`, Getters return `""`.
* No errors are thrown, allowing the same code to run in both environments.

## Safety and Re-entrancy

YoBASIC implements an **execution queue**. If multiple UI events fire rapidly, or an event fires while the main program is still running, the events are queued and executed sequentially. This prevents the interpreter from entering an invalid state.
