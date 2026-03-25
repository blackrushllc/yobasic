import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import JSZip from 'jszip';
import { AppManifest, Registry, RegisteredApp } from './types';

const REGISTRY_PATH = 'registry.json';
const APPS_DIR = 'apps';

export class PackageInstaller {
  async init() {
    try {
      await Filesystem.mkdir({
        path: APPS_DIR,
        directory: Directory.Data,
        recursive: true
      });
    } catch (e) {
      // Ignore if exists
    }
  }

  async getRegistry(): Promise<Registry> {
    try {
      const result = await Filesystem.readFile({
        path: REGISTRY_PATH,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      return JSON.parse(result.data as string);
    } catch (e) {
      return { schema_version: 1, apps: [] };
    }
  }

  async saveRegistry(registry: Registry) {
    await Filesystem.writeFile({
      path: REGISTRY_PATH,
      directory: Directory.Data,
      data: JSON.stringify(registry, null, 2),
      encoding: Encoding.UTF8
    });
  }

  async installPackage(blob: Blob): Promise<RegisteredApp> {
    const zip = await JSZip.loadAsync(blob);
    
    // 1. Validate manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Missing manifest.json');
    
    const manifestContent = await manifestFile.async('string');
    const manifest: AppManifest = JSON.parse(manifestContent);
    
    // 2. Validate entrypoint
    if (!zip.file(manifest.entrypoint)) {
      throw new Error(`Entrypoint ${manifest.entrypoint} not found in package`);
    }

    const appId = manifest.app_id;
    const appBaseDir = `${APPS_DIR}/${appId}`;
    const currentDir = `${appBaseDir}/current`;
    const dataDir = `${appBaseDir}/data`;

    // 3. Create directories
    await Filesystem.mkdir({ path: appBaseDir, directory: Directory.Data, recursive: true }).catch(() => {});
    await Filesystem.mkdir({ path: currentDir, directory: Directory.Data, recursive: true }).catch(() => {});
    await Filesystem.mkdir({ path: dataDir, directory: Directory.Data, recursive: true }).catch(() => {});

    // 4. Extract files
    const files = Object.keys(zip.files);
    for (const filename of files) {
      const file = zip.files[filename];
      if (file.dir) {
        await Filesystem.mkdir({
          path: `${currentDir}/${filename}`,
          directory: Directory.Data,
          recursive: true
        }).catch(() => {});
      } else {
        const content = await file.async('base64');
        await Filesystem.writeFile({
          path: `${currentDir}/${filename}`,
          directory: Directory.Data,
          data: content
        });
      }
    }

    // 5. Update Registry
    const registry = await this.getRegistry();
    const existingIndex = registry.apps.findIndex(a => a.app_id === appId);
    
    const newApp: RegisteredApp = {
      app_id: appId,
      name: manifest.name,
      version: manifest.version,
      installedAt: Date.now(),
      entrypoint: manifest.entrypoint,
      ui_mode: manifest.ui.mode,
      iconPath: zip.file('icon.png') ? `${currentDir}/icon.png` : undefined
    };

    if (existingIndex >= 0) {
      registry.apps[existingIndex] = newApp;
    } else {
      registry.apps.push(newApp);
    }

    await this.saveRegistry(registry);
    return newApp;
  }

  async uninstallApp(appId: string) {
    const registry = await this.getRegistry();
    registry.apps = registry.apps.filter(a => a.app_id !== appId);
    await this.saveRegistry(registry);

    await Filesystem.rmdir({
      path: `${APPS_DIR}/${appId}`,
      directory: Directory.Data,
      recursive: true
    }).catch(() => {});
  }
}
