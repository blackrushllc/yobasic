import { Filesystem, Directory } from '@capacitor/filesystem';
import { BasicJSAdapter } from '../runtime/basicjs_adapter';
import { AppManifest } from '../pkg/types';

export class RunnerView {
  constructor(
    private container: HTMLElement,
    private onBack: () => void
  ) {}

  async launchApp(appId: string, entrypoint: string, name: string, version: string, mode: string) {
    this.container.innerHTML = `<div style="padding: 20px;">Loading ${name}...</div>`;

    try {
      // 1. Read app files into VFS
      const vfs = await this.buildVFS(`apps/${appId}/current`);

      // 2. Prepare manifest for adapter
      const manifest: AppManifest = {
        app_id: appId,
        name: name,
        version: version,
        entrypoint: entrypoint,
        ui: { mode: mode as any }
      };

      // 3. Load app content via adapter
      const content = await BasicJSAdapter.loadApp(manifest, vfs);

      // 4. Render
      this.container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; position: fixed; top: 0; left: 0; background: white; z-index: 1000;">
          <header style="padding: 10px; background: #333; color: white; display: flex; align-items: center; justify-content: space-between;">
            <button id="back-btn" style="padding: 5px 10px; background: #555; border: none; color: white; border-radius: 4px; cursor: pointer;">&larr; Exit</button>
            <div style="font-size: 0.9rem; font-weight: bold;">${name}</div>
            <div style="width: 50px;"></div>
          </header>
          <div id="runtime-host" style="flex: 1; overflow: auto;">
             <iframe id="app-frame" style="width: 100%; height: 100%; border: none;"></iframe>
          </div>
        </div>
      `;

      const frame = document.getElementById('app-frame') as HTMLIFrameElement;
      frame.contentDocument!.open();
      frame.contentDocument!.write(content);
      frame.contentDocument!.close();

      document.getElementById('back-btn')!.addEventListener('click', () => {
        this.onBack();
      });

    } catch (err: any) {
      this.container.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h2>Launch Error</h2>
          <p>${err.message}</p>
          <button onclick="location.reload()">Back Home</button>
        </div>
      `;
    }
  }

  private async buildVFS(path: string): Promise<Record<string, string>> {
    const vfs: Record<string, string> = {};
    await this.scanDir(path, '', vfs);
    return vfs;
  }

  private async scanDir(fullPath: string, relPath: string, vfs: Record<string, string>) {
    const result = await Filesystem.readdir({
      path: fullPath,
      directory: Directory.Data
    });

    for (const file of result.files) {
      const currentRelPath = relPath ? `${relPath}/${file.name}` : file.name;
      const currentFullPath = `${fullPath}/${file.name}`;

      if (file.type === 'directory') {
        await this.scanDir(currentFullPath, currentRelPath, vfs);
      } else {
        const content = await Filesystem.readFile({
          path: currentFullPath,
          directory: Directory.Data
        });
        // We assume Basil files are text. For icons/assets, we might need base64.
        vfs[currentRelPath] = content.data as string;
      }
    }
  }
}
