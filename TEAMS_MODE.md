### Revised Analysis and Plan for "Team Mode"

Instead of URL-based routing, "Team Mode" will be managed as a persistent local state. This allows users to switch between different team contexts (or "Self" mode) without changing the URL, while maintaining a history of joined teams.

---

### 1. State Management and Context

We will use `localStorage` to persist the team context and history.

*   **LocalStorage Keys:**
    *   `yobasic_current_team`: The name of the currently active team (defaults to `Self`).
    *   `yobasic_team_history`: A JSON array of team names the user has previously joined.
*   **Identity Helper (`identity.js`):**
    *   `getCurrentTeam()`: Returns the team name from `localStorage`.
    *   `setTeam(teamName)`: Updates current team and adds to history.
    *   `getTeamHistory()`: Returns the list of teams from history.

---

### 2. UI Implementation

#### A. Navigation Menu Bar (`index.html` & `desktop.html`)
*   **Display:** Show the team name (or `Self`) next to the user's login name (e.g., `JohnDoe (Self)` or `JohnDoe (TeacherA)`).
*   **Dropdown Context Switcher:** Add a dropdown menu in the navbar allowing quick switching between "Self" and any teams found in the history.
*   **Interaction:** Clicking the team name should trigger the same Identity/Log Out dialog as clicking the identity icon.

#### B. Identity "Log In" Dialog
*   **Join Team Option:** Add a new section or field to "Join Team".
*   **Suggestions:** Provide a dropdown suggested from the local team history.
*   **Validation:** When a user enters a team name manually, the system must check if that user (the team owner) exists in the database before allowing the join.
*   **Default:** Default context is "Self".

#### C. Identity "Log Out" Dialog
*   **Contextual Actions:** Instead of just a "Log Out" button, offer:
    *   **Join Team:** Enter a new team name to join.
    *   **Switch Team:** Select from history.
    *   **Exit Team:** Quickly revert to "Self" context.
    *   **Log Out:** Standard session termination.

---

### 3. Functional Compartmentalization

#### A. Virtual File System (VFS) & Shared Files
*   **Filtering (Team Mode):**
    *   **Members/Students:** Only see their own shared folder and the Team Owner's folder (Privacy/Focus mode).
    *   **Team Owners:** See shared folders for all members who have joined their team.
    *   **Self Mode:** See all shared folders from all registered users.
*   **Team Owner Permissions:** If the logged-in user is the owner of the current team (e.g., `TeacherA` is logged in while the team is `TeacherA`):
    *   The owner can **Save** files into any team member's shared folder (to post corrections or feedback).
    *   The owner **cannot** Edit or Delete existing files in those folders (preserving student work).
*   **Membership Logic (Initial):** For now, "belonging to a team" will be determined by users who have the same team context active (requires a database check or a new `team_members` mapping in Supabase).

#### B. Chat Moderation (`chat.js`)
*   **Moderation Rights:** If the current team name matches the logged-in username, that user is the "Team Owner".
*   **Capabilities:**
    *   Team Owners can delete **any** comment within their team context.
    *   Individual users retain the ability to delete their own comments.
*   **UI:** Show a "Delete" icon for all messages when the owner is logged in.

---

### 4. Implementation Phases

1.  **Phase 1: Identity & State:** Update `identity.js` to handle team state and history. Implement team existence check.
2.  **Phase 2: UI Updates:** Modify `index.html` and `desktop.html` navigation bars and modals. Add the dropdown context switcher.
3.  **Phase 3: VFS Scoping:** Update `vfs.js` and `provider-shared.js` to respect the team context and implement owner save permissions.
4.  **Phase 4: Chat Moderation:** Update `chat.js` logic to allow team owners to moderate comments.

---

### 5. Summary of Technical Changes

| Component | Change Required |
| :--- | :--- |
| **identity.js** | New `TeamContext` API; `localStorage` management; `checkTeamExists` method. |
| **Navbar (UI)** | Display `username (team)`; add context dropdown. |
| **Modals (UI)** | Redesign Login/Logout dialogs to include Team Join/Switch/Exit. |
| **VFS / Shared** | Filter `shared_files` by team members; allow Owner-Save on member files. |
| **Chat** | Enable "Delete" action for Team Owners on all messages. |

---

### 6. Database Migration

To support Team Mode persistence, run the following SQL in your Supabase SQL Editor:

```sql
-- Add team_name column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT 'Self';

-- Update comments table to include team_name for compartmentalization
ALTER TABLE comments ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT 'Self';
CREATE INDEX IF NOT EXISTS idx_comments_team_name ON comments(team_name);
```

*Note: Password protection and formal subscription/access requests for teams are deferred to a later phase.*