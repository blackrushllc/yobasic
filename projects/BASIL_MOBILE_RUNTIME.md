## Capacitor vs bare WebView (and why)

You can ship Option A either way, but **Capacitor is the “right default”** for your Basil Runtime.

### Use **Capacitor** if you want:

* **Fast cross-platform shell** (one codebase drives both iOS and Android shells)
* A clean, established **JS ↔ native plugin system** (perfect for your “Library Objects” bridge)
* File handling / share sheet / deep links via plugins or small native glue
* A sane path to add native features later (camera, storage, notifications, etc.)
* A web-first developer workflow (which matches your YoBASIC DNA)

### Use **bare WebView** if you want:

* Maximum control and minimal dependencies
* You’re happy writing native wrappers twice (Swift + Kotlin)
* You want a truly “thin shell” with only a WebView and custom bridge
* You *don’t* want a hybrid framework footprint

### My recommendation

Start with **Capacitor** for the runtime shell because:

* Your runtime is essentially a **web app with controlled native capabilities**
* You explicitly want “Library Objects” and permission-gated features (Capacitor’s plugin model fits perfectly)
* You want to move quickly and iterate on packaging + runtime semantics, not fight native plumbing

If later you decide Capacitor is “too much,” you can migrate to a thinner shell once the contract is stable (package format + runtime API). But going the other direction (bare → featureful plugins) is slower.

---

# Roadmap for Option A: `basic.js` Basil Runtime App

This roadmap assumes the runtime is a single installable app (“Basil Runtime”), and Basil “apps” are `.bpkg` packages (zip) that can be installed/opened.

## Phase 0 — Decisions & contracts (1–2 days of thinking, not coding)

**Deliverables**

1. **Package format**: `.bpkg` (zip)

    * `manifest.json`
    * `icon.png`
    * `app/` (Basil + templates + assets)
    * optional `data/seed/`
2. **Manifest schema v0**

    * `app_id`, `name`, `version`, `entrypoint`
    * `ui_mode` (`forms` | `template` | `fullpage`)
    * `permissions` (strings)
    * `storage` (`quota_mb`)
    * `origin_allowlist` for networking
3. **Runtime API surface v0**

    * `BasilRuntime.installPackage(bytesOrPath)`
    * `BasilRuntime.launch(app_id)`
    * `BasilRuntime.uninstall(app_id)`
    * JS “Library Objects” bridge contract:

        * `LIB(name$)` returns an object whose methods call `nativeInvoke(plugin, method, args)` and return a Promise.

**Why this matters**
Once these are stable, everything else is implementation detail.

---

## Phase 1 — Skeleton runtime shell (MVP that boots)

**Goal:** open the runtime app, see a home screen, run a bundled “Hello Basil App” package.

**Deliverables**

* Capacitor app with:

    * Home screen: Installed apps list (initially static)
    * “Run Demo App” button that launches the demo package
* A minimal embedded `basic.js` runtime + loader:

    * Loads the package’s entrypoint Basil file
    * Renders a single HTML page + hooks events (whatever your simplest flow is)
* A “Demo App” stored in the runtime bundle (not installed yet; just run-from-bundle)

**Acceptance tests**

* App launches on Android emulator
* Tapping demo runs Basil code and updates UI
* No install/uninstall yet

---

## Phase 2 — Package install & sandboxed storage

**Goal:** install `.bpkg` into the runtime’s storage and run it.

**Deliverables**

1. Package installer

    * Import `.bpkg` from:

        * file picker (initial)
        * share sheet “Open with Basil Runtime” (later)
    * Validate:

        * zip structure
        * manifest presence + schema
        * entrypoint exists
2. App registry

    * Persist list of installed apps (JSON index)
    * Each app gets its own directory:

        * `/apps/<app_id>/current/…`
        * `/apps/<app_id>/data/…`
3. Storage API v0

    * key/value store backed by Capacitor Preferences or a small local JSON file
    * optional file storage for assets and app data

**Acceptance tests**

* Install a package from local file
* It appears on home screen with icon + name
* Launch runs it
* Uninstall removes it and its data

---

## Phase 3 — Permissions & capability gating

**Goal:** Basil apps can ask for capabilities and the runtime enforces them.

**Deliverables**

* Permissions UI

    * On first launch (or install), show requested permissions from manifest
    * User can allow/deny per permission
* Enforcement points

    * `LIB("http")` methods check permission + allowlist
    * `LIB("storage")` checks storage permission and quota
* Settings screen

    * per-app permission toggles
    * clear app data
    * view app manifest

**Acceptance tests**

* App requesting `network` cannot call HTTP if denied
* App requesting network can only reach allowed domains
* Permissions persist across launches

---

## Phase 4 — “Library Objects” bridge (native plugins)

**Goal:** make Basil feel mobile-native without making Basil itself huge.

**Deliverables (minimum useful set)**

1. `LIB("device")`

    * `info()` (platform, version, locale)
