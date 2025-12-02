## IDE FRAMEWORK PHASE 3 PROMPT FOR JUNIE – Projects, Menus, Modules, Views & Build

You’re working on the YoBASIC BASIC playground at `https://yobasic.com/basic`.

We already have:

* A JavaScript BASIC interpreter (`basic.js`) driving:

    * A CLI / output panel.
    * A simple editor at the top.
* An 80’s-style menu bar with:

    * File / Tools / Help.
    * File → New / Open / Save / Save As (wired to a Virtual File System).
    * Help → About (modal).
* A **Virtual File System (VFS)** with multiple providers:

    * Local (localStorage) for:

        * Root (scratch `.BAS` files).
        * `data/` (BASIC data files via OPEN/PRINT#/INPUT#/CLOSE/EOF).
    * Supabase for:

        * `examples/` (read-only).
        * `shared/<username>/...` (public read, owner write, via `shared_files` table with RLS).
* Identity system using Supabase:

    * “Create Identity” / “Log In” → username/password → Supabase `auth.users` + `profiles.username`.
    * Logged-in users get a `shared/<username>/` folder in the VFS.

The UI has a toolbar with buttons for Run, Debug toggle, Clear, Login/Logout, and an unused **Build** button.

The entire web application is in `index.html`, and the JavaScript code is in `basic.js`.

The colors used on this web page are mostly embedded in the CSS tags in index.html or inline in the HTML or JavaScript.

I would like to be able to experiment with the colors and save the defaults in this project file.

I would like to allow the user to edit the colors in the Settings dialog (modal) under Tab 2, and change the name of the 
Tab to "Colors".  I would also like to be able to save the modified colors to localStorage as as a personal name theme,
and then also be able to save the modified colors to Supabase as a shared theme.  

I would like to be able to save an exported theme json into this project to set or change the default theme. so that
after experimenting with the colors, I can hard code a specific named theme to be the default for users who have not
created a custom theme, or who have deleted their custom theme (reverted to default).

I am not sure what the best approach is for this, so please provide a detailed plan for how to implement this feature.

