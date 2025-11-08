# YoBASIC — Phase 3 Implementation Summary and Examples

Date: 2025-11-08

This document summarizes the Phase 3 features implemented in the in‑browser BASIC interpreter (YoBASIC) and provides small runnable examples you can paste into the REPL at yore/web/basic/index.html.

The plan this work follows is “Phase 3 — Major features plan” in LOOPS-SELECTCASE-PLAN.md.

---

## What’s new in Phase 3

- Lightweight parser/runtime scaffolding
  - Program prepass that discovers top‑level FUNC/SUB declarations and LABEL definitions.
  - Execution remains line‑based; blocks (TRY/WHILE/DO/FOR/FOREACH/SELECT) are handled with control stacks and targeted scanners.

- Functions and subroutines
  - FUNC and SUB definitions with parameters and local lexical scope.
  - Strict arity checking on calls; clear errors on mismatch.
  - RETURN inside FUNC returns a value; inside SUB it exits early (no value).
  - CALL SubName(args) statement supported; direct invocation by name also supported.

- Labels and jumps
  - LABEL declarations at program scope and inside function bodies.
  - GOTO, GOSUB, and RETURN (gosub) with validation. Labels are unit‑scoped; you cannot jump across function boundaries.

- Error handling
  - TRY/CATCH/FINALLY blocks and RAISE to throw errors.
  - FINALLY always runs when control leaves TRY/CATCH normally or due to errors. (Note: GOTO/GOSUB jumps can bypass FINALLY; see notes.)

- Classic arrays (DIM)
  - DIM A(10), M(3,4) with 1‑based, fixed‑size indexing and multi‑dimension support.
  - String arrays via name suffix $, e.g., A$(), auto‑coerced to string values.

- FOREACH
  - FOREACH item IN list and FOREACH key, value IN dict; NEXT ends the loop.
  - Supports DIM arrays (linear 1‑based traversal), JS arrays, and plain objects. BREAK and CONTINUE work inside.

