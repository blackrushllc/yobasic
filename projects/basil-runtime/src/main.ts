import './runtime/native_bridge'; // Initialize bridge
import { HomeView } from './ui/home';
import { RunnerView } from './ui/runner';
import { PackageInstaller } from './pkg/installer';

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

const runner = new RunnerView(appContainer, () => {
  renderHome();
});

function renderHome() {
  const home = new HomeView(
    appContainer,
    (app) => {
      runner.launchApp(app.app_id, app.entrypoint, app.name, app.version, app.ui_mode);
    },
    async () => {
      // Run bundled demo
      try {
        const response = await fetch('/hello_basil.bpkg');
        const blob = await response.blob();
        const installer = new PackageInstaller();
        const app = await installer.installPackage(blob);
        runner.launchApp(app.app_id, app.entrypoint, app.name, app.version, app.ui_mode);
      } catch (err: any) {
        alert('Failed to run demo: ' + err.message);
      }
    }
  );
  home.render();
}

renderHome();
