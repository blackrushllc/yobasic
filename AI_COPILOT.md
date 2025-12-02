### What you want to build
An in-IDE AI copilot that can:
- Answer questions about how your BASIC dialect is implemented (grounded in `basic.js`, `README.md`, `KEYWORDS.md`, etc.)
- Generate and fix BASIC code, then optionally run it in your IDE’s interpreter
- Link answers to exact code locations and documentation

Below is a practical, step-by-step plan you can execute incrementally.

---

### High-level architecture
- UI: Chat panel in your web IDE (a right-side drawer/panel, toggleable by a hotkey, e.g., F1/F2)
- Orchestrator: A server route (or a service worker) that handles retrieval + LLM calls
- Knowledge store: Embeddings index over your code and docs (function-level + file-level), e.g., Supabase pgvector
- Tools: Safe functions the model can call: `search_source`, `read_file_snippet`, `open_in_editor`, `run_basic`, `format_basic`, `explain_error`
- Models:
  - Cloud: GPT-4.1/4o or Claude Sonnet/Opus for best code reasoning
  - Local alternative: Llama 3.1 70B/Qwen2.5-Coder via Ollama + local embeddings (for offline/dev)

---

### Grounding: make it "know" your BASIC implementation
To accurately answer questions about `basic.js`, you need Retrieval-Augmented Generation (RAG).

1) Indexing pipeline (one-time then incremental):
- Parse JavaScript symbols from `basic.js` (and other engine files) into an index:
  - Extract functions, classes, methods, and their JSDoc/comments
  - Keep file path + line ranges for each symbol
- Chunking strategy:
  - Code: chunk per symbol (function/method), with a small "neighbor overlap" (e.g., preceding comments + 20–40 lines of context)
  - Long files: also create larger file-level chunks (1–2k tokens) for broader context
  - Docs (`README.md`, `KEYWORDS.md`, tutorial chapters): chunk by heading or ~800–1200 tokens with overlap
- Metadata per chunk:
  - `file_path`, `start_line`, `end_line`, `symbol_name`, `kind` (function/class/doc), `keywords` (e.g., BASIC tokens discussed), `hash`
- Embeddings:
  - Use a code-aware embedding model
  - Store in pgvector (Supabase) with cosine similarity and HNSW/IVFF index

2) Keyword mapping (BASIC tokens → implementation):
- From `KEYWORDS.md`, build a map `{ BASIC_TOKEN: [symbol_names, file_ranges] }`
- Store this as metadata in the vector DB to bias retrieval when user asks, e.g., "How is FOR implemented?"

3) Summaries for fast recall:
- Auto-generate short symbol summaries (1–3 sentences) via the LLM and store them alongside embeddings; use them for list views and as preambles in citations.

---

### Orchestration: how a chat turn works
1) Classification:
- Detect intent: Q&A about implementation, code generation, error explanation, or refactoring

2) Retrieval:
- Convert the user query into a retrieval query
- Add token biases: if the query contains BASIC tokens (FOR, PRINT, INPUT, etc.), retrieve entries tagged with those tokens first
- Fetch top-k chunks (e.g., k=6–10) with score thresholding

3) Answer drafting with citations:
- Build the prompt with:
  - System message: role, style, guardrails (no guessing if not grounded)
  - Retrieved snippets (with file paths + line ranges)
  - User query
- Ask the model to:
  - Quote only the most relevant lines (keep quotes short, <40 lines each)
  - Cite every claim that references implementation details
  - If confidence is low or no relevant context: say so and propose where to look

4) Tool use (optional per turn):
- `search_source` and `read_file_snippet` for deeper dives
- `run_basic` to verify generated examples or reproduce issues
- `open_in_editor` to jump the user to the code region

5) Post-processing:
- Re-rank, compress, and display citations as clickable links that open your editor at `file_path:start_line`

---

