# YoBASIC Desktop Design Specification (DESKTOP.md)

This document outlines the design and implementation requirements for `desktop.html`, a new web page for the YoBASIC project. This page aims to provide a simulated operating system desktop environment, inspired by Windows 95, where users can interact with multiple "applications" and system components within a single, fixed-size viewport.

## 1. Vision and User Experience

The `desktop.html` page is intended to be a "simulated OS" interface. Unlike `index.html`, which focuses on an integrated development environment (IDE) for BASIC programming, `desktop.html` focuses on a multi-window, multitasking experience where various tools (Terminals, Editors, Explorers) exist as independent, floating components.

## 2. Page Layout and Styling

### 2.1 Fixed Viewport
- The page must be non-scrollable.
- The layout is fixed to the size of the browser viewport (`width: 100vw; height: 100vh; overflow: hidden;`).
- Any element that goes beyond the viewport boundaries will be hidden.

### 2.2 Navigation Toolbar (Top)
- Fixed at the top of the viewport.
- Contains the same menu options as `index.html` (File, Edit, Help, etc.).
- **Buttons**: Only the "Settings" button and the `btn-identity` (Login/Identity) button are present. All other action buttons from `index.html` (Run, Tron, etc.) are removed.
- **Window Menu**: A new "Window" dropdown menu is added. It dynamically lists all currently active (open) instances of dialogs or components. Selecting an item from this menu brings it into focus and restores it if it was minimized.

### 2.3 Taskbar (Bottom)
- Sticky at the bottom of the viewport.
- Displays icons or labels for all open components.
- Components that are minimized are visible here.
- Users can click an item in the taskbar to restore/focus it.
- Each item in the taskbar should have a way (e.g., an 'x' button or right-click option) to "close" the component.

### 2.4 Desktop Area
- The main area between the toolbar and the taskbar.
- Supports a grid of icons.
- Supports a right-click context menu.

## 3. Window Management System

A custom windowing logic must be implemented to handle the floating "applications".

### 3.1 Dialog Characteristics
- **Moveable**: Draggable by their title bars.
- **Resizable**: Drag handles at the corners/edges. Minimum size: `100x100` pixels.
- **Boundaries**: Dialogs cannot be moved entirely off the visible viewport.
- **Non-modal**: Multiple dialogs can be open and interacted with simultaneously.
- **Z-Index Management**: Any dialog that is clicked, opened, or selected from the menu is automatically brought to the front (highest z-index).
- **Controls**: Each dialog has Minimize, Maximize/Restore, and Close buttons in its title bar.

### 3.2 Instance Management
- **Multiple Instances**:
    - `Basic.JS Terminal`
    - `Notepad` (Single File Editor)
    - `iFrame Windows` (General purpose URL wrappers)
- **Singletons (One instance only)**:
    - `File Explorer`
    - `Chat Window`
    - `Tabbed Editor`
    - System Dialogs (Help -> About, File -> New Project, etc.)
- **Singleton Behavior**: If a user attempts to open a singleton that is already open, the existing instance is brought into focus and restored if minimized.

## 4. Desktop Icons and Interaction

### 4.1 Icon Creation
Users can create icons on the desktop via:
- **Right-click Menu**:
    - Add URL (Prompts for URL and Name).
    - Add Built-in (List: Terminal, Folder Explorer, About, New Project, etc.).
- **Drag & Drop**: Dragging a file from the VFS Folder Explorer to the desktop.

### 4.2 Icon Behavior
- **URL Icons**: Double-clicking opens the URL in a new browser tab.
- **Built-in/System Icons**: Double-clicking opens the corresponding component in a moveable dialog.
- **BASIC Program Icons (.bas)**:
    - **Double-click**: Runs the program in a NEW instance of the `Basic.JS Terminal`.
    - **Right-click -> Edit**: Opens the program in a NEW instance of the `Notepad` editor.

## 5. Built-in Applications

### 5.1 Basic.JS Terminal
- Provides the standard YoBASIC terminal experience.
- Supports multiple concurrent instances, each with its own interpreter state.

### 5.2 File Explorer
- Provides a UI for navigating the pseudo file system (VFS).
- Singleton instance.
- Supports dragging files to the desktop.

