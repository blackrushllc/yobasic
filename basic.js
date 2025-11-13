/*
 YoBASIC 1.0 - Blackrush LLC - https://www.yobasic.com/basic
*/
(function(global){
  'use strict';

  function isDefined(x){ return typeof x !== 'undefined'; }

  class BasicInterpreter {
    constructor(options={}){
      this.debug = options.debug !== undefined ? !!options.debug : true; // Debug mode default ON
      this.vars = Object.create(null); // case-insensitive symbol table: keys stored uppercased (globals)
      this.lastOutputLines = []; // capture last line's outputs for return value
      this.term = options.term || (typeof global.term !== 'undefined' ? global.term : null);
      this.autoEcho = options.autoEcho !== undefined ? !!options.autoEcho : true; // echo to sinks during execution
      this.vfs = options.vfs || (typeof global.__vfsInstance__ !== 'undefined' ? global.__vfsInstance__ : null);
      // Host bridge callbacks (Phase 3 - optional)
      this.hostReadFile = options.hostReadFile || null;        // (path: string) => string
      this.hostExtern = options.hostExtern || null;            // (name: string, args: string[]) => string
      this.hostCallModule = options.hostCallModule || null;    // (moduleName: string, memberName: string, args: any[]) => any
      this.openFiles = {}; // BASIC open file handles: { [handle:number]: {handle, filename, mode, position, bufferIn, bufferOut} }
      // REPL multiline block buffer (for WHILE/WEND, SELECT CASE, etc.)
      this._replBlock = null; // { lines: string[], stack: string[] }
      // Function table and call stack
      this.funcs = Object.create(null); // { NAME: { name, params, isSub, start, end, labels } }
      this.callStack = []; // [{ name, locals }]
      // Label table for the last parsed unit (program scope)
      this.labels = Object.create(null); // { NAME: lineIndex }
      // Last program lines (for user-defined functions execution)
      this._lastProgramLines = null;
      // Execution context flags
      this._inProgram = false;           // true while inside runProgram()
      this._suppressReset = false;       // true when runProgram is invoked for function bodies
      // Bind I/O
      this.echo = this.echo.bind(this);
      this.inputSync = this.inputSync.bind(this);
    }

    setTerm(term){
      this.term = term;
    }

    reset(){
      this.vars = Object.create(null);
      this._replBlock = null;
      this.funcs = Object.create(null);
      this.callStack = [];
      this.labels = Object.create(null);
    }

    // Public API
    lineExecute(line){
      if (line == null) return null;
      const textRaw = String(line);
      const text = this._stripComments(textRaw).trim();
      if (text === '') return null;

      // REPL block accumulation for multi-line constructs
      const opener = (ln)=>{
        if (/^WHILE\b/i.test(ln)) return 'WHILE';
        if (/^DO\b/i.test(ln)) return 'DO';
        if (/^FOR\b/i.test(ln)) return 'FOR';
        if (/^SELECT\s+CASE\b/i.test(ln)) return 'SELECT';
        if (/^(FUNC|FUNCTION)\b/i.test(ln)) return 'FUNC';
        if (/^SUB\b/i.test(ln)) return 'SUB';
        if (/^TRY\b/i.test(ln)) return 'TRY';
        if (/^FOREACH\b/i.test(ln)) return 'FOREACH';
        if (/^IF\b/i.test(ln)) {
          // Treat as block opener only when not a single-line IF ... THEN <stmt>
          // Exclude the special header "THEN BEGIN" which indicates a block, not a single-line statement
          if (/^IF\s+(.+?)\s+THEN\s+(?!BEGIN\b)\S+/i.test(ln)) return null;
          return 'IF';
        }
        return null;
      };
      const closerType = (ln)=>{
        if (/^WEND\b/i.test(ln)) return 'WHILE';
        if (/^LOOP\b/i.test(ln)) return 'DO';
        if (/^NEXT\b/i.test(ln)) return '__NEXT__';
        if (/^END\s+SELECT\b/i.test(ln)) return 'SELECT';
        if (/^END\s+(FUNC|FUNCTION)\b/i.test(ln)) return 'FUNC';
        if (/^END\s+SUB\b/i.test(ln)) return 'SUB';
        if (/^END\s+TRY\b/i.test(ln)) return 'TRY';
        if (/^END\s*IF\b/i.test(ln)) return 'IF';
        if (/^ENDIF\b/i.test(ln)) return 'IF';
        if (/^END\b\s*$/i.test(ln)) return '__END__';
        return null;
      };

      // If already buffering a block, or this line opens a new block, accumulate
      if (this._replBlock || opener(text)){
        if (!this._replBlock) this._replBlock = { lines: [], stack: [] };
        // Update stack for this line
        const openT = opener(text);
        const closeT = closerType(text);
        if (openT) this._replBlock.stack.push(openT);
        if (closeT){
          if (closeT === '__END__'){
            if (this._replBlock.stack.length) this._replBlock.stack.pop();
          } else if (closeT === '__NEXT__'){
            // NEXT can close either FOR or FOREACH; remove the nearest such opener
            let idx = -1;
            for (let k = this._replBlock.stack.length - 1; k >= 0; k--){
              const t = this._replBlock.stack[k];
              if (t === 'FOR' || t === 'FOREACH'){ idx = k; break; }
            }
            if (idx >= 0) this._replBlock.stack.splice(idx, 1);
          } else {
            // pop the most recent matching opener
            const idx = this._replBlock.stack.lastIndexOf(closeT);
            if (idx >= 0) this._replBlock.stack.splice(idx, 1);
            else if (this._replBlock.stack.length) {
              // unmatched closer: let runProgram handle later; still reduce by popping last
              this._replBlock.stack.pop();
            }
          }
        }
        this._replBlock.lines.push(textRaw);
        if (this._replBlock.stack.length === 0){
          // Execute accumulated program block
          const prog = this._replBlock.lines.join('\n');
          this._replBlock = null;
          const outputLines = this.runProgram(prog) || [];
          return outputLines.length ? outputLines.join('\n') : null;
        }
        return null; // keep accumulating
      }

      // Single-line execution path
      const allOut = [];
      this.lastOutputLines = [];
      try{
        const stmts = this._splitStatements(textRaw);
        for (const stmt of stmts){
          const s = this._stripComments(stmt).trim();
          if (!s) continue;
          const outBefore = this.lastOutputLines.length;
          if (this.debug) this._dbg(`Exec line: ${s}`);
          this._execStatement(s);
          if (this.lastOutputLines.length > outBefore){
            const newSeg = this.lastOutputLines.slice(outBefore);
            allOut.push(...newSeg);
          }
        }
      }catch(e){
        this._error(e);
        allOut.push(String(e.message || e));
      }
      return allOut.length ? allOut.join('\n') : null;
    }

    runProgram(program){
      const output = [];
      if (this.debug) this._dbg('Run Program');
      const prevIn = this._inProgram;
      const prevSuppress = this._suppressReset;
      this._inProgram = true;
      try{
        if (!this._suppressReset) {
          // Clear memory before each top-level program run
          this.reset();
        }
        const lines = Array.isArray(program) ? program.slice() : String(program).split(/\r?\n/);
        this._lastProgramLines = lines;
        // Prepass: collect function/sub blocks and program-scope labels
        this._prepass(lines);
        // Execution context stack for control structures
        const stack = [];
        const gosubStack = [];
        const n = lines.length;
        let i = 0;
        while (i < n){
        const raw = lines[i];
        const lineNo = i + 1;
        try{
          let stmtLine = this._stripComments(raw).trim();
          if (stmtLine === ''){ i++; continue; }

          // Skip function/sub bodies at top-level execution
          if (/^(FUNC|FUNCTION)\b/i.test(stmtLine) || /^SUB\b/i.test(stmtLine)){
            const endIdx = this._findEndFuncOrSub(lines, i);
            i = endIdx + 1; // skip
            continue;
          }

          // LABEL declaration (no-op at runtime)
          if (/^LABEL\s+/i.test(stmtLine)) { i++; continue; }

          // Explicit END FUNC|FUNCTION|SUB: end current function/sub or program
          if (/^END\s+(FUNC|FUNCTION|SUB)\b/i.test(stmtLine)){
            if (this.callStack && this.callStack.length){
              const ex = new Error('RETURN'); ex.__ctrl='FUNC_RETURN'; ex.__ret=undefined; throw ex;
            }
            break; // at top-level, END FUNCTION/SUB ends the program
          }

          // Generic END handler: closes the current open block or ends function/program
          // Only match a bare END on the line; structured forms like END IF, END SELECT, etc. are handled elsewhere
          if (/^END\b\s*$/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top){
              // No active block: if inside a function/sub, treat as function return; else end program
              if (this.callStack && this.callStack.length){
                const ex = new Error('RETURN'); ex.__ctrl='FUNC_RETURN'; ex.__ret=undefined; throw ex;
              }
              break; // terminate program
            }
            switch (top.type){
              case 'WHILE': {
                const whileLine = this._stripComments(lines[top.start]).trim();
                const condExpr = whileLine.replace(/^WHILE\b/i, '').replace(/\s+BEGIN\s*$/i, '').trim();
                const cond = this._truthy(this._evalExpression(condExpr));
                if (cond){ i = top.start + 1; }
                else { stack.pop(); i++; }
                continue;
              }
              case 'DO': {
                if (top.mode === 'PRE'){
                  // Re-evaluate stored pre-test condition
                  const cond = this._truthy(this._evalExpression(top.expr));
                  const keep = (top.test === 'WHILE') ? cond : !cond;
                  if (keep){ i = top.start + 1; } else { stack.pop(); i++; }
                } else {
                  // POST mode: treat as unconditional LOOP
                  i = top.start + 1;
                }
                continue;
              }
              case 'FOR': {
                const cur = Number(this._getVar(top.varKey));
                const nextVal = cur + top.step;
                this._assignVariable(top.varKey, nextVal);
                const keep = top.step > 0 ? (nextVal <= top.endVal) : (nextVal >= top.endVal);
                if (keep){ i = top.start + 1; } else { stack.pop(); i++; }
                continue;
              }
              case 'FOREACH': {
                top.idx++;
                if (top.idx >= top.iter.length){ stack.pop(); i++; }
                else { this._foreachAssign(top); i = top.start + 1; }
                continue;
              }
              case 'SELECT': {
                stack.pop(); i++; continue;
              }
              case 'IF': {
                // END closes IF block
                stack.pop(); i++; continue;
              }
              case 'TRY': {
                const pend = top.pendingError; stack.pop(); i++; if (pend) throw pend; continue;
              }
              default: {
                // Unknown frame type: pop and continue
                stack.pop(); i++; continue;
              }
            }
          }

          // DECLARE SUB/FUNCTION/FUNC ... (forward declarations) -> no-op at runtime
          if (/^DECLARE\b\s+(SUB|FUNC|FUNCTION)\b/i.test(stmtLine)) { i++; continue; }

          // GOTO
          if (/^GOTO\s+/i.test(stmtLine)){
            const m = stmtLine.match(/^GOTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
            if (!m) throw new Error(`Invalid GOTO syntax at line ${lineNo}`);
            const target = m[1].toUpperCase();
            if (!Object.prototype.hasOwnProperty.call(this.labels, target)) throw new Error(`Unknown label ${target} at line ${lineNo}`);
            i = this.labels[target];
            continue;
          }

          // GOSUB
          if (/^GOSUB\s+/i.test(stmtLine)){
            const m = stmtLine.match(/^GOSUB\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
            if (!m) throw new Error(`Invalid GOSUB syntax at line ${lineNo}`);
            const target = m[1].toUpperCase();
            if (!Object.prototype.hasOwnProperty.call(this.labels, target)) throw new Error(`Unknown label ${target} at line ${lineNo}`);
            gosubStack.push(i + 1);
            i = this.labels[target];
            continue;
          }

          // RETURN (gosub)
          if (/^RETURN\b/i.test(stmtLine)){
            if (this.callStack && this.callStack.length){
              // In a function/sub, treat as function return; throw control
              const expr = stmtLine.replace(/^RETURN\b/i, '').trim();
              let value = null;
              if (expr) value = this._evalExpression(expr);
              const ex = new Error('RETURN'); ex.__ctrl='FUNC_RETURN'; ex.__ret=value; throw ex;
            }
            if (!gosubStack.length) throw new Error(`RETURN without GOSUB at line ${lineNo}`);
            i = gosubStack.pop();
            continue;
          }

          // RAISE
          if (/^RAISE\b/i.test(stmtLine)){
            const expr = stmtLine.replace(/^RAISE\b/i, '').trim();
            const val = expr ? this._evalExpression(expr) : 'Error';
            const err = new Error(typeof val === 'string' ? val : (val && val.message) || String(val));
            err.__raised = val;
            throw err;
          }

          // TRY/CATCH/FINALLY blocks
          if (/^TRY\b/i.test(stmtLine)){
            const tb = this._findTryBlock(lines, i);
            // Enter TRY frame
            stack.push({ type: 'TRY', start: i, catchIdx: tb.catchIdx, catchVar: tb.catchVar, finallyIdx: tb.finallyIdx, end: tb.endIdx, state: 'TRY', pendingError: null });
            i++;
            continue;
          }
          if (/^CATCH\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'TRY') throw new Error(`CATCH without TRY at line ${lineNo}`);
            // If we reached CATCH without error, skip to FINALLY or END TRY
            if (top.state === 'TRY'){
              i = (top.finallyIdx != null ? top.finallyIdx + 1 : top.end + 1);
              continue;
            }
            // Entering catch body after an error: clear pending so END TRY won't rethrow
            top.pendingError = null;
            i++;
            continue;
          }
          if (/^FINALLY\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'TRY') throw new Error(`FINALLY without TRY at line ${lineNo}`);
            i++;
            continue;
          }
          if (/^END\s+TRY\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'TRY') throw new Error(`END TRY without TRY at line ${lineNo}`);
            const pend = top.pendingError;
            stack.pop();
            i++;
            if (pend) throw pend; // rethrow after FINALLY
            continue;
          }

          // IF ... [THEN] [BEGIN] multi-line block with ELSEIF/ELSE, closed by END/END IF/ENDIF
          if (/^IF\b/i.test(stmtLine)){
            // Exclude single-line IF ... THEN <stmt>
            if (/^IF\s+(.+?)\s+THEN\s+(?!BEGIN\b).+$/i.test(stmtLine)){
              // fall through to statement exec which handles single-line IF
            } else {
              const endInfo = this._findEndIfAndClauses(lines, i);
              // Evaluate IF and ELSEIF conditions to choose a clause
              const chosen = this._chooseIfClause(lines, i, endInfo);
              if (!chosen){
                // No clause chosen; skip entire IF block
                i = endInfo.end + 1;
                continue;
              }
              // Push IF frame so that END/ENDIF/END IF will close it, and we can also skip remaining clauses if we hit them
              stack.push({ type: 'IF', start: i, end: endInfo.end, after: chosen.after });
              // Jump to first line after chosen header
              i = chosen.start + 1;
              continue;
            }
          }

          // WHILE ... WEND
          if (/^WHILE\b/i.test(stmtLine)){
            const condExpr = stmtLine.replace(/^WHILE\b/i, '').replace(/\s+BEGIN\s*$/i, '').trim();
            const endIdx = this._findMatchingWend(lines, i);
            const cond = this._truthy(this._evalExpression(condExpr));
            if (cond){
              // Enter loop block
              stack.push({ type: 'WHILE', start: i, end: endIdx });
              i++; // execute first line of body
            } else {
              // Skip to line after WEND
              i = endIdx + 1;
            }
            continue;
          }
          if (/^WEND\b/i.test(stmtLine)){
            // Jump back to matching WHILE
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'WHILE') throw new Error(`WEND without matching WHILE at line ${lineNo}`);
            // Re-evaluate condition at WHILE
            const whileLine = this._stripComments(lines[top.start]).trim();
            const condExpr = whileLine.replace(/^WHILE\b/i, '').replace(/\s+BEGIN\s*$/i, '').trim();
            const cond = this._truthy(this._evalExpression(condExpr));
            if (cond){
              i = top.start + 1; // loop again
            } else {
              stack.pop();
              i++; // exit loop
            }
            continue;
          }

          // SELECT CASE ... END SELECT (extended patterns)
          if (/^SELECT\s+CASE\b/i.test(stmtLine)){
            const expr = stmtLine.replace(/^SELECT\s+CASE\b/i, '').replace(/\s+BEGIN\s*$/i, '').trim();
            const endIdx = this._findEndSelect(lines, i);
            const selector = this._evalExpression(expr);
            // Collect top-level CASE clauses
            const cases = this._findTopLevelCases(lines, i + 1, endIdx);
            // Determine chosen case using extended patterns
            let chosen = null; let elseCase = null;
            for (const c of cases){
              if (c.isElse){ elseCase = c; continue; }
              const patternText = c.text.replace(/^CASE\b/i, '').trim();
              const patterns = this._parseCasePatterns(patternText);
              for (const pat of patterns){
                if (this._casePatternMatches(selector, pat)) { chosen = c; break; }
              }
              if (chosen) break;
            }
            if (!chosen) chosen = elseCase;
            if (!chosen){
              // No match and no ELSE -> skip entire block
              i = endIdx + 1;
              continue;
            }
            // Enter SELECT frame; begin executing at first line after chosen case
            stack.push({ type: 'SELECT', start: i, end: endIdx });
            i = chosen.index + 1;
            continue;
          }
          if (/^END\s+SELECT\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'SELECT') throw new Error(`END SELECT without matching SELECT CASE at line ${lineNo}`);
            stack.pop();
            i++; continue;
          }
          // END IF / ENDIF
          if (/^END\s*IF\b/i.test(stmtLine) || /^ENDIF\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'IF') throw new Error(`END IF without matching IF at line ${lineNo}`);
            stack.pop(); i++; continue;
          }
          if (/^CASE\b/i.test(stmtLine)){
            // If we're inside a SELECT block and hit another CASE, end the SELECT block and skip to after END SELECT
            const top = stack[stack.length - 1];
            if (top && top.type === 'SELECT'){
              stack.pop();
              i = top.end + 1;
              continue;
            }
            // Otherwise treat as normal statement (will likely error)
          }

          // If we are inside an IF frame and reached the end of the chosen body, skip to after the IF block
          {
            const top = stack[stack.length - 1];
            if (top && top.type === 'IF' && i === top.after){
              stack.pop();
              i = top.end + 1;
              continue;
            }
          }

          // DO/LOOP family
          if (/^DO\b/i.test(stmtLine)){
            // Parse forms: DO, DO WHILE expr, DO UNTIL expr, optional trailing BEGIN
            let rest = stmtLine.replace(/^DO\b/i, '').trim();
            rest = rest.replace(/\s+BEGIN\s*$/i, '');
            const endIdx = this._findMatchingLoop(lines, i);
            if (/^(WHILE|UNTIL)\b/i.test(rest)){
              const m = rest.match(/^(WHILE|UNTIL)\b\s*(.*)$/i);
              const testType = m[1].toUpperCase();
              const exprText = m[2].replace(/\s+BEGIN\s*$/i, '').trim();
              const cond = this._truthy(this._evalExpression(exprText));
              if ((testType === 'WHILE' && cond) || (testType === 'UNTIL' && !cond)){
                stack.push({ type: 'DO', start: i, end: endIdx, mode: 'PRE', test: testType, expr: exprText });
                i++; // run body
              } else {
                i = endIdx + 1; // skip body
              }
            } else {
              // Unconditional DO, may have post-test on LOOP
              stack.push({ type: 'DO', start: i, end: endIdx, mode: 'POST', test: null, expr: null });
              i++; // run body
            }
            continue;
          }
          if (/^LOOP\b/i.test(stmtLine)){
            // Optional trailing: LOOP WHILE expr | LOOP UNTIL expr
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'DO') throw new Error(`LOOP without matching DO at line ${lineNo}`);
            const rest = stmtLine.replace(/^LOOP\b/i, '').trim();
            if (top.mode === 'PRE'){
              // Re-evaluate stored condition
              const cond = this._truthy(this._evalExpression(top.expr));
              const keep = (top.test === 'WHILE') ? cond : !cond;
              if (keep){ i = top.start + 1; } else { stack.pop(); i++; }
            } else {
              if (/^(WHILE|UNTIL)\b/i.test(rest)){
                const m = rest.match(/^(WHILE|UNTIL)\b\s*(.*)$/i);
                const testType = m[1].toUpperCase();
                const exprText = m[2].trim();
                const cond = this._truthy(this._evalExpression(exprText));
                const keep = (testType === 'WHILE') ? cond : !cond;
                if (keep){ i = top.start + 1; } else { stack.pop(); i++; }
              } else {
                // Unconditional loop; repeat
                i = top.start + 1;
              }
            }
            continue;
          }

          // FOREACH ... NEXT
          if (/^FOREACH\b/i.test(stmtLine)){
            // FOREACH item IN expr  |  FOREACH key, value IN expr
            const endIdx = this._findMatchingNext(lines, i);
            const m = stmtLine.match(/^FOREACH\s+([A-Za-z_][A-Za-z0-9_\$%]*)(?:\s*,\s*([A-Za-z_][A-Za-z0-9_\$%]*))?\s+IN\s+(.+?)(?:\s+BEGIN\s*)?$/i);
            if (!m) throw new Error(`Invalid FOREACH syntax at line ${lineNo}`);
            const var1 = m[1];
            const var2 = m[2] || null;
            const srcExpr = m[3];
            const srcVal = this._evalExpression(srcExpr);
            let iter = [];
            let mode = 'ARRAY'; // ARRAY or OBJECT or DIM
            if (srcVal && typeof srcVal === 'object' && srcVal.__dim){
              mode = 'DIM';
              // flatten indices linear order 1..N
              const total = srcVal.data.length;
              iter = Array.from({length: total}, (_,k)=>k+1); // 1-based positions
            } else if (Array.isArray(srcVal)){
              iter = srcVal.map((_, idx)=>idx);
              mode = 'ARRAY';
            } else if (srcVal && typeof srcVal === 'object'){
              iter = Object.keys(srcVal);
              mode = 'OBJECT';
            }
            if (!iter.length){ i = endIdx + 1; continue; }
            // Prime first iteration
            const frame = { type:'FOREACH', start:i, end:endIdx, var1: String(var1).toUpperCase(), var2: var2 ? String(var2).toUpperCase() : null, mode, iter, idx:0, src: srcVal };
            this._foreachAssign(frame);
            stack.push(frame);
            i++; continue;
          }
          // FOR/NEXT
          if (/^FOR\b/i.test(stmtLine)){
            // FOR var = start TO end [STEP step]
            const endIdx = this._findMatchingNext(lines, i);
            const m = stmtLine.match(/^FOR\s+([A-Za-z_][A-Za-z0-9_\$%]*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+?))?\s*(?:BEGIN\s*)?$/i);
            if (!m) throw new Error(`Invalid FOR syntax at line ${lineNo}`);
            const varName = m[1];
            const startExpr = m[2];
            const endExpr = m[3];
            const stepExpr = m[4];
            const startVal = Number(this._evalExpression(startExpr));
            const endVal = Number(this._evalExpression(endExpr));
            let stepVal = (isDefined(stepExpr) && stepExpr != null) ? Number(this._evalExpression(stepExpr)) : 1;
            if (!Number.isFinite(startVal) || !Number.isFinite(endVal) || !Number.isFinite(stepVal)){
              throw new Error(`FOR requires numeric start/end/step at line ${lineNo}`);
            }
            if (stepVal === 0) throw new Error(`FOR STEP cannot be 0 at line ${lineNo}`);
            // Initialize variable and decide if first iteration executes
            this._assignVariable(varName, startVal);
            const varKey = String(varName).trim().toUpperCase();
            const ok = stepVal > 0 ? (startVal <= endVal) : (startVal >= endVal);
            if (!ok){
              // Skip loop entirely
              i = endIdx + 1;
            } else {
              stack.push({ type: 'FOR', start: i, end: endIdx, varKey, endVal, step: stepVal });
              i++; // into body
            }
            continue;
          }
          if (/^NEXT\b/i.test(stmtLine)){
            const top = stack[stack.length - 1];
            if (!top) throw new Error(`NEXT without matching loop at line ${lineNo}`);
            // Optional variable name
            const rest = stmtLine.replace(/^NEXT\b/i, '').trim();
            if (top.type === 'FOR'){
              if (rest){
                const name = rest.replace(/,.*$/, '').trim();
                if (name && name.toUpperCase() !== top.varKey) throw new Error(`NEXT variable mismatch at line ${lineNo}`);
              }
              // Increment and test
              const cur = Number(this._getVar(top.varKey));
              const nextVal = cur + top.step;
              this._assignVariable(top.varKey, nextVal);
              const keep = top.step > 0 ? (nextVal <= top.endVal) : (nextVal >= top.endVal);
              if (keep){ i = top.start + 1; } else { stack.pop(); i++; }
              continue;
            } else if (top.type === 'FOREACH'){
              if (rest){
                const name = rest.replace(/,.*$/, '').trim().toUpperCase();
                if (name && !(name === top.var1 || name === top.var2)) throw new Error(`NEXT variable mismatch at line ${lineNo}`);
              }
              top.idx++;
              if (top.idx >= top.iter.length){ stack.pop(); i++; }
              else { this._foreachAssign(top); i = top.start + 1; }
              continue;
            } else {
              throw new Error(`NEXT without matching FOR/FOREACH at line ${lineNo}`);
            }
          }

          // For regular statements, allow multi-statements per line
          const stmts = this._splitStatements(stmtLine);
          for (const stmt of stmts){
            if (stmt.trim() === '') continue;
            if (this.debug) this._dbg(`Exec line: ${stmt}`);
            const before = this.lastOutputLines.length;
            try{
              this._execStatement(stmt);
            }catch(e){
              // Handle BREAK/CONTINUE control signals
              if (e && e.__ctrl === 'BREAK'){
                // Find nearest loop frame
                let idx = stack.length - 1;
                while (idx >= 0 && !['WHILE','DO','FOR','FOREACH'].includes(stack[idx].type)) idx--;
                if (idx < 0) throw new Error(`BREAK outside of loop at line ${lineNo}`);
                // Pop frames above and including the loop for BREAK
                const frame = stack[idx];
                // Remove all frames from top down to idx inclusive
                stack.splice(idx);
                i = frame.end + 1;
                // Stop processing remaining statements on this line
                break;
              } else if (e && e.__ctrl === 'CONTINUE'){
                let idx = stack.length - 1;
                while (idx >= 0 && !['WHILE','DO','FOR','FOREACH'].includes(stack[idx].type)) idx--;
                if (idx < 0) throw new Error(`CONTINUE outside of loop at line ${lineNo}`);
                const frame = stack[idx];
                // Pop frames above the loop (e.g., SELECT inside loop)
                stack.splice(idx + 1);
                // Jump to loop end token to let loop mechanics handle next iteration
                i = frame.end;
                break;
              } else {
                throw e;
              }
            }
            if (this.lastOutputLines.length > before){
              output.push(...this.lastOutputLines.slice(before));
            }
          }
          // If we jumped due to BREAK/CONTINUE, do not auto-increment i here
          if (i === lineNo - 1) { i++; }
        }catch(e){
          // TRY routing or function return propagation
          if (e && e.__ctrl === 'FUNC_RETURN') { throw e; }
          // Route to nearest TRY frame if present
          let idx = stack.length - 1;
          while (idx >= 0 && stack[idx].type !== 'TRY') idx--;
          if (idx >= 0){
            const tr = stack[idx];
            tr.state = 'CATCH';
            tr.pendingError = e;
            // Jump to CATCH if present, else FINALLY or END TRY
            if (tr.catchIdx != null){
              // Bind catch variable if provided
              if (tr.catchVar){
                const errVal = (e && Object.prototype.hasOwnProperty.call(e,'__raised')) ? e.__raised : (e && e.message) ? e.message : String(e);
                this._assignVariable(tr.catchVar, errVal);
              }
              // Jump to the CATCH line itself so its handler logic can clear pendingError
              i = tr.catchIdx;
            } else if (tr.finallyIdx != null){
              i = tr.finallyIdx + 1;
            } else {
              i = tr.end + 1;
            }
            continue; // resume execution inside TRY handling
          }
          this._error(e);
          output.push(String(e.message || e));
          break; // stop on error
        }
      }
      return output;
    } finally {
      this._inProgram = prevIn;
      this._suppressReset = prevSuppress;
      if (this.debug) this._dbg('End Run Program');
    }
  }

    // --- I/O helpers ---
    echo(msg){
      const s = String(msg);
      // Record for return values
      this.lastOutputLines.push(s);
      // Always output to console
      try{ console.log(s); }catch(_){ /* ignore */ }
      // Output to jQuery Terminal only if autoEcho is enabled
      if (this.autoEcho) {
        try{
          const t = this.term || (typeof global.term !== 'undefined' ? global.term : null);
          if (t && typeof t.echo === 'function') t.echo(s);
        }catch(_){ /* ignore */ }
      }
    }

    _dbg(msg){
      if (!this.debug) return;
      try{ console.log(`[BASIC] ${msg}`); }catch(_){ }
      try{
        const t = this.term || (typeof global.term !== 'undefined' ? global.term : null);
        if (t && typeof t.echo === 'function') t.echo(`[BASIC] ${msg}`);
      }catch(_){ }
    }

    _error(err){
      const s = '[BASIC ERROR] ' + (err && err.message ? err.message : String(err));
      try{ console.error(s); }catch(_){ }
      try{
        const t = this.term || (typeof global.term !== 'undefined' ? global.term : null);
        if (t && typeof t.error === 'function') t.error(s);
        else if (t && typeof t.echo === 'function') t.echo(s);
      }catch(_){ }
    }

    inputSync(promptText){
      const p = isDefined(promptText) ? String(promptText) : '? ';
      // Use jQuery Terminal built-in read if available and synchronous? The plugin read is async; we stick to prompt()
      let v;
      if (typeof window !== 'undefined' && typeof window.prompt === 'function'){
        v = window.prompt(p, '');
      }
      if (!isDefined(v)) v = '';
      return v;
    }

    // --- Statement execution ---
    _execStatement(stmtRaw){
      let stmt = this._stripComments(stmtRaw).trim();
      if (!stmt) return;
      // Meta commands (no expression parsing)
      const upper = stmt.toUpperCase();
      if (upper === 'DEBUGON') { this.debug = true; this.echo('DEBUG: ON'); return; }
      if (upper === 'DEBUGOFF') { this.debug = false; this.echo('DEBUG: OFF'); return; }
      if (upper === 'STATUS') { this._status(); return; }
      if (upper === 'NEW') { if (this._inProgram) throw new Error('NEW cannot be used inside a program'); this.reset(); this.echo('OK'); return; }
      if (upper === 'BREAK') { const ex = new Error('BREAK'); ex.__ctrl = 'BREAK'; throw ex; }
      if (upper === 'CONTINUE') { const ex = new Error('CONTINUE'); ex.__ctrl = 'CONTINUE'; throw ex; }

      // IF ... THEN ... [ELSE ...] single-line
      if (/^IF\b/i.test(stmt)){
        this._execIfSingleLine(stmt);
        return;
      }

      // RAISE (single-line path)
      if (/^RAISE\b/i.test(stmt)){
        const expr = stmt.replace(/^RAISE\b/i, '').trim();
        const val = expr ? this._evalExpression(expr) : 'Error';
        const err = new Error(typeof val === 'string' ? val : (val && val.message) || String(val));
        err.__raised = val;
        throw err;
      }

      // DIM declarations
      if (/^DIM\b/i.test(stmt)){
        this._execDim(stmt);
        return;
      }

      // CALL SubName(args)
      if (/^CALL\b/i.test(stmt)){
        const rest = stmt.replace(/^CALL\b/i, '').trim();
        if (!rest) throw new Error('CALL requires a target');
        // Evaluate as expression to trigger __call
        this._evalExpression(rest);
        return;
      }

      // Array element assignment like A(i,j) = expr
      if (/^[A-Za-z_][A-Za-z0-9_\$%]*\s*\(/.test(stmt) && stmt.includes('=')){
        // Find top-level '='
        let depth=0,inS=false,inD=false,eq=-1; const s=stmt;
        for (let i=0;i<s.length;i++){
          const c=s[i];
          if (c==='"' && !inS){ inD=!inD; continue; }
          if (c==='\'' && !inD){ inS=!inS; continue; }
          if ((inD||inS) && c==='\\'){ i++; continue; }
          if (!inD && !inS){
            if (c==='(') depth++;
            else if (c===')') depth=Math.max(0,depth-1);
            else if (c==='=' && depth===0){ eq=i; break; }
          }
        }
        if (eq > 0){
          const lhs = s.slice(0,eq).trim();
          const rhs = s.slice(eq+1);
          const m = lhs.match(/^([A-Za-z_][A-Za-z0-9_\$%]*)\s*\((.*)\)\s*$/);
          if (m){
            const name = m[1].toUpperCase();
            const indicesText = m[2];
            const indices = this._parseCommaExprList(indicesText);
            const value = this._evalExpression(rhs);
            this._dimSet(name, indices, value);
            return;
          }
        }
      }

      // BASIC File I/O statements
      // OPEN "filename" FOR INPUT|OUTPUT|APPEND AS #n
      if (/^OPEN\b/i.test(stmt)){
        this._execOpen(stmt);
        return;
      }
      // CLOSE [#n]
      if (/^CLOSE\b/i.test(stmt)){
        this._execClose(stmt);
        return;
      }
      // LINE INPUT #n, var$
      if (/^LINE\s+INPUT\b/i.test(stmt)){
        const m = stmt.match(/^LINE\s+INPUT\s*#\s*(\d+)\s*,\s*(.+)$/i);
        if (!m) throw new Error('Invalid LINE INPUT # syntax');
        const h = parseInt(m[1],10)|0; const varName = m[2].trim();
        this._lineInputFromFile(h, varName);
        return;
      }
      // INPUT #n, var1, var2, ...
      if (/^INPUT\s*#/i.test(stmt)){
        const m = stmt.match(/^INPUT\s*#\s*(\d+)\s*,\s*(.+)$/i);
        if (!m) throw new Error('Invalid INPUT # syntax');
        const h = parseInt(m[1],10)|0; const varsPart = m[2];
        this._inputFromFile(h, varsPart);
        return;
      }
      // PRINT #n, ...
      if (/^PRINT\s*#/i.test(stmt)){
        const m = stmt.match(/^PRINT\s*#\s*(\d+)\s*,\s*(.+)$/i);
        if (!m) throw new Error('Invalid PRINT # syntax');
        const h = parseInt(m[1],10)|0; const argsStr = m[2];
        this._printToFile(h, argsStr);
        return;
      }

      // PRINT / PRINTLN
      if (/^PRINTLN\b/i.test(stmt)){
        const argsStr = stmt.replace(/^PRINTLN\b/i, '').trim();
        const values = this._parseCommaExprList(argsStr);
        const text = this._formatPrint(values, '\t');
        this.echo(text); // println -> each as line
        return;
      }
      if (/^PRINT\b/i.test(stmt)){
        const argsStr = stmt.replace(/^PRINT\b/i, '').trim();
        const values = this._parseCommaExprList(argsStr);
        const text = this._formatPrint(values, '\t');
        this.echo(text);
        return;
      }

      // INPUT ["Prompt:",] name  (but not file INPUT #)
      if (/^INPUT\b(?!\s*#)/i.test(stmt)){
        const rest = stmt.replace(/^INPUT\b/i,'').trim();
        // Simple forms: INPUT name  | INPUT "prompt", name
        let prompt = '? ';
        let varName = '';
        if (rest.startsWith('"')){
          const {value: p, end} = this._readString(rest, 0);
          prompt = p;
          const after = rest.slice(end).trim().replace(/^,/, '').trim();
          varName = after;
        } else {
          varName = rest;
        }
        varName = varName.trim();
        if (!varName) throw new Error('INPUT requires a variable name');
        const inputVal = this.inputSync(prompt);
        this._assignVariable(varName, inputVal);
        return;
      }

      // LET or direct assignment
      if (/^LET\b/i.test(stmt)){
        const after = stmt.replace(/^LET\b/i, '').trim();
        this._execAssignment(after);
        return;
      }
      // direct assignment name = expr
      if (/^[A-Za-z_][A-Za-z0-9_\$%]*\s*=/.test(stmt)){
        this._execAssignment(stmt);
        return;
      }

      // Expression statement
      const v = this._evalExpression(stmt);
      if (typeof v !== 'undefined') {
        // For plain function/sub calls without assignment, don't auto-print unless value is not undefined and not a SUB
        this.echo(this._toString(v));
      }
    }

    // --- BASIC File I/O implementation ---
    _ensureVfs(){
      if (!this.vfs) throw new Error('VFS not available');
    }

    _execOpen(stmt){
      // OPEN "filename" FOR MODE AS #n
      const m = stmt.match(/^OPEN\s+"([^"]+)"\s+FOR\s+(INPUT|OUTPUT|APPEND)\s+AS\s*#\s*(\d+)\s*$/i);
      if (!m) throw new Error('Invalid OPEN syntax');
      const filename = m[1];
      const mode = m[2].toUpperCase();
      const handle = parseInt(m[3],10)|0;
      this._ensureVfs();
      // Close existing same handle
      if (this.openFiles[handle]) this._closeHandle(handle);
      if (mode === 'INPUT'){
        const content = this.vfs.readData(filename);
        if (content == null) throw new Error('File not found');
        const lines = String(content).replace(/\r\n?/g,'\n').split('\n');
        this.openFiles[handle] = { handle, filename, mode, position: 0, bufferIn: lines, bufferOut: null };
      } else if (mode === 'OUTPUT'){
        // Truncate or create
        this.vfs.writeData(filename, '');
        this.openFiles[handle] = { handle, filename, mode, position: 0, bufferIn: null, bufferOut: [] };
      } else if (mode === 'APPEND'){
        const content = this.vfs.readData(filename);
        const existing = content != null ? String(content).replace(/\r\n?/g,'\n').split('\n') : [];
        // Keep as text buffer; appends will push lines
        this.openFiles[handle] = { handle, filename, mode, position: existing.length, bufferIn: null, bufferOut: existing };
      }
    }

    _printToFile(handle, argsStr){
      this._ensureVfs();
      const h = this.openFiles[handle];
      if (!h) throw new Error(`Handle #${handle} is not open`);
      if (!(h.mode === 'OUTPUT' || h.mode === 'APPEND')) throw new Error('PRINT# requires OUTPUT/APPEND mode');
      const values = this._parseCommaExprList(argsStr);
      const text = this._formatPrint(values, '\t');
      // BASIC PRINT usually ends with newline; follow that
      h.bufferOut = h.bufferOut || [];
      h.bufferOut.push(text);
      // Write-through on each PRINT for simplicity
      this.vfs.writeData(h.filename, h.bufferOut.join('\n'));
    }

    _lineInputFromFile(handle, varName){
      const h = this.openFiles[handle];
      if (!h) throw new Error(`Handle #${handle} is not open`);
      if (h.mode !== 'INPUT') throw new Error('LINE INPUT# requires INPUT mode');
      const buf = h.bufferIn || [];
      if (h.position >= buf.length){ this._assignVariable(varName, ''); return; }
      const line = buf[h.position++] + '';
      this._assignVariable(varName, line);
    }

    _inputFromFile(handle, varsPart){
      const h = this.openFiles[handle];
      if (!h) throw new Error(`Handle #${handle} is not open`);
      if (h.mode !== 'INPUT') throw new Error('INPUT# requires INPUT mode');
      // For simplicity, treat like LINE INPUT and then split by commas for multiple vars
      const vars = varsPart.split(',').map(s=>s.trim()).filter(Boolean);
      const buf = h.bufferIn || [];
      if (h.position >= buf.length){ vars.forEach(vn=>this._assignVariable(vn, '')); return; }
      const line = buf[h.position++] + '';
      if (vars.length <= 1){ this._assignVariable(vars[0], line); return; }
      const parts = line.split(',');
      for (let i=0;i<vars.length;i++){
        const vn = vars[i];
        const val = (i < parts.length) ? parts[i].trim() : '';
        this._assignVariable(vn, val);
      }
    }

    _execClose(stmt){
      // CLOSE or CLOSE #n
      const m = stmt.match(/^CLOSE\s*(?:#\s*(\d+))?\s*$/i);
      if (!m) throw new Error('Invalid CLOSE syntax');
      const h = m[1] != null ? (parseInt(m[1],10)|0) : null;
      if (h == null){
        for (const k of Object.keys(this.openFiles)) this._closeHandle(parseInt(k,10));
      } else {
        this._closeHandle(h);
      }
    }

    _closeHandle(handle){
      const h = this.openFiles[handle];
      if (!h) return;
      if (h.mode === 'OUTPUT' || h.mode === 'APPEND'){
        const text = (h.bufferOut || []).join('\n');
        this.vfs && this.vfs.writeData(h.filename, text);
      }
      delete this.openFiles[handle];
    }

    // Built-in function support (EOF, LEN, INT, STR)
    _callFuncBuiltIn(name, args){
      const upper = String(name).toUpperCase();
      switch (upper){
        // --- File I/O helpers ---
        case 'EOF': {
          if (!args || args.length < 1) return true;
          const fileNo = Number(args[0]);
          const h = this.openFiles[fileNo|0];
          if (!h) return true;
          if (h.mode === 'INPUT'){
            const buf = h.bufferIn || [];
            return (h.position >= buf.length);
          }
          return true;
        }
        // --- Core string functions ---
        case 'LEN': return (args && args.length) ? String(args[0]).length : 0;
        case 'INT': return (args && args.length) ? (parseInt(args[0],10)|0) : 0;
        case 'STR': return (args && args.length) ? String(args[0]) : '';
        case 'MID$':
        case 'MID': {
          const s = String(args && args[0] != null ? args[0] : '');
          const start = Number(args && args[1] != null ? args[1] : 1) | 0; // 1-based
          const count = (args && args.length >= 3) ? (Number(args[2])|0) : (s.length - (start-1));
          if (start <= 0) return '';
          const i0 = (start - 1);
          if (i0 >= s.length) return '';
          return s.substr(i0, Math.max(0, count));
        }
        case 'LEFT$':
        case 'LEFT': {
          const s = String(args && args[0] != null ? args[0] : '');
          const n = Math.max(0, Number(args && args[1] != null ? args[1] : 0) | 0);
          return s.substr(0, n);
        }
        case 'RIGHT$':
        case 'RIGHT': {
          const s = String(args && args[0] != null ? args[0] : '');
          const n = Math.max(0, Number(args && args[1] != null ? args[1] : 0) | 0);
          if (n <= 0) return '';
          return s.substr(Math.max(0, s.length - n), n);
        }
        case 'UCASE$':
        case 'UCASE': return String(args && args[0] != null ? args[0] : '').toUpperCase();
        case 'LCASE$':
        case 'LCASE': return String(args && args[0] != null ? args[0] : '').toLowerCase();
        case 'INSTR': {
          // INSTR(haystack, needle) -> 1-based position or 0 if not found
          const hay = String(args && args[0] != null ? args[0] : '');
          const nee = String(args && args[1] != null ? args[1] : '');
          const pos = hay.indexOf(nee);
          return pos >= 0 ? (pos + 1) : 0;
        }
        // --- Math functions ---
        case 'ABS': return Math.abs(Number(args && args[0] != null ? args[0] : 0));
        case 'ATN':
        case 'ATAN': return Math.atan(Number(args && args[0] != null ? args[0] : 0));
        case 'COS': return Math.cos(Number(args && args[0] != null ? args[0] : 0));
        case 'EXP': return Math.exp(Number(args && args[0] != null ? args[0] : 0));
        case 'LOG': return Math.log(Number(args && args[0] != null ? args[0] : 0));
        case 'RND': {
          // RND(): 0..1; RND(n): integer 1..n if n>0, 0 if n==0, -1..-n if n<0 (classic variants)
          if (!args || args.length === 0) return Math.random();
          const n = Number(args[0])|0;
          if (n === 0) return 0;
          if (n > 0) return (Math.floor(Math.random() * n) + 1) | 0;
          const m = Math.abs(n);
          return -((Math.floor(Math.random() * m) + 1) | 0);
        }
        case 'SIN': return Math.sin(Number(args && args[0] != null ? args[0] : 0));
        case 'SQR': return Math.sqrt(Number(args && args[0] != null ? args[0] : 0));
        case 'TAN': return Math.tan(Number(args && args[0] != null ? args[0] : 0));
        // --- PRINT helpers: TAB/AT/SPC return control tokens consumed by _formatPrint ---
        case 'TAB':
        case 'AT': {
          const n = Number(args && args[0] != null ? args[0] : 0) | 0;
          return { __yobasicPrintCtrl: 'TAB', n };
        }
        case 'SPC': {
          const n = Number(args && args[0] != null ? args[0] : 0) | 0;
          return { __yobasicPrintCtrl: 'SPC', n };
        }
        // --- USING$ formatting ---
        case 'USING$':
        case 'USING': {
          const fmt = String(args && args[0] != null ? args[0] : '');
          const rest = (args || []).slice(1);
          return this._usingFormat(fmt, rest);
        }
        case 'READFILE$':
        case 'READFILE': {
          const path = String(args && args[0] != null ? args[0] : '');
          if (typeof this.hostReadFile !== 'function') throw new Error('Host READFILE not available');
          return String(this.hostReadFile(path));
        }
        case 'EXTERN': {
          const name = String(args && args[0] != null ? args[0] : '');
          const rest = (args || []).slice(1).map(a=>String(a));
          if (typeof this.hostExtern !== 'function') throw new Error('Host EXTERN not available');
          const res = this.hostExtern(name, rest);
          return (typeof res === 'string') ? res : '';
        }
        default:
          return undefined; // not a built-in
      }
    }

    _formatPrint(values, defaultSep){
      // Build a string with awareness of TAB/AT/SPC control tokens produced by built-ins
      let out = '';
      let col = 0;
      const isCtrl = v => v && typeof v === 'object' && v.__yobasicPrintCtrl;
      for (let idx = 0; idx < values.length; idx++){
        let v = values[idx];
        if (idx > 0) {
          // Add default separator between arguments, unless next token is absolute AT/TAB to control position
          // We still add separator to keep compatibility with prior behavior
          out += defaultSep;
          col += defaultSep.length;
        }
        if (isCtrl(v)){
          const mode = v.__yobasicPrintCtrl;
          const n = (v.n|0);
          if (mode === 'SPC'){
            const spaces = Math.max(0, n);
            out += ' '.repeat(spaces);
            col += spaces;
          } else if (mode === 'TAB' || mode === 'AT'){
            const target = Math.max(0, n);
            const spaces = Math.max(0, target - col);
            out += ' '.repeat(spaces);
            col += spaces;
          }
          continue;
        }
        const s = this._toString(v);
        out += s;
        col += s.length;
      }
      return out;
    }

    _usingFormat(fmt, values){
      // Minimal printf-like formatter: supports %s, %d, %f with optional width and precision, and %%
      const s = String(fmt);
      let out = '';
      let i = 0;
      let argIdx = 0;
      while (i < s.length){
        const ch = s[i];
        if (ch !== '%'){ out += ch; i++; continue; }
        // '%%' -> '%'
        if (s[i+1] === '%'){ out += '%'; i += 2; continue; }
        i++;
        // flags
        let left = false; let zero = false;
        if (s[i] === '-' ){ left = true; i++; }
        if (s[i] === '0' ){ zero = true; i++; }
        // width
        let widthStr = '';
        while (i < s.length && /[0-9]/.test(s[i])){ widthStr += s[i++]; }
        const width = widthStr ? parseInt(widthStr, 10) : null;
        // precision
        let precision = null;
        if (s[i] === '.'){
          i++;
          let precStr = '';
          while (i < s.length && /[0-9]/.test(s[i])){ precStr += s[i++]; }
          precision = precStr ? parseInt(precStr, 10) : 0;
        }
        const type = s[i++] || 's';
        let val = (argIdx < values.length) ? values[argIdx++] : (type === 's' ? '' : 0);
        let txt = '';
        if (type === 's' || type === 'S'){
          txt = String(val);
          if (precision != null) txt = txt.slice(0, precision);
        } else if (type === 'd' || type === 'i' || type === 'D' || type === 'I'){
          const n = Number(val) | 0;
          txt = String(n);
          if (precision != null) txt = (Math.sign(n) < 0 ? '-' : '') + Math.abs(n).toString().padStart(precision, '0');
        } else if (type === 'f' || type === 'F'){
          const n = Number(val);
          const prec = (precision != null) ? precision : 6;
          txt = Number.isFinite(n) ? n.toFixed(prec) : 'NaN';
        } else {
          // unknown specifier: treat literally
          txt = '%' + (left?'-':'') + (zero?'0':'') + (widthStr||'') + (precision!=null?('.'+precision):'') + type;
        }
        // padding
        if (width != null && width > txt.length){
          const padChar = (zero && !left && (type !== 's' && type !== 'S')) ? '0' : ' ';
          const pad = padChar.repeat(width - txt.length);
          txt = left ? (txt + pad) : (pad + txt);
        }
        out += txt;
      }
      return out;
    }

    _status(){
      const names = Object.keys(this.vars).sort();
      if (names.length === 0){ this.echo('(no variables)'); return; }
      for (const k of names){
        const v = this.vars[k];
        this.echo(`${k} = ${this._toString(v)}`);
      }
    }

    _execIfSingleLine(stmt){
      // IF expr THEN stmt [ELSE stmt]
      const m = stmt.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
      if (!m) throw new Error('Invalid IF syntax');
      const condExpr = m[1];
      let rest = m[2];
      let thenPart = rest;
      let elsePart = null;
      // Find ELSE that is not inside quotes or parentheses
      const split = this._splitElse(thenPart);
      thenPart = split.thenPart;
      elsePart = split.elsePart;
      const cond = this._truthy(this._evalExpression(condExpr));
      if (cond){
        // thenPart can be multiple statements separated by : or ;
        for (const s of this._splitStatements(thenPart)) this._execStatement(s);
      } else if (elsePart != null){
        for (const s of this._splitStatements(elsePart)) this._execStatement(s);
      }
    }

    _execAssignment(text){
      const eq = text.indexOf('=');
      if (eq < 0) throw new Error('Assignment requires =');
      const name = text.slice(0, eq).trim();
      const expr = text.slice(eq + 1);
      const val = this._evalExpression(expr);
      // Array element assignment? e.g., A(1,2) = val
      const m = name.match(/^([A-Za-z_][A-Za-z0-9_\$%]*)\s*\((.*)\)$/);
      if (m){
        const arrName = m[1].toUpperCase();
        const indices = this._parseCommaExprList(m[2]);
        this._dimSet(arrName, indices, val);
        return;
      }
      this._assignVariable(name, val);
    }

    _assignVariable(name, val){
      // Handle suffixes: $ string, % int
      const trimmed = name.trim();
      const upper = trimmed.toUpperCase();
      const assignTo = (obj)=>{
        if (/\$$/.test(trimmed)){
          obj[upper] = String(val);
        } else if (/%$/.test(trimmed)){
          const n = parseInt(val, 10);
          obj[upper] = (Number.isFinite(n) ? n|0 : 0);
        } else {
          obj[upper] = val;
        }
      };
      if (this.callStack && this.callStack.length){
        // Within function/sub: assignment goes to local scope
        assignTo(this.callStack[this.callStack.length - 1].locals);
      } else {
        assignTo(this.vars);
      }
    }

    // --- Parsing utilities ---
    _stripComments(s){
      // Remove //, REM, or ' comments not inside strings. Preserve single-quoted strings when clearly used as literals.
      let i = 0, inS = false, inD = false;
      while (i < s.length){
        const c = s[i];
        if (!inS && !inD){
          // start of //
          if (c === '/' && s[i+1] === '/') return s.slice(0, i);
          // REM comment at line start or after spaces
          if ((i === 0 || /^\s+$/.test(s.slice(0,i))) && (s.slice(i, i+3).toUpperCase() === 'REM')) return s.slice(0, i);
          // Single-quote comment anywhere outside strings unless it looks like a single-quoted string literal context
          if (c === '\''){
            // Determine previous non-space character
            let j = i - 1; while (j >= 0 && /\s/.test(s[j])) j--;
            const prev = j >= 0 ? s[j] : null;
            const looksLikeString = prev === '=' || prev === '(' || prev === '[' || prev === '{' || prev === ',' || prev === ':';
            if (!looksLikeString){
              return s.slice(0, i);
            } else {
              // skip over the single-quoted string literal
              const seg = this._readString(s, i);
              i = seg.end; continue;
            }
          }
        }
        if (c === '"' && !inS){ inD = !inD; i++; continue; }
        if (c === '\'' && !inD){
          // treat as part of a single-quoted string (legacy support) if we got here
          inS = !inS; i++; continue;
        }
        if (c === '\\' && (inD || inS)) { i += 2; continue; }
        i++;
      }
      return s;
    }

    _splitStatements(line){
      const s = String(line);
      const out = [];
      let cur = '';
      let inS = false, inD = false, depth = 0; // depth for parentheses/brackets/braces
      for (let i=0;i<s.length;i++){
        const c = s[i];
        if (c === '"' && !inS){ inD = !inD; cur += c; continue; }
        if (c === '\'' && !inD){ inS = !inS; cur += c; continue; }
        if ((inD || inS) && c === '\\'){ cur += c; if (i+1<s.length) { cur += s[++i]; } continue; }
        if (!inD && !inS){
          if (c === '(' || c === '[' || c === '{') depth++;
          else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth-1);
          else if ((c === ';' || c === ':') && depth === 0){ out.push(cur); cur=''; continue; }
        }
        cur += c;
      }
      if (cur.trim() !== '') out.push(cur);
      return out;
    }

    _splitElse(s){
      let inS=false,inD=false,depth=0;
      for (let i=0;i<s.length;i++){
        const c = s[i];
        if (c==='"' && !inS){ inD=!inD; continue; }
        if (c==='\'' && !inD){ inS=!inS; continue; }
        if ((inD||inS) && c==='\\'){ i++; continue; }
        if (!inD && !inS){
          if (c==='('||c==='['||c==='{') depth++;
          else if (c===')'||c===']'||c==='}') depth=Math.max(0,depth-1);
          else if (depth===0){
            if (s.slice(i).toUpperCase().startsWith(' ELSE ')){
              return { thenPart: s.slice(0,i).trim(), elsePart: s.slice(i+6).trim() };
            }
            if (s.slice(i).toUpperCase() === ' ELSE'){ // end-of-line ELSE
              return { thenPart: s.slice(0,i).trim(), elsePart: '' };
            }
          }
        }
      }
      return { thenPart: s.trim(), elsePart: null };
    }

    _parseCommaExprList(text){
      const parts = [];
      let cur=''; let inS=false, inD=false, depth=0;
      const s = text.trim();
      if (!s) return [];
      for (let i=0;i<s.length;i++){
        const c = s[i];
        if (c==='"' && !inS){ inD=!inD; cur+=c; continue; }
        if (c==='\'' && !inD){ inS=!inS; cur+=c; continue; }
        if ((inD||inS) && c==='\\'){ cur+=c; if (i+1<s.length){ cur+=s[++i]; } continue; }
        if (!inD && !inS){
          if (c==='('||c==='['||c==='{') depth++;
          else if (c===')'||c===']'||c==='}') depth=Math.max(0,depth-1);
          else if (c===',' && depth===0){ parts.push(cur.trim()); cur=''; continue; }
        }
        cur+=c;
      }
      if (cur.trim()!=='') parts.push(cur.trim());
      return parts.map(e=>this._evalExpression(e));
    }

    // --- Expression evaluation ---
    _evalExpression(exprText){
      const expr = String(exprText).trim();
      if (expr === '') return undefined;
      // Build JS code by tokenizing and mapping identifiers to getters, operators to JS equivalents
      const ctx = this;

      // First, rewrite double-quoted strings with interpolation into concatenations
      const interpolated = this._rewriteInterpolatedStrings(expr);

      // Tokenize identifiers to wrap in __get()
      const jsExpr = this._rewriteToJs(interpolated);

      try{
        const fn = new Function('__get', '__call', '__callDot', 'Math', `"use strict"; return ( ${jsExpr} );`);
        const val = fn(
          (name)=>ctx._getVar(name),
          (name, args)=>ctx._callFunc(name, args),
          (mod, member, a)=>ctx._callFuncDot(mod, member, a),
          Math
        );
        return val;
      }catch(e){
        throw new Error('Expression error: ' + (e && e.message ? e.message : String(e)) + ` in: ${expr}`);
      }
    }

    _rewriteInterpolatedStrings(s){
      // Convert "Hello #{name} and #{1+2}" to "Hello " + (name) + " and " + (1+2)
      // Important: do NOT call _rewriteToJs here; the whole result will be
      // passed to _rewriteToJs afterwards. This avoids double-rewriting.
      let out = '';
      let i = 0;
      while (i < s.length){
        const c = s[i];
        if (c === '"'){
          // Read a double-quoted string with interpolation support
          i++; // skip opening quote
          let buf = '';
          let closed = false;
          while (i < s.length){
            const ch = s[i];
            if (ch === '\\'){
              // keep escape as-is (including escaped quotes)
              if (i + 1 < s.length){ buf += ch + s[i+1]; i += 2; }
              else { buf += ch; i++; }
              continue;
            }
            if (ch === '"'){
              // end of string
              i++; closed = true; break;
            }
            if (ch === '#' && s[i+1] === '{'){
              // interpolation start
              // flush current literal part as a quoted string
              out += '"' + buf + '" + (';
              buf = '';
              i += 2; // skip #{
              // read balanced {...}
              let depth = 1; let inner = '';
              while (i < s.length && depth > 0){
                const ch2 = s[i];
                if (ch2 === '{'){ depth++; inner += ch2; i++; }
                else if (ch2 === '}'){ depth--; if (depth > 0) inner += ch2; i++; }
                else { inner += ch2; i++; }
              }
              // append inner expression as-is; rewriting happens later
              out += inner + ') + ';
              continue;
            }
            buf += ch; i++;
          }
          if (!closed){
            throw new Error('Unterminated string literal');
          }
          // append the remainder of the string content
          out += '"' + buf + '"';
          continue;
        }
        // Single-quoted strings pass through untouched (no interpolation)
        if (c === '\''){
          const { value, end, quote } = this._readString(s, i);
          out += quote + value + quote;
          i = end;
          continue;
        }
        out += c;
        i++;
      }
      return out;
    }

    _rewriteToJs(s){
      // Map BASIC tokens to JS:
      // TRUE->true, FALSE->false, NULL->null
      // '=' in comparisons should become '==' unless already '==' or part of assignment (not in expressions we build)
      // '<>' -> '!='
      // AND, OR, NOT -> &&, ||, !
      // Identifiers -> __get("NAME")
      // Function calls foo(a,b) -> __call("FOO", [a,b])
      let i=0, out='';
      // Preprocess: replace BASIC-style #<digits> in function args (e.g., EOF(#1)) with just the number
      s = s.replace(/#\s*(\d+)/g, '$1');
      const isIdentStart = c => /[A-Za-z_]/.test(c);
      const isIdent = c => /[A-Za-z0-9_\$%]/.test(c);
      const isSpace = c => /\s/.test(c);
      while (i < s.length){
        const c = s[i];
        // strings (single or double) should pass through; double quotes were already handled but keep safe
        if (c==='"' || c==='\''){
          const {value, end, quote} = this._readString(s, i);
          out += quote + value.replace(/\\/g,'\\\\').replace(new RegExp(quote,'g'),'\\'+quote) + quote;
          i = end;
          continue;
        }
        if (c==='/' && s[i+1]==='/'){ // line comment in expressions
          break;
        }
        if (isSpace(c)) { out += c; i++; continue; }

        // Operators and special two-char tokens
        const two = s.slice(i,i+2);
        if (two === '<>'){ out += '!='; i+=2; continue; }
        if (two === '=='){ out += '=='; i+=2; continue; }
        if (two === '>='){ out += '>='; i+=2; continue; }
        if (two === '<='){ out += '<='; i+=2; continue; }
        if (two === '&&' || two === '||' || two === '++' || two==='--'){ out += two; i+=2; continue; }

        // single '=' should be '==' in comparisons (handled here to avoid touching strings)
        if (c === '='){ out += '=='; i++; continue; }
        // single char operators
        if ('+-*/%^()[]{}.,?:<>'.includes(c)){
          if (c === '^'){ out += '**'; i++; continue; }
          out += c; i++; continue;
        }

        if (isIdentStart(c)){
          // read identifier or keyword
          let j=i+1;
          while (j < s.length && isIdent(s[j])) j++;
          const raw = s.slice(i,j);
          const upper = raw.toUpperCase();
          // Keywords mapping
          if (upper === 'TRUE'){ out += 'true'; i=j; continue; }
          if (upper === 'FALSE'){ out += 'false'; i=j; continue; }
          if (upper === 'NULL' || upper === 'NIL' || upper === 'NONE'){ out += 'null'; i=j; continue; }
          if (upper === 'AND'){ out += '&&'; i=j; continue; }
          if (upper === 'OR'){ out += '||'; i=j; continue; }
          if (upper === 'NOT'){ out += '!'; i=j; continue; }

          // Function call or variable or dotted call?
          // Lookahead for optional whitespace then '(' or dotted member
          let k=j; while (k<s.length && /\s/.test(s[k])) k++;
          if (s[k] === '('){
            // Simple function call: IDENT(...)
            out += `__call("${upper}",`;
            i = k+1;
            // copy args until matching ')'
            let depth=1; let argStr='';
            while (i < s.length && depth>0){
              const ch = s[i];
              if (ch==='"' || ch==='\''){
                const {end} = this._readString(s, i);
                argStr += s.slice(i, end);
                i = end;
                continue;
              }
              if (ch==='(') { depth++; argStr += ch; i++; continue; }
              if (ch===')') { depth--; if (depth>0) argStr += ch; i++; continue; }
              argStr += ch; i++;
            }
            const rewrittenArgs = this._rewriteToJs(argStr);
            out += '[' + rewrittenArgs + '])';
            continue;
          } else if (s[k] === '.'){
            // Dotted module call: IDENT.MEMBER(...)
            let k2 = k + 1;
            while (k2<s.length && /\s/.test(s[k2])) k2++;
            // read member identifier
            let mStart = k2;
            while (k2 < s.length && /[A-Za-z0-9_\$%]/.test(s[k2])) k2++;
            const memberRaw = s.slice(mStart, k2);
            const memberUpper = memberRaw.toUpperCase();
            // skip whitespace before '('
            while (k2<s.length && /\s/.test(s[k2])) k2++;
            if (s[k2] === '('){
              // Parse argument list for dotted call IDENT.MEMBER(...)
              i = k2 + 1;
              let depth=1; let argStr='';
              while (i < s.length && depth>0){
                const ch = s[i];
                if (ch==='"' || ch==='\''){
                  const {end} = this._readString(s, i);
                  argStr += s.slice(i, end);
                  i = end;
                  continue;
                }
                if (ch==='(') { depth++; argStr += ch; i++; continue; }
                if (ch===')') { depth--; if (depth>0) argStr += ch; i++; continue; }
                argStr += ch; i++;
              }
              const rewrittenArgs = this._rewriteToJs(argStr);
              out += `__callDot("${upper}","${memberUpper}",[${rewrittenArgs}])`;
              continue;
            } else {
              // Dot without call; fall back to variable token for IDENT
              out += `__get("${upper}")`;
              i = j;
              continue;
            }
          } else {
            // Variable
            out += `__get("${upper}")`;
            i=j;
            continue;
          }
        }

        // default: copy
        out += c; i++;
      }

      return out;
    }

    _readString(s, start){
      const quote = s[start];
      let i = start + 1;
      let val = '';
      while (i < s.length){
        const c = s[i];
        if (c === '\\'){
          if (i+1 < s.length){ val += c + s[i+1]; i += 2; continue; }
          else { i++; break; }
        }
        if (c === quote){ i++; break; }
        val += c; i++;
      }
      return { value: val, end: i, quote };
    }

    _toString(v){
      if (v === null) return 'NULL';
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (typeof v === 'undefined') return '';
      if (Array.isArray(v)) return JSON.stringify(v);
      if (typeof v === 'object'){
        try { return JSON.stringify(v); } catch(_){ return String(v); }
      }
      return String(v);
    }

    _truthy(v){
      return !!v;
    }

    _getVar(name){
      const key = String(name).toUpperCase();
      // Prefer function-local scope if present
      if (this.callStack && this.callStack.length){
        const frame = this.callStack[this.callStack.length - 1];
        if (frame && Object.prototype.hasOwnProperty.call(frame.locals, key)) return frame.locals[key];
      }
      if (Object.prototype.hasOwnProperty.call(this.vars, key)) return this.vars[key];
      // Undefined variables default to null
      return null;
    }

    _callFunc(name, args){
      const upper = String(name).toUpperCase();
      // 1) DIM array indexing like A(i, j)
      const varVal = this._getVar(upper);
      if (varVal && typeof varVal === 'object' && varVal.__dim){
        return this._dimGet(upper, args);
      }
      // 2) User-defined function/sub
      if (Object.prototype.hasOwnProperty.call(this.funcs, upper)){
        return this._callUserFunction(upper, args || []);
      }
      // 3) Built-ins
      const bi = this._callFuncBuiltIn(upper, args || []);
      if (typeof bi !== 'undefined') return bi;
      throw new Error(`Unknown function: ${name}`);
    }

    _callFuncDot(moduleName, memberName, args){
      // Dotted call dispatch: moduleName.memberName(args)
      if (typeof this.hostCallModule === 'function'){
        return this.hostCallModule(String(moduleName), String(memberName), args || []);
      }
      throw new Error(`Unknown module: ${moduleName}`);
    }

    // --- Helpers for control structures ---
    _lineTrim(lines, idx){
      if (idx < 0 || idx >= lines.length) return '';
      return this._stripComments(lines[idx]).trim();
    }

    _findMatchingWend(lines, startIdx){
      // startIdx points to a WHILE line
      const stack = ['WHILE'];
      for (let i = startIdx + 1; i < lines.length; i++){
        const u = this._lineTrim(lines, i).toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) {
          for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'WHILE'){ stack.splice(k,1); break; } }
          if (stack.length === 0) return i;
          continue;
        }
        if (/^LOOP\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'FOR' || stack[k] === 'FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'FUNC'){ stack.splice(k,1); break; } } continue; }
        if (/^END\b/.test(u)) {
          const popped = stack.pop();
          if (stack.length === 0 && popped === 'WHILE') return i;
          continue;
        }
      }
      throw new Error(`Unterminated WHILE (no matching END/WEND) starting at line ${startIdx+1}`);
    }

    _findEndSelect(lines, startIdx){
      // startIdx points to SELECT CASE
      const stack = ['SELECT'];
      for (let i = startIdx + 1; i < lines.length; i++){
        const u = this._lineTrim(lines, i).toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) {
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } }
          if (stack.length === 0) return i;
          continue;
        }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } } continue; }
        if (/^END\b/.test(u)) { const popped = stack.pop(); if (stack.length===0 && popped==='SELECT') return i; continue; }
      }
      throw new Error(`Unterminated SELECT CASE (no matching END/END SELECT) starting at line ${startIdx+1}`);
    }

    _findTopLevelCases(lines, fromIdx, endIdx){
      // Scan [fromIdx, endIdx) for CASE lines at top-level of this SELECT
      const cases = [];
      const stack = []; // track nested blocks to ignore CASE inside nested SELECTs
      for (let i = fromIdx; i < endIdx; i++){
        const t = this._lineTrim(lines, i);
        const u = t.toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } } continue; }
        if (/^END\b/.test(u)) { stack.pop(); continue; }
        // CASE at top-level only
        if (stack.length === 0 && /^CASE\b/i.test(t)){
          const isElse = /^CASE\s+ELSE\b/i.test(t);
          cases.push({ index: i, text: t, isElse });
        }
      }
      return cases;
    }

    _parseCaseExprList(text){
      const s = String(text).trim();
      if (!s) return [];
      if (/^ELSE\b/i.test(s)) return [];
      const parts = [];
      let cur = '';
      let inS=false, inD=false, depth=0;
      for (let i=0;i<s.length;i++){
        const c = s[i];
        if (c==='"' && !inS){ inD=!inD; cur+=c; continue; }
        if (c==='\'' && !inD){ inS=!inS; cur+=c; continue; }
        if ((inD||inS) && c==='\\'){ cur+=c; if (i+1<s.length){ cur+=s[++i]; } continue; }
        if (!inD && !inS){
          if (c==='('||c==='['||c==='{') depth++;
          else if (c===')'||c===']'||c==='}') depth=Math.max(0,depth-1);
          else if (c===',' && depth===0){ parts.push(cur.trim()); cur=''; continue; }
        }
        cur+=c;
      }
      if (cur.trim()!=='') parts.push(cur.trim());
      return parts;
    }

    // IF helpers
    _parseIfCondFromHeader(header){
      // header is like: IF expr [THEN] [BEGIN]
      let s = String(header).trim();
      s = s.replace(/^IF\b/i, '').trim();
      // Remove optional THEN at end or before BEGIN
      s = s.replace(/\bTHEN\b/i, (m)=>m); // keep then token to strip later precisely
      // Remove trailing BEGIN and/or THEN tokens at end of header
      s = s.replace(/\s+BEGIN\s*$/i, '').replace(/\s+THEN\s*$/i, '').trim();
      // Also handle IF expr THEN BEGIN or IF expr BEGIN THEN (rare): remove any trailing THEN or BEGIN tokens
      s = s.replace(/\s+(BEGIN|THEN)\s*$/i, '').trim();
      return s;
    }

    _findEndIfAndClauses(lines, startIdx){
      // Returns { end, clauses: [{type:'IF'|'ELSEIF'|'ELSE', start, after}] }
      // where start is the header line index of the clause, and after is the index of the line where that clause body ends (just before next clause or end)
      const clauses = [];
      const stack = ['IF'];
      let end = -1;
      // Track the most recent clause header to set its 'after' when next clause or end is found
      let lastClause = { type: 'IF', start: startIdx, after: null };
      clauses.push(lastClause);
      for (let i = startIdx + 1; i < lines.length; i++){
        const t = this._lineTrim(lines, i);
        const u = t.toUpperCase();
        if (!u) continue;
        // Openers (for nesting)
        if (/^IF\b/.test(u) && !/^IF\s+(.+?)\s+THEN\s+(?!BEGIN\b).+$/i.test(t)) { stack.push('IF'); continue; }
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^END\s*IF\b/.test(u) || /^ENDIF\b/.test(u)) {
          // Close one IF
          for (let k = stack.length - 1; k >= 0; k--){ if (stack[k] === 'IF'){ stack.splice(k,1); break; } }
          if (stack.length === 0){ end = i; lastClause.after = i; break; }
          continue;
        }
        if (/^END\b/.test(u)){
          const popped = stack.pop();
          if (stack.length === 0 && popped === 'IF'){ end = i; lastClause.after = i; break; }
          continue;
        }
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } } continue; }
        // Top-level clauses inside current IF
        if (stack.length === 1 && stack[0] === 'IF'){
          if (/^ELSEIF\b/i.test(t)){
            lastClause.after = i; // clause body ends before this ELSEIF
            lastClause = { type: 'ELSEIF', start: i, after: null };
            clauses.push(lastClause);
            continue;
          }
          if (/^ELSE\b/i.test(t)){
            lastClause.after = i;
            lastClause = { type: 'ELSE', start: i, after: null };
            clauses.push(lastClause);
            continue;
          }
        }
      }
      if (end < 0) throw new Error(`Unterminated IF (no matching END/END IF/ENDIF) starting at line ${startIdx+1}`);
      return { end, clauses };
    }

    _chooseIfClause(lines, startIdx, endInfo){
      // Evaluate IF/ELSEIF conditions; return chosen clause with its body end boundary (after)
      const clauses = endInfo.clauses;
      for (const c of clauses){
        if (c.type === 'ELSE') {
          // Else wins only if no previous matched
          // If ELSE, execute unconditionally
          return { type: 'ELSE', start: c.start, after: (c.after != null ? c.after : endInfo.end) };
        }
        // Parse condition from header line
        let header = this._lineTrim(lines, c.start);
        if (/^IF\b/i.test(header) || /^ELSEIF\b/i.test(header)){
          // Remove keyword
          header = header.replace(/^ELSEIF\b/i, 'IF');
          const exprText = this._parseIfCondFromHeader(header);
          const cond = this._truthy(this._evalExpression(exprText));
          if (cond){
            return { type: c.type, start: c.start, after: c.after ?? endInfo.end };
          }
        }
      }
      // No match, no ELSE
      return null;
    }

    _parseCasePatterns(text){
      // Returns array of pattern objects: {type:'value', expr}, {type:'range', lo, hi}, {type:'cmp', op, expr}
      const s = String(text).trim();
      if (!s) return [];
      if (/^ELSE\b/i.test(s)) return [];
      // Split by commas respecting nesting and quotes
      const parts = [];
      let cur=''; let inS=false, inD=false, depth=0;
      for (let i=0;i<s.length;i++){
        const c = s[i];
        if (c==='"' && !inS){ inD=!inD; cur+=c; continue; }
        if (c==='\'' && !inD){ inS=!inS; cur+=c; continue; }
        if ((inD||inS) && c==='\\'){ cur+=c; if (i+1<s.length){ cur+=s[++i]; } continue; }
        if (!inD && !inS){
          if (c==='('||c==='['||c==='{') depth++;
          else if (c===')'||c===']'||c==='}') depth=Math.max(0,depth-1);
          else if (c===',' && depth===0){ parts.push(cur.trim()); cur=''; continue; }
        }
        cur+=c;
      }
      if (cur.trim()!=='') parts.push(cur.trim());

      const patterns = [];
      const findTopLevelToken = (str, token)=>{
        let inS=false, inD=false, depth=0; const T = token.toUpperCase();
        for (let i=0;i<str.length;i++){
          const c = str[i];
          if (c==='"' && !inS){ inD=!inD; continue; }
          if (c==='\'' && !inD){ inS=!inS; continue; }
          if ((inD||inS) && c==='\\'){ i++; continue; }
          if (!inD && !inS){
            if (c==='('||c==='['||c==='{') depth++;
            else if (c===')'||c===']'||c==='}') depth=Math.max(0,depth-1);
            else if (depth===0){
              if (str.slice(i, i+T.length).toUpperCase() === T) return i;
            }
          }
        }
        return -1;
      };

      for (let p of parts){
        if (!p) continue;
        // CASE IS <op> expr
        const mIs = p.match(/^IS\s*(=|<>|<=|>=|<|>)\s*(.+)$/i);
        if (mIs){ patterns.push({ type:'cmp', op:mIs[1], expr: mIs[2].trim() }); continue; }
        // CASE value1 TO value2 (top-level TO)
        const toIdx = findTopLevelToken(p, 'TO');
        if (toIdx > -1){
          const lo = p.slice(0, toIdx).trim();
          const hi = p.slice(toIdx + 2).trim();
          if (!lo || !hi) throw new Error('Invalid CASE range pattern');
          patterns.push({ type:'range', lo, hi });
          continue;
        }
        // Otherwise simple value
        patterns.push({ type:'value', expr: p });
      }
      return patterns;
    }

    _casePatternMatches(selector, pat){
      switch (pat.type){
        case 'value': {
          const val = this._evalExpression(pat.expr);
          return this._equal(selector, val);
        }
        case 'range': {
          const lo = this._evalExpression(pat.lo);
          const hi = this._evalExpression(pat.hi);
          // Numeric if possible, else string comparison
          const an = Number(selector), ln = Number(lo), hn = Number(hi);
          if (Number.isFinite(an) && Number.isFinite(ln) && Number.isFinite(hn)){
            return an >= ln && an <= hn;
          }
          const s = String(selector), slo = String(lo), shi = String(hi);
          return s >= slo && s <= shi;
        }
        case 'cmp': {
          const right = this._evalExpression(pat.expr);
          return this._cmp(selector, pat.op, right);
        }
        default: return false;
      }
    }

    _cmp(a, op, b){
      // Support =, <>, <, <=, >, >= with numeric-preferred comparison
      if (op === '=' || op === '==') return this._equal(a,b);
      if (op === '<>') return !this._equal(a,b);
      const an = Number(a), bn = Number(b);
      if (Number.isFinite(an) && Number.isFinite(bn)){
        switch (op){
          case '<': return an < bn;
          case '<=': return an <= bn;
          case '>': return an > bn;
          case '>=': return an >= bn;
          default: return false;
        }
      } else {
        const sa = String(a), sb = String(b);
        switch (op){
          case '<': return sa < sb;
          case '<=': return sa <= sb;
          case '>': return sa > sb;
          case '>=': return sa >= sb;
          default: return false;
        }
      }
    }

    _findMatchingLoop(lines, startIdx){
      // startIdx points to a DO line
      const stack = ['DO'];
      for (let i = startIdx + 1; i < lines.length; i++){
        const u = this._lineTrim(lines, i).toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) {
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } }
          if (stack.length === 0) return i;
          continue;
        }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { stack.pop(); if (stack.length===0) return i; continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { stack.pop(); if (stack.length===0) return i; continue; }
        if (/^END\b/.test(u)) { const popped = stack.pop(); if (stack.length===0 && popped==='DO') return i; continue; }
      }
      throw new Error(`Unterminated DO (no matching END/LOOP) starting at line ${startIdx+1}`);
    }

    _findMatchingNext(lines, startIdx){
      // startIdx points to a FOR or FOREACH line
      const first = this._lineTrim(lines, startIdx).toUpperCase().startsWith('FOREACH') ? 'FOREACH' : 'FOR';
      const stack = [first];
      for (let i = startIdx + 1; i < lines.length; i++){
        const u = this._lineTrim(lines, i).toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) {
          // closes FOR or FOREACH
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ const popped=stack.splice(k,1)[0]; if (stack.length===0 && popped===first) return i; break; } }
          continue;
        }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } } continue; }
        if (/^END\b/.test(u)) { const popped = stack.pop(); if (stack.length===0 && popped===first) return i; continue; }
      }
      throw new Error(`Unterminated loop (no matching END/NEXT) starting at line ${startIdx+1}`);
    }

    // --- Phase 3 helpers ---
    _findEndFuncOrSub(lines, startIdx){
      // startIdx points to a FUNC/FUNCTION or SUB line
      const openerLine = this._lineTrim(lines, startIdx).toUpperCase();
      const opener = openerLine.startsWith('SUB') ? 'SUB' : 'FUNC';
      const stack = [opener];
      for (let i = startIdx + 1; i < lines.length; i++){
        const u = this._lineTrim(lines, i).toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SUB\b/.test(u)) {
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } }
          if (stack.length === 0 && opener === 'SUB') return i;
          continue;
        }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) {
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } }
          if (stack.length === 0 && opener === 'FUNC') return i;
          continue;
        }
        if (/^END\b/.test(u)) {
          const popped = stack.pop();
          if (stack.length === 0 && popped === opener) return i;
          continue;
        }
      }
      throw new Error(`Unterminated ${opener} (no matching END) starting at line ${startIdx+1}`);
    }

    _prepass(lines){
      // Allow function-local runs to bypass scanning and use provided labels
      if (this._unitLabels){
        this.labels = Object.assign(Object.create(null), this._unitLabels);
        return;
      }
      // Reset tables
      this.labels = Object.create(null);
      this.funcs = this.funcs || Object.create(null);
      // Scan top-level for LABEL and FUNC/SUB
      let i = 0;
      while (i < lines.length){
        const t = this._lineTrim(lines, i);
        if (!t){ i++; continue; }
        const u = t.toUpperCase();
        // Ignore DECLARE lines (forward declarations)
        if (/^DECLARE\b/i.test(u)) { i++; continue; }
        // Top-level labels
        const mLab = t.match(/^LABEL\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
        if (mLab){
          const name = mLab[1].toUpperCase();
          if (Object.prototype.hasOwnProperty.call(this.labels, name)){
            throw new Error(`Duplicate label ${name} at line ${i+1}`);
          }
          this.labels[name] = i;
          i++; continue;
        }
        // FUNC/FUNCTION/SUB declarations
        if (/^(FUNC|FUNCTION)\b/i.test(u) || /^SUB\b/i.test(u)){
          const m = t.match(/^(FUNC|FUNCTION|SUB)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)\s*(?:BEGIN\s*)?$/i);
          if (!m) throw new Error(`Invalid ${t.split(/\s+/)[0]} declaration at line ${i+1}`);
          const kind = m[1].toUpperCase().replace('FUNCTION','FUNC');
          const name = m[2].toUpperCase();
          const params = m[3].trim() ? m[3].split(',').map(s=>s.trim()) : [];
          if (Object.prototype.hasOwnProperty.call(this.funcs, name)){
            throw new Error(`Duplicate function/sub name ${name} at line ${i+1}`);
          }
          const endIdx = this._findEndFuncOrSub(lines, i);
          // Collect labels within body
          const labels = Object.create(null);
          for (let j=i+1;j<endIdx;j++){
            const tj = this._lineTrim(lines, j);
            const ml = tj.match(/^LABEL\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
            if (ml){
              const lname = ml[1].toUpperCase();
              if (Object.prototype.hasOwnProperty.call(labels, lname)){
                throw new Error(`Duplicate label ${lname} in ${name} at line ${j+1}`);
              }
              // Map to body-relative index (0-based for body array)
              labels[lname] = j - (i + 1);
            }
          }
          const body = lines.slice(i+1, endIdx);
          this.funcs[name] = { name, params, isSub: kind === 'SUB', start: i, end: endIdx, labels, body };
          i = endIdx + 1; continue;
        }
        i++;
      }
    }

    _findTryBlock(lines, startIdx){
      // startIdx at TRY (optionally 'TRY BEGIN')
      const stack = ['TRY'];
      let catchIdx = null, finallyIdx = null, endIdx = null, catchVar = null;
      for (let i = startIdx + 1; i < lines.length; i++){
        const t = this._lineTrim(lines, i);
        const u = t.toUpperCase();
        if (!u) continue;
        // Openers
        if (/^WHILE\b/.test(u)) { stack.push('WHILE'); continue; }
        if (/^DO\b/.test(u)) { stack.push('DO'); continue; }
        if (/^FOR\b/.test(u)) { stack.push('FOR'); continue; }
        if (/^FOREACH\b/.test(u)) { stack.push('FOREACH'); continue; }
        if (/^SELECT\s+CASE\b/.test(u)) { stack.push('SELECT'); continue; }
        if (/^TRY\b/.test(u)) { stack.push('TRY'); continue; }
        if (/^(FUNC|FUNCTION)\b/.test(u)) { stack.push('FUNC'); continue; }
        if (/^SUB\b/.test(u)) { stack.push('SUB'); continue; }
        // Closers
        if (/^WEND\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='WHILE'){ stack.splice(k,1); break; } } continue; }
        if (/^LOOP\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='DO'){ stack.splice(k,1); break; } } continue; }
        if (/^NEXT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FOR' || stack[k]==='FOREACH'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+SELECT\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SELECT'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+TRY\b/.test(u)) {
          for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='TRY'){ stack.splice(k,1); break; } }
          if (stack.length === 0) { endIdx = i; break; }
          continue;
        }
        if (/^END\s+SUB\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='SUB'){ stack.splice(k,1); break; } } continue; }
        if (/^END\s+(FUNC|FUNCTION)\b/.test(u)) { for (let k=stack.length-1;k>=0;k--){ if (stack[k]==='FUNC'){ stack.splice(k,1); break; } } continue; }
        if (/^END\b/.test(u)) { const popped = stack.pop(); if (stack.length===0 && popped==='TRY'){ endIdx = i; break; } continue; }
        // Depth-1 markers
        if (stack.length === 1 && stack[0] === 'TRY'){
          if (/^CATCH\b/.test(u)){
            if (catchIdx == null){
              catchIdx = i;
              const m = t.match(/^CATCH\s+([A-Za-z_][A-Za-z0-9_\$%]*)\s*$/i);
              if (m) catchVar = m[1].toUpperCase();
            }
            continue;
          }
          if (/^FINALLY\b/.test(u)){
            if (finallyIdx == null) finallyIdx = i;
            continue;
          }
        }
      }
      if (endIdx == null) throw new Error(`Unterminated TRY (no matching END/END TRY) starting at line ${startIdx+1}`);
      return { catchIdx, catchVar, finallyIdx, endIdx };
    }

    _foreachAssign(frame){
      const { mode, iter, idx, src, var1, var2 } = frame;
      if (mode === 'ARRAY'){
        const i = iter[idx];
        const val = Array.isArray(src) ? src[i] : null;
        this._assignVariable(var1, val);
        if (var2){ this._assignVariable(var2, val); }
      } else if (mode === 'OBJECT'){
        const key = iter[idx];
        const val = src ? src[key] : null;
        if (var2){ this._assignVariable(var1, key); this._assignVariable(var2, val); }
        else { this._assignVariable(var1, val); }
      } else if (mode === 'DIM'){
        const pos1 = iter[idx]; // 1-based linear position
        const val = this._dimGetLinear(src, pos1);
        this._assignVariable(var1, val);
        if (var2){ this._assignVariable(var2, pos1); }
      }
    }

    // DIM arrays
    _execDim(stmt){
      // DIM A(10), M(3,4)
      const rest = stmt.replace(/^DIM\b/i, '').trim();
      if (!rest) throw new Error('DIM requires declarations');
      // Split by commas at top-level
      let parts = [];
      let cur='', inS=false, inD=false, depth=0; const s=rest;
      for (let i=0;i<s.length;i++){
        const c=s[i];
        if (c==='"' && !inS){ inD=!inD; cur+=c; continue; }
        if (c==='\'' && !inD){ inS=!inS; cur+=c; continue; }
        if ((inD||inS) && c==='\\'){ cur+=c; if (i+1<s.length){ cur+=s[++i]; } continue; }
        if (!inD && !inS){
          if (c==='(') depth++;
          else if (c===')') depth=Math.max(0,depth-1);
          else if (c===',' && depth===0){ parts.push(cur.trim()); cur=''; continue; }
        }
        cur+=c;
      }
      if (cur.trim()!=='') parts.push(cur.trim());
      for (const p of parts){
        const m = p.match(/^([A-Za-z_][A-Za-z0-9_\$%]*)\s*\((.*)\)\s*$/);
        if (!m) throw new Error('Invalid DIM declaration: ' + p);
        const nameRaw = m[1];
        const name = nameRaw.toUpperCase();
        const boundsText = m[2].trim();
        if (!boundsText) throw new Error('DIM requires bounds for ' + name);
        const boundExprs = this._parseCommaExprList(boundsText); // evaluated
        const dims = boundExprs.map(v=>Number(v));
        if (!dims.length || dims.some(d=>!Number.isFinite(d) || d <= 0)) throw new Error('DIM bounds must be positive integers for ' + name);
        const total = dims.reduce((a,b)=>a * (b|0), 1);
        const isString = /\$$/.test(nameRaw);
        const initVal = isString ? '' : 0;
        const data = new Array(total);
        for (let i=0;i<total;i++) data[i] = isString ? '' : 0;
        this.vars[name] = { __dim: true, name, dims: dims.map(d=>d|0), base:1, data, isString };
      }
    }

    _dimIndex(meta, indices){
      if (indices.length !== meta.dims.length) throw new Error('Wrong number of indices for array ' + meta.name);
      let mul = 1; const strides = new Array(meta.dims.length);
      for (let k = meta.dims.length - 1; k >= 0; k--){ strides[k] = mul; mul *= meta.dims[k]; }
      let pos = 0;
      for (let k=0;k<indices.length;k++){
        const idx = Number(indices[k]);
        if (!Number.isFinite(idx)) throw new Error('Non-numeric index for array ' + meta.name);
        const one = (idx|0) - meta.base;
        if (one < 0 || one >= meta.dims[k]) throw new Error('Index out of bounds on ' + meta.name);
        pos += one * strides[k];
      }
      return pos; // 0-based in data
    }

    _dimGet(nameUpper, args){
      const meta = this._getVar(nameUpper);
      if (!meta || !meta.__dim) throw new Error('Not an array: ' + nameUpper);
      if (!args) throw new Error('Missing indices for ' + nameUpper);
      const pos = this._dimIndex(meta, args);
      return meta.data[pos];
    }

    _dimSet(nameUpper, args, value){
      const meta = this._getVar(nameUpper);
      if (!meta || !meta.__dim) throw new Error('Not an array: ' + nameUpper);
      const pos = this._dimIndex(meta, args);
      // Coerce string arrays
      if (meta.isString) meta.data[pos] = String(value);
      else meta.data[pos] = Number.isFinite(Number(value)) ? Number(value) : value;
    }

    _dimGetLinear(meta, oneBasedPos){
      const idx = (oneBasedPos|0) - 1;
      if (idx < 0 || idx >= meta.data.length) throw new Error('Index out of bounds');
      return meta.data[idx];
    }

    // User-defined function/sub invocation
    _callUserFunction(nameUpper, args){
      const f = this.funcs[nameUpper];
      if (!f) throw new Error('Undefined function/sub: ' + nameUpper);
      const arity = f.params.length;
      const given = (args || []).length;
      if (given !== arity) throw new Error(`Arity mismatch for ${f.name}: expected ${arity}, got ${given}`);
      if (!Array.isArray(this._lastProgramLines)) throw new Error('No program loaded for function execution');
      const body = this._lastProgramLines.slice(f.start + 1, f.end);
      const locals = Object.create(null);
      this.callStack.push({ name: f.name, locals });
      // Bind parameters in local scope
      for (let i=0;i<arity;i++){
        this._assignVariable(f.params[i], args[i]);
      }
      // Prepare label mapping for this unit
      const savedUnitLabels = this._unitLabels;
      const savedLines = this._lastProgramLines;
      this._unitLabels = f.labels;
      let retVal = undefined; // default
      try{
        // Execute function body (restore outer program lines after)
        const prevSuppress = this._suppressReset;
        this._suppressReset = true;
        try {
          this.runProgram(body);
        } finally {
          this._suppressReset = prevSuppress;
        }
      }catch(e){
        if (e && e.__ctrl === 'FUNC_RETURN'){
          retVal = e.__ret;
        } else {
          throw e;
        }
      } finally {
        this._unitLabels = savedUnitLabels;
        this._lastProgramLines = savedLines;
        this.callStack.pop();
      }
      // For SUB, ignore return value
      if (f.isSub) return undefined;
      return retVal;
    }

    _equal(a,b){
      // BASIC-like loose equality for case selection
      if (a === b) return true;
      // numeric compare if both numeric-ish
      const an = Number(a), bn = Number(b);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an === bn;
      // string compare
      return String(a) === String(b);
    }
  }

  // Expose
  global.BasicInterpreter = BasicInterpreter;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
