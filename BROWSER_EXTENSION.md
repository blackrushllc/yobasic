### Implementation Plan: YoBASIC Browser Extension

This plan outlines the steps and architectural considerations for porting the `desktop.html` functionality into a cross-browser extension (Chrome and Firefox) that supports modal and docked-tray interfaces.

#### Phase 1: Extension Architecture & Foundation
1.  **Manifest V3 Configuration**:
    *   Create a unified `manifest.json` compatible with both Chrome and Firefox.
    *   **Permissions**: `storage`, `contextMenus`, `scripting`, `activeTab`.
    *   **Background Service Worker**: Manages the extension lifecycle, context menu registration, and inter-script communication.
2.  **Shadow DOM Injection**:
    *   To prevent CSS conflicts with host websites, the entire YoBASIC Desktop UI will be injected into a `Shadow Root` within a container div on the host page.
3.  **Unified Messaging**:
    *   Implement a messaging bridge between the `Background Worker` (extension level) and `Content Scripts` (page level) to handle commands like "Open Modal" or "Toggle Tray".

#### Phase 2: UI Implementation (Modal & Tray)
1.  **Context Menu Integration**:
    *   Register a "Open YoBASIC Desktop" item in the browser's right-click menu.
    *   Upon selection, the Background Worker sends a message to the active tab's Content Script to instantiate the UI.
2.  **Modal View**:
    *   A centered, draggable container mimicking the current `desktop.html` viewport.
    *   Uses a backdrop overlay to dim the host website.
3.  **Docked Slide-out Tray**:
    *   Implement four docking positions: `top`, `bottom`, `left`, `right`.
    *   Include a persistent, low-profile "Handle" or "Tab" that toggles the tray.
    *   **State Persistence**: Use `chrome.storage.local` to remember the last used position (e.g., `dock_position: "right"`) and whether it was expanded or collapsed.

#### Phase 3: Porting "Desktop" Features
1.  **Window Management**:
    *   Adapt `WindowManager` from `desktop.js` to work within the Shadow DOM.
    *   Ensure all applets (Terminal, File Explorer, Notepad) are functional as independent windows within the injected container.
2.  **Asset Management**:
    *   Update all internal links (icons, CSS, scripts) to use `chrome.runtime.getURL()`.
3.  **Communication**:
    *   Allow the Terminal or Editor to optionally "scrape" or "inject" data from/to the host page (with user permission).

#### Phase 4: Storage, VFS, and Persistence
1.  **Local Storage VFS**:
    *   **Migration**: Port `vfs.js` to use `chrome.storage.local` instead of `window.localStorage`. This makes the user's files global across all websites.
    *   **Data Scope**:
        *   **Global Root**: The standard `/root` directory.
        *   **Site-Specific Root**: Automatically create a `/sites/[hostname]` directory for snippets specific to the current page.
2.  **Local Drive Storage**:
    *   Utilize the **File System Access API** to allow users to "mount" a local folder from their PC. This provides true persistence to the physical disk.
    *   Provide a "Sync to Downloads" feature using the `chrome.downloads` API for environments where direct file system access is restricted.
3.  **Supabase Integration**:
    *   Bundle the `SupabaseSharedProvider` and `identity.js` logic.
    *   **Persistence**: Store the Supabase JWT in `chrome.storage.local` for persistent sessions across sites.
    *   **Sharing**: Enable the `shared/` folder to allow users to collaborate and access their files from any browser instance with the extension installed.

---

### Potential Difficulties, Roadblocks, and Considerations

1.  **Content Security Policy (CSP)**:
    *   **Difficulty**: Many sites (e.g., GitHub, Twitter) forbid executing inline scripts or loading external resources.
    *   **Roadblock**: `eval()` and `new Function()`—often used in interpreters—may be blocked.
    *   **Solution**: The BASIC interpreter must be carefully architected to avoid `eval`. All library dependencies (jQuery, CodeMirror) must be bundled locally within the extension package.
2.  **Iframe Restrictions**:
    *   **Difficulty**: The "iFrame Window" applet in `desktop.html` will fail for sites that send `X-Frame-Options: DENY` or `SAMEORIGIN`.
    *   **Consideration**: Provide a fallback that opens these sites in a new tab if embedding fails.
3.  **Z-Index and Styling Conflicts**:
    *   **Difficulty**: Some websites use `z-index: 999999 !important` for their own overlays.
    *   **Solution**: Use a massive z-index on the Shadow DOM container and monitor for host-side changes that might hide the extension UI.
4.  **Performance Overheads**:
    *   **Consideration**: Injecting a complex desktop environment into every tab can increase memory usage.
    *   **Optimization**: Implement "Lazy Loading"—only inject the full Desktop JS and CSS when the user first interacts with the extension icon or context menu.

---

### Storage Discussion: VFS, Drive, and Supabase

*   **Local Storage VFS**: This should be the default "fast" storage. It is ideal for small scripts, configuration files, and temporary data. It is isolated from the host website's own storage but shared across all extension instances.
*   **Local Drive Storage**: This is crucial for users who want to treat YoBASIC as a professional tool. By using the File System Access API, the extension can read and write `.BAS` files directly to the user's "Documents" or "Projects" folder, bypassing the browser's sandbox limitations.
*   **Supabase Storage**:
    *   **Persistence**: Solves the "New Browser" problem where local storage is empty.
    *   **Data Sharing**: The `shared/` directory allows for a community-driven repository of scripts.
    *   **Implementation**: Authentication should be handled via a popup window to ensure compatibility with Supabase's OAuth flow.
*   **Data Scope**:
    *   The extension should offer a "Context-Aware" mode. For example, if I am on `example.com`, the File Explorer could highlight a `example_com.bas` script. This adds value by allowing users to create site-specific automation scripts.