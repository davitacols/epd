import { PackageJson } from './types.js';
import { satisfiesRange } from './semver-utils.js';

export interface Conflict {
  package: string;
  requiredVersions: string[];
  requiredBy: string[];
  currentVersion?: string;
}

export async function detectConflicts(packageJson: PackageJson): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Get peer dependencies for each package
  for (const [pkgName, version] of Object.entries(dependencies)) {
    try {
      const peerDeps = await getPeerDependencies(pkgName);
      
      for (const [peerName, peerVersion] of Object.entries(peerDeps)) {
        const currentVersion = dependencies[peerName];
        
        if (currentVersion && !isVersionCompatible(currentVersion, peerVersion)) {
          let conflict = conflicts.find(c => c.package === peerName);
          if (!conflict) {
            conflict = {
              package: peerName,
              requiredVersions: [],
              requiredBy: [],
              currentVersion
            };
            conflicts.push(conflict);
          }
          
          if (!conflict.requiredVersions.includes(peerVersion)) {
            conflict.requiredVersions.push(peerVersion);
          }
          if (!conflict.requiredBy.includes(pkgName)) {
            conflict.requiredBy.push(pkgName);
          }
        }
      }
    } catch (e) {
      // Skip packages that can't be analyzed
    }
  }
  
  return conflicts;
}

async function getPeerDependencies(packageName: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) return {};
    
    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;
    return data.versions?.[latestVersion]?.peerDependencies || {};
  } catch {
    return {};
  }
}

function isVersionCompatible(current: string, required: string): boolean {
  const currentVersion = current.replace(/[\^~]/g, '');
  return !satisfiesRange(currentVersion, required);
}