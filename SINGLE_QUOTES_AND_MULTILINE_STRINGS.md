### Objective
Introduce true single-quoted string literals to YoBASIC in `basic.js` alongside double-quoted strings with these rules:

- Both quote styles are valid and may span multiple physical lines.
- A single-quoted string does NOT support interpolation; a double-quoted string DOES support `#{ ... }` interpolation.
- Unescaped quote pairing: inside single quotes you may freely use `"`; inside double quotes you may freely use `'`.
- Escape handling:
  - Double-quoted: recognize and interpret `\n`, `\t`, `\r`, `\"`, `\#{` (literal `#{`), and `\}` (literal `}`); generic `\x` may remain literal unless you want to support more escapes.
  - Single-quoted: only `\'` is special (becomes a single apostrophe). Any other backslash sequence is literal backslash + char.
- Comments: discontinue `'` as a comment starter; keep only `//` (anywhere on a line) and `REM` (at start/after spaces).

This report outlines the current state, the gaps, and a step-by-step implementation plan with precise change points in `basic.js` and related files.

---

### Current behavior (as of basic.js)
Key locations (line numbers approximate):
- `_stripComments` (~1268–1303): Currently treats `'` as a comment unless it heuristically “looks like a single-quoted string.” It toggles `inS` (single), `inD` (double) per line and stops at `'` when outside strings. This is incompatible with fully adopting `'...'` strings.
- `_splitStatements`, `_splitElse`, `_parseCommaExprList` (~1305–1368): Track single vs double quotes within a single line and respect backslash escapes; they do not support multi-line strings.
- `_rewriteInterpolatedStrings` (~1397–1460): Expands interpolation only inside double-quoted strings. It already ignores `\#{` thanks to escape handling. It passes single-quoted strings through untouched. Works line-local; not multi-line aware.
- `_readString` (~1595–1609): Reads until the matching quote; any `\x` is preserved as two characters. It does not interpret escapes and does not enforce the differing escape policies for `'` vs `"`. It also makes no special provision for newline characters.
- `_rewriteToJs` (~1462+): When encountering a string, it re-serializes it to a JS string literal via:
  - `value.replace(/\\/g,'\\\\').replace(new RegExp(quote,'g'),'\\'+quote)`
  - This escapes backslashes and the delimiting quote, but does not escape actual newline characters. If you embed literal newlines, the generated JavaScript would be invalid.

Related editor tokenization (index.html ~680): a simple regex for `"..."` strings; it doesn’t recognize single-quoted or multi-line strings.

---

### Gaps vs. desired behavior
1. Single quotes are still consumed as comments in many contexts. We must remove `'` as a comment delimiter entirely.
2. Multi-line strings are not supported because the engine splits the program into lines early and string tracking is line-local.
3. Escape semantics are not implemented as required (double-quoted escapes should be interpreted; in single-quoted only `\'` is special).
4. Newline characters inside strings are not escaped when re-emitting JavaScript, risking syntax errors.

---

### Implementation plan
The least disruptive path is to add a small pre-lex step to build logical lines that can contain embedded newlines inside string literals, then adjust the comment stripper and string handling. Keep the existing rewrite-to-JS pipeline.

#### 1) Build logical lines (multi-line string support)
- Today, `run(program)` splits the entire source by `/\r?\n/` and processes per physical line. Replace this with a pre-pass that coalesces physical lines into logical lines by tracking whether you are inside a string (single or double) and whether the string is escaped at the end.

Pseudo-code:
```js
function coalesceLogicalLines(raw) {
  const lines = String(raw).split(/\r?\n/);
  const out = [];
  let buf = '';
  let inStr = false; // false | '"' | '\''
  let interpDepth = 0; // for double-quoted only (#{ ... })
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let j = 0;
    while (j < line.length) {
      const c = line[j];
      if (!inStr) {
        if (c === '"') { inStr = '"'; buf += c; j++; continue; }
        if (c === '\'') { inStr = '\''; buf += c; j++; continue; }
        buf += c; j++; continue;
      } else {
        // inside a string
        buf += c; j++;
        if (c === '\\') { // skip next char literally
          if (j < line.length) { buf += line[j]; j++; }
          continue;
        }
        if (inStr === '"' && c === '#' && line[j] === '{') {
          // track interpolation braces to avoid false close if you later extend grammar
          interpDepth++;
        } else if (inStr === '"' && c === '}' && interpDepth > 0) {
          interpDepth--;
        } else if (c === inStr && interpDepth === 0) {
          inStr = false;
        }
      }
    }
    if (inStr) {
      // add a real newline character to the buffer to represent multi-line string content
      buf += '\n';
      // continue with next physical line
    } else {
      out.push(buf);
      buf = '';
    }
    i++;
  }
  if (buf.trim() !== '') out.push(buf);
  return out;
}
```
- Feed these “logical lines” into the existing line-processing loop. This allows both `"..."` and `'...'` to span multiple physical lines safely.