2. `LIB("storage")`

    * `get(key)`, `set(key,value)`, `remove(key)`
3. `LIB("http")`

    * `get(url, headers?)`, `post(url, body, headers?)`
    * enforce allowlist + timeouts
4. `LIB("ui")`

    * `toast(msg)`
    * `confirm(msg)` → boolean
5. (Optional) `LIB("files")`

    * read/write to app sandbox

**Acceptance tests**

* Basil code can call `LIB("ui").toast("Hi")`
* Async calls resolve back to Basil event loop cleanly

---

## Phase 5 — UX polish: launcher, updates, deep links

**Goal:** “Share a link and it runs.”

**Deliverables**

* Deep link format: `basil://run?url=https://.../myapp.bpkg`
* “Install or Run Once?” prompt
* Update flow:

    * If same `app_id` installed and version differs → update
* Supabase publish compatibility:

    * `.bpkg` served with correct headers
    * runtime downloads and installs

**Acceptance tests**

* Click a link on phone → opens runtime → downloads package → runs
* Updating replaces `/current` but preserves `/data`

---

## Phase 6 — IDE integration & simulator alignment (YoBASIC-style)

**Goal:** devs build in web IDE and “Publish” to run on phone.

**Deliverables**

* Standardize on the same:

    * `manifest.json` schema
    * project layout
    * packaging step (zip + sign)
* “Phone simulator” in web IDE

    * iframe that runs the same runtime web layer
    * mock plugins in browser
* Publish button

    * uploads `.bpkg` to Supabase storage
    * returns share URL + deep link

---

## Phase 7 — Security hardening (do not skip if you want real users)

**Deliverables**

* Package signing (even simple):

    * runtime verifies signature before install/update
* Sandboxing guarantees:

    * no cross-app data access
    * quota enforcement
* Abuse prevention:

    * network limits
    * background execution limits
    * crash loop detection (disable app after N failures)

---

# Junie Ultimate prompt — scaffold the runtime app (Capacitor-based)

Copy/paste this to Junie.

```text
You are Junie Ultimate. Build a scaffold for “Basil Runtime” (Option A) using Capacitor.

GOAL
Create a mobile runtime shell that can run Basil programs using our existing basic.js runtime inside a WebView. Basil “apps” are installed from a single-file package format (.bpkg) which is a zip containing a manifest, icon, and app files. The runtime will list installed apps, allow importing a .bpkg file, installing it into sandbox storage, and launching it.

TARGET
- Cross-platform via Capacitor (Android first; iOS should build but can be untested if time).
- Create the project in a new folder: /projects/basil-runtime (or the most appropriate place if you have a convention).
- Use TypeScript.
- Keep UI simple and clean (one home screen + a runner screen).
- The scaffold must include a bundled demo app package and a minimal loader to run it.

PACKAGE FORMAT (v0)
A .bpkg is a zip with:
- /manifest.json
- /icon.png
- /app/ (contains entrypoint Basil file and any templates/assets)
Manifest schema (v0):
{
  "app_id": "com.blackrush.demo.hellobasil",
  "name": "Hello Basil",
  "version": "0.0.1",
  "entrypoint": "app/main.basil",
  "ui_mode": "fullpage",
  "permissions": ["storage"]
}

RUNTIME BEHAVIOR (v0)
Home screen:
- Shows installed apps list (from a local registry JSON).
- Buttons:
  - “Import Package” (file picker)
  - “Run Bundled Demo” (runs demo without install, ok for phase 1)
- Tapping an installed app launches it.

Install flow (v0):
- User picks a .bpkg file.
- Validate zip contains manifest.json and the entrypoint exists.
- Install into app sandbox:
  - /apps/<app_id>/current/… (unzipped contents)
  - /apps/<app_id>/data/… (created empty)
- Update a registry index:
  - /apps/registry.json with an array of installed apps {app_id, name, version, iconPath, installedAt}

Launch flow (v0):
- The runner view hosts a WebView content page that loads our runtime web layer.
- The runtime web layer reads the installed app files (via a small bridge) and executes basic.js with the app entrypoint.
- For now, it is acceptable to implement the “file system” as:
  - a JS-accessible virtual FS object created from reading the app directory contents via Capacitor Filesystem APIs.

basic.js integration:
- Create a placeholder module in /src/runtime/basicjs_adapter.ts that exposes:
  - loadApp(manifest, vfs) => starts the app
- If you cannot fully execute Basil yet, stub execution by:
  - loading app/index.html if present OR
  - rendering a simple page that prints the manifest + entrypoint text.
But structure the code so swapping in real basic.js execution is straightforward.

LIBRARY OBJECTS BRIDGE (v0)
Implement a very small JS bridge:
- In the runner web layer, expose window.BasilNative.invoke(plugin, method, args) => Promise<any>
- Implement one plugin: “ui”
  - ui.toast(message: string)
Use Capacitor Toast or a simple alert fallback.

FILES & FOLDERS
Create:
- /src/
  - /ui/ (home + runner views)
  - /pkg/ (bpkg installer: unzip, validate, registry)
  - /runtime/ (runner web layer, basicjs_adapter, native bridge)
- /demo_packages/hello_basil/ (source folder for demo app)
- /demo_packages/hello_basil.bpkg (built zip committed to repo or built at dev time)
Add npm scripts:
- npm run dev (capacitor web)
- npm run android (build + open android)
- npm run build:demo (creates the demo .bpkg from folder)

IMPLEMENTATION NOTES
- Use a zip library compatible with Capacitor (e.g., fflate or jszip) for unzip.
- Use @capacitor/filesystem to store installed apps and registry.json.
- Keep everything strongly typed.
- Provide clear README:
  - how to run on Android emulator
  - how to import a package
  - where apps are stored
  - how to build a .bpkg demo

DELIVERABLES
1) A working Capacitor project that builds and runs.
2) Home screen lists apps and can import a .bpkg.
3) Installing writes to filesystem + updates registry.
4) Runner screen loads installed app content and shows *something* (real basic.js execution if possible; otherwise stub with clear TODO).
5) A bundled demo app package and script to build it.
6) Clean code, comments, and TODO markers for next phases (permissions, allowlist, signing, deeper basic.js integration).

Keep scope tight. Produce a scaffold we can iterate on quickly.
```

