### BASIC Interpreter: Loops and SELECT CASE (Phase 1 & 2)

This document outlines the current status and plan for control flow features in the in-browser BASIC (Basil subset) interpreter.

What shipped so far (implemented):
- WHILE/WEND blocks
  - Nesting supported.
  - Condition is re-evaluated at each WEND.
- SELECT CASE blocks (extended)
  - Supports equality, ranges (CASE a TO b), comparator patterns (CASE IS > x, >=, <, <=, <>, =), and multiple patterns per CASE line via commas.
  - CASE ELSE supported.
  - Nesting supported.
  - When a CASE is matched, execution continues until the next CASE at the same level or END SELECT.
- DO/LOOP family
  - DO ... LOOP (unconditional)
  - DO WHILE expr ... LOOP (pre-test)
  - DO UNTIL expr ... LOOP (pre-test)
  - DO ... LOOP WHILE expr (post-test)
  - DO ... LOOP UNTIL expr (post-test)
- FOR/NEXT loops
  - FOR var = start TO end [STEP step]
  - Numeric validation; STEP cannot be 0. Proper termination based on STEP sign.
  - NEXT may optionally specify the loop variable; mismatch is an error.
- Flow control inside loops
  - BREAK exits nearest loop; CONTINUE jumps to the loop’s re-evaluation point.
  - Validated context; errors when used outside loops.
- Error handling and diagnostics
  - Line-aware error messages for unmatched WEND/END SELECT/LOOP/NEXT and invalid loop usage.

Notes on behavior and limitations:
- DO ... LOOP without a condition is an infinite loop and requires BREAK to exit.
- NEXT with multiple variables (e.g., NEXT I, J) is not supported; only the nearest FOR (and optional single var) is recognized.
- SELECT CASE comparator and range checks prefer numeric comparison when both sides are numeric; otherwise fall back to string comparison.

Examples (manual testing):
- WHILE loop
```
LET I = 0
WHILE I < 3
  PRINTLN "I=#{I}"
  LET I = I + 1
WEND
```
Expected output: lines I=0, I=1, I=2.

- SELECT CASE equality and ELSE
```
LET K = 2
SELECT CASE K
CASE 1
  PRINTLN "one"
CASE 2, 3
  PRINTLN "two-or-three"
CASE ELSE
  PRINTLN "other"
END SELECT
```
Expected output: "two-or-three".

Rationale for design:
- We deliberately avoided introducing a full tokenizer/parser at this step to keep changes minimal and low-risk. The execution loop became index-based to support multi-line control blocks while preserving single-line execution for ordinary statements.

If you have specific programs that should work next, please share them so we can prioritize syntax and semantics accordingly.

### Phase 3 — Major features plan (expectations)

Goal: implement the most impactful remaining Core Language features while keeping the interpreter browser-friendly and largely backward compatible with Phase 1–2.

Scope (Phase 3):
- Functions and subroutines: FUNC/SUB definitions, parameters, RETURN, calls, lexical scoping.
- Labels and jumps: LABEL, GOTO, GOSUB, RETURN (gosub), with validation.
- Error handling: TRY/CATCH/FINALLY and RAISE.
- Classic arrays: DIM fixed-size arrays with 1-based indexing and multi-dim support.
- FOREACH iteration over lists/dictionaries.
- Diagnostics: line/column-aware errors, unmatched block reporting, and better messages overall.
- Parser foundation: a small tokenizer + statement parser sufficient for block forms and the items above.

Non-goals (deferred to later phases):
- Full class/object system, WITH receiver contexts, modules, or external imports.
- OS/environment built-ins (SHELL/SETENV/EXPORTENV/EXIT/STOP), full file I/O (will be handled with VFS later).
- Full standard library parity.

---

#### 1) Parser/tokenizer foundation (minimal but robust)

Behavioral expectations
- Preserve current expression capabilities (incl. string interpolation) while adding reliable detection of statement boundaries, blocks, and labels.
- Support both block styles where applicable per spec: classic BEGIN … END and brace { … } forms (we will accept both but emit in docs/examples BEGIN … END for clarity).
- Maintain compatibility with lineExecute by allowing single-line parsing without requiring a whole-program pass.

