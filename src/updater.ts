import { execSync } from 'child_process';
import { PackageJson } from './types.js';

export interface UpdateInfo {
  package: string;
  current: string;
  latest: string;
  type: 'major' | 'minor' | 'patch';
  breaking: boolean;
}

export async function checkUpdates(packageJson: PackageJson): Promise<UpdateInfo[]> {
  const updates: UpdateInfo[] = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  for (const [pkg, version] of Object.entries(allDeps)) {
    try {
      const result = execSync(`npm view ${pkg} version`, { 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      const current = version.replace(/[\^~]/, '');
      const latest = result;
      
      if (current !== latest) {
        updates.push({
          package: pkg,
          current,
          latest,
          type: getUpdateType(current, latest),
          breaking: isMajorUpdate(current, latest)
        });
      }
    } catch (error) {
      // Skip packages that can't be checked
    }
  }

  return updates;
}

function getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' {
  const [cMajor, cMinor] = current.split('.').map(Number);
  const [lMajor, lMinor] = latest.split('.').map(Number);
  
  if (lMajor > cMajor) return 'major';
  if (lMinor > cMinor) return 'minor';
  return 'patch';
}

function isMajorUpdate(current: string, latest: string): boolean {
  const cMajor = parseInt(current.split('.')[0]);
  const lMajor = parseInt(latest.split('.')[0]);
  return lMajor > cMajor;
}