---


# a concrete `manifest.json` JSON Schema

Here’s a concrete, **paste-ready `manifest.schema.json`** for Basil packages (`.bpkg`) that’s strict enough to be useful, but flexible enough to evolve. It includes a `schema_version`, permission model, storage quota, network allowlist, deep-linking intent, and optional UI metadata.

> **Filename suggestion:** `manifest.schema.json`
> **Intended manifest name in package:** `manifest.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://blackrushbasic.com/schemas/basil/manifest.schema.json",
  "title": "Basil Package Manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "app_id", "name", "version", "entrypoint", "ui"],

  "properties": {
    "schema_version": {
      "type": "integer",
      "description": "Manifest schema version for forwards/backwards compatibility.",
      "minimum": 1
    },

    "app_id": {
      "type": "string",
      "description": "Stable unique app identifier. Reverse-DNS recommended.",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$",
      "minLength": 3,
      "maxLength": 160
    },

    "name": {
      "type": "string",
      "description": "Human-friendly app name.",
      "minLength": 1,
      "maxLength": 64
    },

    "version": {
      "type": "string",
      "description": "SemVer string recommended.",
      "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
      "maxLength": 64
    },

    "build": {
      "type": "object",
      "description": "Optional build metadata. Not used for update ordering by default.",
      "additionalProperties": false,
      "properties": {
        "build_number": { "type": "integer", "minimum": 0 },
        "commit": { "type": "string", "maxLength": 80 },
        "timestamp_utc": {
          "type": "string",
          "format": "date-time"
        }
      }
    },

    "description": {
      "type": "string",
      "description": "Short marketing description.",
      "maxLength": 512
    },

    "author": {
      "type": "object",
      "description": "Publisher metadata.",
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "maxLength": 128 },
        "email": { "type": "string", "format": "email", "maxLength": 254 },
        "url": { "type": "string", "format": "uri", "maxLength": 2048 }
      }
    },

    "entrypoint": {
      "type": "string",
      "description": "Path (within the package) to the Basil file to run on launch.",
      "pattern": "^(app\\/)[^\\0]*\\.basil$",
      "maxLength": 512
    },

    "icon": {
      "type": "object",
      "description": "App icon references inside the package.",
      "additionalProperties": false,
      "properties": {
        "path": {
          "type": "string",
          "description": "Path to the primary icon in the package.",
          "pattern": "^(icon\\/|assets\\/|app\\/)[^\\0]*\\.(png|jpg|jpeg|webp)$",
          "maxLength": 512
        },
        "adaptive_path": {
          "type": "string",
          "description": "Optional adaptive icon (Android) or alternate icon.",
          "pattern": "^(icon\\/|assets\\/|app\\/)[^\\0]*\\.(png|jpg|jpeg|webp)$",
          "maxLength": 512
        }
      }
    },

    "ui": {
      "type": "object",
      "description": "UI runtime configuration for the Basil Runtime host app.",
      "additionalProperties": false,
      "required": ["mode"],
      "properties": {
        "mode": {
          "type": "string",
          "description": "How this app renders UI in the runtime.",
          "enum": ["forms", "template", "fullpage"]
        },

        "orientation": {
          "type": "string",
          "description": "Preferred orientation; runtime may honor or ignore.",
          "enum": ["any", "portrait", "landscape"]
        },

        "theme": {
          "type": "string",
          "description": "Hint to runtime for default theme styling.",
          "enum": ["system", "light", "dark"]
        },

        "start_url": {
          "type": "string",
          "description": "Optional initial URL or template path for fullpage apps (within package).",
          "pattern": "^(app\\/|ui\\/|assets\\/)[^\\0]*\\.(html|htm)$",
          "maxLength": 512
        }
      }
    },

    "permissions": {
      "type": "array",
      "description": "Capabilities requested by the app. Runtime uses these to prompt user and gate APIs.",
      "items": {
        "type": "string",
        "enum": [
          "storage",
          "network",
          "camera",
          "microphone",
          "notifications",
          "files",
          "location",
          "clipboard",
          "contacts"
        ]
      },
      "uniqueItems": true,
      "default": []
    },

    "storage": {
      "type": "object",
      "description": "Storage constraints and defaults for this app.",
      "additionalProperties": false,
      "properties": {
        "quota_mb": {
          "type": "integer",
          "description": "Requested storage quota in MB. Runtime may clamp.",
          "minimum": 1,
          "maximum": 2048,
          "default": 32
        },
        "clear_on_uninstall": {
          "type": "boolean",
          "description": "Whether to delete app data on uninstall.",
          "default": true
        }
      }
    },

    "network": {
      "type": "object",
      "description": "Network policy hints. Runtime should enforce allowlists when possible.",
      "additionalProperties": false,
      "properties": {
        "allowlist": {
          "type": "array",
          "description": "Allowed origins for HTTP requests. Use origins (scheme+host+optional port).",
          "items": {
            "type": "string",
            "maxLength": 2048,
            "pattern": "^(https?:\\/\\/)(\\*\\.)?[A-Za-z0-9.-]+(?::\\d{1,5})?$"
          },
          "uniqueItems": true,
          "default": []
        },
        "denylist": {
          "type": "array",
          "description": "Optional denylist (evaluated before allowlist).",
          "items": {
            "type": "string",
            "maxLength": 2048,
            "pattern": "^(https?:\\/\\/)(\\*\\.)?[A-Za-z0-9.-]+(?::\\d{1,5})?$"
          },
          "uniqueItems": true,
          "default": []
        },
        "timeout_ms": {
          "type": "integer",
          "description": "Default request timeout.",
          "minimum": 1000,
          "maximum": 120000,
          "default": 15000
        }
      }
    },

    "routes": {
      "type": "abilRuntime.launch('route') or deep links.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": {
          "path": {
            "type": "string",
            "description": "Route key or path; runtime decides semantics.",
            "pattern": "^\\/?[A-Za-z0-9_\\-\\/]*$",
            "maxLength": 256
          },
          "entrypoint": {
            "type": "string",
            "description": "Optional alternate Basil entrypoint for this route.",
            "pattern": "^(app\\/)[^\\0]*\\.basil$",
            "maxLength": 512
          }
        }
      }
    },

    "intents": {
      "type": "object",
      "description": "Optional deep-link / file-open / share intents supported by this app.",
      "additionalProperties": false,
      "properties": {
        "deeplinks": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["scheme"],
            "properties": {
              "scheme": {
                "type": "string",
                "description": "Custom scheme for deeplinks, e.g. 'basilapp'.",
                "pattern": "^[a-z][a-z0-9+.-]{1,31}$"
              },
              "hosts": {
                "type": "array",
                "description": "Optional host allowlist for universal/app links.",
                "items": { "type": "string", "maxLength": 253 },
                "uniqueItems": true
              },
              "path_prefixes": {
                "type": "array",
                "description": "Optional path prefixes recognized by the app.",
                "items": { "type": "string", "maxLength": 256 },
                "uniqueItems": true
              }
            }
          }
        },
        "file_types": {
          "type": "array",
          "description": "File extensions this app can open (inside runtime).",
          "items": {
            "type": "string",
            "pattern": "^\\.[A-Za-z0-9]{1,10}$",
            "maxLength": 12
          },
          "uniqueItems": true
        }
      }
    },

    "security": {
      "type": "object",
      "description": "Security-related options (package signing, minimum runtime version, etc.).",
      "additionalProperties": false,
      "properties": {
        "min_runtime_version": {
          "type": "string",
          "description": "Minimum Basil Runtime version required to run.",
          "maxLength": 64
        },
        "signature": {
          "type": "object",
          "description": "Optional signature metadata. Actual signature bytes may be in package sidecar file.",
          "additionalProperties": false,
          "properties": {
            "algo": {
              "type": "string",
              "enum": ["ed25519", "rsa-pss-sha256"]
            },
            "publisher_key_id": {
              "type": "string",
              "description": "Key ID used by runtime to locate embedded or trusted publisher key.",
              "maxLength": 128
            },
            "manifest_digest": {
              "type": "string",
              "description": "Digest (hex or base64url) of canonicalized manifest content.",
              "maxLength": 256
            }
          }
        }
      }
    }
  }
}
```




