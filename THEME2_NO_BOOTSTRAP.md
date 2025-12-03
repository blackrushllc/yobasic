### Goal
Replace Bootstrap CSS (and optionally JS) with a custom, theme‑driven UI layer so every visual aspect is tunable: navbar, buttons, menus, tabs, modals, editor/terminal themes, syntax highlighting, and scrollbars. Keep Bootstrap Icons. Preserve current fonts and dropdown behavior.

### Strategy Overview
Two safe tracks; pick Track A first for speed, then optionally proceed to Track B when ready:
- Track A — No Bootstrap CSS, keep Bootstrap JS temporarily: Remove the Bootstrap CSS link; ship a small “compat CSS” that provides only the class names we already use (buttons, nav, tabs, dropdowns, modals, grid/spacing). All styles are driven by our CSS variables. Minimal HTML/JS changes. Behavior (dropdowns, modals, tabs, collapse) continues via `bootstrap.bundle.js`.
- Track B — No Bootstrap at all: Replace Bootstrap JS behaviors with a tiny `ybui.js` (dropdown, modal, tabs, collapse), then remove the Bootstrap bundle. HTML data attributes/initializers updated to use our JS. This gives full independence and smaller payload.

### Design Tokens (CSS variables) to introduce/complete
- App foundation
  - `--app-bg`, `--app-fg`, `--muted-fg`, `--accent`, `--border`, `--focus-ring` (outline), `--selection`
  - `--surface-1`, `--surface-2`, `--surface-3` (panels/menus/modals)
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Navigation
  - `--nav-bg`, `--nav-fg`, `--nav-hover-bg`, `--nav-active-bg`, `--nav-border`
- Buttons
  - `--btn-bg`, `--btn-fg`, `--btn-border`, `--btn-hover-bg`, `--btn-active-bg`, `--btn-disabled-bg`
  - Variant tokens for primary/secondary/warning/outline
- Dropdowns/Menus
  - `--menu-bg`, `--menu-fg`, `--menu-hover-bg`, `--menu-border`, `--menu-shadow`
- Tabs
  - `--tab-bg`, `--tab-fg`, `--tab-active-bg`, `--tab-active-fg`, `--tab-border`
- Inputs/Forms
  - `--input-bg`, `--input-fg`, `--input-border`, `--input-placeholder`, `--input-focus-border`
- Modals
  - `--modal-bg`, `--modal-fg`, `--modal-border`, `--backdrop`
- Editor/Terminal
  - `--editor-bg`, `--editor-fg`, `--editor-caret-color`
  - `--terminal-bg`, `--terminal-fg`
- Syntax highlighting (CodeMirror)
  - `--syn-keyword`, `--syn-operator`, `--syn-number`, `--syn-string`, `--syn-comment`, `--syn-variable`, `--syn-builtin`, `--syn-error`
- Scrollbars
  - `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`
- Spacing/Radius (optional)
  - `--radius-sm`, `--radius-md`, `--radius-lg`, `--gap-1`..`--gap-4`, `--pad-1`..`--pad-4`

### Work Plan
1. Inventory Bootstrap usage in `index.html`
   - Classes: `navbar`, `btn`, `nav`, `nav-tabs`, `nav-link`, `dropdown-*`, `modal*`, `form-control`, `form-select`, `row/col/col-md-*`, `list-group*`, utilities (`d-none`, `p-3`, `mb-2`, `g-3`, `text-*`, `border-*`, `d-flex`, `gap-2`, `flex-wrap`).
   - JS APIs used: `bootstrap.Dropdown`, `bootstrap.Modal`, `bootstrap.Tab`, `bootstrap.Collapse`.

2. Establish a base file pair
   - Add `ybs.css` (YoBASIC Styles) with: reset + variables + component styles.
   - Add `ybs-compat.css` that defines only the subset of Bootstrap class names we actually use, mapping them to our tokens. This allows removing Bootstrap CSS immediately without rewriting HTML.
   - Keep Bootstrap Icons CDN link.

3. Remove Bootstrap CSS (keep JS)
   - Comment out `<link ... bootstrap.min.css>`.
   - Include `ybs.css` then `ybs-compat.css`.
   - Validate screens: navbar, menus, tabs, modals, forms, grid, list groups. Fix any regressions by extending compat rules.

