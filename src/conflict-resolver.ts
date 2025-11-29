import { Conflict } from './conflict-detector.js';
import { fetchPackageVersions } from './registry.js';
import { findBestVersion } from './semver-utils.js';

export interface Resolution {
  package: string;
  resolvedVersion: string;
  strategy: string;
  confidence: number;
}

export async function resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]> {
  const resolutions: Resolution[] = [];
  
  for (const conflict of conflicts) {
    const resolution = await resolveConflict(conflict);
    if (resolution) {
      resolutions.push(resolution);
    }
  }
  
  return resolutions;
}

async function resolveConflict(conflict: Conflict): Promise<Resolution | null> {
  try {
    const availableVersions = await fetchPackageVersions(conflict.package);
    const bestVersion = findBestVersion(availableVersions, conflict.requiredVersions);
    
    if (bestVersion) {
      return {
        package: conflict.package,
        resolvedVersion: bestVersion,
        strategy: 'semver-compatible',
        confidence: 1.0
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to resolve conflict for ${conflict.package}:`, error);
    return null;
  }
}

