/**
 * Atomic Play Game Engine (g.js)
 * Core runtime for Atomic Play games.
 */

class AtomicPlayRuntime {
    constructor() {
        this.gameData = null;
        this.state = {
            currentScene: null,
            variables: {}, // state dictionary
            inventory: [], // array of item names/ids
            visited: {}, // sceneName -> count
            outputHistory: [],
            audioState: {
                currentMusic: null
            },
            debugLog: []
        };
        this.interpreter = null;
        this.parser = new AddParser();
        this.ui = null;
        this.isStarted = false;
    }

    async loadGame(url) {
        this.logDebug(`Loading game from ${url}...`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load game file: ${response.statusText}`);
            const text = await response.text();
            this.gameData = this.parser.parse(text);
            this.logDebug(`Game loaded: ${this.gameData.gameName}`);
            
            if (this.gameData.diagnostics.errors.length > 0) {
                console.error("Parser Errors:", this.gameData.diagnostics.errors);
            }
            if (this.gameData.diagnostics.warnings.length > 0) {
                console.warn("Parser Warnings:", this.gameData.diagnostics.warnings);
            }

            return this.gameData;
        } catch (e) {
            this.logDebug(`Error loading game: ${e.message}`, "error");
            throw e;
        }
    }

    initInterpreter() {
        this.logDebug("Initializing BASIC interpreter...");
        this.interpreter = new BasicInterpreter({
            debug: true,
            term: {
                echo: (msg) => this.print(msg)
            },
            hostCallModule: (mod, member, args, interp) => this.handleHostCall(mod, member, args),
        });

        // Load Globals, Cast, Functions
        if (this.gameData.globals.raw) {
            this.interpreter.runProgram(this.gameData.globals.raw);
        }
        if (this.gameData.cast.raw) {
            this.interpreter.runProgram(this.gameData.cast.raw);
        }
        if (this.gameData.functions.raw) {
            this.interpreter.runProgram(this.gameData.functions.raw);
        }

        // Expose engine primitives as built-in functions by wrapping them in BASIC functions if needed,
        // or just rely on hostCallModule for dotted calls.
        // For top-level functions like SAY, PLAYAUDIO, etc., we can inject them.
        
        this.injectEnginePrimitives();
    }

    injectEnginePrimitives() {
        // We can't easily inject JS functions into YoBasic as top-level BASIC functions
        // without modifying basic.js _callFuncBuiltIn.
        // But we can use the dotted call trick or just define them as BASIC functions that call hostCallModule.
        
        const primitives = `
            SUB SAY(avatar, text$)
                CALL ENGINE.SAY(avatar, text$)
            END SUB
            SUB PLAYAUDIO(url$)
                CALL ENGINE.PLAYAUDIO(url$)
            END SUB
            SUB PRINT(text$)
                CALL ENGINE.PRINT(text$)
            END SUB
            FUNCTION STR$(v)
                RETURN ENGINE.STR(v)
            END FUNCTION
        `;
        // Wait, basic.js already has PRINT and STR$.
        // But for SAY and PLAYAUDIO:
        this.interpreter.runProgram(`
            SUB SAY(avatar, msg$)
                CALL ENGINE.SAY(avatar, msg$)
            END SUB
            SUB PLAYAUDIO(u$)
                CALL ENGINE.PLAYAUDIO(u$)
            END SUB
            SUB SHOW(type$, arg$)
                CALL ENGINE.SHOW_OVERLAY(type$, arg$)
            END SUB
        `);
    }

    handleHostCall(mod, member, args) {
        mod = mod.toUpperCase();
        member = member.toUpperCase();

        // Handle Inventory@.add("item")
        if (mod === "INVENTORY@") {
            if (member === "ADD") {
                this.inventoryAdd(args[0]);
                return 1;
            }
            if (member === "HAS") {
                return this.inventoryHas(args[0]) ? 1 : 0;
            }
        }

        // Handle FLAGS@["key"] = val
        // Wait, basic.js handles DICT access if implemented. 
        // Let's check how it handles DICT.
        // If not, we can use ENGINE.GET_FLAG("key") etc.

        if (mod === "ENGINE") {
            if (member === "INIT_OBJECT") {
                const [name, type, ...args] = args;
                if (type === "INVENTORY") {
                    return { __ap_type: type, name: name, items: [], add: (item) => this.inventoryAdd(item), has: (item) => this.inventoryHas(item) };
                }
                if (type === "DICT") {
                    return {}; // Plain JS object works for DICT if basic.js supports it
                }
                if (type === "AVATAR") {
                    return { __ap_type: type, name: name, url: args[0] };
                }
                return { __ap_type: type, name: name, args: args };
            }
            if (member === "SAY") {
                this.say(args[0], args[1]);
                return 1;
            }
            if (member === "PLAYAUDIO") {
                this.playAudio(args[0]);
                return 1;
            }
            if (member === "SHOW_OVERLAY") {
                this.showOverlay(args[0], args[1]);
                return 1;
            }
            if (member === "PRINT") {
                this.print(args[0]);
                return 1;
            }
        }

        this.logDebug(`Unhandled host call: ${mod}.${member}`, "warn");
        return 0;
    }

    async start() {
        if (!this.gameData) throw new Error("Game not loaded");
        
        this.initInterpreter();
        
        const startScene = this.gameData.options.START_SCENE || "Entry";
        await this.transitionTo(startScene);
        this.isStarted = true;
    }

    async transitionTo(sceneName) {
        const scene = this.gameData.scenes[sceneName];
        if (!scene) {
            this.logDebug(`Scene not found: ${sceneName}`, "error");
            return;
        }

        if (this.state.currentScene) {
            const oldScene = this.gameData.scenes[this.state.currentScene];
            if (oldScene && oldScene.onExit) {
                this.executeCode(oldScene.onExit);
            }
        }

        this.state.currentScene = sceneName;
        this.state.visited[sceneName] = (this.state.visited[sceneName] || 0) + 1;
        this.logDebug(`Transitioned to scene: ${sceneName}`);

        if (this.ui) {
            this.ui.renderScene(scene);
            if (scene.music) {
                this.playAudio(scene.music);
            }
        }

        if (scene.onEntry) {
            this.executeCode(scene.onEntry);
        }
    }

    executeCode(code) {
        if (!code) return;
        try {
            // Preprocess for Atomic Play specific syntax
            // Transform "SHOW OVERLAY: Type(Arg)" into "CALL SHOW("Type", Arg)"
            let processed = code.replace(/SHOW OVERLAY:\s*(\w+)\((.*)\)/gi, 'CALL SHOW("$1", $2)');
            // Also handle Inventory without parens
            processed = processed.replace(/SHOW OVERLAY:\s*Inventory\s*$/gi, 'CALL SHOW("Inventory", "")');
            
            this.interpreter.runProgram(processed);
        } catch (e) {
            this.logDebug(`Script error: ${e.message}`, "error");
            console.error(e);
        }
    }

    print(msg) {
        this.state.outputHistory.push(msg);
        if (this.ui) this.ui.renderOutput(msg);
    }

    logDebug(msg, level = "info") {
        const entry = { time: new Date().toLocaleTimeString(), message: msg, level: level };
        this.state.debugLog.push(entry);
        if (this.ui) this.ui.renderDebug(entry);
        console.log(`[AtomicPlay] [${level}] ${msg}`);
    }

    inventoryAdd(item) {
        if (!this.state.inventory.includes(item)) {
            this.state.inventory.push(item);
            this.logDebug(`Added to inventory: ${item}`);
        }
    }

    inventoryHas(item) {
        return this.state.inventory.includes(item);
    }

    say(avatar, msg) {
        // Avatar might be an object if DIM Bella@ AS AVATAR(...) was handled
        // For now, let's assume it's a string or we handle it in UI
        if (this.ui) this.ui.showDialog(avatar, msg);
    }

    playAudio(url) {
        this.logDebug(`Playing audio: ${url}`);
        // Implementation in UI or separate audio manager
        if (this.ui) this.ui.playAudio(url);
    }

    showOverlay(type, arg) {
        this.logDebug(`Showing overlay: ${type} (${arg})`);
        if (this.ui) this.ui.showOverlay(type, arg);
    }
}

window.AtomicPlayRuntime = new AtomicPlayRuntime();