4. Define our components in `ybs.css`
   - Navbar: use `--nav-bg` (set to a dark grey/black, e.g., `#0a0a0a`), `--nav-fg`. Ensure hover/active/disabled states. Align with theme variables.
   - Buttons: `.btn` base + variants (`.btn-primary`, `.btn-secondary`, `.btn-warning`, `.btn-outline-*`, `.btn-sm`) using tokenized colors and consistent focus rings.
   - Tabs: `.nav-tabs`, `.nav-link` states, borders, padding, active indicator. Align with editor tabs aesthetics and `--tab-*` tokens.
   - Dropdowns: `.dropdown-menu` and `.dropdown-item` styles; spacing, hover color, elevation (`--menu-shadow`).
   - Modals: `.modal`, `.modal-dialog`, `.modal-content`, and backdrop using `--backdrop`; rounding via `--radius-md`.
   - Forms: `.form-control`, `.form-select` (including `-sm`), placeholders, focus, disabled.
   - Grid: lightweight `.row` and `.col`, plus `col-md-6`, `col-4/8` for breakpoints actually used. Use CSS Grid/Flex; avoid full framework.
   - List groups: `.list-group`, `.list-group-item`, `.active`, dark variant.
   - Utilities used by the app: `.d-none`, `.d-flex`, `.flex-wrap`, `.gap-2`, `.p-3`, `.mb-2`, `.border-end`, `.text-light`, `.text-secondary`.

5. Expand theme integration
   - Wire all new components to the theme variables already introduced. Add missing tokens (above) to both built-in themes (Dark/Light) to avoid nulls.
   - Adjust navbar color via `--nav-bg` to a dark grey or black (no more `#212529`).

6. Editor and Terminal polish
   - Create a CodeMirror theme class `.cm-s-yobasic` using syntax tokens. Apply via CodeMirror option `theme: 'yobasic'` on editor creation. Map keyword/string/comment/etc. to our `--syn-*` variables.
   - Style jQuery Terminal via CSS variables and `.terminal` selectors; unify prompt/cursor colors with theme.
   - Implement custom scrollbars for editor and terminal: `::-webkit-scrollbar` family + `scrollbar-width`/`scrollbar-color` for Firefox, using our scrollbar tokens.

7. Accessibility and focus
   - Ensure `:focus-visible` rings are clear and high-contrast using `--focus-ring`. Provide hover/active contrast ≥ WCAG AA.

8. Verification pass (end of Track A)
   - Test: dropdowns open/close, modals show/hide, tabs switch, collapse works, forms usable, grid layouts intact.
   - Cross-browser skim: Chromium, Firefox, Safari (if available). Check high DPI.
   - Adjust token defaults to match the current “YoBASIC Dark” theme; ensure “YoBASIC Light” remains legible.

9. Optional Track B — Remove Bootstrap JS
   - Add `ybui.js` with minimal, dependency-free behaviors:
     - Dropdown: toggle on click, close on outside/Escape, simple positioning (below trigger), keyboard navigation.
     - Modal: open/close with backdrop, focus trap, ESC, scroll lock.
     - Tabs: activate/deactivate panels by `aria-controls`.
     - Collapse: expand/collapse sections used by the left drawer.
   - Replace `bootstrap.*` calls (`Dropdown`, `Modal`, `Tab`, `Collapse`) with `YBUI.*` equivalents.
   - Remove the Bootstrap bundle script.

10. Documentation and theming guide
   - Add a brief section in `THEME_PROMPT_FOR_JUNIE.md` or a new `STYLE_GUIDE.md` documenting tokens, component hooks, and how to tune each area.
   - Include notes on how to set the desired navbar color and other site‑wide surfaces.

### Acceptance Criteria
- No `<link>` to Bootstrap CSS. Bootstrap Icons remain.
- All visible components render and function normally under `ybs.css` + `ybs-compat.css`.
- Navbar color governed by `--nav-bg` (initially set to a dark grey/black) and consistent with the rest of the theme.
- Buttons, dropdowns, tabs, modals, forms, list groups, grid/spacing look coherent and are theme‑driven.
- Editor (CodeMirror) uses the new `yobasic` theme; syntax colors come from variables.
- Terminal and scrollbars match the theme.
- Optional: No Bootstrap JS dependency after Track B.