### 5.3 Tabbed Editor
- A singleton instance of the tabbed editor from `index.html`.
- **Reduced Functionality**: "Run", "Run Selection", and debugging items are disabled/removed.
- Users are directed to `index.html` for full debugging capabilities.
- Supports "File -> Save", "File -> Save As" and "File -> Close".

### 5.4 Notepad (Single Document Editor)
- A lightweight editor for editing one file at a time.
- Supports multiple instances.
- Supports "File -> Save", "File -> Save As" and "File -> Close".

### 5.5 Chat Window
- The standard YoBASIC chat component.
- Singleton instance.

### 5.6 iFrame Dialogs
- Generic dialogs that load a specific URL in an iframe.
- Styled to look like a windowed application.

## 6. Integration with Existing Systems

- **VFS**: All file operations (Save/Save As/Load/Explorer) must interface with the existing `vfs.js`.
- **Identity**: The `identity.js` system must be used for login and user sessions.
- **Settings**: The "Settings" button should open the same settings dialog as `index.html`, affecting the environment (themes, fonts, etc.).
- **Basic.JS**: The core interpreter must be capable of being instantiated multiple times for the multiple Terminal support.

## 7. Technical Implementation Notes
- Use standard HTML/CSS/JS (vanilla or with current project dependencies like jQuery).
- Avoid heavy external windowing libraries if possible; a lightweight custom implementation is preferred to maintain the project's style.
- Ensure `ybs.css` and `ybs-compat.css` are leveraged for consistent styling.

## 8. Built-in “Downloads” Folder (Public Static Files Explorer)

**Goal:** Provide a built-in desktop icon named **Downloads** that opens a Windows-Explorer-like dialog backed by a real server directory `/downloads/` (public static hosting). Users can browse nested folders and download files.

**Requirements**

* **Root path:** `/downloads/`
* **Recursive listing:** show folders and files; allow nesting (`/downloads/Documents/...`, `/downloads/Installers/...`).
* **Navigation:**

  * Double-click folder → enter folder
  * “Up” button → go to parent (disabled at root)
  * Breadcrumb optional: `Downloads > Installers > Windows`
* **File actions:**

  * Double-click file → download/open in new tab (based on file type)
  * Right-click file:

    * Download
    * Copy Link
* **Sorting & view:**

  * Default: icon grid (Explorer-like)
  * Optional toggle: Details view (Name, Type, Size, Modified)
  * Sort by Name/Type (at least Name)
* **No upload/write** from client (read-only).
* **Caching:** allow server caching headers; client should cache directory listings for the session.
* **Safety:**

  * Block directory traversal
  * Only show items actually under `/downloads/`
  * Hide dotfiles (e.g., `.DS_Store`) by default
  * From the web server's prespective, this project is stored under /basic, so the downloads folder should be `/basic/downloads` on the server.

**Implementation notes (suggested)**

* Add a lightweight Php endpoint that returns directory JSON:

  * `GET list.php?path=/` → `{ path, parentPath, items:[{name,type:'file|dir',size,mtime,ext,url}] }`
* The Downloads window is a **singleton** (recommended, like File Explorer), unless you explicitly want multiple explorer windows.
* From the web server's prespective, this project is stored under /basic, so any absolute paths would be /basic/list.php, for example, or you could just use relative paths.

## 9. Standard Icon Library

For URL-based icons, use the favicon from the URL if possible, otherwise use a generic "Website" icon.

Define a shared icon mapping used by:

* Desktop icons
* Taskbar items
* File/Folder tiles in VFS Explorer and Downloads Explorer

**Baseline: Bootstrap Icons**

* Folder: `bi-folder`
* Folder (open): `bi-folder2-open`
* Text file: `bi-file-earmark-text`
* Code file: `bi-filetype-js`, `bi-filetype-html`, `bi-filetype-css`, `bi-filetype-txt`
* BASIC program: `bi-terminal` or `bi-file-earmark-code`
* PDF: `bi-file-earmark-pdf`
* Zip/archive: `bi-file-earmark-zip`
* Windows installer (msi/exe): `bi-windows`
* Linux package (deb/rpm): `bi-box-seam`
* Image: `bi-file-earmark-image`
* Audio: `bi-file-earmark-music`
* Video: `bi-file-earmark-play`
* Link/URL: `bi-link-45deg`
* Settings: `bi-gear`
* Help/About: `bi-info-circle`
* Chat: `bi-chat-dots`
* Download: `bi-download`

