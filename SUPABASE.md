## 🔧 PROMPT FOR JUNIE – Phase 2: Supabase-backed Examples + Shared Folder

You’re working on the BASIC playground at `https://yobasic.com/basic`.

Phase 1 is already implemented:

* A `VirtualFileSystem` (VFS) managing:

    * **Root** → user scratch programs (localStorage).
    * **data/** → BASIC data files (localStorage).
    * **examples/** → seeded system examples (JS, read-only).
    * **shared/** → placeholder.
* An 80’s-style UI with:

    * Menu bar (File / Tools / Help).
    * File → New / Open / Save / Save As… dialogs.
    * BASIC interpreter wired to the VFS for file I/O.

Now we want **Phase 2**:

* Move `examples/` and `shared/` into **Supabase**.
* Keep `Root` and `data/` in **localStorage**.
* Allow **anonymous visitors** to:

    * Use Root/data local VFS.
    * Read remote `examples/`.
    * Read any user’s `shared` programs.
* Allow logged-in users (with a lightweight “identity”) to:

    * Own a `shared/<username>/` folder in the VFS.
    * Save/update/delete files in their own shared folder.
* Use **Supabase Auth + RLS** so:

    * Only the owner can write to their `shared` files.
    * Everyone can read them.

Assume we have a Supabase project already created, with a URL and a public **anon** key. We will wire them via a small JS config file.

---

### 1. Overall Architecture Changes

1. Keep the existing VFS, but refactor it to support **multiple providers**:

    * `LocalProvider` (existing) for:

        * `Root` (no `/` in name).
        * `data/...`.
    * `SupabaseExamplesProvider` for:

        * `examples/...` (read-only).
    * `SupabaseSharedProvider` for:

        * `shared/<username>/...` (public read, owner write).

2. From the BASIC interpreter’s point of view **nothing changes**:

    * It still calls VFS via `readFile(name)` / `writeFile(name, content)` etc.
    * File names like `"shared/erik/HELLO.BAS"` and `"data/scores.dat"` are just strings.

3. VFS routing (conceptual):

   ```ts
   if (name.startsWith('examples/')) {
     return examplesProvider.readFile(name);
   } else if (name.startsWith('shared/')) {
     return sharedProvider.readFile(name);
   } else if (name.startsWith('data/')) {
     return localProvider.readFile(name);
   } else {
     // root (local)
     return localProvider.readFile(name);
   }
   ```

Implement this cleanly in the actual VFS class you already created.

---

### 2. Add Supabase Client (frontend)

Create a small JS module to initialize and export the Supabase client:

* **File:** `js/supabaseClient.js` (or similar)

```js
import { createClient } from '@supabase/supabase-js';

// TODO: Erik will fill these in
const supabaseUrl = '%%SUPABASE_URL%%';
const supabaseAnonKey = '%%SUPABASE_ANON_KEY%%';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Use the public **anon** key (safe in the frontend when RLS is enabled).
Never hardcode the service-role key.

All Supabase-backed providers (examples/shared) should import and use this `supabase` client.

---

### 3. Supabase Data Model (what the code should expect)

Assume these tables will exist in Supabase (Erik will create them; see the separate section):

1. `examples` (for `examples/` files):

    * `id` (uuid, PK, default `gen_random_uuid()`).
    * `name` (text, unique, e.g. `"examples/HELLO.BAS"`).
    * `title` (text, optional, for nicer listing).
    * `kind` (text, `'program'` or `'data'`, default `'program'`).
    * `content` (text).
    * `updated_at` (timestamptz, default `now()`).

2. `profiles` (user identity / handle):

    * `id` (uuid, PK, references `auth.users.id`).
    * `username` (text, unique, 1–15 chars, `[A-Za-z0-9_]`).
    * `created_at` (timestamptz, default `now()`).

3. `shared_files` (for `shared/<username>/...` files):

    * `id` (uuid, PK, default `gen_random_uuid()`).
    * `owner_id` (uuid, not null, references `auth.users.id`).
    * `owner_name` (text, not null) – copy of `profiles.username`.
    * `path` (text, not null) – file name under user’s folder, e.g. `"HELLO.BAS"`.
    * `kind` (text, `'program'` or `'data'`, default `'program'`).
    * `content` (text, not null).
    * `created_at` (timestamptz, default `now()`).
    * `updated_at` (timestamptz, default `now()`).

**Full virtual path convention:**

* In the VFS, user shared files appear as:

    * `shared/<owner_name>/<path>`, e.g. `shared/erik/HELLO.BAS`.
* The `shared_files` table stores just `owner_name` and `path`, but the VFS composes/decomposes the full name.

---

### 4. SupabaseExamplesProvider

Create a provider that maps the `examples` table into VFS.

**Responsibilities:**

* `listFiles()` → returns `VfsFile[]` for all example rows.
* `getFile(name)` → fetches a specific example row by `name`.
* No write/overwrite.

**Implementation details:**

* Fetch all examples once and cache them:

    * On first `listFiles()` call, run:

      ```js
      const { data, error } = await supabase
        .from('examples')
        .select('name, kind, content, updated_at')
        .order('name');
      ```

* Map each DB row to your `VfsFile` shape:

  ```ts
  {
    name: row.name,
    kind: row.kind === 'data' ? 'data' : 'program',
    readOnly: true,
    content: row.content
  }
  ```

* It’s okay to cache examples for the session. If desired, you can add a “refresh” later.

The UI’s **Open** dialog for the `examples` folder should now use this provider instead of the hard-coded JS constants.

---

### 5. SupabaseSharedProvider

The `shared` provider handles `shared/<owner_name>/<path>`.

**Parsing:**

* Given `fullName = "shared/erik/HELLO.BAS"`:

    * Strip `"shared/"`.
    * Split once on `/`:

        * `owner_name = "erik"`.
        * `path = "HELLO.BAS"`.

#### 5.1. Listing shared users and files

We want:

* In the Open dialog folder tree:

    * `Shared` node.
    * Under that, a list of all `owner_name` values who have at least one shared file.
* When the user clicks `shared/erik`, they see Erik’s files.

Implement:

* `listOwners()`:

    * `select distinct owner_name from shared_files order by owner_name`.
* `listFilesForOwner(owner_name)`:

    * `select path, kind, updated_at from shared_files where owner_name = ? order by path`.
* `getFile(fullName)`:

    * Parse owner and path, then:

      ```js
      const { data, error } = await supabase
        .from('shared_files')
        .select('owner_name, path, kind, content, updated_at')
        .eq('owner_name', ownerName)
        .eq('path', path)
        .single();
      ```
    * Map to `VfsFile` with:

      ```ts
      name: fullName,
      kind: row.kind,
      readOnly: (currentUserOwnerName !== ownerName) // see below
      ```

#### 5.2. Writing shared files (owner only)

We assume Supabase RLS ensures only the owner can write (see SQL section).

Client-side, implement methods like:

```ts
async writeSharedFile(fullName: string, content: string, kind: VfsFileKind)
```

Logic:

1. Check that the user is logged in and that their `identity.username` matches the `<owner_name>` part of `fullName`.

    * If not logged in or usernames don’t match, show a friendly error:
      “You can’t save to this shared folder. Log in as <owner_name> or use File → Save As… and save to your local Root.”

2. If ok, perform an UPSERT:

   ```js
   const { error } = await supabase
     .from('shared_files')
     .upsert({
       owner_id: currentUserId,
       owner_name: currentUserName,
       path,
       kind,
       content
     }, {
       onConflict: 'owner_id,path' // or owner_name,path depending on table definition
     });
   ```

3. Update `updated_at` automatically with a trigger or in code.

You can expose this via the VFS as `writeFile(name, content)` when `name` starts with `shared/`.

---

### 6. Identity / Auth UI (in-browser)

We want:

* Anonymous users:

    * Can use Root/data.
    * Can read examples and any shared programs.
* Logged-in users:

    * Have a username (handle) like `erik` (1–15 chars, `[A-Za-z0-9_]`).
    * Can write to `shared/<username>/...`.

Use **Supabase Auth** with **email+password** behind the scenes, but expose it to the user as a simple “Identity”:

* Internal mapping:

    * `email` stored in Supabase = `<username>@yobasic.local` (or similar).
    * `password` = their chosen password.
* On signup:

    * `supabase.auth.signUp({ email, password })`.
    * After successful signup, insert a row in `profiles`:

        * `id = auth.users.id`.
        * `username = <username>`.

Disable email confirmation for now in the Supabase Auth settings so sign-up is instant.

#### 6.1. Identity dialog

Add a new menu item: `Identity` (or under `File` / `Tools`, up to you):

* If **not logged in**:

    * Show options: “Create Identity” and “Log In”.
* If **logged in**:

    * Show: “You are <username>”, plus a “Log Out” button.

For both “Create Identity” and “Log In”, show a small modal with:

* `Username` (1–15 chars, `[A-Za-z0-9_]`).
* `Password` (masked).

**Create Identity flow:**

1. Validate username locally (regex, length, no spaces).

2. Construct `email = username + '@yobasic.local'`.

3. Call:

   ```js
   const { data, error } = await supabase.auth.signUp({
     email,
     password
   });
   ```

4. If success:

    * Insert into `profiles`:

      ```js
      const { error: pError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, username });
      ```

    * Store `currentUserId` and `currentUserName` in a small Identity manager (e.g. global state or a module).

    * Close dialog and update UI (menus, shared folder etc.).

**Log In flow:**

1. Same username + password form.

2. Construct `email = username + '@yobasic.local'`.

3. Call:

   ```js
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password
   });
   ```

4. If success:

    * Query `profiles` for this user to get the canonical username:

      ```js
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single();
      ```

    * Store identity in the Identity manager.

    * Close dialog.

**Log Out:**

* Call `supabase.auth.signOut()`.
* Clear identity state.
* The UI remains usable for local Root/data and public reading.

Supabase JS client automatically persists the session; on page load you can call `supabase.auth.getUser()` to restore the identity if a session exists and then read the `profiles` row to get username.

---

### 7. UI Integration with VFS & Menus

1. **Folder tree:**

    * `Root` → local.
    * `examples` → Supabase examples provider.
    * `data` → local.
    * `shared`:

        * Show a list of owners from `shared_files` (as described in 5.1).
        * Highlight the current user’s shared folder (e.g. `shared/<myname>`) when logged in.

2. **Open dialog under `shared`:**

    * If not logged in:

        * Show all users and their files (all read-only).
    * If logged in:

        * Same, but files under `shared/<myname>` appear as writable in the UI (e.g. no read-only badge).

3. **Save / Save As behavior:**

    * Root & data: unchanged (local).
    * When logged in:

        * In Save As, add an option to save under `shared/<myname>/...` instead of Root.
        * Setting `currentFileName` to e.g. `shared/<myname>/FOO.BAS` means `File → Save` will go to Supabase via the shared provider.
    * When not logged in:

        * Save As cannot target shared; show a note like:

          > “To save into Shared, create an identity (Identity → Create Identity). For now, you can save to Root (local only).”

---

### 8. What to Implement (Concrete Tasks)

1. **Supabase client module** (`js/supabaseClient.js`).
2. **Identity manager**:

    * Holds `currentUserId` and `currentUserName`.
    * Provides helpers:

        * `isLoggedIn()`
        * `getCurrentUser()`
        * `login(username, password)`
        * `signup(username, password)`
        * `logout()`
        * `initializeFromSession()` (called at startup).
3. **SupabaseExamplesProvider**:

    * Integrate with VFS and Open dialog’s `examples` folder.
4. **SupabaseSharedProvider**:

    * Routing for `shared/<owner_name>/...`.
    * Methods:

        * `listOwners()`.
        * `listFilesForOwner(owner_name)`.
        * `getFile(fullName)`.
        * `writeFile(fullName, content, kind)` (owner-only).
5. **VFS refactor**:

    * Route `examples/` and `shared/` to the new providers.
    * Keep Root/data local behavior as-is.
6. **UI updates**:

    * Identity dialog + menu entry.
    * Open dialog: shared owners & shared file lists.
    * Save/Save As: ability to target `shared/<myname>/` if logged in, with clear messaging if not.

Please keep the coding style consistent with the existing codebase, and factor things into small modules so the BASIC interpreter logic remains clean and mostly unchanged.

--- 🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿🌱🌿

## ✅ Supabase Setup Steps for Erik (THIS IS DONE)

Here’s what you (Erik) need to do in the Supabase dashboard to support all of this:

1. **Get your credentials:**

    * In Supabase project → **Settings → API**:

        * Copy the **Project URL**.
        * Copy the **anon public key**.
    * Paste those into `js/supabaseClient.js` once Junie creates it.

```aiignore
Supabase "YoBASIC" project PGvxA/4cwykrQTz password
Project URL https://deggmigeevsdyxqcbpuz.supabase.co
API key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZ2dtaWdlZXZzZHl4cWNicHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NjE1NDgsImV4cCI6MjA3ODEzNzU0OH0.3Cvlflm9zKFWpZtMfSlgBpY8CBP7u_Pfph9A03QdSP0

Javascript Dart
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://deggmigeevsdyxqcbpuz.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
```

2. **Auth settings:**

    * In **Authentication → Providers → Email**:

        * For now, you can **disable email confirmation** or set it so sign-up doesn’t need the user to click a link, since you’re using synthetic `@yobasic.local` emails.
    * You don’t need OAuth or magic links yet.

3. **Create tables (SQL editor)** – run something like:

   ```sql
   -- EXAMPLES TABLE
   create table public.examples (
     id uuid primary key default gen_random_uuid(),
     name text not null unique,
     title text,
     kind text not null default 'program',
     content text not null,
     updated_at timestamptz not null default now()
   );

   alter table public.examples enable row level security;

   create policy "Public read examples"
     on public.examples
     for select
     using (true);
   ```

   You’ll insert/update examples manually via the SQL editor or a future admin tool.

   ```sql
   -- PROFILES TABLE (username handle)
   create table public.profiles (
     id uuid primary key references auth.users (id) on delete cascade,
     username text not null unique check (username ~ '^[A-Za-z0-9_]{1,15}$'),
     created_at timestamptz not null default now()
   );

   alter table public.profiles enable row level security;

   create policy "Public read profiles"
     on public.profiles
     for select
     using (true);

   create policy "User inserts own profile"
     on public.profiles
     for insert to authenticated
     with check (auth.uid() = id);

   create policy "User updates own profile"
     on public.profiles
     for update to authenticated
     using (auth.uid() = id);
   ```

   ```sql
   -- SHARED FILES TABLE
   create table public.shared_files (
     id uuid primary key default gen_random_uuid(),
     owner_id uuid not null references auth.users (id) on delete cascade,
     owner_name text not null,
     path text not null,
     kind text not null default 'program',
     content text not null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );

   alter table public.shared_files enable row level security;

   -- Everyone can read shared files
   create policy "Public read shared files"
     on public.shared_files
     for select
     using (true);

   -- Only owner can insert
   create policy "Owner insert shared files"
     on public.shared_files
     for insert to authenticated
     with check (auth.uid() = owner_id);

   -- Only owner can update
   create policy "Owner update shared files"
     on public.shared_files
     for update to authenticated
     using (auth.uid() = owner_id);

   -- Only owner can delete
   create policy "Owner delete shared files"
     on public.shared_files
     for delete to authenticated
     using (auth.uid() = owner_id);
   ```

   RLS with `auth.uid()` is the standard pattern Supabase recommends for per-user data. ([Supabase][1])

4. **Seed some example programs**:

    * In the SQL editor, insert rows into `examples`, e.g.:

   ```sql
   insert into public.examples (name, title, kind, content)
   values
     ('examples/HELLO.BAS', 'Hello World', 'program',
      E'10 PRINT "HELLO, WORLD!"\n20 END'),
     ('examples/FILEIO.BAS', 'File I/O Demo', 'program',
      E'10 PRINT "Writing data..."\n20 OPEN "data/demo.dat" FOR OUTPUT AS #1\n30 PRINT #1, "Alice,100"\n40 PRINT #1, "Bob,95"\n50 CLOSE #1\n60 PRINT "Done!"\n');
   ```

5. **Hand the prompt to Junie**:

    * Paste the big prompt above into Junie in your IDE.
    * After she generates the code, just:

        * Drop in your Supabase URL + anon key.
        * Try:

            * Browsing examples (`examples` folder).
            * Browsing shared users (initially empty).
            * Creating an identity and saving to `shared/<username>/...`.

If you’d like, once Junie is done and you’ve got it wired, we can iterate on:

* A tiny “teacher index” (e.g., pinned users).
* A way to feature certain shared programs.
* Or a “copy to my root” button so students can grab a shared program and tinker locally.

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com "Row Level Security | Supabase Docs"
