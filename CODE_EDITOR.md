### Short answer
- The easiest, robust, zero‑cost way to add syntax highlighting, line numbers, and a gutter for bookmarks/breakpoints/warnings is to use a free, open‑source code editor component.
- CodeMirror (MIT), Ace (BSD), or Monaco (VS Code’s editor, MIT) are all free and widely used. They embed directly into an existing `<textarea>` (CM/Ace) or into a `<div>` (Monaco) and give you line numbers and customizable gutters out‑of‑the‑box.
- If you truly want no dependency, you can build a lightweight editor by layering a `<pre>` (for highlighted HTML) under a transparent `<textarea>` and adding a custom left gutter. This is doable but more work (scroll syncing, selection mirroring, IME, accessibility, etc.).

Below are two practical paths: a production‑ready CodeMirror setup (recommended) and a simple DIY approach.

---

### Option A (recommended): CodeMirror 5 — free, small, supports gutters
CodeMirror 5 transforms your existing `<textarea>` into a full editor with syntax highlighting, line numbers, and custom gutters for markers. It’s MIT‑licensed (free) and light enough for a browser‑only project.

#### 1) Include CodeMirror (via CDN)
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
<!-- SimpleMode lets us define a BASIC highlighter with regex rules -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/mode/simple.min.js"></script>
<!-- Optional niceties -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/display/fullscreen.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/display/fullscreen.min.js"></script>
```

#### 2) Replace your `<textarea>` with CodeMirror
```html
<textarea id="code" name="code" spellcheck="false"></textarea>
```

```js
// A small set of BASIC keywords; add more from your KEYWORDS.md as needed.
var BASIC_KEYWORDS = [
  "PRINT","INPUT","LET","IF","THEN","ELSE","ELSEIF","END","FOR","TO","STEP","NEXT",
  "WHILE","WEND","DO","LOOP","SELECT","CASE","FUNCTION","SUB","RETURN","DIM",
  "OPEN","CLOSE","LINE","GOTO","GOSUB","ON","ERROR","TRY","CATCH","FINALLY"
];

CodeMirror.defineSimpleMode("yobasic", {
  start: [
    { regex: /'.*$/, token: "comment" },            // ' comment
    { regex: /\bREM\b.*$/i, token: "comment" },    // REM comment
    { regex: /"([^"\\]|\\.)*"?/, token: "string" },
    { regex: /\b(\d+\.\d*|\.\d+|\d+)\b/, token: "number" },
    { regex: new RegExp("\\b(" + BASIC_KEYWORDS.join("|") + ")\\b", "i"), token: "keyword" },
    { regex: /\b(AND|OR|NOT|MOD)\b/i, token: "operator" },
    { regex: /[+\-*/=<>()]/, token: "operator" },
    { regex: /[A-Z][A-Z0-9_]*\$/i, token: "variable-2" }, // string vars like NAME$
    { regex: /[A-Z][A-Z0-9_]*/i, token: "variable" }
  ],
  meta: { lineComment: "'" }
});

var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  mode: "yobasic",
  lineNumbers: true,
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
  matchBrackets: true,
  // Define gutters: built-in line numbers + three custom gutters
  gutters: ["CodeMirror-linenumbers", "breakpoints", "bookmarks", "warnings"],
});

// When running your BASIC, use editor.getValue() instead of textarea.value
function runProgram() {
  const source = editor.getValue();
  // feed source to basic.js interpreter
}
```

#### 3) Add a left gutter for bookmarks/breakpoints/warnings
```css
/* Gutter look */
.CodeMirror-gutters {
  background: #f7f7f7;
  border-right: 1px solid #e0e0e0;
}
/* Make space for our custom gutters */
.CodeMirror-gutter.breakpoints,
.CodeMirror-gutter.bookmarks,
.CodeMirror-gutter.warnings { width: 16px; }

/* Marker icons */
.cm-marker { width: 12px; height: 12px; margin-left: 2px; }
.cm-marker.bp {
  background: #e74c3c;
  border-radius: 50%;
}
.cm-marker.bm {
  background: #3498db;
  border-radius: 50%;
}
.cm-marker.warn {
  width: 0; height: 0; margin-left: 4px;
  border-left: 8px solid #f1c40f; /* triangle */
  border-top: 6px solid transparent; border-bottom: 6px solid transparent;
}
```

```js
function makeMarker(kind, title) {
  var m = document.createElement("div");
  m.className = "cm-marker " + kind;
  if (title) m.title = title;
  return m;
}

