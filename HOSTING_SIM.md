# Simulated Hosting Environment: YoBASIC.com Cloud Platform

## Introduction & Vision
The goal is to transform the YoBASIC experience from a local playground into a functional, cloud-backed hosting simulation. This allows users to "go live" with their HTML and Basil CGI creations, managing their "server" through a nostalgic yet modern desktop interface.

---

## High-Level Architecture
The architecture bridges the gap between the user's browser-based IDE and a real web server (Ubuntu + Apache2 + Basil CGI).

1.  **Local Environment (Browser):**
    *   `vfs.js` manages local files in `localStorage` or `OPFS`.
    *   New `CloudSync` module to "push" local VFS to the cloud.
2.  **Cloud Storage (Supabase):**
    *   A new `user_vfs` table stores all files, indexed by `user_id` and `path`.
    *   Row Level Security (RLS) ensures only owners can write to their folders.
3.  **Live Server (YoBASIC.com Backend):**
    *   Ubuntu VPS running Apache2.
    *   Custom `mod_rewrite` or a handler to route `yobasic.com/u/<username>/...` to a script.
    *   The script fetches content from Supabase's `user_vfs`.
    *   Basil CGI handles `.cgi` files and `<?basil ... ?>` tags in `.html` files.

---

## Standardized Web Root Structure
To enable seamless hosting, we enforce a standardized folder structure within the user's VFS:

- `/public/`
    - `html/` -> **Web Root**. Static files and HTML with Basil tags.
    - `cgi/` -> **CGI Scripts**. Executable Basil programs (e.g., `guestbook.cgi`).
    - `assets/` -> User-defined folder for images, CSS, and JS.
    - `logs/` -> Access and error logs (simulated or real-time from the server).
    - `data/` -> Persistent data storage for BASIC/Basil programs.

---

## Key Features & New Desktop Apps

### 1. Cloud Sync & "Go Live"
*   **Feature:** A "Push to Cloud" button in the IDE and Desktop.
*   **Transition:** Upon login, the VFS can switch from `LocalMode` to `CloudMode`, fetching and saving directly to Supabase.
*   **Deployment:** Pushing to the cloud immediately makes the `/public/` folder accessible via `https://yobasic.com/u/<username>/`.

### 2. New Desktop App: **Browser**
*   **UI:** An iframe-based window with a toolbar (Back, Forward, Refresh, Address Bar).
*   **Logic:** Defaults to the user's live site URL.
*   **Simulator:** Can toggle between "Local" (viewing `blob:` URLs or local VFS content) and "Live" (viewing the `yobasic.com` public URL).

### 3. New Desktop App: **DOS CLI**
*   **UI:** A command-prompt window (using `jquery.terminal`).
*   **Commands:** 
    *   `DIR`, `COPY`, `DEL`, `REN`, `TYPE`, `MD`, `RD`, `CD`, `CLS` (File management).
    *   `RUN <program>`: Directly executes a `.BAS` file from the VFS.
    *   `EDIT <file>`: Opens the file in the Notepad app.
    *   `FTP <host>`: A simulated FTP client (see below).
    *   `ZIP`/`UNZIP`: Package management using `JSZip`.

### 4. BASIC Utility Tools
A collection of pre-written programs (in `demo/`) that serve as examples and tools:
*   `FTP.BAS`: Simulated FTP client to "transfer" files between users or to a mock external server.
*   `SERVER_CFG.BAS`: A GUI tool (using `UI.SHOW%`) to manage server settings, custom headers, or error pages.
*   `PKARC.BAS`: A nostalgic compression utility (simulation of ARC/PKZIP).
*   `GUESTBOOK.CGI`: A complete example of a Basil CGI script with database integration.

---

## Implementation Roadmap (Phased Approach)

### Phase 1: VFS Cloud Persistence (Supabase)
1.  Create `user_vfs` table in Supabase.
2.  Update `vfs.js` with `pushToCloud()` and `fetchFromCloud()` logic.
3.  Modify `Identity` to trigger a sync or prompt the user upon login.

### Phase 2: Live Server Integration (Apache/Basil)
1.  Set up the Apache handler on YoBASIC.com to fetch from Supabase.
2.  Integrate Basil CGI into the production server.
3.  Establish the `yobasic.com/u/<username>/` URL routing.

### Phase 3: Desktop App Expansion
1.  Develop the **Browser** app with iframe integration.
2.  Implement the **DOS CLI** with a robust set of file-system commands.
3.  Add the utility programs to the default VFS `/demo` folder.

---

## Traps & Challenges

### 1. Security & Isolation
*   **Problem:** User-uploaded HTML/JS can perform XSS or CSRF on `yobasic.com`.
*   **Solution:** Serve user content from a different subdomain (e.g., `<username>.yobasic-sites.com`) or use the `sandbox` attribute on the Browser app iframe.

### 2. Iframe Restrictions
*   **Problem:** Many sites block iframes via `X-Frame-Options: DENY`.
*   **Solution:** For the user's own site, we control the headers and can allow them. For external sites, we can use a server-side proxy (like `CORS Anywhere`) if necessary.

### 3. Synchronization Conflicts
*   **Problem:** User edits the same file in two tabs simultaneously.
*   **Solution:** Implement a simple "Last Write Wins" policy initially, and eventually add ETag-based optimistic locking.

### 4. Resource Usage
*   **Problem:** Infinite loops in CGI scripts could crash the live server.
*   **Solution:** Implement execution timeouts and memory limits in the Basil CGI environment.

### 5. Large File Handling
*   **Problem:** Storing large assets (videos, high-res images) in Supabase/PostgreSQL is inefficient.
*   **Solution:** Use Supabase Storage (S3-backed) for files larger than 1MB, while keeping small scripts and HTML in the database table for faster lookup.

---
*Created on 2026-04-01 for the YoBASIC Cloud Project.*