### Sequencing & Effort (rough)
- Days 1–2: Tokenize and build `ybs.css` base; remove Bootstrap CSS; ship compat layer; fix obvious regressions.
- Day 3: Component polish (buttons, navbar, tabs, dropdowns, modals, forms, list groups, utilities).
- Day 4: Editor/Terminal theme + scrollbars + accessibility pass.
- Day 5: Optional `ybui.js` behaviors and Bootstrap JS removal.

### Notes on Navbar Color
- Introduce `--nav-bg` with default `#0a0a0a` (or pick a shade that matches your Dark theme). Switch the navbar to use it immediately so the mismatch with `#212529` disappears without waiting for full Track A completion.

If you want, I can draft `ybs.css` and a first pass of `ybs-compat.css` that covers exactly the classes used in `index.html`, and add the CodeMirror theme styles next.

---

## Status Update — Track A Implemented (2025‑12‑03)

Completed in this commit:
- Removed Bootstrap CSS from index.html and kept Bootstrap Icons + Bootstrap JS bundle.
- Added custom stylesheets:
  - ybs.css — core tokens, utilities, grid subset, navbar, buttons, dropdowns, tabs, forms, modals, list groups, scrollbars, and a CodeMirror theme (.cm-s-yobasic) driven by CSS variables.
  - ybs-compat.css — minimal compatibility mappings for Bootstrap class names used by the app (bg/text utilities, borders, button variants, dropdown caret, collapse, accordion, list group).
- Wired CodeMirror to use the new theme: theme: 'yobasic'.
- Navbar color now governed by --nav-bg (default #0a0a0a), eliminating the old #212529 mismatch.
- Ensured modals, dropdowns, tabs, list groups, and grid/layout used in index.html render under the new styles while Bootstrap JS drives interactions.

What to test now (Track A verification):
- Navbar visual integration and dropdown menus open/close properly.
- Settings, Identity, About, Open and Save As modals open/close with backdrop; focus and buttons look coherent.
- Tabs render and switch; the fixed “+” button and the first tab accent state look correct.
- Forms (inputs/selects/color pickers) in Settings appear styled and focus ring is visible.
- List groups in Open/Save dialogs, and the Explorer list in the left drawer look correct; active state shows.
- Accordion in the left drawer expands/collapses and styles remain legible.
- Editor uses the CodeMirror ‘yobasic’ theme; terminal/colors align with the active theme.
- Scrollbars show customized styling.

Known limitations to revisit after testing:
- Compat layer is intentionally minimal; some Bootstrap utility classes not used in index.html are not implemented.
- Positioning for dropdowns relies on Bootstrap JS default behavior; advanced placement (auto-flip) is not customized.
- Additional spacing utilities may be added on demand when new UI pieces appear.

## Track B — Remaining Tasks (post‑testing)
After Track A stabilizes in testing, proceed with removing Bootstrap JS by introducing a tiny dependency‑free UI layer.

1) Implement ybui.js behaviors
   - Dropdown: click toggle, close on outside/Escape, simple below-trigger positioning, keyboard navigation.
   - Modal: open/close APIs, backdrop injection, focus trap and return, ESC, scroll lock, aria attributes.
   - Tabs: activate/deactivate panels via aria-controls and data attributes; maintain active classes.
   - Collapse/Accordion: expand/collapse with CSS classes; manage data-parent behavior in the left drawer.

2) Replace Bootstrap usages in index.html JS
   - bootstrap.Dropdown → YBUI.Dropdown
   - bootstrap.Modal → YBUI.Modal
   - bootstrap.Tab → YBUI.Tab (or inline activation logic)
   - bootstrap.Collapse → YBUI.Collapse
   - Update event names where code listens for 'show.bs.collapse' to custom events (e.g., 'ybui:show').

3) Remove the Bootstrap bundle
   - Delete the <script> reference to bootstrap.bundle.min.js after verifying parity.

4) Polish and docs
   - Add API notes for YBUI to IMPLEMENTATION-NOTES.md or STYLE_GUIDE.md.
   - Expand compat styles or remove ybs-compat.css as we fully migrate class names to our native layer.

Exit criteria for Track B:
- No Bootstrap JS present; all interactions handled by ybui.js.
- All existing menus/modals/tabs/collapse functionality works as before with keyboard and mouse.
- No visual regressions compared to the end state of Track A.