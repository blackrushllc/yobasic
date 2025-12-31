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
        'folder-fill': 'bi-folder-fill',
        'folder-symlink': 'bi-folder-symlink',
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
        'iframe': 'bi-window-stack',
        'gear': 'bi-gear',
        'info': 'bi-info-circle',
        'chat': 'bi-chat-dots',
        'download': 'bi-download',
        'windows': 'bi-windows',
        'display': 'bi-pc-display',
        'box': 'bi-box-seam'
    };

    function getIconForExt(ext) {
        ext = (ext || '').toLowerCase();
        if (ext === 'bas' || ext === 'basil') return IconMap['file-bas'];
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
            const persistenceId = options.persistenceId || id;
            
            if (options.singleton && this.windows[id]) {
                this.focusWindow(id);
                this.restoreWindow(id);
                return this.windows[id];
            }

            // Load persisted geometry
            const saved = this.loadWindowGeometry(persistenceId);
            const width = saved ? saved.width : (options.width || 600);
            const height = saved ? saved.height : (options.height || 400);
            let left = saved ? saved.x : (options.x || 100);
            let top = saved ? saved.y : (options.y || 100);

            // Offset if overlapping with any existing window
            const staggerOffset = 30;
            let overlapping = true;
            let attempts = 0;
            while (overlapping && attempts < 10) {
                overlapping = false;
                for (const winId in this.windows) {
                    const win = this.windows[winId];
                    if (win.isMinimized) continue;
                    const winLeft = parseInt(win.$el.css('left'));
                    const winTop = parseInt(win.$el.css('top'));
                    if (Math.abs(winLeft - left) < 5 && Math.abs(winTop - top) < 5) {
                        left += staggerOffset;
                        top += staggerOffset;

                        // If it goes too far right or down, wrap back
                        if (left + width > $(window).width() - 40 || top + height > $(window).height() - 40) {
                            left = 40;
                            top = 40;
                        }

                        overlapping = true;
                        attempts++;
                        break;
                    }
                }
            }

            const $win = $(`
                <div class="window ${options.className || ''} ${options.modal ? 'modal-window' : ''}" id="${id}" style="width: ${width}px; height: ${height}px; left: ${left}px; top: ${top}px;">
                    <div class="window-header">
                        <div class="window-title">${options.title || 'Window'}</div>
                        <div class="window-controls">
                            <button class="win-btn btn-min" title="Minimize" ${options.modal ? 'style="display:none"' : ''}>_</button>
                            <button class="win-btn btn-max" title="Maximize">□</button>
                            <button class="win-btn btn-close" title="Close">×</button>
                        </div>
                    </div>
                    <div class="window-body"></div>
                    <div class="window-resizer"></div>
                </div>
            `);

            $windowContainer.append($win);

            if (options.modal) {
                this.showOverlay();
            }

            const winObj = {
                id,
                persistenceId,
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

        showOverlay() {
            let $overlay = $('.window-overlay');
            if ($overlay.length === 0) {
                $overlay = $('<div class="window-overlay"></div>');
                $('body').append($overlay);
            }
            $overlay.show();
        },

        hideOverlay() {
            const anyModal = Object.values(this.windows).some(w => w.options.modal);
            if (!anyModal) {
                $('.window-overlay').hide();
            }
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
            if (!this._menubarListenerAdded) {
                $(document).click(() => $('.win-menu-content').removeClass('show'));
                this._menubarListenerAdded = true;
            }
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
                    if (!win.isMaximized) {
                        this.saveWindowGeometry(win.persistenceId, {
                            x: parseInt($el.css('left')),
                            y: parseInt($el.css('top')),
                            width: $el.width(),
                            height: $el.height()
                        });
                    }
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
                    if (!win.isMaximized) {
                        this.saveWindowGeometry(win.persistenceId, {
                            x: parseInt($el.css('left')),
                            y: parseInt($el.css('top')),
                            width: $el.width(),
                            height: $el.height()
                        });
                    }
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
            
            let zIndex = ++zIndexCounter;
            if (win.options.modal) {
                zIndex += 30000; // Above overlay (19999) and taskbar/navbar (10000)
            }

            win.$el.addClass('active').css('z-index', zIndex);
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
            if (!win) return;
            if (win.options.onClose) {
                if (win.options.onClose(win) === false) return;
            }
            win.$el.remove();
            $(`.taskbar-item[data-id="${id}"]`).remove();
            delete this.windows[id];
            if (win.options.modal) {
                this.hideOverlay();
            }
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
        },

        closeAll() {
            Object.keys(this.windows).forEach(id => {
                this.closeWindow(id);
            });
        },

        minimizeAll() {
            Object.keys(this.windows).forEach(id => {
                this.minimizeWindow(id);
            });
        },

        saveWindowGeometry(id, rect) {
            const geometries = JSON.parse(localStorage.getItem('desktop.windowGeometry') || '{}');
            geometries[id] = rect;
            localStorage.setItem('desktop.windowGeometry', JSON.stringify(geometries));
        },

        loadWindowGeometry(id) {
            const geometries = JSON.parse(localStorage.getItem('desktop.windowGeometry') || '{}');
            return geometries[id] || null;
        }
    };

    /**
     * Desktop Manager
     */
    const DesktopManager = {
        icons: [],
        GRID: { w: 80, h: 90, gap: 10, padding: 10 },

        init() {
            this.loadIcons();
            this.renderIcons();
            this.setupEvents();
            this.updateIdentity();
        },

        snapToGrid(x, y) {
            const c = Math.round((x - this.GRID.padding) / (this.GRID.w + this.GRID.gap));
            const r = Math.round((y - this.GRID.padding) / (this.GRID.h + this.GRID.gap));
            return {
                x: this.GRID.padding + c * (this.GRID.w + this.GRID.gap),
                y: this.GRID.padding + r * (this.GRID.h + this.GRID.gap)
            };
        },

        getFreeSpot(occupiedPositions) {
            const containerWidth = $('#desktop-area').width() || window.innerWidth;
            const containerHeight = $('#desktop-area').height() || window.innerHeight;
            const cols = Math.floor((containerWidth - this.GRID.padding * 2 + this.GRID.gap) / (this.GRID.w + this.GRID.gap));
            const rows = Math.floor((containerHeight - this.GRID.padding * 2 + this.GRID.gap) / (this.GRID.h + this.GRID.gap));

            for (let c = 0; c < (cols || 10); c++) {
                for (let r = 0; r < (rows || 10); r++) {
                    const x = this.GRID.padding + c * (this.GRID.w + this.GRID.gap);
                    const y = this.GRID.padding + r * (this.GRID.h + this.GRID.gap);
                    
                    const isOccupied = Object.values(occupiedPositions).some(pos => 
                        Math.abs(pos.x - x) < 5 && Math.abs(pos.y - y) < 5
                    );
                    
                    if (!isOccupied) return { x, y };
                }
            }
            return { x: 0, y: 0 };
        },

        // Todo: Add minimal IDE link for test.html and RESET button

        loadIcons() {
            const systemIcons = [
                { id: 'terminal', type: 'system', title: 'Terminal', icon: IconMap['file-bas'], launch: 'terminal' },
                { id: 'notepad', type: 'system', title: 'Notepad', icon: IconMap['file-text'], launch: 'notepad' },
                { id: 'explorer', type: 'system', title: 'File Explorer', icon: IconMap['folder'], launch: 'explorer' },
                { id: 'editor', type: 'system', title: 'Tabbed Editor', icon: IconMap['file-code'], launch: 'editor' },
                { id: 'chat', type: 'system', title: 'Chat', icon: IconMap['chat'], launch: 'chat' },
                { id: 'downloads', type: 'system', title: 'Downloads', icon: IconMap['download'], launch: 'downloads' },
                { id: 'settings', type: 'system', title: 'Settings', icon: IconMap['gear'], launch: 'settings' },
                { id: 'about', type: 'system', title: 'About', icon: IconMap['info'], launch: 'about' },
                { id: 'desktop', type: 'system', title: 'Desktop', icon: IconMap['display'], launch: 'explorer', path: 'projects' },
                { id: 'ide', type: 'url', title: 'YoBASIC IDE', icon: IconMap['link'], url: 'index.html' },
                { id: 'ide-minimal', type: 'url', title: 'Minimal IDE', icon: IconMap['link'], url: 'test.html' },
                { id: 'docs', type: 'url', title: 'Basil Docs', icon: IconMap['link'], url: 'https://blackrushbasic.com/' },
                { id: 'website', type: 'url', title: 'Basil Website', icon: IconMap['link'], url: 'https://basilbasic.com/' },
                { id: 'shared-files', type: 'system', title: 'Shared Projects', icon: IconMap['box'], launch: 'explorer', requiresAuth: true, authScope: 'shared' }
            ];
            
            // Add custom iFrames from spec
            const defaultIframes = [
                { id: 'yoreweb', type: 'iframe', title: 'YoreWeb', icon: IconMap['iframe'], url: 'https://yoreweb.com/' },
                { id: 'blackrushdrive', type: 'iframe', title: 'Blackrush Drive', icon: IconMap['iframe'], url: 'https://blackrushdrive.com/' }
            ];

            const savedIcons = localStorage.getItem('desktop.customIcons');
            
            // Initial load or if no custom icons yet, use default iframes
            if (savedIcons === null) {
                this.icons = [...systemIcons, ...defaultIframes];
                this.saveCustomIcons();
            } else {
                this.icons = JSON.parse(savedIcons);
            }
        },

        saveCustomIcons() {
            localStorage.setItem('desktop.customIcons', JSON.stringify(this.icons));
        },

        renderIcons() {
            $iconsGrid.empty();
            let positions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
            let occupied = {};
            let positionsChanged = false;
            
            this.icons.forEach(icon => {
                let pos = positions[icon.id];

                if (pos) {
                    pos = this.snapToGrid(pos.x, pos.y);
                    const isOccupied = Object.values(occupied).some(o => 
                        Math.abs(o.x - pos.x) < 5 && Math.abs(o.y - pos.y) < 5
                    );
                    if (isOccupied) pos = null;
                }

                if (!pos) {
                    pos = this.getFreeSpot(occupied);
                    positions[icon.id] = pos;
                    positionsChanged = true;
                }

                occupied[icon.id] = pos;
                const style = `position: absolute; left: ${pos.x}px; top: ${pos.y}px;`;
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
                    const isEditable = (icon.path || icon.id || '').toLowerCase().match(/\.(bas|basil)$/);
                    $ctx.empty().append(`
                        <button class="dropdown-item" id="ctx-open">Open</button>
                        ${isEditable ? '<button class="dropdown-item" id="ctx-edit">Edit</button>' : ''}
                        <button class="dropdown-item" id="ctx-rename">Rename</button>
                        <button class="dropdown-item" id="ctx-delete">Delete</button>
                        <hr>
                        <button class="dropdown-item" id="ctx-props">Properties</button>
                    `).css({ display: 'block', left: e.clientX, top: e.clientY });

                    $('#ctx-open').click(() => this.launchIcon(icon));
                    $('#ctx-edit').click(() => AppLauncher.notepad(icon.path || icon.id));
                    $('#ctx-rename').click(() => this.renameDesktopIcon(icon));
                    $('#ctx-delete').click(() => this.deleteDesktopIcon(icon));
                    $('#ctx-props').click(() => {
                        if (icon.type === 'url' || icon.type === 'iframe') {
                            const newUrl = prompt('Enter new URL:', icon.url);
                            if (newUrl !== null) {
                                icon.url = newUrl;
                                this.saveCustomIcons();
                                this.renderIcons();
                            }
                        } else {
                            alert('Properties for this item are not editable.');
                        }
                    });
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
                        
                        const finalPos = $icon.position();
                        const snapped = this.snapToGrid(finalPos.left, finalPos.top);
                        
                        let currentPositions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
                        
                        // Check if snapped position is occupied by another icon
                        const otherOccupied = {};
                        Object.keys(currentPositions).forEach(id => {
                            if (id !== icon.id) otherOccupied[id] = currentPositions[id];
                        });

                        const isOccupied = Object.values(otherOccupied).some(o => 
                            Math.abs(o.x - snapped.x) < 5 && Math.abs(o.y - snapped.y) < 5
                        );

                        if (isOccupied) {
                            // If occupied, find next available spot
                            const free = this.getFreeSpot(currentPositions);
                            snapped.x = free.x;
                            snapped.y = free.y;
                        }

                        currentPositions[icon.id] = snapped;
                        localStorage.setItem('desktop.iconPositions', JSON.stringify(currentPositions));
                        
                        $icon.css({
                            left: snapped.x,
                            top: snapped.y
                        });
                    });
                });

                $iconsGrid.append($icon);
            });

            if (positionsChanged) {
                localStorage.setItem('desktop.iconPositions', JSON.stringify(positions));
            }
        },

        addBuiltInWidget(widget) {
            // Check if already on desktop
            const existingIndex = this.icons.findIndex(i => i.id === widget.id);
            if (existingIndex !== -1) {
                // Re-order to end (but keep in icons list)
                const item = this.icons.splice(existingIndex, 1)[0];
                this.icons.push(item);
                
                // Clear its saved position so it gets moved to a free spot
                const positions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
                delete positions[widget.id];
                localStorage.setItem('desktop.iconPositions', JSON.stringify(positions));
            } else {
                // Not on desktop, add it
                this.icons.push({
                    id: widget.id,
                    type: 'system',
                    title: widget.title,
                    icon: widget.icon,
                    launch: widget.launch,
                    path: widget.path
                });
            }

            this.saveCustomIcons();
            this.renderIcons();
        },

        launchIcon(icon) {
            if (icon.requiresAuth && !Identity.isLoggedIn()) {
                alert('Login required to access this item.');
                return;
            }
            if (icon.type === 'url') {
                window.open(icon.url, '_blank');
            } else if (icon.type === 'system') {
                const arg = icon.path || (icon.authScope === 'shared' ? 'shared' : undefined);
                AppLauncher[icon.launch](arg, icon.id);
            } else if (icon.type === 'iframe') {
                AppLauncher.iframe(icon.url, icon.title, icon.id);
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

        renameDesktopIcon(icon) {
            const newName = prompt('Enter new name for shortcut:', icon.title);
            if (newName && newName !== icon.title) {
                icon.title = newName;
                this.saveCustomIcons();
                this.renderIcons();
            }
        },

        deleteDesktopIcon(icon) {
            if (confirm(`Are you sure you want to delete the shortcut "${icon.title}"?`)) {
                this.icons = this.icons.filter(i => i.id !== icon.id);
                this.saveCustomIcons();
                this.renderIcons();
            }
        },

        setupEvents() {
            const $ctx = $('<div class="context-menu"></div>');
            $('body').append($ctx);

            $ctx.on('click', '.dropdown-item', (e) => {
                if (!$(e.currentTarget).hasClass('has-submenu')) {
                    $ctx.hide();
                }
            });

            $desktop.on('contextmenu', (e) => {
                e.preventDefault();

                const builtInWidgets = [
                    { id: 'terminal', title: 'Terminal', icon: IconMap['file-bas'], launch: 'terminal' },
                    { id: 'notepad', title: 'Notepad', icon: IconMap['file-text'], launch: 'notepad' },
                    { id: 'explorer', title: 'File Explorer', icon: IconMap['folder'], launch: 'explorer' },
                    { id: 'editor', title: 'Tabbed Editor', icon: IconMap['file-code'], launch: 'editor' },
                    { id: 'chat', title: 'Chat', icon: IconMap['chat'], launch: 'chat' },
                    { id: 'downloads', title: 'Downloads', icon: IconMap['download'], launch: 'downloads' },
                    { id: 'desktop', title: 'Desktop', icon: IconMap['display'], launch: 'explorer', path: 'projects' },
                    { id: 'settings', title: 'Settings', icon: IconMap['gear'], launch: 'settings' },
                    { id: 'about', title: 'About', icon: IconMap['info'], launch: 'about' },
                    { id: 'shared-files', title: 'Shared Projects', icon: IconMap['box'], launch: 'explorer', requiresAuth: true, authScope: 'shared' }
                ];

                let builtInHtml = '';
                builtInWidgets.forEach(w => {
                    builtInHtml += `<button class="dropdown-item ctx-add-widget" data-id="${w.id}">${w.title}</button>`;
                });

                $ctx.empty().append(`
                    <button class="dropdown-item" id="ctx-arrange">Arrange Icons</button>
                    <button class="dropdown-item" id="ctx-refresh">Refresh</button>
                    <hr>
                    <button class="dropdown-item" id="ctx-new-url">Add URL Shortcut...</button>
                    <button class="dropdown-item" id="ctx-new-iframe">Add Iframe Widget...</button>
                    <div class="dropdown-item has-submenu" id="ctx-new-widget">
                        Add Built-in Widget
                        <div class="context-submenu">
                            ${builtInHtml}
                        </div>
                    </div>
                    <hr>
                    <button class="dropdown-item" id="ctx-minimize-all">Minimize All</button>
                    <button class="dropdown-item" id="ctx-close-all">Close All</button>
                `).css({
                    display: 'block',
                    left: e.clientX,
                    top: e.clientY
                });

                $('.ctx-add-widget').click((ev) => {
                    const id = $(ev.target).data('id');
                    const widget = builtInWidgets.find(w => w.id === id);
                    if (widget) {
                        this.addBuiltInWidget(widget);
                    }
                    $ctx.hide();
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
                        this.saveCustomIcons();
                        this.renderIcons();
                    }
                });
                $('#ctx-new-iframe').click(() => {
                    const name = prompt('Widget Name:');
                    const url = prompt('Iframe URL:');
                    if (name && url) {
                        this.icons.push({ id: 'custom-' + Date.now(), type: 'iframe', title: name, icon: IconMap['iframe'], url });
                        this.saveCustomIcons();
                        this.renderIcons();
                    }
                });
                $('#ctx-minimize-all').click(() => WindowManager.minimizeAll());
                $('#ctx-close-all').click(() => WindowManager.closeAll());
            });

            $desktop.on('dragover', (e) => {
                e.preventDefault();
                e.originalEvent.dataTransfer.dropEffect = 'copy';
            });

            $desktop.on('drop', (e) => {
                e.preventDefault();
                const dataStr = e.originalEvent.dataTransfer.getData('application/json');
                if (dataStr) {
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'vfs-file') {
                            const isBas = data.path.toLowerCase().match(/\.(bas|basil)$/);
                            this.icons.push({
                                id: 'custom-' + Date.now(),
                                type: 'system',
                                title: data.name,
                                icon: data.icon,
                                launch: isBas ? 'terminal' : 'notepad',
                                path: data.path // Store the path to launch it correctly
                            });

                            // We need to update launch logic for custom icons with paths
                            this.saveCustomIcons();
                            this.renderIcons();
                            
                            // Set position where dropped
                            const lastIcon = this.icons[this.icons.length - 1];
                            const currentPositions = JSON.parse(localStorage.getItem('desktop.iconPositions') || '{}');
                            currentPositions[lastIcon.id] = { x: e.clientX - 40, y: e.clientY - 40 };
                            localStorage.setItem('desktop.iconPositions', JSON.stringify(currentPositions));
                            this.renderIcons();
                        }
                    } catch (err) {
                        console.error('Drop handling error:', err);
                    }
                }
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
                WindowManager.closeAll();
                localStorage.removeItem('desktop.iconPositions');
                localStorage.removeItem('desktop.windowGeometry');
                localStorage.removeItem('desktop.customIcons');
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

        terminal(options = null, persistenceId = null) {
            let initialFile = null;
            let initialCode = null;
            if (typeof options === 'string') {
                initialFile = options;
            } else if (options && typeof options === 'object') {
                initialFile = options.file;
                initialCode = options.code;
            }

            WindowManager.createWindow({
                title: 'Basic.JS Terminal',
                persistenceId: persistenceId || (initialFile ? 'terminal-' + initialFile : 'terminal'),
                icon: IconMap['file-bas'],
                className: 'terminal-window',
                onOpen: async (win) => {
                    const $term = $('<div class="term-container" style="height:100%"></div>');
                    win.$el.find('.window-body').append($term);
                    const interpreter = new BasicInterpreter({
                        term: null,
                        autoEcho: true,
                        debug: false,
                        vfs,
                        hostReadFile,
                        hostExtern,
                        hostCallModule
                    });
                    const term = $term.terminal(function(command) {
                        if (command !== '') {
                            try {
                                interpreter.setTerm(term);
                                interpreter.lineExecute(command);
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }, {
                        greetings: (initialFile || initialCode) ? '' : '🌱YoBASIC v1.0 Terminal\nCopyright (C) 1979-2026\nType "HELP" for guidance.',
                        name: win.id,
                        height: '100%',
                        prompt: '> '
                    });
                    win.interpreter = interpreter;
                    interpreter.setTerm(term);
                    
                    if (initialFile) {
                        const content = await vfs.readProgramAsync(initialFile);
                        if (content) {
                            term.echo(`Running ${initialFile}...`);
                            interpreter.runProgram(content);
                        }
                    } else if (initialCode) {
                        interpreter.runProgram(initialCode);
                    }
                }
            });
        },

        explorer(options = {}, persistenceId = null) {
            if (typeof options === 'string') {
                options = { initialPath: options };
            }
            const isSelect = !!options.onSelect;
            const win = WindowManager.createWindow({
                id: isSelect ? undefined : 'explorer',
                singleton: !isSelect,
                persistenceId: persistenceId || (isSelect ? undefined : 'explorer'),
                title: options.title || 'File Explorer',
                modal: options.modal || false,
                icon: IconMap['folder'],
                onOpen: (win) => {
                    win.explorerOptions = options;
                    this.renderVfsExplorer(win, options.initialPath || '');
                }
            });
            if (win && win.currentPath !== undefined && win.currentPath !== (options.initialPath || '')) {
                this.renderVfsExplorer(win, options.initialPath || '');
            }
        },

        async renderVfsExplorer(win, currentPath = '') {
            const $body = win.$el.find('.window-body');
            win.currentPath = currentPath;
            const isSelectMode = win.explorerOptions && win.explorerOptions.onSelect;

            // Layout
            $body.html(`
                <div class="explorer-toolbar p-1 border-bottom d-flex gap-2 align-items-center" style="font-size: 11px; background: rgba(0,0,0,0.05);">
                    <button class="btn btn-sm btn-outline-secondary btn-up" title="Up One Level" style="padding: 0px 5px;"><i class="bi bi-arrow-90deg-up"></i></button>
                    <div class="flex-grow-1 text-truncate">Location: <strong>${currentPath || '/'}</strong></div>
                    ${isSelectMode ? '<button class="btn btn-sm btn-primary btn-select-current" style="padding: 0px 10px; font-size:10px;">Select</button>' : ''}
                    <button class="btn btn-sm btn-outline-secondary btn-refresh" title="Refresh" style="padding: 0px 5px;"><i class="bi bi-arrow-clockwise"></i></button>
                </div>
                <div class="explorer-grid p-2"></div>
            `);

            const $grid = $body.find('.explorer-grid');
            
            $body.find('.btn-up').click(() => {
                if (!currentPath) return;
                const parts = currentPath.split('/');
                parts.pop();
                this.renderVfsExplorer(win, parts.join('/'));
            }).prop('disabled', !currentPath);

            $body.find('.btn-refresh').click(() => {
                this.renderVfsExplorer(win, currentPath);
            });

            if (isSelectMode) {
                $body.find('.btn-select-current').click(() => {
                    win.explorerOptions.onSelect(currentPath);
                    WindowManager.closeWindow(win.id);
                });
            }

            // Render ".." (Up one level) if not at root
            if (currentPath) {
                const parts = currentPath.split('/');
                parts.pop();
                const upPath = parts.join('/');
                this._renderExplorerItem(win, $grid, '..', IconMap['folder-symlink'], () => this.renderVfsExplorer(win, upPath));
            }

            // Get files
            let allFiles = [];
            try {
                if (currentPath.startsWith('shared')) {
                    allFiles = await vfs.listByFolderAsync('shared');
                } else if (currentPath.startsWith('examples')) {
                    allFiles = await vfs.listByFolderAsync('examples');
                } else {
                    allFiles = vfs.listFiles();
                }
            } catch (e) {
                console.error('Failed to list files', e);
            }

            const folders = new Set();
            const filesAtLevel = [];
            const prefix = currentPath ? currentPath + '/' : '';

            // Standard folders at root
            if (!currentPath) {
                folders.add('projects');
                folders.add('examples');
                folders.add('data');
                folders.add('shared');
            }

            allFiles.forEach(f => {
                if (f.name.startsWith(prefix)) {
                    const rel = f.name.slice(prefix.length);
                    const parts = rel.split('/');
                    if (parts.length > 1) {
                        folders.add(parts[0]);
                    } else if (parts[0] !== '') {
                        filesAtLevel.push(f);
                    }
                }
            });

            // Render Folders
            Array.from(folders).sort().forEach(folderName => {
                const folderPath = prefix + folderName;
                let disabled = false;
                let tooltip = '';
                if (folderPath === 'shared' && !Identity.isLoggedIn()) {
                    disabled = true;
                    tooltip = 'You must log in to access shared files.';
                }
                this._renderExplorerItem(win, $grid, folderName, IconMap['folder-fill'], () => {
                    if (!disabled) this.renderVfsExplorer(win, folderPath);
                }, disabled, tooltip);
            });

            // Render Files
            filesAtLevel.sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
                const fileName = f.name.split('/').pop();
                const ext = fileName.split('.').pop().toLowerCase();
                this._renderExplorerItem(win, $grid, fileName, getIconForExt(ext), () => {
                    if (isSelectMode) {
                        win.explorerOptions.onSelect(f.name);
                        WindowManager.closeWindow(win.id);
                        return;
                    }
                    if (ext === 'bas' || ext === 'basil') this.terminal(f.name);
                    else this.notepad(f.name);
                }, false, '', f.name);
            });
        },

        _renderExplorerItem(win, $grid, name, icon, onclick, disabled = false, tooltip = '', fullPath = '') {
            const $item = $(`
                <div class="explorer-item ${disabled ? 'disabled' : ''}" 
                     data-path="${fullPath}"
                     draggable="${!disabled && fullPath ? 'true' : 'false'}"
                     ${tooltip ? `title="${tooltip}"` : ''}>
                    <i class="bi ${icon}"></i>
                    <span>${name}</span>
                </div>
            `);
            if (!disabled) {
                $item.on('dragstart', (e) => {
                    if (!fullPath) return;
                    const dragData = {
                        type: 'vfs-file',
                        path: fullPath,
                        name: name,
                        icon: icon
                    };
                    e.originalEvent.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    e.originalEvent.dataTransfer.effectAllowed = 'copy';
                });
                $item.dblclick(onclick);
                $item.click((e) => {
                    if (!e.ctrlKey) win.$el.find('.explorer-item').removeClass('selected');
                    $item.addClass('selected');
                });
                if (fullPath) {
                    const ext = fullPath.split('.').pop().toLowerCase();
                    $item.on('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const $ctx = $('.context-menu');
                        $ctx.empty();
                        
                        const isSelectMode = win.explorerOptions && win.explorerOptions.onSelect;

                        if (isSelectMode) {
                            $ctx.append(`<button class="dropdown-item" id="ctx-vfs-select">Select</button>`);
                            $('#ctx-vfs-select').click(() => {
                                onclick();
                            });
                        } else {
                            $ctx.append(`
                                <button class="dropdown-item" id="ctx-vfs-open">Open</button>
                                ${ext === 'bas' || ext === 'basil' ? '<button class="dropdown-item" id="ctx-vfs-edit">Edit</button>' : ''}
                                <hr>
                                <button class="dropdown-item" id="ctx-vfs-rename">Rename</button>
                                <button class="dropdown-item" id="ctx-vfs-duplicate">Duplicate</button>
                                <button class="dropdown-item" id="ctx-vfs-delete">Delete</button>
                            `);
                            $('#ctx-vfs-open').click(() => {
                                if (ext === 'bas' || ext === 'basil') this.terminal(fullPath);
                                else this.notepad(fullPath);
                            });
                            $('#ctx-vfs-edit').click(() => this.notepad(fullPath));
                            $('#ctx-vfs-rename').click(() => this.renameVfsFile(win, fullPath));
                            $('#ctx-vfs-duplicate').click(() => this.duplicateVfsFile(win, fullPath));
                            $('#ctx-vfs-delete').click(() => this.deleteVfsFile(win, fullPath));
                        }
                        $ctx.css({ display: 'block', left: e.clientX, top: e.clientY });
                    });
                }
            }
            $grid.append($item);
        },

        notepad(path = null, persistenceId = null) {
            const id = 'notepad-' + Math.random().toString(36).substr(2, 9);
            let currentPath = path;

            WindowManager.createWindow({
                id,
                singleton: false,
                persistenceId: persistenceId || (path ? 'notepad-' + path : 'notepad'),
                title: path ? `Notepad - ${path}` : 'Notepad (Untitled)',
                icon: IconMap['file-text'],
                onOpen: async (win) => {
                    const $body = win.$el.find('.window-body');
                    $body.html(`
                        <div class="d-flex flex-column h-100">
                            <div class="window-toolbar p-1 border-bottom d-flex gap-2 align-items-center" style="display:none; background: rgba(0,0,0,0.05); font-size: 12px;">
                                <button class="btn btn-sm btn-success btn-run" style="padding: 2px 10px; font-size: 11px;"><i class="bi bi-play-fill"></i> Run</button>
                                <button class="btn btn-sm btn-primary btn-run-selection" style="padding: 2px 10px; font-size: 11px; display:none;"><i class="bi bi-play"></i> Run Selection</button>
                            </div>
                            <div class="flex-grow-1 overflow-hidden">
                                <textarea style="width:100%; height:100%"></textarea>
                            </div>
                        </div>
                    `);
                    const editor = CodeMirror.fromTextArea($body.find('textarea')[0], {
                        lineNumbers: true,
                        mode: 'text/plain',
                        theme: 'default'
                    });
                    win.editor = editor;

                    const updateUI = () => {
                        win.$el.find('.window-title').text(currentPath ? `Notepad - ${currentPath}` : 'Notepad (Untitled)');
                        const isBas = currentPath && currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        const $toolbar = win.$el.find('.window-toolbar');
                        if (isBas) {
                            $toolbar.show();
                        } else {
                            $toolbar.hide();
                        }
                        refreshMenuBar();
                    };

                    const onRun = () => {
                        AppLauncher.terminal({ code: editor.getValue() });
                    };

                    const onRunSelection = () => {
                        const sel = editor.getSelection();
                        if (sel) {
                            AppLauncher.terminal({ code: sel });
                        }
                    };

                    const refreshMenuBar = () => {
                        win.$el.find('.window-menubar').remove();
                        const isBas = currentPath && currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        const menuDef = [
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
                        ];
                        if (isBas) {
                            const runItems = [
                                { title: 'Run', click: onRun }
                            ];
                            if (editor.getSelection()) {
                                runItems.push({ title: 'Run Selection', click: onRunSelection });
                            }
                            menuDef.push({
                                title: 'Run',
                                items: runItems
                            });
                        }
                        WindowManager.createWindowMenuBar(win.$el, menuDef);
                    };

                    let lastHasSelection = false;
                    editor.on('cursorActivity', () => {
                        const hasSelection = editor.getSelection().length > 0;
                        const isBas = currentPath && currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        win.$el.find('.btn-run-selection').toggle(isBas && hasSelection);
                        
                        if (hasSelection !== lastHasSelection) {
                            lastHasSelection = hasSelection;
                            if (isBas) refreshMenuBar();
                        }
                    });

                    win.$el.on('click', '.btn-run', onRun);
                    win.$el.on('click', '.btn-run-selection', onRunSelection);

                    const onNew = () => {
                        currentPath = null;
                        editor.setValue('');
                        updateUI();
                    };

                    const onOpen = () => {
                        AppLauncher.explorer({
                            modal: true,
                            title: 'Select a file to open',
                            onSelect: async (path) => {
                                const content = await vfs.readProgramAsync(path);
                                if (content !== null) {
                                    currentPath = path;
                                    editor.setValue(content);
                                    if (path.toLowerCase().match(/\.(bas|basil)$/)) editor.setOption('mode', 'simplemode');
                                    else editor.setOption('mode', 'text/plain');
                                    updateUI();
                                }
                            }
                        });
                    };

                    const onSave = async () => {
                        if (!currentPath) {
                            onSaveAs();
                            return;
                        }
                        await vfs.writeProgramAsync(currentPath, editor.getValue());
                        alert('Saved to ' + currentPath);
                        updateUI();
                    };

                    const onSaveAs = async () => {
                        const newPath = prompt('Save as path (e.g. projects/myprog.bas):', currentPath || '');
                        if (newPath) {
                            currentPath = newPath;
                            await vfs.writeProgramAsync(currentPath, editor.getValue());
                            alert('Saved to ' + currentPath);
                            if (currentPath.toLowerCase().match(/\.(bas|basil)$/)) editor.setOption('mode', 'simplemode');
                            else editor.setOption('mode', 'text/plain');
                            updateUI();
                        }
                    };

                    refreshMenuBar();

                    if (path) {
                        const content = await vfs.readProgramAsync(path);
                        if (content !== null) {
                            editor.setValue(content);
                            if (path.toLowerCase().match(/\.(bas|basil)$/)) editor.setOption('mode', 'simplemode');
                        }
                        updateUI();
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
                            <div class="editor-tabs-bar nav-tabs-wrapper px-2 pt-1 d-flex justify-content-between align-items-center" style="background:var(--taskbar-bg)">
                                <div class="nav-tab active" id="editor-active-tab-name">Untitled.bas</div>
                                <div class="editor-toolbar-mini d-flex gap-1 pe-2">
                                    <button class="btn btn-sm btn-success btn-run" style="padding: 0 8px; font-size: 10px; display:none;"><i class="bi bi-play-fill"></i> Run</button>
                                    <button class="btn btn-sm btn-primary btn-run-selection" style="padding: 0 8px; font-size: 10px; display:none;"><i class="bi bi-play"></i> Run Selection</button>
                                </div>
                            </div>
                            <div class="editor-container flex-grow-1 overflow-hidden">
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

                    const onRun = () => {
                        AppLauncher.terminal({ code: editor.getValue() });
                    };

                    const onRunSelection = () => {
                        const sel = editor.getSelection();
                        if (sel) {
                            AppLauncher.terminal({ code: sel });
                        }
                    };

                    const updateUI = () => {
                        const name = currentPath ? currentPath.split('/').pop() : 'Untitled.bas';
                        $('#editor-active-tab-name').text(name);
                        win.$el.find('.window-title').text(currentPath ? `Tabbed Editor - ${currentPath}` : 'Tabbed Editor');
                        
                        const isBas = !currentPath || currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        win.$el.find('.btn-run').toggle(!!isBas);
                        win.$el.find('.btn-run-selection').toggle(!!(isBas && editor.getSelection()));
                        
                        refreshMenuBar();
                    };

                    const refreshMenuBar = () => {
                        win.$el.find('.window-menubar').remove();
                        const isBas = !currentPath || currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        const menuDef = [
                            {
                                title: 'File',
                                items: [
                                    { title: 'New', click: onNew },
                                    { title: 'Open...', click: () => AppLauncher.explorer({
                                        modal: true,
                                        title: 'Select a file to open',
                                        onSelect: async (path) => {
                                            const content = await vfs.readProgramAsync(path);
                                            if (content !== null) {
                                                currentPath = path;
                                                editor.setValue(content);
                                                updateUI();
                                            }
                                        }
                                    }) },
                                    { title: 'Save', click: onSave },
                                    { title: 'Save As...', click: onSaveAs },
                                    { separator: true },
                                    { title: 'Close', click: () => WindowManager.closeWindow(win.id) }
                                ]
                            }
                        ];
                        if (isBas) {
                            const runItems = [
                                { title: 'Run', click: onRun }
                            ];
                            if (editor.getSelection()) {
                                runItems.push({ title: 'Run Selection', click: onRunSelection });
                            }
                            menuDef.push({
                                title: 'Run',
                                items: runItems
                            });
                        }
                        WindowManager.createWindowMenuBar(win.$el, menuDef);
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
                        updateUI();
                    };

                    const onSaveAs = async () => {
                        const p = prompt('Save As (path):', currentPath || 'projects/untitled.bas');
                        if (p) { currentPath = p; await onSave(); }
                    };

                    let lastHasSelection = false;
                    editor.on('cursorActivity', () => {
                        const hasSelection = editor.getSelection().length > 0;
                        const isBas = !currentPath || currentPath.toLowerCase().match(/\.(bas|basil)$/);
                        win.$el.find('.btn-run-selection').toggle(isBas && hasSelection);
                        
                        if (hasSelection !== lastHasSelection) {
                            lastHasSelection = hasSelection;
                            if (isBas) refreshMenuBar();
                        }
                    });

                    win.$el.on('click', '.btn-run', onRun);
                    win.$el.on('click', '.btn-run-selection', onRunSelection);

                    updateUI();
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
                    win.$el.find('.window-body').html(`
                        <div class="d-flex flex-column h-100" style="background: var(--surface-1); color: var(--app-fg); padding: 8px 8px 16px 8px;">
                            <div id="chat-messages" class="flex-grow-1 overflow-auto mb-2" style="font-size: 0.9rem; scroll-behavior: smooth;"></div>
                            <div class="input-group input-group-sm d-flex gap-1">
                                <input type="text" id="chat-input" class="form-control bg-dark text-light border-secondary flex-grow-1" placeholder="Type a message...">
                                <button class="btn btn-outline-secondary" id="chat-send">Send</button>
                            </div>
                        </div>
                    `);
                    if (window.Chat && Chat.init) {
                        Chat.init();
                    }
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
                    <div class="explorer-grid p-2"></div>
                `);

                const $grid = $body.find('.explorer-grid');
                data.items.forEach(item => {
                    const icon = item.type === 'dir' ? IconMap['folder'] : getIconForExt(item.ext);
                    const $item = $(`
                        <div class="explorer-item">
                            <i class="bi ${icon}"></i>
                            <span>${item.name}</span>
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

        iframe(url, title, persistenceId = null) {
            WindowManager.createWindow({
                title,
                persistenceId: persistenceId || 'iframe-' + url,
                icon: IconMap['iframe'],
                onOpen: (win) => {
                    win.$el.find('.window-body').html(`<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`);
                }
            });
        },

        deleteVfsFile(win, path) {
            if (confirm(`Are you sure you want to delete "${path}"?`)) {
                try {
                    vfs.deleteFile(path);
                    const folderPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
                    this.renderVfsExplorer(win, folderPath);
                } catch (e) {
                    alert(e.message);
                }
            }
        },

        renameVfsFile(win, path) {
            const oldName = path.split('/').pop();
            const newName = prompt('Enter new name:', oldName);
            if (newName && newName !== oldName) {
                const folderPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
                const newPath = (folderPath ? folderPath + '/' : '') + newName;
                try {
                    vfs.renameFile(path, newPath);
                    this.renderVfsExplorer(win, folderPath);
                } catch (e) {
                    alert(e.message);
                }
            }
        },

        duplicateVfsFile(win, path) {
            const oldName = path.split('/').pop();
            const dotIdx = oldName.lastIndexOf('.');
            const base = dotIdx !== -1 ? oldName.substring(0, dotIdx) : oldName;
            const ext = dotIdx !== -1 ? oldName.substring(dotIdx) : '';
            const newName = prompt('Enter name for duplicate:', base + ' - Copy' + ext);
            if (newName) {
                const folderPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
                const newPath = (folderPath ? folderPath + '/' : '') + newName;
                try {
                    const file = vfs.getFile(path);
                    if (file) {
                        vfs.writeFile(newPath, file.content, file.kind);
                        this.renderVfsExplorer(win, folderPath);
                    }
                } catch (e) {
                    alert(e.message);
                }
            }
        },

        about() {
            WindowManager.createWindow({
                id: 'about',
                singleton: true,
                title: 'About YoBASIC',
                icon: IconMap['info'],
                width: 400,
                height: 250,
                onOpen: (win) => {
                    win.$el.find('.window-body').html(`
                        <div class="p-3">
                            <h5 class="mb-3">YoBASIC Desktop</h5>
                            <p>YoBASIC is a subset of the Basil🌿 programming language and presented here as an interactive learning tool for beginners and a sandbox for experienced developers.</p>
                            <p>Both the Editor and the file I/O functions in BASIC make use of a simulated file system that uses local storage in your browser and will persist between sessions. </p>
                            <p><a href="https://basilbasic.com" target="_blank" rel="noopener" style="color: #000080; text-decoration: underline;">Visit basilbasic.com</a></p>
                        </div>
                    `);
                }
            });
        }
    };

    // Identity Events
    window.addEventListener('identity-change', () => {
        DesktopManager.updateIdentity();
    });

    $(document).on('keydown', (e) => {
        if (e.key === 'Delete') {
            // Check for selected desktop icons
            const $selectedIcons = $('.desktop-icon.selected');
            if ($selectedIcons.length > 0) {
                const names = $selectedIcons.map(function() { return $(this).find('span').text(); }).get();
                if (confirm(`Are you sure you want to delete ${$selectedIcons.length} shortcut(s): ${names.join(', ')}?`)) {
                    $selectedIcons.each(function() {
                        const id = $(this).data('id');
                        DesktopManager.icons = DesktopManager.icons.filter(i => i.id !== id);
                    });
                    DesktopManager.saveCustomIcons();
                    DesktopManager.renderIcons();
                }
                return;
            }
            
            // Check for selected explorer items
            const $selectedFiles = $('.explorer-item.selected');
            if ($selectedFiles.length > 0) {
                const paths = $selectedFiles.map(function() { return $(this).data('path'); }).get().filter(p => p);
                if (paths.length > 0) {
                    if (confirm(`Are you sure you want to delete ${paths.length} file(s)?`)) {
                        let success = 0;
                        paths.forEach(p => {
                            try {
                                vfs.deleteFile(p);
                                success++;
                            } catch (err) {
                                console.error('Failed to delete', p, err);
                            }
                        });
                        if (success > 0) {
                            // Refresh all open explorer windows
                            Object.values(WindowManager.windows).forEach(win => {
                                if (win.$el.find('.explorer-grid').length > 0) {
                                    AppLauncher.renderVfsExplorer(win, win.currentPath || '');
                                }
                            });
                        }
                    }
                }
            }
        }
    });

    // Clock
    setInterval(() => {
        const now = new Date();
        $('#taskbar-clock').text(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    // Initial Launch
    Identity.initializeFromSession().then(async () => {
        try {
            await getSupabase();
            const examplesProvider = new SupabaseExamplesProvider();
            const sharedProvider = new SupabaseSharedProvider(Identity);
            vfs.setProviders({ examples: examplesProvider, shared: sharedProvider });
        } catch (e) {
            console.error('[YoBASIC] Desktop VFS providers init failed', e);
        }
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

    // Bridge for Chat "Open" button
    window.YoBasicIDE = window.YoBasicIDE || {};
    window.YoBasicIDE.openExample = function(payload) {
        const files = Array.isArray(payload.files) ? payload.files : [];
        if (files.length === 0) return;
        
        AppLauncher.editor();
        const win = WindowManager.windows['editor'];
        if (win && win.editor) {
            win.editor.setValue(files[0].content || '');
            WindowManager.focusWindow('editor');
            WindowManager.restoreWindow('editor');
        }
    };
});