# a proposed `registry.json` layout with migrations


Below is a proposed **`registry.json` layout** for the Basil Runtime (Option A) plus a practical **migration system** that lets you evolve the file over time without breaking older installs.

The core idea: **one registry file** that tracks installed apps + per-app install state, and a **`schema_version`** with **pure data migrations**.

---

## `registry.json` (Schema v1) — layout

**Path (suggested):**

* `FilesystemDirectory.Data` → `basil_runtime/registry.json`
* Apps stored under: `basil_runtime/apps/<app_id>/...`

### Example file

```json
{
  "schema_version": 1,
  "created_at_utc": "2026-02-02T14:30:00Z",
  "updated_at_utc": "2026-02-02T15:10:12Z",

  "runtime": {
    "device_install_id": "d3b6c7d2-0f6d-4c31-9f54-6d2f3f7b0a25",
    "runtime_version": "0.1.0"
  },

  "apps": [
    {
      "app_id": "com.blackrush.demo.hellobasil",
      "display_name": "Hello Basil",
      "version": "0.0.1",
      "installed_at_utc": "2026-02-02T15:02:00Z",
      "last_launched_at_utc": "2026-02-02T15:07:41Z",

      "install": {
        "status": "installed",
        "install_id": "a1c2c3b4-1111-2222-3333-444455556666",
        "channel": "local_file",
        "source": {
          "type": "file",
          "uri": "content://com.android.providers.downloads.documents/document/1234"
        }
      },

      "paths": {
        "root_dir": "apps/com.blackrush.demo.hellobasil",
        "current_dir": "apps/com.blackrush.demo.hellobasil/current",
        "data_dir": "apps/com.blackrush.demo.hellobasil/data",
        "icon_path": "apps/com.blackrush.demo.hellobasil/current/icon.png",
        "manifest_path": "apps/com.blackrush.demo.hellobasil/current/manifest.json"
      },

      "entrypoint": "app/main.basil",
      "ui_mode": "fullpage",

      "permissions": {
        "requested": ["storage"],
        "granted": ["storage"],
        "denied": [],
        "prompted_at_utc": "2026-02-02T15:02:03Z"
      },

      "storage": {
        "quota_mb": 32,
        "usage_bytes": 1048576
      },

      "integrity": {
        "package_hash": {
          "algo": "sha256",
          "hex": "f4d2c8...deadbeef"
        },
        "signature": {
          "verified": false,
          "algo": "ed25519",
          "publisher_key_id": "devkey-1"
        }
      },

      "update_policy": {
        "allow_updates": true,
        "allow_downgrades": false
      },

      "notes": {
        "pinned": false,
        "tags": ["demo"]
      }
    }
  ],

  "disabled_apps": [
    {
      "app_id": "com.blackrush.badapp",
      "reason": "crash_loop",
      "disabled_at_utc": "2026-02-02T15:09:00Z",
      "cooldown_until_utc": "2026-02-02T16:09:00Z"
    }
  ]
}
```

