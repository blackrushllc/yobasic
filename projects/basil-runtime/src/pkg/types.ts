export interface AppManifest {
  app_id: string;
  name: string;
  version: string;
  entrypoint: string;
  ui: {
    mode: 'forms' | 'template' | 'fullpage';
  };
  permissions?: string[];
}

export interface RegisteredApp {
  app_id: string;
  name: string;
  version: string;
  iconPath?: string;
  installedAt: number;
  entrypoint: string;
  ui_mode: string;
}

export interface Registry {
  schema_version: number;
  apps: RegisteredApp[];
}
