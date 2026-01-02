(function(global) {
  'use strict';

  const G = {
    canvas: null,
    ctx: null,
    textures: new Map(),
    pendingTextures: 0,
    keys: new Set(),
    lastFrameTime: 0,
    running: false,
    rafId: null,

    Assets: {
      async LOADTEXTURE(interpreter, key, path) {
        G.pendingTextures++;
        const img = new Image();
        img.onload = () => {
          G.textures.set(String(key).toUpperCase(), img);
          G.pendingTextures--;
        };
        img.onerror = () => {
          console.error(`Failed to load texture: ${path}`);
          G.pendingTextures--;
        };

        // Try VFS first
        let src = path;
        if (interpreter && interpreter.vfs) {
          const file = await interpreter.vfs.getFileAsync(path);
          if (file && file.content) {
            src = file.content;
          }
        }
        img.src = src;
        return 1;
      },
      READY() {
        return G.pendingTextures === 0 ? 1 : 0;
      }
    },

    INPUT: {
      KEYDOWN(interpreter, key) {
        let k = String(key).toUpperCase();
        if (k === 'LEFT') k = 'ARROWLEFT';
        if (k === 'RIGHT') k = 'ARROWRIGHT';
        if (k === 'UP') k = 'ARROWUP';
        if (k === 'DOWN') k = 'ARROWDOWN';
        if (k === 'SPACE') k = ' ';
        
        // Check both original and mapped
        return (G.keys.has(k) || G.keys.has(String(key).toUpperCase())) ? 1 : 0;
      }
    },

    DRAW: {
      CLEAR(interpreter, color) {
        if (!G.ctx) return 0;
        if (color) {
          G.ctx.fillStyle = color;
          G.ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
        } else {
          G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
        }
        return 1;
      },
      SPRITE(interpreter, key, x, y) {
        if (!G.ctx) return 0;
        const img = G.textures.get(String(key).toUpperCase());
        if (img) {
          G.ctx.drawImage(img, parseFloat(x), parseFloat(y));
          return 1;
        }
        return 0;
      }
    },

    WINDOW(interpreter, w, h, title) {
      if (G.canvas) {
        // Clean up old canvas if it exists?
        if (G.canvas.parentNode) G.canvas.parentNode.removeChild(G.canvas);
      }
      
      G.canvas = document.createElement('canvas');
      G.canvas.width = parseInt(w) || 640;
      G.canvas.height = parseInt(h) || 480;
      G.ctx = G.canvas.getContext('2d');
      
      if (global.WindowManager) {
        global.WindowManager.createWindow({
          title: title || "YoBASIC Game",
          width: G.canvas.width + 10,
          height: G.canvas.height + 40,
          onOpen: (win) => {
            const $body = win.$el.find('.window-body');
            $body.css({
              padding: '0',
              background: '#000',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            });
            $body.append(G.canvas);
          },
          onClose: () => {
            G.QUIT();
          }
        });
      } else {
        const container = document.createElement('div');
        container.id = 'yobasic-g-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;font-size:30px;color:white;background:none;border:none;cursor:pointer;';
        closeBtn.onclick = () => {
          G.QUIT();
          document.body.removeChild(container);
        };
        
        container.appendChild(closeBtn);
        container.appendChild(G.canvas);
        document.body.appendChild(container);
      }

      window.addEventListener('keydown', G._handleKeyDown);
      window.addEventListener('keyup', G._handleKeyUp);

      return 1;
    },

    RUN(interpreter, initSub, updateSub, drawSub) {
      G.running = true;
      G.lastFrameTime = performance.now();

      const loop = (timestamp) => {
        if (!G.running) return;

        // Show loading if assets not ready
        if (G.pendingTextures > 0) {
          if (G.ctx) {
            G.ctx.fillStyle = 'black';
            G.ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
            G.ctx.fillStyle = 'white';
            G.ctx.font = '20px monospace';
            G.ctx.fillText('Loading Assets...', 20, 40);
          }
          G.rafId = requestAnimationFrame(loop);
          return;
        }

        const dt = (timestamp - G.lastFrameTime) / 1000;
        G.lastFrameTime = timestamp;

        if (updateSub) {
          const nameUpper = String(updateSub).toUpperCase();
          const f = interpreter.funcs[nameUpper];
          const args = (f && f.params && f.params.length > 0) ? [dt] : [];
          interpreter.invokeCallable(updateSub, args);
        }

        if (drawSub) {
          interpreter.invokeCallable(drawSub, []);
        }

        G.rafId = requestAnimationFrame(loop);
      };

      if (initSub) {
        const res = interpreter.invokeCallable(initSub, []);
        if (res instanceof Promise) {
          res.then(() => {
            G.rafId = requestAnimationFrame(loop);
          }).catch(err => {
            console.error("G.RUN Init Error:", err);
          });
        } else {
          G.rafId = requestAnimationFrame(loop);
        }
      } else {
        G.rafId = requestAnimationFrame(loop);
      }
      return 1;
    },

    QUIT() {
      G.running = false;
      if (G.rafId) {
        cancelAnimationFrame(G.rafId);
        G.rafId = null;
      }
      window.removeEventListener('keydown', G._handleKeyDown);
      window.removeEventListener('keyup', G._handleKeyUp);
      return 1;
    },

    _handleKeyDown(e) {
      G.keys.add(e.key.toUpperCase());
    },
    _handleKeyUp(e) {
      G.keys.delete(e.key.toUpperCase());
    }
  };

  global.YoBasicG = G;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