Notes:
- We record an actual newline character `\n` in the buffer when strings span lines; later, when serializing the string back to JavaScript, we must emit `\n` escape sequences.
- We don’t allow a string to end inside an interpolation expression; only outer `"..."` may close it. The snippet tracks `interpDepth` for completeness.

#### 2) Comments: remove `'` as a comment
- Update `_stripComments(s)` to only recognize:
  - `//` anywhere when not inside a string.
  - `REM` at the beginning or after whitespace, when not inside a string.
- Delete the branch that returns early on `'`. Do not try to treat `'...'` as comment.

Sketch:
```js
_stripComments(s){
  let i = 0, inS = false, inD = false;
  while (i < s.length){
    const c = s[i];
    if (!inS && !inD){
      if (c === '/' && s[i+1] === '/') return s.slice(0, i);
      if ((i === 0 || /^\s+$/.test(s.slice(0,i))) && s.slice(i, i+3).toUpperCase() === 'REM') return s.slice(0, i);
    }
    if (c === '"' && !inS){ inD = !inD; i++; continue; }
    if (c === '\'' && !inD){ inS = !inS; i++; continue; }
    if ((inD || inS) && c === '\\'){ i += 2; continue; }
    i++;
  }
  return s;
}
```
- With this change, `'...'` always means a string. Existing code that relied on `' comment` must change to `// comment` or `REM`.

#### 3) Robust string scanner enforcing quote-specific escapes
Replace `_readString` with a scanner that:
- Distinguishes single vs double quotes.
- Interprets escapes for double-quoted strings into their actual characters (`\n`, `\t`, `\r`, `\"`, and optionally `\\`).
- For single-quoted strings, only `\'` is special; other `\\x` remain two characters.
- Accepts actual newline characters inside both string kinds (because of the coalescing step). Internally keep them as `\n` characters.

Drop-in replacement:
```js
_readString(s, start){
  const quote = s[start]; // '"' or '\''
  let i = start + 1;
  let out = '';
  while (i < s.length){
    const c = s[i];
    if (c === '\\'){
      const n = s[i+1];
      if (typeof n === 'undefined'){ i++; break; }
      if (quote === '"'){
        if (n === 'n'){ out += '\n'; i += 2; continue; }
        if (n === 't'){ out += '\t'; i += 2; continue; }
        if (n === 'r'){ out += '\r'; i += 2; continue; }
        if (n === '"'){ out += '"'; i += 2; continue; }
        if (n === '#') { // allow \\#{ to suppress interpolation marker
          out += '#'; i += 2; continue; }
        if (n === '}') { out += '}'; i += 2; continue; }
        // default: keep literal backslash + char
        out += '\\' + n; i += 2; continue;
      } else { // single-quoted
        if (n === '\''){ out += '\''; i += 2; continue; }
        // default: keep literal backslash + char
        out += '\\' + n; i += 2; continue;
      }
    }
    if (c === quote){ i++; return { value: out, end: i, quote }; }
    out += c; i++;
  }
  // if we reach here without closing, treat as unterminated
  throw new Error('Unterminated string literal');
}
```

Why interpret escapes here?
- It centralizes policy: by the time `_rewriteToJs` re-emits the JS literal, it will receive already-interpreted content (e.g., the newline character). `_rewriteToJs` should then escape these characters for JavaScript source safety.

#### 4) Keep interpolation exclusively for double quotes
- `_rewriteInterpolatedStrings` is already limited to `"..."`. Keep it that way.
- Ensure it uses `_readString` for both kinds. It currently does for `'` but manually reads `"..."`. You can keep the current double-quote reader, but be aware you now interpret escapes earlier in `_readString`. Two options:
  - Option A: Reuse `_readString` also for double quotes inside `_rewriteInterpolatedStrings` and then manually search for `#{` inside the raw segment; however, because we interpret `\#{` as `#{` literal above, you need a pre-pass that preserves a sentinel for escaped sequences.
  - Option B (simpler, keep current approach): Leave the existing double-quote reading loop in `_rewriteInterpolatedStrings` (it already skips `\\` and stops on `"`), but when it appends `buf` pieces as string literals, let `_rewriteToJs` perform the correct JavaScript escaping. This keeps semantics intact because `\#{` will never trigger interpolation.

Given the current code, Option B is the least invasive: do not switch `_rewriteInterpolatedStrings` to `_readString`; only ensure `_rewriteToJs` escapes newlines correctly (next step).

#### 5) Ensure JavaScript emission escapes newlines and control characters
Enhance the string branch in `_rewriteToJs` so that any actual newline (`\n`), carriage return (`\r`), and other JS-line-breakers are emitted as escape sequences, and backslashes/quotes are escaped appropriately.