### Why this shape works well

* `apps[]` is the authoritative installed list.
* Each app entry contains:

    * **what** is installed (`version`, `entrypoint`, `ui_mode`)
    * **where** it lives (`paths`)
    * **how** it got there (`install.source`, channel)
    * **runtime state** (permissions, last launched, crash handling)
    * **integrity hooks** (hash/signature) for later hardening

---

## Migration strategy (simple, robust)

### Rules

1. `schema_version` is an integer.
2. On startup:

    * if registry missing → create with latest schema version.
    * if older version → run migrations sequentially: `v1 → v2 → v3...`
3. Migrations are **pure** (input JSON → output JSON).
4. Always keep a `registry.json.bak` before writing the migrated file.

### Capacitor-friendly pseudocode

```ts
type RegistryAny = any;

const LATEST_SCHEMA_VERSION = 3;

async function loadRegistry(): Promise<RegistryAny> {
  const reg = await readJsonOrNull("basil_runtime/registry.json");
  if (!reg) return createRegistryV3();

  const migrated = migrateRegistry(reg);
  if (migrated.didChange) {
    await writeJsonBackupThenReplace(reg, migrated.value);
  }
  return migrated.value;
}

function migrateRegistry(reg: RegistryAny): { didChange: boolean; value: RegistryAny } {
  let changed = false;
  let v = reg;

  if (!Number.isInteger(v.schema_version)) {
    // Treat missing/invalid as legacy v0
    v.schema_version = 0;
    changed = true;
  }

  while (v.schema_version < LATEST_SCHEMA_VERSION) {
    if (v.schema_version === 0) { v = migrateV0toV1(v); changed = true; continue; }
    if (v.schema_version === 1) { v = migrateV1toV2(v); changed = true; continue; }
    if (v.schema_version === 2) { v = migrateV2toV3(v); changed = true; continue; }
    throw new Error(`No migration found for schema_version=${v.schema_version}`);
  }

  return { didChange: changed, value: v };
}
```

---

## Proposed migrations

### Legacy v0 (initial MVP) assumption

Your early scaffold might have something like:

