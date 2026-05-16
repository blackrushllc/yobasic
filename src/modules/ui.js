/**
 * Atomic Play Scene Renderer (ui.js)
 */

class SceneRenderer {
    constructor(runtime) {
        this.runtime = runtime;
        this.runtime.ui = this;
        this.$videoArea = $('#ap-video-area');
        this.$controlsArea = $('#ap-controls-area');
        this.$outputArea = $('#ap-output-area');
        this.$debugArea = $('#ap-debug-area');

        this.init();
    }

    init() {
        // Ensure areas have correct IDs if they don't
        if (this.$videoArea.length === 0) {
            $('.square.red').attr('id', 'ap-video-area');
            this.$videoArea = $('#ap-video-area');
        }
        if (this.$controlsArea.length === 0) {
            $('.square.green').attr('id', 'ap-controls-area');
            this.$controlsArea = $('#ap-controls-area');
        }
        if (this.$outputArea.length === 0) {
            $('.square.blue').attr('id', 'ap-output-area');
            this.$outputArea = $('#ap-output-area');
        }
        if (this.$debugArea.length === 0) {
            $('<div id="ap-debug-area" class="debug-panel"></div>').insertAfter('.squares-row');
            this.$debugArea = $('#ap-debug-area');
        }

        // Setup Output Area styles
        this.$outputArea.css({
            'overflow-y': 'auto',
            'padding': '10px',
            'font-family': 'monospace',
            'color': '#fff',
            'background-color': '#000088' // Classic blue
        });

        // Setup Debug Area styles
        this.$debugArea.css({
            'padding': '10px',
            'background': '#222',
            'color': '#0f0',
            'font-family': 'monospace',
            'font-size': '11px',
            'margin-top': '10px',
            'border': '1px solid #444',
            'max-height': '200px',
            'overflow-y': 'auto'
        }).html('<div>Atomic Play Debug Panel <button id="ap-btn-reload" style="font-size:9px;">Reload</button> <button id="ap-btn-restart" style="font-size:9px;">Restart</button> <button id="ap-btn-clear" style="font-size:9px;">Clear</button></div><hr>');

        this.$debugArea.on('click', '#ap-btn-reload', () => window.location.reload());
        this.$debugArea.on('click', '#ap-btn-restart', () => {
            this.runtime.state = {
                currentScene: null,
                visited: {},
                vars: {},
                inventory: []
            };
            this.$outputArea.empty();
            this.runtime.start();
        });
        this.$debugArea.on('click', '#ap-btn-clear', () => this.$outputArea.empty());
    }

    renderScene(scene) {
        this.renderVideo(scene.vurl);
        this.renderControls(scene.controls);
        this.renderMetadata(scene);
    }

    renderVideo(vurl) {
        if (!vurl) {
            this.$videoArea.empty().append('<div class="no-video">No Video</div>');
            return;
        }

        const videoHtml = `
            <video autoplay loop muted style="width:100%; height:100%; object-fit:cover;">
                <source src="${vurl}" type="video/mp4">
            </video>
        `;
        this.$videoArea.empty().append(videoHtml);
    }

    renderMetadata(scene) {
        // Overlay metadata on video area or show elsewhere
        const metaHtml = `
            <div class="scene-meta" style="position:absolute; bottom:10px; left:10px; color:#fff; text-shadow:1px 1px 2px #000;">
                <div class="scene-title" style="font-weight:bold; font-size:1.2em;">${scene.title}</div>
                <div class="scene-location" style="font-size:0.9em; opacity:0.8;">${scene.location}</div>
            </div>
        `;
        this.$videoArea.css('position', 'relative').append(metaHtml);
    }

    renderControls(controls) {
        this.$controlsArea.empty();
        
        const sections = {
            top: $('<div class="ctrl-section top"></div>').appendTo(this.$controlsArea),
            middle: $('<div class="ctrl-section middle"></div>').appendTo(this.$controlsArea),
            bottom: $('<div class="ctrl-section bottom"></div>').appendTo(this.$controlsArea)
        };

        controls.forEach(ctrl => {
            if (this.shouldHide(ctrl)) return;

            const $btn = $('<button class="ap-btn"></button>')
                .text(ctrl.label)
                .prop('disabled', this.shouldDisable(ctrl))
                .on('click', () => this.handleControlClick(ctrl));

            const section = sections[ctrl.section] || sections.middle;
            section.append($btn);
        });

        // Add some basic styling to sections
        this.$controlsArea.css({
            'display': 'flex',
            'flex-direction': 'column',
            'justify-content': 'space-around',
            'padding': '10px',
            'gap': '10px'
        });
        $('.ctrl-section').css({
            'display': 'flex',
            'flex-wrap': 'wrap',
            'gap': '5px',
            'justify-content': 'center'
        });
        $('.ap-btn').css({
            'padding': '8px 12px',
            'cursor': 'pointer',
            'background': '#eee',
            'border': '2px solid #666',
            'font-weight': 'bold'
        });
    }

    shouldHide(ctrl) {
        if (!ctrl.hideIf) return false;
        try {
            return !!this.runtime.interpreter._evalExpression(ctrl.hideIf);
        } catch (e) {
            return false;
        }
    }

    shouldDisable(ctrl) {
        if (!ctrl.enableIf) return false;
        try {
            return !this.runtime.interpreter._evalExpression(ctrl.enableIf);
        } catch (e) {
            return false;
        }
    }

    handleControlClick(ctrl) {
        if (ctrl.onUse) {
            this.runtime.executeCode(ctrl.onUse);
        }
        if (ctrl.target && ctrl.target !== "self") {
            this.runtime.transitionTo(ctrl.target);
        } else {
            // Re-render controls in case state changed
            this.renderControls(this.runtime.gameData.scenes[this.runtime.state.currentScene].controls);
        }
    }

    renderOutput(msg) {
        const $line = $('<div class="output-line"></div>').text(msg);
        this.$outputArea.append($line);
        this.$outputArea.scrollTop(this.$outputArea[0].scrollHeight);
    }

    renderDebug(entry) {
        const $entry = $('<div></div>').css('color', entry.level === 'error' ? '#f00' : (entry.level === 'warn' ? '#ff0' : '#0f0'))
            .text(`[${entry.time}] ${entry.message}`);
        this.$debugArea.append($entry);
        this.$debugArea.scrollTop(this.$debugArea[0].scrollHeight);
    }

    showDialog(avatar, msg) {
        let name = avatar;
        if (avatar && typeof avatar === 'object') {
            name = avatar.name || "System";
        }
        this.renderOutput(`[${name}] ${msg}`);
    }

    playAudio(url) {
        const audio = new Audio(url);
        audio.play().catch(e => console.warn("Audio play failed:", e));
    }

    showOverlay(type, arg) {
        // Delegate to OverlayManager instance if present, or show simple alert
        if (window.OverlayManagerInstance) {
            window.OverlayManagerInstance.show(type, arg);
        } else if (window.OverlayManager && typeof window.OverlayManager.show === 'function') {
            window.OverlayManager.show(type, arg);
        } else {
            alert(`Overlay: ${type}\n${arg}`);
        }
    }
}

window.SceneRenderer = SceneRenderer;
