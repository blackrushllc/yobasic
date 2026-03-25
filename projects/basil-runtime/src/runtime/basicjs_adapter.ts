import { AppManifest } from '../pkg/types';

export class BasicJSAdapter {
  static async loadApp(manifest: AppManifest, vfs: Record<string, string>) {
    console.log('BasicJSAdapter: Loading app', manifest.app_id);
    
    const entrypoint = manifest.entrypoint;
    const code = vfs[entrypoint];

    if (!code) {
      return `
        <div style="padding: 20px; font-family: sans-serif;">
          <h1>App: ${manifest.name}</h1>
          <p>Version: ${manifest.version}</p>
          <p style="color: red;">Error: Entrypoint ${entrypoint} not found in VFS.</p>
          <pre>${JSON.stringify(Object.keys(vfs), null, 2)}</pre>
        </div>
      `;
    }

    // Stub execution: Render a page with the code
    return `
      <div style="padding: 20px; font-family: sans-serif;">
        <h1>${manifest.name}</h1>
        <p><i>Running Basil v0 (Stub)</i></p>
        <hr>
        <div id="output" style="white-space: pre-wrap; background: #eee; padding: 10px; border-radius: 4px;">
Executing ${entrypoint}...
        </div>
        <script>
          // Simulate simple execution
          const output = document.getElementById('output');
          const originalLog = console.log;
          console.log = (...args) => {
            output.innerText += args.join(' ') + '\\n';
            originalLog(...args);
          };

          // Mock LIB for stub
          window.LIB = (name) => {
            return {
              toast: (msg) => window.BasilNative.invoke('ui', 'toast', { message: msg })
            };
          };

          try {
            // Very primitive simulation of Basil PRINT and LIB call
            const code = \`${code.replace(/`/g, '\\`')}\`;
            if (code.includes('PRINT')) {
               const matches = code.match(/PRINT "(.*)"/);
               if (matches) console.log(matches[1]);
            }
            if (code.includes('LIB("ui").toast')) {
               const matches = code.match(/LIB\\("ui"\\).toast\\("(.*)"\\)/);
               if (matches) window.LIB("ui").toast(matches[1]);
            }
          } catch (e) {
            console.log('Error in stub execution:', e);
          }
        </script>
      </div>
    `;
  }
}