// Toggle markers by clicking in the gutter
editor.on("gutterClick", function(cm, lineNumber, gutter, ev) {
  const info = cm.lineInfo(lineNumber);
  if (gutter === "breakpoints") {
    const exists = info.gutterMarkers && info.gutterMarkers.breakpoints;
    cm.setGutterMarker(lineNumber, "breakpoints", exists ? null : makeMarker("bp", "Breakpoint"));
  } else if (gutter === "bookmarks") {
    const exists = info.gutterMarkers && info.gutterMarkers.bookmarks;
    cm.setGutterMarker(lineNumber, "bookmarks", exists ? null : makeMarker("bm", "Bookmark"));
  }
});

// Programmatic warnings (e.g., from a linter or runtime diagnostics)
function setWarning(lineZeroBased, message) {
  editor.setGutterMarker(lineZeroBased, "warnings", makeMarker("warn", message));
}
function clearWarnings() {
  for (let i = 0, n = editor.lineCount(); i < n; i++) {
    editor.setGutterMarker(i, "warnings", null);
  }
}
```

That’s it — you now have highlighting, line numbers, and a left margin with clickable bookmarks/breakpoints and programmatic warnings.

Notes:
- You can persist breakpoints/bookmarks by reading `lineInfo(i).gutterMarkers` and saving line numbers to local storage.
- For more advanced highlighting, expand the `BASIC_KEYWORDS` list and tweak regexes, or port a full BASIC mode.
- If you already read the source from `textarea.value`, switch to `editor.getValue()`. To set text, use `editor.setValue(text)`.


### Option B: Monaco or Ace (also free)
- Monaco Editor (MIT): VS Code’s editor in the browser. Rich APIs, diagnostics, IntelliSense‑like affordances, and a built‑in glyph margin (`glyphMargin: true`) you can click to set breakpoints.
  - Gutter/markers: use `editor.deltaDecorations` with `glyphMarginClassName`.
  - Heavier download than CodeMirror but great if you want future IntelliSense.
- Ace Editor (BSD): Transforms a `<textarea>`, includes line numbers and a gutter. You can define a simple BASIC mode and set gutter markers similar to CodeMirror.

Both are free, no premium license required.


### Option C (no dependency): DIY overlay around `<textarea>`
If you prefer to keep a plain `<textarea>` and avoid any editor library, you can approximate an editor by layering a highlighted `<pre>` behind the textarea, plus a custom gutter. This gives you full control, but you’ll re‑implement scrolling, caret mirroring, IME quirks, and accessibility.

#### Structure
```html
<div class="editor-shell">
  <div class="gutter" id="gutter"></div>
  <pre class="highlight" id="highlight"></pre>
  <textarea class="code" id="code" spellcheck="false"></textarea>
