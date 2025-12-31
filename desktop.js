/**
 * YoBASIC Desktop (desktop.js)
 */

$(function() {
    const $desktop = $('#desktop-area');
    const $windowContainer = $('#window-container');
    const $taskbarItems = $('#taskbar-items');
    const $iconsGrid = $('#desktop-icons-grid');
    const $windowMenu = $('#dropdown-window');

    // Initialize VFS
    const vfs = new VirtualFileSystem({ localStorageKey: 'yobasic.vfs' });
    vfs.loadFromLocalStorage();
    window.vfs = vfs; 
    window.__vfsInstance__ = vfs;

    let zIndexCounter = 1000;

    /**
     * Icon Mapping
     */
    const IconMap = {
        'folder': 'bi-folder',
        'folder-open': 'bi-folder2-open',
        'file-text': 'bi-file-earmark-text',
        'file-code': 'bi-file-earmark-code',
        'file-js': 'bi-filetype-js',
        'file-html': 'bi-filetype-html',
        'file-css': 'bi-filetype-css',
        'file-bas': 'bi-terminal',
        'file-pdf': 'bi-file-earmark-pdf',
        'file-zip': 'bi-file-earmark-zip',
        'file-img': 'bi-file-earmark-image',
        'file-music': 'bi-file-earmark-music',
        'file-play': 'bi-file-earmark-play',
        'link': 'bi-link-45deg',
        'gear': 'bi-gear',
        'info': 'bi-info-circle',
        'chat': 'bi-chat-dots',
        'download': 'bi-download',
        'windows': 'bi-windows',
        'box': 'bi-box-seam'
    };

    function getIconForExt(ext) {
        ext = (ext || '').toLowerCase();
        if (ext === 'bas') return IconMap['file-bas'];
        if (ext === 'js') return IconMap['file-js'];
        if (ext === 'html') return IconMap['file-html'];
        if (ext === 'css') return IconMap['file-css'];
        if (ext === 'txt') return IconMap['file-text'];
        if (ext === 'pdf') return IconMap['file-pdf'];
        if (ext === 'zip') return IconMap['file-zip'];
        if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return IconMap['file-img'];
        if (['mp3', 'wav', 'ogg'].includes(ext)) return IconMap['file-music'];
        if (['mp4', 'webm', 'avi'].includes(ext)) return IconMap['file-play'];
        return IconMap['file-text'];
    }

    /**
     * Window Manager
     */
    const WindowManager = {
        windows: {},

        createWindow(options) {
            const id = options.id || 'win-' + Math.random().toString(36).substr(2, 9);
            
            if (options.singleton && this.windows[id]) {
                this.focusWindow(id);
                this.restoreWindow(id);
                return this.windows[id];
            }

            const $win = $(`
                <div class="window ${options.className || ''}" id="${id}" style="width: ${options.width || 600}px; height: ${options.height || 400}px; left: ${options.x || 100}px; top: ${options.y || 100}px;">
                    <div class="window-header">
                        <div class="window-title">${options.title || 'Window'}</div>
                        <div class="window-controls">
                            <button class="win-btn btn-min" title="Minimize">_</button>
                            <button class="win-btn btn-max" title="Maximize">□</button>
                            <button class="win-btn btn-close" title="Close">×</button>
                        </div>
                    </div>
                    <div class="window-body"></div>
                    <div class="window-resizer"></div>
                </div>
            `);

            $windowContainer.append($win);

            const winObj = {
                id,
                $el: $win,
                options,
                isMaximized: false,
                isMinimized: false,
                prevRect: null
            };

            this.windows[id] = winObj;

            this.setupWindowEvents(winObj);
            this.addToTaskbar(winObj);
            this.focusWindow(id);

            if (options.onOpen) options.onOpen(winObj);

            this.updateWindowMenu();
            return winObj;
        },

        createWindowMenuBar($win, menuDef) {
            const $menuBar = $('<div class="window-menubar"></div>');
            menuDef.forEach(m => {
                const $menu = $(`<div class="win-menu-dropdown"><button class="win-menu-btn">${m.title}</button></div>`);
                const $dropdown = $('<div class="win-menu-content"></div>');
                m.items.forEach(item => {
                    if (item.separator) {
                        $dropdown.append('<hr>');
                    } else {
                        const $item = $(`<button class="win-menu-item">${item.title}</button>`);
                        $item.click(() => {
                            $dropdown.removeClass('show');
                            item.click();
                        });
                        $dropdown.append($item);
                    }
                });
                $menu.append($dropdown);
                $menu.find('.win-menu-btn').click((e) => {
                    e.stopPropagation();
                    $('.win-menu-content').not($dropdown).removeClass('show');
                    $dropdown.toggleClass('show');
                });
                $menuBar.append($menu);
            });
            $win.find('.window-header').after($menuBar);
            $(document).click(() => $('.win-menu-content').removeClass('show'));
        },

        setupWindowEvents(win) {
            const { $el, id } = win;

            $el.on('mousedown', () => {
                this.focusWindow(id);
            });

            $el.find('.window-header').on('mousedown', (e) => {
                if ($(e.target).hasClass('win-btn')) return;
                if (win.isMaximized) return;

                const startX = e.clientX;
                const startY = e.clientY;
                const startLeft = parseInt($el.css('left'));
                const startTop = parseInt($el.css('top'));

                $(document).on('mousemove.win-drag', (e) => {
                    let left = startLeft + (e.clientX - startX);
                    let top = startTop + (e.clientY - startY);
                    left = Math.max(0, Math.min(left, window.innerWidth - 50));
                    top = Math.max(0, Math.min(top, window.innerHeight - 50));
                    $el.css({ left, top });
                });

                $(document).on('mouseup.win-drag', () => {
                    $(document).off('.win-drag');
                });
            });

            $el.find('.window-resizer').on('mousedown', (e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = $el.width();
                const startHeight = $el.height();

                $(document).on('mousemove.win-resize', (e) => {
                    const width = Math.max(200, startWidth + (e.clientX - startX));
                    const height = Math.max(150, startHeight + (e.clientY - startY));
                    $el.css({ width, height });
                    if (win.options.onResize) win.options.onResize(win);
                });

                $(document).on('mouseup.win-resize', () => {
                    $(document).off('.win-resize');
                });
            });

            $el.find('.btn-min').click(() => this.minimizeWindow(id));
            $el.find('.btn-max').click(() => this.maximizeWindow(id));
            $el.find('.btn-close').click(() => this.closeWindow(id));
        },

        focusWindow(id) {
            const win = this.windows[id];
            if (!win) return;
            $('.window').removeClass('active');
            win.$el.addClass('active').css('z-index', ++zIndexCounter);
            $('.taskbar-item').removeClass('active');
            $(`.taskbar-item[data-id="${id}"]`).addClass('active');
        },

        minimizeWindow(id) {
            const win = this.windows[id];
            win.isMinimized = true;
            win.$el.addClass('minimized');
            $(`.taskbar-item[data-id="${id}"]`).removeClass('active');
        },

        maximizeWindow(id) {
            const win = this.windows[id];
            if (win.isMaximized) {
                const r = win.prevRect;
                win.$el.css({ top: r.top, left: r.left, width: r.width, height: r.height });
                win.isMaximized = false;
                win.$el.find('.btn-max').text('□');
            } else {
                win.prevRect = { top: win.$el.css('top'), left: win.$el.css('left'), width: win.$el.css('width'), height: win.$el.css('height') };
                win.$el.css({ top: 0, left: 0, width: '100%', height: '100%' });
                win.isMaximized = true;
                win.$el.find('.btn-max').text('❐');
            }
            if (win.options.onResize) win.options.onResize(win);
        },

        restoreWindow(id) {
            const win = this.windows[id];
            win.isMinimized = false;
            win.$el.removeClass('minimized');
            this.focusWindow(id);
        },

        closeWindow(id) {
            const win = this.windows[id];
            if (win.options.onClose) {
                if (win.options.onClose(win) === false) return;
            }
            win.$el.remove();
            $(`.taskbar-item[data-id="${id}"]`).remove();
            delete this.windows[id];
            this.updateWindowMenu();
        },

        addToTaskbar(win) {
            const $item = $(`
                <div class="taskbar-item" data-id="${win.id}">
                    <i class="bi ${win.options.icon || 'bi-window'}"></i>
                    <span>${win.options.title}</span>
                </div>
            `);
            $item.click(() => {
                if (win.isMinimized || !win.$el.hasClass('active')) {
                    this.restoreWindow(win.id);
                } else {
                    this.minimizeWindow(win.id);
                }
            });
            $taskbarItems.append($item);
        },

        updateWindowMenu() {
            $windowMenu.empty();
            Object.values(this.windows).forEach(win => {
                const $btn = $(`<button class="dropdown-item">${win.options.title}</button>`);
                $btn.click(() => this.restoreWindow(win.id));
                $windowMenu.append($btn);
            });
        }
    };

    /**
     * Desktop Manager
     */
    const DesktopManager = {
        icons: [],

        init() {
            this.loadIcons();
            this.renderIcons();
            this.setupEvents();
            this.updateIdentity();
        },

        // Todo: Add minimal IDE link for test.html and RESET button

        loadIcons() {
            this.icons = [
                { id: 'terminal', type: 'system', title: 'Terminal', icon: IconMap['file-bas'], launch: 'terminal' },
                { id: 'notepad', type: 'system', title: 'Notepad', icon: IconMap['file-text'], launch: 'notepad' },
                { id: 'explorer', type: 'system', title: 'File Explorer', icon: IconMap['folder'], launch: 'explorer' },
                { id: 'editor', type: 'system', title: 'Tabbed Editor', icon: IconMap['file-code'], launch: 'editor' },
                { id: 'chat', type: 'system', title: 'Chat', icon: IconMap['chat'], launch: 'chat' },
                { id: 'downloads', type: 'system', title: 'Downloads', icon: IconMap['download'], launch: 'downloads' },
                { id: 'ide', type: 'url', title: 'YoBASIC IDE', icon: IconMap['link'], url: 'index.html' },
                { id: 'ide', type: 'url', title: 'Minimal IDE', icon: IconMap['link'], url: 'test.html' },
                { id: 'docs', type: 'url', title: 'Basil Docs', icon: IconMap['link'], url: 'https://blackrushbasic.com/' },
                { id: 'website', type: 'url', title: 'Basil Website', icon: IconMap['link'], url: 'https://basilbasic.com/' },
                { id: 'shared-files', type: 'system', title: 'Shared Projects', icon: IconMap['box'], launch: 'explorer', requiresAuth: true, authScope: 'shared' }
            ];
            
            // Add custom iFrames from spec
            const iframes = [
                { id: 'yoreweb', type: 'iframe', title: 'YoreWeb', icon: IconMap['link'], url: 'https://yoreweb.com/' },
                { id: 'blackrushdrive', type: 'iframe', title: 'Blackrush Drive', icon: IconMap['link'], url: 'https://blackrushdrive.com/' }
            ];
            iframes.forEach(f => this.icons.push(f));
        },

        renderIcons() {
            $iconsGrid.empty();
            const positions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
            
            this.icons.forEach(icon => {
                const pos = positions[icon.id];
                const style = pos ? `position: absolute; left: ${pos.x}px; top: ${pos.y}px;` : '';
                const $icon = $(`
                    <div class="desktop-icon ${icon.requiresAuth && !Identity.isLoggedIn() ? 'disabled' : ''}" data-id="${icon.id}" title="${icon.requiresAuth && !Identity.isLoggedIn() ? 'Requires login' : ''}" style="${style}">
                        <i class="bi ${icon.icon}"></i>
                        <span>${icon.title}</span>
                        ${icon.requiresAuth && !Identity.isLoggedIn() ? '<div class="lock-badge"><i class="bi bi-lock-fill"></i></div>' : ''}
                    </div>
                `);
                
                $icon.dblclick(() => this.launchIcon(icon));
                $icon.click((e) => {
                    if (!e.ctrlKey) $('.desktop-icon').removeClass('selected');
                    $icon.addClass('selected');
                });

                $icon.on('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const $ctx = $('.context-menu');
                    $ctx.empty().append(`
                        <button class="dropdown-item" id="ctx-open">Open</button>
                        ${icon.id.endsWith('.bas') ? '<button class="dropdown-item" id="ctx-edit">Edit</button>' : ''}
                        <hr>
                        <button class="dropdown-item" id="ctx-props">Properties</button>
                    `).css({ display: 'block', left: e.clientX, top: e.clientY });

                    $('#ctx-open').click(() => this.launchIcon(icon));
                    $('#ctx-edit').click(() => AppLauncher.notepad(icon.id));
                });

                // Icon dragging
                $icon.on('mousedown', (e) => {
                    if (e.which !== 1) return;
                    e.preventDefault();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startPos = $icon.position();
                    const startLeft = startPos.left;
                    const startTop = startPos.top;

                    $(document).on('mousemove.icon-drag', (e) => {
                        $icon.css({
                            position: 'absolute',
                            left: startLeft + (e.clientX - startX),
                            top: startTop + (e.clientY - startY),
                            zIndex: 1000
                        });
                    });

                    $(document).on('mouseup.icon-drag', () => {
                        $(document).off('.icon-drag');
                        $icon.css('zIndex', '');
                        // Save position
                        const finalPos = $icon.position();
                        const currentPositions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
                        currentPositions[icon.id] = { x: Math.round(finalPos.left), y: Math.round(finalPos.top) };
                        localStorage.setItem('desktop.iconPositions', JSON.stringify(currentPositions));
                    });
                });

                $iconsGrid.append($icon);
            });
        },

        launchIcon(icon) {
            if (icon.requiresAuth && !Identity.isLoggedIn()) {
                alert('Login required to access this item.');
                return;
            }
            if (icon.type === 'url') {
                window.open(icon.url, '_blank');
            } else if (icon.type === 'system') {
                AppLauncher[icon.launch]();
            } else if (icon.type === 'iframe') {
                AppLauncher.iframe(icon.url, icon.title);
            }
        },

        updateIdentity() {
            const user = Identity.getCurrentUser();
            const $btn = $('#btn-identity');
            if (user) {
                $btn.html(`<i class="bi bi-person-check-fill"></i> ${user.username}`);
            } else {
                $btn.html(`<i class="bi bi-person-circle"></i> Login`);
            }
            this.renderIcons();
        },

        setupEvents() {
            const $ctx = $('<div class="context-menu"></div>');
            $('body').append($ctx);

            $desktop.on('contextmenu', (e) => {
                e.preventDefault();
                $ctx.empty().append(`
                    <button class="dropdown-item" id="ctx-arrange">Arrange Icons</button>
                    <button class="dropdown-item" id="ctx-refresh">Refresh</button>
                    <hr>
                    <button class="dropdown-item" id="ctx-new-url">Add URL Shortcut...</button>
                `).css({
                    display: 'block',
                    left: e.clientX,
                    top: e.clientY
                });

                $('#ctx-arrange').click(() => {
                    localStorage.removeItem('desktop.iconPositions');
                    this.renderIcons();
                });
                $('#ctx-refresh').click(() => location.reload());
                $('#ctx-new-url').click(() => {
                    const name = prompt('Name:');
                    const url = prompt('URL:');
                    if (name && url) {
                        this.icons.push({ id: 'custom-' + Date.now(), type: 'url', title: name, icon: IconMap['link'], url });
                        this.renderIcons();
                    }
                });
            });

            $(document).on('mousedown', (e) => {
                if (!$(e.target).closest('.context-menu').length) {
                    $ctx.hide();
                }
            });

            // Marquee selection
            const $marquee = $('<div id="marquee"></div>');
            $desktop.append($marquee);

            $desktop.on('mousedown', (e) => {
                if (e.target !== $desktop[0] && e.target !== $iconsGrid[0]) return;
                if (e.which !== 1) return;

                const startX = e.clientX;
                const startY = e.clientY;
                $marquee.css({ left: startX, top: startY, width: 0, height: 0, display: 'block' });

                $(document).on('mousemove.marquee', (e) => {
                    const currentX = e.clientX;
                    const currentY = e.clientY;
                    const left = Math.min(startX, currentX);
                    const top = Math.min(startY, currentY);
                    const width = Math.abs(startX - currentX);
                    const height = Math.abs(startY - currentY);
                    $marquee.css({ left, top, width, height });

                    // Select icons
                    $('.desktop-icon').each(function() {
                        const rect = this.getBoundingClientRect();
                        if (rect.left < left + width && rect.left + rect.width > left &&
                            rect.top < top + height && rect.top + rect.height > top) {
                            $(this).addClass('selected');
                        } else {
                            if (!e.ctrlKey) $(this).removeClass('selected');
                        }
                    });
                });

                $(document).on('mouseup.marquee', () => {
                    $(document).off('.marquee');
                    $marquee.hide();
                });
            });
        },

        resetDesktop() {
            if (confirm('Are you sure you want to reset the desktop to default settings? All custom icons will be removed and positions will be reset.')) {
                localStorage.removeItem('desktop.iconPositions');
                this.loadIcons();
                this.renderIcons();
            }
        }
    };

    /**
     * Host Bridge for BasicInterpreter
     */
    function hostReadFile(path) {
        const p = String(path || '');
        const absPrefixes = ['projects/', 'shared/', 'examples/', 'data/', '/'];
        let full = p;
        if (!absPrefixes.some(pre => p.toLowerCase().startsWith(pre))) {
            const proj = (window.ProjectManager && ProjectManager.getCurrentProjectName && ProjectManager.getCurrentProjectName()) || null;
            if (proj) full = `projects/${proj}/${p}`;
            else return '';
        }
        const f = vfs.getFile(full);
        if (f && typeof f.content === 'string') return f.content;
        if (full.toLowerCase().startsWith('data/')) {
            const d = vfs.readData(full);
            return d != null ? String(d) : '';
        }
        return '';
    }

    function hostExtern(name, args) {
        try {
            const fn = window.YoBasicHost && window.YoBasicHost[name];
            if (typeof fn === 'function') {
                const res = fn.apply(window.YoBasicHost, args || []);
                return (typeof res === 'string') ? res : '';
            }
            return '';
        } catch (e) { return ''; }
    }

    function hostCallModule(moduleName, memberName, args) {
        try {
            if (window.ProjectManager && typeof ProjectManager.callModule === 'function' && ProjectManager.getCurrentProjectName && ProjectManager.getCurrentProjectName()) {
                return ProjectManager.callModule(moduleName, memberName, args || []);
            }
        } catch (e) { throw e; }
        throw new Error('Unknown module: ' + moduleName);
    }

    /**
     * App Launcher
     */
    const AppLauncher = {
        identity() {
            WindowManager.createWindow({
                id: 'identity',
                singleton: true,
                title: 'Identity',
                icon: 'bi-person-circle',
                width: 400,
                height: 350,
                onOpen: (win) => {
                    const $body = win.$el.find('.window-body');
                    $body.html(`
                        <div class="p-3">
                            <div id="win-identity-status" class="mb-3 small">Checking status...</div>
                            <div id="win-identity-forms">
                                <div class="nav-tabs-wrapper mb-2">
                                    <button class="nav-tab active" data-tab="win-tab-login">Log In</button>
                                    <button class="nav-tab" data-tab="win-tab-signup">Create Identity</button>
                                </div>
                                <div class="tab-content">
                                    <div id="win-tab-login" class="tab-pane active">
                                        <div class="mb-2">
                                            <label class="d-block small">Username or Email</label>
                                            <input id="win-login-username" type="text" style="width:100%" />
                                        </div>
                                        <div class="mb-2">
                                            <label class="d-block small">Password</label>
                                            <input id="win-login-password" type="password" style="width:100%" />
                                        </div>
                                        <button id="win-btn-login" class="win-btn-action">Log In</button>
                                    </div>
                                    <div id="win-tab-signup" class="tab-pane d-none">
                                        <div class="mb-2">
                                            <label class="d-block small">Username</label>
                                            <input id="win-signup-username" type="text" style="width:100%" />
                                        </div>
                                        <div class="mb-2">
                                            <label class="d-block small">Email</label>
                                            <input id="win-signup-email" type="email" style="width:100%" />
                                        </div>
                                        <div class="mb-2">
                                            <label class="d-block small">Password</label>
                                            <input id="win-signup-password" type="password" style="width:100%" />
                                        </div>
                                        <button id="win-btn-signup" class="win-btn-action">Create Identity</button>
                                    </div>
                                </div>
                            </div>
                            <div id="win-identity-loggedin" class="d-none">
                                <p>You are logged in as <b id="win-whoami"></b>.</p>
                                <button id="win-btn-logout" class="win-btn-action">Log Out</button>
                            </div>
                        </div>
                    `);

                    const updateUI = () => {
                        const user = Identity.getCurrentUser();
                        if (user) {
                            $('#win-identity-status').text('You are logged in.');
                            $('#win-identity-forms').addClass('d-none');
                            $('#win-identity-loggedin').removeClass('d-none');
                            $('#win-whoami').text(user.username);
                        } else {
                            $('#win-identity-status').text('You are not logged in.');
                            $('#win-identity-forms').removeClass('d-none');
                            $('#win-identity-loggedin').addClass('d-none');
                        }
                    };

                    updateUI();

                    $body.find('.nav-tab').click(function() {
                        $body.find('.nav-tab').removeClass('active');
                        $(this).addClass('active');
                        $body.find('.tab-pane').addClass('d-none');
                        $('#' + $(this).data('tab')).removeClass('d-none');
                    });

                    $('#win-btn-login').click(async () => {
                        try {
                            await Identity.login($('#win-login-username').val(), $('#win-login-password').val());
                            updateUI();
                            DesktopManager.updateIdentity();
                        } catch (e) { alert(e.message || e); }
                    });

                    $('#win-btn-signup').click(async () => {
                        try {
                            const res = await Identity.signup($('#win-signup-username').val(), $('#win-signup-email').val(), $('#win-signup-password').val());
                            if (res && res.needsConfirmation) alert('Check email to confirm.');
                            updateUI();
                            DesktopManager.updateIdentity();
                        } catch (e) { alert(e.message || e); }
                    });

                    $('#win-btn-logout').click(async () => {
                        await Identity.logout();
                        updateUI();
                        DesktopManager.updateIdentity();
                    });
                }
            });
        },

        settings() {
            WindowManager.createWindow({
                id: 'settings',
                singleton: true,
                title: 'Settings',
                icon: 'bi-gear',
                width: 600,
                height: 450,
                onOpen: (win) => {
                    const $body = win.$el.find('.window-body');
                    $body.html(`
                        <div class="d-flex flex-column h-100">
                            <div class="nav-tabs-wrapper px-2 pt-2">
                                <button class="nav-tab active" data-tab="st-appearance">Appearance</button>
                                <button class="nav-tab" data-tab="st-colors">Colors</button>
                                <button class="nav-tab" data-tab="st-tab3">Desktop</button>
                                <button class="nav-tab" data-tab="st-tab4">System</button>
                            </div>
                            <div class="tab-content p-3 flex-grow-1 overflow-auto">
                                <div id="st-appearance" class="tab-pane active">
                                    <h6>Editor Settings</h6>
                                    <div class="mb-2">
                                        <label class="d-block small">Font Face</label>
                                        <select id="st-editor-font" style="width:100%"></select>
                                    </div>
                                    <div class="mb-2">
                                        <label class="d-block small">Font Size (px)</label>
                                        <input id="st-editor-size" type="number" style="width:100%" />
                                    </div>
                                </div>
                                <div id="st-colors" class="tab-pane d-none">
                                    <h6>Color Scheme</h6>
                                    <div id="st-theme-list" class="mb-2"></div>
                                    <button class="win-btn-action" id="st-btn-reset-theme">Reset to Default</button>
                                </div>
                                <div id="st-tab3" class="tab-pane d-none">
                                    <h6>Desktop Settings</h6>
                                    <p class="small text-muted">Future desktop-specific settings will go here.</p>
                                </div>
                                <div id="st-tab4" class="tab-pane d-none">
                                    <h6>System Settings</h6>
                                    <p class="small text-muted">Future system-specific settings will go here.</p>
                                </div>
                            </div>
                        </div>
                    `);

                    $body.find('.nav-tab').click(function() {
                        $body.find('.nav-tab').removeClass('active');
                        $(this).addClass('active');
                        $body.find('.tab-pane').addClass('d-none');
                        $('#' + $(this).data('tab')).removeClass('d-none');
                    });
                    
                    // Logic to load themes/fonts could be added here similar to index.html
                }
            });
        },

        terminal(initialFile = null) {
            WindowManager.createWindow({
                title: 'Basic.JS Terminal',
                icon: IconMap['file-bas'],
                className: 'terminal-window',
                onOpen: async (win) => {
                    const $term = $('<div class="term-container" style="height:100%"></div>');
                    win.$el.find('.window-body').append($term);
                    const interpreter = new BasicInterpreter({
                        term: null,
                        autoEcho: false,
                        debug: true,
                        vfs,
                        hostReadFile,
                        hostExtern,
                        hostCallModule
                    });
                    const term = $term.terminal(function(command) {
                        if (command !== '') {
                            try {
                                interpreter.setTerm(term);
                                var out = interpreter.lineExecute(command);
                                if (out) {
                                    String(out).split(/\n/).forEach(line => { if (line.length) this.echo(line); });
                                }
                            } catch (e) {
                                this.error(new String(e));
                            }
                        }
                    }, {
                        greetings: '🌱YoBASIC v1.0 Terminal\nCopyright (C) 1979-2026\nType "HELP" for guidance.',
                        name: win.id,
                        height: '100%',
                        prompt: '> '
                    });
                    win.interpreter = interpreter;
                    if (initialFile) {
                        const content = await vfs.readProgramAsync(initialFile);
                        if (content) {
                            term.echo(`Running ${initialFile}...`);
                            interpreter.runProgram(content);
                        }
                    }
                }
            });
        },

        explorer() {
            WindowManager.createWindow({
                id: 'explorer',
                singleton: true,
                title: 'File Explorer',
                icon: IconMap['folder'],
                onOpen: (win) => {
                    this.renderVfsExplorer(win);
                }
            });
        },

        renderVfsExplorer(win) {
            const $body = win.$el.find('.window-body');
            $body.html('<div class="explorer-toolbar p-1 border-bottom d-flex gap-2"></div><div class="explorer-grid p-2"></div>');
            const files = vfs.listFiles();
            const $grid = $body.find('.explorer-grid').css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 70px)',
                gap: '10px'
            });

            files.forEach(f => {
                const path = f.name;
                const ext = path.split('.').pop();
                const $file = $(`
                    <div class="explorer-item d-flex flex-column align-items-center text-center" style="cursor:pointer; width:70px; font-size:11px;">
                        <i class="bi ${getIconForExt(ext)}" style="font-size:24px;"></i>
                        <span style="word-break:break-all">${f.name}</span>
                    </div>
                `);
                $file.dblclick(() => {
                    if (ext === 'bas') {
                        this.terminal(path);
                    } else {
                        this.notepad(path);
                    }
                });
                $file.on('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const $ctx = $('.context-menu');
                    $ctx.empty().append(`
                        <button class="dropdown-item" id="ctx-vfs-open">Open</button>
                        ${ext === 'bas' ? '<button class="dropdown-item" id="ctx-vfs-edit">Edit</button>' : ''}
                        <hr>
                        <button class="dropdown-item">Copy</button>
                    `).css({ display: 'block', left: e.clientX, top: e.clientY });
                    $('#ctx-vfs-open').click(() => {
                        if (ext === 'bas') this.terminal(path);
                        else this.notepad(path);
                    });
                    $('#ctx-vfs-edit').click(() => this.notepad(path));
                });
                $grid.append($file);
            });
        },

        notepad(path = null) {
            const id = 'notepad-' + Math.random().toString(36).substr(2, 9);
            let currentPath = path;

            WindowManager.createWindow({
                id,
                singleton: false,
                title: path ? `Notepad - ${path}` : 'Notepad (Untitled)',
                icon: IconMap['file-text'],
                onOpen: async (win) => {
                    const $body = win.$el.find('.window-body');
                    const $textarea = $('<textarea style="width:100%; height:100%"></textarea>');
                    $body.append($textarea);
                    const editor = CodeMirror.fromTextArea($textarea[0], {
                        lineNumbers: true,
                        mode: 'text/plain',
                        theme: 'default'
                    });
                    win.editor = editor;

                    const updateTitle = () => {
                        win.$el.find('.window-title').text(currentPath ? `Notepad - ${currentPath}` : 'Notepad (Untitled)');
                    };

                    const onNew = () => {
                        currentPath = null;
                        editor.setValue('');
                        updateTitle();
                    };

                    const onOpen = () => {
                        // For now, simpler: just open explorer
                        AppLauncher.explorer();
                    };

                    const onSave = async () => {
                        if (!currentPath) {
                            onSaveAs();
                            return;
                        }
                        await vfs.writeProgramAsync(currentPath, editor.getValue());
                        alert('Saved to ' + currentPath);
                    };

                    const onSaveAs = async () => {
                        const newPath = prompt('Save as path (e.g. projects/myprog.bas):', currentPath || '');
                        if (newPath) {
                            currentPath = newPath;
                            await onSave();
                            updateTitle();
                        }
                    };

                    WindowManager.createWindowMenuBar(win.$el, [
                        {
                            title: 'File',
                            items: [
                                { title: 'New', click: onNew },
                                { title: 'Open...', click: onOpen },
                                { title: 'Save', click: onSave },
                                { title: 'Save As...', click: onSaveAs },
                                { separator: true },
                                { title: 'Close', click: () => WindowManager.closeWindow(win.id) }
                            ]
                        }
                    ]);

                    if (path) {
                        const content = await vfs.readProgramAsync(path);
                        if (content !== null) {
                            editor.setValue(content);
                            if (path.endsWith('.bas')) editor.setOption('mode', 'simplemode');
                        }
                    }
                    win.options.onResize = () => editor.refresh();
                }
            });
        },

        editor() {
            WindowManager.createWindow({
                id: 'editor',
                singleton: true,
                title: 'Tabbed Editor',
                icon: IconMap['file-code'],
                onOpen: (win) => {
                    const $body = win.$el.find('.window-body');
                    let currentPath = null;

                    $body.html(`
                        <div class="d-flex flex-column h-100">
                            <div class="editor-tabs-bar nav-tabs-wrapper px-2 pt-1" style="background:var(--taskbar-bg)">
                                <div class="nav-tab active" id="editor-active-tab-name">Untitled.bas</div>
                            </div>
                            <div class="editor-container flex-grow-1">
                                <textarea style="width:100%; height:100%"></textarea>
                            </div>
                        </div>
                    `);
                    
                    const editor = CodeMirror.fromTextArea($body.find('textarea')[0], {
                        lineNumbers: true,
                        mode: 'simplemode',
                        theme: 'default'
                    });
                    win.editor = editor;

                    const updateUI = () => {
                        const name = currentPath ? currentPath.split('/').pop() : 'Untitled.bas';
                        $('#editor-active-tab-name').text(name);
                        win.$el.find('.window-title').text(currentPath ? `Tabbed Editor - ${currentPath}` : 'Tabbed Editor');
                    };

                    const onNew = () => {
                        currentPath = null;
                        editor.setValue('');
                        updateUI();
                    };

                    const onSave = async () => {
                        if (!currentPath) return onSaveAs();
                        await vfs.writeProgramAsync(currentPath, editor.getValue());
                        alert('Saved to ' + currentPath);
                    };

                    const onSaveAs = async () => {
                        const p = prompt('Save As (path):', currentPath || 'projects/untitled.bas');
                        if (p) { currentPath = p; await onSave(); updateUI(); }
                    };

                    WindowManager.createWindowMenuBar(win.$el, [
                        {
                            title: 'File',
                            items: [
                                { title: 'New', click: onNew },
                                { title: 'Open...', click: () => AppLauncher.explorer() },
                                { title: 'Save', click: onSave },
                                { title: 'Save As...', click: onSaveAs },
                                { separator: true },
                                { title: 'Close', click: () => WindowManager.closeWindow(win.id) }
                            ]
                        }
                    ]);

                    win.options.onResize = () => editor.refresh();
                }
            });
        },

        chat() {
            WindowManager.createWindow({
                id: 'chat',
                singleton: true,
                title: 'Chat',
                icon: IconMap['chat'],
                onOpen: (win) => {
                    win.$el.find('.window-body').html('<div id="chat-widget-container" style="height:100%"></div>');
                    // Port chat logic
                }
            });
        },

        downloads() {
            WindowManager.createWindow({
                id: 'downloads',
                singleton: true,
                title: 'Downloads',
                icon: IconMap['download'],
                onOpen: (win) => {
                    this.loadDownloads(win, '/');
                }
            });
        },

        async loadDownloads(win, path) {
            const $body = win.$el.find('.window-body');
            $body.html('<div class="p-2">Loading...</div>');
            try {
                const resp = await fetch(`list.php?path=${encodeURIComponent(path)}`);
                const data = await resp.json();
                
                $body.html(`
                    <div class="explorer-toolbar p-1 border-bottom d-flex gap-2 align-items-center">
                        <button class="win-btn btn-up" ${data.parentPath === null ? 'disabled' : ''} title="Up"><i class="bi bi-arrow-up"></i></button>
                        <span class="breadcrumb" style="font-size:12px">${data.path}</span>
                    </div>
                    <div class="explorer-grid p-2" style="display:grid; grid-template-columns: repeat(auto-fill, 80px); gap:10px;"></div>
                `);

                const $grid = $body.find('.explorer-grid');
                data.items.forEach(item => {
                    const icon = item.type === 'dir' ? IconMap['folder'] : getIconForExt(item.ext);
                    const $item = $(`
                        <div class="explorer-item d-flex flex-column align-items-center text-center" style="cursor:pointer; width:80px; font-size:11px;">
                            <i class="bi ${icon}" style="font-size:32px;"></i>
                            <span style="word-break:break-all">${item.name}</span>
                        </div>
                    `);
                    $item.dblclick(() => {
                        if (item.type === 'dir') {
                            this.loadDownloads(win, (path === '/' ? '' : path) + '/' + item.name);
                        } else {
                            window.open(item.url, '_blank');
                        }
                    });
                    $grid.append($item);
                });

                $body.find('.btn-up').click(() => {
                    this.loadDownloads(win, data.parentPath);
                });

            } catch (e) {
                $body.html('<div class="p-2 text-danger">Error loading downloads.</div>');
            }
        },

        iframe(url, title) {
            WindowManager.createWindow({
                title,
                icon: IconMap['link'],
                onOpen: (win) => {
                    win.$el.find('.window-body').html(`<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`);
                }
            });
        }
    };

    // Identity Events
    window.addEventListener('identity-change', () => {
        DesktopManager.updateIdentity();
    });

    // Clock
    setInterval(() => {
        const now = new Date();
        $('#taskbar-clock').text(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    // Initial Launch
    Identity.initializeFromSession().then(() => {
        DesktopManager.init();
    });
    
    // Global UI
    $('.dropdown-toggle').click(function(e) {
        e.stopPropagation();
        $('.dropdown-menu').not($(this).next()).removeClass('show');
        $(this).next().toggleClass('show');
    });
    $(document).click(() => $('.dropdown-menu').removeClass('show'));
    
    $('#btn-identity').click(() => AppLauncher.identity());

    $('#btn-settings').click(() => AppLauncher.settings());

    $('#btn-reset-desktop').click(() => DesktopManager.resetDesktop());

    $('#btn-exit').click(() => window.location.href = 'index.html');
    $('#btn-new-project').click(() => alert('New Project dialog coming soon.'));
    $('#btn-open-explorer').click(() => AppLauncher.explorer());
    $('#btn-about').click(() => AppLauncher.about());
});