### IDE integration (frontend)
- Add a Chat panel component (e.g., a floating drawer on the right):
  - Streaming responses
  - Code blocks with copy buttons
  - Inline citations like `basic.js:123–186`
  - Buttons: "Open in Editor", "Run in Terminal", "Explain This Error"
- Keyboard shortcuts: F1/F2 to toggle chat; Ctrl+Enter to send
- Context menu in editor: "Ask AI about selection" → sends selected code as context

---

### Example: minimal backend pieces

#### 1) Embeddings table (Supabase pgvector)
```sql
create extension if not exists vector;

create table if not exists code_chunks (
  id bigserial primary key,
  file_path text not null,
  symbol_name text,
  kind text check (kind in ('function','class','doc','file')),
  start_line int,
  end_line int,
  content text not null,
  summary text,
  keywords text[],
  hash text unique,
  embedding vector(3072) -- size depends on the embedding model
);

-- HNSW index example (or use IVFFlat depending on your pg version)
create index on code_chunks using hnsw (embedding vector_cosine_ops);
```

#### 2) Indexer sketch (Node.js)
```js
import fs from 'node:fs';
import path from 'node:path';
import { embed } from './embed.js'; // wraps your embedding API
import { parseSymbols } from './parse-js.js'; // use Acorn/TS compiler API
import { upsertChunk } from './db.js'; // inserts into Supabase

const ROOT = 'E:/Projects/yobasic';

async function indexFile(p) {
  const text = fs.readFileSync(p, 'utf8');
  const symbols = parseSymbols(text); // [{name, kind, start, end, docComment}]
  const chunks = [];

  for (const s of symbols) {
    const content = text.slice(s.start.idx, s.end.idx);
    const startLine = s.start.line;
    const endLine = s.end.line;
    const summary = await summarize(content); // optional, via LLM
    const emb = await embed(content + '\n' + (summary ?? ''));
    chunks.push({
      file_path: p,
      symbol_name: s.name,
      kind: s.kind,
      start_line: startLine,
      end_line: endLine,
      content,
      summary,
      keywords: extractBasicTokens(content),
      embedding: emb
    });
  }

  for (const c of chunks) await upsertChunk(c);
}

// Call indexFile('E:/Projects/yobasic/basic.js') and also docs
```

#### 3) Retrieval + chat route (Express)
```js
app.post('/api/chat', async (req, res) => {
  const { messages, toolsPreference } = req.body;
  const question = messages[messages.length - 1].content;

  // Identify BASIC tokens to bias retrieval
  const tokens = findBasicTokens(question);

  const retrieved = await db.search({
    query: await embed(question),
    filterKeywords: tokens,
    topK: 8,
    minScore: 0.65
  });

  const system = `You are YoBASIC Copilot. Ground your answers ONLY in the provided context. If context is insufficient, say so and suggest where to look. Cite sources as (file:lines).`;

  const context = retrieved.map(r => `===\n${r.file_path}:${r.start_line}-${r.end_line}\n${r.content}`).join('\n');

  const tools = [
    { name: 'run_basic', description: 'Run BASIC code in the IDE VM', schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
    { name: 'open_in_editor', description: 'Open file at range', schema: { type: 'object', properties: { file: { type: 'string' }, start: { type: 'number' } }, required: ['file','start'] } }
  ];

  const completion = await chatCompletion({
    system,
    messages: [
      ...messages,
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
    ],
    tools
  });

  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  streamTo(res, completion); // stream tokens to UI
});
```

---

### Tools the model can call
Define a small, safe toolset so the model can act without guessing.

- `search_source(query: string)`
  - Returns a ranked list of matching symbols/files (fast textual search)
- `read_file_snippet(file: string, start: number, end?: number)`
  - Returns the exact lines; enforce line caps (e.g., 200 lines max)
- `open_in_editor(file: string, start: number)`
  - UI side-effect: focus file and range
- `run_basic(code: string)`
  - Compiles/runs BASIC in your in-browser VM, returns stdout/stderr/runtime diagnostics
