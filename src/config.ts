import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface EpdConfig {
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  autoResolve?: boolean;
  interactive?: boolean;
  ignorePackages?: string[];
  preferredVersions?: Record<string, string>;
  registryUrl?: string;
  timeout?: number;
  retries?: number;
}

const DEFAULT_CONFIG: EpdConfig = {
  autoResolve: true,
  interactive: false,
  ignorePackages: [],
  preferredVersions: {},
  timeout: 30000,
  retries: 3
};

export async function loadConfig(cwd: string = process.cwd()): Promise<EpdConfig> {
  const configPaths = [
    join(cwd, '.epdrc'),
    join(cwd, '.epdrc.json'),
    join(cwd, 'epd.config.json')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        return { ...DEFAULT_CONFIG, ...config };
      } catch (error) {
        console.warn(`⚠️ Invalid config file ${configPath}:`, error);
      }
    }
  }

  return DEFAULT_CONFIG;
}