</div>
```

```css
.editor-shell { position: relative; font: 13px/1.4 monospace; }
.gutter { position: absolute; left: 0; top: 0; bottom: 0; width: 40px; background: #f7f7f7; border-right: 1px solid #e0e0e0; overflow: hidden; }
.highlight { position: absolute; left: 40px; right: 0; top: 0; bottom: 0; margin: 0; padding: 8px; white-space: pre; color: #222; pointer-events: none; overflow: hidden; }
.code { position: absolute; left: 40px; right: 0; top: 0; bottom: 0; padding: 8px; border: 0; outline: none; resize: none; background: transparent; color: transparent; caret-color: black; /* text invisible; caret visible */ }
.code, .highlight { font: inherit; line-height: inherit; tab-size: 2; }

/* Sample token styles */
.token.keyword { color: #005cc5; font-weight: 600; }
.token.string  { color: #22863a; }
.token.number  { color: #b31d28; }
.token.comment { color: #6a737d; }

/* Gutter markers */
.gutter .line { height: 1.4em; position: relative; }
.gutter .line .bp { position: absolute; left: 4px; top: 50%; width: 10px; height: 10px; margin-top: -5px; background: #e74c3c; border-radius: 50%; }
.gutter .line .bm { position: absolute; left: 4px; top: 50%; width: 10px; height: 10px; margin-top: -5px; background: #3498db; border-radius: 50%; }
.gutter .line .warn { position: absolute; left: 3px; top: 50%; margin-top: -6px; width: 0; height: 0; border-left: 8px solid #f1c40f; border-top: 6px solid transparent; border-bottom: 6px solid transparent; }
```

```js
const ta = document.getElementById('code');
const hi = document.getElementById('highlight');
const gut = document.getElementById('gutter');

function escapeHtml(s){return s.replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));}

function highlightBasic(src){
  // Very small tokenizer: comments, strings, numbers, keywords
  const kws = /(\b)(PRINT|INPUT|LET|IF|THEN|ELSE|ELSEIF|END|FOR|TO|STEP|NEXT|WHILE|WEND|DO|LOOP|SELECT|CASE|FUNCTION|SUB|RETURN|DIM|OPEN|CLOSE|LINE|GOTO|GOSUB|ON|ERROR|TRY|CATCH|FINALLY)(\b)/gi;
  // Order matters: comments first, then strings, numbers, keywords
  let out = escapeHtml(src)
    .replace(/'.*$/gm, m => `<span class="token comment">${m}</span>`)
    .replace(/\bREM\b.*$/gmi, m => `<span class="token comment">${m}</span>`)
    .replace(/"([^"\\]|\\.)*"?/g, m => `<span class="token string">${m}</span>`)
    .replace(/\b(\d+\.\d*|\.\d+|\d+)\b/g, m => `<span class="token number">${m}</span>`)
    .replace(kws, (m, a, b, c) => `${a}<span class="token keyword">${b}</span>${c}`);
  return out;
}

function render(){
  const src = ta.value;
  hi.innerHTML = highlightBasic(src);
  // Render gutter lines and carry markers stored per line
  const lines = src.split(/\n/).length;
  gut.innerHTML = Array.from({length: lines}, (_, i) => `<div class="line" data-line="${i}"></div>`).join('');
}

function syncScroll(){ hi.scrollTop = ta.scrollTop; hi.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; }

ta.addEventListener('input', render);
ta.addEventListener('scroll', syncScroll);
render();

// Markers API
const markers = { bp: new Set(), bm: new Set(), warn: new Map() }; // warn: line -> msg
function toggleMarker(kind, line){
  if (kind === 'warn') return; // warnings set programmatically
  const set = markers[kind];
  if (set.has(line)) set.delete(line); else set.add(line);
  drawMarkers();
}
function setWarning(line, msg){ markers.warn.set(line, msg); drawMarkers(); }
function clearWarnings(){ markers.warn.clear(); drawMarkers(); }
function drawMarkers(){
  gut.querySelectorAll('.line').forEach(div => {
    const line = +div.dataset.line;
    div.innerHTML = ''
      + (markers.bp.has(line) ? '<span class="bp" title="Breakpoint"></span>' : '')
      + (markers.bm.has(line) ? '<span class="bm" title="Bookmark"></span>' : '')
      + (markers.warn.has(line) ? '<span class="warn" title="'+markers.warn.get(line)+'"></span>' : '');
  });
}

gut.addEventListener('click', (e)=>{
  const lineDiv = e.target.closest('.line');
  if (!lineDiv) return;
  const line = +lineDiv.dataset.line;
  // Example: left third toggles breakpoint, middle third bookmark
  const x = e.offsetX;
  if (x < 12) toggleMarker('bp', line); else toggleMarker('bm', line);
});
```

This DIY approach keeps your `<textarea>` but still gives you highlighting, line numbers (you can add numbers in `.gutter .line:before`), and a left margin for markers. Be prepared to handle edge cases (wrapping vs. non‑wrapping, variable line heights, IME input, mobile keyboards, etc.).

---

### Which should you choose?
- If you want something robust today with minimal code: use CodeMirror 5 (Option A). It’s free, fast, and already supports line numbers and gutters for breakpoints/bookmarks/warnings.
- If you anticipate richer features later (hover tooltips, diagnostics, code actions): Monaco (Option B) is great and still free, albeit heavier.
- If you must avoid dependencies: DIY (Option C) is possible but will take more time to polish.

Either way, you can upgrade your current `<textarea>` to have syntax highlighting, line numbers, and a left gutter for bookmarks/breakpoints/warnings without any premium third‑party tools.