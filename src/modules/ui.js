(function(global) {
  'use strict';

  const isBrowser = typeof document !== 'undefined';

  const UI = {
    dialogs: new Map(),
    nextDialogId: 1,
    interpreters: new Set(),

    // Register an interpreter to use with UI
    init(interpreter) {
      this.interpreters.add(interpreter);
    },

    AVAILABLE() {
      return isBrowser ? 1 : 0;
    },

    SHOW(interpreter, viewPath, vars, options) {
      if (!isBrowser) return 0;
      
      try {
        const vfs = interpreter.vfs;
        if (!vfs) throw new Error("VFS not available");
        
        const file = vfs.getFile(viewPath);
        if (!file) throw new Error("View not found: " + viewPath);
        
        const template = file.content || "";
        const html = interpreter._render(template, vars || {});
        
        const dialogId = this.nextDialogId++;
        const dialog = this._createDialogElement(dialogId, html, options || {});
        
        this.dialogs.set(dialogId, {
          id: dialogId,
          root: dialog,
          listeners: [],
          interpreter: interpreter
        });
        
        return dialogId;
      } catch (e) {
        console.error("UI.SHOW error:", e);
        if (interpreter.echo) interpreter.echo("UI.SHOW Error: " + e.message);
        return 0;
      }
    },

    CLOSE(dialogId) {
      if (!isBrowser) return 0;
      const d = this.dialogs.get(dialogId);
      if (!d) return 0;
      
      this._detachAllListeners(d);
      d.root.remove();
      this.dialogs.delete(dialogId);
      return 1;
    },

    SET_TEXT(dialogId, selector, text) {
      if (!isBrowser) return 0;
      const el = this._getEl(dialogId, selector);
      if (el) { el.textContent = text; return 1; }
      return 0;
    },

    GET_TEXT(dialogId, selector) {
      if (!isBrowser) return "";
      const el = this._getEl(dialogId, selector);
      return el ? el.textContent : "";
    },

    SET_VALUE(dialogId, selector, value) {
      if (!isBrowser) return 0;
      const el = this._getEl(dialogId, selector);
      if (el) { el.value = value; return 1; }
      return 0;
    },

    GET_VALUE(dialogId, selector) {
      if (!isBrowser) return "";
      const el = this._getEl(dialogId, selector);
      return el ? el.value : "";
    },

    SET_HTML(dialogId, selector, html) {
      if (!isBrowser) return 0;
      const el = this._getEl(dialogId, selector);
      if (el) { el.innerHTML = html; return 1; }
      return 0;
    },

    FOCUS(dialogId, selector) {
      if (!isBrowser) return 0;
      const el = this._getEl(dialogId, selector);
      if (el) { el.focus(); return 1; }
      return 0;
    },

    ON(dialogId, event, selector, handlerName) {
      if (!isBrowser) return 0;
      const d = this.dialogs.get(dialogId);
      if (!d) return 0;
      
      const listener = (e) => {
        let target = null;
        if (selector === "*") {
          target = d.root;
        } else {
          target = e.target.closest(selector);
        }
        
        if (target && d.root.contains(target)) {
          const evtArg = {
            "DIALOGID%": dialogId,
            "TYPE$": e.type,
            "SELECTOR$": selector,
            "TARGETID$": target.id || "",
            "VALUE$": target.value || "",
            "KEY$": e.key || "",
            "KEYCODE%": e.keyCode || 0,
            "PREVENTDEFAULT%": 0
          };
          
          d.interpreter.invokeCallable(handlerName, [evtArg]).then(res => {
            if (res === 1 || evtArg["PREVENTDEFAULT%"] === 1) {
              e.preventDefault();
            }
          }).catch(err => {
            console.error("UI Event Handler Error:", err);
          });
        }
      };
      
      // Use capture for submit to ensure we catch it before standard form submission if needed
      const useCapture = (event === 'submit');
      d.root.addEventListener(event, listener, useCapture);
      d.listeners.push({ event, listener, useCapture });
      return 1;
    },

    OFF(dialogId, event, selector, handlerName) {
      if (!isBrowser) return 0;
      const d = this.dialogs.get(dialogId);
      if (!d) return 0;
      // Simple implementation: remove all listeners for this event type
      const remaining = [];
      for (const l of d.listeners) {
        if (l.event === event) {
          d.root.removeEventListener(l.event, l.listener, l.useCapture);
        } else {
          remaining.push(l);
        }
      }
      d.listeners = remaining;
      return 1;
    },

    // Internal helpers
    _getEl(dialogId, selector) {
      const d = this.dialogs.get(dialogId);
      if (!d) return null;
      if (selector === "*") return d.root;
      // Search in content first
      const content = d.root.querySelector('.yobasic-dialog-content');
      return (content || d.root).querySelector(selector);
    },

    _createDialogElement(id, html, options) {
      let root = document.getElementById('yobasic-ui-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'yobasic-ui-root';
        document.body.appendChild(root);
      }
      
      const container = document.createElement('div');
      container.className = 'yobasic-dialog yobasic-ui';
      container.style.zIndex = 10000 + id;
      
      // Default position (staggered)
      const offset = (id % 10) * 20;
      container.style.top = (100 + offset) + "px";
      container.style.left = (100 + offset) + "px";
      
      // Title bar
      const titleBar = document.createElement('div');
      titleBar.className = 'yobasic-dialog-titlebar';
      const title = options.title || ("Dialog " + id);
      titleBar.innerHTML = `<span class="title">${this._escapeHtml(title)}</span><button class="close-btn" title="Close">×</button>`;
      titleBar.querySelector('.close-btn').onclick = (e) => {
        e.stopPropagation();
        this.CLOSE(id);
      };
      
      const content = document.createElement('div');
      content.className = 'yobasic-dialog-content';
      content.innerHTML = html;
      
      container.appendChild(titleBar);
      container.appendChild(content);
      root.appendChild(container);
      
      // Focus the dialog
      container.onclick = () => {
        container.style.zIndex = 10000 + this.nextDialogId++;
      };
      
      this._makeDraggable(container, titleBar);
      
      return container;
    },

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    _makeDraggable(el, handle) {
      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
      handle.onmousedown = dragMouseDown;

      function dragMouseDown(e) {
        e = e || window.event;
        if (e.target.classList.contains('close-btn')) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
      }

      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    },

    _detachAllListeners(d) {
      for (const { event, listener, useCapture } of d.listeners) {
        d.root.removeEventListener(event, listener, useCapture);
      }
      d.listeners = [];
    }
  };

  global.YoBasicUI = UI;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