- Diagnostics and behavior
  - Clearer line‑aware error messages for unmatched/end blocks and invalid context usage.
  - Built‑ins available: EOF(#n), LEN(x), INT(x), STR(x).

---

## Quick syntax reference

- FUNC name(p1, p2, ...)
  - Body; end with END FUNC. Call with LET x = name(a, b).
- SUB name(p1, ...)
  - Body; end with END SUB. Call with CALL name(args) or just name(args).
- LABEL Name  |  GOTO Name  |  GOSUB Name  |  RETURN (gosub)
- TRY ... CATCH errVar ... FINALLY ... END TRY  |  RAISE expr
- DIM A(10)  |  DIM M(3,4)  |  A(i,j) = val  |  LET x = A(i,j)
- FOREACH v IN expr ... NEXT  |  FOREACH k, v IN dict ... NEXT

Notes
- Names are case‑insensitive. String variables end in $, integer variables end in %.
- Array indices for DIM arrays are 1‑based and bounds are fixed at allocation.
- Strict arity: calls must pass exactly the number of parameters the function/sub expects.

---

## Examples

Paste each block into the REPL (index.html) or add to a program and run.

### 1) Functions and Subs

Basic add function and a greeting subroutine:

```
FUNC Add(a, b)
  RETURN a + b
END FUNC

SUB Greet(name$)
  PRINTLN "Hello, #{name$}!"
END SUB

LET x = Add(2, 3)
PRINTLN "x = #{x}"           ' prints: x = 5
CALL Greet("Ada")             ' prints: Hello, Ada!
```

Recursion example (factorial):

```
FUNC Fact(n)
  IF n <= 1 THEN RETURN 1
  RETURN n * Fact(n - 1)
END FUNC

PRINTLN Fact(5)               ' prints: 120
```

Locals vs globals (locals take precedence inside functions):

```
LET A = 10
FUNC Show()
  LET A = 99   ' local A
  RETURN A
END FUNC

PRINTLN A                      ' 10 (global)
PRINTLN Show()                 ' 99 (local)
PRINTLN A                      ' 10 (still global)
```

### 2) Labels, GOTO, GOSUB, RETURN (gosub)

Simple branch with labels:

```
LABEL Start
PRINTLN "Hello"
GOTO Done
PRINTLN "(skipped)"
LABEL Done
PRINTLN "Bye"
```

Subroutine with GOSUB and RETURN:

```
PRINTLN "Before"
GOSUB Work
PRINTLN "After"
END


LABEL Work
PRINTLN "In sub"
RETURN
```

Notes
- Labels are local to the current unit (program or function body). You cannot GOTO/GOSUB across a function boundary.
- RETURN with no active GOSUB raises an error.

### 3) TRY/CATCH/FINALLY and RAISE

```
LET X = 0
TRY
  IF X = 0 THEN RAISE "Zero!"
  PRINTLN 10 / X
CATCH err$
  PRINTLN "Error:", err$
FINALLY
  PRINTLN "Done"
END TRY
```

You’ll see:
- Error: Zero!
- Done

### 4) DIM arrays (1‑based, fixed size, multi‑dim)

```
DIM A(5)
A(1) = 42
A(5) = 7
PRINTLN A(1), A(5)             ' 42    7

DIM M(3, 4)
M(1,1) = 100
M(3,4) = 200
PRINTLN M(1,1), M(3,4)         ' 100   200
```

String arrays use $ suffix and store strings:

```
DIM NAMES$(3)
NAMES$(1) = "Ada"
NAMES$(2) = "Grace"
NAMES$(3) = 12345   ' coerced to "12345"
PRINTLN NAMES$(1), NAMES$(2), NAMES$(3)
```

Out‑of‑bounds indices cause a runtime error with line info.

### 5) FOREACH iteration

Over a list (JS array literal):

```
FOREACH item IN [1, 2, 3]
  PRINT item
NEXT
```

Over a dictionary (object literal):

```
FOREACH k, v IN {"a": 1, "b": 2}
  PRINTLN k, v
NEXT
```

Over a DIM array (linear 1‑based):

```
DIM A(3)
A(1) = 10: A(2) = 20: A(3) = 30

' var2 receives the 1-based linear position for DIM arrays
FOREACH val, pos IN A
  PRINTLN pos, val
NEXT
```

With BREAK/CONTINUE:

```
FOREACH n IN [1,2,3,4,5]
  IF n = 3 THEN CONTINUE
  IF n = 5 THEN BREAK
  PRINT n
NEXT
```

---

## Built‑ins and useful notes

- EOF(#n): true when input file handle #n has reached end-of-file.
- LEN(x): string length of x.
- INT(x): integer part of x.
- STR(x): string form of x.

Example:

```
PRINTLN LEN("hello")        ' 5
PRINTLN INT(3.9)            ' 3
PRINTLN STR(123) + "!"      ' 123!
```

---

## REPL and program tips

- The REPL buffers multi‑line blocks for WHILE/WEND, DO/LOOP, FOR/NEXT, SELECT CASE/END SELECT, FUNC/SUB, TRY/END TRY, and FOREACH/NEXT.
- You can separate multiple statements on a line with : or ;
- In a program, function bodies and labels are discovered during a prepass; ensure each FUNC/SUB is properly closed with END FUNC/END SUB and labels are unique per unit.

---

## Important behaviors and constraints

- Strict arity: passing too many or too few arguments is an error with a clear message.
- RETURN inside a function/sub exits that function/sub. RETURN outside a function acts as the GOSUB return (requires a pending GOSUB).
- Labels, GOTO, and GOSUB are scoped to the current unit. You cannot jump into or out of a function body from the main program.
- TRY/FINALLY: FINALLY runs on normal/exceptional exits, but low‑level jumps like GOTO/GOSUB can bypass FINALLY blocks they skip (classic BASIC behavior).
- DIM arrays are 1‑based and fixed‑size. Use [ ... ] arrays and { ... } objects for dynamic JS‑style collections.

---

## Where to look in the code

- Interpreter source: yore/web/basic/basic.js
- Phase plan: yore/web/basic/LOOPS-SELECTCASE-PLAN.md
- Virtual file system and examples: yore/web/basic/vfs.js

If you want these examples as built‑in sample programs, we can add them to vfs.js (examples/PHASE3_*.BAS) in a follow‑up.
