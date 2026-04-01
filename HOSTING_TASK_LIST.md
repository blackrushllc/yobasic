# YoBASIC.com Simulated Hosting Environment: Task List

This document provides a comprehensive list of tasks to implement the simulated hosting environment. Tasks are divided into **User Setup Tasks** (which you should do separately to set up the infrastructure) and **AI Coding Tasks** (which we will work on together in our interactive sessions).

---

## 🛠️ User Setup Tasks (Infrastructure & Configuration)
These tasks involve setting up the backend services and cloud environment that YoBASIC will interact with.

### 1. Supabase Database Configuration
- [ ] **Create `user_vfs` table:**
    - `id`: UUID (Primary Key, default: `gen_random_uuid()`)
    - `user_id`: UUID (Foreign Key to `auth.users.id`, non-nullable)
    - `path`: TEXT (The full path from root, e.g., `/public/html/index.html`)
    - `content`: TEXT (Store script/HTML content directly)
    - `size`: INTEGER (File size in bytes)
    - `is_directory`: BOOLEAN (To handle folder structures)
    - `updated_at`: TIMESTAMPTZ (default: `now()`)
- [ ] **Configure Row Level Security (RLS):**
    - Enable RLS on the `user_vfs` table.
    - Create a policy for `SELECT`: `auth.uid() = user_id`.
    - Create a policy for `INSERT/UPDATE/DELETE`: `auth.uid() = user_id`.
- [ ] **Unique Index:**
    - Create a unique index on `(user_id, path)` to prevent duplicate files.

### 2. Hosting Server (Ubuntu VPS)
- [ ] **Base OS Setup:**
    - Provision an Ubuntu server.
    - Install Apache2: `sudo apt install apache2`.
    - Enable modules: `sudo a2enmod rewrite cgi headers proxy proxy_http`.
- [ ] **Basil CGI Integration:**
    - Deploy the `basil` binary to `/usr/local/bin/basil`.
    - Set up an Apache handler to process `.cgi` files through the `basil` binary.
    - Configure Apache to process `<?basil ... ?>` tags in `.html` files (using `mod_substitute` or a custom PHP/Node wrapper).

### 3. URL Routing & Fetcher
- [ ] **Wildcard Domain (Optional but Recommended):**
    - Set up DNS for `*.yobasic-sites.com`.
- [ ] **The "Fetcher" Script:**
    - Create a server-side script (PHP/Node/Go) that handles requests to `yobasic.com/u/<username>/<path>`.
    - **Logic:**
        1. Parse `<username>` and `<path>`.
        2. Resolve `<username>` to a Supabase `user_id`.
        3. Query Supabase `user_vfs` for the file content.
        4. If it's a `.cgi` file, execute via `basil` and return output.
        5. If it's a static file (HTML/CSS/JS), serve it with correct MIME headers.

---

## 💻 Interactive AI Coding Tasks (Application Development)
These are the tasks we will implement together in the IDE.

### Phase 1: VFS Cloud Persistence
- [ ] **`vfs.js` Extensions:**
    - Implement `syncToCloud(userId)`: Upload local VFS files to Supabase.
    - Implement `fetchFromCloud(userId)`: Download VFS files from Supabase.
    - Implement "Dirty Tracking" (only sync changed files).
- [ ] **`identity.js` Integration:**
    - Trigger `fetchFromCloud()` automatically on successful login.
    - Save local changes to cloud automatically (optional toggle).
- [ ] **IDE UI Updates:**
    - Add a "Cloud Sync" icon/button to the toolbar in `ide.html`.
    - Show visual status (Syncing, Up-to-date, Offline).

### Phase 2: Desktop App Expansion
- [ ] **Browser App (`desktop.js`):**
    - Develop the `Browser` window with navigation controls (Back, Forward, Address Bar).
    - Implement a "View" toggle:
        - **Local:** Uses `URL.createObjectURL` to render current VFS content.
        - **Live:** Loads the `yobasic.com/u/<username>/` public URL.
- [ ] **DOS CLI App (`desktop.js`):**
    - Integrate `jquery.terminal` into a new "DOS" window.
    - Implement core DOS commands mapped to the VFS: `DIR`, `CD`, `TYPE`, `DEL`, `MD`, `RD`.
    - Implement the `RUN` command: Loads a `.BAS` file and executes it using `YoBasic.run()`.
    - Implement the `EDIT` command: Opens a file in the "Notepad" app.

### Phase 3: Utility & Demo Content
- [ ] **Standardized Folders:**
    - Update the default VFS initialization to include `/public/html/`, `/public/cgi/`, and `/public/assets/`.
- [ ] **New BASIC Demos:**
    - `FTP.BAS`: A simulated FTP client for the DOS CLI.
    - `SERVER_CFG.BAS`: A GUI tool to manage server settings (headers, error pages).
    - `GUESTBOOK.CGI`: A fully functional guestbook example using Basil CGI.
    - `PKARC.BAS`: A nostalgic file archiver.

---

## 🏁 Definition of Done
- [ ] Users can log in and see their files synced across devices.
- [ ] A "Push to Cloud" action makes the `/public/html/` folder live at a public URL.
- [ ] The Desktop's Browser app can successfully render the live site.
- [ ] The DOS CLI can navigate, manage files, and run BASIC programs.
- [ ] Basil CGI scripts correctly execute on the live server.
