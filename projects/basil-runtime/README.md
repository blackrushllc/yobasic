# Basil Mobile Runtime

A Capacitor-based mobile shell for running Basil (.bpkg) packages.

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Build the bundled demo package**:
    ```bash
    npm run build:demo
    ```

3.  **Run in development (web)**:
    ```bash
    npm run dev
    ```

4.  **Run on Android**:
    ```bash
    npm run android
    ```
    *Note: Requires Android Studio and a configured emulator or device.*

## Project Structure

-   `/src/pkg`: Package installer, registry management, and `.bpkg` (zip) extraction logic.
-   `/src/runtime`: The web-to-native bridge and `basic.js` adapter (execution host).
-   `/src/ui`: Home screen (app list) and Runner screen (app execution).
-   `/demo_packages`: Source files for bundled apps.
-   `/scripts`: Build tools for creating `.bpkg` files.

## Package Format (.bpkg)

A `.bpkg` is a zip file containing:
-   `manifest.json`: App metadata (id, name, version, entrypoint).
-   `icon.png`: App icon.
-   `app/`: Directory containing Basil source files and assets.

## Bridge API

Basil apps can call native functions via the bridge:
```basil
LIB("ui").toast("Hello from Basil!")
```

Current supported plugins:
-   `ui`: `toast(message)`