Replace the string emission with:
```js
if (c === '"' || c === '\''){
  const { value, end, quote } = this._readString(s, i);
  // Escape for JS source
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028|\u2029/g, m => m === '\u2028' ? '\\u2028' : '\\u2029')
    .replace(new RegExp(quote, 'g'), '\\' + quote);
  out += quote + escaped + quote;
  i = end;
  continue;
}
```
- This guarantees generated JavaScript remains valid even when BASIC strings contain actual newline characters.

#### 6) Keep other scanners in sync
- `_splitStatements`, `_splitElse`, `_parseCommaExprList` already toggle `inS/inD` and skip escapes. Because we now input logical lines that might contain embedded `\n`, these functions keep working without change. They should not be line-break aware; they operate on one logical line at a time.

#### 7) Error handling
- If the pre-pass reaches EOF while `inStr` is still set, raise a clear syntax error: `Unterminated string literal` and include the starting line number context if possible.
- In `_rewriteInterpolatedStrings`, keep the existing `Unterminated string literal` throw when a `"` isn’t closed on the logical line.

---

### Editor and tooling updates
- Update the inline highlighter regex in `index.html` (if still used) to recognize both quotes and allow multiline in CodeMirror mode. Example replacement for the naive inline mode token list:
```js
{ regex: /"([^"\\]|\\.)*"|\'([^'\\]|\\.)*\'/, token: 'string' }
```
- For true multi-line string highlighting, rely on CodeMirror language support with a custom mode; the simple regex token list won’t handle multi-line properly. Given you already have a custom theme (`.cm-s-yobasic`), consider a small custom mode or switch to a close built-in with tweaks.

---

### Backward compatibility and migration
- Breaking change: `'` no longer starts a comment. Provide a migration note and a simple search-and-replace tip: replace leading or whitespace-prefixed `'` comments with `//`.
- Existing double-quoted strings keep interpolation; single-quoted ones that previously were sometimes parsed as comments will now be treated as literals—this is intended and consistent with the new rules.
- Escape semantics become stricter and more predictable. Strings that relied on literal `\n` (backslash + n) remaining two characters will continue to do so in single-quoted strings; in double-quoted strings, `\n` will now turn into a newline character once you implement the `_readString` logic. Document this in the changelog.

---

### Test plan
Create focused tests that exercise scanning, rewriting, and evaluation:

- Basic acceptance:
```basic
PRINT "A\nB"        ' prints A then B on next line
PRINT 'He said "Hi"'  ' prints He said "Hi"
PRINT "It's fine"   ' prints It's fine
```

- Single-quoted rules:
```basic
PRINT 'a\nb'        ' prints a\nb (backslash-n literal)
PRINT 'It\'s ok'    ' prints It's ok
PRINT 'brace #{ not interp }'   ' prints brace #{ not interp }
```

- Double-quoted interpolation and escapes:
```basic
DIM name = "World"
PRINT "Hello #{name}!"   ' Hello World!
PRINT "Brace: \} and hash: \#{"  ' prints: Brace: } and hash: #{
```

- Multi-line strings:
```basic
PRINT "line1\n" +
      "line2"  ' explicit concatenation

PRINT "first line
second line
third line"    ' direct multi-line

PRINT 'alpha
beta
\'gamma\''     ' direct multi-line with escaped apostrophe
```

- Comments retain only `//` and `REM`:
```basic
REM this is fine
PRINT 1 // and this too
```

- Edge cases:
```basic
PRINT "nest #{1+2} ok"           ' 3
PRINT "#{ PRINT \"x\" }"      ' the inner string is part of JS expr; scanning remains balanced
```

Ensure failing cases produce clear errors:
- Unterminated `'...'` or `"...` across EOF.
- `"#{ ...` with unbalanced braces.

---

### Rollout order and risk
1) Implement logical line coalescing and comment rule change (no runtime behavior change yet, aside from dropping `'` comments).
2) Replace `_readString` and strengthen `_rewriteToJs` string escaping.
3) Verify that all expression rewriting paths still produce valid JavaScript with embedded `\n` escaped.
4) Update editor tokenization if needed.

Risks and mitigations:
- Risk: Existing programs using `'` as comments break. Mitigate with a migration helper or a codemod suggestion.
- Risk: Unexpected places with string scanning assumptions. Mitigate with comprehensive tests, especially around `IF ... THEN ... ELSE` one-liners and lists of expressions split by commas/colons.

---

### Summary
By introducing a small pre-lex step to assemble logical lines, removing `'` as a comment, enforcing quote-specific escape semantics in `_readString`, keeping interpolation exclusive to double quotes, and correctly escaping line breaks when emitting JavaScript, YoBASIC will support robust single- and double-quoted strings, including multi-line literals, with precise and predictable behavior aligned with your spec and the new requirements.