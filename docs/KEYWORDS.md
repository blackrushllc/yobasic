# KEYWORDS for the YoBasic JavaScript Interpreter

These are the reserved words and built-ins recognized by `basic.js`. The language is case-insensitive; keywords are listed in uppercase for clarity.

## Statements and Directives
```
DEBUGON
DEBUGOFF
STATUS
NEW
BREAK
CONTINUE
IF
THEN
BEGIN
ELSEIF
ELSE
RAISE
DIM
CALL
PRINT
PRINTLN
INPUT
LINE INPUT
OPEN
CLOSE
LET
DECLARE
FUNC
FUNCTION
SUB
END FUNC
END FUNCTION
END SUB
TRY
CATCH
FINALLY
END TRY
SELECT CASE
END SELECT
CASE
CASE ELSE
END IF
ENDIF
```

## File I/O modifiers and related tokens
```
FOR
INPUT
OUTPUT
APPEND
AS
```

## Word Operators and Boolean/Null Literals
```
AND
OR
NOT
TRUE
FALSE
NULL
NIL
NONE
```

## Built-in Functions
```
EOF
LEN
INT
STR
MID$
LEFT$
RIGHT$
UCASE$
LCASE$
INSTR
ABS
ATN
COS
EXP
LOG
RND
SIN
SQR
TAN
TAB
AT
SPC
USING$
```

## Comments
```
REM
```

Notes:
- `LINE INPUT` and `INPUT #`/`PRINT #` forms are supported; the editor may highlight `LINE`, `INPUT`, `PRINT` individually.
- File handles are denoted with `#` in syntax (e.g., `PRINT #1, ...`), but `#` is a symbol, not a keyword.
- String (`$`) and integer (`%`) variable suffixes are syntactic conventions on identifiers, not keywords.
- Exponent operator is `^` in source and translated internally to `**`.