```json
{
  "apps": [
    {
      "app_id": "com.example",
      "name": "Example",
      "version": "0.0.1",
      "iconPath": "apps/com.example/icon.png",
      "installedAt": 1738512000000
    }
  ]
}
```

#### Migration: v0 → v1

**Goals:**

* Add `schema_version`
* Standardize timestamps to `*_utc`
* Rename fields:

    * `name` → `display_name`
    * `iconPath` → `paths.icon_path`
    * `installedAt` epoch → `installed_at_utc` ISO
* Add required structures (`paths`, `install`, `permissions`, etc.) with defaults

```ts
function migrateV0toV1(v0: any): any {
  const now = new Date().toISOString();

  const apps = Array.isArray(v0.apps) ? v0.apps : [];
  const v1apps = apps.map((a: any) => {
    const installedAtIso =
      typeof a.installedAt === "number"
        ? new Date(a.installedAt).toISOString()
        : (a.installed_at_utc ?? now);

    const app_id = a.app_id ?? a.appId ?? "unknown.app";
    const root = `apps/${app_id}`;

    return {
      app_id,
      display_name: a.display_name ?? a.name ?? "Unnamed App",
      version: a.version ?? "0.0.0",
      installed_at_utc: installedAtIso,
      last_launched_at_utc: null,

      install: {
        status: "installed",
        install_id: cryptoRandomUuid(),
        channel: "unknown",
        source: { type: "unknown" }
      },

      paths: {
        root_dir: root,
        current_dir: `${root}/current`,
        data_dir: `${root}/data`,
        icon_path: a.iconPath ?? a.icon_path ?? `${root}/current/icon.png`,
        manifest_path: `${root}/current/manifest.json`
      },

      entrypoint: a.entrypoint ?? "app/main.basil",
      ui_mode: a.ui_mode ?? "fullpage",

      permissions: {
        requested: Array.isArray(a.permissions) ? a.permissions : [],
        granted: [],
        denied: [],
        prompted_at_utc: null
      },

      storage: {
        quota_mb: 32,
        usage_bytes: 0
      },

      integrity: {
        package_hash: null,
        signature: { verified: false }
      },

      update_policy: { allow_updates: true, allow_downgrades: false },
      notes: { pinned: false, tags: [] }
    };
  });

  return {
    schema_version: 1,
    created_at_utc: v0.created_at_utc ?? now,
    updated_at_utc: now,
    runtime: {
      device_install_id: v0.device_install_id ?? cryptoRandomUuid(),
      runtime_version: v0.runtime_version ?? "0.0.0"
    },
    apps: v1apps,
    disabled_apps: []
  };
}
```

---

### Migration: v1 → v2

**Reason to introduce v2:** you’ll almost certainly want **stable sorting** + **app launch health** soon.

**Changes:**

* Add `sort_key` per app (string)
* Add `health` block: crash tracking
* Move `notes.pinned` → top-level `pinned` (optional preference)
* Ensure `display_name` exists
* Ensure `paths.current_dir` exists

**v2 app shape additions**

```json
"sort_key": "hello basil",
"health": {
  "crash_count_24h": 0,
  "last_crash_at_utc": null,
  "crash_loop_disabled": false
}
```

```ts
function migrateV1toV2(v1: any): any {
  const now = new Date().toISOString();
  const apps = Array.isArray(v1.apps) ? v1.apps : [];

  const v2apps = apps.map((a: any) => {
    const display = a.display_name ?? a.name ?? "Unnamed App";
    const root = a.paths?.root_dir ?? `apps/${a.app_id}`;

    return {
      ...a,
      display_name: display,
      sort_key: (display || "").toLowerCase(),
      paths: {
        root_dir: root,
        current_dir: a.paths?.current_dir ?? `${root}/current`,
        data_dir: a.paths?.data_dir ?? `${root}/data`,
        icon_path: a.paths?.icon_path ?? `${root}/current/icon.png`,
        manifest_path: a.paths?.manifest_path ?? `${root}/current/manifest.json`
      },
      pinned: a.pinned ?? a.notes?.pinned ?? false,
      health: a.health ?? {
        crash_count_24h: 0,
        last_crash_at_utc: null,
        crash_loop_disabled: false
      },
      notes: a.notes ?? { pinned: false, tags: [] }
    };
  });

  return {
    ...v1,
    schema_version: 2,
    updated_at_utc: now,
    apps: v2apps
  };
}
```

---

### Migration: v2 → v3

**Reason to introduce v3:** as soon as you add downloading packages via URL and updates, you’ll want `install.source` standardized and you’ll want to record `active_release`.

**Changes:**

* Add `release` block:

    * `installed_version`, `installed_manifest_hash`, `install_time`
* Normalize `install.source` into a consistent shape:

    * `type`: `file` | `url` | `share` | `bundled` | `unknown`
    * `uri`: string
* Add `history` block for last N install/update events (small array)

**v3 additions**