Design & implementation notes
- Lexer outputs tokens with type, lexeme, line, col (e.g., IDENT, NUMBER, STRING, KEYWORD, OP, NEWLINE, EOF).
- Parser builds shallow AST for statements only (we can keep current expression rewriter for Phase 3 to minimize risk). Later phases may move expressions to the parser as well.
- Statement nodes needed in Phase 3:
  - FuncDecl/SubDecl: name, params[], body[].
  - Label: name.
  - Goto/Gosub/ReturnStmt (gosub return).
  - TryCatchFinally: tryBody[], catchName? (identifier), catchBody[], finallyBody?.
  - Raise: expression.
  - Dim: declarations[] where each decl is name + bounds[] (one or more dimensions).
  - Foreach: iterVar, keyVar?, inExpr, body[].
  - Existing nodes retained: Print/Println, Let/Assign, If (single-line or block when available), While, Do/Loop, For/Next, SelectCase.
- Transitional execution: runProgram detects whether a program was pre-parsed; if not, it can parse once to an AST and then execute. lineExecute parses just that statement (or a small temp program) and executes on the existing runtime state.

Diagnostics
- Every AST node stores origin (file? use "\<input>"), line and column start. Errors thrown carry this metadata for reporting.
- Parser reports unmatched ENDs with the opener line number (e.g., WEND without WHILE) — complements the current runtime checks.

---

#### 2) Functions and subroutines

Syntax
```
FUNC Add(a, b)
  RETURN a + b
END FUNC

SUB Greet(name$)
  PRINTLN "Hello, #{name$}!"
END SUB

LET x = Add(2, 3)
CALL Greet("Ada")   ' CALL optional; plain Greet("Ada") works too
```

Semantics
- FUNC returns a value via RETURN; SUB may use bare RETURN to exit early (no value).
- Lexical scope: function body sees its own locals and closes over globals if not shadowed. Variables default to local within functions unless explicitly referenced as global (Phase 3: simplest rule — read-only access to globals when no local of same name exists; assignment creates/uses local unless prefixed by GLOBAL in a follow-up phase).
- Recursion supported. Stack frames hold locals, parameters, and a return slot.
- Arity checking: missing arguments default to NULL; extra arguments are ignored (or error if spec demands strict arity — we will choose strict arity with clear error messages for Phase 3).

Implementation
- Store declarations in a function table (case-insensitive). Function calls route through __call to check user-defined first, then built-ins.
- RETURN unwinds to the nearest function/sub frame. Using RETURN outside a function raises a line-aware error.

Edge cases
- Nested function definitions allowed but hoisted at parse time (names must be unique in program/global scope for Phase 3).
- Name collisions with variables: function names live in a distinct namespace from variables.

---

#### 3) Labels, GOTO, GOSUB, RETURN (gosub)

Syntax
```
LABEL Start
PRINTLN "Hello"
GOTO Done
PRINTLN "(skipped)"
LABEL Done
PRINTLN "Bye"

LABEL SubTask
PRINTLN "in sub"
RETURN         ' returns to point after last GOSUB

GOSUB SubTask
PRINTLN "after sub"
```

Semantics
- LABEL declares a jump target in the current unit (program or function). Duplicate labels are an error.
- GOTO jumps to label within the same unit; cannot cross function boundaries.
- GOSUB pushes a return address onto a gosub stack and jumps to label; RETURN pops and jumps back. RETURN without active GOSUB is an error.
- Interactions with loops/try: jumps exit blocks without running FINALLY; this matches classic BASIC but we will warn in docs. TRY/FINALLY semantics are honored only if control leaves via normal flow or exceptions; GOTO/GOSUB do not execute FINALLY blocks they bypass.

Implementation
- During parse, collect label positions per unit. Execution: resolve to instruction indices. Maintain a dedicated gosub return stack separate from function call stack.

---

#### 4) Error handling: TRY/CATCH/FINALLY and RAISE

Syntax
```
TRY
  IF X = 0 THEN RAISE "Zero!"
  PRINTLN 10 / X
CATCH err
  PRINTLN "Error:", err
FINALLY
  PRINTLN "Done"
END TRY
```

Semantics
- TRY executes tryBody; on RAISE or runtime error, transfers to CATCH (if present) binding the error value/message to identifier; FINALLY always runs after TRY or CATCH.
- RAISE accepts any expression; if raising a primitive, it becomes the message string; objects are passed through.
- Nested TRY blocks work; re-raising can be done via RAISE without args (re-throw last) — optional for Phase 3; otherwise, require an explicit value.

Implementation
- Represent TRY as a runtime frame with catch/finally targets. Map JavaScript exceptions from the evaluator to BASIC exceptions carrying line info.

---

#### 5) Classic arrays: DIM (1-based, fixed-size, multi-dim)

Syntax
```
DIM A(10)
DIM M(3, 4)
A(1) = 42
PRINTLN A(1), M(3,4)
```