**Fallback: Emoji (optional)**
If icons fail to load, use emoji equivalents (📁 📄 🧾 🗜️ 🪟 ⬇️ 🔧 💬 🔗).

## 10. Disabled Shortcuts When Logged Out (Shared Supabase Objects)

**Goal:** Any desktop items that reference “Shared” (Supabase-backed) filesystem objects must appear but be disabled when the user is not logged in.

**Rules**

* Desktop items can have `requiresAuth: true` and `authScope: 'shared'|'user'`.
* When `identity.js` reports logged-out:

  * render such icons with disabled style (dimmed + no double-click action)
  * double-click shows a small modal: “Login required to access Shared files.”
  * right-click menu is limited to: “Login…” and “Properties”
* When logged-in:

  * icon becomes enabled without reload (react to identity event)

**UI cues**

* Disabled overlay badge: small lock icon
* Tooltip: “Requires login”

## 11. Desktop Items Source Priority

To avoid confusion, define this ordering:

1. Built-in system icons (Terminal, File Explorer, Tabbed Editor, Chat, Downloads)
2. User desktop items saved locally (localStorage) when logged out
3. User desktop items saved in Supabase (if logged in), merged with local items (dedupe by id)


## 12. Default Desktop Layout and Icons:

* Terminal (1x)
* File Explorer (1x)
* Tabbed Editor (1x)
* Chat (1x)
* Downloads (1x)
* iFrame Dialogs (listed in an array that I can edit)
* URL Icons:
  * /basic/index.html => "YoBASIC IDE"
  * https://blackrushbasic.com/ => "Basil Docs"
  * https://basilbasic.com/ => "Basil Website"
* Other URL icons (listed in an array that I can edit)

## Addendum Notes:

### What I’d tighten / add (small but important)

1. **Persistence rules (critical)**

* Decide what persists across reloads:

  * window positions/sizes
  * minimized/maximized state
  * desktop icon layout
  * “recent windows” list (optional)
* Recommendation: persist **desktop icons + positions** and **last window geometry per app type** in `localStorage` (or VFS if logged in), but **do not** restore every window on refresh unless you explicitly want “session restore.”

2. **A single “Desktop Registry” data model**

* Treat desktop icons, shortcuts, and pinned apps as one JSON document:

  * `desktop_items[]`: `{ id, type, title, icon, launchSpec, x, y, disabledReason? }`
* This will also make your “Window” menu and taskbar consistent (everything becomes “a thing with an id + state”).

3. **Z-order + focus should be centralized**

* Your spec implies it, but implementation goes smoother if there’s one WindowManager that owns:

  * `bringToFront(id)`
  * `minimize(id)`
  * `maximize(id)`
  * `close(id)`
  * `snapToBounds(id)`
* Especially since you want boundaries + z-index + taskbar + Window dropdown all in sync.

4. **Security constraints for iFrame windows**

* Allow arbitrary URL icons to open in iframes for now; you’ll hit X-Frame-Options/CSP issues anyway, and you risk embedding questionable content but we'll tighten that up later.
* Recommendation: keep your current behavior of **URL icons open in a new tab** (already in spec).
* For iFrame windows, we will use an **allowlist** (your own domains / specific tutorial sites).
* The allowlist will permit the following domains or any subdomain of them:
  * yobasic.com
  * blackrushbasic.com
  * basilbasic.com
  * blackrush.us
  * blackrushdrive.com
  * yoreweb.com
  * asbestoschool.us

5. **UX niceties that match Windows 95 vibes**

* rectangle “marquee select” on the desktop (drag to select icons)
* rename icon (F2 or right-click Rename)
* “Arrange Icons” (by name/type) + “Auto arrange” toggle
* basic snap: when moving a window near edges, show a subtle boundary hint