- `explain_error(errorText: string)`
  - Uses retrieval over diagnostics + `basic.js` error paths to explain runtime/parse errors
- `format_basic(code: string)`
  - Formats BASIC according to your rules (could be a simple pretty-printer)

All tools should:
- Validate arguments
- Time out
- Be idempotent and side-effect limited (no arbitrary file writes)

---

### Code generation flow with self-check
1) User asks for a snippet
2) Model drafts code, calls `run_basic` with small inputs
3) If it fails, model gets the error and proposes a fix
4) Final answer includes:
   - The working program
   - Explanation
   - "Run" and "Open in Editor" buttons

This keeps the assistant honest and improves correctness.

---

### Prompting templates

#### System prompt
```
You are YoBASIC Copilot embedded in the YoBASIC IDE.
- Purpose: Explain the implementation of YoBASIC and generate BASIC code.
- Ground all implementation claims in the provided context (code/docs). If unsure, say "I don’t have enough context" and suggest specific files/keywords.
- Prefer citing exact functions and line numbers.
- Keep code blocks runnable and minimal. Use BASIC dialect supported by this IDE.
- Offer to open files or run code via tools when helpful.
```

#### Retrieval wrapper (assistant-side instruction)
```
Given the user query and the retrieved context, answer with:
1) A concise explanation
2) Short code or exact references
3) Citations like (basic.js:123–186). Use at most 2–3 citations.
4) If generating code, also include a brief comment on any dialect-specific behaviors.
```

---

### Prevent hallucinations and keep answers accurate
- Always show citation badges for implementation details
- Threshold retrieval scores; below threshold, answer: "I don’t have enough context. Try opening basic.js near …"
- Prefer quoting small snippets rather than paraphrasing critical logic
- Provide a one-tap "Verify by opening" link for each citation
- For codegen, auto-run samples via `run_basic` before presenting

---

### Security and privacy
- Sandboxed execution for `run_basic` (it should use the existing in-browser interpreter/VM with no host access)
- Rate-limit tool calls and LLM usage
- Content filters: redact secrets from code/doc chunks (e.g., API keys)
- Telemetry: log which citations were displayed (but not full code), measure helpfulness/latency

---

### Phased implementation plan
- Phase 0: UI panel + call out to a hosted LLM with a hardcoded context snippet from `basic.js` to validate UX
- Phase 1: Build the indexer and embeddings DB (Supabase pgvector) for `basic.js`, `README.md`, `KEYWORDS.md`
- Phase 2: Add symbol-level retrieval + citations and "Open in Editor" deep-links
- Phase 3: Add tool calls, starting with `run_basic` and `read_file_snippet`
- Phase 4: Improve quality: better chunking, auto-summaries, keyword mapping, and self-check execution
- Phase 5: Offline option (Ollama + local embeddings) and test suites for regression

---

### Nice-to-have enhancements
- Auto-generate a mapping page: BASIC keyword → interpreter function(s) with citations
- Trace mode: instrument `basic.js` to show which functions run when a small BASIC sample executes, then let the chat reference that trace
- "Why does this produce X?" flow: run the sample, collect trace, explain using retrieved code
- Doc gen: turn `KEYWORDS.md` + symbol summaries into a navigable reference site

---

### What you can do next (practical steps this week)
1) Add the Chat panel skeleton to your IDE UI and wire it to `/api/chat` with streaming
2) Create the `code_chunks` table in Supabase (or a local Postgres) and index `E:/Projects/yobasic/basic.js`
3) Implement minimal retrieval and show citations with clickable file/line links
4) Define and stub the `run_basic` tool to execute programs in your current BASIC VM
5) Ship a small beta to yourself: ask “Where is FOR implemented?” and verify the bot opens the right lines and explains them

With these pieces, you’ll have a grounded, developer-grade copilot that truly understands your `basic.js` implementation and can generate runnable BASIC code inside your IDE.