Semantics
- 1-based indexing for DIM arrays. Bounds are inclusive and fixed at allocation.
- Multi-dimension supported; linearized storage under the hood. Default element initialization: 0 (numeric), empty string "" for string-suffixed names (A$), otherwise NULL — align with spec; if ambiguous, use NULL and document.
- Assignment and retrieval use parentheses: A(i), M(i,j). Our existing bracket-based lists/dicts remain available but are distinct from DIM arrays.
- Out-of-bounds is a runtime error with line info.

Implementation
- Introduce an ArrayRef wrapper type with metadata: dims[], base=1, storage []. Variable table entries for DIM arrays store this wrapper. Indexing in expressions detects name followed by ( ... ) and dispatches to DIM handler.
- Preserve existing JS-list semantics for values built via [ ... ] and indexing with [ ... ].

---

#### 6) FOREACH iteration

Syntax
```
FOREACH item IN myList
  PRINTLN item
NEXT

FOREACH key, value IN myDict
  PRINTLN key, value
NEXT
```

Semantics
- Iterates over arrays/lists (in order) and dictionaries/objects (by key enumeration order). For DIM arrays, traverse 1-based linear order.
- Loop control: BREAK/CONTINUE behave as in other loops. Optional variable names after NEXT allowed but must match the loop variable(s).

Implementation
- Parser outputs a Foreach node with arity (1 or 2 vars). Runtime prepares an iterator snapshot on entry.

---

#### 7) Diagnostics (Phase 3 improvements)

- All thrown errors include: kind (Syntax/Runtime), message, line, column, and, when available, the line text snippet.
- Unmatched ENDs reported at parse time with both opener and closer locations.
- Invalid context usage (e.g., BREAK outside loops, RETURN outside function, NEXT mismatch) gives precise messages.

---

#### 8) Compatibility & migration notes

- lineExecute continues to accept single statements; when fed a block (e.g., a FUNC body), it will parse and define it but not execute until called.
- Expression evaluation remains via the existing rewriter for Phase 3 to minimize regression risk. Parser only handles statement structure and simple label resolution.
- Existing programs from Phase 1–2 continue to run unchanged.

---

#### 9) Testing strategy (Phase 3)

- Unit tests per feature with positive and negative cases (errors include correct line/col).
- Integration tests combining loops + TRY + GOTO to ensure control stack integrity.
- Manual examples mirroring the spec’s canonical snippets.

---

### Beyond Phase 3 — Brief roadmap (selected ideas)

- Virtual File System (VFS) and File I/O built-ins
  - Implement OPEN, CLOSE, INPUT#, LINE INPUT#, PRINT#, WRITE#, EOF, SEEK, GET/PUT on a memory-backed filesystem.
  - Provide per-session persistence via localStorage (optional). Path namespace sandboxing (e.g., vfs:/...).
  - Stream semantics, record modes, text vs binary (binary deferred if not needed immediately).

- Keyboard input enhancements: INKEY$
  - Non-blocking single-character read from a keypress queue captured via DOM events.
  - Optional timeout and CLEAR KEYBOARD buffer command.
  - Works with/without jQuery Terminal; falls back gracefully if no DOM available.

- Event handling and DOM integration
  - ON EVENT model (e.g., ON CLICK "#btn" GOSUB Handler, ON TIMER 1000 GOSUB Tick).
  - Event queue feeds the interpreter’s run loop; handlers execute cooperatively (no preemption). Provide EXIT HANDLER safeguards and re-entrancy protection.
  - Simple DOM query helpers (GETTEXT("#id"), SETTEXT("#id", value)) with safe sandboxing.

- Environment/process stubs
  - SETENV/GETENV as in-memory maps; EXPORTENV for sharing between runs in the same session.
  - EXIT/STOP with clear behavior in the browser context.

- NEXT-level language features
  - SELECT CASE advanced patterns already done; consider adding pattern ranges for strings with collations.
  - WITH receiver blocks and simple objects (NEW/CLASS stubs) for educational object-oriented examples.

- Tooling & UX
  - Step debugger (single-step, breakpoints, WATCH variables).
  - Pretty printer/formatter for BASIC code.
  - Improved STATUS including local scopes and call stack.

Notes on feasibility
- VFS and INKEY$/events introduce asynchrony. To keep the interpreter largely synchronous, we’ll model events as queued tasks processed between statements, and provide explicit WAIT/PAUSE to let the UI catch up when needed. Async APIs will be wrapped into callbacks that enqueue handlers rather than interrupting current execution.