```json
"release": {
  "installed_version": "0.0.1",
  "manifest_hash": { "algo": "sha256", "hex": "..." }
},
"history": {
  "events": [
    { "type": "install", "at_utc": "....", "version": "0.0.1", "source": { "type": "file", "uri": "..." } }
  ]
}
```

```ts
function migrateV2toV3(v2: any): any {
  const now = new Date().toISOString();
  const apps = Array.isArray(v2.apps) ? v2.apps : [];

  const v3apps = apps.map((a: any) => {
    const src = a.install?.source ?? { type: "unknown" };
    const normalizedSource =
      src.type === "file" || src.type === "url" || src.type === "bundled" || src.type === "share"
        ? { type: src.type, uri: src.uri ?? null }
        : { type: "unknown", uri: src.uri ?? null };

    const manifestHash = a.integrity?.package_hash
      ? { algo: a.integrity.package_hash.algo ?? "sha256", hex: a.integrity.package_hash.hex ?? null }
      : null;

    return {
      ...a,
      install: {
        ...(a.install ?? {}),
        source: normalizedSource
      },
      release: a.release ?? {
        installed_version: a.version ?? "0.0.0",
        manifest_hash: manifestHash
      },
      history: a.history ?? {
        events: [
          {
            type: "install",
            at_utc: a.installed_at_utc ?? now,
            version: a.version ?? "0.0.0",
            source: normalizedSource
          }
        ]
      }
    };
  });

  return {
    ...v2,
    schema_version: 3,
    updated_at_utc: now,
    apps: v3apps
  };
}
```

---

## Operational notes (so this doesn’t bite you later)

### 1) Keep the registry “small”

Don’t store large blobs, logs, or templates inside it. Use separate per-app folders for:

* logs: `apps/<id>/data/logs/*.log`
* caches: `apps/<id>/data/cache/`
* preferences: `apps/<id>/data/prefs.json` (optional)

### 2) Treat `app_id` as immutable

If a manifest changes `app_id`, it’s a *different app*.

### 3) Decide your update identity

Recommended update key:

* same `app_id`
* `version` SemVer ordering (or compare `build.build_number` if you want)
* obey `allow_downgrades`

### 4) Keep migrations pure and tested

Add a tiny test folder:

* `migrations/fixtures/v0.json`, `v1.json`, etc.
* expected outputs `expected_v1.json`, etc.

# a simple signing plan (public key baked into runtime, packages signed by publisher key)

Here’s a simple, solid signing plan that fits your Option A runtime and keeps implementation complexity low while still giving you real integrity and publisher trust.

The design goals:

* ✅ **Runtime can verify packages offline**
* ✅ **Publishers sign packages with their private key**
* ✅ **Runtime ships with a trust store (public keys)**
* ✅ **Works with Supabase URLs + local file installs**
* ✅ Minimal crypto surface area: **Ed25519** + **SHA-256**

---

## 1) Cryptography choices

### Algorithms

* **Signature:** Ed25519
* **Digest:** SHA-256 (over a canonicalized manifest + file hashes)

Why Ed25519:

* fast, small keys/signatures, widely supported, less footgun-y than RSA.

---

## 2) Trust model: “Trusted Publisher Keys” baked into the runtime

The runtime contains a file like:

**`trusted_publishers.json`** (bundled in the app build)

```json
{
  "schema_version": 1,
  "publishers": [
    {
      "publisher_id": "blackrush",
      "display_name": "Blackrush LLC",
      "key_id": "blackrush-ed25519-2026-01",
      "algo": "ed25519",
      "public_key_b64": "11qYAYKx...<base64>...l8=",
      "scopes": ["can_install", "can_update"],
      "added_at_utc": "2026-02-02T00:00:00Z"
    }
  ]
}
```

Runtime policy:

* If a package is signed by a **known key_id** in this trust list → **Verified Publisher**
* If signed but key unknown → **Untrusted Publisher** (you can choose to warn or block)
* If unsigned → **Unsigned** (you can allow in dev mode, warn in prod)

**Recommended UX policy**

* **Dev builds:** allow unsigned + unknown, show warning badge
* **Prod builds:** allow unsigned only if user explicitly enables “Allow unsigned apps” in Settings (off by default)

This lets you safely support hobbyists while still being secure by default.

---

## 3) Package layout: `.bpkg` + sidecar signature file

Keep the `.bpkg` as a zip, and add a signature file inside it:

```
myapp.bpkg  (zip)
  manifest.json
  icon.png
  app/main.basil
  assets/...
  META-INF/
    signature.json
```

### `META-INF/signature.json` (v1)

```json
{
  "schema_version": 1,
  "algo": "ed25519",
  "key_id": "blackrush-ed25519-2026-01",
  "publisher_id": "blackrush",

  "signed_at_utc": "2026-02-02T15:00:00Z",

  "payload": {
    "manifest_canonical_sha256_hex": "b1f3...",

    "files": [
      { "path": "manifest.json", "sha256_hex": "b1f3..." },
      { "path": "icon.png", "sha256_hex": "81aa..." },
      { "path": "app/main.basil", "sha256_hex": "f0c2..." },
      { "path": "assets/splash.png", "sha256_hex": "9a44..." }
    ]
  },

  "signature_b64": "MEUCIQDU...<base64 signature bytes>...="
}
```

