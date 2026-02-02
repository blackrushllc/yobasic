import { PackageInstaller } from '../pkg/installer';
import { RegisteredApp } from '../pkg/types';

export class HomeView {
  private installer = new PackageInstaller();

  constructor(
    private container: HTMLElement,
    private onLaunch: (app: RegisteredApp) => void,
    private onRunDemo: () => void
  ) {}

  async render() {
    await this.installer.init();
    const registry = await this.installer.getRegistry();

    this.container.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h1 style="margin: 0;">Basil Runtime</h1>
          <button id="import-btn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Import .bpkg
          </button>
        </header>

        <section style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
          <h2 style="margin-top: 0; font-size: 1.2rem;">Quick Start</h2>
          <button id="run-demo-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Run Bundled Demo
          </button>
        </section>

        <section>
          <h2>Installed Apps</h2>
          <div id="app-list">
            ${registry.apps.length === 0 ? '<p style="color: #666;">No apps installed yet.</p>' : ''}
          </div>
        </section>
      </div>
    `;

    const appList = document.getElementById('app-list')!;
    registry.apps.forEach(app => {
      const appEl = document.createElement('div');
      appEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
      appEl.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div style="width: 40px; height: 40px; background: #eee; border-radius: 4px; margin-right: 15px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #999;">
            ${app.name[0]}
          </div>
          <div>
            <div style="font-weight: bold;">${app.name}</div>
            <div style="font-size: 0.8rem; color: #666;">${app.app_id} (v${app.version})</div>
          </div>
        </div>
        <div>
          <button class="launch-btn" style="padding: 8px 15px; background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-right: 5px;">Launch</button>
          <button class="uninstall-btn" style="padding: 8px 15px; background: #fff; color: #dc3545; border: 1px solid #dc3545; border-radius: 4px; cursor: pointer;">Uninstall</button>
        </div>
      `;

      appEl.querySelector('.launch-btn')!.addEventListener('click', () => this.onLaunch(app));
      appEl.querySelector('.uninstall-btn')!.addEventListener('click', async () => {
        if (confirm(`Uninstall ${app.name}?`)) {
          await this.installer.uninstallApp(app.app_id);
          this.render();
        }
      });

      appList.appendChild(appEl);
    });

    document.getElementById('import-btn')!.addEventListener('click', () => this.handleImport());
    document.getElementById('run-demo-btn')!.addEventListener('click', () => this.onRunDemo());
  }

  private handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpkg';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        await this.installer.installPackage(file);
        alert('Package installed successfully!');
        this.render();
      } catch (err: any) {
        alert('Install failed: ' + err.message);
      }
    };
    input.click();
  }
}
