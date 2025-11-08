### BASIC Web IDE (index.html) Implementation Summary

This page implements a minimal BASIC-friendly web IDE with a nostalgic QuickBASIC vibe, using Bootstrap 5, jQuery, and jQuery Terminal.

What was done
- Switched to pure HTML/JS (no PHP) and targeted yore/web/basic/index.html.
- Added Bootstrap 5 (CSS + JS) and Bootstrap Icons via CDN for styling and toolbar icons.
- Reworked layout:
  - Fixed-top navbar (menus + toolbar).
  - Work area below navbar fills the remainder of the viewport.
  - jQuery Terminal embedded in a dedicated div.
  - An editor pane (textarea) that can be toggled. When opened (File → New), the layout splits 60/40 (editor/terminal).
- Menus and shortcuts:
  - File: New (opens editor with PRINTLN "Hello World"), Open, Save, Save As, Close (hides editor and clears it).
  - Tools: Tool 1, Tool 2, Tool 3.
  - Help: Help 1, Help 2, Help 3, About.
  - Alt+F/T/H opens the corresponding menu.
  - While a menu is open, items are selectable via case-insensitive keystrokes (N,O,S,A,C for File; 1,2,3 for Tools & Help; A for About).
  - All items show placeholder alerts per spec (except File→New and File→Close which perform actions; About opens a modal).
- Toolbar buttons:
  - Run: executes the textarea program line-by-line through the BASIC interpreter and focuses the terminal.
  - Bug: toggles DEBUGON/DEBUGOFF in the terminal.
  - Build: placeholder alert.
  - Settings: opens a modal with 4 tabs; Appearance tab allows changing
    - Editor: font face, size, color, background
    - Terminal: font face, size
    - Settings persist to localStorage and apply immediately.
- Persistence:
  - Editor contents autosave to localStorage.
  - Settings persist in localStorage.
- About modal: two short Lorem Ipsum paragraphs, link to https://basilbasic.com (opens in new tab), Close button.
- Focus behavior: editor receives focus on open; terminal receives focus when editor is closed or after running code.

Notes and assumptions
- The BASIC interpreter is provided by basic.js and exposes BasicInterpreter with lineExecute() and setTerm().
- DEBUGON/DEBUGOFF are recognized by the interpreter or terminal command processor.
- The terminal is initialized without a fixed height; it inherits from the container and resizes on layout changes.

Next steps (toward a more complete learning IDE)
1. File I/O and Virtual Filesystem
   - Implement a localStorage-backed file catalog with named programs.
   - Wire up Open/Save/Save As to the catalog (include overwrite prompts, versioning).
   - Optional: add export/import to JSON and .bas text files.
2. Program Runner Enhancements
   - Add a proper program loader that supports numbered lines, multi-line blocks, and RUN/STOP.
   - Add an execution transcript panel (optional) with timestamps.
   - Add input support for programs (e.g., INPUT statements mapping to terminal prompts).
3. Debugging Tools
   - Implement breakpoints, step/run/continue, variable watch, and call stack.
   - Enhance DEBUGON/DEBUGOFF to a structured debug overlay.
4. Editor Features
   - BASIC syntax highlighting (CodeMirror/Monaco or a light custom highlighter).
   - Line numbers, soft wrap toggle, and keyboard shortcuts (Ctrl+S, Ctrl+Enter, etc.).
   - Autosave cadence and unsaved-change indicators.
5. Help & Learning Materials
   - Integrate contextual help for BASIC commands (hover or F1).
   - Add guided lessons and examples; a sample gallery with one-click load.
6. Settings
   - Expand settings tabs (Tabs 2–4) for keybindings, theme presets, and interpreter options.
7. Packaging & Offline Use
   - Consider a PWA for offline persistence and installability.
   - Cache assets for fast startup.
8. QA & Accessibility
   - Keyboard-only navigation and ARIA attributes for menus/modals.
   - Contrast checks and adjustable themes for accessibility.

Changelog
- v0.1: Initial UI, menus, keyboard shortcuts, About/Settings modals, autosave, run/debug/build actions, terminal integration.

- v0.1.1: Debug toggle now sends DEBUGOFF first to match the interpreter's default DEBUGON state.