Key points:

* We sign a **payload** that includes hashes for every file in the package.
* At install time, runtime hashes the extracted files and compares.
* That prevents tampering even if someone alters a single byte.

---

## 4) Canonicalization rules (keep it simple)

To avoid signature breaks due to whitespace/key ordering differences:

### Manifest canonicalization (recommended)

When computing `manifest_canonical_sha256_hex`:

1. Parse `manifest.json` as JSON.
2. Re-serialize with:

    * UTF-8
    * sorted keys (lexicographic)
    * no insignificant whitespace
3. Hash those canonical bytes with SHA-256.

This is commonly called “canonical JSON.” You don’t need full JCS complexity at first; a deterministic stringify with stable key ordering is good enough.

### File hashing

For each file in the package (except `META-INF/signature.json` itself):

* hash the raw bytes (SHA-256)

**Exclude list**

* exclude `META-INF/signature.json` from `files` list
* (optional later) allow `META-INF/*` except signature

---

## 5) Signing workflow for publishers

A publisher has:

* **Ed25519 private key** (kept secret; used by your publish pipeline / CLI tool)
* **Public key** (baked into runtime trust list, or distributed)

### Publisher CLI: `basilpkg sign`

Suggested flow:

1. Build `.bpkg` zip without signature.
2. Compute hashes of all package files.
3. Compute canonical manifest hash.
4. Create `META-INF/signature.json` with payload.
5. Sign canonical bytes of the `payload` object (not the entire signature.json file).
6. Insert signature.json into the zip.

That way the signature is stable and verification is straightforward.

**What exact bytes get signed?**

* canonical JSON bytes of `signature.payload` only (sorted keys).

---

## 6) Verification workflow in the runtime

When installing/updating a package:

1. Unzip to temp directory.
2. Read `manifest.json` and `META-INF/signature.json` (if present).
3. If signature present:

    * Find publisher key by `key_id` in `trusted_publishers.json`
    * Canonicalize `signature.payload`, verify `signature_b64` using public key
    * Re-hash all files listed in payload and compare hashes
    * If all good: mark `integrity.signature.verified = true` in `registry.json`
4. If signature missing:

    * mark as unsigned
    * apply policy (allow with warning or block)

### Registry fields (tie-in)

Store something like:

```json
"integrity": {
  "package_hash": { "algo": "sha256", "hex": "<optional: hash of zip bytes>" },
  "signature": {
    "present": true,
    "verified": true,
    "key_id": "blackrush-ed25519-2026-01",
    "publisher_id": "blackrush",
    "verified_at_utc": "2026-02-02T15:02:00Z"
  }
}
```

---

## 7) Updates and downgrade protection

When installing a package with an `app_id` already installed:

* If **existing app is verified**, require that **update is signed by the same publisher key**, unless the runtime trust list explicitly allows key rotation.
* Default: **block downgrades** unless `allow_downgrades` is enabled.

### Key rotation (simple approach)

In `trusted_publishers.json`, allow a publisher to list multiple keys and mark one as “current”:

```json
{
  "publisher_id": "blackrush",
  "keys": [
    { "key_id": "blackrush-ed25519-2026-01", "public_key_b64": "...", "status": "retired" },
    { "key_id": "blackrush-ed25519-2026-06", "public_key_b64": "...", "status": "current" }
  ]
}
```

Runtime policy:

* Allow update if:

    * same publisher_id, and
    * signing key is one of the trusted keys for that publisher

---

## 8) Minimal “developer mode” for early experimentation

Add a runtime setting:

* `Developer Mode: ON/OFF`
* When ON:

    * allow unsigned installs
    * allow unknown keys
    * still hash files and store a package hash (tamper evidence)

When OFF:

* require:

    * signature present
    * key trusted
    * signature verified

This will keep your early ecosystem fun while providing a real path to production security.

---

## 9) What you (Erik) need to do before coding

Action items:

1. Decide initial publisher set:

    * likely only `blackrush` at first
2. Generate an Ed25519 keypair:

    * store private key in a safe place (password manager / offline file)
    * embed public key in runtime’s `trusted_publishers.json`
3. Decide policy defaults:

    * allow unsigned only in dev mode vs allow with warning in prod
4. Add `key_id` conventions:

    * `blackrush-ed25519-YYYY-MM`

---

## 10) Next deliverables I can provide if you want

* A JSON Schema for `META-INF/signature.json`
* A deterministic “canonical JSON” helper (TypeScript)
* A `basilpkg` CLI skeleton plan (Node or Rust)
* A tiny verification module interface for the runtime:
    * `verifyPackage(unzippedDir) => {status, publisher, warnings}`
