**PROMPT FOR JUNIE (YOBASIC.COM BASIC PAGE – VIRTUAL FILE SYSTEM + FILE I/O + DIALOGS)**

This work is being done in the current open files of yore/web/basic/index.html and related JS files.

You are working on the BASIC playground at `https://yobasic.com/basic`.
This page already has:

* A JS BASIC interpreter with an 80’s-style GWBASIC CLI/terminal.
* A QuickBASIC-style menu bar (File / Tools / Help).
* A “New” option that shows a textarea editor in the top portion of the screen with a toolbar and Run button.

I want you to implement a **Virtual File System (VFS)**, add **80’s-style Open/Save dialogs**, and hook up **BASIC file I/O** (OPEN/PRINT#/INPUT#/CLOSE/etc.) to the VFS.

Focus is on UI + simulated file I/O, based on the existing Basil/BASIC syntax document you’ve already been using.

Please follow the spec below.

---

### 1. High-Level Goals

1. Add a **virtual file system** that lives entirely in the browser for now:

    * Has an implicit **Root** directory.
    * Has an `examples/` folder with static read-only programs.
    * Has a `data/` folder for BASIC file I/O.
    * Has a stub `shared/` folder for future cloud/shared storage.
2. Implement **File → Open**, **File → Save**, and **File → Save As…** with **80’s-style modal dialogs**:

    * Open dialog shows a tree/list view of Root / examples / data / shared.
    * Save/Save As dialog lets the user save the current editor contents as `.bas` in Root.
3. Integrate the VFS with the **BASIC interpreter’s file I/O**:

    * BASIC commands like `OPEN`, `PRINT #`, `INPUT #`, `LINE INPUT #`, `CLOSE`, and `EOF()` should read/write to the VFS “files”.
    * Paths like `"data/grades.txt"` are allowed and treated as simple file names internally (no real directories from the interpreter’s perspective).
4. Persist the user’s own files in **localStorage**.

    * System example files remain hard-coded in JS and read-only.
    * Design the VFS so a future version can plug in server/cloud storage (and a `shared/` folder) without rewriting everything.

---

### 2. Virtual File System Design

Create a small, self-contained VFS module in plain JavaScript (no extra npm deps). For example as a new file or module (you can choose the exact path):

* `js/vfs.js` or similar.

#### 2.1. Data Model

Internally use a **flat map keyed by full filename string**, not nested objects:

```ts
type VfsFileKind = 'program' | 'data';

interface VfsFile {
  name: string;           // e.g. "hello.bas", "examples/HELLO.BAS", "data/scores.dat"
  kind: VfsFileKind;      // 'program' for BASIC source, 'data' for data files
  readOnly: boolean;      // true for examples, false for user files
  content: string;        // the entire file as text
}
```

The VFS holds:

```ts
type VfsFileMap = { [name: string]: VfsFile };
```

Keys are **exactly** the filename string, including things that look like paths (`"examples/DEMO.BAS"`, `"data/scores.dat"`). The interpreter will treat these as opaque strings. The UI will *interpret* `/` as folder delimiters to build the directory tree.

#### 2.2. VFS API

Implement a `VirtualFileSystem` class roughly like:

```ts
class VirtualFileSystem {
  constructor(options: { localStorageKey?: string });

  // Basic CRUD
  listFiles(): VfsFile[]; // all files (system + user)
  getFile(name: string): VfsFile | null;
  writeFile(name: string, content: string, kind?: VfsFileKind): VfsFile; // create or overwrite
  deleteFile(name: string): void; // should no-op or throw for readOnly files

  // Convenience for program vs data
  readProgram(name: string): string | null;
  writeProgram(name: string, content: string): void;
  readData(name: string): string | null;
  writeData(name: string, content: string): void;

  // Persistence
  loadFromLocalStorage(): void;
  saveToLocalStorage(): void;
}
```

Implementation details:

* On construction:

    * Seed the VFS with **system examples** (readOnly: true).
    * Seed an empty `data/` namespace for data files (not required to create physical files yet).
* All **non-readOnly** files are user files and should be persisted to localStorage.
* localStorage key: something like `"yobasic.vfs"`.
* When loading:

    * Start with system examples.
    * Merge user files from localStorage, overwriting any conflicting names where `readOnly === false`.
* Do **not** persist system example files to localStorage.

#### 2.3. System Example Files

Seed at least 3–5 example BASIC programs under the `examples/` namespace. For example:

* `examples/HELLO.BAS`
* `examples/FORLOOP.BAS`
* `examples/INPUTNAME.BAS`
* `examples/DATADEMO.BAS` (demonstrates file I/O with the `data/` directory)
* etc.

The content for each example should be defined as static strings in the VFS module (or a separate `examples.js` module) and loaded into the VFS constructor.

Example shape:

```js
const SYSTEM_EXAMPLES = [
  {
    name: 'examples/HELLO.BAS',
    kind: 'program',
    readOnly: true,
    content: `
10 PRINT "HELLO, WORLD!"
20 END
`.trim()
  },
  // ...
];
```

(You can write better BASIC examples based on the existing syntax doc.)

---

### 3. File Dialog UI (Open / Save / Save As)

Use the existing styling approach on the page (QuickBASIC-style menus and modals). Implement **two modal dialogs**: one for Open and one for Save/Save As.

Prefer reusing a generic modal component if one already exists (e.g., like the existing “About” or “Settings” dialogs). Otherwise, create minimal markup and CSS that matches the 80’s look.

#### 3.1. General Modal Behavior

* When a dialog is open:

    * Show a semi-transparent overlay over the rest of the app.
    * Trap focus inside the dialog.
    * Close on:

        * `Esc` key.
        * Clicking “Cancel” or “Close” button.
* Center the dialog in the viewport.
* Use a small 80’s-style title bar (e.g., `OPEN` or `SAVE FILE`), with a thick border and monospace fonts.

#### 3.2. Virtual Folder Tree & File List

Both Open and Save As dialogs should show a simple **file browser**:

* Left pane: a tree of folders:

    * `Root`

        * `examples`
        * `data`
        * `shared` (future placeholder)
* Right pane: files in the currently selected folder.

Implementation detail: Since the VFS is flat, build the tree dynamically:

* Split each file's `name` on `'/'` into segments.
* Segment[0] decides which folder (e.g., `examples`, `data`).
* If there is no slash, treat it as belonging to `Root`.
* `shared/` exists as an empty folder for now (no files). Clicking it can show a message like “Shared storage coming soon” in the file list.

**Open Dialog Behavior:**

* When `File → Open` is clicked:

    * Show the Open dialog.
    * Default selection: **Root** folder.
* Right pane shows files from the selected “folder”:

    * For `Root`: files with no `/` in the name (user programs).
    * For `examples`: files whose names start with `examples/`.
    * For `data`: files whose names start with `data/` and `kind === 'data'`.
* For each file, show:

    * File name (without folder prefix).
    * Maybe a small tag like `[EXAMPLE]` or `[DATA]` based on `kind` and `readOnly`.
* User interactions:

    * Single-click selects a file.
    * Double-click loads it (same as clicking Open).
    * Open button:

        * Loads the file into the editor (for `kind: 'program'`) and sets it as the “current file.”
        * Closes the dialog.
    * If they try to open a `data` file, either:

        * Show a friendly message: “Data files can’t be opened in the editor” OR
        * Open them as plain text in the editor (your choice, but document it in comments).

**Save / Save As Dialog Behavior:**

Hook up:

* `File → Save`
* `File → Save As…`

Logic:

* **File → Save:**

    * If there is a current associated file and it’s **not readOnly**:

        * Save directly to that file via VFS (no dialog).
    * If there is no associated file OR the current file is readOnly (e.g., from `examples/`):

        * Fall back to **Save As…** (open Save As dialog).
* **File → Save As…**:

    * Always open the Save As dialog.

Save As dialog specifics:

* Default folder selection: **Root**.
* Show the same left pane/right pane file browser as Open, but:

    * Only Root is enabled for saving program files per current requirements.
    * You can allow the user to type `data/foo.bas` manually if you like, but the default behavior saves to Root.
* Fields:

    * `File name:` (text input).
    * Display below: `Full name: <filename>.BAS` if the user didn’t type `.bas`.
* Behavior:

    * When user clicks “Save”:

        * Take the text from the editor.
        * Normalize the filename:

            * Trim whitespace.
            * If no extension: append `.bas`.
            * If extension is something else (e.g., `.txt`), you may either:

                * Enforce `.bas` (rename to `.bas`), OR
                * Allow arbitrary extension. Prefer enforcing `.bas` for now.
        * If a file of that name already exists:

            * If `readOnly`:

                * Show an error: “This file is read-only. Use a different name.”
            * If writable:

                * Ask for overwrite confirmation (“File already exists. Overwrite?”).
        * Write via `vfs.writeProgram(name, content)` and `vfs.saveToLocalStorage()`.
        * Update the “current file” association for the editor so that subsequent `File → Save` writes back to this same file without showing the dialog.
        * Close the dialog.

---

### 4. Editor <-> VFS Integration

Add a small layer to manage the **current editor file**:

* Track in JS:

    * `currentFileName: string | null`
    * `currentFileReadOnly: boolean`
* When user clicks `File → New`:

    * Clear the editor.
    * Set `currentFileName = null`, `currentFileReadOnly = false`.
* When user opens a program file via Open dialog:

    * Load file content into editor textarea.
    * Set `currentFileName = file.name`, `currentFileReadOnly = file.readOnly`.
* When user saves:

    * If we’re doing direct Save:

        * Use `currentFileName` and write via VFS.
    * If Save As:

        * After saving, update `currentFileName` to the chosen name and `currentFileReadOnly = false`.

Ensure that **closing the app and coming back later**:

* Still loads the system examples via JS.
* Restores user files from localStorage.
* Does *not* need to restore the previously open file (nice to have but not required).

---

### 5. BASIC File I/O Integration (OPEN / PRINT# / INPUT# / CLOSE / EOF)

The JS BASIC interpreter already exists. Update it to route file I/O through the **VirtualFileSystem**.

**Important rule:** From the BASIC interpreter’s point of view, the file name is just a string.
`"data/scores.dat"` is just a file name; there is no need to implement real directories internally. The VFS map key is that exact string.

#### 5.1. File Handle Abstraction

Introduce a simple runtime object to manage open file handles:

```ts
type BasicFileMode = 'INPUT' | 'OUTPUT' | 'APPEND'; // expand later if needed

interface BasicFileHandle {
  handle: number;         // BASIC file number, e.g. #1, #2
  filename: string;
  mode: BasicFileMode;
  position: number;       // for INPUT mode: index into an array of lines or characters
  buffer: string[] | null;
}
```

In the BASIC runtime environment, maintain something like:

```ts
const openFiles: { [handle: number]: BasicFileHandle } = {};
```

#### 5.2. Using the VFS in BASIC Commands

Implement or update the interpreter’s handling of:

* `OPEN "filename" FOR INPUT AS #n`
* `OPEN "filename" FOR OUTPUT AS #n`
* `OPEN "filename" FOR APPEND AS #n`
* `PRINT #n, ...`
* `INPUT #n, var1, var2, ...`
* `LINE INPUT #n, var$`
* `CLOSE #n`
* `EOF(#n)` function.

Basic behavior:

1. **OPEN FOR INPUT:**

    * Look up the file in VFS via `vfs.readData(filename)` (or `vfs.readProgram` if you want to allow program files too).
    * If not found:

        * Either create an empty data file or raise a BASIC runtime error `"File not found"`. Prefer raising an error.
    * Split the content into lines (e.g., `content.split(/\r?\n/)`).
    * Store in `BasicFileHandle.buffer` as an array of strings.
    * Set `position = 0`.

2. **OPEN FOR OUTPUT:**

    * Create or truncate (overwrite) a VFS data file.

        * Initially, `content = ""`.
    * For `PRINT #`, append lines to the file.
    * For now, treat everything as text.

3. **OPEN FOR APPEND:**

    * Get the existing file content from VFS (or create an empty one).
    * Keep track of the end of file for `PRINT #` appends.

4. **PRINT #n, expression:**

    * Convert `expression` to a string (consistent with existing BASIC semantics).
    * Append a newline (for now; match your existing `PRINT` semantics).
    * Append to the VFS file content in memory and then write back via `vfs.writeData`.

5. **INPUT #n, var1, var2, ... / LINE INPUT #n:**

    * Use `BasicFileHandle.buffer` and `position`:

        * For `LINE INPUT`, read the next line from `buffer[position]` and increment `position`.
        * For `INPUT`, you can either:

            * Parse comma-separated values from the current line.
            * Or treat like `LINE INPUT` for now (simpler), and parse in a basic way.
    * If `position` reaches `buffer.length`, then `EOF(#n)` must return true.

6. **EOF(#n):**

    * Return true if `position >= buffer.length` for the file handle.
    * Otherwise false.

7. **CLOSE #n:**

    * Flush any buffered content back to VFS (for OUTPUT/APPEND).
    * Remove the handle from `openFiles`.

**Note:** Always use the **exact string** passed in the BASIC program as the key to the VFS:

* `OPEN "data/grades.dat" FOR OUTPUT AS #1` → VFS name `"data/grades.dat"`.
* `OPEN "mydata.txt" FOR INPUT AS #2` → VFS name `"mydata.txt"`.

The UI will see these names in `vfs.listFiles()` and group by prefix (`data/` vs Root) for the dialogs.

#### 5.3. Data Folder Convention

By convention:

* Files whose names start with `data/` should be treated as “data files” (e.g., `kind: 'data'`).
* The Open/Save dialogs should:

    * Show data files under the `data` folder group.
    * Optionally gray them out for “program” open operations if you don’t want to open data files in the editor.

---

### 6. Testing & Sample Programs

Create at least one example BASIC program under `examples/` that demonstrates the file I/O:

Example idea (you can tweak syntax to match the existing Basil/BASIC doc):

```basic
10 PRINT "Writing sample data file..."
20 OPEN "data/demo.dat" FOR OUTPUT AS #1
30 PRINT #1, "Alice,100"
40 PRINT #1, "Bob,95"
50 CLOSE #1
60 PRINT "Done. Now reading it back:"
70 OPEN "data/demo.dat" FOR INPUT AS #1
80 WHILE NOT EOF(#1)
90   LINE INPUT #1, L$
100  PRINT "Read: "; L$
110 WEND
120 CLOSE #1
130 PRINT "Done!"
```

Steps to test after implementation:

1. Load page.
2. `File → Open → examples → DEMO.BAS` (or similar).
3. Run it.
4. Use `File → Open → data` and verify that `demo.dat` appears.
5. Confirm that closing and reopening the browser preserves user files and data files created by BASIC programs.

---

### 7. Future-Proofing for Server/Cloud Storage

Structure the VFS so that in a future phase we can plug in a server/cloud backend and a real `shared/` folder:

* Internally, consider an abstraction like:

  ```ts
  interface StorageBackend {
    load(): Promise<VfsFileMap>;
    save(userFiles: VfsFileMap): Promise<void>;
  }
  ```

* For now, implement a `LocalStorageBackend` internally to `VirtualFileSystem` and keep the API simple.

* Document in comments where a `RemoteBackend` could be added later for authenticated users and a `shared/username/` namespace.

---

### 8. Refactor & Code Organization

* Keep the VFS and file dialog code contained in their own modules/files so they don’t clutter the interpreter core.
* Add clear comments explaining:

    * Which parts are temporary (localStorage only).
    * How the `examples/`, `data/`, and `shared/` folders are represented.
* Ensure there are no breaking changes to the existing terminal/CLI and menu behavior.

---

Please implement all of the above:

1. Add the `VirtualFileSystem` implementation and wire it up to:

    * The editor (for program load/save).
    * The BASIC interpreter file I/O (OPEN/PRINT#/INPUT#/LINE INPUT#/CLOSE/EOF).
2. Implement the **File → Open / Save / Save As** dialogs and integrate them into the existing QuickBASIC-style menu and toolbar.
3. Seed a handful of example `.BAS` programs in the `examples/` folder.
4. Persist user files to localStorage.
5. Add at least one example that demonstrates BASIC file I/O with the `data/` directory.

When you’re done, I should be able to:

* New → type a BASIC program → Save As… → get a `.bas` in Root that persists.
* Open → browse examples or Root programs (with an 80’s-style file dialog).
* Run an example that writes and reads a file under `data/`.
* See that the data file appears under `data` in the Open dialog.
* Refresh the page and still see my saved files.

---

If you need to infer minor details (IDs, selectors, exact file paths), search the existing project files and keep everything consistent with the current structure and styling.
