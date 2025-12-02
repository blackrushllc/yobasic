### Overview
Here’s a concrete, drop‑in plan to:
- Upgrade all multi‑tab `<textarea>` editors to CodeMirror 5 with line numbers and custom gutters.
- Pull the keyword list directly from your `basic.js` interpreter so highlighting stays in sync.
- Add a fast “Syntax Preview” that surfaces syntax errors as gutter markers and tooltips. You can run it live (debounced) or only on Run (F9 / button) if performance becomes a concern.

I’ll show a recommended, minimal set of changes (safe for a single‑file static project) and alternatives where relevant.

---

### 1) Include CodeMirror 5 and useful add‑ons
Add these tags to your `index.html` `<head>` before your own scripts. We’ll use SimpleMode for a BASIC highlighter and the Lint add‑on to show errors in the gutter with tooltips.

```html
<!-- Core CodeMirror -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>

<!-- Addons: SimpleMode (for quick custom syntax) + Lint (for gutter tooltips) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/mode/simple.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/lint/lint.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/lint/lint.min.js"></script>
```

Optional but nice:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/eclipse.min.css">
```

---

### 2) Expose keywords from basic.js (single source of truth)
Add a public API to `basic.js` that returns the full list of keywords the interpreter actually recognizes. If you already have a tokenizer table or reserved‑word map, return from that. If not, centralize the keyword groups once and derive all lists from there.

Example (safe for a global UMD‑style export):
```js
// Inside basic.js
(function (root) {
  const YoBasic = root.YoBasic || (root.YoBasic = {});

  // If you already have these in your tokenizer, reuse that structure instead.
  const KEYWORDS = Object.freeze({
    statements: [
      "PRINT","INPUT","LET","IF","THEN","ELSE","ELSEIF","END","FOR","TO","STEP","NEXT",
      "WHILE","WEND","DO","LOOP","SELECT","CASE","FUNCTION","SUB","RETURN","DIM",
      "OPEN","CLOSE","LINE","GOTO","GOSUB","ON","ERROR","TRY","CATCH","FINALLY"
    ],
    operators: ["AND","OR","NOT","MOD"],
    // Include intrinsic functions as keywords if you want them highlighted
    functions: [
      "LEN","LEFT$","RIGHT$","MID$","INSTR","STR$","VAL","RND","SQR","SIN","COS","TAN",
      // ... add all built‑ins your interpreter implements
    ]
  });

  function getKeywords(options) {
    const opt = Object.assign({ statements: true, operators: true, functions: true }, options);
    const buckets = [];
    if (opt.statements) buckets.push(KEYWORDS.statements);
    if (opt.operators)  buckets.push(KEYWORDS.operators);
    if (opt.functions)  buckets.push(KEYWORDS.functions);
    const flat = [].concat.apply([], buckets);
    // Ensure unique, uppercased; your editor mode will be case‑insensitive anyway
    return Array.from(new Set(flat.map(s => String(s))));
  }

  YoBasic.getKeywords = getKeywords;

  // Optional: expose a syntax check without running the program
  YoBasic.checkSyntax = function checkSyntax(source) {
    try {
      // If your interpreter has a parser entry point, call it here:
      // parseOnly(source) should NOT execute; it should only build an AST or validate grammar.
      // Replace the next line with your real parser call.
      if (typeof parseOnly === 'function') parseOnly(source);  
      else if (typeof YoBasic.parseOnly === 'function') YoBasic.parseOnly(source);
      else {
        // Fallback: try a lightweight tokenization/structural check if no parser API exists yet
        // (You can replace this with your actual implementation later.)
      }
      return { ok: true, errors: [] };
    } catch (e) {
      // Normalize error shape. Prefer e.line/e.col if your parser throws those.
      const line = (e.line != null ? e.line : e.lineNumber) || 1;
      const col  = (e.col  != null ? e.col  : e.column)     || 1;
      const endLine = e.endLine || line;
      const endCol  = e.endCol  || (col + 1);
      return {
        ok: false,
        errors: [{
          message: e.message || 'Syntax error',
          line: Math.max(0, line - 1),
          column: Math.max(0, col - 1),
          endLine: Math.max(0, endLine - 1),
          endColumn: Math.max(0, endCol - 1)
        }]
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

Notes:
- If your real tokenizer/grammar already owns the keyword sets, export them instead of duplicating `KEYWORDS`.
- The key is: the editor will call `YoBasic.getKeywords()` to build the highlighter regex, so it stays current as the interpreter evolves.

---

### 3) Define a BASIC mode for CodeMirror using the live keywords
Do this in `index.html` after loading `basic.js` and CodeMirror, before creating editors.

```html
<script>
  (function(){
    // Pull the latest keywords from the interpreter
    var BASIC_KEYWORDS = (window.YoBasic && YoBasic.getKeywords) ? YoBasic.getKeywords() : [
      // fallback minimal set; rarely used because YoBasic.getKeywords should exist
      'PRINT','INPUT','LET','IF','THEN','ELSE','END','FOR','TO','STEP','NEXT','WHILE','WEND','DO','LOOP'
    ];

    CodeMirror.defineSimpleMode('yobasic', {
      start: [
        { regex: /'.*$/i, token: 'comment' },
        { regex: /\bREM\b.*$/i, token: 'comment' },
        { regex: /"([^"\\]|\\.)*"?/, token: 'string' },
        { regex: /\b(\d+\.\d*|\.\d+|\d+)\b/, token: 'number' },
        { regex: new RegExp("\\b(" + BASIC_KEYWORDS.join("|") + ")\\b", "i"), token: 'keyword' },
        { regex: /\b(AND|OR|NOT|MOD)\b/i, token: 'operator' },
        { regex: /[+\-*/=<>()]/, token: 'operator' },
        { regex: /[A-Z][A-Z0-9_]*\$/i, token: 'variable-2' },
        { regex: /[A-Z][A-Z0-9_]*/i, token: 'variable' }
      ],
      meta: { lineComment: "'" }
    });
  })();
</script>
```

---

### 4) Create one shared CodeMirror instance and a `Doc` per tab (best UX)
This pattern preserves per‑tab undo history, selections, markers, and lints, while keeping only one visible editor DOM. Use `CodeMirror.Doc` for each tab and swap with `editor.swapDoc(doc)` on tab changes.

```html
<style>
  /* Gutters (line numbers + custom markers) */
  .CodeMirror-gutters { background:#f7f7f7; border-right:1px solid #e0e0e0; }
  .CodeMirror-gutter.breakpoints, .CodeMirror-gutter.bookmarks { width:16px; }
  .cm-marker { width:12px; height:12px; margin-left:2px; }
  .cm-marker.bp { background:#e74c3c; border-radius:50%; }
  .cm-marker.bm { background:#3498db; border-radius:50%; }
</style>

<div id="editorHost"></div>
```

```html
<script>
  // A single visual editor mounted once
  var editor = CodeMirror(document.getElementById('editorHost'), {
    mode: 'yobasic',
    theme: 'eclipse',
    lineNumbers: true,
    lineWrapping: true,
    matchBrackets: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-lint-markers', 'breakpoints', 'bookmarks'],
    lint: { getAnnotations: basicLint, async: false, delay: 750 } // defined below
  });

  // Keep one Doc per tab/file
  var docsByTabId = Object.create(null);

  function ensureDoc(tabId, initialText) {
    if (!docsByTabId[tabId]) {
      docsByTabId[tabId] = new CodeMirror.Doc(initialText || '', 'yobasic');
    }
    return docsByTabId[tabId];
  }

  function switchToTab(tabId) {
    var doc = ensureDoc(tabId, getTextareaTextForTab(tabId)); // only used first time
    editor.swapDoc(doc);
    editor.focus();
  }

  // If you currently have a <textarea> per tab, hide them and use their text only once
  function getTextareaTextForTab(tabId) {
    var ta = document.querySelector('textarea[data-tab-id="' + tabId + '"]');
    return ta ? ta.value : '';
  }

  // Optional: click to toggle breakpoint/bookmark markers
  function makeMarker(kind, title) {
    var m = document.createElement('div');
    m.className = 'cm-marker ' + kind;
    if (title) m.title = title;
    return m;
  }

  editor.on('gutterClick', function(cm, line, gutter) {
    var info = cm.getDoc().lineInfo(line);
    if (gutter === 'breakpoints') {
      var exists = info.gutterMarkers && info.gutterMarkers.breakpoints;
      cm.setGutterMarker(line, 'breakpoints', exists ? null : makeMarker('bp', 'Breakpoint'));
    } else if (gutter === 'bookmarks') {
      var exists2 = info.gutterMarkers && info.gutterMarkers.bookmarks;
      cm.setGutterMarker(line, 'bookmarks', exists2 ? null : makeMarker('bm', 'Bookmark'));
    }
  });
</script>
```

If you prefer to keep one CodeMirror per tab (simpler wiring but more DOM), you can transform each `<textarea>` with `CodeMirror.fromTextArea(...)` and store the instances in a map keyed by tab id. The `Doc` approach above is more memory‑friendly and keeps the Editor UI consistent.

---

### 5) “Syntax Preview” as a CodeMirror Lint source (recommended)
Hook your interpreter’s syntax checker into CodeMirror’s Lint addon. This gives you: gutter icons, tooltips, and in‑text underlines for free.

```html
<script>
  function basicLint(text, options, cm) {
    if (!window.YoBasic || !YoBasic.checkSyntax) return [];
    var res = YoBasic.checkSyntax(text);
    if (res.ok) return [];

    return res.errors.map(function (e) {
      var from = CodeMirror.Pos(e.line, e.column);
      var to   = CodeMirror.Pos(e.endLine != null ? e.endLine : e.line,
                                e.endColumn != null ? e.endColumn : e.column + 1);
      return { from: from, to: to, message: e.message || 'Syntax error', severity: 'error' };
    });
  }

  // Live linting control: set delay higher or toggle entirely
  function enableLiveSyntaxPreview(enabled) {
    editor.setOption('lint', enabled ? { getAnnotations: basicLint, async: false, delay: 750 } : false);
  }
</script>
```

- Live linting: leave `lint` enabled with a `delay` of ~750ms to avoid running on every keystroke.
- If live preview is still too heavy, disable live linting and call a pre‑run check (next section).

---

### 6) Pre‑Run syntax check (F9 / Run button)
Regardless of live linting, run a syntax check before executing. If errors exist, focus the first one, add a gutter marker, and stop.

```html
<script>
  function showSyntaxErrorsInGutter(errors) {
    var doc = editor.getDoc();
    for (var i = 0; i < doc.lineCount(); i++) {
      editor.setGutterMarker(i, 'CodeMirror-lint-markers', null); // clear prior markers
    }
    errors.forEach(function (e) {
      var line = e.line;
      var marker = document.createElement('div');
      marker.className = 'CodeMirror-lint-marker-error';
      marker.title = e.message;
      editor.setGutterMarker(line, 'CodeMirror-lint-markers', marker);
    });
  }

  function preRunSyntaxCheck() {
    if (!YoBasic || !YoBasic.checkSyntax) return true; // no checker available
    var src = editor.getValue();
    var res = YoBasic.checkSyntax(src);
    if (res.ok) return true;

    showSyntaxErrorsInGutter(res.errors);
    if (res.errors.length) {
      var e = res.errors[0];
      editor.focus();
      editor.setCursor({ line: e.line, ch: e.column });
      // Optional: friendly message
      alert('Syntax error at line ' + (e.line + 1) + ', col ' + (e.column + 1) + '\n' + e.message);
    }
    return false;
  }

  // Hook up keyboard (F9) and Run button
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'F9') { ev.preventDefault(); clickRun(); }
  });

  function clickRun() {
    if (!preRunSyntaxCheck()) return; // stop on syntax errors
    // existing run logic...
    // const source = editor.getValue();
    // basic.js execution call here
  }
</script>
```

This pattern keeps CPU usage low while still preventing an attempted run when the program won’t parse.

---

### 7) Applying CodeMirror to all tabs in your current IDE
Depending on your existing tab system:

- If you already render a `<textarea data-tab-id="...">` per tab:
  - Hide those textareas with CSS (they become data sources only once).
  - Create one CodeMirror instance in a fixed `<div>` and a `CodeMirror.Doc` per tab.
  - On tab switch, `editor.swapDoc(docsByTabId[tabId])`.
  - On save, read `editor.getValue()` from the active doc.

- If tabs are created dynamically (new files):
  - Call `ensureDoc(newTabId, initialText)` when creating the tab.

- If you must keep a separate editor per tab (less recommended):
  - Replace each textarea with `CodeMirror.fromTextArea`.
  - Store instances in `editorsByTabId` and call `editorsByTabId[tabId].refresh()` on tab activation.

---

### 8) Performance notes and options
- Debounce live preview via `lint.delay`. Start around 750–1000ms and tune.
- If parsing is still heavy, consider:
  - Syntax check only on Run (disable live lint).
  - Limit live preview to changed lines only (advanced: incremental parse or tokenization window).
  - Offload `YoBasic.checkSyntax` to a Web Worker for large files. The lint addon supports async results; return a Promise from `getAnnotations` and postMessage to a worker. This can be added later without changing the UI.

---

### 9) Minimal CSS for gutters and editor sizing
```css
/* Ensure the editor fills its pane */
#editorHost { position: relative; height: 100%; }
.CodeMirror { height: 100%; }
/* Gutter styles are inlined earlier; add more theme tweaks if desired */
```

---

### 10) What I think and recommended rollout plan
- The CodeMirror 5 + Lint route is reliable, lightweight, and zero‑cost. You’ll get line numbers, a left gutter, tooltips, and a quick custom BASIC highlighter with very little code.
- Having `YoBasic.getKeywords()` makes the editor resilient to interpreter changes — no more drifting keyword lists.
- A `YoBasic.checkSyntax()` entry point is the right abstraction. It lets you plug in your real parser later while keeping the editor integration stable today.

Recommended steps:
1) Add `YoBasic.getKeywords()` and `YoBasic.checkSyntax()` to `basic.js` (as shown or wired to your real tokenizer/parser).
2) Add CodeMirror + SimpleMode + Lint to `index.html` and define the `yobasic` mode from the live keyword list.
3) Convert your multi‑tab editors to the single‑editor/multi‑Doc pattern; wire tab switching to `swapDoc`.
4) Enable lint with a conservative delay (750–1000ms). Verify performance on typical programs.
5) Add the pre‑run syntax check gate; block execution and focus the first error.
6) Polish: breakpoint/bookmark gutters, persistence of markers per tab (optional), theme tweaks.

If you want, I can tailor the code to your exact tab HTML structure (IDs/classes) and the interpreter’s real parser/tokenizer APIs — just share the relevant snippets for those parts.