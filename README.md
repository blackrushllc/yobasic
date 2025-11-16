# YoBASIC — BASIC interpreter (basic.js) and in‑browser IDE

YoBASIC is a modern, browser‑friendly implementation of the BASIC programming language plus a lightweight IDE you can open locally in your browser. It’s designed for learning, tinkering, and building cool things quickly — all powered by a single JavaScript file, basic.js, and a clean HTML IDE.

- Project site and docs: https://basilbasic.com
- Live demo (run BASIC in your browser): https://yobasic.com/basic


What’s in this repo
-------------------
- basic.js — a full BASIC interpreter implemented in JavaScript
- index.html — the YoBASIC IDE (a simple but capable development environment)
- supabaseClient.js + provider-*.js — optional cloud persistence (SupaBase)
- vfs.js — a virtual file system used by the IDE and interpreter
- KEYWORDS.md, Basic-Core-Language-Spec.md — language references and notes


About the IDE (index.html)
--------------------------
The included YoBASIC IDE is a compact, fun development environment that showcases what you can do with basic.js. It features:
- A code editor for BASIC with examples and quick run/stop controls
- Local storage for your programs and projects
- Optional cloud sync using SupaBase for shared programs and collaboration
- A virtual file system for saving/loading files from BASIC code

It doubles as a teaching tool and a starter kit for embedding the BASIC interpreter in your own sites or apps.


About basic.js
--------------
basic.js is a full implementation of standard BASIC with a flexible, forgiving syntax that grows with you. Whether you want to learn programming fundamentals, prepare for modern languages, or just make cool things in BASIC, basic.js keeps the friction low and the fun high.

Highlights:
- Case‑insensitive, classic BASIC feel with modern conveniences
- Variables, strings, arrays, user functions (FUNCTION/SUB), and error handling (TRY/CATCH/FINALLY)
- Control flow with IF/ELSEIF/ELSE, SELECT CASE, and structured blocks
- File I/O via a virtual file system (OPEN/CLOSE, INPUT/PRINT to handles)
- Rich set of built‑ins (LEN, MID$, INSTR, RND, SQR, SIN, COS, etc.)
- Extensible host environment — call into JS providers for storage and more

Tip: See KEYWORDS.md for the recognized statements and functions.


Quick examples (run these in the IDE)
-------------------------------------

1) Hello, world
```
PRINT "Hello, world!"
```

2) Strings and functions
```
FUNCTION GREET$(NAME$)
  GREET$ = "Hello, " + NAME$ + "!"
END FUNCTION

PRINT GREET$("Ada")
```

3) Arrays (no loop needed)
```
DIM NUMS(5)
LET NUMS(0) = 0
LET NUMS(1) = 1
LET NUMS(2) = 4
PRINT "First three squares: " + STR(NUMS(0)) + ", " + STR(NUMS(1)) + ", " + STR(NUMS(2))
```

4) SELECT CASE
```
LET X = 3
SELECT CASE X
  CASE 1
    PRINT "one"
  CASE 2, 3
    PRINT "two or three"
  CASE ELSE
    PRINT "something else"
END SELECT
```

5) Strings and searching
```
LET S$ = "BASIC with basic.js"
PRINT LEFT$(S$, 5)
PRINT RIGHT$(S$, 3)
PRINT MID$(S$, INSTR(S$, "with") + 5, 8)
```

6) Error handling
```
TRY
  PRINT 10 / 0
CATCH ERR
  PRINT "Oops: " + ERR
FINALLY
  PRINT "Done."
END TRY
```

7) File I/O with the virtual file system
```
OPEN "hello.txt" FOR OUTPUT AS #1
PRINT #1, "Hello file!"
CLOSE #1

OPEN "hello.txt" FOR INPUT AS #2
LINE INPUT #2, A$
PRINT A$
CLOSE #2
```


YoBASIC.com and the Basil path
------------------------------
YoBASIC.com is a learning tool and a friendly sandbox for BASIC in the browser. It’s also a stepping stone to Basil — a more advanced BASIC‑inspired language that runs on Windows, Linux, and macOS — and offers a sandbox for writing Basil code in a browser environment.

If you’re curious about where YoBASIC can take you next, visit the Basil site for language guides and concepts:
- https://basilbasic.com

Developers: Basil source code is open on GitHub — contributions welcome!
- https://github.com/blackrushllc/basil


Run locally
-----------
This project is static. Clone the repo and open index.html in your browser.

Optional: to enable cloud sync via SupaBase, set your credentials as described in SUPABASE.md and use the provider files included in this repo.


Contributing
------------
- Try the live demo at https://yobasic.com/basic
- Share feedback, file issues, and send pull requests
- Explore the Basil source at https://github.com/blackrushllc/basil and join the community effort


License
-------
See LICENSE for details.

This is a BASIC interpeter and simple IDE.  The BASIC interpreter is in basic.js and the IDE is index.html.

This project is a BASIC interpreter with a simple code editor and file management which uses local storage and a simple SupaBase database to store shared programs and projects.  You built this and it's very nice!
Feel free to use and modify it as you see fit.